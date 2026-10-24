// 自動導覽：約 70 秒，從「2022 承諾」走到「2026 結果」，鏡頭依序飛過十座島。
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
  ['international', 'intl-dome-concerts'],
];
const STOP_SECONDS = 6.5;

// 市民的一天：角色是虛構的，每一站的事實與來源都取自 data/policies.json
export const STORIES = {
  parent: {
    name: '新手爸媽・小芸', emoji: '👶', blurb: '婚後第一年，迎接第一個孩子',
    stops: [
      ['housing', 'housing-happy', '08:00', 'dawn', '小芸和先生剛結婚，想在臺北找間負擔得起的房子。'],
      ['family', 'family-birth', '11:00', 'day', '寶寶出生了，第一胎。'],
      ['family', 'family-worktime', '17:30', 'dusk', '回到職場後，每天想早一點下班陪孩子。'],
      ['family', 'family-milk', '20:30', 'night', '想到孩子以後上學的事。'],
    ],
  },
  commuter: {
    name: '通勤上班族・阿哲', emoji: '💼', blurb: '每天跨區通勤，週末回南部老家',
    stops: [
      ['transport', 'transport-youbike', '07:40', 'dawn', '出門先騎一段 YouBike 到捷運站。'],
      ['transport', 'transport-xinyi-east', '08:10', 'day', '從信義線轉車上班。'],
      ['industry', 'industry-nvidia-sign', '12:30', 'day', '午休時，同事都在聊北士科的新消息。'],
      ['development', 'development-nangang-bus', '19:00', 'dusk', '週五下班，到南港搭客運回老家。'],
    ],
  },
  senior: {
    name: '長輩・林阿嬤', emoji: '👵', blurb: '獨居在老社區，每天出門走走',
    stops: [
      ['care', 'care-senior-card', '08:30', 'dawn', '阿嬤拿著敬老卡出門看病。'],
      ['care', 'care-ltc', '10:00', 'day', '白天到社區的日照中心上課。'],
      ['transport', 'transport-pedestrian', '16:00', 'dusk', '傍晚走路回家，要過一個大路口。'],
      ['care', 'care-ambulance', '21:00', 'night', '晚上，隔壁鄰居突然胸悶，叫了救護車。'],
    ],
  },
};

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

  function buildStory(key) {
    const st = STORIES[key];
    const list = [{
      kind: 'intro', dur: 6,
      html: `<p class="tour-kicker">市民的一天・虛構角色</p>
        <h3>${st.emoji} ${esc(st.name)}</h3>
        <p>${esc(st.blurb)}。角色是虛構的，每一站提到的政策事實都附上來源。</p>`,
    }];
    st.stops.forEach(([themeId, itemId, time, tod, line]) => {
      const theme = byId.get(themeId);
      const item = theme?.items.find((x) => x.id === itemId);
      if (!item) return;
      list.push({
        kind: 'stop', dur: STOP_SECONDS + 1, themeId, itemId, tod,
        html: `<p class="tour-kicker"><i style="background:${theme.color}"></i>${esc(time)}・${esc(theme.name)}</p>
          <h3>${esc(line)}</h3>
          <p><b>${esc(item.title)}</b>：${esc(clip((item.facts || []).slice(0, 2).join('；'), 80))}</p>
          <p class="tour-src">${srcLink(item.sources?.[0])}</p>`,
      });
    });
    const others = Object.entries(STORIES).filter(([k]) => k !== key);
    list.push({
      kind: 'outro', dur: 9,
      html: `<h3>${esc(st.name)}的一天結束了。</h3>
        <p>換個角色看看，或自己點島探索。</p>
        <p class="tour-actions">${others.map(([k, o]) => `<button data-story="${k}">${o.emoji} ${esc(o.name)}</button>`).join('')}<button data-t="explore">開始探索</button></p>`,
    });
    return list;
  }

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
        <p>接下來走過十座政策島，每一站都附上資料來源。</p>`,
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
        <p class="tour-actions"><button data-t="explore">開始探索</button><button data-t="pledges">看 2022 政見兌現</button><button data-t="replay">重播</button></p>
        <p class="tour-stories">或看市民的一天：${Object.entries(STORIES).map(([k, o]) => `<button data-story="${k}">${o.emoji} ${esc(o.name.split('・')[0])}</button>`).join('')}</p>`,
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
    if (cue.tod) world.setTimeOfDay(cue.tod);
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

  let savedTod = null;
  async function start(story = null) {
    const next = story && STORIES[story] ? buildStory(story) : await build();
    if (active) {
      cues = next;
      bar.innerHTML = cues.map(() => '<span><i></i></span>').join('');
      setPaused(false);
      show(0);
      return;
    }
    cues = next;
    savedTod = world.getTimeOfDay();
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
    if (savedTod) world.setTimeOfDay(savedTod);
    onEnd?.();
  }

  root.addEventListener('click', (e) => {
    const sb = e.target.closest('[data-story]');
    if (sb) { start(sb.dataset.story); return; }
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
