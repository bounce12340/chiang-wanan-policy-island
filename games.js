// 小遊戲：遊戲大廳、排排看（時間順序）、這是哪位市長做的、每日一題、施政島護照（集章）。
// 題目全部取自站上已查證的資料，答完都附日期與來源；不出自編的假敘述。
import { read, write } from './store.js';
import { PLEDGE_STATUS } from './pledges.js';

const $ = (sel, root = document) => root.querySelector(sel);
const shuffle = (a, rnd = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// 每日一題用的可重現亂數：同一天每個人拿到同一題
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const taipeiDay = (offset = 0) => new Date(Date.now() + 8 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);
const toTime = (d) => { const [y, m = 7, day = 15] = d.split('-').map(Number); return Date.UTC(y, m - 1, day); };

export function initGames(ctx) {
  const { esc, fmtDate, toast, STATUS, allItems, themes } = ctx;
  const dlg = $('#game');
  const head = $('#game-h');
  const body = $('#game-body');
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
  dlg.addEventListener('close', () => {
    if (/^#\/(games|sort|whomayor|daily|passport)/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  });
  function open(title, hash) {
    head.textContent = title;
    body.innerHTML = '<p class="qz-ask">載入中…</p>';
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    history.replaceState(null, '', `#/${hash}`);
  }
  async function share(title, text, path) {
    const url = `${location.origin}${location.pathname}#/${path}`;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title, text, url }); return; } catch (err) { if (err.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(`${text}${url}`); toast('已複製文字與連結'); } catch { window.prompt('複製這段文字：', `${text}${url}`); }
  }
  const srcLink = (s) => (s ? `<a class="src" href="${esc(/^https?:/.test(s.url) ? s.url : '#')}" target="_blank" rel="noopener noreferrer">↗ ${esc([s.publisher, fmtDate(s.published)].filter(Boolean).join('・'))}</a>` : '');

  // =========================================================
  // 施政島護照：開島、看各頁、完成遊戲就蓋章
  // =========================================================
  const STAMPS = [
    ...themes.map((t, n) => ({ id: `isle:${t.id}`, label: t.name, kind: '島', color: t.color, n: String(n + 1).padStart(2, '0') })),
    { id: 'view:pledges', label: '政見兌現', kind: '頁', n: '政' },
    { id: 'view:ledger', label: '民生帳本', kind: '頁', n: '帳' },
    { id: 'view:mayors', label: '市長接力', kind: '頁', n: '史' },
    { id: 'view:timeline', label: '時間軸', kind: '頁', n: '時' },
    { id: 'game:quiz', label: '政見猜猜看', kind: '遊戲', n: '猜' },
    { id: 'game:sort', label: '排排看', kind: '遊戲', n: '序' },
    { id: 'game:mayor', label: '哪位市長', kind: '遊戲', n: '長' },
    { id: 'game:daily', label: '每日一題', kind: '遊戲', n: '日' },
  ];
  const islandIds = STAMPS.filter((s) => s.kind === '島').map((s) => s.id);
  const got = () => read('passport', {});
  function stamp(id) {
    const s = STAMPS.find((x) => x.id === id);
    const g = got();
    if (!s || g[id]) return;
    g[id] = taipeiDay();
    write('passport', g);
    const n = Object.keys(g).filter((k) => STAMPS.some((x) => x.id === k)).length;
    const islesDone = islandIds.every((k) => g[k]);
    const justIsles = islesDone && s.kind === '島';
    toast(justIsles ? `🏅 10 座島全部走過！獲得「施政島通」徽章（${n}/${STAMPS.length}）` : n === STAMPS.length ? `🏆 全部 ${n} 枚章集滿！` : `護照蓋章：${s.label}（${n}/${STAMPS.length}）`);
    syncPassportBtn();
  }
  function syncPassportBtn() {
    const g = got();
    const n = STAMPS.filter((s) => g[s.id]).length;
    const b = $('#passport-n');
    if (b) b.textContent = `${n}/${STAMPS.length}`;
  }
  function openPassport() {
    open('施政島護照', 'passport');
    const g = got();
    const n = STAMPS.filter((s) => g[s.id]).length;
    const isles = islandIds.filter((k) => g[k]).length;
    const badge = (on, name, need) => `<div class="pp-badge ${on ? 'is-on' : ''}"><b>${on ? '🏅' : '🔒'}</b><span>${name}</span><small>${on ? '已獲得' : need}</small></div>`;
    body.innerHTML = `
      <p class="sv-note">走過每一座政策島、看過各頁、玩過每款遊戲，就會自動蓋章。章只存在這台裝置的瀏覽器裡。</p>
      <p class="pp-count"><b>${n}</b><span>/ ${STAMPS.length} 枚</span></p>
      <div class="pp-badges">
        ${badge(isles === islandIds.length, '施政島通', `再走 ${islandIds.length - isles} 座島`)}
        ${badge(n === STAMPS.length, '全制霸', `還差 ${STAMPS.length - n} 枚`)}
      </div>
      ${['島', '頁', '遊戲'].map((k) => `<h3 class="pp-h">${k === '島' ? '政策島' : k === '頁' ? '專題頁' : '小遊戲'}</h3>
      <div class="pp-grid">${STAMPS.filter((s) => s.kind === k).map((s) => `<button type="button" class="pp-stamp ${g[s.id] ? 'is-on' : ''}" data-stamp="${esc(s.id)}" style="--c:${s.color || 'var(--st-pledge)'}">
        <i>${esc(s.n)}</i><span>${esc(s.label)}</span><small>${g[s.id] ? esc(fmtDate(g[s.id])) : '未蓋章'}</small></button>`).join('')}</div>`).join('')}
      <div class="sv-actions"><button type="button" class="cta" data-pp="share">分享我的護照</button></div>`;
    body.onclick = (e) => {
      const st = e.target.closest('[data-stamp]')?.dataset.stamp;
      if (st) {
        dlg.close();
        const [k, v] = st.split(':');
        if (k === 'isle') { ctx.setView('island'); ctx.openTheme(v); }
        else if (k === 'view') ctx.setView(v);
        else ({ quiz: ctx.openQuiz, sort: openSort, mayor: openMayor, daily: openDaily })[v]();
        return;
      }
      if (e.target.closest('[data-pp="share"]')) {
        share('施政島護照｜臺北施政島', `我在「臺北施政島」集到 ${n}/${STAMPS.length} 枚章${isles === islandIds.length ? '，拿到「施政島通」徽章' : ''}。每一項施政都附來源，你也來逛逛：`, 'passport');
      }
    };
  }

  // =========================================================
  // 遊戲大廳
  // =========================================================
  function dailyState() { return read('daily', { last: null, streak: 0, best: 0, right: 0, days: 0, log: {} }); }
  function openHub() {
    open('小遊戲', 'games');
    const d = dailyState();
    const doneToday = !!d.log[taipeiDay()];
    const g = got();
    const n = STAMPS.filter((s) => g[s.id]).length;
    const card = (key, emoji, title, desc, extra = '') => `<button type="button" class="gm-card" data-game="${key}"><b>${emoji}</b><span><strong>${title}</strong><small>${desc}</small></span>${extra}</button>`;
    body.innerHTML = `
      <p class="sv-note">每一題都取自本站已查證的資料，答完會附日期與來源。</p>
      <div class="gm-cards">
        ${card('daily', '📅', '每日一題', `每天一題，大家同一題${d.streak ? `・已連續 ${d.streak} 天` : ''}`, doneToday ? '<em class="gm-tag">今天已答</em>' : '<em class="gm-tag is-hot">今天還沒答</em>')}
        ${card('quiz', '🎯', '政見猜猜看', '10 條 2022 政見，猜猜查證後的狀態')}
        ${card('sort', '🔢', '排排看', '把 5 件施政大事依發生先後排好')}
        ${card('mayor', '🏛️', '這是哪位市長做的？', '1994 年以來五任市長，每人各 2 題')}
        ${card('passport', '🛂', '施政島護照', '逛島、看專題、玩遊戲就蓋章', `<em class="gm-tag">${n}/${STAMPS.length}</em>`)}
      </div>`;
    body.onclick = (e) => {
      const k = e.target.closest('[data-game]')?.dataset.game;
      if (!k) return;
      if (k === 'quiz') { dlg.close(); ctx.openQuiz(); return; }
      ({ daily: openDaily, sort: openSort, mayor: openMayor, passport: openPassport })[k]();
    };
  }

  // =========================================================
  // 排排看：依事件日期排序
  // =========================================================
  const datedItems = allItems.filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.date || '')).map((i) => ({ ...i, t: toTime(i.date) }));
  function pickSpread(n, gapDays, rnd = Math.random) {
    for (let tries = 0; tries < 200; tries++) {
      const pick = [];
      for (const it of shuffle([...datedItems], rnd)) {
        if (pick.every((p) => Math.abs(p.t - it.t) >= gapDays * 86400e3)) pick.push(it);
        if (pick.length === n) return pick;
      }
    }
    return shuffle([...datedItems], rnd).slice(0, n);
  }
  function openSort() {
    open('排排看：哪件事先發生？', 'sort');
    const picks = pickSpread(5, 45);
    let order = shuffle([...picks]);
    let done = false;
    const draw = () => {
      const correct = [...picks].sort((a, b) => a.t - b.t);
      const rows = done ? correct : order;
      const score = done ? correct.filter((it, k) => order[k] === it).length : 0;
      body.innerHTML = `
        <p class="qz-ask">${done ? `排對了 ${score} / 5 個位置。下面是正確順序，每項後面寫著你排的位置。` : '依「事件日期」（通車、簽約、公布等）由早到晚排好：拖曳左邊的把手，或用 ↑↓ 按鈕。'}</p>
        <ol class="gm-sort ${done ? 'is-done' : ''}">${rows.map((it, k) => {
          const mine = order.indexOf(it);
          return `<li data-id="${esc(it.id)}" class="${done ? (mine === k ? 'ok' : 'no') : ''}">
            ${done ? `<b class="gm-when">${esc(fmtDate(it.date))}</b>` : '<span class="gm-handle" aria-hidden="true">⋮⋮</span>'}
            <span class="gm-txt"><strong>${esc(it.title)}</strong><small>${esc(it.theme.name)}${done ? `・你排第 ${mine + 1}` : ''}</small></span>
            ${done ? `<button type="button" class="gm-go" data-go="${esc(it.id)}">看詳情</button>` : `<span class="gm-mv"><button type="button" data-mv="-1" aria-label="往上移">↑</button><button type="button" data-mv="1" aria-label="往下移">↓</button></span>`}
          </li>`;
        }).join('')}</ol>
        <div class="sv-actions">${done
          ? `<button type="button" class="cta" data-s="again">再玩一次</button><button type="button" class="cta cta-2" data-s="share">分享成績</button>`
          : '<button type="button" class="cta" data-s="submit">送出答案</button>'}</div>
        <p class="qz-note">日期是本站資料記錄的事件日期，不代表政策開始推動的時間。</p>`;
      if (done) { stamp('game:sort'); body.dataset.score = score; }
    };
    draw();
    const list = () => body.querySelector('.gm-sort');
    const readOrder = () => { order = [...list().children].map((li) => picks.find((p) => p.id === li.dataset.id)); };
    body.onpointerdown = (e) => {
      const h = e.target.closest('.gm-handle');
      if (!h || done) return;
      const li = h.closest('li');
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      li.classList.add('is-drag');
      const ul = list();
      const move = (ev) => {
        const sibs = [...ul.children];
        const k = sibs.indexOf(li);
        const prev = sibs[k - 1], next = sibs[k + 1];
        if (next) { const r = next.getBoundingClientRect(); if (ev.clientY > r.top + r.height / 2) ul.insertBefore(next, li); }
        if (prev) { const r = prev.getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) ul.insertBefore(li, prev); }
      };
      const up = () => { li.classList.remove('is-drag'); readOrder(); h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
    };
    body.onclick = (e) => {
      const mv = e.target.closest('[data-mv]');
      if (mv) {
        const li = mv.closest('li');
        const ul = list();
        if (+mv.dataset.mv < 0 && li.previousElementSibling) ul.insertBefore(li, li.previousElementSibling);
        if (+mv.dataset.mv > 0 && li.nextElementSibling) ul.insertBefore(li.nextElementSibling, li);
        readOrder();
        li.querySelector(`[data-mv="${mv.dataset.mv}"]`)?.focus();
        return;
      }
      const s = e.target.closest('[data-s]')?.dataset.s;
      if (s === 'submit') { done = true; draw(); }
      if (s === 'again') openSort();
      if (s === 'share') share('排排看｜臺北施政島', `我在「臺北施政島」排排看排對了 ${body.dataset.score}/5 件施政大事的先後順序，你也來試試：`, 'sort');
      const g = e.target.closest('[data-go]');
      if (g) { const it = picks.find((p) => p.id === g.dataset.go); dlg.close(); ctx.setView('island'); ctx.openTheme(it.theme.id, it.id); }
    };
  }

  // =========================================================
  // 這是哪位市長做的？
  // =========================================================
  let mayorPool = null;
  async function loadMayorPool() {
    if (mayorPool) return mayorPool;
    const md = await ctx.loadMayors();
    const names = md.mayors.map((m) => m.name);
    const mask = (s) => names.reduce((t, n) => t.split(n).join('○○○'), String(s));
    const qs = [];
    md.mayors.forEach((m) => m.items.filter((it) => !/(陳|馬|郝|柯|蔣)(、|時期|市府|任內)/.test(`${it.title}${(it.facts || [])[0] || ''}`)).forEach((it) => qs.push({
      mayor: m.id, text: mask(it.title), detail: mask((it.facts || [])[0] || ''), date: it.date, src: it.sources?.[0], where: `mayor-${m.id}`,
    })));
    // 題目文字若用簡稱提到其他市長（例如「延續郝、柯時期」），等於洩題，這類題目不出
    const hint = /(陳|馬|郝|柯|蔣)(、|時期|市府|任內|市長|團隊)|(、|與)(陳|馬|郝|柯|蔣)時期/;
    md.relays.forEach((r) => r.stages.forEach((s) => {
      const m = md.mayors.find((x) => x.name === s.mayor);
      if (m && !hint.test(s.text)) qs.push({ mayor: m.id, text: `${r.title}：${mask(s.text)}`, detail: '', date: s.date, src: s.sources?.[0], where: `relay-${r.id}` });
    }));
    mayorPool = { mayors: md.mayors, qs };
    return mayorPool;
  }
  const termLabel = (m) => `${m.term[0].slice(0, 4)}–${m.term[1].slice(0, 4)}`;
  function mayorQuestionHTML(pool, q, ans) {
    const right = pool.mayors.find((m) => m.id === q.mayor);
    return `<blockquote class="qz-quote">${esc(q.text)}</blockquote>
      <p class="qz-ask">這是哪一任臺北市長任內的事？</p>
      <div class="qz-opts gm-mayors">${pool.mayors.map((m) => `<button type="button" data-may="${m.id}" ${ans ? 'disabled' : ''}
        class="${ans ? (m.id === q.mayor ? 'is-right' : m.id === ans ? 'is-wrong' : '') : ''}" style="--c:${m.color}"><i style="background:${m.color}"></i><span>${esc(m.name)}<small>${termLabel(m)}</small></span></button>`).join('')}</div>
      ${ans ? `<div class="qz-reveal" role="status"><p><b>${ans === q.mayor ? '答對了。' : `是${esc(right.name)}任內。`}</b>時間：${esc(fmtDate(q.date))}。${esc(q.detail)}</p><div class="sources">${srcLink(q.src)}</div></div>` : ''}`;
  }
  async function openMayor() {
    open('這是哪位市長做的？', 'whomayor');
    const pool = await loadMayorPool();
    // 每位市長各抽 2 題，避免某一任出現得特別多
    const qs = shuffle(pool.mayors.flatMap((m) => shuffle(pool.qs.filter((q) => q.mayor === m.id)).slice(0, 2)));
    const st = { k: 0, answers: [] };
    const draw = () => {
      if (st.k >= qs.length) {
        const right = qs.filter((q, n) => st.answers[n] === q.mayor).length;
        stamp('game:mayor');
        body.dataset.score = right;
        body.innerHTML = `<p class="qz-score"><b>${right}</b><span>/ ${qs.length}</span></p>
          <p class="qz-ask">五任市長各出 2 題。想看每一任的完整市政與跨任期建設，請到市長接力頁。</p>
          <div class="sv-actions"><button type="button" class="cta" data-m="share">分享成績</button><button type="button" class="cta cta-2" data-m="again">再玩一次</button><button type="button" class="cta cta-2" data-m="page">看市長接力</button></div>`;
        return;
      }
      const q = qs[st.k];
      const ans = st.answers[st.k];
      body.innerHTML = `<p class="qz-step">第 ${st.k + 1} / ${qs.length} 題 <span class="qz-dots">${qs.map((_, n) => `<i class="${n < st.k ? (st.answers[n] === qs[n].mayor ? 'ok' : 'no') : n === st.k ? 'cur' : ''}"></i>`).join('')}</span></p>
        ${mayorQuestionHTML(pool, q, ans)}
        ${ans ? `<div class="sv-actions"><button type="button" class="cta" data-m="next">${st.k + 1 < qs.length ? '下一題 →' : '看成績'}</button></div>` : ''}
        <p class="qz-note">題目中的市長姓名以 ○○○ 代替；每位市長抽題數相同，顏色只區分任期。</p>`;
    };
    draw();
    body.onclick = (e) => {
      const a = e.target.closest('[data-may]');
      if (a && !st.answers[st.k]) { st.answers[st.k] = a.dataset.may; draw(); return; }
      const m = e.target.closest('[data-m]')?.dataset.m;
      if (m === 'next') { st.k++; draw(); }
      if (m === 'again') openMayor();
      if (m === 'page') { dlg.close(); ctx.setView('mayors'); }
      if (m === 'share') share('這是哪位市長做的？｜臺北施政島', `我在「臺北施政島」猜歷任臺北市長的市政，答對 ${body.dataset.score}/${qs.length} 題，你也來試試：`, 'whomayor');
    };
  }

  // =========================================================
  // 每日一題：三種題型輪流，同一天每個人同一題
  // =========================================================
  async function dailyQuestion(day) {
    const rnd = seeded(`cwpi-${day}`);
    const dayN = Math.round((Date.parse(day) - Date.parse('2026-01-01')) / 86400e3);
    const type = ((dayN % 3) + 3) % 3;
    if (type === 0) {
      const pd = await ctx.loadPledges();
      const pool = pd.items.filter((p) => ['done', 'partial', 'not_done'].includes(p.status));
      const p = pool[Math.floor(rnd() * pool.length)];
      return { type, label: '2022 政見查證', ask: `到 ${fmtDate(pd.meta.asOf)} 查證時，這條政見的狀態是？`, quote: p.pledge,
        options: ['done', 'partial', 'not_done'].map((s) => ({ v: s, label: PLEDGE_STATUS[s].label, color: PLEDGE_STATUS[s].color })), answer: p.status,
        explain: p.summary, src: p.sources?.[0], go: () => ctx.openPledge(p.id) };
    }
    if (type === 1) {
      const pool = await loadMayorPool();
      // 先平均抽市長、再抽題，五任出題機率相同
      const right = pool.mayors[Math.floor(rnd() * pool.mayors.length)];
      const mine = pool.qs.filter((x) => x.mayor === right.id);
      const q = mine[Math.floor(rnd() * mine.length)];
      return { type, label: '歷任市長', ask: '這是哪一任臺北市長任內的事？', quote: q.text,
        options: pool.mayors.map((m) => ({ v: m.id, label: m.name, sub: termLabel(m), color: m.color })), answer: q.mayor,
        explain: `是${right.name}任內（${fmtDate(q.date)}）。${q.detail}`, src: q.src, go: () => ctx.setView('mayors') };
    }
    const [a, b] = pickSpread(2, 60, rnd);
    const first = a.t < b.t ? a : b;
    return { type, label: '施政大事', ask: '下面兩件事，哪一件比較早發生？', quote: '',
      options: [a, b].map((it) => ({ v: it.id, label: it.title, sub: it.theme.name })), answer: first.id,
      explain: `${a.title}：${fmtDate(a.date)}；${b.title}：${fmtDate(b.date)}。日期為本站記錄的事件日期。`, src: first.sources?.[0],
      go: () => { ctx.setView('island'); ctx.openTheme(first.theme.id, first.id); } };
  }
  async function openDaily() {
    open('每日一題', 'daily');
    const day = taipeiDay();
    const q = await dailyQuestion(day);
    const draw = () => {
      const d = dailyState();
      const ans = d.log[day]?.v;
      body.innerHTML = `
        <p class="qz-step">${esc(fmtDate(day))}・${esc(q.label)} <span>${d.streak ? `🔥 連續 ${d.streak} 天` : ''}</span></p>
        ${q.quote ? `<blockquote class="qz-quote">${esc(q.quote)}</blockquote>` : ''}
        <p class="qz-ask">${esc(q.ask)}</p>
        <div class="qz-opts ${q.options.length > 3 ? 'gm-mayors' : ''} ${q.type === 2 ? 'gm-two' : ''}">${q.options.map((o) => `<button type="button" data-d="${esc(o.v)}" ${ans ? 'disabled' : ''}
          class="${ans ? (o.v === q.answer ? 'is-right' : o.v === ans ? 'is-wrong' : '') : ''}">${o.color ? `<i style="background:${o.color}"></i>` : ''}<span>${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span></button>`).join('')}</div>
        ${ans ? `<div class="qz-reveal" role="status"><p><b>${ans === q.answer ? '答對了。' : '答案揭曉：'}</b>${esc(q.explain)}</p><div class="sources">${srcLink(q.src)}</div>
          <p class="gm-streak">連續作答 <b>${d.streak}</b> 天・最長 <b>${d.best}</b> 天・累計答對 <b>${d.right}</b> / ${d.days} 題。明天 0 點換新題。</p>
          <div class="sv-actions"><button type="button" class="cta" data-dd="share">分享</button><button type="button" class="cta cta-2" data-dd="go">看詳情</button><button type="button" class="cta cta-2" data-dd="more">玩其他遊戲</button></div></div>` : ''}`;
    };
    draw();
    body.onclick = (e) => {
      const a = e.target.closest('[data-d]');
      const d = dailyState();
      if (a && !d.log[day]) {
        const ok = a.dataset.d === q.answer;
        const cont = d.last === taipeiDay(-1) || d.last === day;
        d.streak = d.last === day ? d.streak : cont ? d.streak + 1 : 1;
        d.best = Math.max(d.best || 0, d.streak);
        d.last = day;
        d.days = (d.days || 0) + 1;
        d.right = (d.right || 0) + (ok ? 1 : 0);
        d.log[day] = { v: a.dataset.d, ok };
        // 紀錄只留最近 60 天，避免越存越大
        Object.keys(d.log).sort().slice(0, -60).forEach((k) => delete d.log[k]);
        write('daily', d);
        stamp('game:daily');
        draw();
        return;
      }
      const k = e.target.closest('[data-dd]')?.dataset.dd;
      if (k === 'go') { dlg.close(); q.go(); }
      if (k === 'more') openHub();
      if (k === 'share') {
        const s = dailyState();
        share('每日一題｜臺北施政島', `我在「臺北施政島」每日一題${s.log[day]?.ok ? '答對了' : '答完了'}，已連續 ${s.streak} 天。今天的題目：`, 'daily');
      }
    };
  }

  syncPassportBtn();
  return { openHub, openSort, openMayor, openDaily, openPassport, stamp };
}
