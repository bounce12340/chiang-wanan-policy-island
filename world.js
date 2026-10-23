// 3D 場景：一圈政策島 + 中央臺北島 + 環狀軌道。全部幾何以程式產生，沒有外部模型檔。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCrowd } from './people.js';
import { sceneFor } from './vignettes.js';

export const STATUS_COLORS = {
  done: 0x2e9e5b,
  in_progress: 0x2f7dd3,
  proposal: 0xd99a14,
  pledge: 0xd0457a,
};

const TOP = 1.45; // 地塊草地頂面高度

// 四個時段的光線與色調；切換時逐格內插
const TIMES = {
  dawn: {
    sky: '#f2d9c8', fog: '#f0dccd', water: '#5f9fb0', shallow: '#9fd2c8', hemiSky: '#ffe6d2', hemiGround: '#b8a088', hemi: 1.0,
    sun: '#ffc79a', sunI: 1.7, sunPos: [-40, 18, 10], glow: 0.35, cloud: 0.9,
  },
  day: {
    sky: '#f3ece0', fog: '#efe6d6', water: '#4f9fae', shallow: '#8fd3c7', hemiSky: '#ffffff', hemiGround: '#bfae8e', hemi: 1.15,
    sun: '#fff1dc', sunI: 2.3, sunPos: [-26, 44, 18], glow: 0.0, cloud: 0.95,
  },
  dusk: {
    sky: '#f3c9a8', fog: '#eec6a8', water: '#5d8ea4', shallow: '#97c6bd', hemiSky: '#ffdcc0', hemiGround: '#a88a74', hemi: 1.15,
    sun: '#ffab78', sunI: 2.0, sunPos: [38, 22, 6], glow: 0.6, cloud: 0.85,
  },
  night: {
    sky: '#0f1730', fog: '#121c36', water: '#173456', shallow: '#22506a', hemiSky: '#5b6fa8', hemiGround: '#1c2236', hemi: 0.55,
    sun: '#9fb4ff', sunI: 0.55, sunPos: [20, 40, -20], glow: 1.0, cloud: 0.25,
  },
};
const toPalette = (t) => ({
  sky: new THREE.Color(t.sky), fog: new THREE.Color(t.fog), water: new THREE.Color(t.water), shallow: new THREE.Color(t.shallow),
  hemiSky: new THREE.Color(t.hemiSky), hemiGround: new THREE.Color(t.hemiGround), hemi: t.hemi,
  sun: new THREE.Color(t.sun), sunI: t.sunI, sunPos: new THREE.Vector3(...t.sunPos), glow: t.glow, cloud: t.cloud,
});
const PALETTES = Object.fromEntries(Object.entries(TIMES).map(([k, v]) => [k, toPalette(v)]));
const DAY = PALETTES.day;

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

