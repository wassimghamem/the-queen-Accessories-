/* =====================================================================
   Jewel 3D engine — The Queen Accessories
   Plain ES modules, no import map, no post-processing (bloom made gems
   render black/blown-out). Transparent canvas over the page design.
   ===================================================================== */
import * as THREE from '../assets/vendor/three/three.module.js';
import { OrbitControls } from '../assets/vendor/three/jsm/controls/OrbitControls.js';

export const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

export const METALS = {
  silver: { color: 0xe4e7ec, roughness: 0.12 },
  gold:   { color: 0xf0c57a, roughness: 0.16 },
  rose:   { color: 0xeeb39f, roughness: 0.16 },
};

/* ---------- shared geometry & textures ---------- */
const GEO = {};
function gemGeo(seg = 12) {
  const key = 'gem' + seg;
  if (!GEO[key]) {
    // brilliant-cut profile: culet → pavilion → girdle → crown → table
    const p = [[0.0, -0.62], [1.0, 0.0], [1.0, 0.06], [0.6, 0.34], [0.0, 0.34]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    GEO[key] = new THREE.LatheGeometry(p, seg);
  }
  return GEO[key];
}
function sphereGeo() { return GEO.sph || (GEO.sph = new THREE.SphereGeometry(1, 40, 28)); }

let SPARKLE_TEX = null;
function sparkleTexture() {
  if (SPARKLE_TEX) return SPARKLE_TEX;
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.18, 'rgba(255,255,255,.75)');
  rg.addColorStop(0.45, 'rgba(220,215,255,.12)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'lighter';
  [[s, 3], [3, s]].forEach(([w, h]) => {
    const lg = g.createLinearGradient(w > h ? 0 : s / 2, w > h ? s / 2 : 0, w > h ? s : s / 2, w > h ? s / 2 : s);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,.9)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect((s - w) / 2, (s - h) / 2, w, h);
  });
  SPARKLE_TEX = new THREE.CanvasTexture(c); SPARKLE_TEX.colorSpace = THREE.SRGBColorSpace;
  return SPARKLE_TEX;
}
/* Bright "jewellery studio" environment: light sweep + softbox strips.
   Gives polished-silver reflections and crisp facet contrast on gems. */
