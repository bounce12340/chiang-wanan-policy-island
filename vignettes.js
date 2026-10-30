// 每項政策的專屬小場景。每個場景是一個函式，透過 kit（k）在浮空小舞台上擺放模型與小人。
// 舞台半徑約 2，原點在草地表面，人物正面朝 +z（鏡頭方向）。

// ---------- 共用小道具 ----------
function building(k, x, z, w, h, d, color, { floors = 0, roof = null, rot = 0 } = {}) {
  k.box(w, h, d, color, x, 0, z, { rot });
  if (floors) {
    const cols = Math.max(2, Math.round(w / 0.28));
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        k.box((w / cols) * 0.45, (h / floors) * 0.35, 0.03, 'window',
          x - w / 2 + (w / cols) * (c + 0.5), 0.15 + ((h - 0.25) / floors) * (f + 0.5) - (h / floors) * 0.175, z + d / 2 + 0.01, { rot });
      }
    }
  }
  if (roof) k.box(w + 0.06, 0.08, d + 0.06, roof, x, h, z, { rot });
}
function sign(k, x, z, color, { h = 0.9, w = 0.6, text = null, rot = 0 } = {}) {
  k.cyl(0.03, 0.03, h, 5, '#c9c4b8', x, 0, z);
  k.box(w, 0.36, 0.05, color, x, h - 0.05, z, { rot });
  if (text) k.box(w * 0.7, 0.07, 0.06, '#ffffff', x, h + 0.1, z, { rot });
}
function bus(k, x, z, rot, color, { driverless = false, group = null } = {}) {
  const g = group || k.group(x, 0, z, rot);
  k.box(1.5, 0.55, 0.6, color, 0, 0.1, 0, { parent: g });
  k.box(1.4, 0.2, 0.62, 'window', 0, 0.38, 0, { parent: g });
  for (const wx of [-0.45, 0.45]) for (const wz of [-0.3, 0.3]) k.cyl(0.11, 0.11, 0.08, 10, '#2b2f45', wx, 0.11, wz, { parent: g, rx: Math.PI / 2 });
  if (driverless) k.sphere(0.1, '#4fd6ff', 0.55, 0.68, 0, { parent: g, glow: true });
  return g;
}
function bench(k, x, z, rot = 0) {
  k.box(0.7, 0.06, 0.22, '#7a5638', x, 0.2, z, { rot });
  k.box(0.7, 0.2, 0.05, '#7a5638', x, 0.26, z - 0.1, { rot });
}
function crane(k, x, z, h, color) {
  k.box(0.1, h, 0.1, color, x, 0, z);
  k.box(1.6, 0.08, 0.1, color, x - 0.5, h - 0.1, z);
  k.box(0.25, 0.2, 0.2, '#c9c4b8', x + 0.25, h - 0.3, z);
  const hook = k.box(0.04, 0.5, 0.04, '#2b2f45', x - 1.0, h - 0.65, z, { dyn: true });
  k.anim((t) => { hook.position.y = h - 0.9 + Math.sin(t * 0.8) * 0.2; });
}
function table(k, x, z, w = 1.2, d = 0.5, color = '#f4f1ea') {
  k.box(w, 0.05, d, color, x, 0.34, z);
  for (const dx of [-w / 2 + 0.06, w / 2 - 0.06]) for (const dz of [-d / 2 + 0.06, d / 2 - 0.06]) k.box(0.04, 0.34, 0.04, '#8a8478', x + dx, 0, z + dz);
}
function fence(k, x0, z0, x1, z1, color = '#f2c14e') {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.3));
  for (let i = 0; i <= n; i++) k.box(0.05, 0.3, 0.05, color, x0 + ((x1 - x0) * i) / n, 0, z0 + ((z1 - z0) * i) / n);
  k.box(Math.hypot(x1 - x0, z1 - z0), 0.04, 0.03, color, (x0 + x1) / 2, 0.24, (z0 + z1) / 2, { rot: -Math.atan2(z1 - z0, x1 - x0) });
}
function road(k, x, z, w, d, rot = 0) {
  k.box(w, 0.02, d, '#5c6170', x, 0, z, { rot });
}
function tree(k, x, z, s = 1) { k.tree(x, z, s); }
// 一瓶牛奶／一個物品在兩人手中來回傳遞
function handoff(k, giver, receiver, mesh, period = 3.2) {
  k.anim((t) => {
    const c = (t % period) / period;
    const a = k.toLocal(giver.handR), b = k.toLocal(receiver.handR);
    if (c < 0.35) mesh.position.copy(a);
    else if (c < 0.55) mesh.position.lerpVectors(a, b, (c - 0.35) / 0.2);
    else mesh.position.copy(b);
    mesh.position.y -= 0.02;
  });
}
function holdInHand(k, person, mesh, hand = 'handR') {
  k.anim(() => { mesh.position.copy(k.toLocal(person[hand])); });
}

