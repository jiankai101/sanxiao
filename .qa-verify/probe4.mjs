import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const cases = [{ w: 960, h: 720 }, { w: 1280, h: 800 }, { w: 600, h: 800 }, { w: 360, h: 640 }];
const out = [];
for (const vp of cases) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5055/', { waitUntil: 'networkidle' });
  await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
  await page.waitForTimeout(700);
  const geo = await page.evaluate(() => {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    const t = c.getContext('2d').getTransform();
    return { left: r.left, top: r.top, w: r.width, h: r.height, a: t.a, e: t.e, f: t.f, cw: c.width, ch: c.height, dpr: devicePixelRatio };
  });
  // 视觉上第 4 行第 4 列格子的中心（按 canvas 变换计算：即用户"看到"的位置）
  const row = 4, col = 4;
  const vx = geo.left + (geo.e + (224 + (col - 0.5) * 64) * geo.a) * (geo.w / geo.cw);
  const vy = geo.top + (geo.f + (96 + (row - 0.5) * 64) * geo.a) * (geo.h / geo.ch);
  const before = `.qa-verify/out/sel-${vp.w}-before.png`;
  const after = `.qa-verify/out/sel-${vp.w}-after.png`;
  await page.locator('#game').screenshot({ path: before });
  await page.mouse.click(vx, vy);
  await page.waitForTimeout(350);
  await page.locator('#game').screenshot({ path: after });
  // 输入映射下该点击命中的逻辑格
  const logical = { x: (vx - geo.left) * 960 / geo.w, y: (vy - geo.top) * 720 / geo.h };
  const inputCol = Math.min(8, Math.max(1, Math.floor((logical.x - 224) / 64) + 1));
  const inputRow = Math.min(8, Math.max(1, Math.floor((logical.y - 96) / 64) + 1));
  out.push({ vp: `${vp.w}x${vp.h}`, clickPoint: { x: +vx.toFixed(1), y: +vy.toFixed(1) },
    visualCell: { row, col }, inputMappedCell: { row: inputRow, col: inputCol },
    offset: { ex: +geo.e.toFixed(1), fy: +geo.f.toFixed(1), scale: +geo.a.toFixed(4) },
    before, after });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
