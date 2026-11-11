import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5055/', { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
await page.waitForTimeout(500);
const r = await page.evaluate(() => {
  const raw = localStorage.getItem('wmg.save.v1');
  const t0 = performance.now();
  for (let i = 0; i < 200; i += 1) localStorage.setItem('__probe__', raw);
  const t1 = performance.now();
  localStorage.removeItem('__probe__');
  return { bytes: raw.length, avgMs: (t1 - t0) / 200 };
});
console.log(JSON.stringify(r));
await browser.close();