function studioEnvTexture() {
  const w = 1024, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.42, '#eceaf2'); bg.addColorStop(0.5, '#9d98ad');
  bg.addColorStop(0.62, '#d9d4e6'); bg.addColorStop(1, '#bfb8d0');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // dark flags for contrast (what makes facets "read")
  g.fillStyle = 'rgba(40,36,56,.85)';
  [[60, 150, 70, 210], [520, 140, 60, 230], [830, 170, 50, 190], [300, 300, 90, 160], [720, 310, 80, 150], [0, 400, 1024, 30]]
    .forEach(([x, y, ww, hh]) => g.fillRect(x, y, ww, hh));
  // softboxes
  g.fillStyle = '#ffffff';
  [[200, 90, 130, 260], [380, 40, 40, 300], [640, 110, 150, 220], [930, 60, 50, 280]].forEach(([x, y, ww, hh]) => {
    g.shadowColor = '#ffffff'; g.shadowBlur = 30; g.fillRect(x, y, ww, hh);
  });
  g.shadowBlur = 0;
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let SHADOW_TEX = null;
function shadowTexture() {
  if (SHADOW_TEX) return SHADOW_TEX;
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  rg.addColorStop(0, 'rgba(200,188,255,.55)'); rg.addColorStop(0.45, 'rgba(170,150,255,.16)'); rg.addColorStop(1, 'rgba(170,150,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, s, s);
  SHADOW_TEX = new THREE.CanvasTexture(c);
  return SHADOW_TEX;
}

/* ---------- part builders (ctx carries materials + gem list) ---------- */
function gem(ctx, r, w = 1, h = 1, seg = 12) {
  const m = new THREE.Mesh(gemGeo(seg), ctx.gemMat);
  m.rotation.x = Math.PI / 2;          // table faces the viewer (+Z)
  m.scale.set(r * w, r, r * h);        // w = width (X), h = height (Y)
  ctx.gems.push(m);
  return m;
}
function ball(ctx, r) { const m = new THREE.Mesh(sphereGeo(), ctx.metalMat); m.scale.setScalar(r); return m; }
function bezel(ctx, r) {
  return new THREE.Mesh(new THREE.TorusGeometry(r * 1.04, r * 0.13, 14, 48), ctx.metalMat);
}
function backDisc(ctx, r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.25, 40), ctx.metalMat);
  m.rotation.x = Math.PI / 2; m.position.z = -r * 0.35; return m;
}
function solitaire(ctx, r) {
  const g = new THREE.Group();
  g.add(gem(ctx, r, 1, 1, 16));
  g.add(bezel(ctx, r));
  g.add(backDisc(ctx, r * 0.85));
  return g;
}
function prongStud(ctx, r) {
  const g = new THREE.Group();
  g.add(gem(ctx, r, 1, 1, 16));
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6;
    const p = ball(ctx, r * 0.13); p.position.set(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, r * 0.12); g.add(p);
  }
  g.add(backDisc(ctx, r * 0.7));
  return g;
}
function star(ctx, s = 1) {
  const g = new THREE.Group();
  g.add(gem(ctx, 0.3 * s, 1, 1, 16));
  g.add(bezel(ctx, 0.3 * s));
  for (let i = 0; i < 6; i++) {
    const petal = new THREE.Group(); petal.rotation.z = i / 6 * Math.PI * 2;
    const m = gem(ctx, 0.36 * s, 0.42, 1, 10); m.position.y = 0.66 * s; petal.add(m);
    const tip = ball(ctx, 0.045 * s); tip.position.set(0, 1.0 * s, 0.03 * s); petal.add(tip);
    const mini = gem(ctx, 0.085 * s, 1, 1, 8); mini.position.set(Math.sin(Math.PI / 6) * 0.5 * s, Math.cos(Math.PI / 6) * 0.5 * s, 0.02 * s);
    petal.add(mini);
    g.add(petal);
  }
  g.add(backDisc(ctx, 0.42 * s));
  return g;
}
function ringMesh(ctx, R, tube, arc = Math.PI * 2) {
  return new THREE.Mesh(new THREE.TorusGeometry(R, tube, 24, 120, arc), ctx.metalMat);
}