// ---------- 場景 ----------
export const SCENES = {
  // ===== 交通 =====
  metroOpen(k) {
    k.box(3.6, 0.5, 1.0, '#c9c4b8', 0, 0, -0.7);
    k.box(3.6, 0.04, 0.2, '#f2c14e', 0, 0.5, -0.15);
    const train = k.group(0, 0.5, -0.8);
    for (let i = 0; i < 3; i++) {
      k.box(1.05, 0.5, 0.55, i === 0 ? k.color : '#f4f1ea', -1.1 + i * 1.1, 0.04, 0, { parent: train });
      k.box(0.9, 0.16, 0.57, 'window', -1.1 + i * 1.1, 0.3, 0, { parent: train });
    }
    k.anim((t) => { const c = t % 8; train.position.x = c < 2 ? (2 - c) * 2.2 : c < 6 ? 0 : -(c - 6) * 2.2; train.visible = Math.abs(train.position.x) < 4.4; });
    k.box(0.9, 0.9, 0.06, k.color, 1.4, 0.5, -1.15);
    k.person({ x: -0.6, z: 0.5, anim: 'walk', path: [[-1.4, 0.4], [1.3, 0.4], [1.3, 0.9], [-1.4, 0.9]] });
    k.person({ x: 0.3, z: 0.6, anim: 'walk', path: [[1.2, 0.7], [-1.3, 0.7], [-1.3, 1.1], [1.2, 1.1]], pathT: 0.5 });
    k.person({ x: -1.2, z: 1.3, anim: 'cheer' });
    k.person({ x: 1.0, z: 1.4, anim: 'wave', kid: true });
  },
  tunnel(k, { pct = null } = {}) {
    k.box(2.0, 1.2, 1.0, '#8a6a4a', -0.4, 0, -0.9);
    k.cyl(0.45, 0.45, 0.2, 16, '#2b2f45', -0.4, 0.5, -0.38, { rx: Math.PI / 2 });
    k.cyl(0.42, 0.42, 0.6, 16, '#f2c14e', -0.4, 0.5, 0.1, { rx: Math.PI / 2 });
    const bit = k.cyl(0.44, 0.44, 0.05, 8, '#c9c4b8', -0.4, 0.5, 0.42, { rx: Math.PI / 2, dyn: true });
    k.anim((t) => { bit.rotation.y = t * 2; });
    crane(k, 1.3, -0.8, 1.8, k.color);
    k.person({ x: 0.8, z: 0.6, anim: 'work', shirt: '#f08c3a' });
    k.person({ x: 1.4, z: 0.9, anim: 'point', shirt: '#f08c3a', rot: -0.6 });
    if (pct) { k.box(1.1, 0.12, 0.06, '#e0ddd5', 0.5, 1.45, -0.35); k.box(1.1 * pct, 0.12, 0.07, '#2e9e5b', 0.5 - 0.55 + 0.55 * pct, 1.45, -0.34); }
  },
  viaduct(k) {
    for (const x of [-1.3, -0.2, 0.9]) k.box(0.22, 1.3, 0.22, '#c9c4b8', x, 0, -0.5);
    k.box(2.6, 0.18, 0.5, '#d8d2c3', -0.2, 1.3, -0.5);
    const seg = k.box(0.9, 0.18, 0.5, '#d8d2c3', 1.6, 1.8, -0.5, { dyn: true });
    k.anim((t) => { const c = (t % 6) / 6; seg.position.y = 2.4 - Math.min(c * 2, 1) * 0.92; });
    crane(k, 1.6, 0.4, 2.6, k.color);
    k.person({ x: -0.8, z: 0.6, anim: 'work', shirt: '#f08c3a' });
    k.person({ x: 0.4, z: 0.9, anim: 'point', shirt: '#f2c14e' });
    sign(k, -1.5, 1.0, k.color);
  },
  blueprint(k) {
    table(k, 0, 0, 1.6, 0.8);
    k.box(1.2, 0.01, 0.6, '#2f6fb3', 0, 0.39, 0);
    for (let i = 0; i < 4; i++) k.box(0.9, 0.012, 0.02, '#ffffff', 0, 0.4, -0.2 + i * 0.13, { rot: i * 0.2 });
    k.box(0.3, 0.12, 0.22, '#f4f1ea', -0.6, 0.39, 0.2);
    k.person({ x: -0.5, z: 0.65, anim: 'point', rot: Math.PI });
    k.person({ x: 0.5, z: 0.65, anim: 'idle', rot: Math.PI });
    k.person({ x: 0, z: -0.7, anim: 'point' });
    sign(k, 1.4, -0.9, '#d99a14');
  },
  youbike(k) {
    road(k, 0, 0.4, 3.8, 0.8);
    for (let i = 0; i < 4; i++) {
      const x = -1.5 + i * 0.35;
      k.box(0.05, 0.45, 0.05, '#f2c14e', x, 0, -0.9);
      k.box(0.3, 0.04, 0.05, '#f08c3a', x, 0.35, -0.75, { rot: Math.PI / 2 });
    }
    const bikes = [];
    for (let i = 0; i < 2; i++) {
      const g = k.group(0, 0, 0.2 + i * 0.35);
      k.cyl(0.14, 0.14, 0.03, 12, '#2b2f45', -0.22, 0.14, 0, { parent: g, rx: Math.PI / 2 });
      k.cyl(0.14, 0.14, 0.03, 12, '#2b2f45', 0.22, 0.14, 0, { parent: g, rx: Math.PI / 2 });
      k.box(0.46, 0.05, 0.04, '#f2c14e', 0, 0.3, 0, { parent: g });
      bikes.push(g);
      const rider = k.person({ x: 0, z: 0.2 + i * 0.35, anim: 'sit', rot: Math.PI / 2, y: 0.22 });
      k.anim((t) => { const x = ((t * 0.6 + i * 1.8) % 4) - 2; g.position.x = x; rider.x = x; });
    }
    k.person({ x: 1.3, z: -0.4, anim: 'wave' });
  },
  crosswalk(k) {
    road(k, 0, 0, 4, 1.2);
    for (let i = 0; i < 6; i++) k.box(0.18, 0.025, 1.0, '#f7f3e8', -0.9 + i * 0.36, 0, 0);
    k.box(0.1, 1.0, 0.1, '#2b2f45', -1.6, 0, -0.8);
    const light = k.sphere(0.08, '#2e9e5b', -1.6, 1.05, -0.74, { glow: true, dyn: true });
    k.anim((t) => { light.visible = (t % 2) < 1.6; });
    k.person({ anim: 'walk', path: [[-0.6, -0.9], [-0.6, 0.9]], speed: 1 });
    k.person({ anim: 'walk', path: [[0.4, 0.9], [0.4, -0.9]], pathT: 0.3 });
    k.person({ anim: 'walk', path: [[0.0, -0.9], [0.0, 0.9]], pathT: 0.6, kid: true });
    k.person({ x: 1.4, z: 1.1, anim: 'idle', senior: true });
  },
  busStop(k) {
    road(k, 0, -0.2, 4, 0.9);
    k.box(1.8, 0.02, 0.12, '#d64545', -0.2, 0, 0.32);
    k.box(1.0, 0.8, 0.05, '#c9e2f2', 0.9, 0, 0.75);
    k.box(1.1, 0.06, 0.4, k.color, 0.9, 0.82, 0.6);
    bus(k, -0.4, -0.25, 0, k.color);
    k.person({ x: 0.5, z: 0.6, anim: 'walk', path: [[0.9, 0.6], [0.0, 0.35]], speed: 0.6 });
    k.person({ x: 1.2, z: 0.55, anim: 'idle', senior: true });
    k.person({ x: 1.5, z: 0.6, anim: 'idle', kid: true });
  },
  autonomous(k) {
    k.box(3.6, 0.02, 3.6, '#5c6170', 0, 0, 0);
    k.cyl(1.1, 1.1, 0.03, 32, '#8cc084', 0, 0, 0);
    const g = k.group(0, 0, 0);
    const b = bus(k, 0, 0, 0, '#20a39e', { driverless: true, group: k.group(0, 0, 1.4, 0, g) });
    k.anim((t) => { g.rotation.y = -t * 0.5; });
    k.person({ x: -1.6, z: 1.6, anim: 'wave', kid: true });
    k.person({ x: -1.3, z: 1.7, anim: 'wave' });
    sign(k, 1.6, 1.5, '#4fd6ff');
  },

  // ===== 城市發展 =====
  airportPark(k) {
    road(k, -0.3, 0, 4.0, 0.9, 0.3);
    const plane = k.group(-1.2, 0.05, 0.35, 0.3);
    k.box(1.0, 0.18, 0.18, '#f4f1ea', 0, 0.1, 0, { parent: plane });
    k.box(0.22, 0.04, 1.0, '#f4f1ea', 0, 0.12, 0, { parent: plane });
    k.box(0.16, 0.25, 0.04, '#2f7dd3', -0.45, 0.2, 0, { parent: plane });
    for (const [x, z] of [[0.6, -0.4], [1.0, 0.4], [1.4, -0.2], [0.9, -1.1], [1.6, 0.9], [0.2, 1.3], [-0.4, -1.4]]) tree(k, x, z, 0.9);
    const kite = k.box(0.22, 0.22, 0.02, '#e46a8c', 0.5, 1.8, 0.8, { dyn: true, rot: 0.785 });
    const kid = k.person({ x: 0.9, z: 1.0, anim: 'point', kid: true, rot: -2.4 });
    k.anim((t) => { kite.position.set(0.4 + Math.sin(t * 0.7) * 0.3, 1.8 + Math.sin(t * 1.3) * 0.15, 0.5); });
    k.person({ x: 1.3, z: 1.2, anim: 'wave' });
    k.person({ x: 0.2, z: 0.3, anim: 'jog', path: [[0.2, -0.6], [1.6, -0.2], [1.2, 1.4], [0.0, 1.0]] });
  },
  debate(k) {
    table(k, 0, 0, 1.8, 0.6);
    for (const [x, z, rot, shirt] of [[-0.5, -0.55, 0, '#2b2f45'], [0.5, -0.55, 0, '#2b2f45'], [-0.5, 0.55, Math.PI, '#ffffff'], [0.5, 0.55, Math.PI, '#ffffff']]) {
      k.person({ x, z, rot, anim: 'sit', shirt, y: 0.12 });
    }
    k.box(0.5, 0.02, 0.3, '#f4f1ea', 0, 0.4, 0);
    k.sphere(0.12, '#d99a14', 0, 1.4, 0, { glow: true });
    k.box(0.7, 0.3, 0.05, '#ffffff', -1.4, 0.9, -0.6);
    k.cyl(0.03, 0.03, 0.9, 5, '#c9c4b8', -1.4, 0, -0.6);
  },
  twinTowers(k) {
    building(k, -0.6, -0.4, 0.75, 2.4, 0.75, '#6f8fb3', { floors: 8 });
    building(k, 0.5, -0.5, 0.85, 3.1, 0.85, '#6f8fb3', { floors: 10 });
    crane(k, 1.4, 0.1, 3.4, k.color);
    k.box(0.9, 0.5, 0.9, '#d8d2c3', 0.5, 3.1, -0.5);
    k.person({ x: -1.2, z: 1.0, anim: 'point', rot: 0.4 });
    k.person({ x: -0.8, z: 1.2, anim: 'idle' });
  },
  busTerminal(k) {
    building(k, -0.3, -0.7, 2.6, 1.4, 0.9, '#f4f1ea', { floors: 3, roof: k.color });
    road(k, 0, 0.5, 4, 0.8);
    bus(k, -0.6, 0.5, 0, '#2f7dd3');
    bus(k, 1.2, 0.5, 0, '#f08c3a');
    k.person({ anim: 'walk', path: [[-1.6, 1.3], [1.6, 1.3]] });
    const p = k.person({ x: 0.6, z: 1.4, anim: 'walk', path: [[1.5, 1.45], [-1.5, 1.45]], pathT: 0.4 });
    k.attach(k.box(0.14, 0.18, 0.08, '#d64545', 0, 0, 0, { dyn: true }), p, 'handR');
  },
  highriseBuild(k) {
    building(k, -0.6, -0.5, 0.9, 2.6, 0.9, '#f3e3cf', { floors: 7, roof: k.color });
    building(k, 0.5, -0.4, 0.9, 1.6, 0.9, '#c9c4b8');
    for (let i = 0; i < 4; i++) k.box(0.92, 0.04, 0.92, '#f2c14e', 0.5, 1.6 + i * 0.25, -0.4);
    crane(k, 1.4, 0.3, 3.0, k.color);
    k.person({ x: 0.2, z: 0.8, anim: 'work', shirt: '#f08c3a' });
    k.person({ x: -0.8, z: 0.9, anim: 'carry', shirt: '#f2c14e' });
  },

  // ===== 產業科技 =====
  signing(k) {
    table(k, 0, -0.1, 1.4, 0.5, '#2b2f45');
    k.box(0.4, 0.01, 0.28, '#ffffff', -0.3, 0.39, -0.1);
    k.box(0.4, 0.01, 0.28, '#ffffff', 0.3, 0.39, -0.1);
    k.box(1.6, 0.9, 0.05, '#2b2f45', 0, 0.4, -0.9);
    k.box(0.5, 0.5, 0.06, '#4fd6ff', 0, 0.6, -0.86, { glow: true });
    const a = k.person({ x: -0.25, z: 0.45, anim: 'give', rot: Math.PI / 2, shirt: '#2b2f45' });
    const b = k.person({ x: 0.25, z: 0.45, anim: 'give', rot: -Math.PI / 2, shirt: '#2b2f45', phase: 1 });
    k.person({ x: -1.2, z: 1.1, anim: 'clap' });
    k.person({ x: 1.2, z: 1.1, anim: 'clap', phase: 2 });
  },
  hqBuild(k) {
    fence(k, -1.5, -1.2, 1.5, -1.2);
    fence(k, -1.5, -1.2, -1.5, 0.6);
    fence(k, 1.5, -1.2, 1.5, 0.6);
    k.box(2.6, 0.02, 1.6, '#a7825c', 0, 0, -0.3);
    const exc = k.group(-0.4, 0, -0.4);
    k.box(0.7, 0.35, 0.45, '#f2c14e', 0, 0.1, 0, { parent: exc });
    const arm = k.group(0.35, 0.4, 0, 0, exc);
    k.box(0.7, 0.08, 0.08, '#f2c14e', 0.35, 0, 0, { parent: arm });
    k.anim((t) => { arm.rotation.z = -0.3 + Math.sin(t * 1.2) * 0.35; });
    k.box(0.06, 1.8, 0.06, '#c9c4b8', 1.0, 0, -0.6);
    for (let i = 0; i < 3; i++) k.box(0.5, 0.04, 0.04, '#c9c4b8', 1.0, 1.2 + i * 0.2, -0.6);
    sign(k, -1.2, 1.0, '#6c5ce7');
    k.person({ x: 0.6, z: 1.0, anim: 'point', shirt: '#f08c3a' });
  },
  landPlots(k) {
    for (const [x, z, c] of [[-1.0, -0.5, '#b8d89a'], [0.1, -0.6, '#c7e0a8'], [1.1, -0.3, '#a9cf8b']]) {
      k.box(0.9, 0.03, 0.9, c, x, 0, z);
      k.cyl(0.02, 0.02, 0.7, 5, '#c9c4b8', x + 0.35, 0, z - 0.35);
      k.box(0.25, 0.15, 0.02, k.color, x + 0.47, 0.6, z - 0.35);
    }
    k.person({ x: -0.6, z: 0.8, anim: 'point', rot: Math.PI * 0.9 });
    k.person({ x: 0.2, z: 0.9, anim: 'idle', rot: Math.PI });
    k.person({ x: 0.9, z: 0.8, anim: 'work', rot: Math.PI });
  },
  corridor(k) {
    const pts = [[-1.4, 0.6], [0, -0.7], [1.4, 0.5]];
    pts.forEach(([x, z], i) => {
      building(k, x, z, 0.5, 0.8 + i * 0.3, 0.5, '#6f8fb3', { floors: 2 + i });
      k.cyl(0.4, 0.4, 0.02, 20, '#c7e0a8', x, 0, z);
    });
    const dot = k.sphere(0.1, '#4fd6ff', 0, 0.5, 0, { glow: true, dyn: true });
    k.box(1.9, 0.04, 0.06, '#4fd6ff', -0.7, 0.1, -0.05, { rot: 0.75, glow: true });
    k.box(1.9, 0.04, 0.06, '#4fd6ff', 0.7, 0.1, -0.1, { rot: -0.7, glow: true });
    k.anim((t) => {
      const c = (t * 0.3) % 2;
      const [a, b] = c < 1 ? [pts[0], pts[1]] : [pts[1], pts[2]];
      const f = c % 1;
      dot.position.set(a[0] + (b[0] - a[0]) * f, 0.3, a[1] + (b[1] - a[1]) * f);
    });
    k.person({ x: 0, z: 1.2, anim: 'point' });
  },
  survey(k) {
    k.box(2.6, 0.03, 1.8, '#a9cf8b', 0, 0, -0.2);
    fence(k, -1.3, -1.1, 1.3, -1.1, '#8a8478');
    for (const a of [0, 2.1, 4.2]) k.box(0.03, 0.55, 0.03, '#2b2f45', 0.2 + Math.cos(a) * 0.15, 0, 0.3 + Math.sin(a) * 0.15, { rot: a });
    k.box(0.15, 0.12, 0.12, '#f2c14e', 0.2, 0.55, 0.3);
    k.person({ x: 0.5, z: 0.5, anim: 'work', shirt: '#f08c3a', rot: -1.2 });
    k.person({ x: -0.9, z: 0.3, anim: 'wave', shirt: '#f08c3a' });
  },
  startup(k) {
    for (const [x, z] of [[-0.8, -0.3], [0.8, -0.3]]) {
      table(k, x, z, 1.0, 0.5);
      k.box(0.3, 0.2, 0.02, '#2b2f45', x - 0.2, 0.39, z - 0.1);
      k.box(0.28, 0.17, 0.01, '#4fd6ff', x - 0.2, 0.41, z - 0.088, { glow: true });
      k.person({ x: x - 0.2, z: z + 0.45, anim: 'type', rot: Math.PI, y: 0.1 });
    }
    k.person({ x: -0.25, z: 1.0, anim: 'cheer' });
    k.person({ x: 0.25, z: 1.0, anim: 'cheer', phase: 1.5 });
    k.sphere(0.18, '#f2c14e', 0, 1.6, -0.6, { glow: true });
  },
  career(k) {
    k.box(1.4, 0.9, 0.08, k.color, 0, 0, -0.9);
    table(k, 0, -0.45, 1.3, 0.4);
    k.box(1.2, 0.3, 0.06, '#ffffff', 0, 0.95, -0.85);
    k.person({ x: 0, z: -0.85, anim: 'wave', shirt: '#2b2f45' });
    k.person({ x: -0.4, z: 0.3, anim: 'idle', rot: Math.PI });
    k.person({ x: 0.3, z: 0.5, anim: 'idle', rot: Math.PI });
    k.person({ anim: 'walk', path: [[-1.6, 1.2], [1.6, 1.2]] });
  },

  // ===== 居住 =====
  socialHousing(k) {
    building(k, -0.7, -0.6, 1.1, 2.2, 0.9, '#f3e3cf', { floors: 6, roof: k.color });
    building(k, 0.7, -0.7, 0.9, 1.7, 0.8, '#f4f1ea', { floors: 5, roof: k.color });
    const a = k.person({ x: -0.3, z: 0.7, anim: 'carry', rot: Math.PI, path: [[-0.3, 0.9], [-0.5, 0.0]], speed: 0.5 });
    k.attach(k.box(0.24, 0.2, 0.2, '#c49a6c', 0, 0, 0, { dyn: true }), a, 'handR');
    k.person({ x: 0.5, z: 0.6, anim: 'carry', path: [[0.6, 1.1], [0.6, 0.1]], speed: 0.5, pathT: 0.5 });
    k.person({ x: 1.3, z: 1.0, anim: 'wave', kid: true });
    for (let i = 0; i < 3; i++) k.box(0.24, 0.2, 0.2, '#c49a6c', 1.2 + (i % 2) * 0.26, i * 0.2, 0.3);
  },
  familyHome(k) {
    building(k, 0, -0.6, 1.4, 1.0, 1.0, '#f6ead8', { floors: 2 });
    k.cyl(0, 0.95, 0.5, 4, k.color, 0, 1.0, -0.6, { ry: Math.PI / 4 });
    k.box(0.3, 0.55, 0.04, '#7a5638', 0, 0, -0.08);
    k.sphere(0.13, '#e46a8c', 0, 2.0, -0.6, { glow: true });
    k.person({ x: -0.35, z: 0.6, anim: 'walk', path: [[-0.3, 1.4], [-0.3, 0.3]], speed: 0.4 });
    k.person({ x: 0.15, z: 0.6, anim: 'walk', path: [[0.1, 1.4], [0.1, 0.3]], speed: 0.4, pathT: 0.05 });
    const pram = k.group(0.45, 0, 0.7);
    k.box(0.3, 0.2, 0.42, '#f4f1ea', 0, 0.12, 0, { parent: pram });
    k.anim((t) => { pram.position.z = 1.4 - ((t * 0.4 * 0.28 * 1.1) % 1.1); });
  },
  keyHandover(k) {
    building(k, 0, -0.8, 1.6, 1.4, 0.8, '#f4f1ea', { floors: 3 });
    const landlord = k.person({ x: -0.3, z: 0.4, rot: Math.PI / 2, anim: 'give', senior: true });
    const tenant = k.person({ x: 0.3, z: 0.4, rot: -Math.PI / 2, anim: 'receive' });
    handoff(k, landlord, tenant, k.box(0.06, 0.12, 0.02, '#f2c14e', 0, 0, 0, { dyn: true }));
    sign(k, 1.3, 0.6, k.color, { text: true });
  },
  friendlyListing(k) {
    building(k, 0, -0.7, 1.4, 1.8, 0.9, '#f3e3cf', { floors: 5 });
    ['#2e9e5b', '#2f7dd3', '#e46a8c', '#f2c14e'].forEach((c, i) => k.box(0.24, 0.16, 0.03, c, -0.45 + i * 0.3, 1.9, -0.25));
    k.person({ x: -0.6, z: 0.6, anim: 'wave', senior: true });
    k.person({ x: 0, z: 0.7, anim: 'wave' });
    k.person({ x: 0.6, z: 0.6, anim: 'wave', kid: true });
  },
  renewal(k) {
    building(k, -0.8, -0.5, 0.8, 1.0, 0.8, '#b9a98a', { floors: 3 });
    k.box(0.1, 0.5, 0.03, '#5c4a3a', -0.9, 0.3, -0.09, { rot: 0.5 });
    building(k, 0.6, -0.6, 0.9, 2.6, 0.9, '#f4f1ea', { floors: 8, roof: k.color });
    const arrow = k.box(0.5, 0.08, 0.08, '#2e9e5b', -0.1, 1.2, -0.3, { dyn: true });
    k.anim((t) => { arrow.position.x = -0.15 + Math.sin(t * 2) * 0.08; });
    k.person({ x: -0.6, z: 0.6, anim: 'point', senior: true, rot: 0.5 });
    k.person({ x: 0.5, z: 0.7, anim: 'cheer' });
  },
  bigBlock(k) {
    k.box(3.0, 0.02, 2.0, '#d8d2c3', 0, 0, -0.3);
    building(k, -0.9, -0.7, 0.7, 2.0, 0.7, '#f4f1ea', { floors: 6, roof: k.color });
    building(k, 0.1, -0.8, 0.7, 2.4, 0.7, '#f3e3cf', { floors: 7, roof: k.color });
    building(k, 1.0, -0.6, 0.6, 1.4, 0.6, '#f4f1ea', { floors: 4, roof: '#e46a8c' });
    k.box(0.5, 0.25, 0.04, '#f2c14e', -0.2, 0, 0.3);
    k.person({ x: -0.6, z: 0.6, anim: 'sit', senior: true, y: 0.1 });
    bench(k, -0.6, 0.6, Math.PI);
    k.person({ x: 0.4, z: 0.7, anim: 'jog', kid: true, path: [[0.2, 0.5], [0.8, 0.5], [0.8, 1.0], [0.2, 1.0]] });
    k.person({ x: 0.9, z: 1.1, anim: 'wave', kid: true });
  },

  // ===== 育兒教育 =====
  newborn(k) {
    building(k, 0, -0.9, 1.6, 0.9, 0.6, '#f6ead8', { floors: 2 });
    const mom = k.person({ x: -0.2, z: 0.3, anim: 'receive', shirt: '#e46a8c' });
    const dad = k.person({ x: 0.25, z: 0.35, anim: 'wave', rot: -0.4 });
    holdInHand(k, mom, k.sphere(0.1, '#ffffff', 0, 0, 0, { dyn: true }));
    const gift = k.box(0.25, 0.25, 0.25, '#e46a8c', 0.8, 0, 0.5);
    k.box(0.27, 0.05, 0.27, '#f2c14e', 0.8, 0.25, 0.5);
    k.sphere(0.12, '#e46a8c', -0.05, 1.3, 0.3, { glow: true });
  },
  schoolLunch(k) {
    table(k, 0, 0, 2.4, 0.5);
    for (let i = 0; i < 4; i++) {
      const x = -0.9 + i * 0.6;
      k.box(0.3, 0.03, 0.2, '#c9c4b8', x, 0.39, 0.1);
      k.sphere(0.05, ['#f2c14e', '#4caf50', '#d64545', '#f08c3a'][i], x, 0.43, 0.1);
      k.person({ x, z: 0.5, anim: 'receive', kid: true, rot: Math.PI, y: 0.0, phase: i });
    }
    k.person({ x: 0, z: -0.6, anim: 'wave', shirt: '#ffffff' });
    k.box(0.5, 0.35, 0.3, '#c9c4b8', 1.4, 0, -0.6);
  },
  milkHandoff(k) {
    // 大人把一瓶鮮奶遞給孩子，旁邊一箱鮮奶
    building(k, 0, -1.0, 1.8, 0.9, 0.5, '#f6ead8', { floors: 2, roof: k.color });
    const crate = k.box(0.5, 0.25, 0.35, '#2f7dd3', -0.9, 0, 0.1);
    for (let i = 0; i < 6; i++) {
      k.cyl(0.04, 0.05, 0.16, 8, '#ffffff', -1.05 + (i % 3) * 0.15, 0.25, 0.02 + Math.floor(i / 3) * 0.15);
      k.cyl(0.03, 0.03, 0.03, 8, '#2f7dd3', -1.05 + (i % 3) * 0.15, 0.41, 0.02 + Math.floor(i / 3) * 0.15);
    }
    const adult = k.person({ x: -0.25, z: 0.3, rot: Math.PI / 2, anim: 'give' });
    const kid = k.person({ x: 0.3, z: 0.3, rot: -Math.PI / 2, anim: 'receive', kid: true });
    const bottle = k.group(0, 0, 0, 0, null, true);
    k.cyl(0.035, 0.045, 0.14, 8, '#ffffff', 0, -0.07, 0, { parent: bottle });
    k.cyl(0.028, 0.028, 0.03, 8, '#2f7dd3', 0, 0.07, 0, { parent: bottle });
    handoff(k, adult, kid, bottle);
    k.person({ x: 0.9, z: 0.8, anim: 'cheer', kid: true });
    k.person({ x: 0.6, z: 1.1, anim: 'walk', kid: true, path: [[1.4, 1.2], [0.6, 0.6]], speed: 0.4 });
  },
  parentPickup(k) {
    building(k, -0.8, -0.8, 1.0, 1.6, 0.7, '#6f8fb3', { floors: 5 });
    building(k, 0.9, -0.8, 1.0, 0.8, 0.7, '#f6ead8', { floors: 2, roof: k.color });
    k.cyl(0.18, 0.18, 0.04, 16, '#ffffff', -0.8, 1.7, -0.43, { rx: Math.PI / 2 });
    const hand = k.box(0.02, 0.14, 0.02, '#2b2f45', -0.8, 1.7, -0.4, { dyn: true });
    k.anim((t) => { hand.rotation.z = -t * 0.8; });
    const parent = k.person({ x: -0.1, z: 0.4, anim: 'receive', rot: Math.PI / 2 });
    k.person({ x: 0.5, z: 0.4, anim: 'jog', kid: true, path: [[0.8, 0.4], [0.2, 0.4]], speed: 0.5 });
  },
  nicu(k) {
    k.box(2.4, 1.2, 0.08, '#f4f1ea', 0, 0, -1.0);
    k.box(0.8, 0.4, 0.5, '#c9c4b8', -0.2, 0, -0.1);
    k.box(0.7, 0.3, 0.45, '#c9e2f2', -0.2, 0.4, -0.1);
    k.sphere(0.07, '#f6d7bd', -0.2, 0.45, -0.1);
    const mon = k.box(0.35, 0.25, 0.05, '#2b2f45', 0.6, 0.6, -0.6);
    const beat = k.box(0.04, 0.04, 0.02, '#2e9e5b', 0.6, 0.72, -0.57, { glow: true, dyn: true });
    k.anim((t) => { beat.position.x = 0.45 + ((t * 0.3) % 0.3); });
    k.person({ x: 0.5, z: 0.4, anim: 'point', shirt: '#20a39e', rot: -2.5 });
    k.person({ x: -0.9, z: 0.5, anim: 'idle', shirt: '#e46a8c', rot: 0.6 });
  },
  postpartum(k) {
    building(k, 0, -0.9, 1.6, 1.0, 0.6, '#f6ead8', { floors: 2 });
    table(k, 0.6, 0, 0.6, 0.5);
    k.cyl(0.12, 0.08, 0.1, 10, '#f4f1ea', 0.6, 0.39, 0);
    k.sphere(0.07, '#d99a14', 0.6, 0.47, 0);
    const mom = k.person({ x: -0.3, z: 0.2, anim: 'sit', shirt: '#e46a8c', y: 0.12 });
    bench(k, -0.3, 0.15);
    holdInHand(k, mom, k.sphere(0.09, '#ffffff', 0, 0, 0, { dyn: true }));
    k.person({ x: 1.1, z: 0.6, anim: 'give', rot: -2.4 });
  },
  kitchenInspect(k) {
    k.box(2.4, 0.5, 0.5, '#c9c4b8', 0, 0, -0.8);
    for (let i = 0; i < 3; i++) k.cyl(0.18, 0.15, 0.2, 10, '#8a8478', -0.8 + i * 0.8, 0.5, -0.8);
    const steam = k.sphere(0.1, '#ffffff', 0, 0.9, -0.8, { dyn: true });
    k.anim((t) => { steam.position.y = 0.8 + ((t * 0.4) % 0.6); steam.scale.setScalar(1 - ((t * 0.4) % 0.6)); });
    k.person({ x: -0.5, z: -0.3, anim: 'work', shirt: '#ffffff' });
    const insp = k.person({ x: 0.6, z: 0.3, anim: 'point', shirt: '#2f7dd3', rot: -2.6 });
    holdInHand(k, insp, k.box(0.16, 0.2, 0.02, '#f4f1ea', 0, 0, 0, { dyn: true }), 'handL');
    sign(k, 1.4, 0.9, '#d64545');
  },
  classroom(k) {
    k.box(1.8, 0.8, 0.06, '#2e5e4e', 0, 0.3, -1.0);
    for (let i = 0; i < 3; i++) k.box(0.9 - i * 0.2, 0.02, 0.02, '#ffffff', -0.1, 0.8 - i * 0.18, -0.96);
    k.person({ x: 0.6, z: -0.7, anim: 'point', rot: -0.4 });
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      table(k, -0.8 + c * 0.8, 0.1 + r * 0.7, 0.45, 0.3);
      k.person({ x: -0.8 + c * 0.8, z: 0.4 + r * 0.7, anim: c === 1 && r === 0 ? 'wave' : 'sit', kid: true, rot: Math.PI, y: 0.05, phase: r + c });
    }
  },
  aiClass(k) {
    for (let c = 0; c < 3; c++) {
      table(k, -0.8 + c * 0.8, 0, 0.5, 0.35);
      k.box(0.25, 0.16, 0.02, '#2b2f45', -0.8 + c * 0.8, 0.39, -0.08);
      k.box(0.23, 0.14, 0.01, '#4fd6ff', -0.8 + c * 0.8, 0.4, -0.068, { glow: true });
      k.person({ x: -0.8 + c * 0.8, z: 0.35, anim: 'type', kid: true, rot: Math.PI, y: 0.05 });
    }
    const bot = k.group(0, 0, -0.9);
    k.box(0.35, 0.4, 0.3, '#c9c4b8', 0, 0.15, 0, { parent: bot });
    k.box(0.28, 0.22, 0.25, '#f4f1ea', 0, 0.6, 0, { parent: bot });
    k.sphere(0.04, '#4fd6ff', -0.07, 0.65, 0.13, { parent: bot, glow: true });
    k.sphere(0.04, '#4fd6ff', 0.07, 0.65, 0.13, { parent: bot, glow: true });
    k.anim((t) => { bot.rotation.y = Math.sin(t) * 0.5; });
    k.person({ x: 1.2, z: 0.7, anim: 'point', rot: -2.4 });
  },

  // ===== 長者醫療 =====
  seniorCard(k) {
    road(k, 0, -0.3, 4, 0.8);
    bus(k, -0.3, -0.3, 0, '#20a39e');
    k.box(0.12, 0.6, 0.12, '#c9c4b8', 0.4, 0, 0.2);
    k.box(0.16, 0.12, 0.08, '#2e9e5b', 0.4, 0.55, 0.25, { glow: true });
    const s = k.person({ x: 0.7, z: 0.4, anim: 'give', senior: true, rot: -2.2 });
    k.attach(k.box(0.1, 0.07, 0.01, '#f2c14e', 0, 0, 0, { dyn: true }), s, 'handR');
    k.person({ x: 1.2, z: 0.8, anim: 'idle', senior: true });
  },
  seniorShop(k) {
    k.box(1.6, 0.5, 0.4, '#f4f1ea', 0, 0, -0.6);
    for (let i = 0; i < 4; i++) k.box(0.25, 0.2, 0.25, ['#d64545', '#4caf50', '#f2c14e', '#2f7dd3'][i], -0.6 + i * 0.4, 0.5, -0.65);
    k.person({ x: 0, z: -1.0, anim: 'wave', shirt: '#f08c3a' });
    const s = k.person({ x: 0, z: 0.0, anim: 'give', senior: true, rot: Math.PI });
    k.attach(k.box(0.1, 0.07, 0.01, '#f2c14e', 0, 0, 0, { dyn: true }), s, 'handR');
    k.person({ x: 0.9, z: 0.6, anim: 'carry', senior: true, path: [[1.4, 0.4], [0.4, 0.9]], speed: 0.6 });
  },
  dayCare(k) {
    k.cyl(1.4, 1.4, 0.02, 24, '#f3e3cf', 0, 0, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      k.person({ x: Math.cos(a) * 0.9, z: Math.sin(a) * 0.9, rot: -a - Math.PI / 2, anim: 'exercise', senior: true, phase: i * 0.2, y: 0.12 });
      k.box(0.25, 0.12, 0.25, '#7a5638', Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
    }
    k.person({ x: 0, z: 0, anim: 'cheer', shirt: '#20a39e' });
  },
  ambulanceECG(k) {
    building(k, -0.8, -0.8, 1.3, 1.3, 0.8, '#ffffff', { floors: 3 });
    k.box(0.4, 0.1, 0.1, k.color, -0.8, 1.35, -0.38);
    k.box(0.1, 0.4, 0.1, k.color, -0.8, 1.2, -0.38);
    const amb = k.group(0.8, 0, 0.6, Math.PI);
    k.box(0.8, 0.42, 0.42, '#ffffff', 0, 0.06, 0, { parent: amb });
    k.box(0.82, 0.08, 0.44, k.color, 0, 0.25, 0, { parent: amb });
    const siren = k.sphere(0.07, '#7ff0d8', 0, 0.52, 0, { parent: amb, glow: true });
    k.anim((t) => { amb.position.x = 0.9 - ((t * 0.5) % 1.4); siren.visible = Math.sin(t * 10) > 0; });
    // 心電圖訊號沿弧線傳向醫院
    for (let i = 0; i < 3; i++) {
      const d = k.sphere(0.05, '#4fd6ff', 0, 0, 0, { glow: true, dyn: true });
      k.anim((t) => { const f = ((t * 0.5 + i / 3) % 1); d.position.set(0.6 - f * 1.4, 0.7 + Math.sin(f * Math.PI) * 0.8, 0.6 - f * 1.2); });
    }
    k.person({ x: -0.2, z: 0.3, anim: 'point', shirt: '#20a39e', rot: 0.8 });
  },
  ecgDoctor(k) {
    table(k, 0, -0.3, 1.2, 0.5);
    k.box(0.7, 0.45, 0.05, '#2b2f45', 0, 0.4, -0.5);
    const beat = k.box(0.05, 0.05, 0.02, '#2e9e5b', 0, 0.6, -0.47, { glow: true, dyn: true });
    k.anim((t) => { const c = (t * 0.6) % 1; beat.position.x = -0.3 + c * 0.6; beat.position.y = 0.6 + (c > 0.45 && c < 0.55 ? 0.12 : 0); });
    k.person({ x: -0.3, z: 0.3, anim: 'point', shirt: '#ffffff', rot: Math.PI });
    k.person({ x: 0.4, z: 0.4, anim: 'idle', shirt: '#20a39e', rot: Math.PI });
  },
  noSmoking(k) {
    road(k, 0, 0.2, 4, 1.2);
    k.cyl(0.25, 0.25, 0.03, 20, '#ffffff', -0.9, 0.9, -0.8, { rx: Math.PI / 2 });
    k.cyl(0.22, 0.22, 0.035, 20, '#d64545', -0.9, 0.9, -0.79, { rx: Math.PI / 2 });
    k.box(0.32, 0.05, 0.04, '#ffffff', -0.9, 0.9, -0.77, { rot: 0.785 });
    k.cyl(0.03, 0.03, 0.9, 5, '#c9c4b8', -0.9, 0, -0.85);
    k.box(0.6, 0.9, 0.6, '#c9e2f2', 1.3, 0, -0.7);
    k.person({ anim: 'walk', path: [[-1.6, 0.0], [1.6, 0.0]] });
    k.person({ anim: 'walk', path: [[1.6, 0.5], [-1.6, 0.5]], pathT: 0.3, kid: true });
    k.person({ anim: 'walk', path: [[-1.6, 0.8], [1.6, 0.8]], pathT: 0.6, senior: true });
  },

  // ===== 安全韌性 =====
  police(k) {
    building(k, 0, -0.9, 1.8, 1.0, 0.6, '#f1e9dd', { floors: 2, roof: '#2f4f8a' });
    for (let i = 0; i < 3; i++) k.person({ x: -0.6 + i * 0.6, z: 0.3, anim: 'salute', holdAnim: 'salute', shirt: '#2f4f8a', pants: '#1f2a44' });
    const car = k.group(1.2, 0, 0.9, 0.3);
    k.box(0.8, 0.3, 0.4, '#ffffff', 0, 0.06, 0, { parent: car });
    k.box(0.5, 0.2, 0.38, '#2f4f8a', 0, 0.3, 0, { parent: car });
    const l = k.sphere(0.06, '#2f7dd3', 0, 0.55, 0, { parent: car, glow: true });
    k.anim((t) => { l.visible = Math.sin(t * 9) > 0; });
  },
  firefighters(k) {
    const truck = k.group(-0.5, 0, -0.4);
    k.box(1.6, 0.55, 0.6, '#d64545', 0, 0.08, 0, { parent: truck });
    k.box(1.2, 0.08, 0.1, '#c9c4b8', 0, 0.7, 0, { parent: truck, rz: 0.2 });
    k.box(1.2, 0.04, 0.62, '#f2c14e', 0, 0.35, 0, { parent: truck });
    const ff = k.person({ x: 0.7, z: 0.5, anim: 'give', holdAnim: 'salute', shirt: '#2b2f45', rot: 0.6 });
    k.person({ x: 0.3, z: 0.7, anim: 'carry', holdAnim: 'salute', shirt: '#2b2f45', rot: 0.6 });
    // 夜晚（含黃昏）消防車警示燈閃爍、分隊車庫亮燈
    const lightR = k.sphere(0.07, '#ff4040', -0.6, 0.72, 0, { parent: truck, glow: true, dyn: true });
    const lightB = k.sphere(0.07, '#4f8dff', -0.45, 0.72, 0, { parent: truck, glow: true, dyn: true });
    const garage = k.box(1.0, 0.7, 0.04, '#ffe9a8', -0.5, 0, -1.25, { glow: true, dyn: true });
    k.box(1.2, 0.85, 0.3, '#c9c4b8', -0.5, 0, -1.45);
    k.anim((t) => {
      const n = k.night();
      lightR.visible = n && Math.sin(t * 9) > 0;
      lightB.visible = n && Math.sin(t * 9) <= 0;
      garage.visible = n;
    });
    for (let i = 0; i < 6; i++) {
      const d = k.sphere(0.05, '#6fb7e8', 0, 0, 0, { dyn: true });
      k.anim((t) => { const f = (t * 1.2 + i / 6) % 1; const h = k.toLocal(ff.handR); d.position.set(h.x + f * 1.1, h.y + f * 0.4 - f * f * 0.9, h.z - f * 0.6); });
    }
  },
  floodTunnel(k) {
    k.box(3.2, 0.02, 1.6, '#5c6170', 0, 0, -0.2);
    k.cyl(0.42, 0.42, 3.0, 16, '#c9c4b8', 0, 0.42, -0.4, { rz: Math.PI / 2 });
    k.cyl(0.36, 0.36, 3.02, 16, '#2b4f7a', 0, 0.42, -0.4, { rz: Math.PI / 2 });
    for (let i = 0; i < 8; i++) {
      const d = k.box(0.02, 0.18, 0.02, '#6fb7e8', 0, 0, 0, { dyn: true });
      k.anim((t) => { const f = (t * 1.5 + i / 8) % 1; d.position.set(-1.2 + i * 0.35, 2.4 - f * 2.0, 0.3); });
    }
    k.sphere(0.4, '#9aa3b5', -0.4, 2.5, 0.2);
    k.sphere(0.5, '#9aa3b5', 0.2, 2.6, 0.2);
    // 雨水在地面積起來，再慢慢流進滯洪管涵退去
    const water = k.box(2.6, 0.2, 0.55, '#4f9be0', 0, 0, 0.35, { fade: true, dyn: true });
    water.material.opacity = 0.7;
    k.anim((t) => { const f = (Math.sin(t * 0.5) + 1) / 2; water.scale.y = 0.05 + f * 0.95; water.position.y = water.scale.y * 0.1; });
    k.person({ x: 0.8, z: 0.8, anim: 'point', shirt: '#f08c3a', rot: -2.6 });
    k.hotspot(0, 1.25, -0.2, '💧 3.2 萬噸有多大？', 'flood');
  },
  inspection(k) {
    building(k, -0.3, -0.7, 1.2, 1.8, 0.9, '#c9b896', { floors: 5 });
    k.box(0.06, 0.6, 0.03, '#5c4a3a', -0.1, 0.5, -0.24, { rot: 0.4 });
    const p = k.person({ x: 0.8, z: 0.4, anim: 'point', shirt: '#f2c14e', rot: -2.5 });
    holdInHand(k, p, k.box(0.16, 0.2, 0.02, '#f4f1ea', 0, 0, 0, { dyn: true }), 'handL');
    k.person({ x: 0.2, z: 0.6, anim: 'idle', senior: true });
  },
  cityStaff(k) {
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      table(k, -0.6 + c * 1.2, -0.6 + r * 0.9, 0.8, 0.45);
      k.box(0.28, 0.2, 0.02, '#2b2f45', -0.6 + c * 1.2, 0.39, -0.75 + r * 0.9);
      k.person({ x: -0.6 + c * 1.2, z: -0.2 + r * 0.9, anim: 'type', rot: Math.PI, y: 0.1, phase: r + c });
    }
    k.person({ x: 1.4, z: 1.0, anim: 'wave' });
  },

  cprTraining(k) {
    // 地墊上的安妮假人、跪姿按壓的學員、旁邊的 AED 與受訓進度板
    k.box(1.5, 0.03, 0.8, '#2f7dd3', -0.1, 0, 0.1);
    k.box(0.5, 0.12, 0.26, '#f0c9a8', -0.1, 0.03, 0.05);
    k.sphere(0.11, '#f0c9a8', -0.42, 0.12, 0.05);
    const chest = k.box(0.18, 0.04, 0.2, '#ffffff', 0.0, 0.15, 0.05, { dyn: true });
    k.anim((t) => { chest.position.y = 0.15 - Math.max(0, Math.sin(t * 11)) * 0.03; });
    k.person({ x: 0.0, z: 0.42, anim: 'work', rot: Math.PI, y: -0.12 });
    k.person({ x: 0.75, z: 0.65, anim: 'point', shirt: '#d64545', rot: -2.6 });
    k.person({ x: -0.9, z: 0.75, anim: 'clap', rot: 2.6 });
    // AED：綠色機盒＋閃爍的心形燈
    k.box(0.28, 0.34, 0.14, '#2e9e5b', 0.95, 0, -0.55);
    const heart = k.sphere(0.06, '#ff5a5a', 0.95, 0.24, -0.47, { glow: true, dyn: true });
    k.anim((t) => { heart.visible = Math.sin(t * 4) > -0.3; });
    // 進度板：第一線員工受訓率 73.9%，目標 80%
    k.box(1.1, 0.5, 0.05, '#f4f1ea', -0.6, 0.55, -0.85);
    k.box(1.0, 0.1, 0.06, '#c9c4b8', -0.6, 0.7, -0.84);
    k.box(0.74, 0.1, 0.07, '#2e9e5b', -0.6 - (1.0 - 0.74) / 2, 0.7, -0.83);
    k.box(0.02, 0.18, 0.08, '#d64545', -0.6 - 0.5 + 0.8, 0.66, -0.82);
    k.hotspot(0.95, 0.75, -0.5, '❤️ 急救口訣', 'aed');
    k.hotspot(-0.6, 1.2, -0.85, '📊 受訓進度', 'firstaid-progress');
  },

  // ===== 環境永續 =====
  carbon(k) {
    building(k, -0.9, -0.6, 0.9, 0.8, 0.7, '#c9c4b8');
    k.cyl(0.12, 0.15, 1.4, 8, '#8a8478', -1.1, 0.8, -0.6);
    for (let i = 0; i < 3; i++) {
      const s = k.sphere(0.12, '#d8d8d8', 0, 0, 0, { dyn: true });
      k.anim((t) => { const f = (t * 0.3 + i / 3) % 1; s.position.set(-1.1 + f * 0.4, 2.3 + f * 0.8, -0.6); s.scale.setScalar((1 - f) * 0.9); });
    }
    k.cyl(0.04, 0.06, 2.0, 6, '#ffffff', 0.9, 0, -0.6);
    const hub = k.group(0.9, 2.0, -0.5);
    for (let i = 0; i < 3; i++) k.box(0.06, 0.8, 0.02, '#ffffff', 0, 0.4, 0, { parent: k.group(0, 0, 0, 0, hub, false, (i / 3) * Math.PI * 2) });
    k.anim((t) => { hub.rotation.z = t * 1.5; });
    // 遞減長條圖
    [0.9, 0.7, 0.5, 0.3].forEach((h, i) => k.box(0.16, h, 0.16, i === 3 ? '#4caf50' : '#9aa3b5', -0.3 + i * 0.25, 0, 0.6));
    k.person({ x: 0.9, z: 0.7, anim: 'point', rot: -2.4 });
  },
  recycling(k) {
    ['#2f7dd3', '#f2c14e', '#4caf50', '#8a8478'].forEach((c, i) => {
      k.box(0.35, 0.5, 0.35, c, -0.75 + i * 0.5, 0, -0.6);
      k.box(0.37, 0.05, 0.37, '#2b2f45', -0.75 + i * 0.5, 0.5, -0.6);
    });
    const p = k.person({ x: -0.2, z: 0.2, anim: 'give', rot: Math.PI });
    const bottle = k.cyl(0.04, 0.04, 0.14, 8, '#6fb7e8', 0, 0, 0, { dyn: true });
    k.anim((t) => { const c = (t % 2.4) / 2.4; const h = k.toLocal(p.handR); if (c < 0.5) bottle.position.copy(h); else bottle.position.lerpVectors(h, { x: -0.25, y: 0.6, z: -0.6 }, (c - 0.5) * 2); });
    k.person({ x: 0.8, z: 0.5, anim: 'carry', kid: true });
  },
  riverside(k) {
    k.box(4.0, 0.03, 1.4, '#3f97bf', 0, 0, -0.8);
    k.box(4.0, 0.06, 0.6, '#c49a6c', 0, 0, 0.3);
    for (let i = 0; i < 6; i++) k.box(0.04, 0.3, 0.04, '#7a5638', -1.6 + i * 0.64, 0.06, 0.02);
    k.person({ anim: 'jog', path: [[-1.7, 0.3], [1.7, 0.3]] });
    k.person({ anim: 'jog', path: [[1.7, 0.45], [-1.7, 0.45]], pathT: 0.4 });
    k.person({ anim: 'walk', path: [[-1.7, 0.55], [1.7, 0.55]], pathT: 0.7, senior: true });
    tree(k, 1.2, 1.2, 0.9);
    tree(k, -1.3, 1.1, 0.8);
    const boat = k.group(0, 0.05, -0.9);
    k.box(0.5, 0.12, 0.2, '#f4f1ea', 0, 0, 0, { parent: boat });
    k.anim((t) => { boat.position.x = Math.sin(t * 0.3) * 1.4; });
  },
  airQuality(k) {
    for (const [x, z] of [[-1.2, -0.8], [-0.4, -1.1], [0.6, -1.0], [1.3, -0.5], [-1.4, 0.4]]) tree(k, x, z, 1);
    sign(k, 0.8, 0.5, '#2e9e5b', { h: 1.1 });
    k.sphere(0.1, '#2e9e5b', 0.8, 1.25, 0.53, { glow: true });
    k.person({ anim: 'jog', kid: true, path: [[-0.6, 0.2], [0.2, -0.3], [0.4, 0.6], [-0.5, 0.9]] });
    k.person({ x: -0.2, z: 0.9, anim: 'cheer', kid: true });
    k.person({ x: 0.3, z: 1.1, anim: 'idle', senior: true });
  },

  // ===== 文化運動 =====
  domeCheer(k) {
    // 大巨蛋落成：巨蛋加一圈歡呼人群
    const dome = k.sphere(1.0, '#e7e9ee', 0, 0.12, -0.5, { half: true, sy: 0.5 });
    k.cyl(1.08, 1.1, 0.14, 28, k.color, 0, 0, -0.5);
    for (let i = 0; i < 3; i++) k.box(0.03, 0.4, 0.03, '#c9c4b8', -0.5 + i * 0.5, 0.65, -0.5);
    const flags = ['#d64545', '#2f7dd3', '#f2c14e', '#4caf50', '#e46a8c', '#6c5ce7'];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.12 + (i / 8) * Math.PI * 0.76;
      const p = k.person({ x: Math.cos(a) * 1.5, z: -0.5 + Math.sin(a) * 1.5, rot: Math.atan2(Math.cos(a), Math.sin(a)), anim: 'cheer', phase: i * 0.7, kid: i % 4 === 0 });
      if (i % 3 === 0) k.attach(k.box(0.14, 0.09, 0.01, flags[i % flags.length], 0, 0, 0, { dyn: true }), p, 'handR');
    }
    for (let i = 0; i < 6; i++) {
      const c = k.box(0.04, 0.04, 0.01, flags[i], 0, 0, 0, { dyn: true });
      k.anim((t) => { const f = (t * 0.4 + i / 6) % 1; c.position.set(Math.sin(i * 2.3) * 1.2, 2.2 - f * 2.0, -0.2 + Math.cos(i * 1.7) * 0.6); c.rotation.set(t * 3 + i, t * 2, 0); });
    }
  },
  baseball(k) {
    k.box(2.6, 0.02, 2.6, '#c49a6c', 0, 0, -0.1, { rot: Math.PI / 4 });
    k.box(2.0, 0.025, 2.0, '#6fb05a', 0, 0, -0.1, { rot: Math.PI / 4 });
    k.box(0.15, 0.03, 0.15, '#ffffff', 0, 0, 1.0, { rot: Math.PI / 4 });
    const batter = k.person({ x: 0.15, z: 1.05, anim: 'work', rot: -Math.PI / 2 });
    k.person({ x: 0, z: -0.3, anim: 'give', rot: 0 });
    const ball = k.sphere(0.04, '#ffffff', 0, 0, 0, { dyn: true });
    k.anim((t) => { const f = (t * 0.6) % 1; ball.position.set(0, 0.45 + Math.sin(f * Math.PI) * 0.15, -0.2 + f * 1.15); });
    for (let i = 0; i < 6; i++) k.person({ x: -1.6 + i * 0.15, z: -1.4 + i * 0.05, anim: 'cheer', phase: i, rot: 0.6 });
  },
  mastersGames(k) {
    k.cyl(1.7, 1.7, 0.02, 32, '#d9765c', 0, 0, 0);
    k.cyl(1.2, 1.2, 0.025, 32, '#6fb05a', 0, 0, 0);
    const path = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; path.push([Math.cos(a) * 1.45, Math.sin(a) * 1.45]); }
    k.person({ anim: 'jog', senior: true, path, speed: 1.4 });
    k.person({ anim: 'jog', path, pathT: 0.1, speed: 1.4 });
    k.person({ anim: 'jog', senior: true, path, pathT: 0.2, speed: 1.4 });
    [[0, 0.5, '#f2c14e'], [-0.4, 0.35, '#c9c4b8'], [0.4, 0.25, '#c49a6c']].forEach(([x, h, c]) => k.box(0.38, h, 0.38, c, x, 0, -0.1));
    k.person({ x: 0, y: 0.5, z: -0.1, anim: 'cheer', senior: true });
    k.person({ x: -0.4, y: 0.35, z: -0.1, anim: 'wave' });
    k.person({ x: 0.4, y: 0.25, z: -0.1, anim: 'wave', senior: true });
  },
  award(k) {
    k.box(1.6, 0.25, 0.8, '#f4f1ea', 0, 0, -0.6);
    k.cyl(0.12, 0.18, 0.45, 8, '#f2c14e', 0, 0.25, -0.6);
    k.sphere(0.16, '#f2c14e', 0, 0.85, -0.6, { glow: true });
    k.person({ x: 0, y: 0.25, z: -0.3, anim: 'wave', shirt: '#2b2f45' });
    for (let i = 0; i < 5; i++) k.person({ x: -1.0 + i * 0.5, z: 0.7, anim: 'clap', rot: Math.PI, phase: i });
  },
  gallery(k) {
    k.box(3.0, 1.2, 0.08, '#f4f1ea', 0, 0, -1.0);
    [['#d64545', -0.9], ['#2f7dd3', 0], ['#f2c14e', 0.9]].forEach(([c, x]) => {
      k.box(0.6, 0.5, 0.04, '#7a5638', x, 0.45, -0.94);
      k.box(0.52, 0.42, 0.045, c, x, 0.49, -0.93);
    });
    k.box(0.3, 0.7, 0.3, '#ffffff', 1.3, 0, 0.3);
    k.sphere(0.2, '#c9a227', 1.3, 0.85, 0.3);
    k.person({ x: -0.6, z: 0.0, anim: 'point', rot: Math.PI });
    k.person({ x: 0.3, z: 0.2, anim: 'idle', rot: Math.PI });
    k.person({ x: -0.1, z: 0.4, anim: 'idle', kid: true, rot: Math.PI });
  },
  handshake(k) {
    k.box(1.8, 0.18, 0.9, '#f4f1ea', 0, 0, -0.3);
    for (const [x, c] of [[-0.7, '#2f7dd3'], [0.7, '#e46a8c']]) {
      k.cyl(0.02, 0.02, 1.4, 5, '#c9c4b8', x, 0.18, -0.65);
      k.box(0.45, 0.3, 0.02, c, x + 0.23, 1.25, -0.65);
    }
    k.person({ x: -0.22, y: 0.18, z: -0.2, anim: 'give', rot: Math.PI / 2, shirt: '#2b2f45' });
    k.person({ x: 0.22, y: 0.18, z: -0.2, anim: 'give', rot: -Math.PI / 2, shirt: '#2b2f45', phase: 1 });
    for (let i = 0; i < 4; i++) k.person({ x: -0.75 + i * 0.5, z: 0.8, anim: 'clap', rot: Math.PI, phase: i });
  },
  smartTraffic(k) {
    road(k, 0, 0, 4, 0.9);
    road(k, 0, 0, 0.9, 4);
    k.box(0.08, 1.0, 0.08, '#2b2f45', 0.6, 0, 0.6);
    const lights = ['#d64545', '#f2c14e', '#2e9e5b'].map((c, i) => k.sphere(0.07, c, 0.6, 0.85 - i * 0.16, 0.66, { glow: true, dyn: true }));
    k.anim((t) => { const s = Math.floor(t / 1.5) % 3; lights.forEach((l, i) => { l.visible = i === s; }); });
    const car = k.group(0, 0, 0.2);
    k.box(0.45, 0.2, 0.25, '#2f7dd3', 0, 0.04, 0, { parent: car });
    k.anim((t) => { car.position.x = ((t * 0.8) % 4) - 2; });
    for (let i = 0; i < 3; i++) {
      const r = k.cyl(0.2, 0.2, 0.01, 24, '#4fd6ff', 0.6, 1.2, 0.6, { fade: true, dyn: true });
      k.anim((t) => { const f = (t * 0.6 + i / 3) % 1; r.scale.set(1 + f * 3, 1, 1 + f * 3); r.material.opacity = 1 - f; });
    }
  },
};

