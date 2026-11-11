/** 精确测量 resize → 画布重绘完成的时间（页内 rAF 采样，避免跨进程轮询误差）。 */
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5056/?seed=1', { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
await page.evaluate(() => window.__wmgTest.startLevel(1));
await page.waitForTimeout(400);
const result = await page.evaluate(() => new Promise((resolve) => {
  const c = document.getElementById('game');
  const startW = c.getBoundingClientRect().width;
  let t0 = null;
  const onResize = () => { if (t0 === null) t0 = performance.now(); };
  window.addEventListener('resize', onResize);
  window.resizeTo?.(600, 800);
  const targetW = 600;
  const t0Global = performance.now();
  const tick = () => {
    const w = c.getBoundingClientRect().width;
    const t = performance.now();
    if (t0 === null && Math.abs(w - startW) > 1) t0 = t;
    if (Math.abs(w - targetW) < 0.5) {
      resolve({ startW, endW: w, firstChangeAtMs: t0 ? +(t0 - t0Global).toFixed(1) : null, settledAtMs: +(t - t0Global).toFixed(1) });
      return;
    }
    if (t - t0Global > 2000) { resolve({ startW, endW: w, timeout: true }); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log('in-page', JSON.stringify(result));
// 用 Playwright 改变视口（更接近真实窗口缩放）
await page.evaluate(() => { window.__mark = performance.now(); });
await page.setViewportSize({ width: 360, height: 640 });
const t = await page.evaluate(() => new Promise((resolve) => {
  const c = document.getElementById('game');
  const t0 = performance.now();
  const tick = () => {
    const w = c.getBoundingClientRect().width;
    if (Math.abs(w - 360) < 0.5) { resolve({ w, ms: +(performance.now() - t0).toFixed(1) }); return; }
    if (performance.now() - t0 > 2000) { resolve({ w, timeout: true }); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log('setViewportSize 1280->360', JSON.stringify(t));
await browser.close();
