/* ============================================================================
   motion/chapters.js — the shared narrative motion
   ----------------------------------------------------------------------------
   The handful of behaviours every chapter draws on, bound by attribute so a
   chapter opts in from its markup and never imports anything:

     [data-reveal]    the default entrance
     [data-split]     a heading arriving line by line
     [data-words]     a line read word by word as you scroll through it
     [data-mask]      a photograph wiping open
     [data-parallax]  depth inside a fixed frame
     [data-odometer]  the live counter

   Every one of these checks MOTION first and paints the finished state when
   motion is off, so the reduced-motion page is composed rather than bare.
   ========================================================================= */

import { gsap, ScrollTrigger, MOTION, splitLines } from './core.js';

export function initChapters() {
  initReveals();
  initSplits();
  initWords();
  initMasks();
  initParallax();
  initOdometer();
}

/* ----------------------------------------------------------------------------
   [data-reveal] — the default entrance
   -------------------------------------------------------------------------- */
function initReveals() {
  const items = gsap.utils.toArray('[data-reveal]');
  if (items.length === 0) return;

  if (!MOTION.enabled) {
    for (const el of items) el.dataset.revealed = '1';
    return;
  }

  // ScrollTrigger.batch groups elements that cross the line together, so a
  // row of four captions staggers as a row instead of firing four triggers.
  ScrollTrigger.batch(items, {
    start: 'top 86%',
    once: true,
    onEnter: (batch) => {
      batch.forEach((el, i) => {
        const extra = parseFloat(el.dataset.delay || 0);
        gsap.delayedCall(i * 0.08 + extra, () => { el.dataset.revealed = '1'; });
      });
    },
  });
}

/* ----------------------------------------------------------------------------
   [data-split] — a heading arriving line by line
   -------------------------------------------------------------------------- */
