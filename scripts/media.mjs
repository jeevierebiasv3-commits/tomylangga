/* ============================================================================
   scripts/media.mjs — the media pipeline
   ----------------------------------------------------------------------------
   Replaces scripts/build-gallery.mjs. One pass over every source folder that
   produces, for each photo and clip:

     photos  AVIF + WebP at up to four widths, one JPEG fallback, and a 24px
             base64 LQIP used as a blur-up backdrop
     clips   H.264 MP4 (CRF 27, rate-capped, +faststart), long edge capped per
             set, plus a poster frame and the probed intrinsic dimensions

   Two things the first version of this script got wrong, kept here as the
   reasoning behind the current numbers:

     - A responsive set is *supposed* to be larger on disk than its source;
       the browser only ever fetches one variant. Comparing directory sizes
       made a 4x delivery win look like a 2% regression. The report below
       measures bytes-per-view instead.
     - Re-encoding an already-compressed phone clip at a quality higher than
       the original makes it bigger. One 0.8 MB clip came out at 8.3 MB. The
       encoder is now rate-capped, and any encode that fails to beat its
       source is thrown away in favour of a stream copy.

   It then writes two generated files:

     src/data/media.js    the manifest every <Picture>/<Clip> reads
     src/data/plates.js   the 104-plate gallery layout (same shape as before)

   Source masters in dates/, images/ and videos/ are never modified. Everything
   is written under public/m/.

   Run with:  npm run media            (incremental — skips unchanged sources)
              npm run media -- --force (re-encode everything)

   Binaries come from ffmpeg-static / ffprobe-static, so no system ffmpeg is
   required.
   ========================================================================= */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const run = promisify(execFile);
const FFMPEG = ffmpegPath;
const FFPROBE = ffprobeStatic.path;

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'm');
const CACHE_FILE = path.join(ROOT, '.media-cache.json');
const MANIFEST = path.join(ROOT, 'src', 'data', 'media.js');
const PLATES = path.join(ROOT, 'src', 'data', 'plates.js');

const FORCE = process.argv.includes('--force');
const WIDTHS = [480, 960, 1440];
const CONCURRENCY = Math.max(2, Math.min(8, os.cpus().length - 1));

/* A source only earns a fourth, native-width variant if it is meaningfully
   larger than 1440 — emitting a 1536 next to a 1440 doubles the storage for
   96px nobody will ever see. */
const NATIVE_MARGIN = 1.15;

/* The JPEG is a last-resort fallback for browsers with neither AVIF nor WebP.
   Those are old and rare; serving them a full-resolution master is wasteful. */
const JPEG_FALLBACK_W = 1024;

const IMG_EXT = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.avif']);
const VID_EXT = new Set(['.mp4', '.mov', '.webm', '.m4v']);

/* ----------------------------------------------------------------------------
   Sources

   Order matters twice over: it is the dedupe precedence (first set to claim a
   content hash keeps the file) and the order plates are hung in the gallery.

   `gallery` carries the exhibition copy for sets that appear in the gallery;
   sets without it are story-only assets.

   media-src/tour holds the ten hand-trimmed tour clips. They are derivatives
   with no master in the repo, so they are kept as sources in their own right —
   outside public/, or they would be served twice: once raw and once encoded.
   -------------------------------------------------------------------------- */
const SETS = [
  {
    key: 'parish', dir: 'images', only: ['parish.jpg'], keepName: true,
    gallery: {
      title: 'Where It Began', meta: 'Chapter One — The Beginning',
      place: 'San Vicente Ferrer Parish, Balamban',
      note: 'One question, one answer, and everything after.',
    },
  },
  {
    key: 'moments', dir: 'images', skip: ['parish.jpg'], keepName: true,
    gallery: {
      title: 'Frames We Kept', meta: 'Chapter Three — Shared Memories',
      place: 'Toledo City',
      note: 'The ones I never thought to photograph, and did.',
    },
  },
  {
    key: 'buwakan', dir: 'dates/Buwakan',
    gallery: {
      title: 'Surrounded by Blooms', meta: 'Interlude — The Flower Date',
      place: 'Buwakan, Toledo City',
      note: 'I brought flowers. You outshone every single one.',
    },
  },
  {
    key: 'lowkey', dir: 'dates/lowkey',
    gallery: {
      title: 'The Lowkey Nights', meta: 'Chapter Three — Shared Memories',
      place: 'Nowhere in particular',
      note: 'No plans, no photos worth posting — my favourite ones.',
    },
  },
  {
    key: 'ice', dir: 'dates/Ice Skating',
    gallery: {
      title: 'First Time on the Ice', meta: 'Chapter Three — Shared Memories',
      place: 'SM Seaside, Cebu',
      note: 'Both hands on the rail, both eyes on you.',
    },
  },
  {
    key: 'ice-clip', dir: 'dates/Ice Skating Videos',
    gallery: {
      title: 'One More Round', meta: 'Chapter Three — Shared Memories',
      place: 'SM Seaside, Cebu',
      note: 'Said "last one" four times, meant none of them.',
    },
  },
  {
    key: 'clips', dir: 'videos',
    gallery: {
      title: 'Moving Pictures', meta: 'Chapter Three — Shared Memories',
      place: 'Everywhere we went',
      note: 'Sound off, still loud with everything I remember.',
    },
  },
  // Story-only. Not hung in the gallery; referenced by id from the chapters.
  { key: 'tour', dir: 'media-src/tour', keepName: true, noDedupe: true, maxEdge: 1080 },
  { key: 'still', dir: '.', only: ['forever.avif'], keepName: true },
];

