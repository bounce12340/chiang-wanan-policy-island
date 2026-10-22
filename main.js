// UI 與資料：讀 data/policies.json，畫出面板、清單、時間軸，並和 3D 場景連動。
const STATUS = {
  done: { label: '已完成', color: '#2e9e5b' },
  in_progress: { label: '進行中', color: '#2f7dd3' },
  proposal: { label: '規劃中', color: '#d99a14' },
  pledge: { label: '連任政見', color: '#d0457a' },
};
const STATUS_ORDER = ['done', 'in_progress', 'proposal', 'pledge'];
const REPO_URL = 'https://github.com/bounce12340/chiang-wanan-policy-island';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  if (day) return `${y}.${m}.${day}`;
  if (m) return `${y}.${m}`;
  return y;
}

function sourceLabel(s) {
  const pub = s.publisher || new URL(safeUrl(s.url) === '#' ? 'https://x.invalid' : s.url).hostname;
  return s.published ? `${pub}・${fmtDate(s.published)}` : pub;
}

function itemHTML(item, theme, { showTheme = false } = {}) {
  const st = STATUS[item.status] || { label: item.status, color: '#888' };
  const facts = (item.facts || []).map((f) => `<li>${esc(f)}</li>`).join('');
  const srcs = (item.sources || []).map((s) =>
    `<a class="src" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer" title="${esc(s.title || s.url)}">↗ ${esc(sourceLabel(s))}</a>`).join('');
  return `<article class="item" id="item-${esc(item.id)}" data-status="${esc(item.status)}">
    <div class="item-top">
      <span class="badge" style="background:${st.color}">${st.label}</span>
      ${showTheme ? `<span class="tl-theme">${esc(theme.name)}</span>` : ''}
      <span class="item-date">${esc(fmtDate(item.date))}</span>
    </div>
    <h3>${esc(item.title)}</h3>
    ${facts ? `<ul>${facts}</ul>` : ''}
    ${srcs ? `<div class="sources">${srcs}</div>` : ''}
  </article>`;
}

