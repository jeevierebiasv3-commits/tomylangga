/* ============================================================================
   motion/letterIntro.js — the threshold into the letter
   ----------------------------------------------------------------------------
   Two timelines over one shared `state`:

     arrival   plays once as the section comes up: the kicker, the lead
               opening out from wide tracking, "I wrote you a letter." rising
               word by word, the ring drawing itself — and the scene's
               exposure lifting as the words land, like the prologue.

     scroll    the section pins and scrubs `state.progress` 0 → 1, which the
               three.js scene reads every frame to open the envelope and push
               the camera into the paper. The type lifts away first; a veil
               closes the frame to the letter's night at the end.

   The scene is imported as the section approaches and only renders while
   the section is on screen.
   ========================================================================= */

import { gsap, ScrollTrigger, MOTION } from './core.js';

/** Viewport-heights of scroll the envelope takes to open. */
const RUN = 2.6;

export function initLetterIntro() {
  const root = document.querySelector('[data-li]');
  if (!root || !MOTION.enabled) return;

  const $ = (s) => root.querySelector(s);
  const pin = $('[data-li-pin]');
  const canvas = $('[data-li-canvas]');
  const type = $('[data-li-type]');
  const kicker = $('[data-li-kicker]');
  const lead = $('[data-li-lead]');
  const title = $('[data-li-title]');
  const date = $('[data-li-date]');
  const open = $('[data-li-open]');
  const ring = $('[data-li-ring]');
  const foot = $('[data-li-foot]');
  const hint = $('[data-li-hint]');
  const cue = $('.li__line i');
  const bar = $('[data-li-progress]');
  const veil = $('[data-li-veil]');

  const state = { progress: 0, exposure: 0.55 };
  let scene = null;
  let visible = false;

  /* --- the pinned scrub (created first: it adds the scroll distance) ------ */
  const setBar = gsap.quickSetter(bar, '--p');
  gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${window.innerHeight * RUN}`,
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => setBar(self.progress),
    },
  })
    .to(state, { progress: 1, duration: 1 }, 0)
    .to(type, { y: -90, autoAlpha: 0, filter: 'blur(10px)', duration: 0.22, ease: 'power2.in' }, 0.03)
    .to(foot, { autoAlpha: 0, duration: 0.08 }, 0)
    .to(veil, { autoAlpha: 1, duration: 0.12 }, 0.88);

  /* --- the scene: loaded on approach, rendered only while on screen ------- */
  ScrollTrigger.create({
    trigger: root,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      visible = self.isActive;
      if (scene) visible ? scene.start() : scene.stop();
    },
  });
  ScrollTrigger.create({
    trigger: root,
    start: () => `top bottom+=${window.innerHeight * 2}`,
    once: true,
    onEnter: load,
  });

  async function load() {
    try {
      const { createLetterScene } = await import('../three/letterScene.js');
      scene = createLetterScene(canvas, state);
      if (!scene) return;             // no WebGL — the CSS still stands in
      root.dataset.scene = 'on';
      if (visible) scene.start();
    } catch (err) {
      console.warn('[letter intro] scene unavailable, using the still', err);
    }
  }

  /* --- the arrival --------------------------------------------------------- */
  const words = splitWords(title);
  gsap.set([kicker, lead, date, open, hint], { autoAlpha: 0, y: 18 });
  gsap.set(words, { autoAlpha: 0, yPercent: 110, rotate: 3 });
  gsap.set(ring, { strokeDashoffset: 1 });

  const arrival = gsap.timeline({ paused: true, defaults: { ease: 'settle' } })
    .to(kicker, { autoAlpha: 1, y: 0, duration: 1.2 }, 0)
    .fromTo(lead,
      { letterSpacing: '0.18em' },
      { autoAlpha: 1, y: 0, letterSpacing: '0.01em', duration: 1.6 }, 0.5)
    .addLabel('title', 1.5)
    .to(words, { autoAlpha: 1, yPercent: 0, rotate: 0, duration: 1.5, stagger: 0.085 }, 'title')
    // the light lifts as the words land, then settles back
    .to(state, { exposure: 1.3, duration: 1.1, ease: 'swell' }, 'title+=0.25')
    .to(state, { exposure: 1, duration: 2.4, ease: 'filmic' }, 'title+=1.4')
    .to(date, { autoAlpha: 1, y: 0, duration: 1.2 }, 'title+=1.2')
    .to(open, { autoAlpha: 1, y: 0, duration: 1.2 }, 'title+=1.7')
    .to(ring, { strokeDashoffset: 0, duration: 1.8, ease: 'swell' }, 'title+=1.7')
    .to(hint, { autoAlpha: 1, y: 0, duration: 1 }, 'title+=2.3');

  ScrollTrigger.create({
    trigger: root,
    start: 'top 60%',
    once: true,
    // Arriving at speed (an anchor jump), skip straight to the composed frame.
    onEnter: (self) => (Math.abs(self.getVelocity()) > 4000 ? arrival.progress(1) : arrival.play()),
  });

  // The scroll cue: a drop of rose running down the line.
  gsap.fromTo(cue, { scaleY: 0, transformOrigin: '50% 0' }, {
    scaleY: 1, duration: 1.1, ease: 'power2.inOut', repeat: -1, yoyo: true,
  });
}

/**
 * Words into masked spans by hand, as the prologue does: the heading keeps its
 * sentence as an aria-label and the shards are hidden from assistive tech.
 */
function splitWords(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  const frag = document.createDocumentFragment();
  const spans = [];
  text.split(/(\s+)/).forEach((token) => {
    if (!token.trim()) { frag.appendChild(document.createTextNode(token)); return; }
    const mask = document.createElement('span');
    mask.className = 'li__mask';
    mask.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.className = 'li__word';
    inner.textContent = token;
    mask.appendChild(inner);
    frag.appendChild(mask);
    spans.push(inner);
  });
  el.textContent = '';
  el.appendChild(frag);
  return spans;
}
