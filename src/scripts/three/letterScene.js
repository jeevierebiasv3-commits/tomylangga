/* ============================================================================
   three/letterScene.js — the letter's intro scene
   ----------------------------------------------------------------------------
   A sealed envelope floating in the dark among drifting hearts and warm dust.
   One number drives the whole thing — `state.progress`, 0 → 1, scrubbed by
   motion/letterIntro.js from the pinned scroll:

     0.00 – 0.30   the envelope comes forward out of the dark and turns to face us
     0.28 – 0.40   the heart seal pops
     0.36 – 0.58   the flap swings open; a warm light spills out of it
     0.55 – 0.78   the letter slides out
     0.76 – 1.00   the camera pushes into the paper

   `state.exposure` is the shared light level, so the typography timeline can
   brighten the scene as the words land (the same coupling as the prologue).

   Everything is built from primitives and canvas textures — nothing to
   download beyond the three.js runtime.
   ========================================================================= */

import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Shape, ShapeGeometry,
  ExtrudeGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial,
  InstancedMesh, Object3D, Color, Fog, AmbientLight, PointLight, BufferGeometry,
  Float32BufferAttribute, Points, PointsMaterial, CanvasTexture, AdditiveBlending,
  DoubleSide, MathUtils, SRGBColorSpace, ACESFilmicToneMapping,
} from 'three';

const BG = '#100C10';           // the letter's night — the handover colour
const PAPER = '#E6D4BD';
const FLAP = '#F3E7D6';      // a shade lighter, so the folds read
const PAPER_IN = '#D9C6AE';
const ROSE = '#C9444F';

const W = 3.2;                  // envelope width
const H = 2.1;                  // envelope height

const smooth = (a, b, v) => MathUtils.smoothstep(v, a, b);

function heartShape(s = 1) {
  // The classic two-lobe bezier heart, point down, centred on its bounds.
  const h = new Shape();
  h.moveTo(0, -0.9 * s);
  h.bezierCurveTo(-0.15 * s, -0.75 * s, -1 * s, -0.25 * s, -1 * s, 0.25 * s);
  h.bezierCurveTo(-1 * s, 0.75 * s, -0.45 * s, 1 * s, 0, 0.55 * s);
  h.bezierCurveTo(0.45 * s, 1 * s, 1 * s, 0.75 * s, 1 * s, 0.25 * s);
  h.bezierCurveTo(1 * s, -0.25 * s, 0.15 * s, -0.75 * s, 0, -0.9 * s);
  return h;
}

/** The letter itself, painted once the display face has loaded. */
function paperTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 680;
  const x = c.getContext('2d');
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;

  const paint = () => {
    x.fillStyle = '#FFFBF4';
    x.fillRect(0, 0, c.width, c.height);
    // a faint deckle of warmth toward the edges
    const g = x.createRadialGradient(512, 340, 120, 512, 340, 640);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(210,180,150,.35)');
    x.fillStyle = g;
    x.fillRect(0, 0, c.width, c.height);

    x.fillStyle = '#2B1B1F';
    x.font = 'italic 84px "Instrument Serif", "Fraunces Variable", Georgia, serif';
    x.fillText('Para sa akong langga,', 84, 168);

    // the body: handwriting, abstracted to soft ink strokes
    x.strokeStyle = 'rgba(43,27,31,.32)';
    x.lineCap = 'round';
    x.lineWidth = 5;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let row = 0; row < 7; row++) {
      const y = 250 + row * 52;
      let px = 84;
      const end = row === 6 ? 520 : 940 - rnd() * 80;
      x.beginPath();
      x.moveTo(px, y);
      while (px < end) {
        const len = 30 + rnd() * 70;
        x.lineTo(Math.min(px + len, end), y + (rnd() - 0.5) * 6);
        px += len + 14;
        x.moveTo(px, y + (rnd() - 0.5) * 4);
      }
      x.stroke();
    }

    x.fillStyle = '#B83E4A';
    x.font = 'italic 64px "Instrument Serif", "Fraunces Variable", Georgia, serif';
    x.textAlign = 'right';
    x.fillText('— Jeevie', 940, 630);
    x.textAlign = 'left';
    tex.needsUpdate = true;
  };

  paint();
  document.fonts?.load('italic 84px "Instrument Serif"').then(paint).catch(() => {});
  return tex;
}