function initSplits() {
  for (const el of gsap.utils.toArray('[data-split]')) {
    if (!MOTION.enabled) continue;

    const split = splitLines(el, 'lines');
    gsap.from(split.lines, {
      yPercent: 115,
      duration: 1.25,
      ease: 'settle',
      stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  }
}

/* ----------------------------------------------------------------------------
   [data-words] — read word by word, scrubbed to the scroll

   Used for the lines that are meant to be taken slowly: the pauses, the pull
   quotes, the vows. The words brighten from faint to full as the line passes
   through the middle of the screen, which paces the reading without moving
   anything.
   -------------------------------------------------------------------------- */
function initWords() {
  for (const el of gsap.utils.toArray('[data-words]')) {
    if (!MOTION.enabled) continue;

    const split = splitLines(el, 'words');
    // The floor is a readability decision, not a visual one: unread words must
    // still be legible for anyone who lands mid-section or scrolls past fast.
    const floor = el.closest('[data-tone="dark"]') ? 0.3 : 0.22;
    gsap.fromTo(split.words,
      { opacity: floor },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.5,
        scrollTrigger: {
          trigger: el,
          start: 'top 78%',
          end: 'bottom 52%',
          scrub: 0.6,
        },
      });
  }
}

/* ----------------------------------------------------------------------------
   [data-mask] — a photograph wiping open
   -------------------------------------------------------------------------- */
function initMasks() {
  for (const el of gsap.utils.toArray('[data-mask]')) {
    if (!MOTION.enabled) { gsap.set(el, { clipPath: 'none' }); continue; }

    gsap.fromTo(el,
      { clipPath: 'inset(0 0 100% 0)' },
      {
        clipPath: 'inset(0 0 0% 0)',
        duration: 1.6,
        ease: 'filmic',
        scrollTrigger: { trigger: el, start: 'top 82%', once: true },
      });
  }
}

/* ----------------------------------------------------------------------------
   [data-parallax] — depth inside a frame

   The frame holds still; the image inside it travels. `data-parallax` is the
   travel distance as a percentage of the element's height.
   -------------------------------------------------------------------------- */
function initParallax() {
  for (const el of gsap.utils.toArray('[data-parallax]')) {
    if (!MOTION.enabled) continue;

    const amount = parseFloat(el.dataset.parallax) || 8;
    const img = el.querySelector('img, video, .pic, .clip') || el;

    gsap.fromTo(img,
      { yPercent: -amount / 2, scale: 1 + amount / 180 },
      {
        yPercent: amount / 2,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
  }
}

/* ----------------------------------------------------------------------------
   [data-odometer] — the live counter

   Days : hours : minutes : seconds since the van ride. Each digit is a column
   of 0-9 translated into place, so only the digits that actually change move.
   -------------------------------------------------------------------------- */
function initOdometer() {
  const host = document.querySelector('[data-odometer]');
  if (!host) return;

  const since = new Date(`${host.dataset.since || '2022-05-14'}T00:00:00`);
  if (Number.isNaN(since.getTime())) return;

  const GROUPS = [
    { key: 'days',    digits: 4, unit: 'days' },
    { key: 'hours',   digits: 2, unit: 'hrs' },
    { key: 'minutes', digits: 2, unit: 'min' },
    { key: 'seconds', digits: 2, unit: 'sec' },
  ];

  // Build the columns, then drop the build-time fallback. Doing it in this
  // order means the number never blinks out.
  const frag = document.createDocumentFragment();
  const columns = {};

  GROUPS.forEach((g, gi) => {
    const group = document.createElement('div');
    group.className = 'odo__group';

    const digits = document.createElement('div');
    digits.className = 'odo__digits';
    columns[g.key] = [];

    for (let i = 0; i < g.digits; i++) {
      const col = document.createElement('div');
      col.className = 'odo__col';
      const strip = document.createElement('div');
      strip.className = 'odo__strip';
      for (let n = 0; n <= 9; n++) {
        const span = document.createElement('span');
        span.textContent = String(n);
        strip.appendChild(span);
      }
      col.appendChild(strip);
      digits.appendChild(col);
      columns[g.key].push(strip);
    }

    const unit = document.createElement('span');
    unit.className = 'odo__unit';
    unit.textContent = g.unit;

    group.append(digits, unit);
    frag.appendChild(group);

    if (gi < GROUPS.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'odo__sep';
      sep.textContent = ':';
      sep.setAttribute('aria-hidden', 'true');
      frag.appendChild(sep);
    }
  });

  host.appendChild(frag);
  host.querySelector('[data-odo-fallback]')?.remove();

  // One live region that speaks the whole duration, because a screen reader
  // reading four columns of rolling digits is noise. It is polite and only
  // updated once a minute.
  const live = document.createElement('p');
  live.className = 'sr-only';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  host.appendChild(live);

  let lastMinute = -1;

  const setDigits = (key, value, count) => {
    const text = String(value).padStart(count, '0').slice(-count);
    columns[key].forEach((strip, i) => {
      const digit = Number(text[i]);
      if (strip.dataset.d === String(digit)) return;
      strip.dataset.d = String(digit);
      if (MOTION.enabled) {
        gsap.to(strip, { yPercent: -digit * 10, duration: 0.55, ease: 'settle' });
      } else {
        gsap.set(strip, { yPercent: -digit * 10 });
      }
    });
  };

  function tick() {
    const ms = Date.now() - since.getTime();
    if (ms < 0) return;
    const total = Math.floor(ms / 1000);
    const days = Math.floor(total / 86400);
    const hours = Math.floor(total / 3600) % 24;
    const minutes = Math.floor(total / 60) % 60;
    const seconds = total % 60;

    setDigits('days', days, 4);
    setDigits('hours', hours, 2);
    setDigits('minutes', minutes, 2);
    setDigits('seconds', seconds, 2);

    if (minutes !== lastMinute) {
      lastMinute = minutes;
      live.textContent =
        `${days.toLocaleString('en-US')} days, ${hours} hours and ${minutes} minutes since May 14, 2022.`;
    }
  }

  tick();

  // gsap.ticker rather than setInterval: it pauses with the tab, so a
  // backgrounded page is not waking up once a second forever.
  let last = 0;
  gsap.ticker.add((time) => {
    if (time - last < 1) return;
    last = time;
    tick();
  });
}
