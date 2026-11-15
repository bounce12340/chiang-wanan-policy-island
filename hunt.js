// 島上尋寶：每座島藏了跟該島施政有關的小道具，點到就解鎖那項施政。
// 進度只存在這台裝置的瀏覽器裡；隨時點到寶物都算數，開啟尋寶模式時寶物會跳動、頭上有星星。
import { read, write } from './store.js';

export const TREASURES = [
  { id: 'bike', kind: 'bike', themeId: 'transport', item: 'transport-youbike', name: 'YouBike' },
  { id: 'plane', kind: 'plane', themeId: 'development', item: 'development-songshan', name: '小飛機' },
  { id: 'chip', kind: 'chip', themeId: 'industry', item: 'industry-nvidia-sign', name: 'AI 晶片' },
  { id: 'key', kind: 'key', themeId: 'housing', item: 'housing-social', name: '社宅鑰匙' },
  { id: 'lunch', kind: 'lunch', themeId: 'family', item: 'family-lunch', name: '營養午餐便當' },
  { id: 'milk', kind: 'milk', themeId: 'family', item: 'family-milk', name: '鮮乳' },
  { id: 'wheelchair', kind: 'wheelchair', themeId: 'care', item: 'care-ltc', name: '輪椅' },
  { id: 'manhole', kind: 'manhole', themeId: 'safety', item: 'safety-flood', name: '下水道人孔蓋' },
  { id: 'aed', kind: 'aed', themeId: 'safety', item: 'safety-first-aid', name: 'AED' },
  { id: 'bin', kind: 'bin', themeId: 'environment', item: 'environment-waste', name: '資源回收桶' },
  { id: 'ball', kind: 'ball', themeId: 'culture', item: 'culture-dome', name: '棒球' },
  { id: 'globe', kind: 'globe', themeId: 'international', item: 'intl-sister-cities', name: '地球儀' },
];

export function initHunt(ctx) {
  const { world, esc, toast, byId, showPop, pop, stamp, setView, hideHero, closeTheme } = ctx;
  // 每座島一到兩個：家庭、安全各兩個，其餘各一個
  const bar = document.getElementById('hunt-bar');
  // 只保留資料裡真的存在的項目，避免日後改資料時壞掉
  const defs = TREASURES.filter((t) => byId.get(t.themeId)?.items.some((i) => i.id === t.item));
  const state = () => read('hunt', { found: {} });
  const foundSet = () => new Set(Object.keys(state().found).filter((k) => defs.some((d) => d.id === k)));
  let on = false;

  world?.setTreasures(defs, foundSet());

  const taipeiDay = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  function drawBar() {
    const n = foundSet().size;
    bar.innerHTML = `<b>🔍 島上尋寶</b><span class="hunt-n">${n} / ${defs.length}</span>
      <button type="button" data-hb="hint">提示</button><button type="button" data-hb="exit" aria-label="結束尋寶">結束</button>`;
  }
  function start() {
    if (!world) { toast('這台裝置無法顯示 3D 畫面，沒辦法尋寶'); return; }
    setView('island');
    hideHero();
    closeTheme();
    on = true;
    world.setHuntMode(true);
    document.body.classList.add('hunting');
    drawBar();
    bar.hidden = false;
    history.replaceState(null, '', '#/hunt');
    const n = foundSet().size;
    toast(n < defs.length ? `每座島都藏了小道具，共 ${defs.length} 個，會跳動的就是。轉動、放大島嶼，點到就算找到！` : '12 個都找到了！寶物還在島上，可以再點來看看');
  }
  function stop() {
    on = false;
    world?.setHuntMode(false);
    document.body.classList.remove('hunting');
    bar.hidden = true;
    if (location.hash === '#/hunt') history.replaceState(null, '', location.pathname + location.search);
  }
  function hint() {
    const left = defs.filter((d) => !foundSet().has(d.id));
    if (!left.length) { toast('全部找到了！'); return; }
    const d = left[Math.floor(Math.random() * left.length)];
    world.hintTreasure(d.id);
    toast(`提示：「${byId.get(d.themeId).name}」島上還藏著一個，找找看會跳動的小東西`);
  }
  function found(id) {
    const d = defs.find((x) => x.id === id);
    if (!d) return;
    const s = state();
    const isNew = !s.found[id];
    if (isNew) { s.found[id] = taipeiDay(); write('hunt', s); world.setTreasureFound(id); }
    const n = foundSet().size;
    const theme = byId.get(d.themeId);
    const item = theme.items.find((i) => i.id === d.item);
    const all = n === defs.length;
    if (isNew && all) stamp?.('game:hunt');
    const src = item.sources?.[0];
    showPop(`<p class="pop-kicker">${isNew ? '🎉 找到了' : '已經找過了'}・${esc(theme.name)}・${n} / ${defs.length}</p>
      <p class="pop-quote">${esc(d.name)}</p>
      <p class="pop-sum"><b>${esc(item.title)}</b>：${esc(item.facts?.[0] || '')}</p>
      ${src ? `<div class="sources"><a class="src" href="${esc(/^https?:/.test(src.url) ? src.url : '#')}" target="_blank" rel="noopener noreferrer">↗ ${esc([src.publisher, src.published].filter(Boolean).join('・'))}</a></div>` : ''}
      ${all && isNew ? '<p class="pop-sum hunt-done">🏆 12 個寶物全部找到，護照蓋上「島上尋寶」章！</p>' : ''}
      <div class="pop-actions"><button class="cta" data-go-theme="${esc(theme.id)}" data-go-item="${esc(item.id)}">看這項施政</button>${all ? '<button class="cta cta-2" data-hunt-share>分享</button>' : on ? '<button class="cta cta-2" data-hunt-next>繼續找</button>' : '<button class="cta cta-2" data-hunt-start>開始尋寶</button>'}</div>`);
    if (on) drawBar();
  }
  bar.addEventListener('click', (e) => {
    const k = e.target.closest('[data-hb]')?.dataset.hb;
    if (k === 'hint') hint();
    if (k === 'exit') stop();
  });
  pop.addEventListener('click', async (e) => {
    if (e.target.closest('[data-hunt-next]')) { pop.hidden = true; return; }
    if (e.target.closest('[data-hunt-start]')) { pop.hidden = true; start(); return; }
    if (e.target.closest('[data-go-theme]') && on) stop();
    if (e.target.closest('[data-hunt-share]')) {
      const url = `${location.origin}${location.pathname}#/hunt`;
      const text = `我在「臺北施政島」找到全部 ${defs.length} 個藏在島上的寶物！每個寶物都連到一項有來源的施政，你也來找找：`;
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title: '島上尋寶｜臺北施政島', text, url }); return; } catch (err) { if (err.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(`${text}${url}`); toast('已複製文字與連結'); } catch { window.prompt('複製這段文字：', `${text}${url}`); }
    }
  });
  return { start, stop, found, count: () => foundSet().size, total: defs.length, active: () => on };
}
