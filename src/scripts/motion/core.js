/* ============================================================================
   motion/core.js — the single motion authority
   ----------------------------------------------------------------------------
   Everything animated on this site goes through here. It owns:

     - GSAP plugin registration and the shared easing vocabulary
     - MOTION: the one place that decides whether animation happens at all
     - ScrollSmoother setup (and teardown when motion is off)
     - the custom cursor
     - accessible anchor navigation that works with smooth scrolling

   The rule every chapter module follows: ask MOTION first. If motion is off,
   build no timeline — paint the finished state and return. That keeps the
   reduced-motion path from being a degraded version of the animated one;
   it is simply the document, composed and complete.
   ========================================================================= */

import { gsap }           from 'gsap';
import { ScrollTrigger }  from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { SplitText }      from 'gsap/SplitText';
import { CustomEase }     from 'gsap/CustomEase';
import { DrawSVGPlugin }  from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, CustomEase, DrawSVGPlugin);

/* --- easing vocabulary -------------------------------------------------------
   Named once so a "settle" feels identical in the prologue and in chapter five.
   These mirror the cubic-beziers in tokens.css. */
CustomEase.create('settle', '0.22, 0.61, 0.21, 1');
CustomEase.create('filmic', '0.33, 0.01, 0.20, 1');
CustomEase.create('snap',   '0.16, 0.84, 0.28, 1');
CustomEase.create('swell',  '0.65, 0.02, 0.18, 1');

export { gsap, ScrollTrigger, ScrollSmoother, SplitText };

/* ----------------------------------------------------------------------------
   MOTION — the gate
   ----------------------------------------------------------------------------
   The site always runs in full motion: there is no switch, and the OS
   reduced-motion setting is not consulted. Modules still ask MOTION.enabled
   so the finished-state fallbacks stay in place should this ever change.
   -------------------------------------------------------------------------- */
const listeners = new Set();

export const MOTION = {
  /** 'full' | 'reduced' */
  get mode() { return 'full'; },
  /** The question every module should ask before building a timeline. */
  get enabled() { return true; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

/* ----------------------------------------------------------------------------
   Applying the mode
   -------------------------------------------------------------------------- */
let smoother = null;

function apply() {
  const mode = MOTION.mode;
  const root = document.documentElement;

  root.dataset.motion = mode;
  gsap.ticker.lagSmoothing(mode === 'full' ? 500 : 0, 33);

  if (mode === 'full') {
    mountSmoother();
    mountCursor();
  } else {
    // Release everything. Pins unpin, scrubs jump to their end state, and the
    // page becomes an ordinary vertical document.
    if (smoother) { smoother.kill(); smoother = null; }
    unmountCursor();
    ScrollTrigger.getAll().forEach(t => t.kill(false));
  }

  ScrollTrigger.refresh();
  listeners.forEach(fn => { try { fn(mode); } catch (e) { console.error(e); } });
}

function mountSmoother() {
  if (smoother) return;
  if (!document.getElementById('smooth-wrapper')) return;
  smoother = ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: 1.1,
    effects: true,      // enables data-speed / data-lag on any element
    smoothTouch: false, // never fight native momentum on touch
    normalizeScroll: false,
  });
}

export function getSmoother() { return smoother; }

/* ----------------------------------------------------------------------------
   Scrolling to a target

   One helper so anchors, the chapter rail and the index overlay all behave
   identically, whether ScrollSmoother is mounted or not. Focus is moved to the
   destination so keyboard and screen-reader users actually land there — a
   plain scroll leaves focus stranded at the top of the document.
   -------------------------------------------------------------------------- */
export function scrollToTarget(target, { focus = true } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;

  const instant = !MOTION.enabled;

  if (smoother) {
    smoother.scrollTo(el, !instant, 'top top');
  } else {
    el.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' });
  }

  if (!focus) return;
  // Make the section programmatically focusable just long enough to receive
  // focus, then hand tabindex back so it never joins the tab order.
  const hadTabIndex = el.hasAttribute('tabindex');
  if (!hadTabIndex) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  if (!hadTabIndex) {
    el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true });
  }
}

/* ----------------------------------------------------------------------------
   Custom cursor

   Augments rather than replaces: it only engages on a fine pointer with motion
   enabled, and `data-cursor` on <html> is what allows base.css to hide the
   native arrow. If this script fails, the real cursor is still there.
   -------------------------------------------------------------------------- */
let cursorState = null;

