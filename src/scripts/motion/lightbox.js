/* ============================================================================
   motion/lightbox.js
   ----------------------------------------------------------------------------
   Opens any `[data-lightbox-open="<media id>"]` in the shared viewer. The set
   it can page through is whatever siblings share the opener's container, so
   the flower wall pages through the flower date and the gallery pages through
   the gallery, with no configuration.

   Keyboard: Escape closes, arrows page, Tab is trapped, and focus returns to
   the element that opened it.
   ========================================================================= */

import { gsap, MOTION } from './core.js';

export function initLightbox() {
  const root = document.querySelector('[data-lightbox]');
  if (!root) return;

  const manifestEl = document.querySelector('[data-lightbox-manifest]');
  let manifest = {};
  try { manifest = JSON.parse(manifestEl?.textContent || '{}'); } catch { /* malformed */ }

  const panel = root.querySelector('.lb__panel');
  const scrim = root.querySelector('.lb__scrim');
  const stage = root.querySelector('[data-lightbox-stage]');
  const count = root.querySelector('[data-lightbox-count]');
  const note = root.querySelector('[data-lightbox-note]');

  let group = [];
  let index = 0;
  let lastFocused = null;
  let open = false;

  /* --- rendering ---------------------------------------------------------- */
  function render() {
    const opener = group[index];
    if (!opener) return;

    const id = opener.dataset.lightboxOpen;
    const m = manifest[id];
    stage.textContent = '';

    if (!m) {
      // A missing entry should say so rather than showing an empty black box.
      const p = document.createElement('p');
      p.className = 'lb__missing';
      p.textContent = 'This frame is not available.';
      stage.appendChild(p);
    } else if (m.k === 'v') {
      const v = document.createElement('video');
      v.src = m.src;
      v.poster = m.poster;
      v.width = m.w; v.height = m.h;
      v.controls = true;
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      if (MOTION.enabled) v.play?.().catch(() => {});
      stage.appendChild(v);
    } else {
      const pic = document.createElement('picture');
      const avif = document.createElement('source');
      avif.type = 'image/avif'; avif.srcset = m.avif; avif.sizes = '92vw';
      const webp = document.createElement('source');
      webp.type = 'image/webp'; webp.srcset = m.webp; webp.sizes = '92vw';
      const img = document.createElement('img');
      img.src = m.src;
      img.width = m.w; img.height = m.h;
      img.decoding = 'async';
      // The opener's own image already carries a good description.
      img.alt = opener.querySelector('img')?.alt || '';
      pic.append(avif, webp, img);
      stage.appendChild(pic);
    }

    if (count) count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(group.length).padStart(2, '0')}`;
    if (note) note.textContent = opener.dataset.lightboxNote || '';

    if (MOTION.enabled) {
      gsap.fromTo(stage, { opacity: 0, scale: 0.985 },
        { opacity: 1, scale: 1, duration: 0.45, ease: 'settle' });
    }
  }

  function go(step) {
    if (group.length === 0) return;
    index = (index + step + group.length) % group.length;
    render();
  }

  /* --- open / close -------------------------------------------------------- */
  function show(opener) {
    // The group is whatever shares a parent list with the opener, so each
    // surface pages through its own set without being told what that is.
    const scope = opener.closest('ul, ol, [data-lightbox-group]') || document;
    group = [...scope.querySelectorAll('[data-lightbox-open]')];
    index = Math.max(0, group.indexOf(opener));

    lastFocused = opener;
    open = true;
    root.hidden = false;
    document.body.dataset.locked = '';

    render();

    if (MOTION.enabled) {
      gsap.timeline()
        .fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'settle' }, 0)
        .fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'settle' }, 0);
    } else {
      gsap.set([scrim, panel], { opacity: 1 });
    }

    root.querySelector('[data-lightbox-close]')?.focus({ preventScroll: true });
  }

  function hide() {
    if (!open) return;
    open = false;

    const finish = () => {
      root.hidden = true;
      stage.textContent = '';          // release any video decoder
      delete document.body.dataset.locked;
      lastFocused?.focus?.({ preventScroll: true });
    };

    if (MOTION.enabled) {
      gsap.to([scrim, panel], { opacity: 0, duration: 0.3, ease: 'settle', onComplete: finish });
    } else {
      finish();
    }
  }

  /* --- wiring --------------------------------------------------------------- */
  document.addEventListener('click', (e) => {
    const opener = e.target instanceof Element && e.target.closest('[data-lightbox-open]');
    if (!opener) return;
    e.preventDefault();
    show(opener);
  });

  for (const el of root.querySelectorAll('[data-lightbox-close]')) {
    el.addEventListener('click', hide);
  }
  root.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => go(-1));
  root.querySelector('[data-lightbox-next]')?.addEventListener('click', () => go(1));

  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape')     { e.preventDefault(); hide(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'Tab') {
      const items = [...panel.querySelectorAll('button, video[controls]')]
        .filter(el => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
