/* ============================================================================
   motion/message.js — the letter ("Para sa akong langga")
   ----------------------------------------------------------------------------
   The choreography from the message-ref mockup, rebuilt for this page:

     - the window scroller (ScrollSmoother) instead of the mockup's own root
     - ScrollTrigger pins wherever the mockup used `position: sticky`, which
       ScrollSmoother's transformed content would otherwise break
     - the preloader becomes a curtain that lifts the first time the opening
       spread is reached

   On top of that, every quiet part of the letter has a gesture of its own:
   paragraphs rise line by line out of masks, hairlines draw, labels decode,
   the index previews a photograph under the pointer, the big lines lean with
   scroll velocity, and the finale answers a tap with a handful of hearts.

   Like every chapter module: ask MOTION first. With motion off nothing here
   runs and the markup is already the finished letter.
   ========================================================================= */

import { gsap, ScrollTrigger, SplitText, MOTION } from './core.js';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(ScrambleTextPlugin);

const HEART = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.6 0 5.7 3.7 4.2 7.3C19.5 16.4 12 21 12 21z';
const SVG_NS = 'http://www.w3.org/2000/svg';

export function initMessage() {
  const root = document.querySelector('[data-msg]');
  if (!root || !MOTION.enabled) return;

  const q = (s) => gsap.utils.toArray(root.querySelectorAll(s));
  const one = (s) => root.querySelector(s);
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /** A one-shot entrance that reverses when scrolled back above it. */
  const enter = (el, vars, start = 'top 88%') => gsap.from(el, {
    duration: 1.3, ease: 'power3.out',
    scrollTrigger: { trigger: el, start, toggleActions: 'play none none reverse' },
    ...vars,
  });
  /** A scrubbed from→to tied to a trigger's travel. */
  const scrub = (el, from, to, trigger, start = 'top 85%', end = 'top 30%') => gsap.fromTo(el, from, {
    ease: 'none',
    scrollTrigger: { trigger: trigger || el, start, end, scrub: 1 },
    ...to,
  });
  const ctx = { root, q, one, fine, enter, scrub };

  initHero(ctx);
  // Pins first: the ride adds scroll distance, and every trigger below it has
  // to be measured after that space exists.
  initRide(ctx);
  initPins(ctx);
  initLoops(ctx);
  initIndex(ctx);
  initLines(ctx);
  initLabels(ctx);
  initGrain(root);

  /* --- typography --------------------------------------------------------- */
  q('.msg-lm').forEach((l) => enter(l.firstElementChild, {
    yPercent: 115, rotate: 4, transformOrigin: '0 100%', duration: 1.4, ease: 'expo.out',
  }));

  q('[data-msg-ink]').forEach((p) => scrub(p.querySelectorAll('.msg-w'),
    { opacity: 0.1, filter: 'blur(2px)' },
    { opacity: 1, filter: 'blur(0px)', stagger: 0.1 }, p, 'top 78%', 'bottom 45%'));

  q('[data-msg-ghost]').forEach((el) => scrub(el,
    { backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0' }, el, 'top 82%', 'top 30%'));

  q('[data-msg-tw]').forEach((b) => scrub(b.querySelectorAll('.msg-ch1'),
    { opacity: 0, y: 8 }, { opacity: 1, y: 0, stagger: 0.05 }, b, 'top 80%', 'bottom 50%'));
  gsap.to(q('[data-msg-caret]'), { opacity: 0, repeat: -1, yoyo: true, duration: 0.5, ease: 'steps(1)' });

  q('.msg-trail').forEach((p) => scrub(p,
    { strokeDashoffset: 1 }, { strokeDashoffset: 0 }, p.closest('svg'), 'top 90%', 'bottom 30%'));

  q('[data-msg-fillx]').forEach((el) => scrub(el,
    { backgroundPosition: '0 0%' }, { backgroundPosition: '0 100%' }, el, 'top 80%', 'top 20%'));

  q('[data-msg-focus]').forEach((el) => scrub(el,
    { filter: 'blur(16px)', autoAlpha: 0.15, scale: 0.96 },
    { filter: 'blur(0px)', autoAlpha: 1, scale: 1 }, el, 'top 92%', 'top 45%'));

  q('[data-msg-col]').forEach((el) => scrub(el,
    { letterSpacing: '0.5em', autoAlpha: 0, filter: 'blur(18px)' },
    { letterSpacing: '-0.015em', autoAlpha: 1, filter: 'blur(0px)' }, el, 'top 95%', 'top 45%'));

  /* --- depth: drifting chapter numbers, sections opening like apertures ---- */
  q('.msg-num').forEach((n) => scrub(n, { yPercent: 35 }, { yPercent: -35 },
    n.closest('.msg-ch, .msg-c5') || n, 'top bottom', 'bottom top'));
  q('[data-msg-aperture]').forEach((s) => scrub(s,
    { clipPath: 'inset(6% 5% 6% 5% round 48px)' },
    { clipPath: 'inset(0% 0% 0% 0% round 0px)' }, s, 'top bottom', 'top 25%'));

  /* --- photographs: cinematic wipes and drift inside the frame ------------- */
  q('[data-msg-clip]').forEach((f) => scrub(f,
    { clipPath: 'inset(22% 18% 22% 18%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }, f, 'top 98%', 'top 40%'));
  q('[data-msg-clip] .pic').forEach((pic) => scrub(pic,
    { scale: 1.18, yPercent: -6 }, { scale: 1.04, yPercent: 6 }, pic, 'top bottom', 'bottom top'));
  if (fine) q('.msg-ph').forEach((ph) => {
    ph.addEventListener('pointerenter', () => gsap.to(ph, { scale: 1.03, duration: 0.7, ease: 'power3.out' }));
    ph.addEventListener('pointerleave', () => gsap.to(ph, { scale: 1, duration: 0.7, ease: 'power3.out' }));
  });

  initChapters(ctx);
  initFinale(ctx);
}

/* ----------------------------------------------------------------------------
   The opening spread

   Prepared hidden the moment the page loads (the reader is chapters away), and
   played once when it is reached: the curtain counts to 100 and lifts, then
   "Hi, my langga." unfolds letter by letter. After that the type leans toward
   the pointer, and scrolling on pulls the spread apart.
   -------------------------------------------------------------------------- */
function initHero({ one, q, fine }) {
  const hero = one('[data-msg-hero]');
  if (!hero) return;

  const curtain = one('[data-msg-curtain]');
  const count = one('[data-msg-count]');
  const chars = q('.msg-uch');
  const pill = one('[data-msg-pill]');
  const fades = q('[data-msg-fade]');
  const l1 = one('.msg-hero__l1');
  const l2 = one('[data-msg-l2]');
  const foot = one('.msg-hero__foot');

  gsap.set(curtain, { display: 'flex' });
  gsap.set(chars, { yPercent: 120, rotate: 14, autoAlpha: 0, filter: 'blur(14px)', transformOrigin: '0 100%' });
  gsap.set(pill, { scaleX: 0, transformOrigin: '0 50%' });
  gsap.set(fades, { y: 40, autoAlpha: 0 });

  const n = { v: 0 };
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
    .to(n, {
      v: 100, duration: 1.5, ease: 'power2.inOut',
      onUpdate: () => { count.textContent = Math.round(n.v); },
    })
    .to(curtain.children, { y: -50, autoAlpha: 0, duration: 0.5, stagger: 0.06, ease: 'power2.in' }, '-=.15')
    .to(curtain, { yPercent: -100, duration: 1.15, ease: 'expo.inOut' }, '-=.2')
    .set(curtain, { display: 'none' })
    .to(chars, { yPercent: 0, rotate: 0, autoAlpha: 1, filter: 'blur(0px)', stagger: 0.05, duration: 1.5 }, '-=.75')
    .to(pill, { scaleX: 1, duration: 1.3, ease: 'expo.inOut' }, '-=1.3')
    .to(fades, { y: 0, autoAlpha: 1, stagger: 0.12, duration: 1.2 }, '-=1.1');

  // Arriving from below plays the full intro. If someone jumps in past it
  // (an anchor, a fast fling), skip straight to the composed spread rather
  // than making them wait on a curtain they have already scrolled under.
  ScrollTrigger.create({
    trigger: hero,
    start: 'top 65%',
    once: true,
    onEnter: (self) => {
      if (Math.abs(self.getVelocity()) > 4000) tl.progress(1);
      else tl.play();
    },
  });

  // Leaving: the two lines part — "Hi, my" lifts, "langga." slides against
  // the scroll — the photo swells, and the lede and badge drop away.
  gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1 },
  })
    .fromTo(l1, { yPercent: 0 }, { yPercent: -45 }, 0)
    .fromTo(l2, { xPercent: 0 }, { xPercent: -8 }, 0)
    .fromTo(pill, { scale: 1 }, { scale: 1.35, transformOrigin: '0 50%' }, 0)
    .fromTo(foot, { y: 0, autoAlpha: 1 }, { y: 120, autoAlpha: 0 }, 0);

  // The type leans toward the pointer in two depths.
  if (!fine) return;
  const x1 = gsap.quickTo(l1, 'x', { duration: 1, ease: 'power3' });
  const x2 = gsap.quickTo(l2, 'x', { duration: 1.2, ease: 'power3' });
  const y2 = gsap.quickTo(l2, 'y', { duration: 1.2, ease: 'power3' });
  const rp = gsap.quickTo(pill, 'rotation', { duration: 1, ease: 'power3' });
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    x1(dx * -28); x2(dx * 48); y2(dy * 18); rp(dx * 8);
  });
  hero.addEventListener('pointerleave', () => { x1(0); x2(0); y2(0); rp(0); });
}

/* ----------------------------------------------------------------------------
   Paragraphs rise line by line out of masks.

   SplitText re-splits on resize and once the webfonts land (autoSplit), so the
   animation is rebuilt inside onSplit each time against the fresh lines. The
   highlighter marks live inside these paragraphs and are re-split with them,
   which is why their sweeps are built here too.
   -------------------------------------------------------------------------- */
function initLines({ q }) {
  q('[data-msg-rv]').forEach((el) => {
    let local;
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'msg-line',
      autoSplit: true,
      onSplit(self) {
        local?.revert();
        local = gsap.context(() => {
          gsap.from(self.lines, {
            yPercent: 112, rotate: 2.5, transformOrigin: '0 0',
            duration: 1.25, ease: 'expo.out', stagger: 0.085,
            scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
          });
          el.querySelectorAll('mark.msg-sw').forEach((m) => gsap.fromTo(m,
            { backgroundSize: '0% .5em' },
            {
              backgroundSize: '100% .5em', duration: 1.2, ease: 'power2.inOut', delay: 0.45,
              scrollTrigger: { trigger: m, start: 'top 85%', toggleActions: 'play none none reverse' },
            }));
        });
      },
    });
  });
}

