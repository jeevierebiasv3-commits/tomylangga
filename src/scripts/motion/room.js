/* ============================================================================
   motion/room.js — the gallery
   ----------------------------------------------------------------------------
   The room is walked, not scrolled, so everything here answers to the walk:

     - the masthead: the title rises letter by letter, the counts tick up, and
       on the way out the lines drift apart at different speeds
     - the marquee: a band of type whose pace and lean follow scroll velocity
     - the wall: plates hang at slightly different depths (ScrollSmoother
       effects on each cell), so columns slide past one another
     - the plates: each one wipes open as it reaches the line. With WebGL this
       is three/roomLens.js — a wavy wipe, a deep zoom settling, colour coming
       up out of monochrome, frames bowing with scroll speed and rippling under
       the pointer. Without it, the same reveal is done with clip-path.
     - the clips: play, silently, while they are on screen, and are released
       the moment they leave so only a few decoders are ever live
     - the counter: which plate you are standing at, bottom left

   Per-plate state ({ reveal, hover, mx, my }) is plain data tweened by GSAP;
   whichever renderer is active reads it. That is what lets the WebGL layer
   arrive late (it is a dynamic import) without the reveals stuttering.
   ========================================================================= */

import { gsap, ScrollTrigger, SplitText, MOTION, getSmoother } from './core.js';

const DESKTOP = '(min-width: 48.01rem)';

export function initRoom() {
  const plates = gsap.utils.toArray('[data-plate]');

  initMasthead();
  initMarquee();
  if (plates.length === 0) return;

  const entries = plates.map((plate) => {
    const el = plate.querySelector('.pic, .clip');
    return {
      plate,
      el,
      img: el?.querySelector('img') || null,
      clip: el?.classList.contains('clip') ? el : null,
      state: { reveal: 0, hover: 0, mx: 0.5, my: 0.5 },
    };
  }).filter(e => e.el);

  if (!MOTION.enabled) {
    entries.forEach(e => { e.state.reveal = 1; });
    return;
  }

  let lens = null;           // three/roomLens.js once it has mounted

  /* --- DOM reveal (also what shows until WebGL is ready) ------------------- */
  const paintDom = (e) => {
    if (lens) return;
    const p = e.state.reveal;
    e.el.style.clipPath = `inset(${(1 - p) * 100}% 0 0 0)`;
    const scale = `scale(${1 + (1 - p) * 0.35})`;
    e.el.querySelectorAll('img, video').forEach((m) => { m.style.transform = scale; });
  };
  entries.forEach(paintDom);

  ScrollTrigger.batch(entries.map(e => e.plate), {
    start: 'top 92%',
    once: true,
    onEnter: (batch) => {
      batch.forEach((plate, k) => {
        const e = entries.find(x => x.plate === plate);
        gsap.to(e.state, {
          reveal: 1,
          duration: 1.7,
          delay: k * 0.11,
          ease: 'filmic',
          onUpdate: () => paintDom(e),
        });
      });
    },
  });

  /* --- hover: state only; the renderer decides what it looks like ---------- */
  for (const e of entries) {
    const hoverTo = (v) => gsap.to(e.state, { hover: v, duration: v ? 0.9 : 0.7, ease: 'settle', overwrite: 'auto' });
    const mxTo = gsap.quickTo(e.state, 'mx', { duration: 0.6, ease: 'settle' });
    const myTo = gsap.quickTo(e.state, 'my', { duration: 0.6, ease: 'settle' });
    e.plate.addEventListener('pointerenter', () => hoverTo(1));
    e.plate.addEventListener('pointerleave', () => hoverTo(0));
    e.plate.addEventListener('focus', () => hoverTo(1));
    e.plate.addEventListener('blur', () => hoverTo(0));
    e.plate.addEventListener('pointermove', (ev) => {
      const r = e.el.getBoundingClientRect();
      mxTo((ev.clientX - r.left) / r.width);
      myTo(1 - (ev.clientY - r.top) / r.height);   // uv space: y up
    });
  }

  /* --- depth: cells hang at slightly different distances from the wall ------
     Speed follows the cell's horizontal centre, so the wall leans as it moves
     rather than shuffling — and neighbours stacked in the same columns move
     almost together, so they never close the gap between them. */
  const smoother = getSmoother();
  if (smoother && matchMedia(DESKTOP).matches) {
    for (const e of entries) {
      const cell = e.plate.closest('.ex__cell');
      const cs = getComputedStyle(cell);
      const col = parseFloat(cs.getPropertyValue('--col')) || 1;
      const span = parseFloat(cs.getPropertyValue('--span')) || 1;
      const centre = (col - 1 + span / 2) / 12;          // 0..1
      smoother.effects(cell, { speed: 0.975 + centre * 0.05 });
    }
  }

  initClips(entries, () => lens);
  initCounter(entries);

  /* --- the WebGL lens ------------------------------------------------------- */
  const scrollPos = () => (smoother ? smoother.scrollTop() : scrollY);
  let last = scrollPos();
  let frameDelta = 0;
  gsap.ticker.add(() => {
    const now = scrollPos();
    frameDelta = now - last;
    last = now;
    if (lens) lens.render(frameDelta);
  });

  // Not on coarse pointers at phone width: the DOM reveal is lighter there
  // and the frame bow would fight native momentum.
  if (!matchMedia(DESKTOP).matches) return;

  import('../three/roomLens.js')
    .then(({ createRoomLens }) => {
      lens = createRoomLens(entries);
      document.documentElement.dataset.roomGl = '1';
      // Hand the frames over: the canvas now paints them.
      for (const e of entries) {
        e.el.style.clipPath = '';
        e.el.querySelectorAll('img, video').forEach((m) => { m.style.transform = ''; });
      }
      // Clips already playing move onto the canvas too.
      entries.forEach((e, i) => { if (e.video?.dataset.live) lens.setVideo(i, e.video); });
    })
    .catch((err) => {
      // No WebGL (or a blocked context): the DOM reveal carries on alone.
      console.warn('[room] WebGL lens unavailable', err);
      lens = null;
      delete document.documentElement.dataset.roomGl;
    });
}

