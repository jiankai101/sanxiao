/** G8 REQ-041 精确计时 v2：resize 事件 → canvas 后备缓冲尺寸到位 → 下一帧 rAF（4 轮）。 */
import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 960, height: 720 } });
await p.goto('http://127.0.0.1:5057/?seed=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
const cycles = [ { w: 360, h: 640 }, { w: 600, h: 800 }, { w: 1280, h: 800 }, { w: 320, h: 568 } ];
const rows = [];
for (const vp of cycles) {
  await p.evaluate((target) => {
    const c = document.getElementById('game');
    const dpr = Math.min(window.devicePixelRatio, 2);
    const expectCss = Math.min(target.w, (target.h * 4) / 3);
    const expectCW = Math.round(expectCss * dpr);
    window.__rz = { resize: performance.now(), attr: null, paint: null, cw: null, cssW: null, expectCW };
    const t0 = performance.now();
    const tick = () => {
      const cssW = c.getBoundingClientRect().width;
      if (Math.abs(cssW - expectCss) <= 0.5 && c.width === expectCW) {
        window.__rz.attr = performance.now();
        window.__rz.cssW = cssW;
        window.__rz.cw = c.width;
        requestAnimationFrame(() => { window.__rz.paint = performance.now(); });
        return;
      }
      if (performance.now() - t0 > 3000) return;
      setTimeout(tick, 2);
    };
    setTimeout(tick, 2);
  }, vp);
  // resize 计时从 setViewportSize 触发的页面 resize 事件开始（页面内先记录 t0 不可靠），这里用事件时间：
  await p.evaluate(() => { window.__rz.resize = null; window.addEventListener('resize', () => { if (window.__rz.resize === null) window.__rz.resize = performance.now(); }, { once: true }); });
  await p.setViewportSize({ width: vp.w, height: vp.h });
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => window.__rz);
  const row = { ...r, dAttr: r.resize !== null && r.attr !== null ? r.attr - r.resize : null, dPaint: r.resize !== null && r.paint !== null ? r.paint - r.resize : null };
  rows.push(row);
  console.log(vp.w + 'x' + vp.h, JSON.stringify({ dAttr: row.dAttr, dPaint: row.dPaint, cw: row.cw, expectCW: row.expectCW, cssW: row.cssW }));
}
const pass = rows.every((r) => r.dAttr !== null && r.dPaint !== null && r.dAttr <= 200 && r.cw === r.expectCW);
console.log('MAX attr delta', Math.max(...rows.map((r) => r.dAttr)).toFixed(1) + 'ms', '| MAX paint delta', Math.max(...rows.map((r) => r.dPaint)).toFixed(1) + 'ms');
console.log('RESULT', pass ? 'PASS' : 'FAIL');
await b.close();