/* ----------------------------------------------------------------------------
   Hairlines draw in from the left; labels and chapter numbers decode.
   -------------------------------------------------------------------------- */
function initLabels({ q }) {
  q('.msg-chh, .msg-stick').forEach((el) => gsap.fromTo(el, { '--rx': 0 }, {
    '--rx': 1, duration: 1.6, ease: 'expo.inOut',
    scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' },
  }));

  const decode = (el, chars, delay = 0) => {
    const text = el.textContent;
    const tl = gsap.timeline({ paused: true })
      .fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, delay)
      .to(el, {
        duration: Math.min(1.6, 0.5 + text.length * 0.035),
        scrambleText: { text, chars, speed: 0.5, revealDelay: 0.2 },
        ease: 'none',
      }, delay);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      onEnter: () => tl.restart(),
      onLeaveBack: () => tl.pause(0),
    });
  };

  q('.msg-chh .msg-mono, .msg-stick .msg-mono, .msg-fig figcaption, .msg-stack > .msg-mono, .msg-hbar .msg-mono')
    .forEach((el) => decode(el, 'upperCase', 0.25));
  q('.msg-num').forEach((el) => decode(el, '0123456789'));
}

/* ----------------------------------------------------------------------------
   Loops that answer to scroll — the badge, the marquee and the band speed up
   and lean with a hard scroll, then settle back. The marquee also follows
   the direction of travel, and the big lines lean with the same velocity.
   -------------------------------------------------------------------------- */