/* --- naming ----------------------------------------------------------------
   Sets whose sources have meaningful filenames keep them, so a chapter can
   reference `moments/pic12` and mean something. Sets whose sources are camera
   UUIDs (buwakan, ice, lowkey) are renumbered in gallery order instead. */
const slug = (name) =>
  path.basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const naturally = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/* ----------------------------------------------------------------------------
   Collect — walk the sets, dedupe by content hash
   -------------------------------------------------------------------------- */
function collect() {
  const seen = new Map();
  const items = [];

  for (const set of SETS) {
    const dir = path.join(ROOT, set.dir);
    if (!fs.existsSync(dir)) { console.warn(`  skip missing ${set.dir}`); continue; }

    const files = fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isFile())
      .map(d => d.name)
      .filter(n => (set.only ? set.only.includes(n) : true))
      .filter(n => (set.skip ? !set.skip.includes(n) : true))
      .filter(n => {
        const e = path.extname(n).toLowerCase();
        return IMG_EXT.has(e) || VID_EXT.has(e);
      })
      .sort(naturally);

    let n = 0;
    for (const name of files) {
      const abs = path.join(dir, name);
      const hash = createHash('md5').update(fs.readFileSync(abs)).digest('hex');

      if (!set.noDedupe) {
        if (seen.has(hash)) { console.log(`  dupe  ${set.dir}/${name}  ==  ${seen.get(hash)}`); continue; }
        seen.set(hash, `${set.dir}/${name}`);
      }

      n += 1;
      const ext = path.extname(name).toLowerCase();
      const kind = VID_EXT.has(ext) ? 'video' : 'image';
      const base = set.keepName || !set.gallery
        ? slug(name)
        : `${set.key}-${String(n).padStart(2, '0')}`;

      items.push({ set, kind, abs, hash, base, index: n, id: `${set.key}/${base}` });
    }
  }
  return items;
}

/* ----------------------------------------------------------------------------
   Cache — skip anything whose source hash and recipe are unchanged
   -------------------------------------------------------------------------- */
const RECIPE = 'v2:avif48+webp70@480,960,1440+jpg76@1024|h264crf27-capped-noupsize';

let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { cache = {}; }

const fresh = (item, outputs) => {
  if (FORCE) return false;
  const hit = cache[item.id];
  if (!hit || hit.hash !== item.hash || hit.recipe !== RECIPE) return false;
  return outputs.every(f => fs.existsSync(f));
};

/* ----------------------------------------------------------------------------
   Images
   -------------------------------------------------------------------------- */
