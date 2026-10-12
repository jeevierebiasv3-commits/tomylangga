/* ============================================================================
   The story page's entry point.
   ----------------------------------------------------------------------------
   Order matters: the motion core mounts ScrollSmoother and resolves the
   motion mode, so everything that creates a ScrollTrigger has to come after
   it. The prologue is next because it owns the scroll lock — and it refreshes
   every trigger once it hands scrolling over, since they were all measured
   against a locked, one-viewport document.
   ========================================================================= */

import { initMotion } from './motion/core.js';
import { initPrologue } from './motion/prologue.js';
import { initChrome } from './motion/chrome.js';
import { initChapters } from './motion/chapters.js';
import { initMemories } from './motion/memories.js';
import { initMap } from './motion/map.js';
import { initPresent } from './motion/present.js';
import { initLetterIntro } from './motion/letterIntro.js';
import { initMessage } from './motion/message.js';
import { initNext } from './motion/next.js';
import { initLightbox } from './motion/lightbox.js';
import { initSoundtrack } from './motion/soundtrack.js';

initMotion();
initPrologue();
initChrome();
initChapters();
initMemories();
initMap();
initPresent();
initLetterIntro();
initMessage();
initNext();
initLightbox();
initSoundtrack();
