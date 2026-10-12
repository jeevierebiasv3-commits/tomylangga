/* ============================================================================
   three/roomLens.js — the gallery's glass
   ----------------------------------------------------------------------------
   One fixed WebGL canvas sits behind the room. Every plate that is on (or
   near) screen gets a plane in it, pinned each frame to the DOM frame it
   stands in for — so layout, ScrollSmoother's drift and the hover lift are
   all still owned by the document, and the canvas only paints.

   What the shader adds that CSS cannot:

     - the reveal: a wavy wipe up the frame while the photo settles from a
       deep zoom and comes up out of monochrome
     - scroll velocity: frames bow against the direction of travel and split
       their colour channels a little, so a fast scroll reads as momentum
     - depth: the image drifts inside its frame with its position on screen
     - hover: a slow ripple out from the pointer and a gentle push in

   The DOM images stay in place (invisible) for lazy loading, the lightbox and
   assistive tech. Clips swap their poster for a live VideoTexture while they
   are in view — motion/room.js owns the <video> elements and hands them over.

   The interface is the `entries` array, one per plate:
     { el, img, state: { reveal, hover, mx, my } }
   ========================================================================= */

import {
  WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, ShaderMaterial,
  Mesh, Texture, VideoTexture, Vector2, LinearFilter,
} from 'three';

const vertexShader = /* glsl */ `
  uniform float uVel;      // smoothed scroll velocity, px per frame-ish
  uniform float uHover;
  varying vec2 vUv;

  #define PI 3.14159265

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    // Bow the frame against the direction of travel: the middle lags, the
    // edges lead, like a print on a line caught in a draught.
    world.y -= sin(uv.x * PI) * uVel;
    world.x += sin(uv.y * PI) * uVel * 0.08;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTex;
  uniform vec2  uRes;       // frame size in px
  uniform vec2  uImg;       // source size in px
  uniform float uLoaded;    // 0 → 1 once a texture is bound
  uniform float uReveal;    // 0 → 1
  uniform float uHover;     // 0 → 1
  uniform vec2  uMouse;     // 0..1 inside the frame
  uniform float uVel;
  uniform float uDepth;     // -1..1, frame's position on screen
  uniform float uTime;

  varying vec2 vUv;

  vec2 cover(vec2 uv) {
    float rp = uRes.x / uRes.y;
    float ri = uImg.x / uImg.y;
    vec2 s = rp > ri ? vec2(1.0, ri / rp) : vec2(rp / ri, 1.0);
    return (uv - 0.5) * s + 0.5;
  }

  void main() {
    // --- the wipe: up from the bottom with a slow wave on its edge -----------
    float wave = sin(vUv.x * 5.0 + uTime * 1.4) * 0.045
               + sin(vUv.x * 11.0 - uTime * 0.9) * 0.02;
    float p = mix(-0.12, 1.32, uReveal);
    float mask = 1.0 - smoothstep(p - 0.16, p, vUv.y + wave * (1.0 - uReveal));
    if (mask <= 0.001) discard;

    // --- where in the photo we sample ----------------------------------------
    float settle = 1.0 - uReveal;
    float zoom = 1.1 + settle * settle * 0.42 + uHover * 0.06;
    vec2 uv = (vUv - 0.5) / zoom + 0.5;
    uv.y += uDepth * 0.04;                       // depth inside the frame

    // hover ripple from the pointer
    vec2 d = vUv - uMouse;
    float dist = length(d * vec2(uRes.x / uRes.y, 1.0));
    float ring = sin(dist * 26.0 - uTime * 4.0) * smoothstep(0.55, 0.0, dist);
    uv += normalize(d + 1e-5) * ring * 0.006 * uHover;

    uv = cover(uv);

    // channel split with speed (and a breath of it during the reveal)
    float shift = clamp(uVel * 0.0002, -0.014, 0.014) + settle * 0.006;
    vec3 col;
    col.r = texture2D(uTex, uv + vec2(0.0, shift)).r;
    col.g = texture2D(uTex, uv).g;
    col.b = texture2D(uTex, uv - vec2(0.0, shift)).b;

    // up out of monochrome, slightly warm, as it settles
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 mono = vec3(lum) * vec3(1.04, 0.98, 0.92);
    col = mix(mono, col, smoothstep(0.25, 0.95, uReveal));

    // the paper colour stands in until the photo has decoded
    col = mix(vec3(0.906, 0.875, 0.831), col, uLoaded);

    // a faint ember bleed along the leading edge of the wipe
    float edge = smoothstep(p - 0.16, p - 0.02, vUv.y + wave) * mask * settle;
    col = mix(col, vec3(0.784, 0.333, 0.239), edge * 0.6);

    gl_FragColor = vec4(col * mask, mask);
  }
`;

