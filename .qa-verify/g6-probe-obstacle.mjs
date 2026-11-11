/** OBS-01 取证：点击石块/死格的行为（选中态、后续相邻点击是否扣步/改分/出错）。 */
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:5056/?seed=1', { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
await page.evaluate(() => window.__wmgTest.startLevel(8));
await page.waitForTimeout(500);
const pt = async (row, col) => {
  const b = await page.locator('#game').boundingBox();
  const s = b.width / 960;
  return { x: b.x + (224 + (col - 0.5) * 64) * s, y: b.y + (96 + (row - 0.5) * 64) * s };
};
const click = async (row, col) => { const p = await pt(row, col); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(120); };
const st = () => page.evaluate(() => window.__wmgTest.state());
const sel = () => page.evaluate(() => window.__wmgTest.selected());
const rows = [];
// 死格 (3,3) → 相邻普通格 (3,2)
for (const [label, cell, next] of [['hole', [3, 3], [3, 2]], ['stone', [2, 3], [2, 4]], ['hole-then-self', [3, 6], [3, 6]]]) {
  const before = await st();
  await click(cell[0], cell[1]);
  const s1 = await sel();
  await click(next[0], next[1]);
  await page.waitForTimeout(500);
  const s2 = await sel();
  const after = await st();
  rows.push({ label, cell, selectedAfterClick: s1, selectedAfterNext: s2, score: `${before.score}->${after.score}`, moves: `${before.movesLeft}->${after.movesLeft}`, status: after.status });
}
console.log(JSON.stringify(rows, null, 1));
console.log('pageerror', JSON.stringify(errs));
await browser.close();