/** A soft round sprite for the dust. */
function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * Build the scene against a shared `state` ({ progress, exposure }).
 * Returns null when WebGL is unavailable — the CSS still stands in.
 */
export function createLetterScene(canvas, state) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;

  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;

  const scene = new Scene();
  scene.background = new Color(BG);
  scene.fog = new Fog(BG, 7, 22);

  const camera = new PerspectiveCamera(35, 1, 0.05, 60);
  camera.position.set(0, 0, 9);

  /* --- light ------------------------------------------------------------- */
  scene.add(new AmbientLight('#FFE6D2', 0.55));
  const key = new PointLight('#F2B47E', 60, 30, 2);
  key.position.set(3, 4, 6);
  scene.add(key);
  const rim = new PointLight('#EE8A86', 40, 30, 2);
  rim.position.set(-5, -2, -1);
  scene.add(rim);

  /* --- the envelope -------------------------------------------------------- */
  const env = new Group();
  scene.add(env);

  const paperMat = new MeshStandardMaterial({ color: PAPER, roughness: 0.92, metalness: 0, side: DoubleSide });
  const innerMat = new MeshStandardMaterial({ color: PAPER_IN, roughness: 0.95, side: DoubleSide });

  // back panel
  const back = new Mesh(new PlaneGeometry(W, H), innerMat);
  env.add(back);

  // the letter, tucked between the back and the front pocket
  const letterTex = paperTexture();
  const letter = new Mesh(
    new PlaneGeometry(W * 0.9, H * 0.86),
    new MeshStandardMaterial({ map: letterTex, roughness: 0.85, side: DoubleSide }),
  );
  letter.position.z = 0.012;
  env.add(letter);

  // front pocket: a rectangle with the V cut out of the top
  const pocket = new Shape();
  pocket.moveTo(-W / 2, -H / 2);
  pocket.lineTo(W / 2, -H / 2);
  pocket.lineTo(W / 2, H / 2);
  pocket.lineTo(0, -H * 0.04);
  pocket.lineTo(-W / 2, H / 2);
  pocket.closePath();
  const front = new Mesh(new ShapeGeometry(pocket), paperMat);
  front.position.z = 0.03;
  env.add(front);

  // the flap, hinged along the top edge
  const flapPivot = new Group();
  flapPivot.position.set(0, H / 2, 0.035);
  env.add(flapPivot);
  const flapShape = new Shape();
  flapShape.moveTo(-W / 2, 0);
  flapShape.lineTo(W / 2, 0);
  flapShape.lineTo(0, -H * 0.58);
  flapShape.closePath();
  const flap = new Mesh(new ShapeGeometry(flapShape), new MeshStandardMaterial({ color: FLAP, roughness: 0.9, side: DoubleSide }));
  flapPivot.add(flap);

  // the wax seal: a heart, on the tip of the flap
  const seal = new Mesh(
    new ExtrudeGeometry(heartShape(0.2), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 18 }),
    new MeshStandardMaterial({ color: ROSE, roughness: 0.32, metalness: 0.15 }),
  );
  seal.position.set(0, -H * 0.5, 0.01);
  flapPivot.add(seal);

  // the light that spills out as it opens
  const glow = new PointLight('#FFC58F', 0, 6, 2);
  glow.position.set(0, H * 0.35, 0.6);
  env.add(glow);

  /* --- drifting hearts ------------------------------------------------------ */
  const COUNT = 150;
  const hearts = new InstancedMesh(
    new ShapeGeometry(heartShape(1), 10),
    new MeshBasicMaterial({ transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false }),
    COUNT,
  );
  const palette = ['#EE8A86', '#C9444F', '#E8B07A', '#F4EAE5', '#D9A5A0'].map((c) => new Color(c));
  const dummy = new Object3D();
  const motes = Array.from({ length: COUNT }, (_, i) => {
    const m = {
      x: MathUtils.randFloatSpread(20),
      y: MathUtils.randFloatSpread(13),
      z: MathUtils.randFloat(-16, 3),
      s: MathUtils.randFloat(0.05, 0.16),
      v: MathUtils.randFloat(0.12, 0.45),
      rx: Math.random() * Math.PI, ry: Math.random() * Math.PI,
      sx: MathUtils.randFloatSpread(1.2), sy: MathUtils.randFloatSpread(1.6),
      ph: Math.random() * Math.PI * 2,
    };
    hearts.setColorAt(i, palette[i % palette.length]);
    return m;
  });
  scene.add(hearts);

  /* --- warm dust -------------------------------------------------------------- */
  const DUST = 900;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = MathUtils.randFloatSpread(24);
    dustPos[i * 3 + 1] = MathUtils.randFloatSpread(15);
    dustPos[i * 3 + 2] = MathUtils.randFloat(-18, 4);
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new Float32BufferAttribute(dustPos, 3));
  const dust = new Points(dustGeo, new PointsMaterial({
    map: dotTexture(), color: '#F2B47E', size: 0.07, transparent: true, opacity: 0.7,
    blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(dust);

  /* --- pointer --------------------------------------------------------------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  /* --- frame ------------------------------------------------------------------ */
  // A tiny clock of our own (THREE.Clock is deprecated).
  const clock = {
    last: performance.now(), elapsedTime: 0,
    getDelta() {
      const now = performance.now();
      const d = (now - this.last) / 1000;
      this.last = now;
      this.elapsedTime += d;
      return d;
    },
  };
  let raf = 0;
  let running = false;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the envelope comfortably in frame on tall phone screens.
    camera.fov = camera.aspect < 0.8 ? 52 : 35;
    camera.updateProjectionMatrix();
  }

  function render() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const p = state.progress;

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    const come = smooth(0, 0.3, p);
    const pop = smooth(0.28, 0.4, p);
    const open = smooth(0.36, 0.58, p);
    const slide = smooth(0.55, 0.78, p);
    const dolly = smooth(0.76, 1, p);
    const bob = 1 - come * 0.7;

    // the envelope comes forward and squares up to us
    env.position.set(0, MathUtils.lerp(-0.55, -0.35, come) + Math.sin(t * 0.9) * 0.08 * bob - slide * 0.5, MathUtils.lerp(-5.5, 0, come));
    env.rotation.set(
      MathUtils.lerp(-0.42, 0, come) + Math.sin(t * 0.7) * 0.05 * bob - pointer.y * 0.12 * (1 - dolly),
      MathUtils.lerp(0.62, 0, come) + Math.sin(t * 0.5) * 0.06 * bob + pointer.x * 0.18 * (1 - dolly),
      MathUtils.lerp(0.16, 0, come),
    );

    // the seal swells, then is gone
    const ss = pop < 0.5 ? 1 + pop * 0.6 : (1 - pop) * 2.6;
    seal.scale.setScalar(Math.max(0.0001, ss));
    seal.rotation.z = pop * 1.4;

    // Swings out toward us, up, and a little past upright so it ends tipped
    // back behind the envelope — clear of the letter rising out of it.
    flapPivot.rotation.x = -Math.PI * 1.06 * open;
    glow.intensity = open * 14 * (1 - dolly * 0.6);

    letter.position.y = slide * H * 0.7;
    letter.position.z = 0.012 + slide * 0.06 + dolly * 0.25;

    // the camera pushes into the paper
    const ly = env.position.y + letter.position.y;
    camera.position.set(
      pointer.x * 0.35 * (1 - dolly),
      MathUtils.lerp(-pointer.y * 0.2, ly, dolly),
      MathUtils.lerp(9, env.position.z + letter.position.z + 0.9, dolly),
    );
    camera.lookAt(0, MathUtils.lerp(0, ly, dolly), env.position.z);

    // hearts drift up; during the push they stream past
    const rush = dolly * 9;
    for (let i = 0; i < COUNT; i++) {
      const m = motes[i];
      m.y += m.v * dt;
      if (m.y > 7) m.y = -7;
      m.z += rush * dt;
      if (m.z > 5) m.z = -16;
      dummy.position.set(m.x + Math.sin(t * 0.4 + m.ph) * 0.4, m.y, m.z);
      dummy.rotation.set(m.rx + t * m.sx, m.ry + t * m.sy, Math.sin(t + m.ph) * 0.4);
      dummy.scale.setScalar(m.s);
      dummy.updateMatrix();
      hearts.setMatrixAt(i, dummy.matrix);
    }
    hearts.instanceMatrix.needsUpdate = true;
    dust.rotation.y = t * 0.012;
    dust.position.z = (dust.position.z + rush * dt * 0.6) % 6;

    renderer.toneMappingExposure = state.exposure;
    renderer.render(scene, camera);
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    render();
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  resize();
  render();

  return {
    start() {
      if (running) return;
      running = true;
      clock.getDelta();
      loop();
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    resize,
  };
}