async function processImage(item) {
  const outDir = path.join(OUT_DIR, item.set.key);
  await fsp.mkdir(outDir, { recursive: true });

  const input = sharp(item.abs, { failOn: 'none' });
  const meta = await input.metadata();
  // EXIF orientation 5-8 swap the axes; report what the browser will lay out.
  const swap = meta.orientation >= 5;
  const w = swap ? meta.height : meta.width;
  const h = swap ? meta.width : meta.height;

  const widths = WIDTHS.filter(x => x <= w);
  if (widths.length === 0) widths.push(w);
  else if (w > widths[widths.length - 1] * NATIVE_MARGIN) widths.push(w);

  const jpegW = Math.min(JPEG_FALLBACK_W, w);
  const out = (fmt, width) => path.join(outDir, `${item.base}-${width}.${fmt}`);
  const expected = widths
    .flatMap(x => [out('avif', x), out('webp', x)])
    .concat(out('jpg', jpegW));

  if (!fresh(item, expected)) {
    // Clear any variants a previous recipe left behind, or widths that are no
    // longer generated accumulate in public/m forever.
    for (const stale of await fsp.readdir(outDir)) {
      if (stale.startsWith(`${item.base}-`) && !expected.some(f => path.basename(f) === stale)) {
        await fsp.rm(path.join(outDir, stale), { force: true });
      }
    }

    for (const width of widths) {
      const base = sharp(item.abs, { failOn: 'none' }).rotate().resize({ width, withoutEnlargement: true });
      await Promise.all([
        base.clone().avif({ quality: 48, effort: 4 }).toFile(out('avif', width)),
        base.clone().webp({ quality: 70, effort: 4 }).toFile(out('webp', width)),
      ]);
    }
    await sharp(item.abs, { failOn: 'none' }).rotate()
      .resize({ width: jpegW, withoutEnlargement: true })
      .jpeg({ quality: 76, progressive: true, mozjpeg: true })
      .toFile(out('jpg', jpegW));
  }

  // LQIP: a 24px WebP, inlined. Cheap enough to regenerate every run.
  const lqipBuf = await sharp(item.abs, { failOn: 'none' }).rotate()
    .resize({ width: 24 }).webp({ quality: 42 }).toBuffer();

  const rel = (fmt, width) => `/m/${item.set.key}/${item.base}-${width}.${fmt}`;
  const srcset = (fmt) => widths.map(x => `${rel(fmt, x)} ${x}w`).join(', ');

  cache[item.id] = { hash: item.hash, recipe: RECIPE };

  return {
    id: item.id,
    kind: 'image',
    w, h,
    ratio: +(w / h).toFixed(4),
    lqip: `data:image/webp;base64,${lqipBuf.toString('base64')}`,
    src: rel('jpg', jpegW),
    avif: srcset('avif'),
    webp: srcset('webp'),
    widths,
    // What a typical viewer actually downloads, used by the size report.
    typical: (await fsp.stat(out('avif', widths.find(x => x >= 960) || widths[widths.length - 1]))).size,
  };
}

/* ----------------------------------------------------------------------------
   Videos
   -------------------------------------------------------------------------- */
async function probe(file) {
  const { stdout } = await run(FFPROBE, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json', file,
  ], { maxBuffer: 1 << 22 });
  const json = JSON.parse(stdout);
  const s = (json.streams && json.streams[0]) || {};
  return {
    w: s.width || 0,
    h: s.height || 0,
    duration: Math.round(parseFloat((json.format && json.format.duration) || 0) * 10) / 10,
  };
}

async function processVideo(item) {
  const outDir = path.join(OUT_DIR, item.set.key);
  await fsp.mkdir(outDir, { recursive: true });

  const mp4 = path.join(outDir, `${item.base}.mp4`);
  const poster = path.join(outDir, `${item.base}.jpg`);
  const info = await probe(item.abs);

  if (!fresh(item, [mp4, poster])) {
    // Cap the long edge for the role this clip plays, and force even
    // dimensions (H.264 requires them).
    const edge = item.set.maxEdge || 720;
    const scale = `scale='trunc(min(1,${edge}/max(iw,ih))*iw/2)*2':'trunc(min(1,${edge}/max(iw,ih))*ih/2)*2'`;
    const srcBytes = (await fsp.stat(item.abs)).size;

    await run(FFMPEG, [
      '-y', '-loglevel', 'error',
      '-i', item.abs,
      '-vf', scale,
      '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '27',
      '-pix_fmt', 'yuv420p',
      // Hard ceiling on bitrate. Without it, x264 happily spends *more* bits
      // than a heavily-compressed phone original — which is how a 0.8 MB clip
      // became 8.3 MB on the first run.
      '-maxrate', '1800k', '-bufsize', '3600k',
      '-movflags', '+faststart',
      // These clips are played muted and decorative; dropping audio saves
      // bandwidth and sidesteps autoplay policy entirely.
      '-an',
      mp4,
    ], { maxBuffer: 1 << 24 });

    // If re-encoding did not actually help, keep the original pixels and just
    // remux for +faststart. Re-encoding to a larger file is never a win.
    if ((await fsp.stat(mp4)).size > srcBytes * 0.9) {
      try {
        await run(FFMPEG, [
          '-y', '-loglevel', 'error',
          '-i', item.abs,
          '-c', 'copy', '-an', '-movflags', '+faststart',
          mp4,
        ], { maxBuffer: 1 << 24 });
      } catch {
        // Stream copy refused by the container — keep the re-encode.
      }
    }

    await run(FFMPEG, [
      '-y', '-loglevel', 'error',
      '-ss', Math.min(0.5, Math.max(0, (info.duration || 1) / 4)).toFixed(2),
      '-i', item.abs,
      '-frames:v', '1',
      '-vf', "scale='min(1280,iw)':-2",
      '-q:v', '4',
      poster,
    ], { maxBuffer: 1 << 24 });
  }

  const out = await probe(mp4);
  const lqipBuf = await sharp(poster).resize({ width: 24 }).webp({ quality: 42 }).toBuffer();

  cache[item.id] = { hash: item.hash, recipe: RECIPE };

  return {
    id: item.id,
    kind: 'video',
    w: out.w || info.w,
    h: out.h || info.h,
    ratio: +((out.w || info.w) / (out.h || info.h)).toFixed(4),
    duration: info.duration,
    lqip: `data:image/webp;base64,${lqipBuf.toString('base64')}`,
    src: `/m/${item.set.key}/${item.base}.mp4`,
    poster: `/m/${item.set.key}/${item.base}.jpg`,
    typical: (await fsp.stat(mp4)).size,
    posterBytes: (await fsp.stat(poster)).size,
  };
}