function initLoops({ root, q, one }) {
  const spin = gsap.to(q('[data-msg-spin]'), { rotation: 360, duration: 22, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });
  const mq = q('[data-msg-mq]').map((m) => m.hasAttribute('data-rev')
    ? gsap.fromTo(m, { xPercent: -50 }, { xPercent: 0, duration: 85, repeat: -1, ease: 'none' })
    : gsap.to(m, { xPercent: -50, duration: 70, repeat: -1, ease: 'none' }));

  const set = (sel, prop) => {
    const els = q(sel);
    return els.length ? gsap.quickSetter(els, prop, 'deg') : () => {};
  };
  const setBand = set('[data-msg-skew]', 'skewX');
  const setHeads = set('.msg-c2-head, .msg-c3-head, .msg-fillx, .msg-c9-head, .msg-c10-head, .msg-cascade, .msg-c13-head, .msg-finale__c', 'skewY');
  const setTrack = one('[data-msg-htrack]') ? gsap.quickSetter(one('[data-msg-htrack]'), 'skewX', 'deg') : () => {};

  const pr = { s: 0, b: 0 };
  let dir = 1;
  const apply = () => {
    spin.timeScale(1 + pr.b);
    mq.forEach((t) => t.timeScale((1 + pr.b) * dir));
    setBand(pr.s);
    setHeads(pr.s * -0.3);
    setTrack(pr.s * 0.55);
  };

  ScrollTrigger.create({
    trigger: root,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      if (self.direction !== dir) { dir = self.direction; apply(); }
      const v = self.getVelocity();
      const sk = gsap.utils.clamp(-9, 9, v / -260);
      if (Math.abs(sk) <= Math.abs(pr.s)) return;
      pr.s = sk;
      pr.b = Math.min(Math.abs(v) / 500, 5);
      gsap.to(pr, { s: 0, b: 0, duration: 0.9, ease: 'power3', overwrite: true, onUpdate: apply });
    },
  });

  // The two marquee rows drift apart as the band crosses the screen.
  const band = one('[data-msg-skew]');
  if (band) q('.msg-band__row').forEach((r, i) => gsap.fromTo(r,
    { xPercent: i % 2 ? -10 : 10 },
    { xPercent: i % 2 ? 10 : -10, ease: 'none', scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: 1 } }));
}