/* ----------------------------------------------------------------------------
   Clips — silent, looping, and only while seen
   -------------------------------------------------------------------------- */
function initClips(entries, getLens) {
  const clips = entries.map((e, i) => ({ e, i })).filter(x => x.e.clip);
  if (clips.length === 0) return;

  const start = ({ e, i }) => {
    if (e.video) { e.video.play().catch(() => {}); return; }
    const v = document.createElement('video');
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('aria-hidden', 'true');
    v.src = e.clip.dataset.src;
    if (!getLens()) v.style.transform = e.img?.style.transform || '';
    e.clip.appendChild(v);
    e.video = v;
    v.addEventListener('playing', () => {
      if (e.video !== v) return;
      v.dataset.live = '1';
      e.clip.dataset.playing = '1';
      getLens()?.setVideo(i, v);
    }, { once: true });
    v.play().catch(() => {});
  };

  const stop = ({ e, i }) => {
    const v = e.video;
    if (!v) return;
    e.video = null;
    delete e.clip.dataset.playing;
    getLens()?.setVideo(i, null);
    v.pause();
    v.removeAttribute('src');
    v.load();                 // releases the decoder
    v.remove();
  };

  const byEl = new Map(clips.map(x => [x.e.clip, x]));
  const io = new IntersectionObserver((records) => {
    for (const r of records) {
      const x = byEl.get(r.target);
      if (r.isIntersecting) start(x); else stop(x);
    }
  }, { rootMargin: '10% 0px 10% 0px', threshold: 0.15 });
  clips.forEach(x => io.observe(x.e.clip));
}

/* ----------------------------------------------------------------------------
   The plate counter — "where am I standing"
   -------------------------------------------------------------------------- */
