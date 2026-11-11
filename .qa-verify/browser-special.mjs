import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5056/?seed=1', { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
await page.evaluate(() => window.__wmgTest.startLevel(1));
await page.waitForSelector('#screen-game:not(.hidden)');
await page.waitForTimeout(400);
const before = await page.locator('#game').screenshot({ path: '.qa-verify/out/I1-before-special.png' });
await page.evaluate(() => window.__wmgTest.resetAnimations());
await page.evaluate(() => window.__wmgTest.swap({ row: 2, col: 3 }, { row: 3, col: 3 }));
await page.waitForTimeout(1800);
const st = await page.evaluate(() => window.__wmgTest.state());
const specials = [{ row: 3, col: 3, special: 'line-h' }];

const anims = await page.evaluate(() => window.__wmgTest.animations());
await page.locator('#game').screenshot({ path: '.qa-verify/out/I2-special-created.png' });
console.log('state', JSON.stringify(st));
console.log('specials on board', JSON.stringify(specials));
console.log('animations', JSON.stringify(anims));
// 取特化格中心颜色，确认不是普通元素贴图（special-line-h 主色为白/黄箭头）
const px = await page.evaluate(({ row, col }) => {
  const c = document.getElementById('game');
  const t = c.getContext('2d').getTransform();
  const x = Math.round(t.e + (224 + (col - 0.5) * 64) * t.a);
  const y = Math.round(t.f + (96 + (row - 0.5) * 64) * t.a);
  return Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data);
}, specials[0] ?? { row: 1, col: 1 });
console.log('special cell center pixel', JSON.stringify(px));
await browser.close();

