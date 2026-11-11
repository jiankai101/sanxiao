import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5055/?seed=1', { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
await page.evaluate(() => window.__wmgTest.startLevel(8));
await page.waitForSelector('#screen-game:not(.hidden)');
await page.waitForTimeout(400);
const cellPoint = async (row, col) => {
  const b = await page.locator('#game').boundingBox();
  const s = b.width / 960;
  return { x: b.x + (224 + (col - 0.5) * 64) * s, y: b.y + (96 + (row - 0.5) * 64) * s };
};
const seq = [
  [{ row: 1, col: 2 }, { row: 1, col: 3 }],
  [{ row: 3, col: 5 }, { row: 4, col: 5 }],
  [{ row: 1, col: 6 }, { row: 1, col: 7 }],
  [{ row: 1, col: 6 }, { row: 2, col: 6 }],
  [{ row: 1, col: 3 }, { row: 1, col: 4 }],
];
for (const [a, b] of seq) {
  const st = await page.evaluate(() => window.__wmgTest.state());
  const p1 = await cellPoint(a.row, a.col);
  const p2 = await cellPoint(b.row, b.col);
  await page.mouse.move(p1.x, p1.y);
  await page.mouse.down();
  await page.mouse.move(p2.x, p2.y, { steps: 6 });
  await page.mouse.up();
  for (let k = 0; k < 80; k += 1) {
    const cur = await page.evaluate(() => window.__wmgTest.state());
    if (cur.status !== 'settling' && cur.movesLeft === st.movesLeft - 1) break;
    if (cur.status === 'won' || cur.status === 'lost') break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(150);
}
const st = await page.evaluate(() => window.__wmgTest.state());
const move = await page.evaluate(() => window.__wmgTest.findMove());
const toasts = await page.locator('#toast-root').textContent();
console.log('STATE', JSON.stringify(st));
console.log('findMove', JSON.stringify(move));
console.log('toastRoot', JSON.stringify(toasts));
await page.screenshot({ path: '.qa-verify/out/G-deadlock-level8.png' });
// 死局下尝试任意一次相邻交换
const p1 = await cellPoint(1, 1), p2 = await cellPoint(1, 2);
await page.mouse.move(p1.x, p1.y); await page.mouse.down();
await page.mouse.move(p2.x, p2.y, { steps: 6 }); await page.mouse.up();
await page.waitForTimeout(900);
const st2 = await page.evaluate(() => window.__wmgTest.state());
console.log('after click', JSON.stringify(st2));
console.log('errors', JSON.stringify(errors));
await browser.close();