/* ----------------------------------------------------------------------------
   Gallery layout — unchanged from build-gallery.mjs
   -------------------------------------------------------------------------- */
const PATTERNS = [
  [{ col: 2, span: 3, ratio: '3 / 4', off: 0 }, { col: 7, span: 4, ratio: '4 / 3', off: 12 }],
  [{ col: 1, span: 5, ratio: '4 / 5', off: 0 }, { col: 7, span: 2, ratio: '3 / 4', off: 16 }, { col: 10, span: 3, ratio: '1 / 1', off: 4 }],
  [{ col: 3, span: 4, ratio: '3 / 2', off: 0 }, { col: 8, span: 4, ratio: '4 / 5', off: 10 }],
  [{ col: 1, span: 3, ratio: '1 / 1', off: 8 }, { col: 5, span: 6, ratio: '16 / 9', off: 0 }],
  [{ col: 2, span: 4, ratio: '4 / 5', off: 0 }, { col: 7, span: 5, ratio: '3 / 2', off: 14 }],
  [{ col: 1, span: 4, ratio: '3 / 4', off: 6 }, { col: 6, span: 2, ratio: '1 / 1', off: 0 }, { col: 9, span: 4, ratio: '4 / 5', off: 12 }],
  [{ col: 3, span: 7, ratio: '21 / 9', off: 0 }, { col: 11, span: 2, ratio: '3 / 4', off: 10 }],
  [{ col: 1, span: 4, ratio: '4 / 5', off: 0 }, { col: 6, span: 5, ratio: '4 / 3', off: 10 }],
];

function buildPlates(items, manifest) {
  const hung = items.filter(i => i.set.gallery);
  const out = [];
  let row = 0, pat = 0, cell = 0;

  hung.forEach((it, i) => {
    const pattern = PATTERNS[pat % PATTERNS.length];
    if (cell === 0) row += 1;
    const p = pattern[cell];
    const entry = manifest[it.id];
    const portrait = entry && entry.ratio < 1;
    const [rw, rh] = p.ratio.split('/').map(Number);
    const ratio = portrait && rw >= rh ? '3 / 4' : p.ratio;

    out.push({
      id: `gal-${String(i + 1).padStart(3, '0')}`,
      media: it.id,
      kind: it.kind,
      title: `${it.set.gallery.title} · ${String(it.index).padStart(2, '0')}`,
      meta: it.set.gallery.meta,
      place: it.set.gallery.place,
      note: it.set.gallery.note,
      row, col: p.col, span: p.span, ratio, off: p.off,
    });

    cell += 1;
    if (cell >= pattern.length) { cell = 0; pat += 1; }
  });
  return out;
}

/* ----------------------------------------------------------------------------
   Writing the generated files
   -------------------------------------------------------------------------- */
function writeManifest(entries) {
  const body = entries
    .map(e => `  ${JSON.stringify(e.id)}: ${JSON.stringify(e)},`)
    .join('\n');

  const src = `// GENERATED by scripts/media.mjs — do not edit by hand.
// Re-run with: npm run media
//
// One entry per source photo or clip, keyed by "<set>/<name>". Components read
// it through src/components/ui/Picture.astro and Clip.astro, which is also
// where a missing id is turned into a build error.

export const MEDIA = {
${body}
};

/** Look an entry up, failing loudly at build time rather than rendering a hole. */
export function media(id) {
  const entry = MEDIA[id];
  if (!entry) {
    throw new Error(
      \`[media] unknown asset "\${id}". Run \\\`npm run media\\\`, or check the id against src/data/media.js.\`
    );
  }
  return entry;
}
`;
  fs.writeFileSync(MANIFEST, src);
}

