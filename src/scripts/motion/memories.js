/* ============================================================================
   motion/memories.js — chapter III
   ----------------------------------------------------------------------------
   The four movements with real mechanics behind them:

     journey  a pinned horizontal track, keyboard-reachable
     frames   ten photographs arriving one at a time
     flowers  a wall assembling out of nothing
     tour     a dark theatre with a small window of live video decoders

   Scroll distances are declared here, in one place, so the length of the
   chapter is a decision rather than an accident. The old build spent 1280vh
   on the frames alone; the whole chapter now runs in about that.
   ========================================================================= */

import { gsap, ScrollTrigger, MOTION } from './core.js';

/** Extra pinned scroll distance per movement, in viewport heights.
    This is on top of each movement's own viewport, and for the journey it is
    on top of the track's own travel distance — so the real cost of the
    journey is 1 + trackWidth + this.

    These numbers are the pacing of the chapter. Measured at 1440x900 the
    whole page comes to about 34 viewports; every 0.5 added here is half a
    screen more scrolling for the reader, so they are kept deliberately tight
    and the sense of pace comes from the stagger instead. */
const RUN = {
  journey: 1.0,
  frames: 2.0,
  flowers: 1.5,
  tour: 2.4,
};

export function initMemories() {
  initJourney();
  initFrames();
  initFlowers();
  initTour();
}

/* ----------------------------------------------------------------------------
   Movement one — the dates, read sideways
   -------------------------------------------------------------------------- */
function initJourney() {
  const root = document.querySelector('[data-journey]');
  if (!root || !MOTION.enabled) return;

  const pin = root.querySelector('[data-journey-pin]');
  const track = root.querySelector('[data-journey-track]');
  const cards = [...root.querySelectorAll('[data-journey-card]')];
  if (!pin || !track) return;

  const fill = root.querySelector('[data-journey-progress]');
  const count = root.querySelector('[data-journey-count]');

  // How far the track has to travel to bring its right edge to the viewport's.
  const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

  // A horizontal pin hides its own length: the page scrollbar says nothing
  // about where in the four you are. The rail under the pin says it instead.
  // The card index comes from which card's left edge the viewport has passed,
  // not from the raw ratio, so it changes when a plate actually arrives.
  const report = (self) => {
    if (fill) gsap.set(fill, { scaleX: self.progress });

    if (count && cards.length) {
      const travelled = distance() * self.progress + window.innerWidth * 0.35;
      let i = 0;
      while (i + 1 < cards.length && cards[i + 1].offsetLeft <= travelled) i += 1;
      const label = String(i + 1).padStart(2, '0');
      if (count.textContent !== label) count.textContent = label;
    }
  };

  const tween = gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      // Always the pinned element itself: a wrapper that contains anything
      // above the pin makes 'top top' fire too early.
      trigger: pin,
      start: 'top top',
      end: () => `+=${distance() + window.innerHeight * (RUN.journey - 1)}`,
      pin,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: report,
      onRefresh: report,
    },
  });

  // Tabbing to an offscreen card is the classic failure of a horizontal pin:
  // the browser scrolls the *container*, focus goes somewhere invisible, and
  // the layout breaks. Intercept it and drive the pin instead.
  for (const card of cards) {
    card.addEventListener('focus', () => {
      const st = tween.scrollTrigger;
      if (!st) return;

      // Undo any scroll the browser already did to reveal the card.
      track.parentElement.scrollLeft = 0;

      const total = distance();
      if (total <= 0) return;
      const offset = card.offsetLeft - window.innerWidth * 0.12;
      const ratio = gsap.utils.clamp(0, 1, offset / total);

      window.scrollTo({
        top: st.start + (st.end - st.start) * ratio,
        behavior: MOTION.enabled ? 'smooth' : 'auto',
      });
    });
  }
}

/* ----------------------------------------------------------------------------
   Movement two — frames we kept
   -------------------------------------------------------------------------- */
