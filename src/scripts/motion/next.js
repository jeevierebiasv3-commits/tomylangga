/* ============================================================================
   motion/next.js — chapter V
   ----------------------------------------------------------------------------
   Only one behaviour needs scripting here: the panel that follows the pointer
   across the "what comes next" list. Everything else in the chapter is a
   reveal or a scrubbed line, which motion/chapters.js already handles.

   The panel is skipped entirely when there are no photographs to show, which
   is the state the site ships in.
   ========================================================================= */

import { gsap, MOTION } from './core.js';

export function initNext() {
  const list = document.querySelector('[data-future]');
  const float = document.querySelector('[data-future-float]');
  if (!list || !float) return;
  if (!MOTION.enabled || !matchMedia('(pointer: fine)').matches) return;

  const rows = [...list.querySelectorAll('[data-future-row]')];
  const images = new Map(
    [...float.querySelectorAll('[data-future-img]')].map(el => [el.dataset.futureImg, el])
  );

  const setX = gsap.quickTo(float, 'x', { duration: 0.55, ease: 'power3' });
  const setY = gsap.quickTo(float, 'y', { duration: 0.55, ease: 'power3' });
  let active = null;

  const show = (key) => {
    if (key === active) return;
    active = key;
    for (const [id, el] of images) {
      gsap.to(el, { opacity: id === key ? 1 : 0, duration: 0.4, ease: 'settle' });
    }
    gsap.to(float, { opacity: key ? 1 : 0, duration: 0.35, ease: 'settle' });
  };

  for (const row of rows) {
    const key = row.dataset.media;
    if (!key) continue;
    row.addEventListener('pointerenter', () => show(key));
  }
  list.addEventListener('pointerleave', () => show(null));

  list.addEventListener('pointermove', (e) => {
    // Offset so the panel sits beside the cursor rather than under it.
    setX(e.clientX + 28);
    setY(e.clientY - 110);
  });
}
