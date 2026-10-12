/* ============================================================================
   motion/map.js — the memory map
   ----------------------------------------------------------------------------
   Keeps the plotted route in step with the list beside it: the route draws on
   as the section is read, and whichever entry is in view (or hovered, or
   focused) lights its node.

   With motion off the route is simply drawn and the first entry is marked.
   Nothing here is load-bearing — the list is the content.
   ========================================================================= */

import { gsap, ScrollTrigger, MOTION } from './core.js';

export function initMap() {
  const section = document.getElementById('memory-map');
  if (!section) return;

  const route = section.querySelector('[data-map-route]');
  const nodes = new Map(
    [...section.querySelectorAll('[data-map-node]')].map(n => [n.dataset.mapNode, n])
  );
  const entries = [...section.querySelectorAll('[data-map-entry]')];
  if (entries.length === 0) return;

  let current = null;

  function activate(id) {
    if (id === current) return;
    current = id;
    for (const entry of entries) {
      entry.dataset.active = entry.dataset.mapEntry === id ? '1' : '0';
    }
    for (const [key, node] of nodes) {
      node.dataset.active = key === id ? '1' : '0';
    }
  }

  // Hover and focus are as good a signal as scrolling for "which one am I
  // looking at", and they are the only signal a keyboard user gives.
  for (const entry of entries) {
    const card = entry.querySelector('.map__card') || entry;
    card.addEventListener('pointerenter', () => activate(entry.dataset.mapEntry));
    card.addEventListener('focus', () => activate(entry.dataset.mapEntry));
  }

  if (!MOTION.enabled) {
    if (route) gsap.set(route, { drawSVG: '100%' });
    activate(entries[0].dataset.mapEntry);
    return;
  }

  // The route draws on across the whole section.
  if (route) {
    gsap.fromTo(route,
      { drawSVG: '0%' },
      {
        drawSVG: '100%',
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top 65%',
          end: 'bottom 85%',
          scrub: 0.8,
        },
      });
  }

  for (const entry of entries) {
    ScrollTrigger.create({
      trigger: entry,
      start: 'top 62%',
      end: 'bottom 62%',
      onToggle: ({ isActive }) => { if (isActive) activate(entry.dataset.mapEntry); },
    });
  }

  activate(entries[0].dataset.mapEntry);
}
