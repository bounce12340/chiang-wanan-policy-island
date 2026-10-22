// 3D 場景：一圈政策島 + 中央臺北島 + 環狀軌道。全部幾何以程式產生，沒有外部模型檔。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export const STATUS_COLORS = {
  done: 0x2e9e5b,
  in_progress: 0x2f7dd3,
  proposal: 0xd99a14,
  pledge: 0xd0457a,
};

const TOP = 1.45; // 島嶼草地頂面高度
const DAY = {
  sky: new THREE.Color('#cfe6f2'), fog: new THREE.Color('#d9ecf3'), water: new THREE.Color('#3f97bf'),
  hemiSky: new THREE.Color('#ffffff'), hemiGround: new THREE.Color('#b9a98a'), hemi: 1.15,
  sun: new THREE.Color('#fff4e0'), sunI: 2.3,
};
const NIGHT = {
  sky: new THREE.Color('#0d1528'), fog: new THREE.Color('#111b33'), water: new THREE.Color('#14325a'),
  hemiSky: new THREE.Color('#5b6fa8'), hemiGround: new THREE.Color('#1c2236'), hemi: 0.55,
  sun: new THREE.Color('#9fb4ff'), sunI: 0.55,
};

// 可重現的亂數，讓每次載入的島嶼形狀一致
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createWorld({ container, themes, onSelectTheme, onSelectItem, onHoverItem }) {
  const isSmall = window.matchMedia('(max-width: 760px)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  Object.assign(labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = DAY.sky.clone();
  scene.fog = new THREE.Fog(DAY.fog.clone(), 55, 140);

  const camera = new THREE.PerspectiveCamera(isSmall ? 50 : 38, container.clientWidth / container.clientHeight, 0.1, 400);
  const HOME = {
    pos: isSmall ? new THREE.Vector3(0, 66, 74) : new THREE.Vector3(0, 36, 50),
    target: new THREE.Vector3(0, 0, isSmall ? 3 : 1),
  };
  camera.position.copy(HOME.pos).multiplyScalar(1.6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 10;
  controls.maxDistance = 110;
  controls.maxPolarAngle = Math.PI * 0.44;
  controls.target.copy(HOME.target);
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.35;

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(DAY.sun, DAY.sunI);
  sun.position.set(-26, 40, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 120 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  // ---------- shared materials ----------
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });
  const M = {
    grass: mat('#8cc084'), sand: mat('#ecdcae'), rock: mat('#a7825c'), rockDark: mat('#8a6a4a'),
    white: mat('#f4f1ea'), concrete: mat('#c9c4b8'), dark: mat('#2b2f45', { roughness: 0.5, metalness: 0.2 }),
    glass: mat('#6f8fb3', { roughness: 0.3, metalness: 0.3 }), trunk: mat('#7a5638'), leaf: mat('#5da35a'),
    leaf2: mat('#7dbb63'), road: mat('#5c6170'), stripe: mat('#f7f3e8'), rail: mat('#d8d2c3'),
  };
  // 夜間會亮的材質（窗戶、燈）
  const glowMats = [];
  const glow = (color, base = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: base, flatShading: true, roughness: 0.6 });
    m.userData.base = base;
    glowMats.push(m);
    return m;
  };
  const windowMat = glow('#ffd88a', 0.05);
  const cyanMat = glow('#4fd6ff', 0.6);

  const pickables = [];
  const animators = [];
  const treeSpots = [];

  const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const cyl = (rt, rb, h, seg, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  // 在建築正面貼一排排窗戶
  const addWindows = (g, w, h, d, x, z, floors, cols) => {
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const wx = x - w / 2 + (w / cols) * (c + 0.5);
        const wy = 0.25 + ((h - 0.35) / floors) * (f + 0.5);
        const win = new THREE.Mesh(new THREE.BoxGeometry((w / cols) * 0.45, (h / floors) * 0.35, 0.04), windowMat);
        win.position.set(wx, wy, z + d / 2 + 0.01);
        g.add(win);
      }
    }
  };

  // ---------- water ----------
  const waterGeo = new THREE.PlaneGeometry(260, 260, 90, 90);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({ color: DAY.water.clone(), flatShading: true, roughness: 0.32, metalness: 0.08 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.receiveShadow = true;
  scene.add(water);
  const waterPos = waterGeo.attributes.position;
  const waterBase = Float32Array.from(waterPos.array);

  // ---------- island base ----------
  function jitterRadial(geo, amount, rand) {
    // 依角度決定半徑縮放，同角度的頂點拿到同一個值，側面與頂蓋才不會裂開
    const cache = new Map();
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const key = Math.round(Math.atan2(z, x) * 1000);
      if (!cache.has(key)) cache.set(key, 1 + (rand() - 0.5) * amount);
      const k = cache.get(key);
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function islandBase(radius, seed) {
    const g = new THREE.Group();
    const rand = rng(seed);
    const seg = 10;
    const rock = new THREE.Mesh(jitterRadial(new THREE.CylinderGeometry(radius * 0.92, radius * 0.5, 3.4, seg, 2), 0.22, rand), M.rock);
    rock.position.y = -1.2;
    const sandRing = new THREE.Mesh(jitterRadial(new THREE.CylinderGeometry(radius * 1.04, radius * 0.95, 0.55, seg), 0.12, rand), M.sand);
    sandRing.position.y = 0.72;
    const top = new THREE.Mesh(jitterRadial(new THREE.CylinderGeometry(radius * 0.93, radius * 1.0, 0.5, seg), 0.1, rand), M.grass);
    top.position.y = 1.2;
    [rock, sandRing, top].forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
    // 幾顆散落的礁石
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      const s = 0.3 + rand() * 0.45;
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.rockDark);
      r.position.set(Math.cos(a) * radius * 1.15, 0.1, Math.sin(a) * radius * 1.15);
      r.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      r.castShadow = true;
      g.add(r);
    }
    return { group: g, pickMeshes: [rock, sandRing, top] };
  }

  // ---------- theme models（每個領域一組原創小模型）----------
  const T = (hex) => mat(hex);
  const builders = {
    transport(g, c) {
      const accent = T(c);
      g.add(box(2.0, 0.75, 0.9, M.white, -0.6, 0, -1.1));
      g.add(box(2.2, 0.12, 1.1, accent, -0.6, 0.75, -1.1));
      addWindows(g, 2.0, 0.75, 0.9, -0.6, -1.1, 1, 5);
      // 高架環形試車軌
      const loop = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.07, 6, 48), M.rail);
      loop.rotation.x = Math.PI / 2;
      loop.position.set(0.5, 1.1, 0.7);
      g.add(loop);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(cyl(0.06, 0.06, 1.1, 5, M.concrete, 0.5 + Math.cos(a) * 1.55, 0, 0.7 + Math.sin(a) * 1.55));
      }
      const train = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const car = box(0.5, 0.26, 0.26, i === 0 ? accent : M.white, 0, 0, 0);
        car.userData.k = i;
        train.add(car);
      }
      g.add(train);
      animators.push((t) => {
        train.children.forEach((car, i) => {
          const a = t * 0.9 - i * 0.36;
          car.position.set(0.5 + Math.cos(a) * 1.55, 1.12, 0.7 + Math.sin(a) * 1.55);
          car.rotation.y = -a;
        });
      });
      g.add(box(0.9, 0.42, 0.42, T('#f2c14e'), 1.9, 0, -1.3));
      treeSpots.push([-2.2, 1.2], [-1.6, 1.9]);
    },
    development(g, c) {
      // 跑道一半變成公園：松山機場遷移構想
      const runway = box(5.0, 0.06, 1.0, M.road, 0, 0, 0.2);
      runway.rotation.y = 0.35;
      g.add(runway);
      for (let i = 0; i < 5; i++) {
        const s = box(0.35, 0.02, 0.08, M.stripe, -1.6 + i * 0.8, 0.06, 0.2);
        s.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35);
        s.rotation.y = 0.35;
        g.add(s);
      }
      const tower = cyl(0.22, 0.28, 1.6, 8, M.white, -1.8, 0, -1.5);
      g.add(tower);
      g.add(cyl(0.42, 0.3, 0.38, 8, M.glass, -1.8, 1.6, -1.5));
      g.add(cyl(0.48, 0.48, 0.06, 8, T(c), -1.8, 1.98, -1.5));
      treeSpots.push([1.0, 1.8], [1.7, 1.2], [2.2, 0.4], [0.3, 2.3], [1.4, 2.4], [2.6, -0.5], [0.6, -1.9], [1.5, -1.6]);
    },
    industry(g, c) {
      const chip = box(1.9, 0.18, 1.9, M.dark, 0.6, 0, 0.6);
      g.add(chip);
      g.add(box(1.1, 0.06, 1.1, cyanMat, 0.6, 0.18, 0.6));
      for (let i = 0; i < 5; i++) {
        for (const side of [-1, 1]) {
          g.add(box(0.08, 0.06, 0.3, M.concrete, 0.6 - 0.8 + i * 0.4, 0, 0.6 + side * 1.1));
          g.add(box(0.3, 0.06, 0.08, M.concrete, 0.6 + side * 1.1, 0, 0.6 - 0.8 + i * 0.4));
        }
      }
      const heights = [2.6, 3.3, 2.1];
      heights.forEach((h, i) => {
        const x = -1.6 + i * 0.75, z = -1.3 + (i % 2) * 0.3;
        g.add(box(0.62, h, 0.62, M.glass, x, 0, z));
        for (let k = 1; k < h / 0.5; k++) g.add(box(0.64, 0.05, 0.64, cyanMat, x, k * 0.5, z));
      });
      g.add(box(0.7, 0.08, 0.7, T(c), -0.85, 3.3, -1.0));
      treeSpots.push([-2.3, 1.2], [2.3, -1.5]);
    },
    housing(g, c) {
      const accent = T(c);
      const blocks = [[-1.5, -1.0, 2.4], [-0.5, -1.5, 3.2], [0.7, -1.2, 2.0], [-1.2, 0.6, 1.5], [0.4, 0.4, 2.6]];
      blocks.forEach(([x, z, h], i) => {
        const b = box(0.95, h, 0.95, i % 2 ? M.white : T('#f3e3cf'), x, 0, z);
        g.add(b);
        addWindows(g, 0.95, h, 0.95, x, z, Math.round(h / 0.45), 3);
        g.add(box(1.0, 0.1, 1.0, accent, x, h, z));
      });
      // 都更工地塔吊
      g.add(box(0.12, 3.8, 0.12, accent, 1.8, 0, 0.9));
      const arm = box(2.4, 0.1, 0.12, accent, 1.3, 3.7, 0.9);
      g.add(arm);
      g.add(box(0.4, 0.3, 0.3, M.concrete, 0.4, 3.45, 0.9));
      treeSpots.push([2.1, -1.4], [-2.2, 1.6]);
    },
    family(g, c) {
      const accent = T(c);
      g.add(box(3.0, 0.9, 1.0, T('#f6ead8'), -0.4, 0, -1.0));
      addWindows(g, 3.0, 0.9, 1.0, -0.4, -1.0, 1, 7);
      g.add(box(0.8, 1.6, 0.8, T('#f6ead8'), -0.4, 0, -0.9));
      g.add(cyl(0.0, 0.62, 0.5, 4, accent, -0.4, 1.6, -0.9));
      const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16), M.white);
      clock.rotation.x = Math.PI / 2;
      clock.position.set(-0.4, 1.25, -0.48);
      g.add(clock);
      // 操場與溜滑梯
      const track = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 4, 24), T('#d9765c'));
      track.rotation.x = Math.PI / 2;
      track.position.set(0.8, 0.04, 1.0);
      g.add(track);
      const slide = box(0.3, 0.06, 1.0, accent, -1.6, 0.25, 1.0);
      slide.rotation.x = 0.45;
      g.add(slide);
      g.add(box(0.3, 0.6, 0.3, T('#f2c14e'), -1.6, 0, 0.45));
      g.add(cyl(0.03, 0.03, 2.2, 5, M.concrete, 1.9, 0, -1.4));
      const flag = box(0.55, 0.32, 0.03, accent, 2.18, 1.85, -1.4);
      g.add(flag);
      animators.push((t) => { flag.rotation.y = Math.sin(t * 3) * 0.25; });
      treeSpots.push([2.3, 0.2], [-2.4, -0.2]);
    },
    care(g, c) {
      const accent = T(c);
      g.add(box(2.6, 1.3, 1.4, M.white, -0.2, 0, -0.6));
      addWindows(g, 2.6, 1.3, 1.4, -0.2, -0.6, 2, 6);
      g.add(box(1.1, 0.7, 1.1, M.white, -0.2, 1.3, -0.7));
      // 青綠色十字（不使用紅十字標誌）
      g.add(box(0.7, 0.16, 0.2, accent, -0.2, 2.0, -0.7));
      g.add(box(0.2, 0.16, 0.7, accent, -0.2, 2.0, -0.7));
      const amb = box(0.85, 0.4, 0.42, M.white, 1.2, 0, 1.2);
      g.add(amb);
      g.add(box(0.87, 0.08, 0.44, accent, 1.2, 0.2, 1.2));
      const siren = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow('#7ff0d8', 0.2));
      siren.position.set(1.2, 0.48, 1.2);
      g.add(siren);
      animators.push((t) => { siren.material.emissiveIntensity = (Math.sin(t * 8) > 0 ? 1.4 : 0.1); });
      // 長椅
      g.add(box(0.8, 0.12, 0.25, M.trunk, -1.3, 0.2, 1.3));
      treeSpots.push([-2.1, 0.9], [2.2, -0.8], [0.2, 1.9]);
    },
    safety(g, c) {
      const accent = T(c);
      g.add(box(1.8, 1.0, 1.3, T('#f1e9dd'), -0.7, 0, -0.6));
      g.add(box(1.9, 0.14, 1.4, accent, -0.7, 1.0, -0.6));
      for (let i = 0; i < 2; i++) g.add(box(0.6, 0.6, 0.04, M.dark, -1.1 + i * 0.8, 0, 0.07));
      g.add(box(0.5, 2.4, 0.5, T('#f1e9dd'), 1.1, 0, -1.2));
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glow('#ff6b5b', 0.3));
      beacon.position.set(1.1, 2.55, -1.2);
      g.add(beacon);
      animators.push((t) => { beacon.material.emissiveIntensity = 0.3 + (Math.sin(t * 2.4) * 0.5 + 0.5) * 1.6; });
      // 堤防：沿島緣一段矮牆
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * 0.35 + (i / 8) * Math.PI * 0.7;
        const wall = box(0.75, 0.42, 0.2, M.concrete, Math.cos(a) * 2.75, 0, Math.sin(a) * 2.75);
        wall.rotation.y = -a + Math.PI / 2;
        g.add(wall);
      }
      treeSpots.push([2.1, 0.3]);
    },
    environment(g, c) {
      const pole = cyl(0.07, 0.11, 3.2, 6, M.white, -1.2, 0, -1.0);
      g.add(pole);
      const hub = new THREE.Group();
      hub.position.set(-1.2, 3.2, -0.88);
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.04), M.white);
        blade.geometry.translate(0, 0.65, 0);
        blade.rotation.z = (i / 3) * Math.PI * 2;
        blade.castShadow = true;
        hub.add(blade);
      }
      g.add(hub);
      animators.push((t) => { hub.rotation.z = t * 1.4; });
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < 3; i++) {
          const p = box(0.7, 0.05, 0.45, T('#2d4f8a'), 0.4 + i * 0.8, 0.25, 0.6 + r * 0.7);
          p.rotation.x = -0.45;
          g.add(p);
        }
      }
      g.add(box(0.5, 0.12, 0.5, T(c), 1.9, 0, -1.5));
      treeSpots.push([-2.2, 0.8], [-1.6, 1.8], [-0.6, 2.2], [1.0, -1.8], [2.3, -0.4], [-0.2, -2.1]);
    },
    culture(g, c) {
      const accent = T(c);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), T('#e7e9ee'));
      dome.scale.set(1, 0.55, 1);
      dome.position.set(0.6, 0.2, 0.3);
      dome.castShadow = true;
      g.add(dome);
      g.add(cyl(1.6, 1.62, 0.22, 24, accent, 0.6, 0, 0.3));
      // 美術館：柱廊
      g.add(box(1.8, 0.14, 1.0, M.white, -1.4, 0, -1.4));
      for (let i = 0; i < 4; i++) g.add(cyl(0.07, 0.07, 0.8, 6, M.white, -2.1 + i * 0.46, 0.14, -1.0));
      g.add(box(1.9, 0.18, 1.1, M.white, -1.4, 0.94, -1.4));
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.75, 0.4, 3), accent);
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.scale.set(1, 1.3, 1);
      roof.position.set(-1.4, 1.32, -1.4);
      g.add(roof);
      treeSpots.push([2.3, -1.2], [-2.1, 1.3]);
    },
  };

  // ---------- trees（InstancedMesh，一次畫完）----------
  function buildTrees(worldSpots) {
    const n = worldSpots.length;
    const foliage = new THREE.InstancedMesh(new THREE.ConeGeometry(0.42, 1.05, 6), M.leaf, n);
    const foliage2 = new THREE.InstancedMesh(new THREE.ConeGeometry(0.32, 0.75, 6), M.leaf2, n);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 5), M.trunk, n);
    const dummy = new THREE.Object3D();
    const rand = rng(77);
    worldSpots.forEach((v, i) => {
      const s = 0.8 + rand() * 0.5;
      dummy.position.set(v.x, v.y + 0.2 * s, v.z); dummy.scale.setScalar(s); dummy.rotation.y = rand() * 3; dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y = v.y + 0.85 * s; dummy.updateMatrix(); foliage.setMatrixAt(i, dummy.matrix);
      dummy.position.y = v.y + 1.3 * s; dummy.updateMatrix(); foliage2.setMatrixAt(i, dummy.matrix);
    });
    [foliage, foliage2, trunks].forEach((m) => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
  }

  // ---------- islands ----------
  const R = 19.5;
  const islands = new Map();
  const tmpV = new THREE.Vector3();

  themes.forEach((theme, i) => {
    const angle = (i / themes.length) * Math.PI * 2 + Math.PI / 2;
    const pos = new THREE.Vector3(Math.cos(angle) * R, 0, Math.sin(angle) * R);
    const root = new THREE.Group();
    root.position.copy(pos);
    root.rotation.y = -angle + Math.PI / 2; // 模型正面朝向中心外側的鏡頭
    scene.add(root);

    const { group: base, pickMeshes } = islandBase(3.3, 1000 + i * 37);
    root.add(base);
    pickMeshes.forEach((m) => { m.userData.themeId = theme.id; pickables.push(m); });

    const models = new THREE.Group();
    models.position.y = TOP;
    const before = treeSpots.length;
    (builders[theme.id] || (() => {}))(models, theme.color);
    root.add(models);
    // 把本島新增的樹位置換算到世界座標
    root.updateMatrixWorld(true);
    for (let k = before; k < treeSpots.length; k++) {
      const [x, z] = treeSpots[k];
      treeSpots[k] = root.localToWorld(new THREE.Vector3(x, TOP, z));
    }

    // 水面光環：hover / 選取時亮起
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(3.9, 4.6, 40),
      new THREE.MeshBasicMaterial({ color: theme.color, transparent: true, opacity: 0, depthWrite: false }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.32;
    root.add(halo);

    // 政策項目＝島緣的光柱，顏色代表狀態
    const beacons = [];
    const n = theme.items.length;
    theme.items.forEach((item, k) => {
      const a = (k / n) * Math.PI * 2 + 0.4;
      const b = new THREE.Group();
      b.position.set(Math.cos(a) * 2.75, TOP, Math.sin(a) * 2.75);
      const color = STATUS_COLORS[item.status] ?? 0x999999;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), M.concrete);
      pole.position.y = 0.65;
      const orbMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4 });
      orbMat.userData.base = 0.55;
      glowMats.push(orbMat);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), orbMat);
      orb.position.y = 1.5;
      orb.castShadow = true;
      // 較大的隱形點擊範圍，手機比較好點
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1.3;
      hit.userData = { themeId: theme.id, itemId: item.id };
      pickables.push(hit);
      b.add(pole, orb, hit);
      b.userData = { item, orb, phase: k * 0.9 };
      root.add(b);
      beacons.push(b);
    });

    // 標籤
    const el = document.createElement('button');
    el.className = 'isle-label';
    el.type = 'button';
    el.innerHTML = `<i style="background:${theme.color}"></i>${theme.name}<small>${n}</small>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); onSelectTheme(theme.id); });
    const label = new CSS2DObject(el);
    label.position.set(0, 6.4, 0);
    root.add(label);

    islands.set(theme.id, { theme, root, pos, halo, beacons, label: el, angle, hover: 0, active: 0 });
  });

  // 中央臺北島
  {
    const { group } = islandBase(5.6, 4242);
    scene.add(group);
    const c = new THREE.Group();
    c.position.y = TOP;
    group.add(c);
    const steps = [[2.2, 0.5], [1.7, 0.5], [1.35, 3.2], [1.15, 1.6], [0.9, 1.4], [0.6, 1.0]];
    let y = 0;
    steps.forEach(([w, h], i) => {
      const m = box(w, h, w, i === 0 ? M.concrete : M.glass, 0, y, 0);
      c.add(m);
      if (i >= 2) for (let k = 1; k < h / 0.4; k++) c.add(box(w + 0.02, 0.04, w + 0.02, windowMat, 0, y + k * 0.4, 0));
      y += h;
    });
    c.add(cyl(0.04, 0.08, 1.4, 5, M.concrete, 0, y, 0));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glow('#ffcf6b', 0.3));
    tip.position.y = y + 1.45;
    c.add(tip);
    // 廣場與步道
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.05, 32), M.sand);
    plaza.position.y = 0.02;
    plaza.receiveShadow = true;
    c.add(plaza);
    const rand = rng(9);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      const r = 4.2 + rand() * 0.6;
      treeSpots.push(new THREE.Vector3(Math.cos(a) * r, TOP, Math.sin(a) * r));
    }
    const el = document.createElement('div');
    el.className = 'center-label';
    el.innerHTML = '<b>臺北</b><span>2022–2026</span>';
    const lbl = new CSS2DObject(el);
    lbl.position.set(0, y + 4.6, 0);
    group.add(lbl);
  }

  buildTrees(treeSpots);

  // ---------- 環狀軌道與列車：把各島串起來 ----------
  const ringR = 12.6;
  const ringPts = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    ringPts.push(new THREE.Vector3(Math.cos(a) * ringR, 2.6 + Math.sin(a * 3) * 0.25, Math.sin(a) * ringR));
  }
  const ringCurve = new THREE.CatmullRomCurve3(ringPts, true);
  const track = new THREE.Mesh(new THREE.TubeGeometry(ringCurve, 256, 0.14, 6, true), M.rail);
  track.castShadow = true;
  scene.add(track);
  for (let i = 0; i < 24; i++) {
    const p = ringCurve.getPointAt(i / 24);
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, p.y, 6), M.concrete);
    pylon.position.set(p.x, p.y / 2, p.z);
    pylon.castShadow = true;
    scene.add(pylon);
  }
  // 從環線伸向各島的步道橋
  islands.forEach(({ pos, theme }) => {
    const dir = pos.clone().normalize();
    const a = dir.clone().multiplyScalar(ringR + 0.3).setY(2.5);
    const b = dir.clone().multiplyScalar(R - 3.1).setY(TOP + 0.05);
    const mid = a.clone().lerp(b, 0.5).setY(2.6);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const bridge = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.12, 5, false), mat(theme.color));
    bridge.castShadow = true;
    scene.add(bridge);
  });
  const train = [];
  const trainMat = mat('#f4f1ea');
  for (let i = 0; i < 5; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.55), i === 0 ? mat('#20a39e') : trainMat);
    car.castShadow = true;
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.57), windowMat);
    win.position.y = 0.08;
    car.add(win);
    scene.add(car);
    train.push(car);
  }

  // ---------- 船與雲 ----------
  const boats = [];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.5), mat('#f4f1ea'));
    hull.position.y = 0.15;
    const sail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.0, 3), mat(i === 1 ? '#f08c3a' : '#ffffff'));
    sail.position.y = 0.8;
    b.add(hull, sail);
    b.traverse((o) => { o.castShadow = true; });
    b.userData = { r: 28 + i * 4, speed: 0.04 + i * 0.012, phase: i * 2.1 };
    scene.add(b);
    boats.push(b);
  }
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, transparent: true, opacity: 0.92 });
  const crand = rng(5);
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + crand() * 1.2, 1), cloudMat);
      s.position.set(k * 1.3 - 2, crand() * 0.6, crand() * 1.2);
      s.scale.y = 0.6;
      c.add(s);
    }
    c.position.set(-60 + crand() * 120, 15 + crand() * 7, -50 + crand() * 100);
    c.userData.speed = 0.6 + crand() * 0.6;
    scene.add(c);
    clouds.push(c);
  }

  // ---------- 互動 ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null; // {themeId, itemId?}
  let down = null;
  let focused = null;

  function pick(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (!hit) return null;
    const d = hit.object.userData;
    if (d.itemId) {
      const beacon = hit.object.parent;
      if (!beacon.visible) return { themeId: d.themeId };
      return { themeId: d.themeId, itemId: d.itemId };
    }
    return { themeId: d.themeId };
  }

  function setHover(h, clientX, clientY) {
    const prev = hovered;
    hovered = h;
    if (prev?.themeId !== h?.themeId) {
      if (prev) islands.get(prev.themeId)?.label.classList.remove('is-hover');
      if (h) islands.get(h.themeId)?.label.classList.add('is-hover');
    }
    renderer.domElement.style.cursor = h ? 'pointer' : '';
    onHoverItem?.(h?.itemId ? h : null, clientX, clientY);
  }

  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    controls.autoRotate = false;
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    setHover(pick(e.clientX, e.clientY), e.clientX, e.clientY);
  });
  el.addEventListener('pointerleave', () => setHover(null));
  el.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 7) return;
    const h = pick(e.clientX, e.clientY);
    if (!h) return;
    if (h.itemId) onSelectItem(h.themeId, h.itemId);
    else onSelectTheme(h.themeId);
  });

  // ---------- camera tween ----------
  let tween = null;
  function flyTo(pos, target, dur = 1.2) {
    tween = {
      fromPos: camera.position.clone(), toPos: pos.clone(),
      fromT: controls.target.clone(), toT: target.clone(), start: performance.now(), dur: (reduceMotion ? 0.01 : dur) * 1000,
    };
  }

  // 面板蓋住的區域：用 setViewOffset 平移投影中心，讓焦點落在「沒被蓋住」的區域中央
  const inset = { x: 0, y: 0, tx: 0, ty: 0 };
  function setInset() {
    const small = window.matchMedia('(max-width: 760px)').matches;
    const panel = document.getElementById('panel');
    if (!focused || !panel) { inset.tx = 0; inset.ty = 0; return; }
    if (small) { inset.tx = 0; inset.ty = panel.offsetHeight / 2; } else { inset.tx = (panel.offsetWidth + 12) / 2; inset.ty = 0; }
  }
  function applyInset(dtSec) {
    const k = 1 - Math.exp(-dtSec * 4); // 以實際時間平滑，約 1 秒到位
    inset.x += (inset.tx - inset.x) * k;
    inset.y += (inset.ty - inset.y) * k;
    const w = container.clientWidth, h = container.clientHeight;
    if (Math.abs(inset.x) < 0.5 && Math.abs(inset.y) < 0.5 && !inset.tx && !inset.ty) camera.clearViewOffset();
    else camera.setViewOffset(w, h, inset.x, inset.y, w, h);
  }

  function focusTheme(id) {
    const isle = islands.get(id);
    if (!isle) return;
    focused = id;
    controls.autoRotate = false;
    const small = window.matchMedia('(max-width: 760px)').matches;
    const out = isle.pos.clone().normalize();
    const target = isle.pos.clone().setY(2.6);
    // 從島的外側斜上方看向島，背景是其他島與中央臺北
    const camPos = isle.pos.clone().add(out.multiplyScalar(small ? 17 : 13.5)).setY(small ? 17 : 11);
    setInset();
    flyTo(camPos, target);
  }

  function resetView() {
    focused = null;
    setInset();
    flyTo(HOME.pos, HOME.target, 1.4);
    if (!reduceMotion) setTimeout(() => { if (!focused) controls.autoRotate = true; }, 1500);
  }

  // ---------- filters / modes ----------
  let statusFilter = null;
  function setStatusFilter(s) {
    statusFilter = s;
    islands.forEach((isle) => {
      let shown = 0;
      isle.beacons.forEach((b) => {
        const ok = !s || b.userData.item.status === s;
        b.visible = ok;
        if (ok) shown++;
      });
      isle.label.classList.toggle('is-dim', !!s && shown === 0);
      const small = isle.label.querySelector('small');
      if (small) small.textContent = s ? `${shown}/${isle.beacons.length}` : String(isle.beacons.length);
    });
  }

  let nightT = 0, nightTarget = 0;
  const setNight = (on) => { nightTarget = on ? 1 : 0; };

  let paused = false;
  const setPaused = (p) => { paused = p; };

  const flashItem = (themeId, itemId) => {
    const isle = islands.get(themeId);
    const b = isle?.beacons.find((x) => x.userData.item.id === itemId);
    if (b) b.userData.flash = 1;
  };

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let elapsed = 0;
  const tmpColor = new THREE.Color();

  function applyNight(k) {
    scene.background.copy(DAY.sky).lerp(NIGHT.sky, k);
    scene.fog.color.copy(DAY.fog).lerp(NIGHT.fog, k);
    waterMat.color.copy(DAY.water).lerp(NIGHT.water, k);
    hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, k);
    hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, k);
    hemi.intensity = THREE.MathUtils.lerp(DAY.hemi, NIGHT.hemi, k);
    sun.color.copy(DAY.sun).lerp(NIGHT.sun, k);
    sun.intensity = THREE.MathUtils.lerp(DAY.sunI, NIGHT.sunI, k);
    glowMats.forEach((m) => {
      if (m === windowMat) m.emissiveIntensity = THREE.MathUtils.lerp(m.userData.base, 1.3, k);
      else if (m.userData.base !== undefined && m !== cyanMat) m.emissiveIntensity = THREE.MathUtils.lerp(m.userData.base, 1.4, k);
    });
    cyanMat.emissiveIntensity = THREE.MathUtils.lerp(0.6, 1.6, k);
    cloudMat.opacity = THREE.MathUtils.lerp(0.92, 0.25, k);
  }

  function frame() {
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    if (!paused) {
      elapsed += reduceMotion ? 0 : dt;

      // 水面波動（flatShading 會在 shader 裡算法線，所以不用重算）
      if (!reduceMotion) {
        const arr = waterPos.array;
        for (let i = 0; i < arr.length; i += 3) {
          const x = waterBase[i], z = waterBase[i + 2];
          arr[i + 1] = Math.sin(x * 0.16 + elapsed * 0.9) * 0.16 + Math.cos(z * 0.13 + elapsed * 0.7) * 0.14;
        }
        waterPos.needsUpdate = true;
      }

      animators.forEach((fn) => fn(elapsed));

      // 列車沿環線前進
      const base = (elapsed * 0.018) % 1;
      train.forEach((car, i) => {
        const u = (base - i * 0.0105 + 1) % 1;
        const p = ringCurve.getPointAt(u);
        const tan = ringCurve.getTangentAt(u);
        car.position.copy(p).setY(p.y + 0.36);
        car.lookAt(tmpV.copy(car.position).add(tan));
        car.rotateY(Math.PI / 2);
      });

      boats.forEach((b) => {
        const a = elapsed * b.userData.speed + b.userData.phase;
        b.position.set(Math.cos(a) * b.userData.r, Math.sin(elapsed * 1.6 + b.userData.phase) * 0.08, Math.sin(a) * b.userData.r);
        b.rotation.y = -a;
      });
      clouds.forEach((c) => { c.position.x += c.userData.speed * dt; if (c.position.x > 75) c.position.x = -75; });

      islands.forEach((isle, id) => {
        const wantHover = hovered?.themeId === id ? 1 : 0;
        const wantActive = focused === id ? 1 : 0;
        isle.hover += (wantHover - isle.hover) * 0.15;
        isle.active += (wantActive - isle.active) * 0.1;
        isle.halo.material.opacity = Math.max(isle.hover * 0.55, isle.active * 0.8);
        isle.root.position.y = Math.sin(elapsed * 0.6 + isle.angle * 3) * 0.12 + isle.active * 0.35;
        isle.beacons.forEach((b) => {
          const { orb, phase } = b.userData;
          orb.position.y = 1.5 + Math.sin(elapsed * 2 + phase) * 0.12;
          orb.rotation.y = elapsed * 1.2 + phase;
          const isHover = hovered?.itemId === b.userData.item.id;
          const f = b.userData.flash || 0;
          const s = 1 + (isHover ? 0.45 : 0) + f * 0.8;
          orb.scale.setScalar(THREE.MathUtils.lerp(orb.scale.x, s, 0.2));
          if (f > 0) b.userData.flash = Math.max(0, f - dt * 0.6);
        });
      });

      if (Math.abs(nightTarget - nightT) > 0.001) {
        nightT += (nightTarget - nightT) * 0.06;
        applyNight(nightT);
      }
    }

    if (tween) {
      const raw = Math.min((performance.now() - tween.start) / tween.dur, 1);
      const k = easeInOut(raw);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromT, tween.toT, k);
      if (raw >= 1) tween = null;
    }
    controls.update();
    applyInset(rawDt);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  function onResize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    setInset();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  if (new URLSearchParams(location.search).has('debug')) {
    window.__dbg = () => {
      const out = {};
      islands.forEach((isle, id) => {
        const p = isle.root.position.clone().setY(2.6).project(camera);
        out[id] = [Math.round((p.x + 1) / 2 * container.clientWidth), Math.round((1 - p.y) / 2 * container.clientHeight)];
      });
      return { cam: camera.position.toArray().map((v) => +v.toFixed(2)), target: controls.target.toArray().map((v) => +v.toFixed(2)), inset: [inset.x, inset.tx], focused, view: camera.view, out };
    };
  }

  // 開場：從遠處推近
  flyTo(HOME.pos, HOME.target, 2.4);
  applyNight(0);

  return { focusTheme, resetView, setStatusFilter, setNight, setPaused, flashItem, labelLayer: labelRenderer.domElement };
}