function initCounter(entries) {
  const hud = document.querySelector('[data-room-hud]');
  const room = document.querySelector('.ex');
  if (!hud || !room) return;

  const num = hud.querySelector('[data-room-hud-num]');
  const bar = hud.querySelector('[data-room-hud-bar]');
  let current = 0;

  const set = (n) => {
    if (n === current) return;
    const dir = n > current ? 1 : -1;
    current = n;
    gsap.timeline()
      .to(num, { yPercent: -60 * dir, opacity: 0, duration: 0.16, ease: 'power2.in' })
      .add(() => { num.textContent = String(n).padStart(3, '0'); })
      .fromTo(num, { yPercent: 60 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.32, ease: 'snap' });
  };

  ScrollTrigger.create({
    trigger: room,
    start: 'top 60%',
    end: 'bottom 40%',
    onToggle: (self) => hud.dataset.on = self.isActive ? '1' : '',
    onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
  });

  // The plate whose top most recently passed the middle of the screen.
  entries.forEach((e, i) => {
    ScrollTrigger.create({
      trigger: e.plate,
      start: 'top 55%',
      onEnter: () => set(i + 1),
      onLeaveBack: () => set(Math.max(1, i)),
    });
  });
  set(1);
}

/* ----------------------------------------------------------------------------
   The masthead
   -------------------------------------------------------------------------- */
function initMasthead() {
  const head = document.querySelector('.gm');
  const title = document.querySelector('[data-room-title]');
  if (!head || !title || !MOTION.enabled) return;

  const split = SplitText.create(title, {
    type: 'lines,chars',
    mask: 'lines',
    linesClass: 'split-line',
    charsClass: 'split-char',
  });

  // Held until the doors open (motion/curtain.js), so the entrance plays in
  // view rather than under the curtain.
  const tl = gsap.timeline({ paused: true });
  window.addEventListener('room:enter', () => tl.play(), { once: true });
  tl.from(split.chars, {
    yPercent: 120,
    rotate: 10,
    transformOrigin: '0% 100%',
    duration: 1.4,
    ease: 'settle',
    stagger: { each: 0.035 },
  });
  tl.from(head.querySelectorAll('.ch__eyebrow, .gm__lede, .gm__facts > div, .ch__cue'), {
    y: 28,
    opacity: 0,
    duration: 1.1,
    ease: 'settle',
    stagger: 0.08,
  }, 0.45);

  // The numbers count up as they arrive.
  head.querySelectorAll('[data-count]').forEach((dd) => {
    const end = Number(dd.dataset.count);
    const o = { n: 0 };
    tl.to(o, {
      n: end,
      duration: 1.6,
      ease: 'power3.out',
      onUpdate: () => { dd.textContent = String(Math.round(o.n)); },
    }, 0.7);
  });

  // On the way out the lines part: each one drifts up at its own pace and
  // the whole block dims, so the room seems to rise up past the title.
  gsap.to(split.lines, {
    y: (i) => -60 - i * 70,
    ease: 'none',
    scrollTrigger: { trigger: head, start: 'top top', end: 'bottom top', scrub: 0.4 },
  });
  gsap.to(head.querySelector('.gm__inner'), {
    opacity: 0.15,
    ease: 'none',
    scrollTrigger: { trigger: head, start: 'center top', end: 'bottom top', scrub: true },
  });
}

/* ----------------------------------------------------------------------------
   The marquee — pace and lean follow the scroll
   -------------------------------------------------------------------------- */
function initMarquee() {
  const track = document.querySelector('[data-marquee]');
  if (!track || !MOTION.enabled) return;

  const loop = gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
  const lean = gsap.quickTo(track, 'skewX', { duration: 0.5, ease: 'settle' });
  let dir = 1;

  ScrollTrigger.create({
    trigger: track,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      const v = self.getVelocity();
      if (v !== 0) dir = v > 0 ? 1 : -1;
      const boost = Math.min(Math.abs(v) / 180, 7);
      gsap.to(loop, { timeScale: dir * (1 + boost), duration: 0.25, overwrite: true });
      lean(gsap.utils.clamp(-12, 12, -v / 220));
    },
    onToggle: (self) => { if (self.isActive) loop.play(); else loop.pause(); },
  });

  // Ease back to cruising pace whenever the scroll comes to rest.
  ScrollTrigger.addEventListener('scrollEnd', () => {
    gsap.to(loop, { timeScale: dir, duration: 1.2, ease: 'settle', overwrite: true });
    lean(0);
  });
}