/* ----------------------------------------------------------------------------
   The chapter index: staggered entrance, a fill that sweeps under each row, a
   decoding number, and a photograph that follows the pointer — tilting with
   its speed — for every chapter that has one.
   -------------------------------------------------------------------------- */
function initIndex({ q, one, fine }) {
  const nav = one('[data-msg-index]');
  const rows = q('[data-msg-row]');
  if (!nav || !rows.length) return;

  gsap.from(rows, {
    y: 60, autoAlpha: 0, stagger: 0.05, duration: 1.1, ease: 'power3.out',
    scrollTrigger: { trigger: nav, start: 'top 82%' },
  });

  if (!fine) return;

  const prev = one('[data-msg-preview]');
  const box = prev?.parentElement;
  const imgs = new Map(q('[data-msg-prev]').map((el) => [el.dataset.msgPrev, el]));
  let shown = null;
  let z = 1;

  const show = (id) => {
    if (!prev || id === shown) return;
    const old = shown && imgs.get(shown);
    if (old) gsap.to(old, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.6, ease: 'expo.inOut', overwrite: true });
    shown = id || null;
    const img = id && imgs.get(id);
    if (!img) return;
    gsap.set(prev, { visibility: 'visible' });
    gsap.set(img, { zIndex: ++z });
    gsap.fromTo(img, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'expo.out', overwrite: true });
    const pic = img.querySelector('.pic');
    if (pic) gsap.fromTo(pic, { scale: 1.35 }, { scale: 1, duration: 1.1, ease: 'expo.out', overwrite: true });
  };

  if (prev && box) {
    const xTo = gsap.quickTo(prev, 'x', { duration: 0.65, ease: 'power3' });
    const yTo = gsap.quickTo(prev, 'y', { duration: 0.65, ease: 'power3' });
    const rTo = gsap.quickTo(prev, 'rotation', { duration: 0.9, ease: 'power3' });
    let lastX = null;
    nav.addEventListener('pointermove', (e) => {
      const r = box.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (lastX === null) gsap.set(prev, { x: x + 48, y: y - prev.offsetHeight / 2 });
      xTo(x + 48);
      yTo(y - prev.offsetHeight / 2);
      rTo(gsap.utils.clamp(-14, 14, (x - (lastX ?? x)) * 0.8));
      lastX = x;
    });
    nav.addEventListener('pointerleave', () => { show(null); lastX = null; rTo(0); });
  }

  rows.forEach((r) => {
    const num = r.querySelector('[data-msg-rown]');
    const label = num.textContent;
    const t = gsap.timeline({ paused: true, defaults: { duration: 0.5, ease: 'power3.out' } })
      .to(r, { paddingLeft: 28, '--fill': 1 })
      .to(r.querySelector('.msg-row__ar'), { x: 12, autoAlpha: 1 }, 0)
      .to(r.querySelector('.msg-row__t'), { letterSpacing: '0.01em' }, 0);
    r.addEventListener('pointerenter', () => {
      t.play();
      gsap.to(num, { duration: 0.5, scrambleText: { text: label, chars: '0123456789', speed: 0.8 }, overwrite: true });
      show(r.dataset.media);
    });
    r.addEventListener('pointerleave', () => t.reverse());
  });
}

