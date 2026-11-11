import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
for (const vp of [{ width: 1280, height: 800 }, { width: 600, height: 800 }, { width: 360, height: 640 }]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5055/', { waitUntil: 'networkidle' });
  await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
  await page.waitForTimeout(700);
  const info = await page.evaluate(() => {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    const g = c.getContext('2d');
    const data = g.getImageData(0, 0, c.width, c.height).data;
    const W = c.width, H = c.height;
    let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
    // 找"高饱和"元素像素（tile 主色）
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4;
        const rr = data[i], gg = data[i + 1], bb = data[i + 2], aa = data[i + 3];
        if (aa < 200) continue;
        const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
        if (mx > 110 && mx - mn > 60) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    const t = g.getTransform();
    const scale = t.a;
    const dpr = window.devicePixelRatio;
    // 视觉 bbox → CSS
    const toCss = (bx, by) => ({ x: r.left + bx * (r.width / c.width), y: r.top + by * (r.height / c.height) });
    const visTL = toCss(minX, minY), visBR = toCss(maxX, maxY);
    // 输入映射：screenToLogical 假定棋盘逻辑 (224,96)-(736,608) 直接按画布矩形等比换算
    const sx = 960 / r.width, sy = 720 / r.height;
    const inTL = { x: r.left + 224 / sx, y: r.top + 96 / sy };
    const inBR = { x: r.left + 736 / sx, y: r.top + 608 / sy };
    return {
      rect: { x: r.left, y: r.top, w: r.width, h: r.height },
      canvas: { w: c.width, h: c.height, dpr },
      transform: { a: t.a, e: t.e, f: t.f },
      visualBoardCss: { x: visTL.x, y: visTL.y, right: visBR.x, bottom: visBR.y },
      inputBoardCss: { x: inTL.x, y: inTL.y, right: inBR.x, bottom: inBR.y },
      dxVisualVsInput: visTL.x - inTL.x,
      dyVisualVsInput: visTL.y - inTL.y,
    };
  });
  console.log(JSON.stringify({ vp, ...info }, null, 2));
  await ctx.close();
}
await browser.close();
