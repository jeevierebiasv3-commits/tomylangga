/* ============================================================================
   motion/present.js — chapter IV
   ----------------------------------------------------------------------------
   The stacking reasons deck, the pointer-lit line, and the letter.

   The letter is worth a note. The old build stored its text in a data
   attribute and typed it into an empty element, which meant that with no
   JavaScript there was no letter at all — the single most personal thing on
   the site was invisible. Here the text is in the markup and the typewriter
   only controls how much of it is *revealed*.
   ========================================================================= */

import { gsap, ScrollTrigger, MOTION } from './core.js';

/** Extra pinned viewport-heights, on top of each movement's own. */
const RUN = { reasons: 1.6, letter: 1.2 };

export function initPresent() {
  initReasons();
  initSpotlight();
  initLetter();
}

/* ----------------------------------------------------------------------------
   The reasons deck
   -------------------------------------------------------------------------- */
function initReasons() {
  const root = document.querySelector('[data-reasons]');
  if (!root || !MOTION.enabled) return;

  const pin = root.querySelector('[data-reasons-pin]');
  const cards = [...root.querySelectorAll('[data-reasons-card]')];
  if (!pin || cards.length === 0) return;

  // Dealt from below, and each one settles back and shrinks a little as the
  // next arrives — so the stack reads as depth rather than as replacement.
  gsap.set(cards, { yPercent: 100, opacity: 0, scale: 1 });
  gsap.set(cards[0], { yPercent: 0, opacity: 1 });

  const tl = gsap.timeline({
    scrollTrigger: {
      // The pin itself, not `root` — root also holds the chapter header, and
      // triggering on it pins the deck while it is still below the fold.
      trigger: pin,
      start: 'top top',
      end: () => `+=${window.innerHeight * RUN.reasons}`,
      pin,
      scrub: 0.7,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  // The incoming card leads and the outgoing one follows it up and back.
  // Doing this the other way round — outgoing first — leaves a window in the
  // middle of every transition where the previous card has already gone and
  // the next has not arrived, and the reader scrolls through an empty screen.
  cards.forEach((card, i) => {
    if (i === 0) return;
    const t = i - 1;
    tl.to(card, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'settle' }, t)
      .to(cards[i - 1], {
        scale: 0.94, yPercent: -4, opacity: 0.4,
        duration: 0.7, ease: 'filmic',
      }, t + 0.15);
  });
}

/* ----------------------------------------------------------------------------
   The spotlight

   A bright duplicate of the line, masked to a circle that follows the
   pointer. The dim original underneath is the real, always-readable text.
   -------------------------------------------------------------------------- */
function initSpotlight() {
  const root = document.querySelector('[data-spotlight]');
  const text = root?.querySelector('[data-spotlight-text]');
  if (!root || !text || !MOTION.enabled) return;
  if (!matchMedia('(pointer: fine)').matches) return;

  const lit = text.cloneNode(true);
  lit.classList.add('spot__lit');
  lit.removeAttribute('data-spotlight-text');
  // It is the same sentence twice; only one of them should be announced.
  lit.setAttribute('aria-hidden', 'true');
  text.appendChild(lit);

  const setX = gsap.quickTo(lit, '--spot-x', { duration: 0.5, ease: 'power3' });
  const setY = gsap.quickTo(lit, '--spot-y', { duration: 0.5, ease: 'power3' });

  root.addEventListener('pointermove', (e) => {
    const r = lit.getBoundingClientRect();
    setX(`${e.clientX - r.left}px`);
    setY(`${e.clientY - r.top}px`);
  });

  // Park the light in the middle when the pointer leaves, rather than
  // stranding it in a corner.
  root.addEventListener('pointerleave', () => {
    gsap.to(lit, { '--spot-x': '50%', '--spot-y': '50%', duration: 0.8, ease: 'settle' });
  });
}

/* ----------------------------------------------------------------------------
   The letter
   -------------------------------------------------------------------------- */
function initLetter() {
  const root = document.querySelector('[data-letter]');
  if (!root) return;

  const body = root.querySelector('[data-letter-text]');
  const sign = root.querySelector('[data-letter-sign]');
  if (!body) return;

  if (!MOTION.enabled) return;   // the letter is already written

  const pin = root.querySelector('[data-letter-pin]');
  const full = body.textContent;

  // Wrap every character so the reveal is a CSS state rather than a string
  // rebuild — the text stays in the DOM and stays selectable and searchable.
  const frag = document.createDocumentFragment();
  const chars = [];
  for (const ch of full) {
    const span = document.createElement('span');
    span.className = 'letter__ch';
    span.textContent = ch;
    span.style.opacity = '0';
    frag.appendChild(span);
    chars.push(span);
  }

  const caret = document.createElement('span');
  caret.className = 'letter__caret';
  caret.setAttribute('aria-hidden', 'true');

  body.textContent = '';
  body.setAttribute('aria-label', full);
  body.appendChild(frag);
  body.appendChild(caret);

  if (sign) gsap.set(sign, { opacity: 0, y: 14 });

  gsap.timeline({
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${window.innerHeight * RUN.letter}`,
      pin,
      scrub: 0.5,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  })
    .to(chars, { opacity: 1, duration: 0.01, stagger: { amount: 0.75 }, ease: 'none' }, 0)
    .to(caret, { opacity: 0, duration: 0.08 }, 0.78)
    .to(sign,  { opacity: 1, y: 0, duration: 0.2, ease: 'settle' }, 0.8);

  // Position the caret after the last revealed character.
  ScrollTrigger.create({
    trigger: pin,
    start: 'top top',
    end: () => `+=${window.innerHeight * RUN.letter}`,
    onUpdate: ({ progress }) => {
      const i = Math.min(chars.length - 1, Math.floor((progress / 0.78) * chars.length));
      const after = chars[i];
      if (after && caret.previousSibling !== after) after.after(caret);
    },
  });
}
