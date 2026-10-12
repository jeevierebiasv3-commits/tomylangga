/* ============================================================================
   motion/soundtrack.js — the background music
   ----------------------------------------------------------------------------
   Two cues, one page:

     intro    from the prologue down to the letter's intro
     message  from the letter's intro onward (the violin)

   Music is on by default. Playback is attempted the moment the page loads;
   most browsers refuse sound before the visitor has interacted, so if that
   is blocked it starts on the first gesture anywhere instead (the "Enter
   our story" click usually). Switching cues cross-fades; scrolling back
   above the letter brings the intro back.

   The gallery passes its own single cue (see gallery-page.js), so it gets
   the same autoplay, gesture fallback and toggle with no hand-over.

   Any [data-sound-toggle] on the page mutes/unmutes. A mute lasts for the
   visit only, so every new visit starts with the music playing. A cue whose
   src is null is silence.
   ========================================================================= */

import { gsap, ScrollTrigger } from './core.js';

const SOUND_KEY = 'langga-sound';
const VOLUME = 0.4;

const CUES = {
  intro:   '/audio/intro.mp3',   // NIKI — You'll Be in My Heart
  message: '/audio/violin.mp3',
};

const MESSAGE_SECTION = '#letter-intro';

export function initSoundtrack(cues = CUES) {
  const players = {};
  let current = Object.keys(cues)[0];
  let muted = readMuted();
  let started = false;

  const toggles = [...document.querySelectorAll('[data-sound-toggle]')];
  toggles.forEach((btn) => {
    btn.hidden = false;
    btn.addEventListener('click', (e) => {
      // The click is itself the first gesture; don't let begin() also fire.
      e.stopPropagation();
      started = true;
      detach();
      setMuted(!muted);
    });
  });
  render();

  // Try to start straight away; if the browser blocks it, the first gesture
  // anywhere tries again.
  const GESTURES = ['pointerdown', 'click', 'keydown', 'touchstart'];
  const onGesture = () => { if (!started) begin(); };
  function detach() { GESTURES.forEach((t) => window.removeEventListener(t, onGesture, true)); }
  GESTURES.forEach((t) => window.addEventListener(t, onGesture, true));
  begin();

  function begin() {
    const a = !muted && player(current);
    if (!a) { started = true; detach(); announce(); return; }
    gsap.killTweensOf(a);
    a.play()
      .then(() => {
        started = true;
        detach();
        announce();
        gsap.to(a, { volume: VOLUME, duration: 2.2, ease: 'none' });
      })
      .catch(() => { /* autoplay blocked — wait for a gesture */ });
  }

  // Nothing left to wait for: sound is playing, or deliberately off. The
  // gallery's curtain (motion/curtain.js) opens itself on this.
  function announce() { window.dispatchEvent(new CustomEvent('soundtrack:start')); }

  // Hand over to the letter's cue, and back again above it.
  if (cues.message && document.querySelector(MESSAGE_SECTION)) {
    ScrollTrigger.create({
      trigger: MESSAGE_SECTION,
      start: 'top 60%',
      onEnter: () => cue('message'),
      onLeaveBack: () => cue('intro'),
    });
  }

  function cue(name) {
    if (name === current) return;
    const prev = current;
    current = name;
    if (!started || muted) return;
    fadeOut(prev);
    fadeIn(name);
  }

  function player(name) {
    if (!cues[name]) return null;
    if (!players[name]) {
      const a = new Audio(cues[name]);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      players[name] = a;
    }
    return players[name];
  }

  function fadeIn(name) {
    const a = player(name);
    if (!a) return;
    gsap.killTweensOf(a);
    a.play()
      .then(() => gsap.to(a, { volume: VOLUME, duration: 2.2, ease: 'none' }))
      .catch(() => { /* blocked or undecodable — stay silent */ });
  }

  function fadeOut(name) {
    const a = players[name];
    if (!a) return;
    gsap.killTweensOf(a);
    gsap.to(a, {
      volume: 0, duration: 1.2, ease: 'none',
      onComplete: () => a.pause(),
    });
  }

  function setMuted(next) {
    muted = next;
    try { sessionStorage.setItem(SOUND_KEY, muted ? 'off' : 'on'); } catch { /* private mode */ }
    muted ? fadeOut(current) : fadeIn(current);
    render();
  }

  function render() {
    toggles.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(!muted));
      const label = btn.querySelector('[data-sound-label]');
      if (label) label.textContent = muted ? 'Sound off' : 'Sound on';
    });
  }
}

function readMuted() {
  try { return sessionStorage.getItem(SOUND_KEY) === 'off'; } catch { return false; }
}