/* ----------------------------------------------------------------------------
   Pins standing in for `position: sticky`

   Side columns hold beside their chapter on wide screens. The apology cards
   arrive tipped back in perspective, settle flat, pile up — each holds a
   little lower than the last — and sink back and dim as the next arrives.
   -------------------------------------------------------------------------- */
function initPins({ q }) {
  const mm = gsap.matchMedia();

  mm.add('(min-width: 861px)', () => {
    q('[data-msg-grid]').forEach((grid) => {
      const stick = grid.querySelector('[data-msg-stick]');
      if (!stick) return;
      ScrollTrigger.create({
        trigger: stick,
        start: 'top 112px',
        endTrigger: grid,
        end: () => `bottom ${112 + stick.offsetHeight}px`,
        pin: stick,
        pinSpacing: false,
        invalidateOnRefresh: true,
      });
    });
  });

  const cards = q('[data-msg-stack]');
  if (cards.length < 2) return;
  const last = cards[cards.length - 1];
  const topOf = (c) => parseFloat(getComputedStyle(c).getPropertyValue('--top')) || 110;

  cards.forEach((card, i) => {
    gsap.fromTo(card, { rotationX: 22, transformPerspective: 1400 }, {
      rotationX: 0, ease: 'none',
      scrollTrigger: { trigger: card, start: 'top bottom', end: () => `top ${topOf(card)}px`, scrub: 1, invalidateOnRefresh: true },
    });
    gsap.from(card.querySelector('p'), {
      y: 40, autoAlpha: 0, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: card, start: 'top 70%', toggleActions: 'play none none reverse' },
    });

    if (card === last) return;
    ScrollTrigger.create({
      trigger: card,
      start: () => `top ${topOf(card)}px`,
      endTrigger: last,
      end: () => `top ${topOf(last)}px`,
      pin: card,
      pinSpacing: false,
      invalidateOnRefresh: true,
    });
    gsap.fromTo(card, { scale: 1, filter: 'brightness(1)' }, {
      scale: 0.9, filter: 'brightness(.55)', ease: 'none',
      scrollTrigger: {
        trigger: cards[i + 1],
        start: 'top bottom',
        end: () => `top ${topOf(cards[i + 1])}px`,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });
  });
}

/* ----------------------------------------------------------------------------
   Chapter 05: the horizontal ride

   The viewport pins and the track travels its own overflow. Photographs open
   and lines rise as they cross into view, driven by the ride itself
   (containerAnimation) rather than by vertical scroll. A rail along the
   bottom fills from "Sauna" to "Karon".
   -------------------------------------------------------------------------- */