function initFrames() {
  const root = document.querySelector('[data-frames]');
  if (!root || !MOTION.enabled) return;

  const pin = root.querySelector('[data-frames-pin]');
  const items = [...root.querySelectorAll('[data-frames-item]')];
  const ticks = [...root.querySelectorAll('[data-frames-tick]')];
  const counter = root.querySelector('[data-frames-counter]');
  const stack = root.querySelector('[data-frames-stack]');
  if (!pin || items.length === 0) return;

  // The photographs are a physical deck seen in perspective, not a crossfade.
  // Three are visible at once — the one being read, and two receding behind it
  // — so the reader can see the stack has depth and is being spent. The one
  // leaving is thrown toward the viewer and up out of frame, which is the only
  // direction that does not read as "undo".
  //
  // `state(d)` is the whole language of the movement: d is a card's distance
  // from the one currently held. Everything else here just drives d.
  const DEPTH = 3;

  const state = (d) => {
    if (d === 0) {
      return { z: 0, yPercent: 0, scale: 1, rotateX: 0, rotateZ: 0, opacity: 1, blur: 0, zIndex: 60 };
    }
    // Thrown: forward, up, and tipped away as it goes.
    if (d < 0) {
      return {
        z: 320, yPercent: -46, scale: 1.12, rotateX: 26, rotateZ: -7,
        opacity: 0, blur: 10, zIndex: 90,
      };
    }
    // Queued: each one further back, smaller, fainter, softer.
    const k = Math.min(d, DEPTH);
    return {
      z: -170 * k,
      yPercent: 4.5 * k,
      scale: 1 - 0.075 * k,
      rotateX: 0,
      rotateZ: k % 2 ? 1.8 : -1.8,
      opacity: d > DEPTH ? 0 : 0.58 - 0.2 * (k - 1),
      blur: 1.6 * k,
      zIndex: 60 - k,
    };
  };

  // blur is carried as a number in `state` so the steps stay readable; GSAP
  // wants it as a filter string.
  const apply = (d) => {
    const { blur, ...rest } = state(d);
    return { ...rest, filter: `blur(${blur}px)` };
  };

  // Opening position: card one held, the rest already stacked behind it.
  items.forEach((item, i) => gsap.set(item, apply(i)));

  // The photograph drifts inside its own frame while it is being looked at.
  // Scaling the <img> rather than the card means the frame stays put and the
  // overflow does the cropping.
  const shots = items.map((it) => it.querySelector('img'));
  gsap.set(shots.filter(Boolean), { scale: 1.1, transformOrigin: '50% 50%' });

  // The counter is a mechanical flap, not a text swap.
  let shown = -1;
  const setCount = (i) => {
    if (!counter || i === shown) return;
    shown = i;
    counter.textContent = String(i + 1).padStart(2, '0');
    gsap.fromTo(counter,
      { yPercent: 55, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.34, ease: 'settle', overwrite: true });
  };
  setCount(0);

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${window.innerHeight * RUN.frames}`,
      pin,
      scrub: 0.7,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: ({ progress }) => {
        const i = Math.min(items.length - 1, Math.floor(progress * items.length));
        setCount(i);
        ticks.forEach((t, n) => { t.dataset.on = n <= i ? '1' : '0'; });
      },
    },
  });

  // One beat per photograph. On beat i every card re-seats itself relative to
  // card i, so the whole deck moves as one object instead of two cards
  // crossfading over a static background.
  for (let i = 1; i < items.length; i += 1) {
    items.forEach((item, j) => {
      const d = j - i;
      if (d < -1 || d > DEPTH + 1) return;   // already gone, or still too far back

      tl.to(item, {
        ...apply(d),
        duration: d === -1 ? 0.62 : 0.72,
        ease: d === -1 ? 'filmic' : 'settle',
      }, i - 0.45);
    });

    // Hand the drift to the card arriving.
    if (shots[i]) {
      tl.fromTo(shots[i], { scale: 1.1 }, { scale: 1, duration: 1.5, ease: 'none' }, i - 0.45);
    }
  }

  // A deck in perspective wants to be looked around. Pointer tilt, fine
  // pointers only — it is a flourish, and on touch it would fight the scroll.
  if (stack && window.matchMedia('(pointer: fine)').matches) {
    const rx = gsap.quickTo(stack, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(stack, 'rotationY', { duration: 0.8, ease: 'power3' });

    const onMove = (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      ry(nx * 7);
      rx(-ny * 5);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
  }
}

/* ----------------------------------------------------------------------------
   Movement three — the flower date
   -------------------------------------------------------------------------- */
function initFlowers() {
  const root = document.querySelector('[data-flowers]');
  if (!root) return;

  const wall = root.querySelector('[data-flowers-wall]');
  const tiles = [...root.querySelectorAll('[data-flowers-tile]')];
  if (!wall || tiles.length === 0) return;

  // Quieting the rest of the wall is one state on the container rather than
  // 22 listeners fighting each other.
  wall.addEventListener('pointerenter', () => { wall.dataset.hovering = '1'; });
  wall.addEventListener('pointerleave', () => { wall.dataset.hovering = '0'; });

  if (!MOTION.enabled) return;

  const pin = root.querySelector('[data-flowers-pin]');

  // Each tile flies in from the edge it is nearest, read from the custom
  // properties the component wrote.
  const from = tiles.map((t) => {
    const cs = getComputedStyle(t);
    return {
      x: `${parseFloat(cs.getPropertyValue('--fx')) || 0}vw`,
      y: `${parseFloat(cs.getPropertyValue('--fy')) || 0}vh`,
      rotate: cs.getPropertyValue('--fr') || '0deg',
      scale: parseFloat(cs.getPropertyValue('--fs')) || 0.6,
      opacity: 0,
      filter: 'blur(10px)',
    };
  });

  gsap.timeline({
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${window.innerHeight * RUN.flowers}`,
      pin,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  }).fromTo(tiles,
    (i) => from[i],
    {
      x: 0, y: 0, scale: 1, opacity: 1,
      rotate: (i, t) => getComputedStyle(t).getPropertyValue('--rot') || '0deg',
      filter: 'blur(0px)',
      ease: 'settle',
      stagger: { amount: 0.8, from: 'random' },
    });
}

