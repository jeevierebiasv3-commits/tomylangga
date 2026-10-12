import { defineConfig } from 'astro/config';

export default defineConfig({
  server: { port: 4321, host: true },

  // The dev toolbar floats over the bottom of every page, which gets in the
  // way of reviewing full-bleed layouts. It never ships either way.
  devToolbar: { enabled: false },

  build: {
    // One stylesheet rather than a per-component request waterfall. The whole
    // site's CSS is small enough that splitting it costs more than it saves.
    inlineStylesheets: 'auto',
  },
});
