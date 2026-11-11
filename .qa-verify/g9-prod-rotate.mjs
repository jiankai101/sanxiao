/** G9 生产构建（dist）独立复核：可直接运行 + resize 后 200ms 内重绘 + 无测试钩子。 */
import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:5058/';
const VPS = [{ width: 360, height: 640 }, { width: 640, height: 360 }, { width: 320, height: 568 }, { width: 568, height: 320 }];
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });
const reqs = [];
page.on('request', (r) => reqs.push(r.url()));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
await page.click('#screen-level-select .level-card');
await page.waitForSelector('#screen-game:not(.hidden)');
await page.waitForTimeout(700);

const hasTestHook = await page.evaluate(() => Boolean(window.__wmgTest));
await page.evaluate(() => {
  const c = document.getElementById('game');
  const ctx2 = c.getContext('2d');
  window.__pr = { syncAlpha: null };
  new MutationObserver(() => {
    const tf = ctx2.getTransform();
    const px = ctx2.getImageData(Math.round(tf.e + 120 * tf.a), Math.round(tf.f + 120 * tf.d), 1, 1).data;
    window.__pr.syncAlpha = px[3];
  }).observe(c, { attributes: true, attributeFilter: ['width'] });
  window.__pmeasure = (want) => new Promise((resolve) => {
    const rec = { resizeAt: null, sizeOkAt: null, paintAt: null, cssW: null, backW: null, want };
    window.addEventListener('resize', () => { if (rec.resizeAt === null) rec.resizeAt = performance.now(); }, { once: true });
    const started = performance.now();
    const step = () => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      if (Math.abs(r.width - want) <= 1 && c.width === Math.round(r.width * dpr)) {
        if (rec.sizeOkAt === null) { rec.sizeOkAt = performance.now(); rec.cssW = r.width; rec.backW = c.width; rec.ratio = c.width / r.width; }
        const tf = ctx2.getTransform();
        const px = ctx2.getImageData(Math.round(tf.e + 120 * tf.a), Math.round(tf.f + 120 * tf.d), 1, 1).data;
        if (px[3] > 0) { requestAnimationFrame((ts) => { rec.paintAt = ts; resolve(rec); }); return; }
      }
      if (performance.now() - started > 6000) resolve(rec); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
});
const hudBefore = await page.evaluate(() => ({ score: document.getElementById('hud-score').textContent, moves: document.getElementById('hud-moves').textContent, game: !document.getElementById('screen-game').classList.contains('hidden') }));
const rows = [];
for (const vp of VPS) {
  const want = 960 * Math.min(vp.width / 960, vp.height / 720);
  const pending = page.evaluate((w) => window.__pmeasure(w), want);
  await page.waitForTimeout(20);
  await page.setViewportSize({ width: vp.width, height: vp.height });
  const rec = await pending;
  const alpha = await page.evaluate(() => window.__pr.syncAlpha);
  rows.push({ vp: `${vp.width}x${vp.height}`, rebuildMs: Math.round((rec.sizeOkAt - rec.resizeAt) * 10) / 10, paintMs: Math.round((rec.paintAt - rec.resizeAt) * 10) / 10, cssW: Math.round(rec.cssW * 10) / 10, backW: rec.backW, ratio: Math.round(rec.ratio * 1000) / 1000, syncAlpha: alpha });
  await page.setViewportSize({ width: 960, height: 720 });
  await page.waitForTimeout(400);
}
const hudAfter = await page.evaluate(() => ({ score: document.getElementById('hud-score').textContent, moves: document.getElementById('hud-moves').textContent, game: !document.getElementById('screen-game').classList.contains('hidden') }));
const thirdParty = reqs.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:'));
const pass = rows.every((r) => r.rebuildMs <= 200 && r.paintMs <= 200 && Math.abs(r.ratio - 1) < 0.01 && r.syncAlpha === 255) && !hasTestHook && errors.length === 0 && thirdParty.length === 0 && JSON.stringify(hudBefore) === JSON.stringify(hudAfter);
console.log('hasTestHook=' + hasTestHook, 'errors=' + JSON.stringify(errors), 'thirdParty=' + JSON.stringify(thirdParty));
console.log('hudBefore=' + JSON.stringify(hudBefore), 'hudAfter=' + JSON.stringify(hudAfter));
for (const r of rows) console.log(JSON.stringify(r));
console.log('RESULT', pass ? 'PASS' : 'FAIL');
await browser.close();
process.exit(pass ? 0 : 1);

