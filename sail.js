// 開船巡島：電腦用 WASD／方向鍵，手機用左下角搖桿。靠近政策島時跳出施政卡，可以直接「上岸」打開那座島。
// 開船靠近過全部 10 座政策島，護照蓋「環島航行」章；紀錄只存在這台裝置的瀏覽器裡。
import { read, write } from './store.js';

export function initSail(ctx) {
  const { world, esc, toast, byId, themes, setView, hideHero, closeTheme, openTheme, stamp } = ctx;
  const ui = document.getElementById('sail-ui');
  let on = false;
  const keys = new Set();
  const visited = () => read('sail', { visited: {} }).visited;

  function draw() {
    const n = themes.filter((t) => visited()[t.id]).length;
    ui.innerHTML = `
      <div class="sl-top"><b>⛵ 開船巡島</b><span class="sl-n">已靠近 ${n} / ${themes.length} 座政策島</span><button type="button" data-sl="exit">結束</button></div>
      <div class="sl-card" aria-live="polite" hidden></div>
      <div class="sl-pad" aria-label="搖桿：往上推前進、左右轉彎" role="application"><i></i></div>
      <p class="sl-help">電腦：W／↑ 前進、S／↓ 倒退、A D／← → 轉彎、E 上岸　手機：拖曳左下角搖桿</p>`;
  }
  function onNear(near) {
    const card = ui.querySelector('.sl-card');
    if (!near) { card.hidden = true; return; }
    if (near.type === 'theme') {
      const t = byId.get(near.id);
      const v = read('sail', { visited: {} });
      const isNew = !v.visited[t.id];
      if (isNew) { v.visited[t.id] = 1; write('sail', v); }
      const n = themes.filter((x) => v.visited[x.id]).length;
      ui.querySelector('.sl-n').textContent = `已靠近 ${n} / ${themes.length} 座政策島`;
      if (isNew && n === themes.length) { stamp?.('game:sail'); toast('🏅 10 座政策島都開船靠近過了！護照蓋上「環島航行」章'); }
      const done = t.items.filter((i) => i.status === 'done').length;
      card.innerHTML = `<p><i style="background:${t.color}"></i>前方：<b>${esc(t.name)}</b></p><small>${esc(t.summary || '')}</small>
        <span>${t.items.length} 項施政・已完成 ${done} 項</span><button type="button" class="cta" data-sl="dock" data-id="${esc(t.id)}">上岸看看（E）</button>`;
      card.dataset.id = t.id;
    } else if (near.type === 'landmark') {
      card.innerHTML = `<p>📍 <b>${esc(near.district)}</b>・${esc(near.name)}</p><small>外圈的 12 區地標，只是風景；施政在中央的政策島上。</small>`;
      card.dataset.id = '';
    } else {
      card.innerHTML = '<p>🏙️ <b>中央臺北島</b>・臺北 101</p><small>繞著城市開一圈，靠近每一座政策島看看。</small>';
      card.dataset.id = '';
    }
    card.hidden = false;
  }
  const input = { f: 0, t: 0, pad: null };
  function apply() {
    const kf = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
    const kt = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0);
    world.setSailInput(input.pad ? input.pad.f : kf, input.pad ? input.pad.t : kt);
  }
  function start() {
    if (!world) { toast('這台裝置無法顯示 3D 畫面，沒辦法開船'); return; }
    setView('island');
    hideHero();
    closeTheme();
    on = true;
    document.body.classList.add('sailing');
    draw();
    ui.hidden = false;
    world.startSail(onNear);
    history.replaceState(null, '', '#/sail');
  }
  function stop({ toTheme } = {}) {
    if (!on) return;
    on = false;
    keys.clear();
    input.pad = null;
    world.stopSail();
    document.body.classList.remove('sailing');
    ui.hidden = true;
    if (location.hash === '#/sail') history.replaceState(null, '', location.pathname + location.search);
    if (toTheme) openTheme(toTheme);
    else world.resetCamera();
  }
  function dock() {
    const id = ui.querySelector('.sl-card:not([hidden])')?.dataset.id;
    if (id) stop({ toTheme: id });
  }
  const KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  document.addEventListener('keydown', (e) => {
    if (!on || e.target.closest?.('input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if (KEYS.includes(k)) { e.preventDefault(); keys.add(k); apply(); }
    if (k === 'e' || k === 'enter') dock();
    if (k === 'escape') stop();
  });
  document.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (keys.delete(k)) apply(); });
  window.addEventListener('blur', () => { keys.clear(); if (on) apply(); });

  // 搖桿：往上推＝前進，左右＝轉彎；放開就停
  ui.addEventListener('pointerdown', (e) => {
    const pad = e.target.closest('.sl-pad');
    if (!pad) return;
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    const knob = pad.querySelector('i');
    const move = (ev) => {
      const r = pad.getBoundingClientRect();
      const R = r.width / 2;
      let dx = ev.clientX - (r.left + R), dy = ev.clientY - (r.top + R);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      input.pad = { f: -dy / R, t: -dx / R };
      apply();
    };
    const up = () => {
      knob.style.transform = '';
      input.pad = null;
      apply();
      pad.removeEventListener('pointermove', move);
      pad.removeEventListener('pointerup', up);
      pad.removeEventListener('pointercancel', up);
    };
    move(e);
    pad.addEventListener('pointermove', move);
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
  });
  ui.addEventListener('click', (e) => {
    const k = e.target.closest('[data-sl]')?.dataset.sl;
    if (k === 'exit') stop();
    if (k === 'dock') stop({ toTheme: e.target.closest('[data-sl]').dataset.id });
  });
  return { start, stop, active: () => on, visitedCount: () => themes.filter((t) => visited()[t.id]).length };
}