function initRide({ one }) {
  const view = one('[data-msg-hview]');
  const track = one('[data-msg-htrack]');
  if (!view || !track) return;

  const bar = one('[data-msg-hbar]');
  const setBar = bar ? gsap.quickSetter(bar, '--p') : () => {};
  setBar(0);

  const distance = () => Math.max(0, track.scrollWidth - view.clientWidth);

  const ride = gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: view,
      start: 'top top',
      end: () => `+=${distance()}`,
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => setBar(self.progress),
    },
  });

  track.querySelectorAll('[data-msg-hph]').forEach((ph) => {
    gsap.fromTo(ph, { clipPath: 'inset(18% 30% 18% 30%)', scale: 0.9 }, {
      clipPath: 'inset(0% 0% 0% 0%)', scale: 1, ease: 'none',
      scrollTrigger: { trigger: ph, containerAnimation: ride, start: 'left 100%', end: 'left 45%', scrub: true },
    });
    const pic = ph.querySelector('.pic');
    if (pic) gsap.fromTo(pic, { xPercent: -8, scale: 1.15 }, {
      xPercent: 8, scale: 1.15, ease: 'none',
      scrollTrigger: { trigger: ph, containerAnimation: ride, start: 'left right', end: 'right left', scrub: true },
    });
  });

  track.querySelectorAll('p').forEach((p) => gsap.from(p, {
    y: 90, autoAlpha: 0, ease: 'none',
    scrollTrigger: { trigger: p, containerAnimation: ride, start: 'left 95%', end: 'left 60%', scrub: true },
  }));
  track.querySelectorAll('.msg-hcard .msg-mono').forEach((m) => gsap.from(m, {
    xPercent: -60, autoAlpha: 0, ease: 'none',
    scrollTrigger: { trigger: m, containerAnimation: ride, start: 'left 100%', end: 'left 70%', scrub: true },
  }));
}

/* ----------------------------------------------------------------------------
   Chapter-specific gestures
   -------------------------------------------------------------------------- */
function initChapters({ q, one, fine, scrub }) {
  // 02 — the two photographs travel at different depths.
  q('.msg-pair .msg-fig').forEach((f, i) => scrub(f,
    { y: i ? 140 : 50 }, { y: i ? -120 : -40 }, f.parentElement, 'top bottom', 'bottom top'));

  // 06 — "Buwakan" glides in on the ice, then rises letter by letter under
  // the pointer like a wave passing through it.
  const glide = one('[data-msg-glide]');
  if (glide) {
    const letters = [...glide.querySelectorAll('.msg-gl')];
    scrub(letters, { x: '-110vw', skewX: -30, autoAlpha: 0 },
      { x: 0, skewX: 0, autoAlpha: 1, stagger: 0.12 }, glide, 'top 95%', 'top 20%');
    if (fine) {
      const lift = letters.map((l) => gsap.quickTo(l, 'yPercent', { duration: 0.6, ease: 'power3' }));
      glide.addEventListener('pointermove', (e) => letters.forEach((l, i) => {
        const r = l.getBoundingClientRect();
        const d = Math.abs(e.clientX - (r.left + r.width / 2)) / r.width;
        lift[i](-22 * Math.max(0, 1 - d / 1.6));
      }));
      glide.addEventListener('pointerleave', () => lift.forEach((f) => f(0)));
    }
  }

  // 06 — the triptych staggers in depth: the middle frame climbs past the two.
  q('.msg-tri .msg-ph').forEach((ph, i) => scrub(ph,
    { y: i === 1 ? 40 : 90 }, { y: i === 1 ? -160 : -30 }, ph.parentElement, 'top bottom', 'bottom top'));

  // 07 — the four hard words arrive, then are struck through, one by one,
  // as "worth it kaayo" comes into focus beside them.
  const steady = one('[data-msg-steady]');
  if (steady) {
    scrub(steady.children, { y: 70, autoAlpha: 0, rotate: -3 },
      { y: 0, autoAlpha: 1, rotate: 0, stagger: 0.35 }, steady, 'top 80%', 'bottom 55%');
    gsap.fromTo(steady.children, { '--strike': 0 }, {
      '--strike': 1, color: 'rgba(183, 166, 164, .45)', ease: 'none', stagger: 0.3,
      scrollTrigger: { trigger: steady, start: 'bottom 62%', end: 'bottom 25%', scrub: 1 },
    });
  }

  // 12 — the cascade lands, then each line drifts at its own depth.
  const cascade = one('[data-msg-cascade]');
  if (cascade) {
    gsap.from(cascade.children, {
      x: -100, autoAlpha: 0, stagger: 0.14, duration: 1.3, ease: 'expo.out',
      scrollTrigger: { trigger: cascade, start: 'top 78%', toggleActions: 'play none none reverse' },
    });
    [...cascade.children].forEach((p, i) => scrub(p,
      { xPercent: [4, -3, 6, -5][i % 4] }, { xPercent: [-4, 3, -6, 5][i % 4] }, cascade, 'top bottom', 'bottom top'));
  }

  // 13 — a single heart is drawn behind "Ikaw gihapon.", like a pen stroke.
  const big = one('[data-msg-bigheart]');
  if (big) {
    const path = big.querySelector('path');
    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: big.parentElement, start: 'top 90%', end: 'center 40%', scrub: 1 },
    })
      .fromTo(path, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%' }, 0)
      .fromTo(big, { scale: 0.8, rotation: -8 }, { scale: 1, rotation: 0, transformOrigin: '50% 50%' }, 0);
  }
}