/* ----------------------------------------------------------------------------
   Movement four — the guided tour

   The only genuinely expensive thing in the chapter. A <video> with a source
   attached holds a decoder whether or not it is playing, so ten of them on
   one page is how a phone runs out of memory. Only the active stop and its
   immediate neighbours ever hold a source.
   -------------------------------------------------------------------------- */
const WINDOW_RADIUS = 1;

function initTour() {
  const root = document.querySelector('[data-tour]');
  if (!root) return;

  const stops = [...root.querySelectorAll('[data-tour-stop]')];
  if (stops.length === 0) return;

  const clips = stops.map(s => s.querySelector('[data-clip]'));
  const videos = clips.map(c => c?.querySelector('video') || null);

  if (!MOTION.enabled) {
    // Nothing autoplays. Give every clip its controls and let the reader
    // decide; the posters are already doing the visual work.
    videos.forEach((v, i) => {
      if (!v) return;
      v.controls = true;
      v.preload = 'none';
      if (!v.src) v.src = clips[i].dataset.src;
    });
    return;
  }

  const pin = root.querySelector('[data-tour-pin]');
  const rail = root.querySelector('[data-tour-rail]');
  const counter = root.querySelector('[data-tour-counter]');
  const glow = root.querySelector('[data-tour-glow]');

  gsap.set(stops, { opacity: 0, scale: 0.94, yPercent: 6 });
  gsap.set(stops[0], { opacity: 1, scale: 1, yPercent: 0 });

  let active = -1;

  function attach(index) {
    videos.forEach((v, i) => {
      if (!v) return;
      const inWindow = Math.abs(i - index) <= WINDOW_RADIUS;

      if (inWindow && !v.src) {
        v.src = clips[i].dataset.src;
        v.load();
      } else if (!inWindow && v.src) {
        // removeAttribute alone leaves the decoder alive in some browsers;
        // load() after clearing is what actually releases it.
        v.pause();
        v.removeAttribute('src');
        v.load();
      }

      if (i === index) {
        // A rejected play() is normal (the clip may not be buffered yet, or
        // the tab is hidden) and is not worth surfacing.
        v.play?.().catch(() => {});
      } else {
        v.pause?.();
      }
    });
  }

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${window.innerHeight * RUN.tour}`,
      pin,
      scrub: 0.7,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: ({ progress }) => {
        if (rail) gsap.set(rail, { scaleX: progress });

        const i = Math.min(stops.length - 1, Math.floor(progress * stops.length));
        if (i === active) return;
        active = i;

        if (counter) counter.textContent = String(i + 1).padStart(2, '0');
        attach(i);
      },
      onLeave: () => releaseAll(),
      onLeaveBack: () => releaseAll(),
    },
  });

  stops.forEach((stop, i) => {
    if (i === 0) return;
    tl.to(stops[i - 1], { opacity: 0, scale: 0.95, yPercent: -6, duration: 0.5, ease: 'filmic' }, i - 0.5)
      .to(stop,         { opacity: 1, scale: 1, yPercent: 0, duration: 0.6, ease: 'settle' }, i - 0.4);
  });

  function releaseAll() {
    active = -1;
    if (glow) glow.style.opacity = '0';
    videos.forEach((v) => {
      if (!v || !v.src) return;
      v.pause();
      v.removeAttribute('src');
      v.load();
    });
  }

  // Scrolling away is not the only way to leave; a backgrounded tab should
  // not keep a decoder running either.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach(v => v?.pause());
    else if (active >= 0) videos[active]?.play?.().catch(() => {});
  });
}
