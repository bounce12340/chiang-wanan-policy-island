// UI 與資料：讀 data/policies.json，畫出面板、清單、時間軸，並和 3D 場景連動。
const STATUS = {
  done: { label: '已完成', color: '#2e9e5b' },
  in_progress: { label: '進行中', color: '#2f7dd3' },
  proposal: { label: '規劃中', color: '#d99a14' },
  pledge: { label: '連任政見', color: '#d0457a' },
};
const STATUS_ORDER = ['done', 'in_progress', 'proposal', 'pledge'];
import { loadPledges, renderPledges, focusPledge, PLEDGE_STATUS, PLEDGE_ORDER, countByStatus, reportUrl } from './pledges.js';
import { createTour } from './tour.js';
import { loadMayors, renderMayors } from './mayors.js';
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
    <div class="item-actions"><a class="report-btn" href="${esc(reportUrl('施政項目', item.id, item.title, st.label))}" target="_blank" rel="noopener noreferrer">回報錯誤</a><button class="share-btn" data-share="/i/${esc(item.id)}" data-title="${esc(item.title)}">分享</button></div>
  </article>`;
}

// ---------- 分享：每一項都有自己的網址與縮圖（/p/<政見>、/i/<施政項目>） ----------
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('is-on'), 2200);
}
document.addEventListener('click', async (e) => {
  const c = e.target.closest('.copy-btn');
  if (c) {
    e.preventDefault();
    e.stopPropagation();
    try { await navigator.clipboard.writeText(c.dataset.copy); toast(c.dataset.done || '已複製'); }
    catch { window.prompt('複製這段語法：', c.dataset.copy); }
    return;
  }
  const b = e.target.closest('.share-btn');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  const url = new URL(b.dataset.share, location.origin).href;
  const title = `${b.dataset.title}｜臺北施政島`;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title, url }); return; } catch (err) { if (err.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('已複製分享連結'); }
  catch { window.prompt('複製這個連結：', url); }
}, true);

async function boot() {
  const res = await fetch('./data/policies.json', { cache: 'no-cache' });
  const data = await res.json();
  const themes = data.themes;
  const byId = new Map(themes.map((t) => [t.id, t]));
  const allItems = themes.flatMap((t) => t.items.map((i) => ({ ...i, theme: t })));
  let world = null; // 3D 場景稍後才建立；在那之前所有 world?.xxx 呼叫都安全略過
  let tour = null; // 自動導覽，3D 啟動後才建立

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

  // 2022 政見兌現：資料另外載入，等瀏覽器閒下來再抓，不擋住首頁
  const whenIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 1200));
  new Promise((r) => whenIdle(r)).then(() => loadPledges()).then((pd) => {
    const stat = document.createElement('div');
    stat.className = 'stat stat-pledge';
    stat.innerHTML = `<b>${pd.items.length}</b><span>2022 政見查證</span>`;
    $('#hero-stats').append(stat);
  }).catch((err) => console.warn('政見資料載入失敗', err));
  $('#btn-pledges').addEventListener('click', () => { setView('pledges'); location.hash = '#/pledges'; });

  $('#hero-note').textContent = `截至 ${fmtDate(data.meta.updated)}，尚未查得完整連任政見白皮書；本站以任內施政與市府已公布的規劃為主。`;

  // ---------- status chips ----------
  let statusFilter = null;
  const chipHTML = `<button class="chip" data-s="" aria-pressed="true">全部 <span class="n">${allItems.length}</span></button>` +
    STATUS_ORDER.map((s) => `<button class="chip" data-s="${s}" aria-pressed="false"><i style="background:${STATUS[s].color}"></i>${STATUS[s].label} <span class="n">${counts[s]}</span></button>`).join('');
  document.querySelectorAll('.status-chips').forEach((box) => {
    box.innerHTML = chipHTML;
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      statusFilter = b.dataset.s || null;
      document.querySelectorAll('.status-chips .chip').forEach((c) => c.setAttribute('aria-pressed', String((c.dataset.s || null) === statusFilter)));
      world?.setStatusFilter(statusFilter);
      applyFilterToDom();
      renderIndex();
    });
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
    if (tour?.active) tour.stop();
    currentTheme = id;
    hideHero();
    closeBubble();
    resetTimeline();
    const sorted = [...theme.items].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
    const tc = Object.fromEntries(STATUS_ORDER.map((s) => [s, theme.items.filter((i) => i.status === s).length]));
    const idx = themes.indexOf(theme);
    const prev = themes[(idx - 1 + themes.length) % themes.length];
    const next = themes[(idx + 1) % themes.length];
    panelInner.innerHTML = `
      <img class="panel-art" src="./assets/themes/${theme.id}.webp" alt="${esc(theme.name)}主題插畫（AI 生成）" width="800" height="600">
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
    panelInner.querySelector('.panel-art')?.addEventListener('error', (e) => e.target.remove());
    applyFilterToDom();
    markIndexActive();
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
    closeBubble();
    markIndexActive();
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
    if (card && !e.target.closest('a, button')) stageItem(card.id.replace(/^item-/, ''));
  });
  $('#panel-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!$('#pledge-pop').hidden) { $('#pledge-pop').hidden = true; return; } if (bubbleOpen) { closeBubble(); return; } closePanel(); }
    // 數字鍵 1–9 直接打開對應的政策島
    if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest?.('input, textarea') && view === 'island' && !tour?.active) {
      const t = themes[+e.key - 1];
      if (t) { openTheme(t.id); return; }
    }
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
  function hideHero() {
    if (hero.classList.contains('is-hidden')) return;
    hero.classList.add('is-hidden');
    document.body.classList.add('started');
    // 介紹卡淡出後，地圖重新置中到空出來的位置
    setTimeout(() => world?.refreshLayout(), 520);
  }
  $('#btn-start').addEventListener('click', () => openTheme(themes[0].id));

  // ---------- list & timeline views ----------
  function renderList() {
    $('#list-inner').innerHTML = `<h2>全部施政項目</h2><p class="lead">依政策領域排列，共 ${allItems.length} 項。點來源連結可查看原始資料。</p>` +
      themes.map((t, n) => `<section class="theme-block" id="list-${t.id}">
        <div class="theme-head"><img class="theme-art" src="./assets/themes/${t.id}.webp" alt="" loading="lazy" width="800" height="600">
        <div><h3><em style="color:${t.color}">${String(n + 1).padStart(2, '0')}</em>${esc(t.name)}</h3><p>${esc(t.summary)}</p></div></div>
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
  document.querySelectorAll('.theme-art').forEach((img) => img.addEventListener('error', () => img.remove()));

  // ---------- 政策索引側欄＋搜尋 ----------
  const indexList = $('#index-list');
  const indexHits = $('#index-hits');
  const searchInput = $('#search');
  $('#index-meta').textContent = `${themes.length} 個政策領域／${allItems.length} 項施政／${srcCount} 個來源`;
  function renderIndex() {
    indexList.innerHTML = themes.map((t, n) => {
      const shown = statusFilter ? t.items.filter((i) => i.status === statusFilter).length : t.items.length;
      return `<li><button class="idx-row${shown ? '' : ' is-empty'}" data-theme="${t.id}">
        <em style="color:${t.color}">${String(n + 1).padStart(2, '0')}</em><span>${esc(t.name)}</span><small>${shown}${statusFilter ? `/${t.items.length}` : ''}</small><i aria-hidden="true">↗</i>
      </button></li>`;
    }).join('');
    markIndexActive();
  }
  function markIndexActive() {
    indexList.querySelectorAll('.idx-row').forEach((b) => b.classList.toggle('is-active', b.dataset.theme === currentTheme));
  }
  const norm = (x) => String(x || '').toLowerCase();
  function runSearch() {
    const q = norm(searchInput.value.trim());
    if (!q) { indexHits.hidden = true; indexList.hidden = false; return; }
    const hits = allItems.filter((i) => [i.title, i.theme.name, ...(i.facts || [])].some((f) => norm(f).includes(q)))
      .filter((i) => !statusFilter || i.status === statusFilter).slice(0, 40);
    indexList.hidden = true;
    indexHits.hidden = false;
    indexHits.innerHTML = hits.length
      ? `<p class="hits-count">找到 ${hits.length} 項</p>` + hits.map((i) => `<button class="idx-hit" data-theme="${i.theme.id}" data-item="${esc(i.id)}">
          <span class="badge" style="background:${STATUS[i.status].color}">${STATUS[i.status].label}</span>
          <b>${esc(i.title)}</b><small>${esc(i.theme.name)}</small></button>`).join('')
      : '<p class="hits-count">找不到符合的項目，試試其他關鍵字。</p>';
  }
  searchInput.addEventListener('input', runSearch);
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput && !e.target.closest?.('input, textarea')) { e.preventDefault(); searchInput.focus(); }
  });
  $('#index').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme]');
    if (!b) return;
    if (view !== 'island') setView('island');
    openTheme(b.dataset.theme, b.dataset.item);
  });
  renderIndex();

  let view = 'island';
  function setView(v) {
    if (v !== 'island' && tour?.active) tour.stop();
    view = v;
    document.querySelectorAll('.view-btn').forEach((b) => {
      const on = b.dataset.view === v;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('#list-view').hidden = v !== 'list';
    $('#timeline-view').hidden = v !== 'timeline';
    $('#pledges-view').hidden = v !== 'pledges';
    $('#mayors-view').hidden = v !== 'mayors';
    if (v === 'pledges') ensurePledges();
    if (v === 'mayors') ensureMayors();
    const islandUi = v === 'island';
    document.body.classList.toggle('hide-labels', !islandUi);
    $('#legend').classList.toggle('is-hidden-ui', false);
    if (!islandUi) { hideHero(); panel.classList.remove('is-open'); }
    else if (currentTheme) panel.classList.add('is-open');
    world?.setPaused(!islandUi);
    applyFilterToDom();
  }
  // ---------- 2022 政見兌現 ----------
  let pledgesReady = null;
  const pledgesRoot = $('#pledges-inner');
  function itemTitle(themeId, itemId) {
    const t = byId.get(themeId);
    if (!t) return null;
    if (!itemId) return t.name;
    return t.items.find((i) => i.id === itemId)?.title || null;
  }
  let mayorsReady = null;
  function ensureMayors() {
    if (!mayorsReady) {
      mayorsReady = loadMayors().then((md) => renderMayors($('#mayors-inner'), md, {
        onOpenTheme: (themeId, itemId) => { setView('island'); openTheme(themeId, itemId); },
      })).catch((err) => {
        mayorsReady = null;
        console.warn(err);
        $('#mayors-inner').innerHTML = '<p class="lead">市長接力資料載入失敗，請重新整理再試一次。</p>';
      });
    }
    return mayorsReady;
  }
  function ensurePledges() {
    if (!pledgesReady) {
      pledgesReady = loadPledges().then((pd) => {
        renderPledges(pledgesRoot, pd, {
          itemTitle,
          onOpen: (themeId, itemId) => { setView('island'); openTheme(themeId, itemId); },
        });
      }).catch((err) => {
        pledgesReady = null;
        console.warn(err);
        pledgesRoot.innerHTML = '<p class="lead">政見資料載入失敗，請重新整理再試一次。</p>';
      });
    }
    return pledgesReady;
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

  // ---------- 時段：清晨／白天／黃昏／夜晚 ----------
  const TOD_ORDER = ['dawn', 'day', 'dusk', 'night'];
  const TOD_LABEL = { dawn: '清晨', day: '白天', dusk: '黃昏', night: '夜晚' };
  const cycleBtn = $('#btn-tod-cycle');
  let tod = 'day';
  function setTod(key) {
    tod = key;
    document.body.classList.toggle('night', key === 'night');
    document.body.dataset.tod = key;
    document.querySelectorAll('.tod-btn').forEach((b) => {
      const on = b.dataset.tod === key;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const src = document.querySelector(`.tod-btn[data-tod="${key}"] svg`);
    if (src) cycleBtn.innerHTML = src.outerHTML;
    cycleBtn.setAttribute('aria-label', `切換時段（目前：${TOD_LABEL[key]}）`);
    world?.setTimeOfDay(key);
  }
  document.querySelector('.tod').addEventListener('click', (e) => {
    const b = e.target.closest('.tod-btn');
    if (b) setTod(b.dataset.tod);
  });
  cycleBtn.addEventListener('click', () => setTod(TOD_ORDER[(TOD_ORDER.indexOf(tod) + 1) % TOD_ORDER.length]));
  setTod('day');

  // ---------- about ----------
  const about = $('#about');
  $('#btn-about').addEventListener('click', () => about.showModal());
  about.addEventListener('click', (e) => { if (e.target === about) about.close(); });

  // ---------- 點居民：對話泡泡講一項相關政策 ----------
  let bubbleOpen = false;
  function closeBubble() {
    if (!bubbleOpen) return;
    bubbleOpen = false;
    world?.hideBubble();
  }
  function showPersonBubble(meta, person) {
    if (!meta) return;
    const theme = byId.get(meta.themeId);
    const item = theme?.items.find((i) => i.id === meta.itemId);
    if (!item) return;
    const st = STATUS[item.status];
    const outer = document.createElement('div');
    outer.className = 'bubble-anchor';
    outer.innerHTML = `<div class="bubble" role="dialog" aria-label="${esc(item.title)}">
      <button class="bubble-x" type="button" aria-label="關閉">×</button>
      <div class="bubble-top"><span class="badge" style="background:${st.color}">${st.label}</span><span class="bubble-theme">${esc(theme.name)}</span></div>
      <b>${esc(item.title)}</b>
      ${item.facts?.[0] ? `<p>${esc(item.facts[0])}</p>` : ''}
      <button class="bubble-more" type="button">看詳情與來源 →</button>
    </div>`;
    // 泡泡裡的點擊不要穿透到 3D 場景
    outer.addEventListener('pointerdown', (e) => e.stopPropagation());
    outer.querySelector('.bubble-x').addEventListener('click', (e) => { e.stopPropagation(); closeBubble(); });
    outer.querySelector('.bubble-more').addEventListener('click', (e) => { e.stopPropagation(); closeBubble(); openTheme(meta.themeId, meta.itemId); });
    world.showBubble(person, outer);
    bubbleOpen = true;
  }

  // ---------- 任期時間軸：依事件日期讓政策光點逐一亮起 ----------
  const DAY_MS = 86400000;
  const termStart = Date.UTC(2022, 11, 25); // 2022-12-25 就任
  const [uy, um, ud] = data.meta.updated.split('-').map(Number);
  const termEnd = Date.UTC(uy, um - 1, ud);
  const totalDays = Math.round((termEnd - termStart) / DAY_MS);
  const tbRange = $('#tb-range'), tbDate = $('#tb-date'), tbCount = $('#tb-count'), tbTicker = $('#tb-ticker'), tbReset = $('#tb-reset'), tbPlay = $('#tb-play');
  const itemTime = (d) => {
    const [y, m, day] = d.split('-').map(Number);
    return !m ? Date.UTC(y, 6, 1) : !day ? Date.UTC(y, m - 1, 15) : Date.UTC(y, m - 1, day);
  };
  const dated = allItems.filter((i) => i.date).map((i) => ({ ...i, t: itemTime(i.date) }));
  tbRange.min = 0;
  tbRange.max = totalDays;
  tbRange.step = 1;
  tbRange.value = totalDays;
  $('#tb-ticks').innerHTML = [2023, 2024, 2025, 2026].map((y) => {
    const pct = ((Date.UTC(y, 0, 1) - termStart) / DAY_MS / totalDays) * 100;
    return `<span style="left:${pct}%">${y}</span>`;
  }).join('');
  const fmtCut = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
  let timeActive = false;
  function applyTime({ fromPlay = false } = {}) {
    const v = +tbRange.value;
    const atEnd = v >= totalDays;
    const cut = termStart + v * DAY_MS;
    const shownN = atEnd ? allItems.length : dated.filter((i) => i.t <= cut).length;
    tbDate.textContent = atEnd ? `至 ${fmtDate(data.meta.updated)}` : fmtCut(cut);
    tbCount.textContent = `${shownN} / ${allItems.length} 項`;
    tbRange.style.setProperty('--pct', `${(v / totalDays) * 100}%`);
    tbReset.hidden = atEnd;
    $('#tb-hint').hidden = !atEnd;
    timeActive = !atEnd;
    const appeared = world?.setTimeCut(atEnd ? null : cut) || [];
    // 顯示「最近一項」：播放時是剛亮起的那項，拖動時是截至該日最新的一項
    const latest = fromPlay && appeared.length ? appeared[appeared.length - 1]
      : (!atEnd ? dated.filter((i) => i.t <= cut).sort((a, b) => b.t - a.t)[0] : null);
    if (latest) {
      const full = allItems.find((i) => i.id === latest.id);
      tbTicker.hidden = false;
      tbTicker.dataset.theme = full.theme.id;
      tbTicker.dataset.item = full.id;
      tbTicker.innerHTML = `<i style="background:${STATUS[full.status].color}"></i><span>${esc(fmtDate(full.date))}</span>${esc(full.title)}`;
    } else {
      tbTicker.hidden = true;
    }
  }
  let playing = false, playRaf = 0, playLast = 0;
  function stopPlay() {
    playing = false;
    cancelAnimationFrame(playRaf);
    $('#timebar').classList.remove('is-playing');
    tbPlay.setAttribute('aria-label', '播放任期時間軸');
  }
  function startPlay() {
    if (+tbRange.value >= totalDays) tbRange.value = 0;
    playing = true;
    playLast = performance.now();
    $('#timebar').classList.add('is-playing');
    tbPlay.setAttribute('aria-label', '暫停');
    hideHero();
    const step = (now) => {
      if (!playing) return;
      // 約 16 秒播完整個任期
      const next = Math.min(totalDays, +tbRange.value + ((now - playLast) / 16000) * totalDays);
      playLast = now;
      tbRange.value = next;
      applyTime({ fromPlay: true });
      if (next >= totalDays) { stopPlay(); return; }
      playRaf = requestAnimationFrame(step);
    };
    applyTime();
    playRaf = requestAnimationFrame(step);
  }
  function resetTimeline() {
    stopPlay();
    if (!timeActive) return;
    tbRange.value = totalDays;
    applyTime();
  }
  tbRange.addEventListener('input', () => { stopPlay(); applyTime(); });
  tbPlay.addEventListener('click', () => (playing ? stopPlay() : startPlay()));
  tbReset.addEventListener('click', resetTimeline);
  tbTicker.addEventListener('click', () => openTheme(tbTicker.dataset.theme, tbTicker.dataset.item));

  // ---------- 3D world ----------
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
      onSelectPerson: (meta, person) => showPersonBubble(meta, person),
      onSelectPledge: (id) => showPledgePop(id),
      onHoverPledge,
    });
    world.onBubbleGone(() => { bubbleOpen = false; });
  } catch (err) {
    console.warn('3D 場景無法啟動，改用清單檢視：', err);
    const islandBtn = document.querySelector('[data-view="island"]');
    islandBtn.disabled = true;
    islandBtn.title = '3D 島嶼無法在這個瀏覽器啟動';
    setView('list');
    // 告訴使用者發生什麼事，而不是只把按鈕變灰
    const note = document.createElement('div');
    note.className = 'fallback-note';
    note.setAttribute('role', 'status');
    note.innerHTML = '3D 島嶼無法啟動，已改用清單檢視。可以試著<button type="button">重新整理</button>；若仍無法使用，可能是瀏覽器不支援 WebGL。';
    note.querySelector('button').addEventListener('click', () => location.reload());
    document.querySelector('#list-inner').prepend(note);
  }

  applyTime();

  // ---------- 2022 承諾圖層：島緣光柱改成各條政見，顏色＝兌現狀態 ----------
  // 政見對應到哪座島：有關聯施政項目就放在那座島，否則依政策領域
  const CAT_THEME = { 市政: 'development', 居住: 'housing', 交通: 'transport', 育兒: 'family', 長照: 'care', 勞工: 'safety',
    動物保護: 'environment', 青年: 'industry', 教育: 'family', 文化: 'culture', 市民生活: 'culture', 經濟: 'industry', 產業: 'industry', 性別: 'safety' };
  const pledgeTheme = (p) => p.related?.[0]?.theme || CAT_THEME[p.category] || 'development';
  let pledgeData = null;
  const pop = $('#pledge-pop');
  function onHoverPledge(h, x, y) {
    const p = h && pledgeData?.items.find((q) => q.id === h.pledgeId);
    if (!p) { tip.hidden = true; return; }
    tip.innerHTML = `<b>${esc(p.pledge.length > 46 ? p.pledge.slice(0, 45) + '…' : p.pledge)}</b><span>2022 承諾・${PLEDGE_STATUS[p.status].label}</span>`;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
    tip.hidden = false;
  }
  function showPledgePop(id) {
    const p = pledgeData?.items.find((q) => q.id === id);
    if (!p) return;
    tip.hidden = true;
    const st = PLEDGE_STATUS[p.status];
    pop.innerHTML = `<button class="pop-close" aria-label="關閉">×</button>
      <p class="pop-kicker"><span class="badge" style="background:${st.color}">${st.label}</span>2022 承諾・${esc(p.category)}</p>
      <p class="pop-quote">${esc(p.pledge.length > 90 ? p.pledge.slice(0, 89) + '…' : p.pledge)}</p>
      <p class="pop-sum">${esc(p.summary)}</p>
      <div class="pop-actions"><button class="cta" data-pop="open">看完整查證與來源 →</button><button class="share-btn" data-share="/p/${esc(p.id)}" data-title="${esc(st.label)}｜${esc(p.pledge.slice(0, 40))}">分享</button></div>`;
    pop.hidden = false;
    pop.dataset.id = id;
  }
  pop.addEventListener('click', (e) => {
    if (e.target.closest('.pop-close')) { pop.hidden = true; return; }
    if (e.target.closest('[data-pop="open"]')) {
      const id = pop.dataset.id;
      pop.hidden = true;
      setView('pledges');
      ensurePledges().then(() => focusPledge(pledgesRoot, id));
      history.replaceState(null, '', `#/pledges/${id}`);
    }
  });
  // ---------- 政策關係：只收來源明說的關聯 ----------
  let linkData = null;
  function itemRef(ref) {
    const t = byId.get(ref.theme);
    return { theme: t, item: t?.items.find((i) => i.id === ref.item) };
  }
  function showLinkPop(k) {
    const l = linkData?.links[k];
    if (!l) return;
    const a = itemRef(l.from), b = itemRef(l.to);
    pop.innerHTML = `<button class="pop-close" aria-label="關閉">×</button>
      <p class="pop-kicker">政策關係・${esc(a.theme.name)} → ${esc(b.theme.name)}</p>
      <p class="pop-quote">${esc(l.label)}</p>
      <p class="pop-link"><i style="background:${a.theme.color}"></i>${esc(a.item.title)}<br><span>↓</span><br><i style="background:${b.theme.color}"></i>${esc(b.item.title)}</p>
      <p class="pop-sum">${esc(l.explain)}</p>
      <div class="sources">${l.sources.map((s) => `<a class="src" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer" title="${esc(s.title || s.url)}">↗ ${esc(sourceLabel(s))}</a>`).join('')}</div>
      <div class="pop-actions"><button class="cta" data-go-theme="${esc(l.from.theme)}" data-go-item="${esc(l.from.item)}">看${esc(a.theme.name)}</button><button class="cta cta-2" data-go-theme="${esc(l.to.theme)}" data-go-item="${esc(l.to.item)}">看${esc(b.theme.name)}</button></div>`;
    pop.hidden = false;
  }
  pop.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go-theme]');
    if (!g) return;
    pop.hidden = true;
    openTheme(g.dataset.goTheme, g.dataset.goItem);
  });
  async function ensureLinks() {
    if (linkData) return;
    const res = await fetch('./data/links.json', { cache: 'no-cache' });
    linkData = await res.json();
    world?.setLinks(linkData.links, (k) => showLinkPop(k));
  }

  const layerBox = $('#layer');
  const LEGEND_LINKS = '<small>每條弧線連起兩項有關聯的政策，點編號或清單看說明與來源。只收錄來源明確寫出關聯者。</small>';
  let pledgeLegend = '';
  async function setLayer(mode) {
    layerBox.querySelectorAll('[data-layer]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layer === mode)));
    document.body.classList.toggle('pledge-mode', mode === 'pledges');
    document.body.classList.toggle('link-mode', mode === 'links');
    const leg = $('#layer-legend');
    leg.hidden = mode === 'items';
    leg.innerHTML = mode === 'pledges' ? pledgeLegend : mode === 'links' ? LEGEND_LINKS : '';
    pop.hidden = true;
    if (mode !== 'items') { stopPlay(); resetTimeline(); hideHero(); }
    world?.setPledgeMode(mode === 'pledges');
    if (mode === 'links') { try { await ensureLinks(); } catch (err) { console.warn('關係資料載入失敗', err); } }
    if (mode === 'links' && linkData) {
      leg.innerHTML = `<ol class="link-list">${linkData.links.map((l, k) => {
        const a = byId.get(l.from.theme), b = byId.get(l.to.theme);
        return `<li><button data-link="${k}"><b>${k + 1}</b><span>${esc(l.label)}<small>${esc(a?.name)} → ${esc(b?.name)}</small></span></button></li>`;
      }).join('')}</ol>${LEGEND_LINKS}`;
    }
    world?.setLinkMode(mode === 'links');
    setTimeout(() => world?.refreshLayout(), 30);
  }
  layerBox.addEventListener('click', (e) => {
    const lk = e.target.closest('[data-link]');
    if (lk) { showLinkPop(+lk.dataset.link); return; }
    const b = e.target.closest('[data-layer]');
    if (b) setLayer(b.dataset.layer);
  });
  if (world) {
    new Promise((r) => whenIdle(r)).then(() => loadPledges()).then((pd) => {
      pledgeData = pd;
      world.setPledges(pd.items.map((p) => ({ id: p.id, themeId: pledgeTheme(p), status: p.status })),
        Object.fromEntries(PLEDGE_ORDER.map((s) => [s, PLEDGE_STATUS[s].color])));
      const c = countByStatus(pd.items);
      pledgeLegend = PLEDGE_ORDER.filter((s) => c[s]).map((s) => `<span><i style="background:${PLEDGE_STATUS[s].color}"></i>${PLEDGE_STATUS[s].label} ${c[s]}</span>`).join('')
        + '<small>點承諾牌看查證摘要</small>';
      if (document.body.classList.contains('pledge-mode')) $('#layer-legend').innerHTML = pledgeLegend;
    }).catch(() => { layerBox.hidden = true; });
  } else {
    layerBox.hidden = true;
  }

  // ---------- 自動導覽 ----------
  if (world) {
    tour = createTour({
      world, themes, byId, loadPledges,
      onStart: () => {
        if (!document.body.classList.contains('pledge-mode') && !document.body.classList.contains('link-mode')) { /* 已是施政圖層 */ } else setLayer('items');
        stopPlay();
        closeBubble();
        if (view !== 'island') setView('island');
        if (currentTheme) { currentTheme = null; panel.classList.remove('is-open'); panel.setAttribute('aria-hidden', 'true'); markIndexActive(); }
        hideHero();
        history.replaceState(null, '', '#/tour');
      },
      onEnd: () => { history.replaceState(null, '', location.pathname + location.search); setTimeout(() => world.refreshLayout(), 50); },
      onExplore: () => openTheme(themes[0].id),
      onPledges: (id) => { setView('pledges'); if (id) ensurePledges().then(() => focusPledge(pledgesRoot, id)); },
    });
    $('#btn-tour').addEventListener('click', () => tour.start());
    $('#hero-stories').addEventListener('click', (e) => {
      const b = e.target.closest('[data-story]');
      if (b) { tour.start(b.dataset.story); history.replaceState(null, '', `#/story/${b.dataset.story}`); }
    });
  } else {
    $('#btn-tour').hidden = true;
    $('#hero-stories').hidden = true;
  }

  // ---------- deep link ----------
  function fromHash() {
    const [, id, itemId] = location.hash.match(/^#\/([\w-]+)(?:\/([\w-]+))?/) || [];
    if (id === 'tour') { if (tour && !tour.active) tour.start(); return; }
    if (id === 'story') { if (tour) tour.start(itemId); return; }
    if (id === 'mayors') { setView('mayors'); return; }
    if (id === 'pledges') {
      setView('pledges');
      if (itemId) ensurePledges().then(() => focusPledge(pledgesRoot, itemId));
      return;
    }
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
