/* ============================================================================
   The gallery page's entry point.
   ----------------------------------------------------------------------------
   The same motion core and the same lightbox as the story, so clicking
   through from one to the other does not feel like arriving at a different
   site. The room itself needs almost nothing beyond the shared reveals.
   ========================================================================= */

import { initMotion } from './motion/core.js';
import { initChrome } from './motion/chrome.js';
import { initChapters } from './motion/chapters.js';
import { initLightbox } from './motion/lightbox.js';
import { initRoom } from './motion/room.js';
import { initSoundtrack } from './motion/soundtrack.js';
import { initCurtain } from './motion/curtain.js';

initMotion();
initChrome();
initChapters();
initLightbox();
initRoom();
initCurtain();     // before the soundtrack: it listens for soundtrack:start
initSoundtrack({ room: '/audio/bestpart.mp3' });
