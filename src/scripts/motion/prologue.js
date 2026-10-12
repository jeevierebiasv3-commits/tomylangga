/* ============================================================================
   motion/prologue.js — choreographing the opening
   ----------------------------------------------------------------------------
   Drives the prologue through four stages:

     0  the CSS composition, already on screen
     1  three.js loads in the background and cross-fades in
     2  the question arrives, and the scene brightens with it — the text
        timeline writes directly to the shader's exposure uniform, which is
        what makes the words feel like part of the image rather than a layer
        over it
     3  the visitor enters: the window opens out, the scene fades, the
        renderer is disposed and the canvas removed

   Everything here is optional. Skip works at any point, Escape works at any
   point, reduced motion goes straight to the finished state, and a WebGL
   failure leaves the CSS composition in place with the prologue still fully
   usable.
   ========================================================================= */

import { gsap, ScrollTrigger, MOTION, scrollToTarget, bindMagnetic } from './core.js';

const ENTERED_KEY = 'langga-entered';

export function initPrologue() {
  const root = document.querySelector('[data-prologue]');
  if (!root) {
    // Already entered this session; the inline script removed it.
    unlock();
    return;
  }

  const q = (sel) => root.querySelector(sel);
  const els = {
    canvas:   q('[data-pro-canvas]'),
    kicker:   q('[data-pro-kicker]'),
    lead:     q('[data-pro-lead]'),
    question: q('[data-pro-question]'),
    date:     q('[data-pro-date]'),
    enter:    q('[data-pro-enter]'),
    skip:     q('[data-pro-skip]'),
    progress: q('[data-pro-progress] i'),
  };

  let scene = null;
  let timeline = null;
  let done = false;

  /* --- reduced motion: the finished state, immediately -------------------- */
  if (!MOTION.enabled) {
    root.dataset.ready = '1';
    gsap.set([els.kicker, els.lead, els.question, els.date, els.enter], { opacity: 1, y: 0, clearProps: 'transform' });
    wireControls();
    trapFocus(root);
    return;
  }

  /* --- stage 0: hide what is about to be animated in ----------------------
     The question is deliberately NOT in this list. Its words are hidden
     individually and animated individually; fading the <h1> as well would
     leave the heading at opacity 0 with perfectly animated invisible words
     inside it. */
  gsap.set([els.kicker, els.lead, els.date, els.enter], { opacity: 0 });
  gsap.set(els.progress, { width: '18%' });

  wireControls();
  trapFocus(root);
  bindMagnetic(root);

  /* --- stage 1: load the scene without blocking anything ------------------ */
  // requestIdleCallback keeps the three.js chunk from competing with the
  // first paint and the fonts. The 600ms fallback covers Safari.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600));
  idle(() => { loadScene(); });

  // The words do not wait for WebGL. If the scene arrives mid-sequence it
  // cross-fades in underneath; if it never arrives, nothing is missing.
  startSequence();

  async function loadScene() {
    gsap.to(els.progress, { width: '64%', duration: 1.1, ease: 'settle' });
    try {
      const { createVanWindow } = await import('../three/vanWindow.js');
      if (done) return;
      scene = createVanWindow(els.canvas);
      if (!scene) return;          // no WebGL — the CSS still stands in
      scene.start();
      root.dataset.scene = 'on';

      // The van arrives: the road slows over the length of the sequence.
      gsap.fromTo(scene.uniforms.uSpeed, { value: 1 },
        { value: 0.12, duration: 11, ease: 'filmic' });

      // Hand the exposure to the text timeline if it is already running.
      if (timeline) timeline.call(() => {}, [], 0);
    } catch (err) {
      console.warn('[prologue] scene unavailable, using the still', err);
    } finally {
      gsap.to(els.progress, { width: '100%', duration: .5, ease: 'settle' });
    }
  }

  /* --- stage 2: the question ---------------------------------------------- */
  function startSequence() {
    const words = splitWords(els.question);

    timeline = gsap.timeline({
      defaults: { ease: 'settle' },
      onComplete: () => { root.dataset.ready = '1'; },
    });

    timeline
      .to(els.kicker, { opacity: 1, y: 0, duration: 1.2 }, 0.3)
      .fromTo(els.lead,
        { opacity: 0, y: 18, letterSpacing: '0.18em' },
        { opacity: 1, y: 0, letterSpacing: '0.01em', duration: 1.6 }, 1.0)

      // a beat of silence before she says it
      .addLabel('question', 3.0)

      .fromTo(words,
        { opacity: 0, yPercent: 110, rotate: 3 },
        { opacity: 1, yPercent: 0, rotate: 0, duration: 1.5, stagger: 0.085 },
        'question')

      // the light lifts as the words land, then settles back
      .to(exposure(), { value: 1.42, duration: 1.1, ease: 'swell' }, 'question+=0.25')
      .to(exposure(), { value: 1.06, duration: 2.6, ease: 'filmic' }, 'question+=1.5')

      .to(els.date,  { opacity: 1, y: 0, duration: 1.2 }, 'question+=1.4')
      .to(els.enter, { opacity: 1, y: 0, duration: 1.2 }, 'question+=2.0');
  }

  // A live proxy, so the timeline can be built before the scene exists and
  // still drive it once it does.
  function exposure() {
    const proxy = { _v: 1 };
    Object.defineProperty(proxy, 'value', {
      get: () => (scene ? scene.uniforms.uExposure.value : proxy._v),
      set: (v) => { proxy._v = v; if (scene) scene.uniforms.uExposure.value = v; },
    });
    return proxy;
  }

  /* --- stage 3: entering --------------------------------------------------- */
  function enter({ instant = false } = {}) {
    if (done) return;
    done = true;

    try { sessionStorage.setItem(ENTERED_KEY, '1'); } catch { /* private mode */ }
    document.documentElement.dataset.entered = '1';

    timeline?.kill();

    const finish = () => {
      scene?.dispose();
      scene = null;
      root.remove();
      unlock();

      // Everything downstream was measured while the body was locked to one
      // viewport. Without this the pins never engage and every scrub runs at
      // a fraction of its range.
      ScrollTrigger.refresh();

      // Land on the story, with focus, so the keyboard carries on from here.
      const story = document.getElementById('story');
      if (story) scrollToTarget(story);
    };

    if (instant || !MOTION.enabled) { finish(); return; }

    const out = gsap.timeline({ onComplete: finish });

    // The window opens out past the viewport rather than cutting.
    if (scene) {
      out.to(scene.uniforms.uOpen, { value: 1, duration: 1.5, ease: 'swell' }, 0)
         .to(scene.uniforms.uFade, { value: 0, duration: 1.0, ease: 'filmic' }, 0.7);
    }

    out.to(root.querySelector('.pro__type'),
        { opacity: 0, y: -28, duration: 0.8, ease: 'settle' }, 0)
       .to(root.querySelector('.pro__controls'),
        { opacity: 0, duration: 0.5 }, 0)
       .to(root, { opacity: 0, duration: 0.7, ease: 'filmic' }, 0.9);
  }

  /* --- controls -------------------------------------------------------------- */
  function wireControls() {
    els.enter?.addEventListener('click', () => enter());
    els.skip?.addEventListener('click', () => enter({ instant: true }));

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); enter({ instant: true }); }
    };
    document.addEventListener('keydown', onKey);
  }
}