// 每項政策對應的場景（沒列到的用該島預設）
export const ITEM_SCENES = {
  'transport-xinyi-east': ['metroOpen'],
  'transport-wanda': ['tunnel', { pct: 0.85 }],
  'transport-circular-ns': ['viaduct'],
  'transport-circular-east': ['viaduct'],
  'transport-minsheng': ['blueprint'],
  'transport-youbike': ['youbike'],
  'transport-pedestrian': ['crosswalk'],
  'transport-bus': ['busStop'],
  'transport-autonomous': ['autonomous'],
  'development-songshan': ['airportPark'],
  'development-songshan-central': ['debate'],
  'development-twin-towers': ['twinTowers'],
  'development-nangang-bus': ['busTerminal'],
  'development-nangang-star': ['highriseBuild'],
  'industry-nvidia-sign': ['signing'],
  'industry-nvidia-build': ['hqBuild'],
  'industry-beishike-land': ['landPlots'],
  'industry-corridor': ['corridor'],
  'industry-songnan': ['survey'],
  'industry-startup': ['startup'],
  'industry-youth': ['career'],
  'housing-social': ['socialHousing'],
  'housing-happy': ['familyHome'],
  'housing-rent-subsidy': ['keyHandover'],
  'housing-friendly': ['friendlyListing'],
  'housing-renewal': ['renewal'],
  'housing-public-renewal': ['renewal'],
  'housing-renewal-new': ['bigBlock'],
  'family-birth': ['newborn'],
  'family-lunch': ['schoolLunch'],
  'family-milk': ['milkHandoff'],
  'family-worktime': ['parentPickup'],
  'family-lbw': ['nicu'],
  'family-new-measures': ['postpartum'],
  'family-food-safety': ['kitchenInspect'],
  'family-teachers': ['classroom'],
  'family-ai-edu': ['aiClass'],
  'care-senior-card': ['seniorCard'],
  'care-senior-points': ['seniorShop'],
  'care-ltc': ['dayCare'],
  'care-ambulance': ['ambulanceECG'],
  'care-hospital-ai': ['ecgDoctor'],
  'care-smokefree': ['noSmoking'],
  'safety-police-pay': ['police'],
  'safety-fire-pay': ['firefighters'],
  'safety-flood': ['floodTunnel'],
  'safety-building': ['inspection'],
  'safety-staffing': ['cityStaff'],
  'safety-first-aid': ['cprTraining'],
  'environment-carbon': ['carbon'],
  'environment-waste': ['recycling'],
  'environment-river': ['riverside'],
  'environment-air': ['airQuality'],
  'culture-dome': ['domeCheer'],
  'culture-olympic': ['baseball'],
  'culture-masters': ['mastersGames'],
  'culture-lky': ['award'],
  'culture-museums': ['gallery'],
  'culture-diplomacy': ['handshake'],
  'culture-its': ['smartTraffic'],
  'intl-sister-cities': ['handshake'],
  'intl-twin-city-forum': ['debate'],
  'intl-trendy-taipei': ['domeCheer'],
  'intl-smart-city': ['smartTraffic'],
  'intl-baseball': ['baseball'],
  'intl-marathon': ['mastersGames'],
  'intl-dome-concerts': ['domeCheer'],
  'intl-investment': ['signing'],
};

export const THEME_DEFAULT = {
  transport: 'busStop', development: 'airportPark', industry: 'startup', housing: 'socialHousing',
  family: 'milkHandoff', care: 'dayCare', safety: 'firefighters', environment: 'riverside', culture: 'domeCheer', international: 'handshake',
};

export function sceneFor(themeId, itemId) {
  const [key, opts] = ITEM_SCENES[itemId] || [THEME_DEFAULT[themeId]];
  return { key, opts: opts || {}, build: SCENES[key] };
}
