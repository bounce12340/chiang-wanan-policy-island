// 「民生帳本」：各族群的補助在任內怎麼變（調整前 → 調整後），以及長期問題的前後指標。
// 只列市府自己新增或調高的項目；中央補助不列；查不到的族群如實寫「查無」。
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');
const dot = (d) => String(d || '').replace(/-/g, '.');

let cache = null;
export function loadLedger() {
  if (!cache) {
    cache = fetch(new URL('./data/ledger.json', import.meta.url), { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`ledger ${r.status}`);
      return r.json();
    });
    cache.catch(() => { cache = null; });
  }
  return cache;
}

const src = (s) => {
  let host = '';
  try { host = new URL(safeUrl(s.url)).hostname; } catch { /* 無效網址只顯示發布單位 */ }
  return `<a class="src" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer" title="${esc(s.title || s.url)}">↗ ${esc([s.publisher || host, dot(s.published)].filter(Boolean).join('・'))}</a>`;
};

export const PROBLEM_STATUS = {
  指標改善: '#2e9e5b', 部分改善: '#c58a12', 仍待觀察: '#2f7dd3', 指標未改善: '#c8463d',
};
const DIR = { 新設: '#2f7dd3', 增加: '#2e9e5b', 減少: '#c8463d' };

export function renderLedger(root, data) {
  const groups = data.groups;
  const maxN = Math.max(...groups.map((g) => g.items.length), 1);
  const bars = groups.map((g) => `<li><a href="#ledger-${esc(g.id)}"><span class="lg-name">${esc(g.group)}</span>
      <span class="lg-bar"><i style="width:${(g.items.length / maxN) * 100}%"></i></span><b>${g.items.length}</b></a></li>`).join('');

  const groupCards = groups.map((g) => `
    <article class="lg-group" id="ledger-${esc(g.id)}">
      <h4>${esc(g.group)}<small>${g.items.length} 項</small></h4>
      ${g.note ? `<p class="lg-note">${esc(g.note)}</p>` : ''}
      <ul>${g.items.map((it) => `<li>
        <div class="lg-top"><span class="badge" style="background:${DIR[it.direction] || '#888'}">${esc(it.direction)}</span><b>${esc(it.title)}</b><span class="lg-when">${esc(dot(it.effective))}</span></div>
        <p class="lg-change"><span class="lg-before">${esc(it.before || '無')}</span><span class="lg-arrow">→</span><span class="lg-after">${esc(it.after)}</span></p>
        <p class="lg-meta">${[it.who && `對象：${esc(it.who)}`, it.perPerson && `每人：${esc(it.perPerson)}`, it.reach && `規模：${esc(it.reach)}`].filter(Boolean).join('　')}</p>
        ${it.note ? `<p class="lg-note">${esc(it.note)}</p>` : ''}
        <div class="sources">${(it.sources || []).map(src).join('')}</div>
      </li>`).join('')}</ul>
    </article>`).join('');

  const probs = data.problems.map((p) => `
    <article class="lg-prob" id="problem-${esc(p.id)}">
      <div class="lg-top"><span class="badge" style="background:${PROBLEM_STATUS[p.status] || '#888'}">${esc(p.status)}</span><b>${esc(p.title)}</b><span class="lg-when">問題自 ${esc(p.since)}</span></div>
      <p><strong>問題：</strong>${esc(p.problem)}</p>
      <p><strong>任內作為：</strong>${esc(p.policy)}</p>
      <div class="lg-ba"><div><small>之前</small>${esc(p.before)}</div><div><small>之後</small>${esc(p.after)}</div></div>
      ${(p.critical || []).filter(Boolean).length ? `<details class="pl-more pl-crit"><summary>不同看法（${p.critical.filter(Boolean).length}）</summary><ul>${p.critical.filter(Boolean).map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>` : ''}
      <div class="sources">${(p.sources || []).map(src).join('')}</div>
    </article>`).join('');

  const counts = {};
  data.problems.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });

  root.innerHTML = `
    <h2>民生帳本</h2>
    <p class="lead">${esc(data.meta.lead)}</p>
    <details class="pl-method"><summary>收錄標準</summary><ul>${data.meta.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></details>
    <h3 class="mayor-h">各族群的補助怎麼變</h3>
    <p class="lg-sub">任內由市府新增或調高的現金、點數或免費服務項數（不代表金額大小）。點族群名稱跳到明細。</p>
    <ol class="lg-bars">${bars}</ol>
    <div class="lg-groups">${groupCards}</div>
    ${data.problems.length ? `<h3 class="mayor-h">長期問題處理到哪裡</h3>
    <p class="lg-sub">依前後指標判斷，不因政策已推出就算「解決」：${Object.keys(PROBLEM_STATUS).filter((s) => counts[s]).map((s) => `<span class="lg-pill" style="--c:${PROBLEM_STATUS[s]}">${s} ${counts[s]}</span>`).join(' ')}</p>
    <div class="lg-probs">${probs}</div>` : ''}`;
}
