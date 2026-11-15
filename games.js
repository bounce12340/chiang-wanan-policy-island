// 小遊戲：遊戲大廳、排排看（時間順序）、這是哪位市長做的、每日一題、數字猜猜看、施政島護照（集章）。
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
    ctx.pause?.(false);
    if (/^#\/(games|sort|whomayor|daily|passport|cpr|numbers|budget)/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  });
  function open(title, hash) {
    head.textContent = title;
    body.innerHTML = '<p class="qz-ask">載入中…</p>';
    if (!dlg.open) dlg.showModal();
    ctx.pause?.(true); // 玩遊戲時暫停背後的 3D 繪製，手機比較順、按壓計時也比較準
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
    { id: 'game:numbers', label: '數字猜猜看', kind: '遊戲', n: '數' },
    { id: 'game:photo', label: '施政島明信片', kind: '遊戲', n: '拍' },
    { id: 'game:hunt', label: '島上尋寶', kind: '遊戲', n: '寶' },
    { id: 'game:budget', label: '如果我是市長', kind: '遊戲', n: '帥' },
    { id: 'game:sail', label: '環島航行', kind: '遊戲', n: '船' },
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
        else ({ quiz: ctx.openQuiz, sort: openSort, mayor: openMayor, daily: openDaily, numbers: openNumbers, photo: ctx.openPhoto, hunt: ctx.openHunt, budget: openBudget, sail: ctx.openSail })[v]();
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
    const best = read('numbers', { best: 0 }).best;
    const card = (key, emoji, title, desc, extra = '') => `<button type="button" class="gm-card" data-game="${key}"><b>${emoji}</b><span><strong>${title}</strong><small>${desc}</small></span>${extra}</button>`;
    body.innerHTML = `
      <p class="sv-note">每一題都取自本站已查證的資料，答完會附日期與來源。</p>
      <div class="gm-cards">
        ${card('daily', '📅', '每日一題', `每天一題，大家同一題${d.streak ? `・已連續 ${d.streak} 天` : ''}`, doneToday ? '<em class="gm-tag">今天已答</em>' : '<em class="gm-tag is-hot">今天還沒答</em>')}
        ${card('numbers', '🔢', '數字猜猜看', '社宅幾戶？滯洪幾萬噸？拉滑桿猜數字，越接近分數越高', best ? `<em class="gm-tag">最高 ${best} 分</em>` : '')}
        ${card('quiz', '🎯', '政見猜猜看', '10 條 2022 政見，猜猜查證後的狀態')}
        ${card('sort', '↕️', '排排看', '把 5 件施政大事依發生先後排好')}
        ${card('mayor', '🏛️', '這是哪位市長做的？', '1994 年以來五任市長，每人各 2 題')}
        ${card('cpr', '❤️', '按壓節奏挑戰', '跟著節奏按 10 秒，記住 CPR 每分鐘 100–120 下')}
        ${card('budget', '🏛️', '如果我是市長', '100 億元（虛擬）分給 12 種市民，看看你的施政風格')}
        ${card('sail', '⛵', '開船巡島', '開小船在群島之間航行，靠近哪座島就看哪座島的施政', `<em class="gm-tag">${ctx.sailCount?.() ?? 0}/10</em>`)}
        ${card('hunt', '🔍', '島上尋寶', `每座島都藏了小道具，共 12 個，點到就解鎖一項施政`, `<em class="gm-tag">${ctx.huntCount?.() ?? 0}/12</em>`)}
        ${card('photo', '📷', '施政島明信片', '轉到喜歡的角度按快門，做一張可以分享的明信片')}
        ${card('passport', '🛂', '施政島護照', '逛島、看專題、玩遊戲就蓋章', `<em class="gm-tag">${n}/${STAMPS.length}</em>`)}
      </div>`;
    body.onclick = (e) => {
      const k = e.target.closest('[data-game]')?.dataset.game;
      if (!k) return;
      if (k === 'quiz') { dlg.close(); ctx.openQuiz(); return; }
      if (k === 'photo') { dlg.close(); ctx.openPhoto(); return; }
      if (k === 'hunt') { dlg.close(); ctx.openHunt(); return; }
      if (k === 'sail') { dlg.close(); ctx.openSail(); return; }
      ({ daily: openDaily, sort: openSort, mayor: openMayor, passport: openPassport, cpr: openCpr, numbers: openNumbers, budget: openBudget })[k]();
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

  // =========================================================
  // 數字猜猜看：拉滑桿猜施政數字，越接近分數越高（每局 5 題，每題 100 分）
  // 題庫在 data/numbers.json，答案都對應 policies.json 某一句查證過的 facts
  // =========================================================
  let numberBank = null;
  async function loadNumbers() {
    if (numberBank) return numberBank;
    const res = await fetch('./data/numbers.json', { cache: 'no-cache' });
    const raw = await res.json();
    const byItem = new Map(allItems.map((i) => [i.id, i]));
    numberBank = raw.items.map((q) => {
      const it = byItem.get(q.item);
      const fact = it?.facts.find((f) => f.includes(q.match));
      return it && fact ? { ...q, it, fact } : null;
    }).filter(Boolean);
    return numberBank;
  }
  const fmtNum = (v) => Number(v).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
  // 誤差 5% 以內滿分；之後依相對誤差遞減，差一倍以上 0 分
  const numberScore = (g, a) => { const e = Math.abs(g - a) / Math.abs(a); return e <= 0.05 ? 100 : Math.max(0, Math.round(100 * (1 - e))); };
  async function openNumbers() {
    open('數字猜猜看', 'numbers');
    const bank = await loadNumbers();
    const qs = shuffle([...bank]).slice(0, 5);
    const st = { k: 0, guesses: [] };
    const draw = () => {
      if (st.k >= qs.length) {
        const total = qs.reduce((t, q, n) => t + numberScore(st.guesses[n], q.a), 0);
        const rec = read('numbers', { best: 0, plays: 0 });
        const isBest = total > (rec.best || 0);
        write('numbers', { best: Math.max(rec.best || 0, total), plays: (rec.plays || 0) + 1 });
        stamp('game:numbers');
        body.dataset.score = total;
        const rank = total >= 450 ? '市政活字典' : total >= 350 ? '資深里長' : total >= 200 ? '熱心市民' : '新手市民';
        body.innerHTML = `<p class="qz-score"><b>${total}</b><span>/ 500 分</span></p>
          <p class="qz-ask">稱號：<b>${rank}</b>${isBest ? '・🎉 新的最高分' : `・你的最高分 ${Math.max(rec.best || 0, total)}`}</p>
          <ol class="nm-review">${qs.map((q, n) => `<li><span>${esc(q.q)}</span><small>你猜 ${fmtNum(st.guesses[n])}・答案 ${fmtNum(q.a)} ${esc(q.unit)}・${numberScore(st.guesses[n], q.a)} 分</small></li>`).join('')}</ol>
          <div class="sv-actions"><button type="button" class="cta" data-n="again">再玩一局</button><button type="button" class="cta cta-2" data-n="share">分享成績</button><button type="button" class="cta cta-2" data-n="more">玩其他遊戲</button></div>`;
        return;
      }
      const q = qs[st.k];
      const g = st.guesses[st.k];
      const answered = g !== undefined;
      const start = answered ? g : Math.round((q.max / 2) / q.step) * q.step;
      const sc = answered ? numberScore(g, q.a) : 0;
      body.innerHTML = `<p class="qz-step">第 ${st.k + 1} / ${qs.length} 題・${esc(q.it.theme.name)} <span class="qz-dots">${qs.map((_, n) => `<i class="${n < st.k ? (numberScore(st.guesses[n], qs[n].a) >= 60 ? 'ok' : 'no') : n === st.k ? 'cur' : ''}"></i>`).join('')}</span></p>
        <p class="qz-ask nm-q">${esc(q.q)}</p>
        <div class="nm-box">
          <output class="nm-out"><b>${fmtNum(start)}</b> ${esc(q.unit)}</output>
          <div class="nm-track"><input type="range" class="nm-range" min="0" max="${q.max}" step="${q.step}" value="${start}" aria-label="你的猜測" ${answered ? 'disabled' : ''}>
            ${answered ? `<i class="nm-ans" style="left:${(q.a / q.max) * 100}%"><em>答案 ${fmtNum(q.a)}</em></i>` : ''}</div>
          <div class="nm-scale"><span>0</span><span>${fmtNum(q.max)} ${esc(q.unit)}</span></div>
          ${answered ? '' : `<div class="nm-fine"><button type="button" data-f="-1" aria-label="減少">−</button><input type="number" inputmode="decimal" min="0" max="${q.max}" step="${q.step}" value="${start}" class="nm-num" aria-label="直接輸入數字"><button type="button" data-f="1" aria-label="增加">＋</button></div>`}
        </div>
        ${answered ? `<div class="qz-reveal" role="status"><p><b>${sc === 100 ? '神準！' : sc >= 60 ? '很接近了。' : '差了一些。'}</b>答案是 <b>${fmtNum(q.a)} ${esc(q.unit)}</b>，你猜 ${fmtNum(g)}，得 <b>${sc}</b> 分。</p>
          <p class="nm-fact">「${esc(q.it.title)}」：${esc(q.fact)}</p><div class="sources">${srcLink(q.it.sources?.[0])}</div></div>
          <div class="sv-actions"><button type="button" class="cta" data-n="next">${st.k + 1 < qs.length ? '下一題 →' : '看總分'}</button><button type="button" class="cta cta-2" data-n="go">看這項施政</button></div>`
        : '<div class="sv-actions"><button type="button" class="cta" data-n="lock">就猜這個數字</button></div>'}
        <p class="qz-note">誤差 5% 以內得滿分，差一倍以上 0 分。數字以本站資料記錄的說法為準（市府或報導說法已在原句註明）。</p>`;
      const range = body.querySelector('.nm-range'), num = body.querySelector('.nm-num'), out = body.querySelector('.nm-out b');
      const set = (v) => {
        const x = Math.min(q.max, Math.max(0, Math.round(v / q.step) * q.step));
        const val = +x.toFixed(2);
        range.value = val; if (num && document.activeElement !== num) num.value = val; out.textContent = fmtNum(val);
      };
      range.oninput = () => set(+range.value);
      if (num) num.oninput = () => { if (num.value !== '') { range.value = num.value; out.textContent = fmtNum(+range.value); } };
      body.dataset.cur = String(st.k);
    };
    draw();
    body.onclick = (e) => {
      const f = e.target.closest('[data-f]');
      if (f) {
        const q = qs[st.k], range = body.querySelector('.nm-range');
        const v = Math.min(q.max, Math.max(0, +range.value + +f.dataset.f * q.step));
        range.value = +v.toFixed(2); range.dispatchEvent(new Event('input'));
        return;
      }
      const n = e.target.closest('[data-n]')?.dataset.n;
      if (n === 'lock') { st.guesses[st.k] = +body.querySelector('.nm-range').value; draw(); }
      if (n === 'next') { st.k++; draw(); }
      if (n === 'again') openNumbers();
      if (n === 'more') openHub();
      if (n === 'go') { const it = qs[st.k].it; dlg.close(); ctx.setView('island'); ctx.openTheme(it.theme.id, it.id); }
      if (n === 'share') share('數字猜猜看｜臺北施政島', `我在「臺北施政島」數字猜猜看拿到 ${body.dataset.score}/500 分，你猜得比我準嗎？`, 'numbers');
    };
  }

  // =========================================================
  // 如果我是市長：把 100 億元（虛擬）分給 12 種市民，再對照市府任內為各群組「新設或調高」的措施數。
  // 對照的是民生帳本收錄的措施「件數」占比，不是預算金額；結果頁會講清楚。
  // =========================================================
  const STYLE = {
    pregnancy: ['催生派市長', '把資源押在生養第一關'], toddler: ['育兒友善派市長', '讓爸媽養得起 0–6 歲'],
    student: ['教育投資派市長', '把錢花在下一代的學習'], youth: ['青年築夢派市長', '幫年輕人找房、找工作、找機會'],
    adult: ['拚經濟派市長', '照顧每天上班的中堅世代'], senior: ['銀髮照護派市長', '讓長輩在地安老'],
    disability: ['無障礙派市長', '把城市的門檻降下來'], indigenous: ['多元共融派市長', '照顧都市原住民族群'],
    lowincome: ['社會安全網派市長', '先把最弱勢的人接住'], singleparent: ['家庭支持派市長', '單親、多胞胎家庭不孤單'],
    commuters: ['交通建設派市長', '讓通勤更快更省'], pets: ['毛孩友善派市長', '人與寵物都住得舒服'],
  };
  async function openBudget() {
    open('如果我是市長', 'budget');
    const ld = await ctx.loadLedger();
    const groups = ld.groups.map((g) => ({ id: g.id, name: g.group.replace(/（.*?）/g, ''), full: g.group,
      ups: g.items.filter((i) => ['新設', '增加'].includes(i.direction)).length }));
    const TOTAL = 100;
    const alloc = Object.fromEntries(groups.map((g) => [g.id, 0]));
    const used = () => Object.values(alloc).reduce((a, b) => a + b, 0);
    const drawForm = () => {
      body.innerHTML = `<p class="qz-ask">假設你是臺北市長，手上有 <b>100 億元</b>（虛擬）可以加碼照顧市民。你會怎麼分？分完會對照市府任內真正為各群組新設或調高了幾項措施。</p>
        <p class="bg-left" aria-live="polite">還剩 <b>${TOTAL - used()}</b> 億元</p>
        <ul class="bg-list">${groups.map((g) => `<li><label for="bg-${g.id}">${esc(g.name)}</label>
          <input type="range" id="bg-${g.id}" data-bg="${g.id}" min="0" max="${TOTAL}" step="5" value="${alloc[g.id]}"><output>${alloc[g.id]}</output></li>`).join('')}</ul>
        <div class="sv-actions"><button type="button" class="cta" data-b="done" ${used() === TOTAL ? '' : 'disabled'}>${used() === TOTAL ? '看我的施政風格' : `再分配 ${TOTAL - used()} 億元`}</button><button type="button" class="cta cta-2" data-b="even">大致平均</button><button type="button" class="cta cta-2" data-b="reset">歸零</button></div>
        <p class="qz-note">滑桿每格 5 億元，總和不能超過 100 億元。這是想像遊戲，不代表真實預算規模。</p>`;
    };
    const sync = () => {
      body.querySelectorAll('[data-bg]').forEach((r) => { r.value = alloc[r.dataset.bg]; r.nextElementSibling.textContent = alloc[r.dataset.bg]; });
      body.querySelector('.bg-left b').textContent = TOTAL - used();
      const done = body.querySelector('[data-b="done"]');
      done.disabled = used() !== TOTAL;
      done.textContent = used() === TOTAL ? '看我的施政風格' : `再分配 ${TOTAL - used()} 億元`;
    };
    const drawResult = () => {
      const upsTotal = groups.reduce((a, g) => a + g.ups, 0);
      const rows = groups.map((g) => ({ ...g, mine: alloc[g.id], city: upsTotal ? Math.round((g.ups / upsTotal) * 100) : 0 }));
      const overlap = Math.round(rows.reduce((a, r) => a + Math.min(r.mine, (r.ups / upsTotal) * 100), 0));
      const top = [...rows].sort((a, b) => b.mine - a.mine);
      const [title, line] = STYLE[top[0].id] || ['全方位市長', '每一種市民都照顧到'];
      const balanced = top[0].mine <= 20;
      const cityTop = [...rows].sort((a, b) => b.ups - a.ups).slice(0, 2);
      stamp('game:budget');
      body.dataset.style = balanced ? '雨露均霑派市長' : title;
      body.dataset.overlap = overlap;
      body.innerHTML = `<div class="bg-card"><small>我的施政風格</small><strong>${esc(balanced ? '雨露均霑派市長' : title)}</strong><span>${esc(balanced ? '每一種市民都分到一點，沒有明顯偏重' : line)}</span>
          <p>最重視：${top.slice(0, 3).filter((r) => r.mine).map((r) => `${esc(r.name)} ${r.mine} 億`).join('、')}</p></div>
        <p class="qz-ask">跟市府任內的實際作為比，重疊度 <b>${overlap}%</b>。市府新設或調高最多措施的是「${esc(cityTop[0].name)}」（${cityTop[0].ups} 項）和「${esc(cityTop[1].name)}」（${cityTop[1].ups} 項）。</p>
        <ul class="bg-bars">${rows.map((r) => `<li><span>${esc(r.name)}</span><div><i class="me" style="width:${r.mine}%"></i><i class="city" style="width:${r.city}%"></i></div><small>你 ${r.mine}%・市府 ${r.ups} 項（${r.city}%）</small></li>`).join('')}</ul>
        <p class="bg-legend"><i class="me"></i>你的分配　<i class="city"></i>市府任內新設或調高的措施件數占比</p>
        <p class="qz-note">「市府」一欄是民生帳本收錄的市府自辦措施中，屬於新設或增加的件數占比（共 ${upsTotal} 項，同一項可能同時照顧多個群組），不是預算金額；件數多不代表花的錢多。</p>
        <div class="sv-actions"><button type="button" class="cta" data-b="share">分享我的風格</button><button type="button" class="cta cta-2" data-b="ledger">看民生帳本</button><button type="button" class="cta cta-2" data-b="again">重新分配</button></div>`;
    };
    drawForm();
    body.oninput = (e) => {
      const r = e.target.closest('[data-bg]');
      if (!r) return;
      const others = used() - alloc[r.dataset.bg];
      alloc[r.dataset.bg] = Math.min(+r.value, TOTAL - others); // 超過總額就停在剩餘額度
      sync();
    };
    body.onclick = (e) => {
      const b = e.target.closest('[data-b]')?.dataset.b;
      // 100 不能被 12 整除（每格 5 億），所以前 8 組各 10 億、後 4 組各 5 億
      if (b === 'even') { groups.forEach((g, i) => { alloc[g.id] = i < 8 ? 10 : 5; }); sync(); }
      if (b === 'reset') { groups.forEach((g) => { alloc[g.id] = 0; }); sync(); }
      if (b === 'done' && used() === TOTAL) drawResult();
      if (b === 'again') { groups.forEach((g) => { alloc[g.id] = 0; }); drawForm(); }
      if (b === 'ledger') { dlg.close(); ctx.setView('ledger'); }
      if (b === 'share') share('如果我是市長｜臺北施政島', `我在「臺北施政島」分配 100 億元（虛擬），結果是「${body.dataset.style}」，跟市府任內作為的重疊度 ${body.dataset.overlap}%。你是哪一派？`, 'budget');
    };
  }

  // =========================================================
  // 按壓節奏挑戰：跟著節拍按 10 秒，看速度有沒有落在每分鐘 100–120 下
  // （依臺北市消防局「叫、叫、壓、電」：每分鐘 100–120 次、每秒約 2 次）
  // =========================================================
  function openCpr() {
    open('按壓節奏挑戰', 'cpr');
    const LO = 100, HI = 120, DUR = 10000;
    let taps = [], t0 = 0, timer = 0, raf = 0, guide = true;
    const bpmOf = (arr) => {
      if (arr.length < 2) return 0;
      const iv = [];
      for (let i = 1; i < arr.length; i++) iv.push(arr[i] - arr[i - 1]);
      return Math.round(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length));
    };
    const pct = (b) => Math.max(0, Math.min(100, ((b - 60) / 100) * 100)); // 量表 60–160
    body.innerHTML = `
      <p class="qz-ask">胸部按壓要「用力壓、快快壓」，每分鐘 <b>100–120 下</b>（每秒約 2 下）。按下面的大按鈕（或空白鍵）開始，跟著節奏連續按 10 秒。</p>
      <div class="cpr-gauge" aria-hidden="true"><i class="cpr-zone" style="left:${pct(LO)}%;width:${pct(HI) - pct(LO)}%"></i><i class="cpr-needle"></i>
        <span style="left:0">60</span><span style="left:${pct(LO)}%">100</span><span style="left:${pct(HI)}%">120</span><span style="left:100%">160</span></div>
      <p class="cpr-live" aria-live="polite">尚未開始</p>
      <button type="button" class="cpr-pad" data-pad><span>按壓</span></button>
      <label class="cpr-guide"><input type="checkbox" checked data-guide> 顯示 110 下／分的節拍提示</label>
      <p class="qz-note">這只是節奏練習。實際按壓還要壓到 5–6 公分深、讓胸部回彈、不要中斷；請參加正式的 CPR＋AED 訓練。來源：臺北市消防局「CPR 施救方法」。</p>`;
    const pad = body.querySelector('[data-pad]');
    const live = body.querySelector('.cpr-live');
    const needle = body.querySelector('.cpr-needle');
    const beat = () => {
      // 節拍提示：每 545 毫秒（約 110 下／分）閃一下
      const now = performance.now();
      pad.classList.toggle('is-beat', guide && ((now % 545) < 110));
      if (t0) {
        const left = Math.max(0, DUR - (now - t0));
        const b = bpmOf(taps.slice(-5));
        live.innerHTML = `剩 <b>${(left / 1000).toFixed(1)}</b> 秒・目前 <b>${b || '—'}</b> 下／分`;
        needle.style.left = `${pct(b || 60)}%`;
      }
      raf = requestAnimationFrame(beat);
    };
    raf = requestAnimationFrame(beat);
    const finish = () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      const b = bpmOf(taps);
      const iv = taps.slice(1).map((x, i) => 60000 / (x - taps[i]));
      const good = iv.length ? Math.round((iv.filter((v) => v >= LO && v <= HI).length / iv.length) * 100) : 0;
      const verdict = !b ? '沒有偵測到按壓' : b < LO ? '太慢了，再快一點' : b > HI ? '太快了，放慢一點' : '節奏剛好！';
      body.dataset.bpm = b;
      body.innerHTML = `
        <p class="qz-score"><b>${b || 0}</b><span>下／分</span></p>
        <p class="qz-ask"><b>${verdict}</b>　共按了 ${taps.length} 下，${good}% 的按壓落在每分鐘 100–120 下。</p>
        <div class="cpr-gauge" aria-hidden="true"><i class="cpr-zone" style="left:${pct(LO)}%;width:${pct(HI) - pct(LO)}%"></i><i class="cpr-needle" style="left:${pct(b || 60)}%"></i>
          <span style="left:0">60</span><span style="left:${pct(LO)}%">100</span><span style="left:${pct(HI)}%">120</span><span style="left:100%">160</span></div>
        <p class="qz-note">記住口訣「叫、叫、壓、電」：確認意識、撥 119 並請人拿 AED、胸部按壓、依 AED 指示電擊。附近的 AED 可以查 <a href="https://tw-aed.mohw.gov.tw/" target="_blank" rel="noopener noreferrer">公共場所 AED 急救資訊網</a>。</p>
        <div class="sv-actions"><button type="button" class="cta" data-c="again">再試一次</button><button type="button" class="cta cta-2" data-c="share">分享</button></div>`;
    };
    const press = () => {
      if (!t0) { t0 = performance.now(); timer = setTimeout(finish, DUR); }
      taps.push(performance.now());
      pad.classList.remove('is-hit'); void pad.offsetWidth; pad.classList.add('is-hit');
    };
    const onKey = (e) => { if ((e.code === 'Space' || e.key === 'Enter') && dlg.open && body.contains(pad)) { e.preventDefault(); if (!e.repeat) press(); } };
    document.addEventListener('keydown', onKey);
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
    body.querySelector('[data-guide]').addEventListener('change', (e) => { guide = e.target.checked; });
    body.onclick = (e) => {
      const c = e.target.closest('[data-c]')?.dataset.c;
      if (c === 'again') openCpr();
      if (c === 'share') share('按壓節奏挑戰｜臺北施政島', `我在「臺北施政島」的 CPR 按壓節奏挑戰按出每分鐘 ${body.dataset.bpm} 下（建議 100–120 下）。你也來試試，順便記住「叫、叫、壓、電」：`, 'cpr');
    };
    dlg.addEventListener('close', () => { cancelAnimationFrame(raf); clearTimeout(timer); document.removeEventListener('keydown', onKey); }, { once: true });
  }

  syncPassportBtn();
  return { openHub, openSort, openMayor, openDaily, openPassport, openCpr, openNumbers, openBudget, stamp };
}