function mountCursor() {
  if (cursorState) return;
  if (!matchMedia('(pointer: fine)').matches) return;

  const dot  = document.querySelector('[data-cursor-dot]');
  const ring = document.querySelector('[data-cursor-ring]');
  if (!dot || !ring) return;

  document.documentElement.dataset.cursor = 'on';

  const setDotX  = gsap.quickSetter(dot,  'x', 'px');
  const setDotY  = gsap.quickSetter(dot,  'y', 'px');
  const setRingX = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3' });
  const setRingY = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3' });

  // The elements are parked at -100,-100 in CSS, so every position is
  // relative to that.
  const PARK = 100;
  let live = false;
  const onMove = (e) => {
    if (!live) {
      live = true;
      dot.dataset.live = '1';
      ring.dataset.live = '1';
      // Jump the ring to the pointer rather than easing in from the corner.
      gsap.set(ring, { x: e.clientX + PARK, y: e.clientY + PARK });
    }
    setDotX(e.clientX + PARK);  setDotY(e.clientY + PARK);
    setRingX(e.clientX + PARK); setRingY(e.clientY + PARK);
  };

  // Grow the ring over anything interactive. Delegated, so it covers content
  // added later (lightboxes, the index overlay) without rebinding.
  const INTERACTIVE = 'a, button, [role="button"], input, summary, [data-cursor-hover]';
  const onOver = (e) => {
    const hit = e.target instanceof Element && e.target.closest(INTERACTIVE);
    ring.dataset.state = hit ? 'active' : '';
  };
  const onDown  = () => { ring.dataset.press = 'on'; };
  const onUp    = () => { ring.dataset.press = ''; };
  const onLeave = () => { dot.style.opacity = '0'; ring.style.opacity = '0'; };
  const onEnter = () => { dot.style.opacity = ''; ring.style.opacity = ''; };

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerover', onOver, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup',   onUp,   { passive: true });
  document.addEventListener('mouseleave', onLeave);
  document.addEventListener('mouseenter', onEnter);

  cursorState = () => {
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerover', onOver);
    removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp);
    document.removeEventListener('mouseleave', onLeave);
    document.removeEventListener('mouseenter', onEnter);
    delete document.documentElement.dataset.cursor;
  };
}

function unmountCursor() {
  if (!cursorState) return;
  cursorState();
  cursorState = null;
}

/* ----------------------------------------------------------------------------
   Magnetic elements

   A small pull toward the pointer on [data-magnetic]. Deliberately subtle —
   it should read as weight, not as a toy. Never applied without motion.
   -------------------------------------------------------------------------- */
export function bindMagnetic(scope = document) {
  if (!MOTION.enabled || !matchMedia('(pointer: fine)').matches) return;

  scope.querySelectorAll('[data-magnetic]').forEach((el) => {
    if (el.dataset.magneticBound) return;
    el.dataset.magneticBound = '1';

    const strength = parseFloat(el.dataset.magnetic) || 0.32;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'settle' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'settle' });

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width  / 2)) * strength);
      yTo((e.clientY - (r.top  + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ----------------------------------------------------------------------------
   SplitText helper

   Splitting mutates the DOM, which can strip an element's accessible text. We
   keep the original string on aria-label and hide the shards from the
   accessibility tree, so assistive tech reads one clean sentence rather than
   a stream of disconnected characters.
   -------------------------------------------------------------------------- */
export function splitLines(el, type = 'lines,words') {
  const original = el.textContent.trim();
  const split = new SplitText(el, {
    type,
    linesClass: 'split-line',
    wordsClass: 'split-word',
    charsClass: 'split-char',
  });
  el.setAttribute('aria-label', original);
  const shards = [].concat(split.lines || [], split.words || [], split.chars || []);
  shards.forEach(n => n.setAttribute('aria-hidden', 'true'));
  return split;
}

/* ----------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
export function initMotion() {
  ScrollTrigger.config({
    ignoreMobileResize: true,
    autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load',
  });

  apply();

  // Re-measure once webfonts land, or every pin is calculated against
  // fallback metrics and the whole page sits a few hundred pixels off.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  bindMagnetic();
  bindAnchors();
}

function bindAnchors() {
  document.addEventListener('click', (e) => {
    const link = e.target instanceof Element && e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href');
    if (!id || id === '#') return;
    const dest = document.querySelector(id);
    if (!dest) return;
    e.preventDefault();
    scrollToTarget(dest);
    history.pushState(null, '', id);
  });
}
