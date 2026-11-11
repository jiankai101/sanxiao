/** G7 REQ-051: 10s live gameplay frame stats + third-party request count. */
import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:5056/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const urls = [];
page.on('request', (r) => urls.push(r.url()));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${BASE}?seed=31415`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__wmgTest));
await page.evaluate(() => window.__wmgTest.startLevel(1));
await page.waitForTimeout(300);
const t0 = Date.now();
let moves = 0;
while (Date.now() - t0 < 10000) {
  const st = await page.evaluate(() => window.__wmgTest.state());
  if (st && st.status === 'playing' && st.movesLeft > 0) {
    await page.evaluate(() => { const m = window.__wmgTest.findMove(); if (m) window.__wmgTest.swap(m.a, m.b); });
    moves += 1;
  }
  await page.waitForTimeout(900);
}
const perf = await page.evaluate(() => window.__wmgPerf());
const external = urls.filter((u) => !u.startsWith('http://127.0.0.1:5056') && !u.startsWith('data:') && !u.startsWith('blob:'));
console.log('moves attempted', moves);
console.log('perf', JSON.stringify(perf));
console.log('external requests', external.length, external);
console.log('pageerrors', errors.length, errors);
const pass = perf.samples >= 300 && perf.p95 <= 20 && perf.lowFpsRatio <= 0.05 && external.length === 0 && errors.length === 0;
console.log('RESULT', pass ? 'PASS' : 'FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
