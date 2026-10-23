// 「2022 政見兌現」檢視：讀 data/pledges2022.json，畫出統計、篩選與逐條對照卡片。
export const PLEDGE_STATUS = {
  done: { label: '已兌現', color: '#2e9e5b' },
  partial: { label: '部分兌現', color: '#c58a12' },
  in_progress: { label: '進行中', color: '#2f7dd3' },
  not_done: { label: '未兌現', color: '#c8463d' },
  unverifiable: { label: '無法檢驗', color: '#7b6fb0' },
  no_data: { label: '查無資料', color: '#8a8f98' },
};
export const PLEDGE_ORDER = ['done', 'partial', 'in_progress', 'not_done', 'unverifiable', 'no_data'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');
const fmtDate = (d) => (d ? String(d).replace(/-/g, '.') : '');

let cache = null;
export async function loadPledges() {
  if (!cache) {
    cache = fetch('./data/pledges2022.json', { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`pledges ${r.status}`);
      return r.json();
    });
    cache.catch(() => { cache = null; });
  }
  return cache;
}

export function countByStatus(items) {
  const c = Object.fromEntries(PLEDGE_ORDER.map((s) => [s, 0]));
  items.forEach((p) => { c[p.status] = (c[p.status] || 0) + 1; });
  return c;
}

function srcHTML(s) {
  let host = '';
  try { host = new URL(safeUrl(s.url)).hostname; } catch { /* 無效網址只顯示發布單位 */ }
  const label = [s.publisher || host, fmtDate(s.published)].filter(Boolean).join('・');
  return `<a class="src" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer" title="${esc(s.title || s.url)}">↗ ${esc(label)}</a>`;
}

function cardHTML(p, itemTitle) {
  const st = PLEDGE_STATUS[p.status] || { label: p.status, color: '#888' };
  const ev = (p.evidence || []).map((e) => `<li>${esc(e)}</li>`).join('');
  const cr = (p.critical || []).map((e) => `<li>${esc(e)}</li>`).join('');
  const related = (p.related || []).map((r) => {
    const t = itemTitle(r.theme, r.item);
    return t ? `<button class="pl-go" data-theme="${esc(r.theme)}" data-item="${esc(r.item || '')}">施政島：${esc(t)} →</button>` : '';
  }).join('');
  return `<article class="pl" id="pl-${esc(p.id)}" data-status="${esc(p.status)}" data-cat="${esc(p.category)}">
    <div class="pl-top">
      <span class="badge" style="background:${st.color}">${st.label}</span>
      <span class="pl-cat">${esc(p.category)}</span>
      ${p.confidence === 'low' ? '<span class="pl-conf" title="證據有限，判斷可能需要修正">查證把握較低</span>' : ''}
    </div>
    <blockquote class="pl-quote">${esc(p.pledge)}</blockquote>
    ${p.deadline ? `<p class="pl-deadline">承諾期限：${esc(p.deadline)}</p>` : ''}
    <p class="pl-summary">${esc(p.summary)}</p>
    ${ev ? `<details class="pl-more"><summary>查證依據（${p.evidence.length}）</summary><ul>${ev}</ul></details>` : ''}
    ${cr ? `<details class="pl-more pl-crit"><summary>爭議與批評（${p.critical.length}）</summary><ul>${cr}</ul></details>` : ''}
    ${(p.sources || []).length ? `<div class="sources">${p.sources.map(srcHTML).join('')}</div>` : ''}
    <div class="pl-links">${related}<a class="pl-origin" href="${esc(safeUrl(p.origin_url))}" target="_blank" rel="noopener noreferrer">政見出處：${esc(p.origin)} ↗</a></div>
  </article>`;
}

/**
 * 畫出整個檢視。
 * @param {HTMLElement} root
 * @param {object} data pledges2022.json
 * @param {{ itemTitle:(theme:string,item?:string)=>string|null, onOpen:(theme:string,item?:string)=>void }} hooks
 */
