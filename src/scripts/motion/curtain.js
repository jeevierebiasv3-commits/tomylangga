/* ============================================================================
   motion/curtain.js — the gallery's doors
   ----------------------------------------------------------------------------
   A loader that ends on one click, because the soundtrack cannot start
   without one (see GalleryCurtain.astro). The sequence:

     1. scroll is locked and the room behind is inert
     2. the counter runs while the fonts and the first plates load
     3. if the soundtrack has already started (autoplay allowed, or muted
        this visit), the doors open by themselves; otherwise the Enter
        button appears, and its click — caught by motion/soundtrack.js as
        the first gesture — starts the music as the doors open
     4. the curtain wipes up, scroll is released, and `room:enter` fires so
        the masthead plays its entrance in view rather than under the curtain

   Call before initSoundtrack(), so the `soundtrack:start` listener is in
   place before a muted visit reports in synchronously.
   ========================================================================= */

import { gsap, ScrollTrigger, getSmoother } from './core.js';

const MIN_LOAD = 1.6;     // seconds — long enough to read as a beat, not a wait
const MAX_WAIT = 5000;    // ms — never hold the doors for a slow image

export function initCurtain() {
  const curtain = document.querySelector('[data-curtain]');
  const enterRoom = () => window.dispatchEvent(new CustomEvent('room:enter'));
  if (!curtain || getComputedStyle(curtain).display === 'none') { enterRoom(); return; }

  const inner  = curtain.querySelector('[data-curtain-inner]');
  const load   = curtain.querySelector('[data-curtain-load]');
  const pct    = curtain.querySelector('[data-curtain-pct]');
  const bar    = curtain.querySelector('[data-curtain-bar]');
  const button = curtain.querySelector('[data-curtain-enter]');
  const room   = document.getElementById('smooth-wrapper');
  const root   = document.documentElement;

  /* --- lock ---------------------------------------------------------------- */
  const smoother = getSmoother();
  smoother?.paused(true);
  root.style.overflow = 'hidden';
  room?.setAttribute('inert', '');

  let soundStarted = false;
  window.addEventListener('soundtrack:start', () => { soundStarted = true; }, { once: true });

  /* --- load ---------------------------------------------------------------- */
  const firstPlates = [...document.querySelectorAll('.ex img')].slice(0, 6);
  const settled = (img) => (img.complete ? Promise.resolve() : new Promise((r) => {
    img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
  }));
  const loaded = Promise.race([
    Promise.all([document.fonts?.ready, ...firstPlates.map(settled)]),
    new Promise((r) => setTimeout(r, MAX_WAIT)),
  ]);

  const count = { v: 0 };
  const paint = () => {
    pct.textContent = String(Math.round(count.v)).padStart(3, '0');
    gsap.set(bar, { scaleX: count.v / 100 });
  };

  gsap.from(inner.children, { y: 24, opacity: 0, duration: 1, ease: 'settle', stagger: 0.08 });
  const run = gsap.to(count, { v: 90, duration: MIN_LOAD, ease: 'power2.inOut', onUpdate: paint });

  Promise.all([loaded, run.then()]).then(() => {
    gsap.to(count, {
      v: 100, duration: 0.4, ease: 'power2.out', onUpdate: paint,
      onComplete: () => (soundStarted ? open() : offerEnter()),
    });
  });

  /* --- enter --------------------------------------------------------------- */
  function offerEnter() {
    gsap.to(load, {
      opacity: 0, y: -12, duration: 0.4, ease: 'power2.in',
      onComplete: () => {
        load.hidden = true;
        button.hidden = false;
        gsap.fromTo(button, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'snap' });
        gsap.fromTo(button.querySelector('circle'),
          { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.4, ease: 'settle' });
        button.focus({ preventScroll: true });
      },
    });
    button.addEventListener('click', open, { once: true });
  }

  let opened = false;
  function open() {
    if (opened) return;
    opened = true;

    gsap.timeline({
      onComplete: () => {
        curtain.dataset.gone = '1';
        root.style.overflow = '';
        room?.removeAttribute('inert');
        smoother?.paused(false);
        ScrollTrigger.refresh();
      },
    })
      .to(inner, { y: -40, opacity: 0, duration: 0.6, ease: 'power2.in' })
      .fromTo(curtain,
        { clipPath: 'inset(0% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.25, ease: 'swell' }, 0.35)
      // The masthead starts rising while the curtain is still lifting off it.
      .add(enterRoom, 0.75);
  }
}
