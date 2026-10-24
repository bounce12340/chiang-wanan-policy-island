// 產生分享頁與分享縮圖：每條 2022 政見 → /p/<id>，每個施政項目 → /i/<id>
// 用法：node scripts/build-share.mjs <輸出資料夾，預設 dist> [--limit N]
// 社群平台抓不到 #/ 之後的內容，所以每一條都需要一個真正的網址和自己的 og:image。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const SITE = (process.env.SITE_URL || 'https://chiang-wanan-policy-island.pages.dev').replace(/\/$/, '');
const out = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dist');
const limitIdx = process.argv.indexOf('--limit');
const limit = limitIdx > 0 ? Number(process.argv[limitIdx + 1]) : Infinity;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const dot = (d) => String(d || '').replace(/-/g, '.');

const PLEDGE = {
  done: ['已兌現', '#2e9e5b'], partial: ['部分兌現', '#c58a12'], in_progress: ['進行中', '#2f7dd3'],
  not_done: ['未兌現', '#c8463d'], unverifiable: ['無法檢驗', '#7b6fb0'], no_data: ['查無資料', '#8a8f98'],
};
const ITEM = { done: ['已完成', '#2e9e5b'], in_progress: ['進行中', '#2f7dd3'], proposal: ['規劃中', '#d99a14'], pledge: ['連任政見', '#d0457a'] };

const policies = JSON.parse(await readFile('data/policies.json', 'utf8'));
const pledges = JSON.parse(await readFile('data/pledges2022.json', 'utf8'));

// 政見卡的底部放全體 83 條的狀態比例，讓單條結果有脈絡
const pCount = {};
pledges.items.forEach((p) => { pCount[p.status] = (pCount[p.status] || 0) + 1; });
const overall = Object.keys(PLEDGE).filter((s) => pCount[s]).map((s) => ({ label: PLEDGE[s][0], color: PLEDGE[s][1], n: pCount[s] }));
const art = {};
for (const t of policies.themes) {
  try { art[t.id] = `data:image/webp;base64,${(await readFile(`assets/themes/${t.id}.webp`)).toString('base64')}`; } catch { /* 沒有插畫就不放 */ }
}

const cards = [];
for (const p of pledges.items) {
  const [label, color] = PLEDGE[p.status];
  cards.push({
    kind: 'p', id: p.id, hash: `#/pledges/${p.id}`,
    title: `${label}｜${clip(p.pledge, 40)}`,
    desc: clip(p.summary, 150),
    card: { kicker: `2022 政見兌現對照・${p.category}`, label, color, head: clip(p.pledge, 78), body: clip(p.summary, 120),
      foot: `查證截至 ${dot(pledges.meta.asOf)}・${p.sources.length} 個來源`, overall },
  });
}
for (const t of policies.themes) {
  for (const i of t.items) {
    const [label, color] = ITEM[i.status];
    cards.push({
      kind: 'i', id: i.id, hash: `#/${t.id}/${i.id}`,
      title: `${i.title}｜${t.name}`,
      desc: clip((i.facts || []).join(' '), 150),
      card: { kicker: `任內施政・${t.name}`, label, color, accent: t.color, head: i.title, body: clip(i.facts?.[0], 110),
        foot: `資料截至 ${dot(policies.meta.updated)}・${(i.sources || []).length} 個來源`, art: art[t.id] },
    });
  }
}

function pageHTML(c) {
  const url = `${SITE}/${c.kind}/${c.id}`;
  const img = `${SITE}/og/${c.kind}/${c.id}.jpg`;
  const target = `/${c.hash}`;
  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)}｜臺北施政島（非官方整理）</title>