export function renderPledges(root, data, hooks) {
  const items = data.items;
  const counts = countByStatus(items);
  const total = items.length;
  const cats = data.meta.categories.filter((c) => items.some((p) => p.category === c));
  const bar = PLEDGE_ORDER.filter((s) => counts[s]).map((s) =>
    `<span style="flex:${counts[s]};background:${PLEDGE_STATUS[s].color}" title="${PLEDGE_STATUS[s].label} ${counts[s]}"></span>`).join('');
  const legend = PLEDGE_ORDER.filter((s) => counts[s]).map((s) =>
    `<span><i style="background:${PLEDGE_STATUS[s].color}"></i>${PLEDGE_STATUS[s].label} <b>${counts[s]}</b></span>`).join('');
  const defs = PLEDGE_ORDER.map((s) => `<li><b style="color:${PLEDGE_STATUS[s].color}">${PLEDGE_STATUS[s].label}</b>：${esc(data.meta.definitions[s])}</li>`).join('');

  root.innerHTML = `
    <h2>2022 政見兌現對照</h2>
    <p class="lead">${esc(data.meta.lead)}</p>
    <div class="pl-summary-box">
      <div class="pl-bar" role="img" aria-label="${PLEDGE_ORDER.filter((s) => counts[s]).map((s) => `${PLEDGE_STATUS[s].label} ${counts[s]} 條`).join('、')}">${bar}</div>
      <div class="pl-legend">${legend}</div>
      <p class="pl-asof">共 ${total} 條・查證截至 ${esc(fmtDate(data.meta.asOf))}・任期至 ${esc(fmtDate(data.meta.termEnd))}</p>
    </div>
    <details class="pl-method">
      <summary>怎麼判斷的？（方法與限制）</summary>
      <ul class="pl-defs">${defs}</ul>
      <ul>${data.meta.method.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
    </details>
    <div class="pl-filters">
      <div class="chips pl-chips" data-kind="status">
        <button class="chip" data-v="" aria-pressed="true">全部 <span class="n">${total}</span></button>
        ${PLEDGE_ORDER.filter((s) => counts[s]).map((s) => `<button class="chip" data-v="${s}" aria-pressed="false"><i style="background:${PLEDGE_STATUS[s].color}"></i>${PLEDGE_STATUS[s].label} <span class="n">${counts[s]}</span></button>`).join('')}
      </div>
      <div class="chips pl-chips" data-kind="cat">
        <button class="chip" data-v="" aria-pressed="true">全部領域</button>
        ${cats.map((c) => `<button class="chip" data-v="${esc(c)}" aria-pressed="false">${esc(c)} <span class="n">${items.filter((p) => p.category === c).length}</span></button>`).join('')}
      </div>
    </div>
    <p class="pl-shown" aria-live="polite"></p>
    <div class="pl-list">${items.map((p) => cardHTML(p, hooks.itemTitle)).join('')}</div>`;

  const filters = { status: '', cat: '' };
  const shown = root.querySelector('.pl-shown');
  function apply() {
    let n = 0;
    root.querySelectorAll('.pl').forEach((el) => {
      const ok = (!filters.status || el.dataset.status === filters.status) && (!filters.cat || el.dataset.cat === filters.cat);
      el.hidden = !ok;
      if (ok) n++;
    });
    shown.textContent = n === total ? '' : `顯示 ${n} 條`;
  }
  root.querySelectorAll('.pl-chips').forEach((box) => box.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    filters[box.dataset.kind] = b.dataset.v;
    box.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    apply();
  }));
  root.addEventListener('click', (e) => {
    const go = e.target.closest('.pl-go');
    if (go) hooks.onOpen(go.dataset.theme, go.dataset.item || undefined);
  });
  apply();
}

export function focusPledge(root, id) {
  const el = root.querySelector(`#pl-${CSS.escape(id)}`);
  if (!el) return;
  el.hidden = false;
  el.scrollIntoView({ block: 'center' });
  el.classList.add('is-flash');
  setTimeout(() => el.classList.remove('is-flash'), 1800);
}
