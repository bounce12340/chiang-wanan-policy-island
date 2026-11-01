// 烘焙環境光遮蔽（AO）與建築立面細節
// 做法參考 Athenaion（Leon Lin，MIT）「用簡單遮擋體近似天空可見度」的思路，程式為本站另行撰寫：
//   1. 合併靜態網格時，記下每個原始物件的包圍盒當作遮擋體。
//   2. 對合併後網格的每個頂點，往法線半球射出十多條短射線，被包圍盒擋住的比例就是遮蔽量。
//   3. 結果存成頂點屬性 aOcc，著色器用它壓暗間接光（天光）與少量直射光：牆角、屋簷下、建築貼地處會自然變暗。
// 計算在瀏覽器空閒時分批進行，不擋住開場；算完之前 aOcc 為 0，畫面與原本相同。
// 另外，高的方塊（建築）會標記 aFac，著色器在牆面畫出淡淡的樓層分隔線與面板色差。

const AO_RAYS = 12;
const AO_RANGE = 0.9; // 射線長度（場景單位，建築約 1–3）
const CELL = 1.0;

// 法線半球的取樣方向（以 +Z 為法線的局部座標，cosine 加權）
const HEMI = (() => {
  const out = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < AO_RAYS; i++) {
    const r = Math.sqrt((i + 0.5) / AO_RAYS);
    const a = g * i;
    out.push([Math.cos(a) * r, Math.sin(a) * r, Math.sqrt(1 - r * r)]);
  }
  return out;
})();

