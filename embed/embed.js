// 可嵌入的單條政見卡：/embed/pledge.html?id=p22-media-01
import { loadPledges, cardHTML } from '../pledges.js';

const id = new URLSearchParams(location.search).get('id');
const box = document.getElementById('card');
loadPledges().then((pd) => {
  const p = pd.items.find((x) => x.id === id);
  if (!p) { box.innerHTML = '<p class="err">找不到這條政見。</p>'; return; }
  box.innerHTML = cardHTML(p, () => null, { embed: true });
  document.getElementById('full').href = `/p/${encodeURIComponent(p.id)}`;
  document.getElementById('foot').textContent = `查證截至 ${String(pd.meta.asOf).replace(/-/g, '.')}・非官方整理，與任何候選人或政黨無關。`;
}).catch(() => { box.innerHTML = '<p class="err">資料載入失敗。</p>'; });