/* ---------- models ---------- */
const MODELS = {
  star(ctx) { return star(ctx, 1); },

  starDuo(ctx) {
    const g = new THREE.Group();
    const a = star(ctx, 0.95); a.position.set(-0.85, 0.25, 0); g.add(a);
    const b = star(ctx, 0.72); b.position.set(0.95, -0.35, 0.1); b.rotation.z = 0.4; g.add(b);
    return g;
  },

  roundStar(ctx) {
    const g = new THREE.Group();
    const a = prongStud(ctx, 0.62); a.position.set(-0.85, 0.15, 0); g.add(a);
    const b = star(ctx, 0.62); b.position.set(0.9, -0.15, 0); g.add(b);
    return g;
  },

  leafCuff(ctx) {
    const g = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.9, -0.55, 0), new THREE.Vector3(-0.8, -0.05, 0.15),
      new THREE.Vector3(0.4, 0.3, 0.15), new THREE.Vector3(1.9, 0.6, 0)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.045, 10, false), ctx.metalMat));
    const n = 11;
    for (let i = 0; i < n; i++) {
      const t = 0.04 + i / (n - 1) * 0.92;
      const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
      const ang = Math.atan2(tan.y, tan.x);
      [1, -1].forEach(side => {
        if (i === n - 1 && side === -1) return;
        const leaf = new THREE.Group();
        leaf.position.copy(p); leaf.rotation.z = ang + side * (Math.PI / 2 - 0.65) - (side > 0 ? 0 : Math.PI);
        const m = gem(ctx, 0.34, 0.42, 1, 10); m.position.y = 0.32; leaf.add(m);
        g.add(leaf);
      });
      const r = gem(ctx, 0.075, 1, 1, 8); r.position.copy(p); r.position.z += 0.05; g.add(r);
    }
    return g;
  },

  captive(ctx) {
    const g = new THREE.Group();
    g.add(ringMesh(ctx, 1.1, 0.1));
    const b = ball(ctx, 0.27); b.position.set(-Math.cos(0.5) * 1.1, Math.sin(0.5) * 1.1, 0); g.add(b);
    g.rotation.y = 0.35;
    return g;
  },

  hoop(ctx) {
    const g = new THREE.Group();
    g.add(ringMesh(ctx, 1.1, 0.09, Math.PI * 1.9));
    g.children[0].rotation.z = Math.PI / 2 + 0.16;
    g.rotation.y = 0.35;
    return g;
  },

  septum(ctx) { return horseshoe(ctx, true); },
  smiley(ctx) { return horseshoe(ctx, false); },

  industrial(ctx) { return straightBar(ctx, 3.4, 0.07, 0.24, false); },
  tongue(ctx) { return straightBar(ctx, 1.6, 0.1, 0.36, true); },

  curved(ctx) {
    const g = new THREE.Group(), R = 1.7, span = 1.2;
    const arc = ringMesh(ctx, R, 0.07, span); arc.rotation.z = -span / 2; g.add(arc);
    [-span / 2, span / 2].forEach(a => { const b = ball(ctx, 0.24); b.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); g.add(b); });
    g.children.forEach(c => { c.position.x -= R * 0.86; });
    const outer = new THREE.Group(); outer.add(g); outer.rotation.z = Math.PI / 2 + 0.35;
    return outer;
  },

  dermalDuo(ctx) {
    const g = new THREE.Group();
    const a = solitaire(ctx, 0.48); a.position.set(-0.45, 0.6, 0); g.add(a);
    const b = solitaire(ctx, 0.48); b.position.set(0.45, -0.6, 0); g.add(b);
    return g;
  },

  surface(ctx) {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 20), ctx.metalMat);
    bar.rotation.z = Math.PI / 2; bar.position.z = -0.45; g.add(bar);
    [-0.95, 0.95].forEach(x => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.45, 20), ctx.metalMat);
      post.rotation.x = Math.PI / 2; post.position.set(x, 0, -0.22); g.add(post);
      const b = ball(ctx, 0.33); b.position.set(x, 0, 0.08); g.add(b);
    });
    g.rotation.z = -0.95;
    return g;
  },

  navel(ctx) {
    const g = new THREE.Group();
    const bend = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(0.22, 0.9, -0.25), new THREE.Vector3(0, 0.2, 0)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(bend, 40, 0.06, 12, false), ctx.metalMat));
    const top = ball(ctx, 0.24); top.position.set(0, 1.5, 0); g.add(top);
    const s = star(ctx, 0.7); s.position.set(0, -0.55, 0.05); g.add(s);
    [-0.55, 0, 0.55].forEach((x, i) => { const d = solitaire(ctx, 0.15); d.position.set(x, -1.35 - (i === 1 ? 0.18 : 0), 0); g.add(d); });
    return g;
  },

  huggieDrop(ctx) {
    const g = new THREE.Group();
    const hoop = ringMesh(ctx, 0.48, 0.13); hoop.position.y = 1.2; g.add(hoop);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 1.15 + i / 8 * Math.PI * 0.7;
      const m = gem(ctx, 0.075, 1, 1, 8); m.position.set(Math.cos(a) * 0.48, 1.2 + Math.sin(a) * 0.48, 0.12); g.add(m);
    }
    const link = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 12), ctx.metalMat); link.position.y = -0.05; g.add(link);
    [0.45, -0.15, -0.75].forEach(y => { const d = solitaire(ctx, 0.24); d.position.y = y; g.add(d); });
    return g;
  },
};