/* ----------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

function unlock() {
  delete document.body.dataset.locked;
}

/**
 * Split into words by hand rather than with SplitText.
 *
 * The question is the page's <h1> and its accessible name is what the dialog
 * is labelled by. Wrapping each word in a masked span and hiding the shards
 * keeps that name intact as one sentence.
 */
function splitWords(el) {
  if (!el) return [];
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);

  const frag = document.createDocumentFragment();
  const spans = [];

  text.split(/(\s+)/).forEach((token) => {
    if (!token.trim()) { frag.appendChild(document.createTextNode(token)); return; }
    const mask = document.createElement('span');
    mask.className = 'pro__mask';
    mask.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.className = 'pro__word';
    inner.textContent = token;
    mask.appendChild(inner);
    frag.appendChild(mask);
    spans.push(inner);
  });

  el.textContent = '';
  el.appendChild(frag);
  return spans;
}

/**
 * Keep Tab inside the prologue while it is open. Without this, tabbing walks
 * into the story behind the overlay, where focus is invisible.
 */
function trapFocus(root) {
  const SELECTOR = 'button:not([hidden]), a[href], [tabindex]:not([tabindex="-1"])';

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...root.querySelectorAll(SELECTOR)].filter(el => el.offsetParent !== null);
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  // Move focus into the dialog without announcing the whole thing at once.
  const skip = root.querySelector('[data-pro-skip]');
  skip?.focus({ preventScroll: true });
}
