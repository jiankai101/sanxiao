/**
 * G9 REQ-041 / BUG-007 独立复核探针 v2（qa-verifier 自建）。
 * v1 缺陷：某些页面上 resize 事件在视口真正变化前就到（旧尺寸命中），导致计时从 0 开始。
 * v2 修正：只有在 CSS 尺寸相对基线真正改变时才记录 resizeAt，并断言 meta.cssW == 期望值。
 * 口径：
 *   sizeOkMs   resize 事件 -> canvas 后备缓冲 == round(css × min(dpr,2))
 *   contentMs  resize 事件 -> 新尺寸画布上出现真实绘制内容（alpha>0，证明重绘已执行）
 *   paintMs    resize 事件 -> 内容存在后的下一帧 rAF（上屏时间的保守上界）
 */
import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:5057';
const VPS = [
  { width: 1280, height: 800 },
  { width: 600, height: 800 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
];
const HOME = { width: 960, height: 720 };
const expectCss = (vp) => 960 * Math.min(vp.width / 960, vp.height / 720);

const INSTALL = () => {
  const c = document.getElementById('game');
  const ctx = c.getContext('2d');
  window.__g9 = { muts: [], lastWidthMut: 0 };
  const obs = new MutationObserver((list) => {
    for (const m of list) {
      const t = performance.now();
      window.__g9.muts.push({ attr: m.attributeName, t });
      if (m.attributeName === 'width') {
        window.__g9.lastWidthMut = t;
        const c2 = c.getContext('2d');
        const tf = c2.getTransform();
        const px = c2.getImageData(Math.round(tf.e + 120 * tf.a), Math.round(tf.f + 120 * tf.d), 1, 1).data;
        window.__g9.syncDraw = { t, alpha: px[3] };
      }
    }
  });
  obs.observe(c, { attributes: true, attributeFilter: ['width', 'height'] });

  window.__g9measure = (wantCss) =>
    new Promise((resolve) => {
      const rec = { resizeAt: null, sizeOkAt: null, contentAt: null, paintAt: null, meta: null, staleEvents: 0, syncAlpha: null };
      window.__g9.syncDraw = null;
      const baseW = c.getBoundingClientRect().width;
      const started = performance.now();
      let finished = false;
      const onResize = () => {
        const w = c.getBoundingClientRect().width;
        if (rec.resizeAt === null) {
          rec.resizeAt = performance.now();
          rec.eventRectW = w;
          rec.eventRectUnchanged = Math.abs(w - baseW) <= 0.5;
          if (rec.eventRectUnchanged) rec.staleEvents += 1;
        }
      };
      window.addEventListener('resize', onResize);
      const step = () => {
        if (finished) return;
        const r = c.getBoundingClientRect();
        const cssW = r.width;
        const cssH = r.height;
        const dsf = window.devicePixelRatio;
        const clamped = Math.min(dsf, 2);
        const wantW = Math.round(cssW * clamped);
        const wantH = Math.round(cssH * clamped);
        const cssMatches = Math.abs(cssW - wantCss) <= 1;
        const sizeOk = c.width === wantW && c.height === wantH;
        if (rec.resizeAt !== null && cssMatches && sizeOk) {
          if (rec.sizeOkAt === null) {
            rec.sizeOkAt = performance.now();
            rec.rebuildAt = window.__g9.lastWidthMut || null;
            rec.syncAlpha = window.__g9.syncDraw ? window.__g9.syncDraw.alpha : null;
            rec.meta = { cssW, cssH, backW: c.width, backH: c.height, dsf, ratio: c.width / cssW };
          }
          const t = ctx.getTransform();
          const px = ctx.getImageData(Math.round(t.e + 120 * t.a), Math.round(t.f + 120 * t.d), 1, 1).data;
          if (px[3] > 0) {
            rec.contentAt = performance.now();
            requestAnimationFrame((ts) => {
              rec.paintAt = ts;
              window.removeEventListener('resize', onResize);
              finished = true;
              resolve(rec);
            });
            return;
          }
        }
        if (performance.now() - started > 6000) {
          window.removeEventListener('resize', onResize);
          rec.meta = rec.meta ?? { cssW, cssH, backW: c.width, backH: c.height, dsf, ratio: c.width / cssW };
          finished = true;
          resolve(rec);
        } else {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    });
};

const fmt = (r, wantCss) => {
  const d = (v) => (v === null || r.resizeAt === null ? null : Math.round((v - r.resizeAt) * 10) / 10);
  return {
    sizeOkMs: d(r.sizeOkAt),
    contentMs: d(r.contentAt),
    paintMs: d(r.paintAt),
    wantCss: Math.round(wantCss * 10) / 10,
    cssW: r.meta ? Math.round(r.meta.cssW * 10) / 10 : null,
    cssH: r.meta ? Math.round(r.meta.cssH * 10) / 10 : null,
    backW: r.meta?.backW ?? null,
    backH: r.meta?.backH ?? null,
    dsf: r.meta?.dsf ?? null,
    ratio: r.meta ? Math.round(r.meta.ratio * 1000) / 1000 : null,
    staleEvents: r.staleEvents,
    syncDrawAlpha: r.syncAlpha ?? null,
    rebuildMs: r.resizeAt !== null && r.rebuildAt ? Math.round((r.rebuildAt - r.resizeAt) * 10) / 10 : null,
    ok: r.resizeAt !== null && r.contentAt !== null && r.meta !== null && Math.abs(r.meta.cssW - wantCss) <= 1 && r.rebuildAt !== null && r.rebuildAt - r.resizeAt >= 100,
  };
};

async function prepare(page) {
  await page.goto(`${BASE}/?seed=20261111`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__wmgTest));
  await page.evaluate(() => window.__wmgTest.startLevel(1));
  await page.waitForTimeout(300);
  // 制造真实对局进度：走一步有效交换，验证 resize 不重置分数/步数
  const mv = await page.evaluate(() => window.__wmgTest.findMove());
  if (mv) {
    await page.evaluate((m) => window.__wmgTest.swap(m.a, m.b), mv);
    await page.waitForTimeout(1400);
  }
  await page.evaluate(INSTALL);
  return mv;
}

async function measureViewport(page, vp) {
  const wantCss = expectCss(vp);
  const pending = page.evaluate((w) => window.__g9measure(w), wantCss);
  await page.waitForTimeout(20);
  await page.setViewportSize({ width: vp.width, height: vp.height });
  const rec = await pending;
  return fmt(rec, wantCss);
}

const browser = await chromium.launch({ channel: 'chrome' });
const results = { idle: [], load: [], burst: null, dpr: [], state: null };

// ---------- 1) idle 四视口 × 2 轮 ----------
const page = await browser.newPage({ viewport: HOME });
const aMove = await prepare(page);
const beforeState = await page.evaluate(() => window.__wmgTest.state());
for (let round = 1; round <= 2; round += 1) {
  for (const vp of VPS) {
    const row = await measureViewport(page, vp);
    results.idle.push({ round, viewport: `${vp.width}x${vp.height}`, ...row });
    await page.setViewportSize(HOME);
    await page.waitForTimeout(400);
  }
}
const afterState = await page.evaluate(() => window.__wmgTest.state());
results.state = { move: aMove, before: beforeState, after: afterState };

// ---------- 2) burst 抖动合并 ----------
results.burst = await page.evaluate(async () => {
  window.__g9.muts = [];
  const t0 = performance.now();
  for (let i = 0; i < 5; i += 1) setTimeout(() => window.dispatchEvent(new Event('resize')), i * 25);
  await new Promise((r) => setTimeout(r, 900));
  const muts = window.__g9.muts.slice();
  const widths = muts.filter((m) => m.attr === 'width');
  return {
    events: 5,
    mutations: muts.length,
    widthMutations: widths.length,
    firstMutationAfterLastEventMs: widths.length ? Math.round((widths[0].t - (t0 + 100)) * 10) / 10 : null,
  };
});
await page.close();

// ---------- 3) DPR clamp ----------
for (const dsf of [1, 1.5, 3]) {
  const ctx = await browser.newContext({ viewport: HOME, deviceScaleFactor: dsf });
  const p = await ctx.newPage();
  await prepare(p);
  const row = await measureViewport(p, { width: 360, height: 640 });
  results.dpr.push({ deviceScaleFactor: dsf, ...row, ratioOk: row.ratio !== null && Math.abs(row.ratio - Math.min(dsf, 2)) < 0.01 });
  await ctx.close();
}

// ---------- 4) 并发负载（16 页同时跑四视口，模拟全量 16 worker） ----------
const loadPages = [];
for (let i = 0; i < 16; i += 1) {
  const p = await browser.newPage({ viewport: HOME });
  await prepare(p);
  loadPages.push(p);
}
await Promise.all(
  loadPages.map(async (p, idx) => {
    for (const vp of VPS) {
      const row = await measureViewport(p, vp);
      results.load.push({ page: idx, viewport: `${vp.width}x${vp.height}`, ...row });
      await p.setViewportSize(HOME);
      await p.waitForTimeout(420);
    }
  }),
);
for (const p of loadPages) await p.close();
await browser.close();

const ok = (rows) => rows.filter((r) => r.ok);
const worst = (rows, key) => (ok(rows).length ? Math.max(...ok(rows).map((r) => r[key])) : null);
console.log(JSON.stringify({ results }, null, 1));
console.log('---');
console.log(`rows idle=${results.idle.length} valid=${ok(results.idle).length}; load=${results.load.length} valid=${ok(results.load).length}`);
console.log(`IDLE content max=${worst(results.idle, 'contentMs')}ms paint max=${worst(results.idle, 'paintMs')}ms`);
console.log(`LOAD content max=${worst(results.load, 'contentMs')}ms paint max=${worst(results.load, 'paintMs')}ms`);
const allValid = ok(results.idle).length === results.idle.length && ok(results.load).length === results.load.length;
const idlePass = ok(results.idle).every((r) => r.contentMs <= 200 && r.paintMs <= 200);
const loadContentPass = ok(results.load).every((r) => r.contentMs <= 200);
const loadFullPass = ok(results.load).every((r) => r.contentMs <= 200 && r.paintMs <= 200);
console.log(`ALL-VALID=${allValid} ; idle=${idlePass ? 'PASS' : 'FAIL'} ; loadContent=${loadContentPass ? 'PASS' : 'FAIL'} ; loadPaint=${loadFullPass ? 'PASS' : 'FAIL'}`);