function horseshoe(ctx, pendant) {
  const g = new THREE.Group(), R = 1.0, arc = Math.PI * 1.45;
  const start = Math.PI / 2 + (Math.PI * 2 - arc) / 2;
  const t = ringMesh(ctx, R, 0.085, arc); t.rotation.z = start; g.add(t);
  [start, start + arc].forEach(a => { const b = ball(ctx, 0.24); b.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); g.add(b); });
  if (pendant) {
    const p = solitaire(ctx, 0.34); p.position.set(0, -R - 0.32, 0.05); g.add(p);
    [-1, 1].forEach(s => { const b = ball(ctx, 0.17); b.position.set(s * 0.42, -R - 0.05, 0.02); g.add(b); });
  }
  g.rotation.y = 0.3;
  return g;
}
function straightBar(ctx, len, rad, ballR, vertical) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 24), ctx.metalMat);
  g.add(bar);
  [-len / 2, len / 2].forEach(y => { const b = ball(ctx, ballR); b.position.y = y; g.add(b); });
  if (!vertical) g.rotation.z = Math.PI / 2 - 0.35;
  else g.rotation.x = 0.5;
  return g;
}

export const MODEL_NAMES = Object.keys(MODELS);

/* =====================================================================
   Stage — one renderer bound to one container
   ===================================================================== */
