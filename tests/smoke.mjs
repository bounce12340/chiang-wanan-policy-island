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
  await page.locator('[data-layer="items"]').click({ force: true });
  check(await page.evaluate(() => window.__dbg().peopleCount >= 200), `${name}: 島上居民 200 人以上`);

  await page.goto(`${BASE}/#/housing`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#loading')?.classList.contains('is-done'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  check(await page.$eval('#panel', (p) => p.classList.contains('is-open')), `${name}: 深連結打開居住島面板`);

  for (const v of ['list', 'timeline', 'pledges']) {
    await page.click(`[data-view="${v}"]`);
    await page.waitForTimeout(600);
    check(await page.$eval(`#${v}-view`, (el) => !el.hidden), `${name}: 切換到 ${v} 檢視`);
  }
  await page.waitForSelector('.pl', { timeout: 10000 });
  check(await page.$$eval('.pl', (e) => e.length) === pledgeCount, `${name}: 政見卡片數 = ${pledgeCount}`);
  await page.click('[data-view="island"]');
  await page.waitForTimeout(800);

  check(errors.length === 0, `${name}: 主控台零錯誤${errors.length ? `\n    ${errors.slice(0, 5).join('\n    ')}` : ''}`);
  await ctx.close();
}

await browser.close();
server.close();
if (failures.length) { console.error(`\n${failures.length} 項失敗`); process.exit(1); }
console.log('\n全部通過');
