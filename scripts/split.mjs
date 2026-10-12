// OBSOLETE — DO NOT RUN.
//
// This regenerated the pre-redesign components from _source/My Langga v2.dc.html
// using hard-coded line ranges. Those components no longer exist, and running
// this would write them back over the current src/components tree.
//
// It is kept only as a record of how the original single-file prototype was
// split up. It has been removed from package.json scripts.

// Split _source/My Langga v2.dc.html into Astro components.
// Runs once (or whenever the source is updated). Idempotent — overwrites its outputs.

import fs from 'node:fs';
import path from 'node:path';

// This script rewrites src/scripts/app.js wholesale, which would resurrect the
// tourFrame/sizeTour engine that the video theater replaced. Opt in explicitly.
if (!process.argv.includes('--force')) {
  console.error('split.mjs overwrites hand-edited files:');
  console.error('  src/scripts/app.js        — the old tour engine was removed from it');
  console.error('  src/components/Tour.astro — rewritten as the video theater');
  console.error('Re-run with --force only if you have re-applied those edits to _source.');
  process.exit(1);
}

const SRC = '_source/My Langga v2.dc.html';
const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split('\n');

// 1-indexed inclusive line ranges → component file
const CUTS = [
  { name: 'Overlays',       from: 32,  to: 52,  dir: 'components' },
  { name: 'Nav',            from: 54,  to: 69,  dir: 'components' },
  { name: 'Hero',           from: 71,  to: 86,  dir: 'components' },
  { name: 'Marquee',        from: 88,  to: 93,  dir: 'components' },
  { name: 'Beginning',      from: 95,  to: 120, dir: 'components' },
  { name: 'Count',          from: 122, to: 197, dir: 'components' },
  { name: 'Journey',        from: 199, to: 372, dir: 'components' },
  { name: 'Flowers',        from: 374, to: 576, dir: 'components' },
  { name: 'Future',         from: 578, to: 608, dir: 'components' },
  // Hand-maintained since the video-theater redesign: still imported and rendered
  // by index.astro, but never regenerated from _source (it needs an npm import).
  { name: 'Tour',           from: 610, to: 687, dir: 'components', frozen: true },
  { name: 'Letter',         from: 689, to: 725, dir: 'components' },
  { name: 'Forever',        from: 727, to: 738, dir: 'components' },
  { name: 'Promise',        from: 739, to: 745, dir: 'components' },
  { name: 'ForeverMarquee', from: 747, to: 752, dir: 'components' },
  { name: 'Footer',         from: 753, to: 757, dir: 'components' },
];

// --- Sanity: pick out the helmet styles block for the Layout ---
const helmetMatch = src.match(/<helmet>([\s\S]*?)<\/helmet>/);
if (!helmetMatch) throw new Error('helmet block not found');
let helmet = helmetMatch[1].trim();
// image-slot.js will be included from public/, not from helmet
helmet = helmet.replace(/<script src="\.\/image-slot\.js"><\/script>\s*/, '');

// --- Sanity: pick out the Component class body for the client script ---
const scriptMatch = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('component script not found');
let script = scriptMatch[1].trim()
  .replace(/^class Component extends DCLogic \{/, '')
  .replace(/\}\s*$/, '');

// --- Transform template bindings so Astro parses the HTML cleanly ---
function transform(html) {
  return html
    // onClick="{{ handler }}" → data-action="handler"  (Astro parses {{}} as JSX)
    .replace(/onClick="\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}"/g, 'data-action="$1"')
    // {{ days }} inline text → span the client hydrates
    .replace(/\{\{\s*days\s*\}\}/g, '<span data-tpl="days"></span>');
}

// --- Emit component files ---
const outDir = path.join('src', 'components');
fs.mkdirSync(outDir, { recursive: true });

const imports = [];
const usages = [];

for (const cut of CUTS) {
  if (cut.frozen) {
    imports.push(`import ${cut.name} from '../components/${cut.name}.astro';`);
    usages.push(`  <${cut.name} />`);
    continue;
  }
  const chunk = lines.slice(cut.from - 1, cut.to).join('\n');
  const transformed = transform(chunk);
  // Any leftover {{ }} anywhere is a bug — fail loudly.
  const leftover = transformed.match(/\{\{[^}]*\}\}/g);
  if (leftover) throw new Error(`Leftover binding in ${cut.name}: ${leftover.join(', ')}`);
  // Astro treats a lone `{` in HTML as an expression. None of these sections use
  // { in raw text, but if any did we'd escape here.
  const file = path.join(outDir, `${cut.name}.astro`);
  fs.writeFileSync(file, transformed + '\n');
  imports.push(`import ${cut.name} from '../components/${cut.name}.astro';`);
  usages.push(`  <${cut.name} />`);
}

// --- Layout: head/fonts/base styles, plus the persistent overlay slots ---
const layoutContent = `---
export interface Props { title?: string }
const { title = 'My Langga — Britney & Jeevie' } = Astro.props;
---
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
${helmet}
<script src="/image-slot.js" is:inline></script>
</head>
<body>
<div id="lv-root" style="position:relative; background:#FAF7F2; color:#1B1B1F; overflow:clip; font-family:'Instrument Sans Variable','Helvetica Neue',Arial,sans-serif;">
  <slot />
</div>
</body>
</html>
`;
fs.mkdirSync('src/layouts', { recursive: true });
fs.writeFileSync('src/layouts/Layout.astro', layoutContent);

// --- Index page: composes the components in reading order + loads the client script ---
const indexContent = `---
import Layout from '../layouts/Layout.astro';
${imports.join('\n')}
---
<Layout>
${usages.join('\n')}
</Layout>

<script>
  import { boot } from '../scripts/app.js';
  boot();
</script>
`;
fs.mkdirSync('src/pages', { recursive: true });
fs.writeFileSync('src/pages/index.astro', indexContent);

// --- Client script: the whole Component class + wiring ---
const appJs = `// Standalone site logic, ported from My Langga v2.dc.html's <script data-dc-script>.
// The class body is left byte-for-byte identical; only the DCLogic wrapper is gone
// and the {{ handler }} attributes were rewritten to data-action="handler".

const APP_PROPS = { accent: '#EF4056', showIntro: true, particles: true };

class App {
  constructor(props) { this.props = props; }
${script}
}

export function boot() {
  const start = () => {
    const app = new App(APP_PROPS);

    // Fill template values
    const days = Math.max(0, Math.floor((Date.now() - new Date('2022-05-14T00:00:00')) / 86400000)).toLocaleString();
    document.querySelectorAll('[data-tpl="days"]').forEach(el => el.textContent = days);

    // Wire click handlers exposed by renderVals()
    const handlers = app.renderVals();
    document.querySelectorAll('[data-action]').forEach(el => {
      const name = el.dataset.action;
      const fn = handlers[name];
      if (typeof fn === 'function') el.addEventListener('click', fn);
    });

    app.componentDidMount();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
`;
fs.mkdirSync('src/scripts', { recursive: true });
fs.writeFileSync('src/scripts/app.js', appJs);

// --- image-slot.js goes in public/ so /image-slot.js resolves at runtime ---
fs.mkdirSync('public', { recursive: true });
fs.copyFileSync('_source/image-slot.js', 'public/image-slot.js');

console.log('Wrote:');
console.log(`  src/layouts/Layout.astro`);
console.log(`  src/pages/index.astro`);
console.log(`  src/scripts/app.js`);
for (const c of CUTS) console.log(`  src/components/${c.name}.astro`);
console.log(`  public/image-slot.js`);
