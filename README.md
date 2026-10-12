# My Langga

A love story in five chapters, for Britney, from Jeevie. Since May 14, 2022.

Astro 7, GSAP (ScrollTrigger / ScrollSmoother / SplitText / DrawSVG), and one
three.js scene in the prologue.

```bash
npm install
npm run media    # builds public/m/ from the source folders — needed once
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run preview
```

`public/m/` is generated and git-ignored, so `npm run media` has to run once
on a fresh checkout before the images resolve. It is incremental after that.

---

## The shape of it

```
/                 the story    — prologue + five chapters + the memory map
/gallery          the room     — all 104 photographs and clips
```

| Chapter | | Built from |
|---|---|---|
| Prologue | The van window | the ride to the resort, 14 May 2022 |
| I | Before we spoke | the wedding at San Vicente Ferrer Parish |
| II | You play that too? | the van, the question, the live counter |
| III | The places we went | the dates · ten frames · the flower date · the guided tour |
| — | The map of us | every place, in order |
| IV | Still, and always | the five reasons · the little things · the letter |
| V | What comes next | the list · the promise · forever |

---

## Two things are waiting for you

These are marked slots, not bugs. Both sections are presentable as they are.

**`src/data/songs.js`** — the five songs. Every `artist` is still `null`, so
the tracklist renders "to be filled in" in a quiet italic rather than the
literal string "Artist name" the old site shipped. Fill in `artist`, and
adjust `title` / `caption` if a different song belongs to that moment.

**`src/data/future.js`** — the four "what comes next" entries. Each can take a
`media` id once you have a photograph for it. Drop the photo into `images/`,
run `npm run media`, and use the id it prints (`moments/<name>`). With
`media: null` the list is typographic, which is a deliberate state.

**`public/audio/prologue-bed.m4a`** *(optional)* — an ambient bed for the
prologue. The sound control checks whether this file exists and hides itself
if it does not, so there is no broken button in the meantime. Sound is always
off by default and never required.

---

## Three dates I could not confirm

I did not invent values for these. Where a date is unknown the layout holds
its place and shows nothing, rather than printing a plausible lie.

1. **The first concert.** The old site said *March 2020* — two years before
   you met at the wedding in May 2022. Set `date` and `dateLabel` in
   `src/data/journey.js` (entry `02`) and `src/data/milestones.js`
   (`id: 'concert'`). The map currently shows "date to confirm".
2. **The flower date and the ice skating** have no dates at all in the
   original material. Same two files if you want to add them.
3. **The sign-off.** The old `Promise.astro` was signed *July 2022* while
   everything else said May 14, 2022. Everything now uses May 14, 2022.

Also fixed: the gallery lightbox was hard-coded to `01 / 18` against 104
plates. It counts properly now.

---

## Media

`npm run media` is the whole pipeline. It reads the source folders, never
writes to them, and produces everything under `public/m/`.

```
dates/            the original photo and video folders
images/           the story photographs
videos/           the long clips
media-src/tour/   the ten hand-trimmed tour clips
   ↓  npm run media
public/m/         avif + webp + jpeg at 480/960/1440, h.264 + posters
src/data/media.js    the manifest (generated)
src/data/plates.js   the gallery layout (generated)
```

- Photos → AVIF + WebP at up to four widths, one JPEG fallback, and a 24px
  inline blur-up placeholder.
- Clips → H.264, CRF 27, rate-capped, long edge 720 (1080 for the tour),
  audio stripped, plus a poster frame. **Any encode that fails to beat its
  source is thrown away in favour of a stream copy** — re-encoding an
  already-compressed phone clip at higher quality makes it bigger, which on
  the first run turned a 0.8 MB clip into 8.3 MB.
- Incremental: unchanged sources are skipped. `npm run media:force` re-encodes
  everything.

**Where it landed.** 169.6 MB of sources → 122.1 MB on disk, but the number
that matters is what one visitor downloads: **about 5 MB** for every
photograph on the site plus every clip poster. A clip's video is only fetched
if it actually plays.

Referencing a media id that does not exist is a **build error**, not a blank
space — `media()` in the generated manifest throws.

---

## Motion and accessibility

There is one switch, in the index overlay, and it is the real one. It
overrides the operating system setting in both directions and is remembered.

With motion off: every pin releases, every scrub becomes its end state, the
custom cursor is removed, ScrollSmoother is torn down, and the page is an
ordinary vertical document — the horizontal chapter becomes four stacked
articles, the ten frames become a grid, the tour becomes a list of ten clips
with controls. Nothing is missing and nothing is hidden. Verified: zero
elements left at `opacity: 0`.

Other things that are true and worth keeping true:

- Every text/background pair on both pages clears **WCAG AA**. The tokens
  marked `DECORATION ONLY` in `src/styles/tokens.css` (`--ink-46`,
  `--ink-24`, `--bone-38`, `--bone-18`) must never be used as a text colour;
  `--ink-muted` / `--bone-muted` are the floor for that.
- Any section painted dark must carry `data-tone="dark"`, or the shared
  primitives keep their light-tone colours and render ink-on-ink.
- The prologue is a real modal: trapped tab order, Escape to leave, skip
  visible from the first frame, and the choice remembered for the session.
- The pinned horizontal chapter is keyboard-reachable — focusing a card
  drives the pin to it instead of letting focus disappear offscreen.
- The Cebuano cards are marked `lang="ceb"` so they are not read aloud with
  an English voice.
- No horizontal page scroll at 390px.

---

## Notes for whoever edits this next

- **A pinned ScrollTrigger must be triggered by the element being pinned.**
  Triggering on an outer wrapper that also contains a heading fires `top top`
  while the pin is still below the fold, and GSAP pins it down there.
- **Do not put `content-visibility: auto` on a section containing a pin.** It
  collapses the section to its intrinsic size and every measurement taken
  from it is wrong.
- Scroll lengths live in one place per chapter: `RUN` in
  `src/scripts/motion/memories.js` and `src/scripts/motion/present.js`. The
  whole page is about 34 viewports at 1440×900.
- Anything `position: fixed` belongs **outside** `#smooth-wrapper`, in the
  Layout's `chrome` slot. ScrollSmoother transforms the content and would
  drag it along.

### Left in place but no longer used

`_source/` is the original single-file prototype and is kept as an archive.
`scripts/split.mjs` regenerated the old components from it by hard-coded line
ranges; it would overwrite this work, so it has been removed from the npm
scripts and carries a header saying so. Neither is referenced by the build.

Unreferenced files you may want to delete: `Phoenix-ARALinks-Logo-2.png`,
`images/NC (1).pdf`, and the empty `dates/Ice Skating Videos/public/`.
(`forever.avif` at the root *is* used — it is the source for the last frame.)