function writePlates(plates) {
  const body = plates.map(p =>
    `  { id: '${p.id}', media: '${p.media}', kind: '${p.kind}'` +
    `, title: ${JSON.stringify(p.title)}` +
    `, meta: ${JSON.stringify(p.meta)}` +
    `, place: ${JSON.stringify(p.place)}` +
    `, note: ${JSON.stringify(p.note)}` +
    `, row: ${p.row}, col: ${p.col}, span: ${p.span}` +
    `, ratio: '${p.ratio}', off: ${p.off} }`
  ).join(',\n');

  fs.writeFileSync(PLATES, `// GENERATED by scripts/media.mjs — do not edit by hand.
// Re-run with: npm run media
//
// One plate per photo or clip hung in the gallery. row/col/span/off drive the
// scattered composition on a 12-column grid; \`media\` is the key into MEDIA.

export const PLATES = [
${body}
];

export const OPENED = 'May 14, 2022';
`);
}

/* ----------------------------------------------------------------------------
   Main
   -------------------------------------------------------------------------- */
async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let cursor = 0, done = 0;
  const total = list.length;

  async function worker() {
    while (cursor < list.length) {
      const i = cursor++;
      try {
        out[i] = await fn(list[i]);
      } catch (err) {
        console.error(`\n  FAILED ${list[i].id}: ${err.message}`);
        out[i] = null;
      }
      done += 1;
      if (done % 5 === 0 || done === total) {
        process.stdout.write(`\r  ${done}/${total}   `);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  process.stdout.write('\n');
  return out.filter(Boolean);
}

async function dirSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const e of await fsp.readdir(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) {
      try { total += (await fsp.stat(path.join(e.parentPath || e.path, e.name))).size; } catch { /* race */ }
    }
  }
  return total;
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function main() {
  console.log(`\nmedia pipeline — ${CONCURRENCY} workers${FORCE ? ' — FORCED re-encode' : ''}\n`);

  const before =
    (await dirSize(path.join(ROOT, 'dates'))) +
    (await dirSize(path.join(ROOT, 'images'))) +
    (await dirSize(path.join(ROOT, 'videos'))) +
    (await dirSize(path.join(ROOT, 'public', 'videos')));

  console.log('scanning sources…');
  const items = collect();
  const photos = items.filter(i => i.kind === 'image');
  const clips = items.filter(i => i.kind === 'video');
  console.log(`  ${items.length} unique assets — ${photos.length} photos, ${clips.length} clips\n`);

  console.log('photos → avif + webp + jpg');
  const imageEntries = await mapLimit(photos, CONCURRENCY, processImage);

  console.log('clips → h.264 + poster  (this is the slow part)');
  const videoEntries = await mapLimit(clips, Math.max(2, Math.floor(CONCURRENCY / 2)), processVideo);

  const entries = [...imageEntries, ...videoEntries];
  const manifest = Object.fromEntries(entries.map(e => [e.id, e]));

  writeManifest(entries);
  const plates = buildPlates(items, manifest);
  writePlates(plates);
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 0));

  const after = await dirSize(OUT_DIR);
  const vids = plates.filter(p => p.kind === 'video').length;

  // Bytes one viewer downloads: a photo costs its ~960w AVIF, a clip costs
  // its poster up front and the mp4 only if it actually plays.
  const photoBytes = imageEntries.reduce((n, e) => n + (e.typical || 0), 0);
  const posterBytes = videoEntries.reduce((n, e) => n + (e.posterBytes || 0), 0);
  const clipBytes = videoEntries.reduce((n, e) => n + (e.typical || 0), 0);

  console.log(`
manifest   ${entries.length} assets  →  src/data/media.js
plates     ${plates.length} (${plates.length - vids} photos, ${vids} clips)  →  src/data/plates.js

on disk    ${mb(before)} sources  →  ${mb(after)} in public/m
           (a responsive set is larger on disk by design — the browser picks one)

per view   ${mb(photoBytes)}  every photo at ~960w avif
           ${mb(posterBytes)}  every clip poster
           ${mb(clipBytes)}  every clip, if all of them played
           ${mb(photoBytes + posterBytes)}  realistic full-site read
`);

  const failed = photos.length + clips.length - entries.length;
  if (failed > 0) {
    console.error(`${failed} asset(s) failed to process — see errors above.`);
    process.exitCode = 1;
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