export function createRoomLens(entries) {
  const canvas = document.createElement('canvas');
  canvas.className = 'room-lens';
  canvas.setAttribute('aria-hidden', 'true');

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  document.body.prepend(canvas);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const geometry = new PlaneGeometry(1, 1, 24, 24);

  let vw = 0, vh = 0;
  const resize = () => {
    vw = innerWidth; vh = innerHeight;
    renderer.setSize(vw, vh, false);
    camera.left = -vw / 2; camera.right = vw / 2;
    camera.top = vh / 2;   camera.bottom = -vh / 2;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);

  /* --- one plane per plate, built the first time it comes near the screen -- */
  const planes = new Array(entries.length).fill(null);
  const visible = new Set();

  // Decoded to an ImageBitmap rather than handing three the <img>: three
  // sizes a texture from an element's `width`, which for an in-page image is
  // its rendered CSS width, not its pixels — the upload then overflows and
  // the plate samples black.
  const bindImage = async (plane, img) => {
    let bitmap;
    try { bitmap = await createImageBitmap(img, { imageOrientation: 'flipY' }); }
    catch { return; }
    const tex = new Texture(bitmap);
    tex.flipY = false;               // already flipped at decode
    tex.minFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    plane.imageTex = tex;
    if (!plane.video) setTexture(plane, tex, bitmap.width, bitmap.height);
  };

  const setTexture = (plane, tex, w, h) => {
    const u = plane.mesh.material.uniforms;
    u.uTex.value = tex;
    u.uImg.value.set(w || 1, h || 1);
    u.uLoaded.value = 1;
  };

  const planeFor = (i) => {
    if (planes[i]) return planes[i];
    const material = new ShaderMaterial({
      vertexShader, fragmentShader, transparent: true,
      uniforms: {
        uTex: { value: null }, uRes: { value: new Vector2(1, 1) }, uImg: { value: new Vector2(1, 1) },
        uLoaded: { value: 0 }, uReveal: { value: 0 }, uHover: { value: 0 },
        uMouse: { value: new Vector2(0.5, 0.5) }, uVel: { value: 0 },
        uDepth: { value: 0 }, uTime: { value: 0 },
      },
    });
    const mesh = new Mesh(geometry, material);
    mesh.visible = false;
    scene.add(mesh);
    const plane = { mesh, imageTex: null, video: null, videoTex: null };
    planes[i] = plane;

    const { img } = entries[i];
    if (img) {
      if (img.complete && img.naturalWidth > 0) bindImage(plane, img);
      else img.addEventListener('load', () => bindImage(plane, img), { once: true });
    }
    return plane;
  };

  const io = new IntersectionObserver((records) => {
    for (const r of records) {
      const i = Number(r.target.dataset.lensIndex);
      if (r.isIntersecting) { planeFor(i); visible.add(i); }
      else { visible.delete(i); if (planes[i]) planes[i].mesh.visible = false; }
    }
  }, { rootMargin: '30% 0px 30% 0px' });

  entries.forEach((e, i) => { e.el.dataset.lensIndex = String(i); io.observe(e.el); });

  /* --- the frame loop ------------------------------------------------------ */
  let vel = 0;
  const start = performance.now();

  function render(scrollDelta) {
    // Ease toward the target so a flick swells and settles rather than snaps.
    vel += (Math.max(-45, Math.min(45, scrollDelta * 1.1)) - vel) * 0.12;
    const t = (performance.now() - start) / 1000;

    for (const i of visible) {
      const plane = planes[i];
      const { el, state } = entries[i];
      const r = el.getBoundingClientRect();
      const m = plane.mesh;

      if (r.width === 0 || r.bottom < -vh * 0.2 || r.top > vh * 1.2) { m.visible = false; continue; }
      m.visible = true;
      m.scale.set(r.width, r.height, 1);
      m.position.set(r.left + r.width / 2 - vw / 2, vh / 2 - (r.top + r.height / 2), 0);

      const u = m.material.uniforms;
      u.uRes.value.set(r.width, r.height);
      u.uReveal.value = state.reveal;
      u.uHover.value = state.hover;
      u.uMouse.value.set(state.mx, state.my);
      u.uVel.value = vel;
      u.uDepth.value = Math.max(-1, Math.min(1, ((r.top + r.height / 2) / vh - 0.5) * 2));
      u.uTime.value = t;
    }

    renderer.render(scene, camera);
  }

  /** Swap a clip's poster for live video while it plays, and back. */
  function setVideo(i, video) {
    const plane = planeFor(i);
    if (plane.videoTex) { plane.videoTex.dispose(); plane.videoTex = null; }
    plane.video = video;
    if (video) {
      const vt = new VideoTexture(video);
      vt.minFilter = LinearFilter;
      plane.videoTex = vt;
      setTexture(plane, vt, video.videoWidth, video.videoHeight);
    } else if (plane.imageTex) {
      const { width, height } = plane.imageTex.image;
      setTexture(plane, plane.imageTex, width, height);
    } else {
      plane.mesh.material.uniforms.uLoaded.value = 0;
    }
  }

  function destroy() {
    io.disconnect();
    removeEventListener('resize', resize);
    for (const p of planes) {
      if (!p) continue;
      p.mesh.material.dispose();
      p.imageTex?.image.close?.();
      p.imageTex?.dispose();
      p.videoTex?.dispose();
    }
    geometry.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return { render, setVideo, destroy, canvas };
}
