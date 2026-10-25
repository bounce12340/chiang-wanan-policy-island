// 互動加值：全站搜尋、收藏清單、「我是誰」身分篩選、政見猜猜看、上次造訪後的新內容。
// 由 main.js 在資料與 3D 場景就緒後呼叫 initExtras(ctx)；這裡不直接碰 3D，只透過 ctx 提供的函式切換畫面。
import { favs, diffSinceLastVisit, clearFresh } from './store.js';
import { PLEDGE_STATUS } from './pledges.js';

const $ = (sel, root = document) => root.querySelector(sel);
const norm = (s) => String(s ?? '').toLowerCase().replace(/台/g, '臺').replace(/\s+/g, ' ');
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function initExtras(ctx) {
  const { esc, fmtDate, toast, STATUS, allItems, byId } = ctx;
  const FRESH = new Map(); // key → 'new' | 'updated'
  let freshDate = null;

  // ---------- 共用：跳到某一頁的某個元素並閃一下 ----------
  function flashEl(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('is-flash');
    setTimeout(() => el.classList.remove('is-flash'), 1800);
  }
  const go = {
    item: (theme, item) => { ctx.setView('island'); ctx.openTheme(theme, item); },
    pledge: (id) => { ctx.setView('pledges'); ctx.ensurePledges().then(() => ctx.focusPledge(id)); history.replaceState(null, '', `#/pledges/${id}`); },
    ledger: (elId) => { ctx.setView('ledger'); ctx.ensureLedger().then(() => requestAnimationFrame(() => flashEl(elId))); },
    mayors: (elId) => { ctx.setView('mayors'); ctx.ensureMayors().then(() => requestAnimationFrame(() => flashEl(elId))); },
    future: (id) => { ctx.setView('timeline'); ctx.loadFuture().then(() => requestAnimationFrame(() => flashEl(`future-${id}`))); },
  };

  // ---------- 對話框：統一開關與焦點處理 ----------
  function sheet(id) {
    const d = document.getElementById(id);
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
    });
    d.addEventListener('close', () => {
      if (location.hash.startsWith(`#/${d.dataset.hash}`)) history.replaceState(null, '', location.pathname + location.search);
    });
    return d;
  }

  // =========================================================
  // 1. 全站搜尋
  // =========================================================
  const finder = sheet('finder');
  const fInput = $('#finder-input');
  const fList = $('#finder-results');
  let index = null;
  let active = 0;
  let shownRows = [];

  async function buildIndex() {
    if (index) return index;
    const rows = allItems.map((i) => ({
      kind: '施政', key: `i:${i.id}`, title: i.title, sub: `${i.theme.name}・${STATUS[i.status]?.label || ''}`, color: STATUS[i.status]?.color,
      hay: norm([i.title, i.theme.name, ...(i.facts || [])].join(' ')), go: () => go.item(i.theme.id, i.id),
    }));
    const [pd, ld, md, fd] = await Promise.all([
      ctx.loadPledges().catch(() => null), ctx.loadLedger().catch(() => null), ctx.loadMayors().catch(() => null), ctx.loadFuture().catch(() => null),
    ]);
    pd?.items.forEach((p) => rows.push({
      kind: '2022 政見', key: `p:${p.id}`, title: cut(p.pledge, 64), sub: `${p.category}・${PLEDGE_STATUS[p.status]?.label || ''}`, color: PLEDGE_STATUS[p.status]?.color,
      hay: norm([p.pledge, p.summary, p.category].join(' ')), go: () => go.pledge(p.id),
    }));
    ld?.groups.forEach((g) => g.items.forEach((it) => rows.push({
      kind: '民生帳本', title: it.title, sub: `${g.group}・${it.direction}`,
      hay: norm([g.group, it.title, it.before, it.after, it.who].join(' ')), go: () => go.ledger(`ledger-${g.id}`),
    })));
    ld?.problems.forEach((p) => rows.push({
      kind: '民生帳本', title: p.title, sub: `長期問題・${p.status}`,
      hay: norm([p.title, p.problem, p.policy].join(' ')), go: () => go.ledger(`problem-${p.id}`),
    }));
    md?.relays.forEach((r) => rows.push({
      kind: '市長接力', title: r.title, sub: '跨任期建設',
      hay: norm([r.title, r.summary, ...r.stages.map((s) => s.text)].join(' ')), go: () => go.mayors(`relay-${r.id}`),
    }));
    md?.mayors.forEach((m) => (m.items || []).forEach((it) => rows.push({
      kind: '市長接力', title: it.title, sub: `${m.name}・${fmtDate(it.date)}`,
      hay: norm([it.title, m.name, it.area, ...(it.facts || [])].join(' ')), go: () => go.mayors(`mayor-${m.id}`),
    })));
    fd?.items.forEach((f) => rows.push({
      kind: '未來藍圖', key: `f:${f.id}`, title: f.title, sub: `${f.kind === 'campaign' ? '競選承諾' : '市府計畫'}・${f.stage}`,
      hay: norm([f.title, ...(f.facts || [])].join(' ')), go: () => go.future(f.id),
    }));
    index = rows;
    return rows;
  }

  // 標出符合的字：先切片再逐段跳脫，避免把使用者輸入直接塞進 HTML
  function mark(text, terms) {
    const t = String(text);
    const low = norm(t);
    const hits = [];
    terms.forEach((q) => { let k = low.indexOf(q); while (q && k >= 0) { hits.push([k, k + q.length]); k = low.indexOf(q, k + q.length); } });
    if (!hits.length) return esc(t);
    hits.sort((a, b) => a[0] - b[0]);
    let out = '', pos = 0;
    hits.forEach(([a, b]) => { if (a < pos) return; out += esc(t.slice(pos, a)) + `<mark>${esc(t.slice(a, b))}</mark>`; pos = b; });
    return out + esc(t.slice(pos));
  }

  const ORDER = ['施政', '2022 政見', '民生帳本', '市長接力', '未來藍圖'];
  function renderRows(rows, terms, groupTitle) {
    shownRows = rows;
    active = 0;
    if (!rows.length) return '';
    let html = '', last = null, n = 0;
    rows.forEach((r) => {
      const g = groupTitle || r.kind;
      if (g !== last) { html += `<li class="fd-group" role="presentation">${esc(g)}</li>`; last = g; }
      const fresh = r.key && FRESH.get(r.key);
      html += `<li role="presentation"><button class="fd-row" role="option" data-n="${n++}" type="button">
        <i style="background:${r.color || 'var(--ink-soft)'}"></i>
        <span><b>${mark(r.title, terms)}</b><small>${esc(r.kind)}・${esc(r.sub)}</small></span>
        ${fresh ? `<em class="fresh-tag">${fresh === 'new' ? '新' : '更新'}</em>` : ''}
      </button></li>`;
    });
    return html;
  }

  async function runFind() {
    const raw = fInput.value.trim();
    if (!raw) { renderFinderHome(); return; }
    const rows = await buildIndex();
    if (fInput.value.trim() !== raw) return; // 使用者已經改了字
    const terms = norm(raw).split(' ').filter(Boolean);
    const hits = rows.filter((r) => terms.every((q) => r.hay.includes(q) || norm(r.title).includes(q)))
      .map((r) => ({ r, s: terms.reduce((a, q) => a + (norm(r.title).includes(q) ? 3 : 1), 0) }));
    const byKind = ORDER.map((k) => hits.filter((h) => h.r.kind === k).sort((a, b) => b.s - a.s));
    const picked = byKind.flatMap((list) => list.slice(0, 6).map((h) => h.r));
    const total = hits.length;
    fList.innerHTML = total
      ? `<li class="fd-count" role="presentation">找到 ${total} 筆${total > picked.length ? `，每類顯示前 6 筆` : ''}</li>${renderRows(picked, terms)}`
      : `<li class="fd-count" role="presentation">找不到「${esc(raw)}」。試試換個說法，例如「捷運」「托育」「敬老卡」「社宅」。</li>`;
    setActive(0);
  }

  function renderFinderHome() {
    const freshRows = [];
    if (FRESH.size) {
      allItems.forEach((i) => { if (FRESH.has(`i:${i.id}`)) freshRows.push({ kind: '施政', key: `i:${i.id}`, title: i.title, sub: i.theme.name, color: STATUS[i.status]?.color, go: () => go.item(i.theme.id, i.id) }); });
      (index || []).forEach((r) => { if (r.key && !r.key.startsWith('i:') && FRESH.has(r.key)) freshRows.push(r); });
    }
    fList.innerHTML = `
      <li class="fd-quick" role="presentation">
        <button type="button" data-quick="games">🎮 小遊戲</button>
        <button type="button" data-quick="quiz">🎯 政見猜猜看</button>
        <button type="button" data-quick="who">👤 我是…</button>
        <button type="button" data-quick="saved">☆ 我的收藏（${favs.all().length}）</button>
      </li>
      ${freshRows.length ? renderRows(freshRows.slice(0, 20), [], `自你上次造訪${freshDate ? `（${fmtDate(freshDate)}）` : ''}以來的新內容`) : ''}
      <li class="fd-count" role="presentation">可以搜尋施政、2022 政見、民生帳本、市長接力與未來藍圖。例如：捷運、托育、敬老卡、巨蛋。</li>`;
    if (!freshRows.length) shownRows = [];
    setActive(0);
  }

  function setActive(n) {
    const btns = [...fList.querySelectorAll('.fd-row')];
    if (!btns.length) return;
    active = (n + btns.length) % btns.length;
    btns.forEach((b, k) => b.classList.toggle('is-active', k === active));
    btns[active].scrollIntoView({ block: 'nearest' });
  }
  function pick(n) {
    const r = shownRows[n];
    if (!r) return;
    finder.close();
    r.go();
  }
  fInput.addEventListener('input', runFind);
  fInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    if (e.key === 'Enter') { e.preventDefault(); pick(active); }
  });
  fList.addEventListener('click', (e) => {
    const row = e.target.closest('.fd-row');
    if (row) { pick(+row.dataset.n); return; }
    const q = e.target.closest('[data-quick]');
    if (q) { finder.close(); ({ quiz: openQuiz, who: openWho, saved: () => openSaved(), games: () => ctx.openGames?.() })[q.dataset.quick](); }
  });
  function openFinder(q = '') {
    if (!finder.open) finder.showModal();
    fInput.value = q;
    fInput.focus();
    runFind();
    buildIndex().then(() => { if (!fInput.value.trim()) renderFinderHome(); });
  }
  $('#btn-find').addEventListener('click', () => openFinder());
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest?.('input, textarea, [contenteditable]');
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openFinder(); return; }
    if (e.key === '/' && !typing && !document.querySelector('dialog[open]')) { e.preventDefault(); openFinder(); }
  });

  // =========================================================
  // 2. 收藏
  // =========================================================
  const savedDlg = sheet('saved');
  const savedBody = $('#saved-body');
  const savedCount = $('#saved-count');
  function syncFavButtons(root = document) {
    const set = new Set(favs.all());
    root.querySelectorAll('[data-fav]').forEach((b) => {
      const on = set.has(b.dataset.fav);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? '已收藏' : '收藏';
    });
    savedCount.textContent = set.size || '';
    savedCount.hidden = !set.size;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.fav-btn');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const on = favs.toggle(b.dataset.fav);
    toast(on ? '已加入收藏（只存在這台裝置的瀏覽器）' : '已從收藏移除');
  }, true);
  favs.onChange(() => { syncFavButtons(); if (savedDlg.open) renderSaved(sharedKeys); });

  async function resolveKeys(keys) {
    const pd = keys.some((k) => k.startsWith('p:')) ? await ctx.loadPledges().catch(() => null) : null;
    return keys.map((k) => {
      const [t, id] = [k.slice(0, 1), k.slice(2)];
      if (t === 'i') {
        const i = allItems.find((x) => x.id === id);
        return i && { key: k, kind: '施政', title: i.title, sub: i.theme.name, color: STATUS[i.status]?.color, go: () => go.item(i.theme.id, i.id) };
      }
      const p = pd?.items.find((x) => x.id === id);
      return p && { key: k, kind: '2022 政見', title: cut(p.pledge, 70), sub: PLEDGE_STATUS[p.status]?.label, color: PLEDGE_STATUS[p.status]?.color, go: () => go.pledge(p.id) };
    }).filter(Boolean);
  }
  let sharedKeys = null;
  async function renderSaved(shared = null) {
    const mine = favs.all();
    const keys = shared || mine;
    const rows = await resolveKeys(keys);
    const isShared = !!shared;
    const newOnes = isShared ? keys.filter((k) => !mine.includes(k)) : [];
    savedBody.innerHTML = `
      ${isShared ? `<p class="sv-note">朋友分享給你的清單，共 ${rows.length} 項。${newOnes.length ? `<button class="cta" type="button" data-sv="import">把 ${newOnes.length} 項加入我的收藏</button>` : '這些都已在你的收藏裡。'}</p>` : ''}
      ${rows.length ? `<ol class="sv-list">${rows.map((r, n) => `<li>
        <i style="background:${r.color || 'var(--ink-soft)'}"></i>
        <button class="sv-open" type="button" data-n="${n}"><b>${esc(r.title)}</b><small>${esc(r.kind)}・${esc(r.sub || '')}</small></button>
        ${isShared ? '' : `<button class="sv-x" type="button" data-fav-x="${esc(r.key)}" aria-label="從收藏移除">×</button>`}
      </li>`).join('')}</ol>`
        : '<p class="sv-empty">還沒有收藏。看到想留下來的施政或政見，按卡片上的「收藏」就會出現在這裡。收藏只存在這台裝置的瀏覽器裡，不會上傳。</p>'}
      <div class="sv-actions">
        ${!isShared && rows.length ? '<button class="cta" type="button" data-sv="share">分享我的清單</button><button class="cta cta-2" type="button" data-sv="clear">全部清除</button>' : ''}
        ${isShared ? '<button class="cta cta-2" type="button" data-sv="mine">看我自己的收藏</button>' : ''}
      </div>`;
    savedBody.onclick = async (e) => {
      const open = e.target.closest('.sv-open');
      if (open) { savedDlg.close(); rows[+open.dataset.n].go(); return; }
      const x = e.target.closest('[data-fav-x]');
      if (x) { favs.toggle(x.dataset.favX); return; }
      const a = e.target.closest('[data-sv]')?.dataset.sv;
      if (a === 'import') { favs.add(newOnes); toast(`已加入 ${newOnes.length} 項`); sharedKeys = null; renderSaved(); }
      if (a === 'mine') { sharedKeys = null; renderSaved(); }
      if (a === 'clear' && confirm('清除全部收藏？')) { favs.all().forEach((k) => favs.toggle(k)); }
      if (a === 'share') {
        const url = `${location.origin}${location.pathname}#/saved/${mine.join(',')}`;
        const title = `我在臺北施政島收藏的 ${mine.length} 項`;
        if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title, url }); return; } catch (err) { if (err.name === 'AbortError') return; } }
        try { await navigator.clipboard.writeText(url); toast('已複製清單連結'); } catch { window.prompt('複製這個連結：', url); }
      }
    };
  }
  function openSaved(shared = null) {
    sharedKeys = shared && shared.length ? shared.filter((k) => /^[ip]:[\w-]+$/.test(k)).slice(0, 100) : null;
    renderSaved(sharedKeys);
    if (!savedDlg.open) savedDlg.showModal();
  }
  $('#btn-saved').addEventListener('click', () => openSaved());

  // =========================================================
  // 3. 我是誰：依身分只亮出相關施政
  // =========================================================
  const whoDlg = sheet('who-sheet');
  const whoBar = $('#who-bar');
  let personas = null;
  let ledgerCounts = {};
  let currentWho = null;
  const personasReady = fetch(new URL('./data/personas.json', import.meta.url), { cache: 'no-cache' }).then((r) => r.json()).then((d) => {
    personas = d;
    const chips = d.personas.map((p) => `<button type="button" data-who="${esc(p.id)}">${p.emoji} ${esc(p.label)}</button>`).join('');
    $('#hero-who').innerHTML = `<span>我是：</span>${chips}`;
    $('#who-grid').innerHTML = chips;
    $('#who-note').textContent = d.meta.note;
    return d;
  });
  ctx.loadLedger().then((ld) => { ld.groups.forEach((g) => { ledgerCounts[g.id] = g.items.length; }); }).catch(() => {});

  async function setWho(id) {
    await personasReady;
    const p = personas.personas.find((x) => x.id === id) || null;
    currentWho = p;
    document.querySelectorAll('[data-who]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.who === p?.id)));
    if (!p) {
      whoBar.hidden = true;
      ctx.setWho(null);
      if (location.hash.startsWith('#/who')) history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    const items = p.items.filter((iid) => allItems.some((i) => i.id === iid));
    ctx.setView('island');
    ctx.hideHero();
    ctx.setWho(new Set(items));
    const pd = await ctx.loadPledges().catch(() => null);
    const nPledge = pd ? pd.items.filter((x) => p.pledgeCats.includes(x.category)).length : 0;
    const nLedger = ledgerCounts[p.ledger] || 0;
    whoBar.innerHTML = `<b>${p.emoji} ${esc(p.label)}</b>
      <span>${items.length ? `島上亮出 ${items.length} 項相關施政` : '島上沒有直接相關的施政項目'}</span>
      ${nLedger ? `<button type="button" data-whogo="ledger">民生帳本 ${nLedger} 項 →</button>` : ''}
      ${nPledge ? `<button type="button" data-whogo="pledges">相關 2022 政見 ${nPledge} 條 →</button>` : ''}
      ${items.length ? `<button type="button" data-whogo="list">列出這 ${items.length} 項</button>` : ''}
      <button type="button" class="who-x" data-whogo="clear" aria-label="清除身分篩選">×</button>`;
    whoBar.hidden = false;
    history.replaceState(null, '', `#/who/${p.id}`);
  }
  whoBar.addEventListener('click', (e) => {
    const a = e.target.closest('[data-whogo]')?.dataset.whogo;
    if (!a || !currentWho) return;
    if (a === 'clear') setWho(null);
    if (a === 'ledger') go.ledger(`ledger-${currentWho.ledger}`);
    if (a === 'list') { ctx.setView('list'); requestAnimationFrame(() => $('#list-view').scrollTo(0, 0)); }
    if (a === 'pledges') {
      ctx.setView('pledges');
      ctx.ensurePledges().then(() => ctx.setPledgeFilters({ cat: currentWho.pledgeCats[0] }));
    }
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-who]');
    if (!b) return;
    if (whoDlg.open) whoDlg.close();
    setWho(currentWho?.id === b.dataset.who ? null : b.dataset.who);
  });
  function openWho() { personasReady.then(() => whoDlg.showModal()); }
  $('#btn-who').addEventListener('click', openWho);

  // =========================================================
  // 4. 政見猜猜看
  // =========================================================
  const quizDlg = sheet('quiz');
  const quizBody = $('#quiz-body');
  const ANSWERS = ['done', 'partial', 'not_done'];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let quiz = null;
  async function startQuiz() {
    const pd = await ctx.loadPledges();
    const pool = (s) => shuffle(pd.items.filter((p) => p.status === s));
    // 各狀態都抽一些，避免題目幾乎全是「部分兌現」；比例不代表整體，畫面上會說明
    const plan = { done: 3, partial: 4, not_done: 3 };
    const qs = shuffle(Object.entries(plan).flatMap(([s, n]) => pool(s).slice(0, n)));
    quiz = { qs, k: 0, answers: [], asOf: pd.meta.asOf };
    renderQuiz();
  }
  function renderQuiz() {
    const { qs, k, answers } = quiz;
    if (k >= qs.length) { renderScore(); return; }
    const p = qs[k];
    const ans = answers[k];
    const st = PLEDGE_STATUS[p.status];
    quizBody.innerHTML = `
      <p class="qz-step">第 ${k + 1} / ${qs.length} 題 <span class="qz-dots">${qs.map((_, n) => `<i class="${n < k ? (answers[n] === qs[n].status ? 'ok' : 'no') : n === k ? 'cur' : ''}"></i>`).join('')}</span></p>
      <p class="qz-cat">${esc(p.category)}・2022 競選政見</p>
      <blockquote class="qz-quote">${esc(p.pledge)}</blockquote>
      <p class="qz-ask">到 ${esc(fmtDate(quiz.asOf))} 查證時，你覺得這條政見的狀態是？</p>
      <div class="qz-opts">${ANSWERS.map((s) => `<button type="button" data-ans="${s}" ${ans ? 'disabled' : ''}
        class="${ans ? (s === p.status ? 'is-right' : s === ans ? 'is-wrong' : '') : ''}"><i style="background:${PLEDGE_STATUS[s].color}"></i>${PLEDGE_STATUS[s].label}</button>`).join('')}</div>
      ${ans ? `<div class="qz-reveal" role="status">
        <p><b>${ans === p.status ? '答對了。' : `查證結果是「${st.label}」。`}</b>${esc(p.summary)}</p>
        <button type="button" class="cta" data-q="next">${k + 1 < qs.length ? '下一題 →' : '看成績'}</button>
      </div>` : ''}
      <p class="qz-note">題目從「已兌現、部分兌現、未兌現」三種狀態各抽幾題，比例不代表整體結果；完整統計與判斷方法請看政見兌現頁。</p>`;
    quizBody.querySelector(ans ? '[data-q="next"]' : '[data-ans]')?.focus();
  }
  function renderScore() {
    const { qs, answers } = quiz;
    const right = qs.filter((p, n) => answers[n] === p.status).length;
    ctx.onQuizDone?.();
    quizBody.innerHTML = `
      <p class="qz-step">結果</p>
      <p class="qz-score"><b>${right}</b><span>/ ${qs.length}</span></p>
      <p class="qz-ask">你猜對了 ${right} 題。點任一題可以看完整查證與來源。</p>
      <ol class="qz-review">${qs.map((p, n) => `<li class="${answers[n] === p.status ? 'ok' : 'no'}">
        <button type="button" data-review="${esc(p.id)}"><b>${esc(cut(p.pledge, 46))}</b>
        <small>你選：${PLEDGE_STATUS[answers[n]].label}・查證：${PLEDGE_STATUS[p.status].label}</small></button></li>`).join('')}</ol>
      <div class="sv-actions"><button type="button" class="cta" data-q="share">分享成績</button><button type="button" class="cta cta-2" data-q="again">再玩一次</button></div>`;
  }
  quizBody.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-ans]');
    if (a && quiz && !quiz.answers[quiz.k]) { quiz.answers[quiz.k] = a.dataset.ans; renderQuiz(); return; }
    const q = e.target.closest('[data-q]')?.dataset.q;
    if (q === 'next') { quiz.k++; renderQuiz(); }
    if (q === 'again') startQuiz();
    if (q === 'share') {
      const right = quiz.qs.filter((p, n) => quiz.answers[n] === p.status).length;
      const url = `${location.origin}${location.pathname}#/quiz`;
      const text = `我在「臺北施政島」的 2022 政見猜猜看答對 ${right}/${quiz.qs.length} 題，每題都附查證來源。你也來試試：`;
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title: '2022 政見猜猜看｜臺北施政島', text, url }); return; } catch (err) { if (err.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(`${text}${url}`); toast('已複製成績與連結'); } catch { window.prompt('複製這段文字：', `${text}${url}`); }
    }
    const r = e.target.closest('[data-review]');
    if (r) { quizDlg.close(); go.pledge(r.dataset.review); }
  });
  function openQuiz() {
    quizBody.innerHTML = '<p class="qz-ask">載入中…</p>';
    if (!quizDlg.open) quizDlg.showModal();
    history.replaceState(null, '', '#/quiz');
    startQuiz().catch(() => { quizBody.innerHTML = '<p class="qz-ask">政見資料載入失敗，請稍後再試。</p>'; });
  }
  $('#btn-quiz')?.addEventListener('click', openQuiz);

  // =========================================================
  // 5. 上次造訪後的新內容
  // =========================================================
  async function checkFresh() {
    const [pd, fd] = await Promise.all([ctx.loadPledges().catch(() => null), ctx.loadFuture().catch(() => null)]);
    const snap = {};
    allItems.forEach((i) => { snap[`i:${i.id}`] = i.status; });
    pd?.items.forEach((p) => { snap[`p:${p.id}`] = p.status; });
    fd?.items.forEach((f) => { snap[`f:${f.id}`] = f.stage; });
    const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
    const { date, fresh } = diffSinceLastVisit(snap, today);
    if (!fresh.size) return;
    freshDate = date;
    fresh.forEach((v, k) => FRESH.set(k, v));
    const nNew = [...fresh.values()].filter((v) => v === 'new').length;
    const nUpd = fresh.size - nNew;
    const box = $('#hero-fresh');
    box.innerHTML = `<b>自你上次造訪${date ? `（${esc(fmtDate(date))}）` : ''}以來：</b>${[nNew && `新增 ${nNew} 項`, nUpd && `狀態更新 ${nUpd} 項`].filter(Boolean).join('、')}
      <button type="button" data-fresh="see">看看是哪些</button><button type="button" data-fresh="ok">知道了</button>`;
    box.hidden = false;
    $('#btn-find').classList.add('has-dot');
    decorate(document);
  }
  $('#hero-fresh').addEventListener('click', (e) => {
    const a = e.target.closest('[data-fresh]')?.dataset.fresh;
    if (a === 'see') openFinder();
    if (a === 'ok') {
      clearFresh();
      FRESH.clear();
      $('#hero-fresh').hidden = true;
      $('#btn-find').classList.remove('has-dot');
      document.querySelectorAll('.fresh-tag').forEach((t) => t.remove());
    }
  });

  // 每次有新內容畫上去時呼叫：同步收藏按鈕、補上「新／更新」標籤、政見頁加上測驗入口
  function decorate(root = document) {
    syncFavButtons(root);
    if (FRESH.size) {
      root.querySelectorAll('.item[id^="item-"], .pl[id^="pl-"], .future-item[id^="future-"]').forEach((el) => {
        const key = el.id.startsWith('item-') ? `i:${el.id.slice(5)}` : el.id.startsWith('pl-') ? `p:${el.id.slice(3)}` : `f:${el.id.slice(7)}`;
        const v = FRESH.get(key);
        if (!v || el.querySelector('.fresh-tag')) return;
        const tag = document.createElement('em');
        tag.className = 'fresh-tag';
        tag.textContent = v === 'new' ? '新' : '更新';
        (el.querySelector('.item-top, .pl-top, .pop-kicker') || el).append(tag);
      });
    }
    const pl = root.querySelector?.('#pledges-inner .pl-summary-box') || (root.id === 'pledges-inner' ? root.querySelector('.pl-summary-box') : null);
    if (pl && !pl.querySelector('.pl-quiz')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cta pl-quiz';
      b.textContent = '🎯 先猜猜看：10 題政見兌現測驗';
      b.addEventListener('click', openQuiz);
      pl.append(b);
    }
  }

  return {
    decorate,
    openFinder, openSaved, openQuiz, openWho, setWho,
    checkFresh: () => checkFresh().catch((err) => console.warn('新內容比對失敗', err)),
  };
}
