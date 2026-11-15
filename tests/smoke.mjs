// 煙霧測試：用無頭瀏覽器真的打開網站，確認 3D 有啟動、各檢視可切換、主控台沒有錯誤。
// 用法：npm test（會自己開一個本機伺服器）
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve('.');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failures.push(msg); };

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const pledgeCount = JSON.parse(await readFile('data/pledges2022.json', 'utf8')).items.length;

for (const [name, opts] of [
  ['desktop', { viewport: { width: 1366, height: 860 } }],
  ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|cloudflareinsights/.test(m.text() + (m.location()?.url || ''))) errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', (r) => { if (r.url().startsWith(BASE)) errors.push(`requestfailed: ${r.url()}`); });
  page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });

  await page.goto(`${BASE}/?debug`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#loading')?.classList.contains('is-done'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  check(await page.$('#stage canvas') !== null, `${name}: 3D 畫布已建立`);
  check(!(await page.$eval('[data-view="island"]', (b) => b.disabled)), `${name}: 島嶼檢視可用（3D 沒有退回清單）`);

  await page.goto(`${BASE}/?debug#/tour`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#loading')?.classList.contains('is-done'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  check(await page.$eval('#tour', (t) => !t.hidden && t.querySelector('.tour-cap h3')?.textContent.length > 0), `${name}: 自動導覽可啟動`);
  await page.locator('#tour [data-t="exit"]').click({ force: true });
  await page.waitForTimeout(400);
  check(await page.$eval('#tour', (t) => t.hidden), `${name}: 自動導覽可離開`);

  await page.locator('[data-layer="pledges"]').click({ force: true });
  await page.waitForTimeout(600);
  check(await page.evaluate(() => document.body.classList.contains('pledge-mode') && window.__dbg().pledges.length > 0), `${name}: 2022 承諾圖層可切換`);
  await page.locator('[data-layer="links"]').click({ force: true });
  const pillsShown = await page.waitForFunction(() => [...document.querySelectorAll('.link-pill')].filter((x) => getComputedStyle(x).display !== 'none').length, null, { timeout: 8000 })
    .then((h) => h.jsonValue()).catch(() => 0);
  check(pillsShown >= 8, `${name}: 政策關係弧線可顯示（${pillsShown} 條）`);
  await page.locator('[data-link="0"]').click({ force: true });
  check(await page.$eval('#pledge-pop', (e) => !e.hidden && e.querySelectorAll('.src').length > 0), `${name}: 關係說明附來源`);
  await page.locator('[data-layer="future"]').click({ force: true });
  await page.waitForTimeout(800);
  check(await page.evaluate(() => document.body.classList.contains('future-mode')), `${name}: 未來藍圖圖層可切換`);
  await page.locator('[data-layer="items"]').click({ force: true });
  check(await page.evaluate(() => window.__dbg().peopleCount >= 200), `${name}: 島上居民 200 人以上`);

  await page.goto(`${BASE}/?debug#/story/parent`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#loading')?.classList.contains('is-done'), null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  check(await page.$eval('#tour', (t) => !t.hidden && /新手爸媽/.test(t.textContent)), `${name}: 市民的一天可啟動`);

  await page.goto(`${BASE}/#/housing`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#loading')?.classList.contains('is-done'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  check(await page.$eval('#panel', (p) => p.classList.contains('is-open')), `${name}: 深連結打開居住島面板`);

  for (const v of ['list', 'timeline', 'ledger', 'mayors', 'pledges']) {
    await page.click(`[data-view="${v}"]`);
    await page.waitForTimeout(600);
    check(await page.$eval(`#${v}-view`, (el) => !el.hidden), `${name}: 切換到 ${v} 檢視`);
  }
  check(await page.$$eval('#mayors-view .mayor', (e) => e.length) === 5 && await page.$$eval('#mayors-view .relay', (e) => e.length) >= 4, `${name}: 市長接力顯示 5 任市長與跨任期建設`);
  check(await page.$$eval('#ledger-view .lg-group', (e) => e.length) >= 10, `${name}: 民生帳本顯示各族群`);
  check(await page.$$eval('#tl-future .future-item', (e) => e.length) > 10, `${name}: 時間軸顯示未來計畫`);
  await page.waitForSelector('.pl', { timeout: 10000 });
  check(await page.$$eval('.pl', (e) => e.length) === pledgeCount, `${name}: 政見卡片數 = ${pledgeCount}`);
  await page.click('[data-view="island"]');
  await page.waitForTimeout(800);

  // ---------- 互動加值 ----------
  // 全站搜尋：/ 叫出，跨資料類型都找得到
  await page.keyboard.press('/');
  await page.waitForSelector('#finder[open]', { timeout: 3000 });
  await page.fill('#finder-input', '巨蛋');
  await page.waitForFunction(() => document.querySelectorAll('#finder-results .fd-row').length > 0, null, { timeout: 8000 });
  const kinds = await page.$$eval('#finder-results .fd-group', (e) => e.map((x) => x.textContent));
  check(kinds.includes('施政') && kinds.includes('市長接力'), `${name}: 全站搜尋跨施政與市長接力（${kinds.join('、')}）`);
  await page.keyboard.press('Escape');
  // 收藏：按下後計數出現、重新整理後還在
  await page.evaluate(() => document.querySelector('#list-view .fav-btn').click());
  check(await page.$eval('#saved-count', (e) => e.textContent) === '1', `${name}: 收藏後計數為 1`);
  // 我是誰
  await page.evaluate(() => { location.hash = '#/who/commuters'; });
  await page.waitForFunction(() => !document.querySelector('#who-bar').hidden, null, { timeout: 5000 });
  check(/通勤族/.test(await page.$eval('#who-bar', (e) => e.textContent)), `${name}: 我是誰身分列出現`);
  await page.evaluate(() => document.querySelector('#who-bar [data-whogo="clear"]').click());
  // 政見篩選寫進網址、可由網址帶入
  await page.evaluate(() => { location.hash = `#/pledges?status=not_done`; });
  await page.waitForTimeout(800);
  const nd = JSON.parse(await readFile('data/pledges2022.json', 'utf8')).items.filter((p) => p.status === 'not_done').length;
  check(await page.$$eval('.pl:not([hidden])', (e) => e.length) === nd, `${name}: 網址帶入政見篩選（未兌現 ${nd} 條）`);
  // 猜猜看
  await page.evaluate(() => { location.hash = '#/quiz'; });
  await page.waitForFunction(() => document.querySelectorAll('#quiz [data-ans]').length === 3, null, { timeout: 5000 });
  await page.evaluate(() => document.querySelector('#quiz [data-ans]').click());
  check(await page.$('#quiz .qz-reveal .src, #quiz .qz-reveal') !== null, `${name}: 猜猜看作答後揭曉`);
  await page.keyboard.press('Escape');
  // 小遊戲：排排看、哪位市長、每日一題、護照
  await page.evaluate(() => { location.hash = '#/sort'; });
  await page.waitForFunction(() => document.querySelectorAll('#game .gm-sort li').length === 5, null, { timeout: 5000 });
  await page.evaluate(() => document.querySelector('#game [data-s="submit"]').click());
  check(/排對了 \d \/ 5/.test(await page.$eval('#game .qz-ask', (e) => e.textContent)), `${name}: 排排看可送出並計分`);
  await page.evaluate(() => { location.hash = '#/whomayor'; });
  await page.waitForFunction(() => document.querySelectorAll('#game [data-may]').length === 5, null, { timeout: 8000 });
  const leak = await page.$eval('#game .qz-quote', (e) => /陳水扁|馬英九|郝龍斌|柯文哲|蔣萬安/.test(e.textContent));
  await page.evaluate(() => document.querySelector('#game [data-may]').click());
  check(!leak && await page.$('#game .qz-reveal') !== null, `${name}: 哪位市長題目不洩漏姓名、作答後揭曉`);
  await page.evaluate(() => { location.hash = '#/daily'; });
  await page.waitForFunction(() => document.querySelectorAll('#game [data-d]').length >= 2, null, { timeout: 8000 });
  await page.evaluate(() => document.querySelector('#game [data-d]').click());
  check(/連續作答 1 天/.test(await page.$eval('#game .gm-streak', (e) => e.textContent)), `${name}: 每日一題作答後記錄連續天數`);
  // 數字猜猜看：5 題鎖定答案後出現總分，揭曉時附原句
  await page.evaluate(() => { location.hash = '#/numbers'; });
  await page.waitForSelector('#game .nm-range', { timeout: 8000 });
  let factOk = true;
  for (let k = 0; k < 5; k++) {
    await page.evaluate(() => document.querySelector('#game [data-n="lock"]').click());
    factOk &&= await page.$eval('#game .nm-fact', (e) => e.textContent.length > 8).catch(() => false);
    await page.evaluate(() => document.querySelector('#game [data-n="next"]').click());
  }
  check(factOk && /\/ 500 分/.test(await page.$eval('#game .qz-score', (e) => e.textContent).catch(() => '')), `${name}: 數字猜猜看可完成 5 題並計分`);
  await page.keyboard.press('Escape');
  // 如果我是市長：大致平均分完 100 億元後出現風格卡與對照
  await page.evaluate(() => { location.hash = '#/budget'; });
  await page.waitForSelector('#game [data-bg]', { timeout: 8000 });
  await page.evaluate(() => document.querySelector('#game [data-b="even"]').click());
  await page.evaluate(() => document.querySelector('#game [data-b="done"]').click());
  check(await page.$$eval('#game .bg-bars li', (e) => e.length) === 12 && /重疊度 \d+%/.test(await page.$eval('#game', (e) => e.textContent)), `${name}: 如果我是市長可分配並顯示對照`);
  await page.keyboard.press('Escape');
  // 拍照模式：收起介面、按快門產生明信片圖片
  await page.evaluate(() => { location.hash = '#/photo'; });
  await page.waitForFunction(() => document.body.classList.contains('photo-mode'), null, { timeout: 5000 });
  await page.evaluate(() => document.querySelector('[data-ph="shoot"]').click());
  await page.waitForFunction(() => document.querySelector('#photo-card').open && document.querySelector('#photo-img').naturalWidth > 500, null, { timeout: 15000 }).catch(() => {});
  check(await page.$eval('#photo-img', (e) => e.naturalWidth) > 500 && !(await page.evaluate(() => document.body.classList.contains('photo-mode'))), `${name}: 拍照模式可產生明信片`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { location.hash = '#/passport'; });
  await page.waitForSelector('#game .pp-stamp.is-on', { timeout: 5000 });
  check(await page.$$eval('#game .pp-stamp.is-on', (e) => e.length) >= 5, `${name}: 護照已蓋章（島、頁、遊戲）`);
  await page.keyboard.press('Escape');

  check(errors.length === 0, `${name}: 主控台零錯誤${errors.length ? `\n    ${errors.slice(0, 5).join('\n    ')}` : ''}`);
  await ctx.close();
}

// 安全韌性島：小舞台提示牌與地震演練
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/#/safety/safety-first-aid`, { waitUntil: 'load' });
  await page.waitForSelector('.hotspot-pill', { timeout: 30000 });
  await page.evaluate(() => document.querySelector('.hotspot-pill').click());
  check(/叫、叫、壓、電/.test(await page.$eval('#pledge-pop', (e) => (e.hidden ? '' : e.textContent))), `safety: 點 AED 提示牌顯示急救口訣`);
  await page.evaluate(() => { document.getElementById('pledge-pop').hidden = true; document.querySelector('[data-quake]').click(); });
  await page.waitForFunction(() => /演練結束/.test(document.querySelector('.quake-cap')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  check(/演練結束/.test(await page.$eval('.quake-cap', (e) => e.textContent).catch(() => '')) && errors.length === 0, `safety: 地震演練可完整執行${errors.length ? ' ' + errors.join(' | ') : ''}`);
  // 按壓節奏挑戰：以 520 毫秒間隔按壓，應算出約 115 下／分並判定「剛好」
  await page.evaluate(() => { location.hash = '#/cpr'; });
  await page.waitForSelector('#game .cpr-pad', { timeout: 8000 });
  await page.evaluate(() => new Promise((res) => {
    const pad = document.querySelector('#game .cpr-pad'); let n = 0;
    const id = setInterval(() => { pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); if (++n >= 22) { clearInterval(id); res(); } }, 520);
  }));
  await page.waitForSelector('#game .qz-score', { timeout: 8000 }).catch(() => {});
  const bpm = +(await page.$eval('#game .qz-score b', (e) => e.textContent).catch(() => 0));
  check(bpm >= 100 && bpm <= 125, `safety: 按壓節奏挑戰計算正確（${bpm} 下／分）`);
  await ctx.close();
}

// 島上尋寶：寶物要放在島面上（不在建築裡），點到會解鎖施政並計數
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?debug#/hunt`, { waitUntil: 'load' });
  await page.waitForSelector('#hunt-bar:not([hidden])', { timeout: 30000 });
  await page.addStyleTag({ content: '.footnote,.layer,.index,.legend,.toast,.isle-label,.district-label,.center-label,.hotspot-pill{display:none!important}' });
  let found = 0;
  for (const id of ['bike', 'globe', 'aed']) {
    const t = await page.evaluate((id) => window.__treasure(id), id);
    const [x, y, z] = t.world;
    await page.evaluate(([x, y, z]) => window.__look([x + 0.01, y + 7, z + 0.01], [x, y, z]), [x, y, z]);
    await page.waitForTimeout(500);
    const s = await page.evaluate((id) => window.__treasure(id), id);
    await page.mouse.click(s.x, s.y);
    await page.waitForTimeout(200);
    if (/找到了/.test(await page.$eval('#pledge-pop', (e) => (e.hidden ? '' : e.textContent)))) found++;
    await page.evaluate(() => { document.getElementById('pledge-pop').hidden = true; });
  }
  const bar = await page.$eval('#hunt-bar', (e) => e.textContent);
  check(found === 3 && /3 \/ 12/.test(bar) && errors.length === 0, `hunt: 點寶物可解鎖施政並計數（${found}/3）${errors.length ? ' ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// 開船巡島：靠近交通島時跳出施政卡，按 E 上岸打開該島
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?debug#/sail`, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('#sail-ui').hidden, null, { timeout: 30000 });
  await page.evaluate(() => window.__sailTo(3.7, 13.5));
  await page.keyboard.down('w');
  await page.waitForFunction(() => /交通/.test(document.querySelector('.sl-card:not([hidden])')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  await page.keyboard.up('w');
  const card = await page.$eval('.sl-card', (e) => (e.hidden ? '' : e.textContent));
  await page.keyboard.press('e');
  await page.waitForTimeout(800);
  const docked = await page.evaluate(() => document.querySelector('#sail-ui').hidden && location.hash.startsWith('#/transport'));
  check(/交通/.test(card) && docked && errors.length === 0, `sail: 開船靠近島嶼顯示施政卡、可上岸${errors.length ? ' ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// 上次造訪後的新內容：模擬上一次造訪只看過一項，應提示新增
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('cwpi:seeded')) {
      sessionStorage.setItem('cwpi:seeded', '1');
      localStorage.setItem('cwpi:visit', JSON.stringify({ seen: { 'i:transport-xinyi-east': 'in_progress' }, seenDate: '2026-10-01' }));
    }
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('#hero-fresh').hidden, null, { timeout: 15000 }).catch(() => {});
  const txt = await page.$eval('#hero-fresh', (e) => (e.hidden ? '' : e.textContent));
  check(/新增/.test(txt) && /狀態更新 1 項/.test(txt), `fresh: 提示上次造訪後的新內容（${txt.replace(/\s+/g, ' ').trim().slice(0, 40)}）`);
  await ctx.close();
}

// 可嵌入的單條政見卡
{
  const page = await browser.newPage({ viewport: { width: 520, height: 600 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/embed/pledge.html?id=p22-media-01`, { waitUntil: 'networkidle' });
  check(await page.$('#card .pl .badge') !== null && errors.length === 0, `embed: 單條政見卡可顯示${errors.length ? ' ' + errors.join(' | ') : ''}`);
  await page.close();
}

await browser.close();
server.close();
if (failures.length) { console.error(`\n${failures.length} 項失敗`); process.exit(1); }
console.log('\n全部通過');
