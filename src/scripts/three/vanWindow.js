/* ============================================================================
   three/vanWindow.js — the prologue scene
   ----------------------------------------------------------------------------
   The van to the resort, 14 May 2022. Dusk on the road out of Balamban, seen
   from the back seat: hills going past, roadside poles smearing with speed,
   rain-fleck on the glass, and a warm phone glow low in frame.

   It is one fullscreen fragment shader. Everything — sky, hills, poles,
   motion blur, glass, the window mask, grain — is procedural, so the whole
   scene weighs nothing beyond the three.js runtime and nothing has to be
   downloaded or decoded before it can start.

   The uniforms are the interface. motion/prologue.js drives them from a GSAP
   timeline, which is what couples the typography to the image: when the words
   land, the exposure uniform lifts and the scene brightens with them.

   Imported dynamically, and disposed the moment the visitor enters the story.
   ========================================================================= */

import {
  WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry,
  ShaderMaterial, Mesh, Vector2, Clock,
} from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec2  uRes;
  uniform float uTime;
  uniform float uSpeed;     // road speed, 1 at full pace -> ~0.1 as we arrive
  uniform float uExposure;  // driven by the text timeline
  uniform float uOpen;      // 0 = window framed, 1 = expanded to full bleed
  uniform float uFade;      // global fade used on handover
  uniform vec2  uPointer;   // -1..1, a little head movement

  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // A ridge line built from three sines — enough variation to read as hills
  // without ever repeating visibly at this scale.
  float ridge(float x, float seed, float amp) {
    return amp * (sin(x * 2.1 + seed) * 0.5
                + sin(x * 4.7 + seed * 1.7) * 0.28
                + sin(x * 9.3 + seed * 2.3) * 0.12);
  }

  // The whole view through the glass. The ca argument offsets the scroll by
  // colour channel, which is what gives the edges their chromatic fringe.
  vec3 view(vec2 uv, float ca) {
    float t  = uTime;
    float sp = uSpeed;
    float h  = uv.y;

    // --- sky: ember at the horizon, dusk above, night at the top ----------
    vec3 warm = vec3(0.86, 0.46, 0.26);
    vec3 dusk = vec3(0.24, 0.29, 0.35);
    vec3 nite = vec3(0.07, 0.08, 0.11);

    vec3 col = mix(warm, dusk, smoothstep(0.40, 0.74, h));
    col = mix(col, nite, smoothstep(0.66, 1.05, h));

    // the sun already under the ridge, blooming
    float sun = exp(-pow((h - 0.455) * 7.5, 2.0))
              * exp(-pow((uv.x - 0.66) * 2.1, 2.0));
    col += vec3(0.98, 0.54, 0.27) * sun * 0.55;

    // --- hills, two depths -------------------------------------------------
    float hFar  = 0.405 + ridge((uv.x + t * 0.011 * sp + ca * 0.0010) * 1.6, 0.0, 0.055);
    col = mix(col, vec3(0.145, 0.160, 0.205), smoothstep(hFar + 0.004, hFar - 0.004, h) * 0.85);

    float hNear = 0.368 + ridge((uv.x + t * 0.042 * sp + ca * 0.0024) * 2.6, 2.4, 0.042);
    col = mix(col, vec3(0.072, 0.080, 0.104), smoothstep(hNear + 0.003, hNear - 0.003, h));

    // --- ground ------------------------------------------------------------
    // Drawn before the poles so they can stand on it rather than be clipped
    // by it. GROUND is also where every pole's base sits.
    const float GROUND = 0.262;
    float ground = smoothstep(GROUND, GROUND - 0.012, h);
    col = mix(col, vec3(0.045, 0.041, 0.048), ground);

    // --- roadside poles, smeared by speed ----------------------------------
    // Eight taps across a blur width that grows with uSpeed: at pace they are
    // streaks, and as the van slows they resolve into objects. Thin and
    // frequent, so they read as telephone poles going past rather than slabs.
    float blur = 0.002 + sp * 0.040;
    float poles = 0.0;
    for (int i = 0; i < 8; i++) {
      float o = (float(i) / 7.0 - 0.5) * blur;
      float x = (uv.x + o) * 7.0 + t * 1.35 * sp + ca * 0.004;
      float cell = floor(x);
      float f = fract(x);
      float r = hash21(vec2(cell, 7.0));
      // Skip roughly a third of the cells, or the spacing is metronomic.
      float present = step(0.34, hash21(vec2(cell, 19.0)));
      float w = 0.010 + r * 0.012;
      float top = GROUND + 0.085 + r * 0.115;
      poles += present * step(abs(f - 0.5), w) * step(h, top) * step(GROUND - 0.03, h);
    }
    col = mix(col, vec3(0.028, 0.030, 0.040), (poles / 8.0) * 0.95);

    // passing light smears on the road surface
    float sm = 0.0;
    for (int i = 0; i < 4; i++) {
      float o = (float(i) / 3.0 - 0.5) * (0.04 + sp * 0.30);
      float x = (uv.x + o) * 1.7 + t * 1.15 * sp;
      float r = hash21(vec2(floor(x), 3.0));
      sm += step(0.90, r) * smoothstep(0.5, 0.0, abs(fract(x) - 0.5));
    }
    col += vec3(0.95, 0.60, 0.32) * (sm / 4.0) * ground * 0.26;

    return col;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;

    // a little head movement, and the view drifts with it
    uv += uPointer * vec2(0.010, 0.006);

    // --- chromatic fringe, strongest at the edges ---------------------------
    vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
    float edge = clamp(dot(c, c) * 1.25, 0.0, 1.0);
    float ca = edge * (0.4 + uSpeed * 1.6);

    vec3 col = vec3(
      view(uv,  ca).r,
      view(uv, 0.0).g,
      view(uv, -ca).b
    );

    // --- the glass ----------------------------------------------------------
    // Rain flecks drifting back and down, a few of them streaking.
    vec2 gp = uv * vec2(aspect, 1.0) * 17.0;
    vec2 gi = floor(gp);
    vec2 gf = fract(gp);
    float rh = hash21(gi);
    vec2 off = vec2(hash21(gi + 1.3), hash21(gi + 2.7));
    float drift = fract(off.y + uTime * (0.02 + uSpeed * 0.06) * (0.4 + rh));
    // Stretched along y and smeared harder with speed, so a fleck reads as a
    // streak on glass rather than as a snowflake in the air.
    vec2 dp = (gf - vec2(off.x, drift)) * vec2(2.6, 0.5 + uSpeed * 1.1);
    float drop = smoothstep(0.070 * (0.3 + rh), 0.0, length(dp));
    col += vec3(0.72, 0.80, 0.88) * drop * step(0.93, rh) * 0.13;

    // a breath of condensation toward the corners
    float fog = smoothstep(0.35, 1.0, edge) * 0.05;
    col = mix(col, vec3(0.70, 0.74, 0.78), fog);

    // --- the window frame ----------------------------------------------------
    // A rounded-rect SDF. uOpen pushes it past the viewport on handover, so the
    // van interior slides away rather than cutting.
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    // The window has to work in both orientations: on a phone a fixed height
    // leaves most of the screen as van interior.
    float tall = 1.0 - smoothstep(0.62, 1.35, aspect);
    vec2 ext0 = vec2(0.44 * aspect, mix(0.345, 0.455, tall));
    vec2 ext = mix(ext0, vec2(aspect, 1.0) * 1.6, uOpen);
    float rad = mix(0.085, 0.0, uOpen);
    vec2 d = abs(p) - (ext - rad);
    float sdf = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - rad;
    float window = smoothstep(0.016, -0.016, sdf);

    // the van interior: near black, with the phone glow low and warm
    vec3 inside = vec3(0.026, 0.022, 0.021);
    float phone = exp(-length((vUv - vec2(0.72, 0.09)) * vec2(1.5, 2.3)) * 3.0);
    inside += vec3(0.98, 0.64, 0.34) * phone * 0.42;
    // and the sill catching a little of it
    inside += vec3(0.95, 0.60, 0.34) * smoothstep(0.02, -0.06, sdf) * 0.07;

    col = mix(inside, col, window);

    // --- grade ---------------------------------------------------------------
    col *= uExposure;

    // vignette
    col *= 1.0 - smoothstep(0.30, 1.25, dot(c, c)) * 0.55;

    // film grain, finer at rest
    float g = hash21(gl_FragCoord.xy + fract(uTime) * 311.0);
    col += (g - 0.5) * 0.045;

    col *= uFade;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * Build the scene. Returns null when WebGL is unavailable, which leaves the
 * static CSS composition in place — the prologue is still complete without it.
 */
export function createVanWindow(canvas) {
  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: false,      // nothing here has hard geometric edges
      alpha: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;

  // 1.5 is the point past which this shader costs more than it shows.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new PlaneGeometry(2, 2);

  const uniforms = {
    uRes:      { value: new Vector2(1, 1) },
    uTime:     { value: 0 },
    uSpeed:    { value: 1 },
    uExposure: { value: 1 },
    uOpen:     { value: 0 },
    uFade:     { value: 1 },
    uPointer:  { value: new Vector2(0, 0) },
  };

  const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const clock = new Clock();
  let raf = 0;
  let running = false;
  let lost = false;

  // A lost context would otherwise leave a black rectangle where the prologue
  // was, with no way back.
  const onLost = (e) => { e.preventDefault(); lost = true; stop(); };
  canvas.addEventListener('webglcontextlost', onLost);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w * dpr, h * dpr);
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    uniforms.uTime.value = clock.getElapsedTime();
    // ease the head movement rather than tracking the cursor exactly
    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    uniforms.uPointer.value.set(pointer.x, pointer.y);
    renderer.render(scene, camera);
  }

  function start() {
    if (running || lost) return;
    running = true;
    clock.start();
    frame();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  resize();
  // Draw one frame immediately so the canvas is never a black flash before
  // the first animation frame arrives.
  renderer.render(scene, camera);

  return {
    uniforms,
    start,
    stop,
    resize,

    /** Release everything. Called once the visitor is in the story. */
    dispose() {
      stop();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('webglcontextlost', onLost);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      // Without this the GPU can hold the context alive for the rest of the
      // visit, which is exactly what we are trying to avoid.
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}