async function boot() {
  const res = await fetch('./data/policies.json', { cache: 'no-cache' });
  const data = await res.json();
  const themes = data.themes;
  const byId = new Map(themes.map((t) => [t.id, t]));
  const allItems = themes.flatMap((t) => t.items.map((i) => ({ ...i, theme: t })));

  $('#about-updated').textContent = fmtDate(data.meta.updated);
  $('#foot-updated').textContent = fmtDate(data.meta.updated);
  $('#repo-link').href = REPO_URL;
  const camp = data.meta.campaign;
  $('#about-campaign').innerHTML = `<ul>${camp.facts.map((f) => `<li>${esc(f)}</li>`).join('')}<li>${esc(data.meta.platformNote)}</li></ul>
    <div class="sources">${camp.sources.map((s) => `<a class="src" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">↗ ${esc(sourceLabel(s))}</a>`).join('')}</div>`;

  // ---------- hero stats ----------
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, allItems.filter((i) => i.status === s).length]));
  const srcCount = new Set(allItems.flatMap((i) => (i.sources || []).map((s) => s.url))).size;
  $('#hero-stats').innerHTML = [
    [themes.length, '政策島'], [allItems.length, '施政項目'], [srcCount, '引用來源'],
  ].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');

  $('#hero-note').textContent = `截至 ${fmtDate(data.meta.updated)}，尚未查得完整連任政見白皮書；本站以任內施政與市府已公布的規劃為主。`;

  // ---------- status chips ----------
  let statusFilter = null;
  const chips = $('#status-chips');
  chips.innerHTML = `<button class="chip" data-s="" aria-pressed="true">全部 <span class="n">${allItems.length}</span></button>` +
    STATUS_ORDER.map((s) => `<button class="chip" data-s="${s}" aria-pressed="false"><i style="background:${STATUS[s].color}"></i>${STATUS[s].label} <span class="n">${counts[s]}</span></button>`).join('');
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    statusFilter = b.dataset.s || null;
    chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    world?.setStatusFilter(statusFilter);
    applyFilterToDom();
  });
  function applyFilterToDom() {
    document.querySelectorAll('.item').forEach((el) => {
      el.classList.toggle('is-filtered', !!statusFilter && el.dataset.status !== statusFilter);
    });
  }

  // ---------- panel ----------
  const panel = $('#panel');
  const panelInner = $('#panel-inner');
  let currentTheme = null;

  function openTheme(id, itemId, { fromHash = false } = {}) {
    const theme = byId.get(id);
    if (!theme) return;
    currentTheme = id;
    hideHero();
    const sorted = [...theme.items].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
    const tc = Object.fromEntries(STATUS_ORDER.map((s) => [s, theme.items.filter((i) => i.status === s).length]));
    const idx = themes.indexOf(theme);
    const prev = themes[(idx - 1 + themes.length) % themes.length];
    const next = themes[(idx + 1) % themes.length];
    panelInner.innerHTML = `
      <div class="panel-head">
        <span class="panel-tag"><i style="background:${theme.color}"></i>政策島 ${String(idx + 1).padStart(2, '0')} / ${themes.length}</span>
        <h2>${esc(theme.name)}</h2>
        <p>${esc(theme.summary)}</p>
      </div>
      <div class="status-bar">${STATUS_ORDER.map((s) => tc[s] ? `<span style="flex:${tc[s]};background:${STATUS[s].color}"></span>` : '').join('')}</div>
      <div class="status-count">${STATUS_ORDER.filter((s) => tc[s]).map((s) => `<span>${STATUS[s].label} <b>${tc[s]}</b></span>`).join('')}</div>
      ${sorted.map((i) => itemHTML(i, theme)).join('')}
      <div class="panel-nav">
        <button data-go="${prev.id}">← ${esc(prev.name)}</button>
        <button data-go="${next.id}">${esc(next.name)} →</button>
      </div>`;
    applyFilterToDom();
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    panelInner.scrollTop = 0;
    world?.focusTheme(id);
    stagedItem = null;
    stageItem(itemId || sorted[0]?.id);
    if (itemId) {
      const el = document.getElementById(`item-${itemId}`);
      if (el) {
        lockStage = true;
        requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        el.classList.add('is-flash');
        setTimeout(() => el.classList.remove('is-flash'), 1800);
      }
      world?.flashItem(id, itemId);
    }
    if (!fromHash) history.replaceState(null, '', `#/${id}${itemId ? '/' + itemId : ''}`);
  }

  function closePanel() {
    if (!currentTheme) return;
    currentTheme = null;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    world?.resetView();
    history.replaceState(null, '', location.pathname + location.search);
  }

  // 小舞台演出「目前正在讀的那一項」：捲動面板時跟著換場景，點卡片也會切換
  let stagedItem = null;
  function stageItem(itemId) {
    if (!currentTheme || !itemId || itemId === stagedItem) return;
    stagedItem = itemId;
    world?.showVignette(currentTheme, itemId);
    panelInner.querySelectorAll('.item').forEach((el) => el.classList.toggle('is-staged', el.id === `item-${itemId}`));
  }
  let scrollRaf = 0;
  // 程式自動捲動到指定項目時，先鎖住場景；等使用者自己捲動或觸控才交回給捲動偵測
  let lockStage = false;
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((ev) => panelInner.addEventListener(ev, () => { lockStage = false; }, { passive: true }));
  panelInner.addEventListener('scroll', () => {
    if (lockStage) return;
    cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      const box = panelInner.getBoundingClientRect();
      const line = box.top + box.height * 0.3;
      let best = null, bestD = Infinity;
      panelInner.querySelectorAll('.item:not(.is-filtered)').forEach((el) => {
        const r = el.getBoundingClientRect();
        const d = r.top <= line && r.bottom >= line ? 0 : Math.min(Math.abs(r.top - line), Math.abs(r.bottom - line));
        if (d < bestD) { bestD = d; best = el; }
      });
      if (best) stageItem(best.id.replace(/^item-/, ''));
    });
  }, { passive: true });

  panelInner.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { openTheme(go.dataset.go); return; }
    const card = e.target.closest('.item');
    if (card && !e.target.closest('a')) stageItem(card.id.replace(/^item-/, ''));
  });
  $('#panel-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
    if (!currentTheme || view !== 'island') return;
    const idx = themes.findIndex((t) => t.id === currentTheme);
    if (e.key === 'ArrowRight') openTheme(themes[(idx + 1) % themes.length].id);
    if (e.key === 'ArrowLeft') openTheme(themes[(idx - 1 + themes.length) % themes.length].id);
  });
  // 手機：從把手往下拖可關閉面板
  {
    let y0 = null;
    const grip = panel.querySelector('.panel-grip');
    panel.addEventListener('touchstart', (e) => {
      if (e.target === grip || panelInner.scrollTop <= 0) y0 = e.touches[0].clientY;
    }, { passive: true });
    panel.addEventListener('touchend', (e) => {
      if (y0 !== null && e.changedTouches[0].clientY - y0 > 90) closePanel();
      y0 = null;
    });
  }

  // ---------- hero ----------
  const hero = $('#hero');
  function hideHero() { hero.classList.add('is-hidden'); document.body.classList.add('started'); }
  $('#btn-start').addEventListener('click', () => openTheme(themes[0].id));

  // ---------- list & timeline views ----------
  function renderList() {
    $('#list-inner').innerHTML = `<h2>全部施政項目</h2><p class="lead">依政策領域排列，共 ${allItems.length} 項。點來源連結可查看原始資料。</p>` +
      themes.map((t) => `<section class="theme-block" id="list-${t.id}">
        <h3><i style="background:${t.color}"></i>${esc(t.name)}</h3><p>${esc(t.summary)}</p>
        <div class="grid">${[...t.items].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)).map((i) => itemHTML(i, t)).join('')}</div>
      </section>`).join('');
  }
  function renderTimeline() {
    const dated = allItems.filter((i) => i.date).sort((a, b) => a.date.localeCompare(b.date));
    const undated = allItems.filter((i) => !i.date);
    let html = `<h2>時間軸</h2><p class="lead">依事件日期排序（啟用、通車、公布或提出的日期）。沒有明確日期的項目列在最後。</p>`;
    let year = null;
    dated.forEach((i) => {
      const y = i.date.slice(0, 4);
      if (y !== year) { year = y; html += `<div class="tl-year">${y}</div>`; }
      html += `<div class="tl-row" style="--dot:${STATUS[i.status]?.color}"><div class="tl-when">${esc(fmtDate(i.date))}</div><div>${itemHTML(i, i.theme, { showTheme: true })}</div></div>`;
    });
    if (undated.length) {
      html += `<div class="tl-year">未定日期</div>`;
      undated.forEach((i) => {
        html += `<div class="tl-row" style="--dot:${STATUS[i.status]?.color}"><div class="tl-when">—</div><div>${itemHTML(i, i.theme, { showTheme: true })}</div></div>`;
      });
    }
    $('#timeline-inner').innerHTML = html;
  }
  renderList();
  renderTimeline();

  let view = 'island';
  function setView(v) {
    view = v;
    document.querySelectorAll('.view-btn').forEach((b) => {
      const on = b.dataset.view === v;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('#list-view').hidden = v !== 'list';
    $('#timeline-view').hidden = v !== 'timeline';
    const islandUi = v === 'island';
    document.body.classList.toggle('hide-labels', !islandUi);
    $('#legend').classList.toggle('is-hidden-ui', false);
    if (!islandUi) { hideHero(); panel.classList.remove('is-open'); }
    else if (currentTheme) panel.classList.add('is-open');
    world?.setPaused(!islandUi);
    applyFilterToDom();
  }
  document.querySelector('.views').addEventListener('click', (e) => {
    const b = e.target.closest('.view-btn');
    if (b) setView(b.dataset.view);
  });

  // ---------- tooltip ----------
  const tip = $('#tooltip');
  function onHoverItem(h, x, y) {
    if (!h) { tip.hidden = true; return; }
    const t = byId.get(h.themeId);
    const item = t?.items.find((i) => i.id === h.itemId);
    if (!item) { tip.hidden = true; return; }
    tip.innerHTML = `<b>${esc(item.title)}</b><span>${STATUS[item.status]?.label || ''}・${esc(t.name)}</span>`;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
    tip.hidden = false;
  }

  // ---------- day / night ----------
  let night = false;
  $('#btn-daynight').addEventListener('click', () => {
    night = !night;
    document.body.classList.toggle('night', night);
    world?.setNight(night);
  });

  // ---------- about ----------
  const about = $('#about');
  $('#btn-about').addEventListener('click', () => about.showModal());
  about.addEventListener('click', (e) => { if (e.target === about) about.close(); });

  // ---------- 3D world ----------
  let world = null;
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
    const { createWorld } = await import('./world.js');
    world = createWorld({
      container: $('#stage'),
      themes,
      onSelectTheme: (id) => openTheme(id),
      onSelectItem: (id, itemId) => openTheme(id, itemId),
      onHoverItem,
    });
  } catch (err) {
    console.warn('3D 場景無法啟動，改用清單檢視：', err);
    document.querySelector('[data-view="island"]').disabled = true;
    setView('list');
  }

  // ---------- deep link ----------
  function fromHash() {
    const [, id, itemId] = location.hash.match(/^#\/([\w-]+)(?:\/([\w-]+))?/) || [];
    if (id && byId.has(id)) openTheme(id, itemId, { fromHash: true });
  }
  window.addEventListener('hashchange', fromHash);
  setTimeout(fromHash, 600);

  $('#loading').classList.add('is-done');
}

boot().catch((err) => {
  console.error(err);
  $('#loading p').textContent = '載入失敗，請重新整理。';
});