// ---------- 材質：只替合併後的網格換上「會讀 aOcc／aFac」的版本，其他網格完全不受影響 ----------
const variants = new WeakMap();
function patch(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aOcc;\nattribute float aFac;\nvarying float vOcc;\nvarying float vFac;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOcc = aOcc;\nvFac = aFac;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
varying float vOcc;
varying float vFac;
varying vec3 vWPos;
varying vec3 vWNrm;
float facHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
if (vFac > 0.5 && abs(vWNrm.y) < 0.35) {
  // 樓層分隔線（約每 0.45 單位一層）與面板間細微色差
  float fl = fract(vWPos.y / 0.45 + 0.08);
  float band = smoothstep(0.0, 0.05, fl) - smoothstep(0.05, 0.1, fl);
  vec2 cell = floor(vec2(dot(vWPos.xz, vec2(-vWNrm.z, vWNrm.x)) / 0.32, vWPos.y / 0.45));
  float tint = (facHash(cell) - 0.5) * 0.06;
  diffuseColor.rgb *= (1.0 - band * 0.16) * (1.0 + tint);
}`)
    .replace('#include <aomap_fragment>', `#include <aomap_fragment>
reflectedLight.indirectDiffuse *= 1.0 - vOcc * 0.78;
reflectedLight.indirectSpecular *= 1.0 - vOcc * 0.6;
reflectedLight.directDiffuse *= 1.0 - vOcc * 0.32;`);
}
export function aoMaterial(m) {
  if (!m || !m.isMeshStandardMaterial || m.userData.noAO) return m;
  let v = variants.get(m);
  if (!v) {
    v = m.clone();
    v.color = m.color; // 共用顏色物件：原材質之後若改色，這裡同步
    v.emissive = m.emissive;
    v.onBeforeCompile = patch;
    v.customProgramCacheKey = () => 'ao-fac-1';
    v.userData = { ...m.userData, aoVariant: true };
    variants.set(m, v);
  }
  return v;
}

// ---------- 遮擋體與分批計算 ----------
const queue = [];
let running = false;

/** @param {THREE.Mesh[]} meshes 合併後的網格；@param {number[][]} boxes 遮擋體 [minx,miny,minz,maxx,maxy,maxz]（與網格同一座標系） */
export function scheduleAO(meshes, boxes) {
  if (!boxes.length) return;
  const grid = new Map();
  boxes.forEach((b, i) => {
    for (let x = Math.floor(b[0] / CELL); x <= Math.floor(b[3] / CELL); x++)
      for (let y = Math.floor(b[1] / CELL); y <= Math.floor(b[4] / CELL); y++)
        for (let z = Math.floor(b[2] / CELL); z <= Math.floor(b[5] / CELL); z++) {
          const k = `${x},${y},${z}`;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(i);
        }
  });
  meshes.forEach((mesh) => {
    const occ = mesh.geometry.getAttribute('aOcc');
    if (occ) queue.push({ mesh, occ, boxes, grid, i: 0, cache: new Map(), stamp: new Uint32Array(boxes.length), tick: 0 });
  });
  if (!running) { running = true; idle(step); }
}
// 全部算完約 0.2 秒（桌機），所以每批最多佔 10 毫秒、批次之間讓出主執行緒，畫面不會卡
const idle = (fn) => setTimeout(fn, 0);

function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let t0 = 0, t1 = AO_RANGE;
  for (let a = 0; a < 3; a++) {
    const o = a === 0 ? ox : a === 1 ? oy : oz, d = a === 0 ? dx : a === 1 ? dy : dz;
    const lo = b[a], hi = b[a + 3];
    if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) return -1; continue; }
    let ta = (lo - o) / d, tb = (hi - o) / d;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  return t0;
}

function vertexOcc(job, px, py, pz, nx, ny, nz) {
  // 起點沿法線外推一點，避免打到自己所在的面
  const ox = px + nx * 0.015, oy = py + ny * 0.015 + 0.004, oz = pz + nz * 0.015;
  // 候選遮擋體：附近格子裡的包圍盒（以 stamp 去重）
  job.tick++;
  const cand = [];
  const r = AO_RANGE;
  for (let x = Math.floor((ox - r) / CELL); x <= Math.floor((ox + r) / CELL); x++)
    for (let y = Math.floor((oy - r) / CELL); y <= Math.floor((oy + r) / CELL); y++)
      for (let z = Math.floor((oz - r) / CELL); z <= Math.floor((oz + r) / CELL); z++) {
        const list = job.grid.get(`${x},${y},${z}`);
        if (!list) continue;
        for (const bi of list) {
          if (job.stamp[bi] === job.tick) continue;
          job.stamp[bi] = job.tick;
          const b = job.boxes[bi];
          // 起點在盒子裡面（例如自己所在的物件、包住它的大地形）就不算它
          if (ox > b[0] && ox < b[3] && oy > b[1] && oy < b[4] && oz > b[2] && oz < b[5]) continue;
          cand.push(b);
        }
      }
  if (!cand.length) return 0;
  // 以法線建立切線座標
  let tx, ty, tz;
  if (Math.abs(ny) < 0.9) { tx = nz; ty = 0; tz = -nx; } else { tx = 1; ty = 0; tz = 0; }
  let l = Math.hypot(tx, ty, tz); tx /= l; ty /= l; tz /= l;
  const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
  let hit = 0;
  for (const [hx, hy, hz] of HEMI) {
    const dx = tx * hx + bx * hy + nx * hz, dy = ty * hx + by * hy + ny * hz, dz = tz * hx + bz * hy + nz * hz;
    let best = -1;
    for (const b of cand) {
      const t = rayBox(ox, oy, oz, dx, dy, dz, b);
      if (t >= 0 && (best < 0 || t < best)) best = t;
    }
    if (best >= 0) hit += 1 - (best / AO_RANGE) * 0.6; // 越近的遮擋越暗
  }
  return Math.min(1, hit / AO_RAYS);
}

let spent = 0, verts = 0, uniq = 0;
export const aoStats = () => ({ spent: Math.round(spent), verts, uniq, pending: queue.length });
function step() {
  const t0 = performance.now();
  const until = performance.now() + 10;
  while (queue.length && performance.now() < until) {
    const job = queue[0];
    const { mesh, occ } = job;
    if (!mesh.parent || !mesh.geometry.getAttribute('position')) { queue.shift(); continue; }
    const pos = mesh.geometry.getAttribute('position');
    const nrm = mesh.geometry.getAttribute('normal');
    const end = Math.min(pos.count, job.i + 400);
    for (let i = job.i; i < end; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
      const key = `${px.toFixed(3)},${py.toFixed(3)},${pz.toFixed(3)},${nx.toFixed(2)},${ny.toFixed(2)},${nz.toFixed(2)}`;
      let v = job.cache.get(key);
      if (v === undefined) { v = vertexOcc(job, px, py, pz, nx, ny, nz); job.cache.set(key, v); uniq++; }
      verts++;
      occ.setX(i, v);
    }
    job.i = end;
    if (end >= pos.count) { occ.needsUpdate = true; queue.shift(); }
  }
  spent += performance.now() - t0;
  if (queue.length) idle(step);
  else running = false;
}

/** 測試／除錯用：還有幾個網格在排隊 */
export const aoPending = () => queue.length;
