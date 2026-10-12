/* ============================================================================
   motion/chrome.js — navigation behaviour
   ----------------------------------------------------------------------------
   The masthead, the chapter rail, the reading progress bar and the index
   overlay. All of it degrades to plain anchor links; this layer only adds
   the knowing-where-you-are part.
   ========================================================================= */

import { gsap, ScrollTrigger, MOTION, scrollToTarget } from './core.js';

export function initChrome() {
  initRail();
  initProgress();
  initMasthead();
  initIndex();
}

/* ----------------------------------------------------------------------------
   The rail: which chapter am I in, and is it dark?
   -------------------------------------------------------------------------- */
function initRail() {
  const rail = document.querySelector('[data-rail]');
  const mast = document.querySelector('[data-mast]');
  const links = [...document.querySelectorAll('[data-rail-link]')];
  if (links.length === 0) return;

  const sections = links
    .map(link => ({ link, el: document.getElementById(link.dataset.railLink) }))
    .filter(s => s.el);

  const setCurrent = (active) => {
    for (const s of sections) {
      const on = s.el === active;
      // aria-current carries this to assistive tech; the styling hangs off
      // the same attribute so the two can never drift apart.
      s.link.setAttribute('aria-current', on ? 'true' : 'false');
    }
  };

  for (const s of sections) {
    ScrollTrigger.create({
      trigger: s.el,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: ({ isActive }) => {
        if (!isActive) return;
        setCurrent(s.el);
        // Invert the chrome over dark chapters so it stays legible against
        // ink as well as against bone.
        const dark = s.el.dataset.tone === 'dark' || !!s.el.closest('[data-tone="dark"]');
        if (rail) rail.dataset.onDark = dark ? '1' : '0';
        if (mast) mast.dataset.onDark = dark ? '1' : '0';
      },
    });
  }

  setCurrent(sections[0].el);
}

/* ----------------------------------------------------------------------------
   Reading progress
   -------------------------------------------------------------------------- */
function initProgress() {
  const bar = document.querySelector('[data-progress]');
  if (!bar) return;

  // scaleX on a 0-width element does nothing, so the bar is full-width and
  // scaled from the left edge — one compositor property, no layout.
  gsap.set(bar, { width: '100%', scaleX: 0 });

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: ({ progress }) => gsap.set(bar, { scaleX: progress }),
  });
}

/* ----------------------------------------------------------------------------
   Masthead: out of the way going down, back on the way up
   -------------------------------------------------------------------------- */
function initMasthead() {
  const mast = document.querySelector('[data-mast]');
  if (!mast || !MOTION.enabled) return;

  ScrollTrigger.create({
    start: 'top -140',
    end: 'max',
    onUpdate: (self) => {
      // Never hide it while the index is open, or the close button vanishes.
      if (document.documentElement.dataset.indexOpen === '1') {
        mast.dataset.hidden = '0';
        return;
      }
      mast.dataset.hidden = self.direction === 1 ? '1' : '0';
    },
    onLeaveBack: () => { mast.dataset.hidden = '0'; },
  });
}

/* ----------------------------------------------------------------------------
   The index overlay
   -------------------------------------------------------------------------- */
function initIndex() {
  const overlay = document.querySelector('[data-index]');
  const openBtn = document.querySelector('[data-index-open]');
  if (!overlay || !openBtn) return;

  const panel = overlay.querySelector('.index__panel');
  const scrim = overlay.querySelector('.index__scrim');
  const chapters = [...overlay.querySelectorAll('[data-index-link]')];
  let lastFocused = null;
  let open = false;

  function show() {
    if (open) return;
    open = true;
    lastFocused = document.activeElement;

    overlay.hidden = false;
    document.documentElement.dataset.indexOpen = '1';
    document.body.dataset.locked = '';
    openBtn.setAttribute('aria-expanded', 'true');

    if (MOTION.enabled) {
      gsap.timeline({ defaults: { ease: 'settle' } })
        .fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0)
        .fromTo(panel, { yPercent: -4, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6 }, 0)
        .fromTo(chapters,
          { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.045 }, 0.12);
    } else {
      gsap.set([scrim, panel, chapters], { opacity: 1, y: 0, yPercent: 0 });
    }

    // Focus the close button rather than the first chapter, so the overlay
    // does not read as "Before we spoke, link" the instant it opens.
    overlay.querySelector('[data-index-close]')?.focus({ preventScroll: true });
  }

  function hide({ restoreFocus = true } = {}) {
    if (!open) return;
    open = false;

    const finish = () => {
      overlay.hidden = true;
      delete document.documentElement.dataset.indexOpen;
      delete document.body.dataset.locked;
      if (restoreFocus) lastFocused?.focus?.({ preventScroll: true });
    };

    openBtn.setAttribute('aria-expanded', 'false');

    if (MOTION.enabled) {
      gsap.timeline({ onComplete: finish, defaults: { ease: 'settle' } })
        .to(panel, { yPercent: -3, opacity: 0, duration: 0.42 }, 0)
        .to(scrim, { opacity: 0, duration: 0.42 }, 0);
    } else {
      finish();
    }
  }

  openBtn.addEventListener('click', () => (open ? hide() : show()));

  for (const el of overlay.querySelectorAll('[data-index-close]')) {
    el.addEventListener('click', () => hide());
  }

  // Following a chapter link closes the overlay and hands focus to the
  // destination, not back to the button that opened it.
  for (const link of chapters) {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      const dest = id && document.querySelector(id);
      if (!dest) return;
      e.preventDefault();
      hide({ restoreFocus: false });
      // Wait for the scroll lock to lift before scrolling.
      requestAnimationFrame(() => scrollToTarget(dest));
      history.pushState(null, '', id);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); hide(); return; }
    if (e.key !== 'Tab') return;

    const items = [...panel.querySelectorAll('a[href], button:not([disabled])')]
      .filter(el => el.offsetParent !== null);
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}