<meta name="description" content="${esc(c.desc)}">
<meta property="og:type" content="article"><meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="臺北施政島（非官方整理）">
<meta property="og:title" content="${esc(c.title)}">
<meta property="og:description" content="${esc(c.desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">
<link rel="canonical" href="${esc(url)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<style>body{font:16px/1.6 system-ui,sans-serif;margin:40px;color:#14213d;background:#fbf8f2}</style>
</head><body>
<p>正在前往臺北施政島…若沒有自動跳轉，請<a href="${esc(target)}">點這裡</a>。</p>
<h1>${esc(c.title)}</h1><p>${esc(c.desc)}</p>
</body></html>`;
}

function cardHTML(c) {
  const k = c.card;
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}html,body{margin:0}
  body{width:1200px;height:630px;font-family:"Noto Sans TC","Noto Sans CJK TC","PingFang TC",sans-serif;color:#14213d;
    background:radial-gradient(1200px 600px at 100% 0%,#dff1ee 0%,#fbf8f2 55%);position:relative;overflow:hidden}
  .wrap{position:absolute;inset:56px 64px 48px 64px;display:flex;flex-direction:column}
  .brand{display:flex;align-items:center;gap:14px;font-weight:900;font-size:28px}
  .mark{width:44px;height:44px;border-radius:12px;background:linear-gradient(#f08c3a 0 45%,#20a39e 45%)}
  .kicker{margin-left:auto;font-size:22px;font-weight:700;color:#3d4a66}
  .row{display:flex;align-items:center;gap:16px;margin-top:40px}
  .badge{font-size:34px;font-weight:900;color:#fff;background:${k.color};padding:8px 24px;border-radius:999px}
  .bar{flex:1;height:10px;border-radius:9px;background:${k.accent || k.color};opacity:.35}
  h1{margin:26px 0 0;font-size:${k.head.length > 50 ? 40 : 48}px;line-height:1.35;font-weight:900;
    display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  p{margin:18px 0 0;font-size:25px;line-height:1.6;color:#3d4a66;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .main{display:flex;gap:36px;align-items:flex-start}.main>div{flex:1;min-width:0}
  .art{width:330px;height:248px;object-fit:cover;border-radius:22px;margin-top:30px;box-shadow:0 10px 30px rgba(20,33,61,.18)}
  .ov{margin-top:auto;margin-bottom:22px}.ov small{font-size:19px;color:#3d4a66;font-weight:700}
  .ovbar{display:flex;gap:4px;height:16px;border-radius:9px;overflow:hidden;margin:10px 0 10px}
  .ovleg{display:flex;flex-wrap:wrap;gap:4px 20px;font-size:18px;color:#3d4a66}.ovleg i{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px}
  .foot{margin-top:auto;display:flex;justify-content:space-between;font-size:21px;color:#3d4a66;border-top:2px solid rgba(20,33,61,.12);padding-top:16px}
  .foot b{color:#14213d}
  </style></head><body><div class="wrap">
  <div class="brand"><span class="mark"></span>臺北施政島<span class="kicker">${esc(k.kicker)}</span></div>
  <div class="row"><span class="badge">${esc(k.label)}</span><span class="bar"></span></div>
  <div class="main"><div>
  <h1>${esc(k.head)}</h1>
  ${k.body ? `<p>${esc(k.body)}</p>` : ''}
  </div>${k.art ? `<img class="art" src="${k.art}" alt="">` : ''}</div>
  ${k.overall ? `<div class="ov"><small>全部 ${k.overall.reduce((a, o) => a + o.n, 0)} 條 2022 政見</small>
    <div class="ovbar">${k.overall.map((o) => `<span style="flex:${o.n};background:${o.color}"></span>`).join('')}</div>
    <div class="ovleg">${k.overall.map((o) => `<span><i style="background:${o.color}"></i>${o.label} ${o.n}</span>`).join('')}</div></div>` : ''}
  <div class="foot" style="${k.overall ? 'margin-top:0' : ''}"><span>${esc(k.foot)}</span><b>非官方整理・每項附來源</b></div>
  </div></body></html>`;
}

const todo = cards.slice(0, limit);
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const c of todo) {
  await mkdir(path.join(out, c.kind), { recursive: true });
  await mkdir(path.join(out, 'og', c.kind), { recursive: true });
  await writeFile(path.join(out, c.kind, `${c.id}.html`), pageHTML(c));
  await page.setContent(cardHTML(c), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, 'og', c.kind, `${c.id}.jpg`), type: 'jpeg', quality: 82 });
}
await browser.close();
console.log(`✓ 分享頁 ${todo.length} 個 → ${out}/{p,i}/，縮圖 → ${out}/og/`);