export function createWorld({ container, themes, onSelectTheme, onSelectItem, onHoverItem, onSelectPerson }) {
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
  scene.fog = new THREE.Fog(DAY.fog.clone(), 110, 330);

  // 鳥瞰：鏡頭高、視角窄，接近地圖的俯視感
  const camera = new THREE.PerspectiveCamera(isSmall ? 42 : 30, container.clientWidth / container.clientHeight, 0.5, 600);
  const HOME = {
    pos: isSmall ? new THREE.Vector3(0, 74, 70) : new THREE.Vector3(0, 50, 72),
    target: new THREE.Vector3(0, 0, isSmall ? 1 : -6),
  };
  camera.position.copy(HOME.pos).multiplyScalar(1.6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 10;
  controls.maxDistance = 150;
  controls.maxPolarAngle = Math.PI * 0.42;
  controls.target.copy(HOME.target);
  controls.autoRotate = false; // 鳥瞰地圖固定朝北，不自動旋轉
  controls.autoRotateSpeed = 0.35;

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(DAY.sun, DAY.sunI);
  sun.position.copy(DAY.sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  // ---------- shared materials ----------
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });
  const M = {
    grass: mat('#a9c98a'), sand: mat('#efdcb4'), rock: mat('#c9ab82'), rockDark: mat('#9c8063'),
    pave: mat('#efe3c8'), wall: mat('#dccaa5'),
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

  // 會動的物件標記為 dynamic，合併靜態網格時保留原樣
  const dyn = (o) => { o.userData.dynamic = true; return o; };

  // 把一個群組底下所有靜態網格依材質合併：數百個小物件 → 每種材質一次繪製
  function mergeStatic(group) {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const buckets = new Map();
    const victims = [];
    const collect = (o) => {
      if (o.userData.dynamic) return;
      if (o.isMesh && !o.isInstancedMesh && o.material.visible !== false) {
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        if (!buckets.has(o.material)) buckets.set(o.material, { geos: [], cast: false });
        const b = buckets.get(o.material);
        b.geos.push(g);
        b.cast ||= o.castShadow;
        victims.push(o);
      }
      for (const c of [...o.children]) collect(c);
    };
    for (const c of [...group.children]) collect(c);
    victims.forEach((o) => { o.parent.remove(o); o.geometry.dispose(); });
    const merged = [];
    buckets.forEach(({ geos, cast }, material) => {
      const m = new THREE.Mesh(mergeGeometries(geos, false), material);
      geos.forEach((g) => g.dispose());
      m.castShadow = cast;
      m.receiveShadow = true;
      group.add(m);
      merged.push(m);
    });
    return merged;
  }

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
  // 波動在 vertex shader 裡算，CPU 每幀只更新一個時間 uniform
  // 群島周圍是淺水（青綠），越往外越深：在 fragment shader 依距離混色
  const waterSeg = isSmall ? 64 : 96;
  const waterGeo = new THREE.PlaneGeometry(420, 420, waterSeg, waterSeg);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({ color: DAY.water.clone(), flatShading: true, roughness: 0.3, metalness: 0.06 });
  const waterTime = { value: 0 };
  const waterShallow = { value: DAY.shallow.clone() };
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterTime;
    shader.uniforms.uShallow = waterShallow;
    shader.vertexShader = 'uniform float uTime;\nvarying vec2 vWPos;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      transformed.y += sin(position.x * 0.16 + uTime * 0.9) * 0.14 + cos(position.z * 0.13 + uTime * 0.7) * 0.12;
      vWPos = (modelMatrix * vec4(transformed, 1.0)).xz;`,
    );
    shader.fragmentShader = 'uniform vec3 uShallow;\nvarying vec2 vWPos;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float wd = length(vWPos);
      diffuseColor.rgb = mix(uShallow, diffuseColor.rgb, smoothstep(17.0, 34.0, wd));`,
    );
  };
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.receiveShadow = true;
  scene.add(water);

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

  // ---------- 六角地塊：石砌護岸、外圈步道、草地 ----------
  const HEX_R = 4.0; // 外接圓半徑（尖角朝 ±z）
  const HEX_GAP = 4.3; // 排列用的格距，留一點水道
  function hexBase(seed, radius = HEX_R) {
    const g = new THREE.Group();
    const rand = rng(seed);
    const layer = (rt, rb, h, y, m) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 6), m);
      mesh.position.y = y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    layer(radius * 1.04, radius * 1.18, 0.9, -0.55, M.rockDark); // 水下基座
    layer(radius, radius * 1.03, 1.5, 0.45, M.wall); // 護岸
    layer(radius * 0.995, radius, 0.12, 1.26, M.pave); // 外圈步道
    layer(radius * 0.9, radius * 0.9, 0.14, 1.38, M.grass); // 草地，頂面 = TOP
    // 六個角的路燈
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 5), M.white);
      post.position.set(Math.sin(a) * radius * 0.95, 1.57, Math.cos(a) * radius * 0.95);
      g.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), windowMat);
      lamp.position.set(post.position.x, 1.85, post.position.z);
      g.add(lamp);
    }
    for (let i = 0; i < 2; i++) {
      const a = rand() * Math.PI * 2;
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rand() * 0.35, 0), M.rockDark);
      r.position.set(Math.cos(a) * radius * 1.2, 0.05, Math.sin(a) * radius * 1.2);
      r.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      r.castShadow = true;
      g.add(r);
    }
    return g;
  }
  // 六角格座標（axial）→ 世界座標
  const axial = (q, r) => new THREE.Vector3(HEX_GAP * Math.sqrt(3) * (q + r / 2), 0, HEX_GAP * 1.5 * r);
  // 9 個主題地塊環繞中央臺北：內圈 6 格、外圈 3 格，拼成一座城
  const HEX_SLOTS = [[0, 1], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [1, 1], [-2, 1], [2, -1]];

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
      g.add(dyn(train));
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
      g.add(dyn(flag));
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
      g.add(dyn(siren));
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
      g.add(dyn(beacon));
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
      g.add(dyn(hub));
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

  const islands = new Map();
  const tmpV = new THREE.Vector3();
  const beaconList = [];
  const hitGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  themes.forEach((theme, i) => {
    const angle = i * 1.7; // 只用來錯開浮動相位
    const [q, r] = HEX_SLOTS[i % HEX_SLOTS.length];
    const pos = axial(q, r);
    const root = new THREE.Group();
    root.position.copy(pos); // 模型一律正面朝 +z（鳥瞰鏡頭的方向）
    scene.add(root);

    root.add(hexBase(1000 + i * 37));

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

    // 島體與模型合併；合併後的網格也拿來點選（點建築也能選島）
    mergeStatic(root).forEach((m) => { m.userData.themeId = theme.id; pickables.push(m); });

    // 水面光環：hover / 選取時亮起（平時隱藏，不佔繪製）
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(HEX_R * 1.06, HEX_R * 1.24, 6, 1, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: theme.color, transparent: true, opacity: 0, depthWrite: false }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.35;
    halo.visible = false;
    root.add(halo);

    // 政策項目＝島緣的光柱。這裡只放定位點，實際繪製統一交給 InstancedMesh
    const beacons = [];
    const n = theme.items.length;
    theme.items.forEach((item, k) => {
      const a = (k / n) * Math.PI * 2 + 0.4;
      const b = new THREE.Object3D();
      b.position.set(Math.cos(a) * 2.85, TOP, Math.sin(a) * 2.85);
      const pole = new THREE.Object3D();
      pole.position.y = 0.65;
      const orb = new THREE.Object3D();
      orb.position.y = 1.5;
      // 較大的隱形點擊範圍，手機比較好點（材質不可見，不會被繪製）
      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.position.y = 1.3;
      hit.userData = { themeId: theme.id, itemId: item.id };
      pickables.push(hit);
      b.add(pole, orb, hit);
      b.userData = { item, orb, pole, phase: k * 0.9, shown: true };
      root.add(b);
      beacons.push(b);
      beaconList.push(b);
    });

    // 標籤
    const el = document.createElement('button');
    el.className = 'isle-label';
    el.type = 'button';
    // 編號標籤：01 交通
    el.innerHTML = `<em style="color:${theme.color}">${String(i + 1).padStart(2, '0')}</em>${theme.name}<small>${n}</small>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); onSelectTheme(theme.id); });
    const label = new CSS2DObject(el);
    label.position.set(0, 4.6, 1.2);
    root.add(label);

    islands.set(theme.id, { theme, root, pos, halo, beacons, label: el, angle, hover: 0, active: 0 });
  });

  // 光柱：所有柱子一個 InstancedMesh，光球依狀態各一個（顏色不同）→ 共 5 次繪製
  const poleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), M.concrete, beaconList.length);
  poleMesh.castShadow = true;
  poleMesh.frustumCulled = false;
  scene.add(poleMesh);
  beaconList.forEach((b, i) => { b.userData.poleIndex = i; });
  const orbGeo = new THREE.OctahedronGeometry(0.24, 0);
  const orbMeshes = [];
  Object.entries(STATUS_COLORS).forEach(([status, color]) => {
    const list = beaconList.filter((b) => b.userData.item.status === status);
    if (!list.length) return;
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4 });
    m.userData.base = 0.55;
    glowMats.push(m);
    const im = new THREE.InstancedMesh(orbGeo, m, list.length);
    im.castShadow = true;
    im.frustumCulled = false;
    scene.add(im);
    orbMeshes.push(im);
    list.forEach((b, i) => { b.userData.orbMesh = im; b.userData.orbIndex = i; });
  });
  // ---------- 小人：常駐在各島，符合島的主題 ----------
  const crowd = createCrowd(scene, 96);
  const ring = (cx, cz, r, n = 10) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cz + Math.sin((i / n) * Math.PI * 2) * r]);
  const RESIDENTS = {
    transport: [
      { anim: 'walk', path: [[-1.8, 1.9], [1.6, 2.2]] },
      { anim: 'walk', path: [[1.5, 1.6], [-1.7, 1.4]], pathT: 0.4 },
      { x: -2.0, z: 0.4, anim: 'wave', kid: true },
    ],
    development: [
      { anim: 'jog', path: [[1.0, 0.8], [2.1, 0.3], [1.8, -0.9], [0.9, -0.6]] },
      { x: 0.4, z: 1.7, anim: 'point', kid: true, rot: -0.5 },
      { x: 0.8, z: 1.9, anim: 'cheer', kid: true },
    ],
    industry: [
      { x: 1.6, z: 1.8, anim: 'point', shirt: '#2b2f45', rot: -2.4 },
      { x: -0.4, z: 2.1, anim: 'walk', path: [[-0.6, 2.2], [1.4, 2.2]], shirt: '#ffffff' },
    ],
    housing: [
      { anim: 'walk', path: [[-1.9, 1.6], [0.6, 1.9]] },
      { anim: 'walk', path: [[0.5, 1.7], [-1.8, 1.4]], pathT: 0.5, senior: true },
      { x: 1.0, z: 2.1, anim: 'wave', kid: true },
    ],
    family: [
      { anim: 'jog', kid: true, path: ring(0.8, 1.0, 0.9, 12) },
      { anim: 'jog', kid: true, path: ring(0.8, 1.0, 0.9, 12), pathT: 0.5 },
      { x: -1.6, z: 1.7, anim: 'wave', kid: true },
      { x: -0.8, z: 1.9, anim: 'give', rot: -1.0 },
    ],
    care: [
      { anim: 'walk', senior: true, path: [[-1.8, 0.8], [-1.4, 1.9], [0.4, 2.1]] },
      { x: 0.6, z: 1.6, anim: 'idle', shirt: '#20a39e', rot: 0.6 },
      { x: -1.3, z: 1.4, anim: 'sit', senior: true, y: 0.1 },
    ],
    safety: [
      { x: -0.4, z: 0.9, anim: 'salute', shirt: '#2f4f8a', pants: '#1f2a44' },
      { x: 0.3, z: 1.1, anim: 'idle', shirt: '#2b2f45' },
    ],
    environment: [
      { anim: 'jog', path: [[-1.9, 1.3], [-0.6, 2.2], [1.0, 2.0], [2.1, 0.8], [1.0, 1.2], [-0.8, 1.5]] },
      { x: -0.9, z: 0.9, anim: 'point', kid: true, rot: -2.6 },
    ],
    culture: Array.from({ length: 8 }, (_, i) => {
      const a = Math.PI * 0.18 + (i / 7) * Math.PI * 0.62;
      return { x: 0.6 + Math.cos(a) * 1.95, z: 0.3 + Math.sin(a) * 1.95, rot: Math.atan2(Math.cos(a), Math.sin(a)), anim: 'cheer', phase: i * 0.8, kid: i % 3 === 0 };
    }),
  };
  const STATUS_RANK = { done: 0, in_progress: 1, proposal: 2, pledge: 3 };
  islands.forEach((isle, id) => {
    const items = [...isle.theme.items].sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));
    (RESIDENTS[id] || []).forEach((o, k) => crowd.add(isle.root, {
      ...o, y: TOP + (o.y || 0),
      meta: items.length ? { themeId: id, itemId: items[k % items.length].id } : null,
    }));
  });

  // ---------- 政策小場景：浮在島上方的小舞台 ----------
  const STAGE_Y = 7.2;
  const STAGE_TOP = 0.725; // 舞台草地表面（相對舞台原點）
  const kitMatCache = new Map();
  const kitGlowCache = new Map();
  const kitMat = (c) => {
    if (c === 'window') return windowMat;
    if (!kitMatCache.has(c)) kitMatCache.set(c, mat(c));
    return kitMatCache.get(c);
  };
  const kitGlow = (c) => {
    if (!kitGlowCache.has(c)) kitGlowCache.set(c, glow(c, 0.6));
    return kitGlowCache.get(c);
  };
  let stage = null;

  function makeKit(st, color) {
    const content = st.content;
    const place = (mesh, x, y, z, o = {}) => {
      if (o.rx) mesh.rotation.x = o.rx;
      if (o.rz) mesh.rotation.z = o.rz;
      if (o.ry || o.rot) mesh.rotation.y = o.ry || o.rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (o.dyn) mesh.userData.dynamic = true;
      (o.parent || content).add(mesh);
      return mesh;
    };
    // fade：需要逐漸淡出的物件用獨立的半透明材質，換場景時一併釋放
    const mOf = (c, o) => {
      if (o.fade) {
        const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, depthWrite: false });
        st.ownMaterials.push(m);
        return m;
      }
      return o.glow ? kitGlow(c) : kitMat(c);
    };
    return {
      color,
      box(w, h, d, c, x, y, z, o = {}) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mOf(c, o));
        m.position.set(x, y + (o.rx || o.rz ? 0 : h / 2), z);
        return place(m, x, y, z, o);
      },
      cyl(rt, rb, h, seg, c, x, y, z, o = {}) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mOf(c, o));
        m.position.set(x, y + (o.rx || o.rz ? 0 : h / 2), z);
        return place(m, x, y, z, o);
      },
      sphere(r, c, x, y, z, o = {}) {
        const g = o.half ? new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2) : new THREE.SphereGeometry(r, 10, 8);
        const m = new THREE.Mesh(g, mOf(c, o));
        m.position.set(x, y, z);
        if (o.sy) m.scale.y = o.sy;
        return place(m, x, y, z, o);
      },
      tree(x, z, s = 1) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.35 * s, 5), M.trunk);
        t.position.set(x, 0.175 * s, z);
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.36 * s, 0.9 * s, 6), M.leaf);
        f.position.set(x, 0.75 * s, z);
        [t, f].forEach((m) => { m.castShadow = true; content.add(m); });
      },
      group(x = 0, y = 0, z = 0, rot = 0, parent = null, _dyn = true, rz = 0) {
        const g = new THREE.Group();
        g.position.set(x, y, z);
        g.rotation.set(0, rot, rz);
        g.userData.dynamic = true;
        (parent || content).add(g);
        return g;
      },
      person(o = {}) {
        const p = crowd.add(content, { ...o, meta: { themeId: st.themeId, itemId: st.itemId } });
        if (p) st.people.push(p);
        return p || { handR: new THREE.Vector3(), handL: new THREE.Vector3() };
      },
      anim(fn) { st.anims.push(fn); },
      toLocal(v) { return content.worldToLocal(v.clone()); },
      attach(mesh, person, hand = 'handR') {
        st.anims.push(() => { mesh.position.copy(content.worldToLocal(person[hand].clone())); });
        return mesh;
      },
    };
  }

  function disposeStage() {
    if (!stage) return;
    stage.people.forEach((p) => crowd.remove(p));
    scene.remove(stage.root);
    stage.root.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    stage.ownMaterials.forEach((m) => m.dispose());
    stage.beam.material.dispose();
    islands.get(stage.themeId)?.label.classList.remove('is-hidden-label');
    labelRenderer.domElement.classList.remove('staging');
    stage = null;
  }

  function showVignette(themeId, itemId) {
    const isle = islands.get(themeId);
    if (!isle) return;
    if (stage && stage.itemId === itemId) return;
    disposeStage();
    const { build, opts } = sceneFor(themeId, itemId);
    if (!build) return;
    const root = new THREE.Group();
    root.position.set(isle.pos.x, STAGE_Y, isle.pos.z);
    root.rotation.y = isle.root.rotation.y;
    scene.add(root);
    const base = islandBase(2.15, 777 + itemId.length * 13).group;
    base.scale.set(1, 0.5, 1);
    root.add(base);
    // 光束：從島連到舞台
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.18, STAGE_Y - 1.45 - 1.0, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: isle.theme.color, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    beam.position.y = -(STAGE_Y - 1.45 - 1.0) / 2 - 1.0;
    beam.userData.dynamic = true;
    root.add(beam);
    const content = new THREE.Group();
    content.position.y = STAGE_TOP;
    root.add(content);
    stage = { root, content, themeId, itemId, people: [], anims: [], ownMaterials: [], t0: elapsed, beam };
    root.updateMatrixWorld(true);
    try {
      build(makeKit(stage, isle.theme.color), opts);
    } catch (err) {
      console.warn('場景建立失敗', itemId, err);
    }
    mergeStatic(base);
    mergeStatic(content);
    root.scale.setScalar(0.01);
    isle.label.classList.add('is-hidden-label');
    labelRenderer.domElement.classList.add('staging');
  }

  function updateStage(dt) {
    if (!stage) return;
    const t = elapsed - stage.t0;
    const k = Math.min(t / 0.45, 1);
    const s = k < 1 ? 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2) : 1; // 輕微回彈
    stage.root.scale.setScalar(Math.max(0.01, s));
    stage.root.position.y = STAGE_Y + Math.sin(elapsed * 0.9) * 0.08;
    for (const fn of stage.anims) fn(t);
  }

  // ---------- 居民對話泡泡 ----------
  // 被點的人停下來揮手；泡泡掛在他所在的島（或小舞台）上，跟著一起浮動，不會亂跑
  const bubbleAnchor = new THREE.Object3D();
  let bubble = null; // { person, obj }
  function showBubble(person, el) {
    hideBubble();
    person.hold = true;
    person.anchor.add(bubbleAnchor);
    person.anchor.updateMatrixWorld(true);
    bubbleAnchor.position.copy(person.anchor.worldToLocal(person.head.clone()));
    bubbleAnchor.position.y += 0.12;
    const obj = new CSS2DObject(el);
    bubbleAnchor.add(obj);
    bubble = { person, obj };
    labelRenderer.domElement.classList.add('bubbling');
  }
  function hideBubble() {
    if (!bubble) return;
    bubble.person.hold = false;
    labelRenderer.domElement.classList.remove('bubbling');
    bubbleAnchor.remove(bubble.obj);
    bubble.obj.element.remove();
    bubbleAnchor.parent?.remove(bubbleAnchor);
    bubble = null;
  }
  function updateBubble() {
    if (!bubble) return;
    if (!crowd.alive(bubble.person)) { hideBubble(); onBubbleGone?.(); }
  }
  let onBubbleGone = null;

  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  function syncBeacons() {
    for (const b of beaconList) {
      const { pole, orb, poleIndex, orbMesh, orbIndex, shown } = b.userData;
      poleMesh.setMatrixAt(poleIndex, shown ? pole.matrixWorld : hiddenMatrix);
      orbMesh.setMatrixAt(orbIndex, shown ? orb.matrixWorld : hiddenMatrix);
    }
    poleMesh.instanceMatrix.needsUpdate = true;
    orbMeshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  }

  // 中央臺北島
  {
    const group = hexBase(4242);
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
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.05, 6), M.pave);
    plaza.position.y = 0.02;
    plaza.receiveShadow = true;
    c.add(plaza);
    const rand = rng(9);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const r = 2.85 + rand() * 0.2;
      treeSpots.push(new THREE.Vector3(Math.cos(a) * r, TOP, Math.sin(a) * r));
    }
    mergeStatic(group);
    const el = document.createElement('div');
    el.className = 'center-label';
    el.innerHTML = '<b>臺北</b><span>2022–2026</span>';
    const lbl = new CSS2DObject(el);
    lbl.position.set(0, y + 4.6, 0);
    group.add(lbl);
  }

  // ---------- 環狀高架輕軌：繞著群島外圍的水面 ----------
  const ringR = 20;
  const ringPts = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    ringPts.push(new THREE.Vector3(Math.cos(a) * ringR, 2.6 + Math.sin(a * 3) * 0.25, Math.sin(a) * ringR));
  }
  const ringCurve = new THREE.CatmullRomCurve3(ringPts, true);
  const trackGroup = new THREE.Group();
  scene.add(trackGroup);
  const track = new THREE.Mesh(new THREE.TubeGeometry(ringCurve, 256, 0.14, 6, true), M.rail);
  track.castShadow = true;
  trackGroup.add(track);
  for (let i = 0; i < 36; i++) {
    const p = ringCurve.getPointAt(i / 36);
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, p.y, 6), M.concrete);
    pylon.position.set(p.x, p.y / 2, p.z);
    pylon.castShadow = true;
    trackGroup.add(pylon);
  }
  mergeStatic(trackGroup);
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
    b.userData = { r: 26 + i * 5, speed: 0.04 + i * 0.012, phase: i * 2.1 };
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
    mergeStatic(c).forEach((m) => { m.castShadow = false; m.receiveShadow = false; });
    c.position.set(-70 + crand() * 140, 24 + crand() * 8, -70 + crand() * 90);
    c.scale.setScalar(1.4 + crand());
    c.userData.speed = 0.6 + crand() * 0.6;
    scene.add(c);
    clouds.push(c);
  }

  // ---------- 背景地形：北側高山森林（盆地感），其他方向是低丘與海岸 ----------
  {
    const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
    const vnoise = (x, z) => {
      const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
      const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
      const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const fbm = (x, z) => { let s = 0, amp = 1, f = 1; for (let o = 0; o < 4; o++) { s += amp * vnoise(x * f, z * f); amp *= 0.5; f *= 2.03; } return s / 1.875; };
    const height = (x, z) => {
      const d = Math.hypot(x, z * 1.1);
      const land = THREE.MathUtils.smoothstep(d, 36, 66); // 群島周圍保持海面
      const north = THREE.MathUtils.clamp((-z - 6) / 95, 0, 1); // 北側越高
      const n = fbm(x * 0.028 + 10, z * 0.028 + 3);
      return land * (3 + n * 12 + north * north * 38 * (0.55 + n)) - 3.2;
    };
    const seg = isSmall ? 72 : 120;
    const geo = new THREE.PlaneGeometry(400, 400, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cSand = new THREE.Color('#e9d6ac'), cGrass = new THREE.Color('#b6cf8f'), cForest = new THREE.Color('#7fa86a'), cHigh = new THREE.Color('#5f8a57'), cRock = new THREE.Color('#b9a888');
    const tmpC = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const h = height(pos.getX(i), pos.getZ(i));
      pos.setY(i, h);
      if (h < 0.8) tmpC.copy(cSand);
      else if (h < 5) tmpC.copy(cGrass).lerp(cForest, (h - 0.8) / 4.2);
      else if (h < 22) tmpC.copy(cForest).lerp(cHigh, (h - 5) / 17);
      else tmpC.copy(cHigh).lerp(cRock, Math.min((h - 22) / 14, 1));
      colors.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    scene.add(terrain);

    // 山坡森林：一次畫完的 InstancedMesh
    const rand = rng(2026);
    const spots = [];
    for (let k = 0; k < 14000 && spots.length < (isSmall ? 1100 : 2400); k++) {
      const x = (rand() - 0.5) * 300, z = -170 + rand() * 230;
      const h = height(x, z);
      if (h > 1.4 && h < 34 && rand() < 0.9) spots.push([x, h, z, 0.45 + rand() * 0.5]);
    }
    const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(0.9, 2.4, 6), mat('#5f9157'), spots.length);
    const crowns2 = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.0, 0), mat('#7aa863'), spots.length);
    const d = new THREE.Object3D();
    spots.forEach(([x, h, z, s], i) => {
      d.position.set(x, h + 1.0 * s, z); d.scale.setScalar(s); d.rotation.y = rand() * 3; d.updateMatrix();
      crowns.setMatrixAt(i, d.matrix);
      d.position.set(x + 0.8 * s, h + 0.6 * s, z + 0.5 * s); d.scale.setScalar(s * 0.7); d.updateMatrix();
      crowns2.setMatrixAt(i, d.matrix);
    });
    scene.add(crowns, crowns2);

    // 海岸小聚落
    const houses = [];
    for (let k = 0; k < 2000 && houses.length < 26; k++) {
      const x = (rand() - 0.5) * 220, z = (rand() - 0.5) * 220;
      const h = height(x, z);
      if (h > 0.9 && h < 4.5) houses.push([x, h, z, rand() * Math.PI]);
    }
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1.1, 1.1), mat('#f4ece0'), houses.length);
    const roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 0.8, 4), mat('#e08a5c'), houses.length);
    houses.forEach(([x, h, z, r], i) => {
      d.position.set(x, h + 0.55, z); d.rotation.set(0, r, 0); d.scale.setScalar(1); d.updateMatrix(); walls.setMatrixAt(i, d.matrix);
      d.position.set(x, h + 1.5, z); d.rotation.set(0, r + Math.PI / 4, 0); d.updateMatrix(); roofs.setMatrixAt(i, d.matrix);
    });
    scene.add(walls, roofs);
  }

  // ---------- 衛星小島：燈塔、風車、沙灘、礁岩、梯田 ----------
  {
    const islet = (x, z, r, seed) => {
      const g = islandBase(r, seed).group;
      g.scale.set(1, 0.38, 1);
      const root = new THREE.Group();
      root.position.set(x, 0, z);
      root.add(g);
      const top = new THREE.Group();
      top.position.y = TOP * 0.38;
      root.add(top);
      scene.add(root);
      return { root, top };
    };
    const lh = islet(25, 9, 2.4, 51);
    for (let i = 0; i < 5; i++) lh.top.add(cyl(0.42 - i * 0.04, 0.46 - i * 0.04, 0.55, 10, i % 2 ? mat('#d9604f') : M.white, 0.4, i * 0.55, -0.2));
    lh.top.add(cyl(0.3, 0.3, 0.35, 8, M.glass, 0.4, 2.75, -0.2));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), glow('#ffd88a', 0.4));
    lamp.position.set(0.4, 2.95, -0.2);
    lh.top.add(lamp);
    lh.top.add(box(0.9, 0.6, 0.7, M.white, -0.8, 0, 0.5));
    animators.push((t) => { lamp.material.emissiveIntensity = 0.4 + (Math.sin(t * 2) * 0.5 + 0.5) * 1.2; });

    const wm = islet(-28, -4, 3.0, 52);
    for (const [x, z, ph] of [[-0.8, 0.2, 0], [1.0, -0.6, 1.3]]) {
      wm.top.add(cyl(0.06, 0.1, 2.6, 6, M.white, x, 0, z));
      const hub = new THREE.Group();
      hub.position.set(x, 2.6, z + 0.12);
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.03), M.white);
        blade.geometry.translate(0, 0.55, 0);
        blade.rotation.z = (i / 3) * Math.PI * 2;
        hub.add(blade);
      }
      wm.top.add(dyn(hub));
      animators.push((t) => { hub.rotation.z = t * 1.2 + ph; });
    }

    const beach = islet(15, 27, 2.6, 53);
    [['#e46a8c', -0.8, 0.3], ['#f2c14e', 0.2, -0.4], ['#2f7dd3', 0.9, 0.5]].forEach(([c, x, z]) => {
      beach.top.add(cyl(0.025, 0.025, 0.8, 5, M.white, x, 0, z));
      beach.top.add(cyl(0, 0.55, 0.25, 8, mat(c), x, 0.7, z));
      beach.top.add(box(0.35, 0.03, 0.7, mat(c), x + 0.3, 0, z + 0.3));
    });

    const rocks = islet(-20, 25, 2.0, 54);
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + (i % 3) * 0.2, 0), M.rockDark);
      r.position.set(Math.cos(i * 1.3) * 0.8, 0.25, Math.sin(i * 1.3) * 0.8);
      r.rotation.set(i, i * 2, 0);
      r.castShadow = true;
      rocks.top.add(r);
    }

    const terrace = islet(-31, 15, 3.0, 55);
    [2.4, 1.9, 1.4, 0.9].forEach((r, i) => terrace.top.add(cyl(r, r + 0.15, 0.35, 12, mat(i % 2 ? '#9cc27a' : '#b6d494'), 0, i * 0.35, 0)));

    const grove = islet(29, -15, 2.6, 56);
    grove.root.updateMatrixWorld(true);
    for (let i = 0; i < 5; i++) {
      const v = grove.root.localToWorld(new THREE.Vector3(Math.cos(i * 1.25) * 1.2, TOP * 0.38, Math.sin(i * 1.25) * 1.2));
      treeSpots.push(v);
    }
    [lh, wm, beach, rocks, terrace, grove].forEach(({ root }) => mergeStatic(root));
  }
  buildTrees(treeSpots);

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
      if (!beacon.userData.shown) return { themeId: d.themeId };
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
  const personAt = (clientX, clientY, touch) => {
    const rect = renderer.domElement.getBoundingClientRect();
    return crowd.nearest(camera, clientX - rect.left, clientY - rect.top, rect.width, rect.height, touch ? 34 : 22);
  };
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const person = personAt(e.clientX, e.clientY, false);
    if (person) { setHover(null); renderer.domElement.style.cursor = 'pointer'; return; }
    setHover(pick(e.clientX, e.clientY), e.clientX, e.clientY);
  });
  el.addEventListener('pointerleave', () => setHover(null));
  el.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 7) return;
    const person = personAt(e.clientX, e.clientY, e.pointerType === 'touch');
    if (person && onSelectPerson) { onSelectPerson(person.meta, person); return; }
    if (bubble) { hideBubble(); onBubbleGone?.(); } // 點別處就收起泡泡
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
    if (!focused || !panel) {
      // 沒選島時：把地圖放在「沒被介面蓋住」的區域中央
      // 桌機：左邊可能有介紹卡、右邊有索引欄；手機：上有標題列、下有介紹卡或狀態列
      const W = container.clientWidth, H = container.clientHeight;
      const shown = (el) => el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'
        && !el.classList.contains('is-hidden') && !el.classList.contains('is-hidden-ui') && parseFloat(getComputedStyle(el).opacity) > 0.05;
      const rect = (id) => document.getElementById(id)?.getBoundingClientRect();
      const hero = document.getElementById('hero'), idx = document.getElementById('index'), legend = document.getElementById('legend');
      const bar = document.querySelector('.topbar');
      let L = 0, R = W, T = bar ? bar.getBoundingClientRect().bottom : 0, B = H;
      const tb = document.getElementById('timebar');
      if (shown(tb)) T = Math.max(T, rect('timebar').bottom);
      if (small) {
        if (shown(hero)) B = rect('hero').top;
        else if (shown(legend)) B = rect('legend').top;
      } else {
        if (shown(hero)) L = rect('hero').right;
        if (shown(idx)) R = rect('index').left;
      }
      inset.tx = W / 2 - (L + R) / 2;
      inset.ty = H / 2 - (T + B) / 2;
      return;
    }
    // 手機：面板在下、標題列在上，焦點放在兩者之間；桌機：面板在右
    const bar = document.querySelector('.topbar');
    if (small) { inset.tx = 0; inset.ty = (panel.offsetHeight - (bar ? bar.offsetHeight + 8 : 0)) / 2; } else { inset.tx = (panel.offsetWidth + 12) / 2; inset.ty = 0; }
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
    // 模型都朝 +z，所以鏡頭從南側（+z）略偏向該格所在的一側看過去
    const out = new THREE.Vector3(isle.pos.x * 0.05, 0, 1).normalize();
    // 鏡頭對準島上方的政策小舞台，島本身在畫面下緣
    const target = isle.pos.clone().setY(STAGE_Y + 1.1);
    const camPos = isle.pos.clone().add(out.multiplyScalar(small ? 12.5 : 9.0)).setY(STAGE_Y + (small ? 5.6 : 4.0));
    setInset();
    flyTo(camPos, target);
  }

  function resetView() {
    focused = null;
    disposeStage();
    setInset();
    flyTo(HOME.pos, HOME.target, 1.4);
  }

  // ---------- filters / modes ----------
  let statusFilter = null;
  // 日期字串 → 時間戳；只有年或年月的，取該期間中段
  const toTime = (d) => {
    if (!d) return Infinity;
    const [y, m, day] = d.split('-').map(Number);
    if (!m) return Date.UTC(y, 6, 1);
    if (!day) return Date.UTC(y, m - 1, 15);
    return Date.UTC(y, m - 1, day);
  };
  beaconList.forEach((b) => { b.userData.t = toTime(b.userData.item.date); });

  let timeCut = null; // null = 不依時間篩選
  function applyBeaconFilters({ flashNew = false } = {}) {
    const appeared = [];
    islands.forEach((isle) => {
      let shown = 0;
      isle.beacons.forEach((b) => {
        const ok = (!statusFilter || b.userData.item.status === statusFilter) && (timeCut === null || b.userData.t <= timeCut);
        if (ok && !b.userData.shown && flashNew) { b.userData.flash = 1; appeared.push(b.userData.item); }
        b.userData.shown = ok;
        if (ok) shown++;
      });
      const filtering = !!statusFilter || timeCut !== null;
      isle.label.classList.toggle('is-dim', filtering && shown === 0);
      const small = isle.label.querySelector('small');
      if (small) small.textContent = filtering ? `${shown}/${isle.beacons.length}` : String(isle.beacons.length);
    });
    return appeared;
  }
  function setStatusFilter(s) {
    statusFilter = s;
    applyBeaconFilters();
  }
  function setTimeCut(t) {
    const prev = timeCut;
    timeCut = t;
    // 往後拖時，新出現的光點彈跳一下
    return applyBeaconFilters({ flashNew: t !== null && prev !== null && t > prev });
  }


  let paused = false;
  const setPaused = (p) => { paused = p; };

  // ---------- 畫質分級：低幀率時逐步降級（?quality=high 關閉自動調整，?quality=low 直接最低）----------
  const qualityParam = new URLSearchParams(location.search).get('quality');
  const maxDpr = Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2);
  let tier = 0; // 0 全畫質 → 1 降解析度 → 2 關陰影 → 3 停裝飾動畫
  function setTier(t) {
    tier = t;
    renderer.setPixelRatio(tier >= 1 ? Math.min(maxDpr, 1) : maxDpr);
    const shadows = tier < 2;
    if (renderer.shadowMap.enabled !== shadows) {
      renderer.shadowMap.enabled = shadows;
      sun.castShadow = shadows;
      scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    }
    onResize();
  }
  const perf = { frames: 0, time: 0, lastChange: 0 };
  function adapt(rawDt, now) {
    if (qualityParam === 'high' || tier >= 3) return;
    if (now < 3000 || now - perf.lastChange < 3000) return; // 開場與剛降級時先觀察
    perf.frames++;
    perf.time += rawDt;
    if (perf.time < 2) return;
    const fps = perf.frames / perf.time;
    perf.frames = 0;
    perf.time = 0;
    // 手機閒置時上限 30fps，所以門檻放在 24
    if (fps < 24) { perf.lastChange = now; setTier(tier + 1); }
  }

  // 互動中（拖曳、飛行、hover）全速；閒置時手機降到 30fps 省電
  let lastInput = 0;
  const markInput = () => { lastInput = performance.now(); };
  ['pointerdown', 'pointermove', 'wheel', 'touchstart'].forEach((ev) => renderer.domElement.addEventListener(ev, markInput, { passive: true }));
  let skipAcc = 0;

  const flashItem = (themeId, itemId) => {
    const isle = islands.get(themeId);
    const b = isle?.beacons.find((x) => x.userData.item.id === itemId);
    if (b) b.userData.flash = 1;
  };

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let elapsed = 0;
  const tmpColor = new THREE.Color();

  // 時段：從目前的光線內插到目標時段
  const cur = toPalette(TIMES.day);
  let todFrom = null, todTo = PALETTES.day, todT = 1, todKey = 'day';
  const snapshot = (p) => ({
    sky: p.sky.clone(), fog: p.fog.clone(), water: p.water.clone(), shallow: p.shallow.clone(), hemiSky: p.hemiSky.clone(),
    hemiGround: p.hemiGround.clone(), hemi: p.hemi, sun: p.sun.clone(), sunI: p.sunI, sunPos: p.sunPos.clone(), glow: p.glow, cloud: p.cloud,
  });
  function applyPalette(p) {
    scene.background.copy(p.sky);
    scene.fog.color.copy(p.fog);
    waterMat.color.copy(p.water);
    waterShallow.value.copy(p.shallow);
    hemi.color.copy(p.hemiSky);
    hemi.groundColor.copy(p.hemiGround);
    hemi.intensity = p.hemi;
    sun.color.copy(p.sun);
    sun.intensity = p.sunI;
    sun.position.copy(p.sunPos);
    const k = p.glow;
    glowMats.forEach((m) => {
      if (m === windowMat) m.emissiveIntensity = THREE.MathUtils.lerp(m.userData.base, 1.3, k);
      else if (m.userData.base !== undefined && m !== cyanMat) m.emissiveIntensity = THREE.MathUtils.lerp(m.userData.base, 1.4, k);
    });
    cyanMat.emissiveIntensity = THREE.MathUtils.lerp(0.6, 1.6, k);
    cloudMat.opacity = p.cloud;
  }
  function setTimeOfDay(key) {
    if (!PALETTES[key]) return;
    todKey = key;
    todFrom = snapshot(cur);
    todTo = PALETTES[key];
    todT = reduceMotion ? 0.999 : 0;
  }
  function stepTimeOfDay(dt) {
    if (todT >= 1) return false;
    todT = Math.min(1, todT + dt / 1.4);
    const k = easeInOut(todT);
    for (const key of ['sky', 'fog', 'water', 'shallow', 'hemiSky', 'hemiGround', 'sun']) cur[key].copy(todFrom[key]).lerp(todTo[key], k);
    for (const key of ['hemi', 'sunI', 'glow', 'cloud']) cur[key] = THREE.MathUtils.lerp(todFrom[key], todTo[key], k);
    cur.sunPos.copy(todFrom.sunPos).lerp(todTo.sunPos, k);
    applyPalette(cur);
    return true;
  }
  const setNight = (on) => setTimeOfDay(on ? 'night' : 'day');

  function frame(now) {
    // 清單／時間軸蓋住整個畫面時完全不繪製
    if (paused) { clock.getDelta(); return; }
    const t = performance.now();
    const busy = tween || t - lastInput < 1500 || todT < 1;
    if (isSmall && !busy) {
      skipAcc += clock.getDelta();
      if (skipAcc < 1 / 30) return;
    } else {
      skipAcc += clock.getDelta();
    }
    const rawDt = skipAcc;
    skipAcc = 0;
    const dt = Math.min(rawDt, 0.05);
    adapt(rawDt, now ?? t);
    {
      const decor = tier < 3 && !reduceMotion;
      elapsed += reduceMotion ? 0 : dt;
      if (decor) waterTime.value = elapsed;

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
      if (decor) clouds.forEach((c) => { c.position.x += c.userData.speed * dt; if (c.position.x > 75) c.position.x = -75; });

      islands.forEach((isle, id) => {
        const wantHover = hovered?.themeId === id ? 1 : 0;
        const wantActive = focused === id ? 1 : 0;
        isle.hover += (wantHover - isle.hover) * 0.15;
        isle.active += (wantActive - isle.active) * 0.1;
        isle.halo.material.opacity = Math.max(isle.hover * 0.55, isle.active * 0.8);
        isle.halo.visible = isle.halo.material.opacity > 0.01;
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

      stepTimeOfDay(rawDt);
    }

    if (tween) {
      const raw = Math.min((performance.now() - tween.start) / tween.dur, 1);
      const k = easeInOut(raw);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromT, tween.toT, k);
      if (raw >= 1) tween = null;
    }
    updateStage(dt);
    controls.update();
    applyInset(rawDt);
    scene.updateMatrixWorld();
    crowd.update(elapsed);
    updateBubble();
    syncBeacons();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);
  // 分頁切到背景時完全停止
  document.addEventListener('visibilitychange', () => {
    renderer.setAnimationLoop(document.hidden ? null : frame);
    clock.getDelta();
  });

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
      const people = [];
      const v = new THREE.Vector3();
      crowd.each((p) => {
        if (!p.meta) return;
        v.copy(p.head).project(camera);
        people.push({ ...p.meta, x: Math.round((v.x + 1) / 2 * container.clientWidth), y: Math.round((1 - v.y) / 2 * container.clientHeight) });
      });
      let meshes = 0;
      scene.traverse((o) => { if (o.isMesh) meshes++; });
      return {
        people, cam: camera.position.toArray().map((v) => +v.toFixed(2)), target: controls.target.toArray().map((v) => +v.toFixed(2)), inset: [inset.x, inset.tx], focused, view: camera.view, out,
        info: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, meshes, pixelRatio: renderer.getPixelRatio(), shadows: renderer.shadowMap.enabled },
      };
    };
  }

  // 開場：從遠處推近
  flyTo(HOME.pos, HOME.target, 2.4);
  applyPalette(cur);
  setInset();
  inset.x = inset.tx; // 開場直接到位，不要滑動

  return {
    focusTheme, resetView, setStatusFilter, setTimeCut, refreshLayout: setInset,
    showBubble, hideBubble, onBubbleGone: (fn) => { onBubbleGone = fn; }, setNight, setTimeOfDay, getTimeOfDay: () => todKey,
    setPaused, flashItem, showVignette, hideVignette: disposeStage, labelLayer: labelRenderer.domElement,
  };
}
