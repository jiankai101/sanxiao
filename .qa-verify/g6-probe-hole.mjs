import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5056/?seed=1', { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
await page.evaluate(() => window.__wmgTest.startLevel(8));
await page.waitForTimeout(600);
const g = await page.evaluate(() => {
  const c = document.getElementById('game'); const r = c.getBoundingClientRect();
  const t = c.getContext('2d').getTransform();
  return { left: r.left, top: r.top, a: t.a, e: t.e, f: t.f, dpr: devicePixelRatio };
});
const pt = (row, col) => ({ x: g.left + (g.e + (224 + (col - 0.5) * 64) * g.a) / g.dpr, y: g.top + (g.f + (96 + (row - 0.5) * 64) * g.a) / g.dpr });
for (const [r, c] of [[3,3],[3,6],[6,2],[6,7],[2,3],[5,1],[1,1],[1,2],[4,4]]) {
  await page.evaluate(() => window.__wmgTest.selected());
  const p = pt(r, c);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(50);
  const sel = await page.evaluate(() => window.__wmgTest.selected());
  console.log(`click(${r},${c}) ->`, JSON.stringify(sel));
  if (sel) { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(30); }
}
await browser.close();
