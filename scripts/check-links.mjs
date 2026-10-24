// 每週檢查所有來源連結是否還打得開
// 404／410／DNS 失敗 → 列為「失效」；403／429 等擋爬蟲 → 列為「需人工確認」，不算失敗
import { readFile, appendFile } from 'node:fs/promises';

const policies = JSON.parse(await readFile('data/policies.json', 'utf8'));
const pledges = JSON.parse(await readFile('data/pledges2022.json', 'utf8'));
const refs = new Map(); // url → [出處]
const add = (url, where) => { if (!/^https?:\/\//.test(url || '')) return; (refs.get(url) || refs.set(url, []).get(url)).push(where); };
policies.themes.forEach((t) => t.items.forEach((i) => (i.sources || []).forEach((s) => add(s.url, `施政 ${i.id}`))));
policies.meta.campaign?.sources?.forEach((s) => add(s.url, '選舉背景'));
pledges.items.forEach((p) => (p.sources || []).forEach((s) => add(s.url, `政見 ${p.id}`)));

const UA = 'Mozilla/5.0 (compatible; TaipeiPolicyIslands-LinkCheck/1.0; +https://github.com/bounce12340/chiang-wanan-policy-island)';
async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(url, { method, redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html,application/pdf,*/*' }, signal: AbortSignal.timeout(20000) });
      if (method === 'HEAD' && (r.status === 405 || r.status === 403 || r.status >= 500)) continue; // 有些網站不支援 HEAD
      return { status: r.status };
    } catch (e) {
      if (method === 'GET') return { status: 0, error: e.cause?.code || e.name };
    }
  }
  return { status: 0, error: 'unknown' };
}

const urls = [...refs.keys()];
const results = [];
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < urls.length) {
    const url = urls[next++];
    results.push({ url, ...(await probe(url)) });
  }
}));

const dead = results.filter((r) => r.status === 404 || r.status === 410 || (r.status === 0 && /ENOTFOUND|EAI_AGAIN|ERR_TLS|CERT/.test(r.error || '')));
const manual = results.filter((r) => !dead.includes(r) && (r.status === 0 || r.status >= 400));
const line = (r) => `- ${r.status || r.error} ${r.url}\n  - 用於：${refs.get(r.url).join('、')}`;
const report = [
  `## 來源連結檢查（${new Date().toISOString().slice(0, 10)}）`,
  `共 ${urls.length} 個網址；失效 ${dead.length}、需人工確認 ${manual.length}。`,
  dead.length ? `\n### 失效（需要替換）\n${dead.map(line).join('\n')}` : '',
  manual.length ? `\n### 需人工確認（網站可能擋自動檢查）\n${manual.map(line).join('\n')}` : '',
].join('\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report + '\n');
if (process.env.REPORT_FILE) await appendFile(process.env.REPORT_FILE, report + '\n');
process.exitCode = dead.length ? 1 : 0;
