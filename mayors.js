// 「市長接力」：民選以來五任臺北市長的代表性市政、市政爭議，以及跨任期建設各任做了哪一段。
// 所有市長用同一套收錄標準；顏色只用來區分任期，與政黨無關。
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');
const dot = (d) => String(d || '').replace(/-/g, '.');

let cache = null;
export function loadMayors() {
  if (!cache) {
    cache = fetch(new URL('./data/mayors.json', import.meta.url), { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`mayors ${r.status}`);
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

const yearOf = (d) => {
  const [y, m = 6] = String(d).split('-').map(Number);
  return y + (m - 0.5) / 12;
};

export function renderMayors(root, data, { onOpenTheme } = {}) {
  const ms = data.mayors;
  const t0 = yearOf(ms[0].term[0]), t1 = yearOf(ms[ms.length - 1].term[1]);
  const pct = (d) => ((Math.min(Math.max(yearOf(d), t0), t1) - t0) / (t1 - t0)) * 100;
  const byName = new Map(ms.map((m) => [m.name, m]));

  const band = ms.map((m) => `<span style="left:${pct(m.term[0])}%;width:${pct(m.term[1]) - pct(m.term[0])}%;--c:${m.color}"><b>${esc(m.name)}</b><small>${esc(m.term[0].slice(0, 4))}–${esc(m.term[1].slice(0, 4))}</small></span>`).join('');
  const years = [];
  for (let y = Math.ceil(t0 / 4) * 4; y <= t1; y += 4) years.push(`<i style="left:${pct(`${y}-01`)}%">${y}</i>`);

  const relays = data.relays.map((r) => `
    <article class="relay" id="relay-${esc(r.id)}">
      <h4>${esc(r.title)}</h4>
      <p class="relay-sum">${esc(r.summary)}</p>
      <div class="relay-track" aria-hidden="true">${ms.map((m) => `<span style="left:${pct(m.term[0])}%;width:${pct(m.term[1]) - pct(m.term[0])}%;--c:${m.color}"></span>`).join('')}
        ${r.stages.map((s, k) => `<button class="relay-dot" style="left:${pct(s.date)}%;--c:${byName.get(s.mayor)?.color || '#888'}" data-relay="${esc(r.id)}" data-k="${k}" title="${esc(s.mayor)}｜${esc(dot(s.date))}｜${esc(s.text)}"></button>`).join('')}
      </div>
      <ol class="relay-stages">${r.stages.map((s) => `<li style="--c:${byName.get(s.mayor)?.color || '#888'}"><span class="who">${esc(s.mayor)}</span><span class="when">${esc(dot(s.date))}</span><span class="what">${esc(s.text)}</span>${(s.sources || []).map(src).join('')}</li>`).join('')}</ol>
    </article>`).join('');

  const cards = ms.map((m) => `
    <article class="mayor" id="mayor-${esc(m.id)}" style="--c:${m.color}">
      <header>
        <h3>${esc(m.name)}</h3>
        <p>${esc(dot(m.term[0]))} – ${m.current ? '現任' : esc(dot(m.term[1]))}・${esc(m.party)}</p>
      </header>
      <ul class="mayor-items">${m.items.map((it) => `<li>
        <div class="mi-top"><b>${esc(it.title)}</b><span>${esc(dot(it.date))}${it.area ? `・${esc(it.area)}` : ''}</span></div>
        <p>${esc((it.facts || []).join(' '))}</p>
        <div class="sources">${(it.sources || []).map(src).join('')}</div>
        ${it.theme ? `<button class="pl-go" data-theme="${esc(it.theme)}" data-item="${esc(it.item || '')}">在施政島上看 →</button>` : ''}
      </li>`).join('')}</ul>
      ${m.controversies?.length ? `<details class="pl-more pl-crit"><summary>市政爭議（${m.controversies.length}）</summary><ul class="mayor-items">${m.controversies.map((c) => `<li>
        <div class="mi-top"><b>${esc(c.title)}</b><span>${esc(dot(c.date))}</span></div>
        <p>${esc((c.facts || []).join(' '))}</p>
        <div class="sources">${(c.sources || []).map(src).join('')}</div></li>`).join('')}</ul></details>` : ''}
      ${m.current ? '<p class="mayor-more">完整任內施政請看「島嶼」與「清單」，2022 政見請看「政見兌現」。</p>' : ''}
    </article>`).join('');

  root.innerHTML = `
    <h2>市長接力</h2>
    <p class="lead">${esc(data.meta.lead)}</p>
    <div class="term-band" aria-label="歷任市長任期">${band}<div class="term-years">${years.join('')}</div></div>
    <details class="pl-method"><summary>收錄標準</summary><ul>${data.meta.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>
    <h3 class="mayor-h">跨任期建設：誰起頭、誰完成</h3>
    <div class="relays">${relays}</div>
    <h3 class="mayor-h">各任代表性市政</h3>
    <div class="mayors">${cards}</div>`;

  root.addEventListener('click', (e) => {
    const go = e.target.closest('.pl-go');
    if (go) { onOpenTheme?.(go.dataset.theme, go.dataset.item || undefined); return; }
    const dotBtn = e.target.closest('.relay-dot');
    if (dotBtn) {
      const li = root.querySelectorAll(`#relay-${CSS.escape(dotBtn.dataset.relay)} .relay-stages li`)[+dotBtn.dataset.k];
      if (li) { li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); li.classList.add('is-flash'); setTimeout(() => li.classList.remove('is-flash'), 1500); }
    }
  });
}
