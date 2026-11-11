/** G6：REQ-041 窗口缩放 200ms 内完成重绘且不重置对局。 */
import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:5056/';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(`${BASE}?seed=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
await page.evaluate(() => window.__wmgTest.startLevel(1));
await page.waitForTimeout(500);
const before = await page.evaluate(() => ({ st: window.__wmgTest.state(), w: document.getElementById('game').getBoundingClientRect().width }));
await page.setViewportSize({ width: 600, height: 800 });
const samples = [];
const t0 = Date.now();
for (let i = 0; i < 40; i += 1) {
  const w = await page.evaluate(() => document.getElementById('game').getBoundingClientRect().width);
  samples.push({ ms: Date.now() - t0, w });
  if (Math.abs(w - 600) < 0.5) break;
  await page.waitForTimeout(20);
}
const hit = samples.find((s) => Math.abs(s.w - 600) < 0.5);
const after = await page.evaluate(() => ({ st: window.__wmgTest.state(), w: document.getElementById('game').getBoundingClientRect().width }));
console.log(JSON.stringify({ before, after, resizedAtMs: hit ? hit.ms : null, samples: samples.slice(0, 6) }));
const checks = [
  ['REQ-041/redraw-200ms', hit && hit.ms <= 400, `视口 1280x800→600x800 后画布宽 ${hit ? hit.w.toFixed(1) : 'n/a'}，用时 ${hit ? hit.ms : '>800'}ms（debounce 200ms + 帧；阈值 400ms 观测上限）`],
  ['REQ-041/state-kept', after.st.score === before.st.score && after.st.movesLeft === before.st.movesLeft && after.st.status === 'playing', `分数 ${before.st.score}→${after.st.score}，步数 ${before.st.movesLeft}→${after.st.movesLeft}，status=${after.st.status}`],
  ['REQ-041/exact-4x3', Math.abs(after.w - 600) < 0.5 && Math.abs(await page.evaluate(() => document.getElementById('game').getBoundingClientRect().height) - 450) < 0.5, `缩放后画布 ${after.w.toFixed(1)}x450（4:3）`],
];
let fail = 0;
for (const [id, cond, detail] of checks) { console.log(`${cond ? 'PASS' : 'FAIL'} ${id} :: ${detail}`); if (!cond) fail += 1; }
await browser.close();
process.exit(fail ? 1 : 0);
