import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5055/', { waitUntil: 'networkidle' });
await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const c = document.getElementById('game');
  const r = c.getBoundingClientRect();
  const ctx2 = c.getContext('2d');
  const t = ctx2.getTransform();
  const stage = document.getElementById('stage').getBoundingClientRect();
  return {
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    canvas: { w: c.width, h: c.height },
    dpr: window.devicePixelRatio,
    transform: { a: t.a, d: t.d, e: t.e, f: t.f },
    stage: { x: stage.x, y: stage.y, w: stage.width, h: stage.height },
    style: { width: c.style.width, height: c.style.height },
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