export class JewelStage {
  constructor(container, opts = {}) {
    this.container = container;
    this.interactive = !!opts.interactive;
    this.float = opts.float !== false;
    this.onReady = opts.onReady || null;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('role', 'img');
    if (opts.label) canvas.setAttribute('aria-label', opts.label);
    container.appendChild(canvas);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = studioEnvTexture();
    this.scene.environment = pmrem.fromEquirectangular(envTex).texture;
    envTex.dispose(); pmrem.dispose();

    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 6); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xd9d2ff, 1.4); rim.position.set(-5, 2, -4); this.scene.add(rim);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d0e8, 0.55));

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 0.15, 6.4);

    this.metal = 'silver';
    this.metalMat = new THREE.MeshPhysicalMaterial({
      color: METALS.silver.color, metalness: 1, roughness: METALS.silver.roughness,
      clearcoat: 0.5, clearcoatRoughness: 0.08, envMapIntensity: 1.15,
    });
    this.gemMat = new THREE.MeshPhysicalMaterial({
      color: 0xeef1fa, metalness: 0.7, roughness: 0.0, ior: 2.42, reflectivity: 1,
      specularIntensity: 1, envMapIntensity: 2.1, flatShading: true,
      iridescence: 0.75, iridescenceIOR: 1.7, iridescenceThicknessRange: [120, 480],
      clearcoat: 1, clearcoatRoughness: 0,
    });

    // soft contact shadow
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.5, blending: THREE.AdditiveBlending }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = -1.7; this.shadow.scale.set(1, 0.42, 1);
    this.scene.add(this.shadow);

    this.pivot = new THREE.Group(); this.scene.add(this.pivot);
    this.sparkles = [];

    if (this.interactive) {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
      this.controls.enablePan = false;
            this.controls.autoRotate = !REDUCED_MOTION; this.controls.autoRotateSpeed = 1.8;
      this.controls.addEventListener('start', () => { this.userTouched = true; });
    } else {
      this.pointer = { x: 0, y: 0 };
      window.addEventListener('pointermove', e => {
        this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }

    this.clock = new THREE.Clock();
    this.visible = true; this.paused = false;
    this._loop = this._loop.bind(this);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container);
    this.io = new IntersectionObserver(es => { this.visible = es[0].isIntersecting; }, { threshold: 0.01 });
    this.io.observe(container);
    this.resize();
    requestAnimationFrame(this._loop);
  }

  setModel(name) {
    const builder = MODELS[name] || MODELS.star;
    if (this.model) { this.pivot.remove(this.model); this._dispose(this.model); }
    const ctx = { metalMat: this.metalMat, gemMat: this.gemMat, gems: [] };
    const inner = builder(ctx);
    // auto-fit: centre + scale to a consistent visual size
    const box = new THREE.Box3().setFromObject(inner);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    inner.position.sub(centre);
    const holder = new THREE.Group(); holder.add(inner);
    const maxDim = Math.max(size.x, size.y, size.z * 0.6);
    holder.scale.setScalar(2.7 / maxDim);
    this.model = holder; this.pivot.add(holder);
    this._addSparkles(ctx.gems);
    this.intro = 0;
    this.userTouched = false;
    if (this.controls) { this.camera.position.set(0, 0.15, 6.4); this.controls.target.set(0, 0, 0); }
    this._fit(true);
    if (this.controls) this.controls.update();
  }

  setMetal(name) {
    const m = METALS[name]; if (!m) return;
    this.metal = name; this.metalMat.color.setHex(m.color); this.metalMat.roughness = m.roughness;
  }

  setAutoRotate(on) { if (this.controls) this.controls.autoRotate = on && !REDUCED_MOTION; }
  reset() {
    this.userTouched = false; this.pivot.rotation.set(0, 0, 0);
    this.camera.position.set(0, 0.15, 6.4); this._fit(true);
    if (this.controls) { this.controls.target.set(0, 0, 0); this.controls.update(); }
  }
  setPaused(p) { this.paused = p; }

  _addSparkles(gems) {
    this.sparkles = [];
    const pick = gems.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(16, gems.length));
    pick.forEach(g => {
      const mat = new THREE.SpriteMaterial({ map: sparkleTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 });
      const sp = new THREE.Sprite(mat);
      sp.position.copy(g.position); sp.position.z += 0.18 * g.scale.y + 0.05;
      g.parent.add(sp);
      this.sparkles.push({ sp, base: 0.32 + Math.random() * 0.35, speed: 0.6 + Math.random() * 1.3, phase: Math.random() * Math.PI * 2 });
    });
  }

  resize() {
    const r = this.container.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this._fit(!this.userTouched);
  }

  /* distance so a ~1.5-radius jewel fits both width and height */
  _fit(moveCamera) {
    const R = 1.62, v = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const hHalf = Math.atan(Math.tan(v) * this.camera.aspect);
    this.fitDist = Math.max(R / Math.tan(v), R / Math.tan(hHalf));
    if (this.controls) { this.controls.minDistance = this.fitDist * 0.55; this.controls.maxDistance = this.fitDist * 1.9; }
    if (moveCamera) this.camera.position.setLength(this.fitDist);
  }

  _loop() {
    requestAnimationFrame(this._loop);
    if (this.paused || !this.visible || document.hidden || !this.model) { this.clock.getDelta(); return; }
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
    // entrance
    if (this.intro < 1) { this.intro = Math.min(1, this.intro + dt * 1.6); }
    const e = 1 - Math.pow(1 - this.intro, 3);
    this.pivot.scale.setScalar(0.82 + 0.18 * e);
    // float + idle motion
    const bob = (this.float && !REDUCED_MOTION) ? Math.sin(t * 1.1) * 0.08 : 0;
    this.pivot.position.y = bob;
    this.shadow.scale.set(1 - bob * 0.8, 0.42 * (1 - bob * 0.8), 1);
    this.shadow.material.opacity = 0.5 - bob * 0.9;
    if (!this.controls) {
      const target = { x: this.pointer.y * 0.25, y: (REDUCED_MOTION ? 0 : t * 0.35) + this.pointer.x * 0.6 };
      this.pivot.rotation.x += (target.x - this.pivot.rotation.x) * 0.06;
      this.pivot.rotation.y += (target.y - this.pivot.rotation.y) * 0.06;
    } else {
      this.controls.update();
    }
    // twinkles
    if (!REDUCED_MOTION) {
      this.sparkles.forEach(s => {
        const k = Math.max(0, Math.sin(t * s.speed + s.phase));
        s.sp.scale.setScalar(s.base * Math.pow(k, 8) + 0.0001);
      });
    } else this.sparkles.forEach(s => s.sp.scale.setScalar(0.0001));
    this.renderer.render(this.scene, this.camera);
  }

  _dispose(obj) {
    obj.traverse(o => {
      if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose();
      if (o.isSprite) o.material.dispose();
    });
  }
}
