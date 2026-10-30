// 小人系統：全場所有人物共用 7 個 InstancedMesh（軀幹、頭、頭髮、左右臂、左右腿），
// 不論場上有幾個人，繪製呼叫都固定，手機也跑得動。
import * as THREE from 'three';

const SKIN = ['#f1c9a5', '#e0ac85', '#c68c63', '#8d5a3b', '#f6d7bd'];
const HAIR = { young: ['#2b2220', '#4a3426', '#1d1a1a', '#6b4a2f'], senior: ['#d9d6d0', '#b9b5ad', '#eeeeee'] };
const SHIRT = ['#2f7dd3', '#e46a8c', '#f2c14e', '#4caf50', '#6c5ce7', '#f08c3a', '#20a39e', '#ffffff', '#d64545'];
const PANTS = ['#2b2f45', '#3d4a66', '#5c6170', '#7a5638', '#1f2a44'];

// 人物尺寸（未縮放時約 0.62 單位高）
const DIM = {
  hip: 0.3, torsoH: 0.22, torsoW: 0.18, torsoD: 0.11, headR: 0.075, headY: 0.6,
  shoulderY: 0.5, shoulderX: 0.12, armL: 0.2, legL: 0.28, legX: 0.045,
};

export function createCrowd(scene, capacity = 96) {
  const mk = (geo) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.8 }), capacity);
    m.castShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < capacity; i++) { m.setMatrixAt(i, ZERO); m.setColorAt(i, WHITE); }
    scene.add(m);
    return m;
  };
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const WHITE = new THREE.Color('#ffffff');

  // 四肢的幾何中心往下移，讓旋轉軸落在肩膀／髖關節
  const armGeo = new THREE.BoxGeometry(0.05, DIM.armL, 0.05).translate(0, -DIM.armL / 2, 0);
  const legGeo = new THREE.BoxGeometry(0.065, DIM.legL, 0.07).translate(0, -DIM.legL / 2, 0);
  const hairGeo = new THREE.SphereGeometry(DIM.headR * 1.06, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const parts = {
    torso: mk(new THREE.BoxGeometry(DIM.torsoW, DIM.torsoH, DIM.torsoD)),
    head: mk(new THREE.SphereGeometry(DIM.headR, 8, 6)),
    hair: mk(hairGeo),
    armL: mk(armGeo), armR: mk(armGeo),
    legL: mk(legGeo), legR: mk(legGeo),
  };

  const people = new Array(capacity).fill(null);
  const free = [];
  for (let i = capacity - 1; i >= 0; i--) free.push(i);

  let seed = 7;
  const pick = (arr) => { seed = (seed * 9301 + 49297) % 233280; return arr[Math.floor((seed / 233280) * arr.length)]; };

  /**
   * 新增一個人。
   * @param {THREE.Object3D} anchor 跟著哪個物件移動（島或小舞台）
   * @param {object} o x, z, y, rot, anim, scale, phase, speed, shirt, pants, skin, hair,
   *   senior(老人：灰髮、動作慢), kid(小孩：縮小), path([[x,z],...] 沿路徑走)
   */
  function add(anchor, o = {}) {
    const i = free.pop();
    if (i === undefined) return null;
    const senior = !!o.senior;
    const p = {
      i, anchor,
      x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0, rot: o.rot ?? 0,
      anim: o.anim || 'idle', holdAnim: o.holdAnim || 'wave', phase: o.phase ?? Math.random() * 6,
      speed: (o.speed ?? 1) * (senior ? 0.6 : 1),
      scale: (o.scale ?? 1) * (o.kid ? 0.68 : 1),
      path: o.path || null, pathT: o.pathT ?? 0, pathLen: 0,
      handR: new THREE.Vector3(), handL: new THREE.Vector3(),
      head: new THREE.Vector3(), // 頭部的世界座標，給點選與對話泡泡用
      meta: o.meta || null, // 這個人代表的政策 {themeId, itemId}
    };
    if (p.path) {
      p.segs = [];
      for (let k = 0; k < p.path.length; k++) {
        const a = p.path[k], b = p.path[(k + 1) % p.path.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        p.segs.push({ a, b, len });
        p.pathLen += len;
      }
    }
    const shirt = new THREE.Color(o.shirt || pick(SHIRT));
    const pants = new THREE.Color(o.pants || pick(PANTS));
    const skin = new THREE.Color(o.skin || pick(SKIN));
    const hair = new THREE.Color(o.hair || pick(senior ? HAIR.senior : HAIR.young));
    parts.torso.setColorAt(i, shirt);
    parts.armL.setColorAt(i, shirt);
    parts.armR.setColorAt(i, shirt);
    parts.legL.setColorAt(i, pants);
    parts.legR.setColorAt(i, pants);
    parts.head.setColorAt(i, skin);
    parts.hair.setColorAt(i, hair);
    Object.values(parts).forEach((m) => { m.instanceColor.needsUpdate = true; });
    people[i] = p;
    return p;
  }

  function remove(p) {
    if (!p || people[p.i] !== p) return;
    people[p.i] = null;
    Object.values(parts).forEach((m) => m.setMatrixAt(p.i, ZERO));
    free.push(p.i);
  }

  // 每種動作回傳：跳躍高度、身體傾斜、四肢角度（x 前後擺、z 向外張）
  function pose(anim, t, ph) {
    const s = Math.sin(t + ph);
    const out = { jump: 0, lean: 0, sway: 0, lx: 0, lz: 0.08, rx: 0, rz: -0.08, llx: 0, lrx: 0, sit: 0 };
    switch (anim) {
      case 'walk':
      case 'jog': {
        const amp = anim === 'jog' ? 0.75 : 0.5;
        const w = Math.sin(t * (anim === 'jog' ? 9 : 6) + ph);
        out.llx = w * amp; out.lrx = -w * amp; out.lx = -w * amp * 0.8; out.rx = w * amp * 0.8;
        out.jump = anim === 'jog' ? Math.abs(w) * 0.03 : Math.abs(w) * 0.01;
        out.lean = anim === 'jog' ? 0.12 : 0;
        break;
      }
      case 'cheer': {
        const k = Math.sin(t * 7 + ph);
        out.lz = 2.7 + k * 0.25; out.rz = -2.7 - k * 0.25;
        out.jump = Math.max(0, k) * 0.09;
        break;
      }
      case 'wave':
        out.rz = -2.5 - Math.sin(t * 9 + ph) * 0.35;
        out.sway = s * 0.05;
        break;
      case 'clap': {
        const k = Math.sin(t * 14 + ph);
        out.lx = -1.25; out.rx = -1.25; out.lz = -0.25 - k * 0.2; out.rz = 0.25 + k * 0.2;
        break;
      }
      case 'give':
        out.rx = -1.35 + Math.sin(t * 2 + ph) * 0.08;
        out.lean = 0.08;
        break;
      case 'receive':
        out.lx = -1.15; out.rx = -1.15; out.lz = -0.15; out.rz = 0.15;
        out.jump = Math.max(0, Math.sin(t * 5 + ph)) * 0.03;
        break;
      case 'carry':
        out.lx = -1.0; out.rx = -1.0; out.lz = -0.2; out.rz = 0.2;
        break;
      case 'point':
        out.rx = -1.9; out.rz = -0.2;
        break;
      case 'sit':
        out.sit = 1; out.llx = -1.5; out.lrx = -1.5; out.lx = -0.5; out.rx = -0.5;
        break;
      case 'exercise': {
        const k = Math.sin(t * 2.4 + ph);
        out.lz = 1.6 + k * 1.1; out.rz = -1.6 - k * 1.1; out.sit = 1; out.llx = -1.5; out.lrx = -1.5;
        break;
      }
      case 'duck': // 地震演練：趴下、雙手護頭
        out.sit = 1; out.lean = 0.55; out.llx = -1.5; out.lrx = -1.5; out.lx = -2.5; out.rx = -2.5; out.lz = 0.5; out.rz = -0.5;
        break;
      case 'salute':
        out.rx = -0.4; out.rz = -2.3;
        break;
      case 'work': {
        const k = Math.sin(t * 5 + ph);
        out.rx = -1.0 + k * 0.5; out.lx = -0.6; out.lean = 0.2;
        break;
      }
      case 'type':
        out.sit = 1; out.llx = -1.5; out.lrx = -1.5; out.lx = -1.2; out.rx = -1.2;
        out.lz = Math.sin(t * 18 + ph) * 0.05; out.rz = -Math.sin(t * 18 + ph + 1) * 0.05;
        break;
      default: // idle
        out.sway = s * 0.04;
        out.lx = Math.sin(t * 1.3 + ph) * 0.05; out.rx = -out.lx;
    }
    return out;
  }

  // 暫存物件，避免每幀配置記憶體
  const base = new THREE.Matrix4(), m = new THREE.Matrix4(), local = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const tip = new THREE.Vector3();

  function limb(part, i, x, y, rx, rz) {
    e.set(rx, 0, rz);
    q.setFromEuler(e);
    local.compose(v.set(x, y, 0), q, sc.set(1, 1, 1));
    m.multiplyMatrices(base, local);
    part.setMatrixAt(i, m);
    return m;
  }

  // 全體暫時改做同一個動作（例如地震演練時一起趴下），null 恢復原本動作
  let override = null;
  function setOverride(a) { override = a; }
  function update(t) {
    // 只繪製到最後一個在場的人，空名額不送進 GPU
    let maxI = -1;
    for (const p of people) if (p && p.i > maxI) maxI = p.i;
    Object.values(parts).forEach((mesh) => { mesh.count = maxI + 1; });
    for (const p of people) {
      if (!p) continue;
      const tt = t * p.speed;
      // 沿路徑移動（被點選時停下來，hold 期間不走）
      const held = p.hold || !!override;
      if (held) p.holdT = (p.holdT ?? tt) ; else if (p.holdT !== undefined) { p.pathT -= ((tt - p.holdT) * (p.anim === 'jog' ? 0.5 : 0.28)) / (p.pathLen || 1); p.holdT = undefined; }
      if (p.path && p.pathLen > 0 && !held) {
        let d = ((tt * (p.anim === 'jog' ? 0.5 : 0.28) + p.pathT * p.pathLen) % p.pathLen + p.pathLen) % p.pathLen;
        for (const sg of p.segs) {
          if (d <= sg.len) {
            const k = d / sg.len;
            p.x = sg.a[0] + (sg.b[0] - sg.a[0]) * k;
            p.z = sg.a[1] + (sg.b[1] - sg.a[1]) * k;
            p.rot = Math.atan2(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]);
            break;
          }
          d -= sg.len;
        }
      }
      const P = pose(override || (p.hold ? p.holdAnim : p.anim), tt, p.phase);
      const sitDrop = P.sit * 0.14;
      e.set(P.lean, p.rot, P.sway, 'YXZ');
      q.setFromEuler(e);
      base.compose(v.set(p.x, p.y + P.jump - sitDrop, p.z), q, sc.setScalar(p.scale));
      base.premultiply(p.anchor.matrixWorld);

      local.makeTranslation(0, DIM.hip + DIM.torsoH / 2 + 0.01, 0);
      parts.torso.setMatrixAt(p.i, m.multiplyMatrices(base, local));
      local.makeTranslation(0, DIM.headY, 0);
      parts.head.setMatrixAt(p.i, m.multiplyMatrices(base, local));
      p.head.setFromMatrixPosition(m);
      local.makeTranslation(0, DIM.headY + 0.01, 0);
      parts.hair.setMatrixAt(p.i, m.multiplyMatrices(base, local));
      limb(parts.legL, p.i, -DIM.legX, DIM.hip, P.llx, 0);
      limb(parts.legR, p.i, DIM.legX, DIM.hip, P.lrx, 0);
      limb(parts.armL, p.i, -DIM.shoulderX, DIM.shoulderY, P.lx, P.lz);
      p.handL.copy(tip.set(0, -DIM.armL, 0).applyMatrix4(m));
      limb(parts.armR, p.i, DIM.shoulderX, DIM.shoulderY, P.rx, P.rz);
      p.handR.copy(tip.set(0, -DIM.armL, 0).applyMatrix4(m));
    }
    Object.values(parts).forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
  }

  // 螢幕座標點選：找離指標最近、在半徑內的人（人物很小，直接射線很難點中，手機更是）
  const proj = new THREE.Vector3();
  function nearest(camera, x, y, width, height, radius = 26) {
    let best = null, bestD = radius;
    for (const p of people) {
      if (!p || !p.meta) continue;
      for (const dy of [0, -0.22 * p.scale]) { // 頭和身體中段都算
        proj.copy(p.head);
        proj.y += dy;
        proj.project(camera);
        if (proj.z > 1 || proj.z < -1) continue;
        const sx = (proj.x + 1) / 2 * width, sy = (1 - proj.y) / 2 * height;
        const d = Math.hypot(sx - x, sy - y);
        if (d < bestD) { bestD = d; best = p; }
      }
    }
    return best;
  }

  const alive = (p) => !!p && people[p.i] === p;
  return { add, remove, update, setOverride, nearest, alive, each: (fn) => people.forEach((p) => p && fn(p)), count: () => people.filter(Boolean).length };
}
