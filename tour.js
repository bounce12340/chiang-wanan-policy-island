// 自動導覽：約 70 秒，從「2022 承諾」走到「2026 結果」，鏡頭依序飛過九座島。
// 每一站的字幕都取自 data/ 裡的資料與來源，不另外寫死數字。
import { PLEDGE_STATUS, PLEDGE_ORDER, countByStatus } from './pledges.js';

// 每座島挑一項代表性施政；有對應 2022 政見的優先
// 第三欄：要並列顯示的 2022 政見 id
const HIGHLIGHTS = [
  ['culture', 'culture-dome', 'p22-media-01'],
  ['housing', 'housing-social', 'p22-media-04'],
  ['family', 'family-birth', 'p22-family-01'],
  ['transport', 'transport-circular-east', 'p22-transport-01'],
  ['care', 'care-ltc', 'p22-care-01'],
  ['industry', 'industry-nvidia-sign'],
  ['development', 'development-nangang-bus'],
  ['safety', 'safety-police-pay'],
  ['environment', 'environment-waste'],
];
const STOP_SECONDS = 6.5;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');
const clip = (s, n) => { const t = String(s ?? ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const srcLink = (s) => s ? `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">↗ ${esc(s.publisher || '來源')}${s.published ? `・${esc(String(s.published).replace(/-/g, '.'))}` : ''}</a>` : '';

export function createTour({ world, themes, byId, loadPledges, onStart, onEnd, onExplore, onPledges }) {
  const root = document.getElementById('tour');
  const cap = root.querySelector('.tour-cap');
  const bar = root.querySelector('.tour-bar');
  const btnPlay = root.querySelector('[data-t="play"]');
  let cues = [];
  let i = 0, t = 0, paused = false, raf = 0, last = 0, active = false;

  async function build() {
    let pd = null;
    try { pd = await loadPledges(); } catch { /* 沒有政見資料時，導覽照樣進行，只是少了對照 */ }
    const total = pd?.items.length || 0;
    const c = pd ? countByStatus(pd.items) : null;
    const pledgeById = (id) => (id ? pd?.items.find((p) => p.id === id) : null);
    const list = [{
      kind: 'intro', dur: 6,
      html: `<p class="tour-kicker">臺北施政島・導覽</p>
        <h3>2022 年，蔣萬安提出${total ? ` ${total} 條` : ''}政見。<br>四年後，做到了哪些？</h3>
        <p>接下來走過九座政策島，每一站都附上資料來源。</p>`,
    }];
    HIGHLIGHTS.forEach(([themeId, itemId, pledgeId]) => {
      const theme = byId.get(themeId);
      const item = theme?.items.find((x) => x.id === itemId);
      if (!item) return;
      const n = themes.indexOf(theme) + 1;
      const p = pledgeById(pledgeId);
      const st = p && PLEDGE_STATUS[p.status];
      list.push({
        kind: 'stop', dur: STOP_SECONDS, themeId, itemId,
        html: `<p class="tour-kicker"><i style="background:${theme.color}"></i>政策島 ${String(n).padStart(2, '0')}・${esc(theme.name)}</p>
          <h3>${esc(item.title)}</h3>
          <p>${esc(clip(item.facts?.[0], 60))}</p>
          ${p ? `<p class="tour-pledge">2022 承諾：「${esc(clip(p.pledge, 34))}」<b style="background:${st.color}">${st.label}</b></p>` : ''}
          <p class="tour-src">${srcLink(item.sources?.[0])}${p ? ` <a href="#/pledges/${esc(p.id)}" data-t="pledge">看這條政見的查證 →</a>` : ''}</p>`,
      });
    });
    if (c) {
      list.push({
        kind: 'summary', dur: 8,
        html: `<p class="tour-kicker">2022 政見兌現對照・查證截至 ${esc(String(pd.meta.asOf).replace(/-/g, '.'))}</p>
          <h3>${total} 條政見，逐條對照公開資料</h3>
          <div class="tour-stack">${PLEDGE_ORDER.filter((s) => c[s]).map((s) => `<span style="flex:${c[s]};background:${PLEDGE_STATUS[s].color}"></span>`).join('')}</div>
          <p class="tour-legend">${PLEDGE_ORDER.filter((s) => c[s]).map((s) => `<span><i style="background:${PLEDGE_STATUS[s].color}"></i>${PLEDGE_STATUS[s].label} <b>${c[s]}</b></span>`).join('')}</p>`,
      });
    }
    list.push({
      kind: 'outro', dur: 9,
      html: `<h3>每一項都附來源，歡迎自己查證。</h3>
        <p>點任何一座島看細節，或打開政見兌現對照逐條檢視。</p>
        <p class="tour-actions"><button data-t="explore">開始探索</button><button data-t="pledges">看 2022 政見兌現</button><button data-t="replay">重播</button></p>`,
    });
    return list;
  }

  function show(n) {
    i = Math.max(0, Math.min(cues.length - 1, n));
    t = 0;
    const cue = cues[i];
    cap.innerHTML = cue.html;
    cap.classList.remove('is-in');
    void cap.offsetWidth; // 重新觸發淡入動畫
    cap.classList.add('is-in');
    bar.querySelectorAll('span').forEach((s, k) => {
      s.classList.toggle('is-done', k < i);
      s.firstElementChild.style.transform = `scaleX(${k < i ? 1 : 0})`;
    });
    root.querySelector('.tour-count').textContent = `${i + 1} / ${cues.length}`;
    if (cue.kind === 'stop') {
      world.focusTheme(cue.themeId);
      world.showVignette(cue.themeId, cue.itemId);
    } else {
      world.hideVignette();
      world.resetView();
    }
  }

  function frame(now) {
    if (!active) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused) {
      t += dt;
      const cue = cues[i];
      const k = Math.min(1, t / cue.dur);
      bar.children[i].firstElementChild.style.transform = `scaleX(${k})`;
      if (t >= cue.dur) {
        if (i < cues.length - 1) show(i + 1);
        else setPaused(true); // 停在結尾，等觀眾選擇
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function setPaused(p) {
    paused = p;
    root.classList.toggle('is-paused', p);
    btnPlay.setAttribute('aria-label', p ? '繼續播放' : '暫停');
  }

  async function start() {
    if (active) { show(0); setPaused(false); return; }
    cues = await build();
    bar.innerHTML = cues.map(() => '<span><i></i></span>').join('');
    active = true;
    onStart?.();
    root.hidden = false;
    document.body.classList.add('touring');
    setPaused(false);
    show(0);
    last = performance.now();
    raf = requestAnimationFrame(frame);
    root.querySelector('[data-t="play"]').focus({ preventScroll: true });
  }

  function stop() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    root.hidden = true;
    document.body.classList.remove('touring');
    world.hideVignette();
    onEnd?.();
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    const act = b.dataset.t;
    if (act === 'play') setPaused(!paused);
    else if (act === 'prev') show(i - 1);
    else if (act === 'next') show(i + 1);
    else if (act === 'exit') { stop(); world.resetView(); }
    else if (act === 'replay') { setPaused(false); show(0); }
    else if (act === 'explore') { stop(); onExplore?.(); }
    else if (act === 'pledges' || act === 'pledge') { e.preventDefault(); const href = b.getAttribute('href'); stop(); onPledges?.(href ? href.split('/').pop() : null); }
  });
  document.addEventListener('keydown', (e) => {
    if (!active || e.target.closest?.('input, textarea')) return;
    if (e.key === 'Escape') { stop(); world.resetView(); }
    else if (e.key === ' ') { e.preventDefault(); setPaused(!paused); }
    else if (e.key === 'ArrowRight') show(i + 1);
    else if (e.key === 'ArrowLeft') show(i - 1);
  });
  // 切到別的分頁時自動暫停
  document.addEventListener('visibilitychange', () => { if (document.hidden && active) setPaused(true); });

  return { start, stop, get active() { return active; } };
}