/* ----------------------------------------------------------------------------
   The finale: hearts pop in from the middle and keep beating, the wave rolls
   in, the giant "langga." rises letter by letter — and anywhere in the
   sign-off, a tap sends up a small handful of hearts.
   -------------------------------------------------------------------------- */
function initFinale({ q, one, scrub }) {
  const hearts = q('.msg-heart');
  if (hearts.length) {
    gsap.from(hearts, {
      autoAlpha: 0, yPercent: 160, rotation: () => gsap.utils.random(-40, 40),
      duration: 1, ease: 'back.out(2)', stagger: { each: 0.04, from: 'center' },
      scrollTrigger: { trigger: hearts[0].parentElement, start: 'top 88%', toggleActions: 'play none none reverse' },
    });
    gsap.to(hearts, {
      y: -12, scale: 1.2, duration: 0.6, ease: 'sine.inOut',
      stagger: { each: 0.08, repeat: -1, yoyo: true },
    });
  }

  const wv = q('.msg-wv');
  if (wv.length) {
    gsap.from(wv, {
      yPercent: 110, autoAlpha: 0, rotate: 12, duration: 1, ease: 'expo.out', stagger: 0.025,
      scrollTrigger: { trigger: wv[0].parentElement, start: 'top 85%', toggleActions: 'play none none reverse' },
    });
    gsap.to(wv, {
      y: '-0.14em', duration: 1, ease: 'sine.inOut',
      stagger: { each: 0.06, repeat: -1, yoyo: true },
    });
  }

  const foot = one('[data-msg-foot]');
  if (foot) scrub(foot.querySelectorAll('.msg-fch'),
    { yPercent: 105, rotate: 6 }, { yPercent: 0, rotate: 0, stagger: 0.08 },
    foot.parentElement, 'top bottom', 'bottom bottom');

  const finale = one('[data-msg-finale]');
  if (!finale) return;
  finale.addEventListener('pointerdown', (e) => {
    if (e.target instanceof Element && e.target.closest('a')) return;
    const r = finale.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    for (let i = 0; i < 10; i++) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.classList.add('msg-burst');
      // Scoped Astro styles need the component's attribute on new nodes.
      for (const a of finale.attributes) if (a.name.startsWith('data-astro-cid')) svg.setAttribute(a.name, '');
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', HEART);
      svg.appendChild(path);
      finale.appendChild(svg);

      const a = gsap.utils.random(0, Math.PI * 2);
      const d = gsap.utils.random(70, 200);
      gsap.set(svg, { x, y, scale: 0 });
      gsap.timeline({ onComplete: () => svg.remove() })
        .to(svg, { scale: gsap.utils.random(0.6, 1.5), duration: 0.3, ease: 'back.out(3)' })
        .to(svg, {
          x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 80,
          rotation: gsap.utils.random(-90, 90), duration: 1.2, ease: 'power3.out',
        }, 0)
        .to(svg, { autoAlpha: 0, duration: 0.5, ease: 'power1.in' }, 0.7);
    }
  });
}

/* ----------------------------------------------------------------------------
   Film grain that actually moves: the noise tile jumps a few times a second,
   and only while the letter is on screen.
   -------------------------------------------------------------------------- */
function initGrain(root) {
  let on = false;
  let last = 0;
  ScrollTrigger.create({
    trigger: root, start: 'top bottom', end: 'bottom top',
    onToggle: (self) => { on = self.isActive; },
  });
  gsap.ticker.add((time) => {
    if (!on || time - last < 0.09) return;
    last = time;
    root.style.setProperty('--gx', `${Math.round(gsap.utils.random(-110, 110))}px`);
    root.style.setProperty('--gy', `${Math.round(gsap.utils.random(-110, 110))}px`);
  });
}
