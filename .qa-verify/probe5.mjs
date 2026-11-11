import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
for (const vp of [{ w: 600, h: 800 }, { w: 1280, h: 800 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5055/', { waitUntil: 'networkidle' });
  await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `.qa-verify/out/layout-${vp.w}x${vp.h}.png` });
  await ctx.close();
}
await browser.close();
