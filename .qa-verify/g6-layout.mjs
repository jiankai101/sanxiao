/**
 * G6 独立回归：BUG-001 绘制↔命中一致性（四视口 + 960x720 基线 + DPR）。
 * 方法：从 canvas 2D 绘制变换 (a,d,e,f) 反推「视觉格中心」CSS 点并点击，
 * 再读 __wmgTest.selected()。全程不复用输入层 cellPoint / screenToLogical 换算。
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5056/';
const OUT = '.qa-verify/out';
mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (id, cond, detail) => {
  results.push({ id, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'} ${id} :: ${detail}`);
};

const browser = await chromium.launch({ channel: 'chrome' });

async function openLevel(page, levelId) {
  await page.goto(`${BASE}?seed=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  await page.evaluate((id) => window.__wmgTest.startLevel(id), levelId);
  await page.waitForSelector('#screen-game:not(.hidden)');
  await page.waitForTimeout(500);
}

async function info(page) {
  return page.evaluate(() => {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    const t = c.getContext('2d').getTransform();
    return {
      left: r.left, top: r.top, w: r.width, h: r.height,
      cw: c.width, ch: c.height,
      a: t.a, b: t.b, c: t.c, d: t.d, e: t.e, f: t.f,
      dpr: window.devicePixelRatio,
    };
  });
}

/** 逻辑坐标 -> 页面 CSS 坐标，仅依据绘制变换与画布盒。 */
function visualCss(g, x, y) {
  return {
    x: g.left + (g.e + g.a * x + g.c * y) / g.dpr,
    y: g.top + (g.f + g.b * x + g.d * y) / g.dpr,
  };
}
const cellCenter = (g, row, col) => visualCss(g, 224 + (col - 0.5) * 64, 96 + (row - 0.5) * 64);

async function clickAt(page, p) {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(25);
}
const selected = (page) => page.evaluate(() => window.__wmgTest.selected());
const state = (page) => page.evaluate(() => window.__wmgTest.state());

const viewports = [
  { w: 960, h: 720, dpr: 1, baseline: true },
  { w: 1280, h: 800, dpr: 1 },
  { w: 600, h: 800, dpr: 1 },
  { w: 360, h: 640, dpr: 1 },
  { w: 320, h: 568, dpr: 1 },
  { w: 1280, h: 800, dpr: 2 },
  { w: 360, h: 640, dpr: 2 },
];

for (const vp of viewports) {
  const tag = `${vp.w}x${vp.h}@dpr${vp.dpr}`;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await openLevel(page, 1);
  const g = await info(page);

  // 1) 绘制变换：唯一留边来源是 CSS 居中 → e=f=0，a=d=scale*dpr
  const scaleCss = g.w / 960;
  ok(`REQ-040/origin-${tag}`,
    Math.abs(g.e) < 0.5 && Math.abs(g.f) < 0.5 && Math.abs(g.a - scaleCss * g.dpr) < 0.01 && Math.abs(g.a - g.d) < 1e-6,
    `e=${g.e.toFixed(3)} f=${g.f.toFixed(3)} a=${g.a.toFixed(5)} d=${g.d.toFixed(5)} 期望 a=${(scaleCss * g.dpr).toFixed(5)}`);

  // 2) 场景必须完整落在画布内（不裁切）
  const right = g.e + 960 * g.a;
  const bottom = g.f + 720 * g.d;
  ok(`REQ-041/fit-${tag}`, right <= g.cw + 0.5 && bottom <= g.ch + 0.5 && g.e >= -0.5 && g.f >= -0.5,
    `绘制范围 x[${g.e.toFixed(2)},${right.toFixed(2)}] y[${g.f.toFixed(2)},${bottom.toFixed(2)}] 画布 ${g.cw}x${g.ch}`);

  // 3) 棋盘投影矩形：224/96 起、边长 512*scale（CSS px）
  const bx = (g.e + 224 * g.a) / g.dpr;
  const by = (g.f + 96 * g.d) / g.dpr;
  const bw = 512 * g.a / g.dpr;
  ok(`REQ-040/board-rect-${tag}`,
    Math.abs(bx - 224 * scaleCss) <= 0.5 && Math.abs(by - 96 * scaleCss) <= 0.5 && Math.abs(bw - 512 * scaleCss) <= 0.5,
    `棋盘投影 (${bx.toFixed(2)},${by.toFixed(2)}) 边长 ${bw.toFixed(2)}；期望 (${(224 * scaleCss).toFixed(2)},${(96 * scaleCss).toFixed(2)}) 边长 ${(512 * scaleCss).toFixed(2)}`);

  // 4) 视觉四角 → 选中四角（0 格偏差）；不得 null
  const corners = [[1, 1], [1, 8], [8, 1], [8, 8]];
  const cornerOut = [];
  for (const [r, c] of corners) {
    await clickAt(page, cellCenter(g, r, c));
    const sel = await selected(page);
    cornerOut.push(`(${r},${c})->${sel ? `(${sel.row},${sel.col})` : 'null'}`);
    if (sel) { await clickAt(page, cellCenter(g, r, c)); } // 取消选中，隔离下一次点击
  }
  ok(`REQ-049/corners-${tag}`,
    cornerOut.every((s, i) => s === `(${corners[i][0]},${corners[i][1]})->(${corners[i][0]},${corners[i][1]})`),
    cornerOut.join(' '));

  // 5) 全部 64 格：绘制变换点视觉中心 → 选中同一格
  let mismatch = 0;
  let nulls = 0;
  const bad = [];
  for (let r = 1; r <= 8; r += 1) {
    for (let c = 1; c <= 8; c += 1) {
      const p = cellCenter(g, r, c);
      const inside = p.x >= g.left && p.x <= g.left + g.w && p.y >= g.top && p.y <= g.top + g.h;
      await clickAt(page, p);
      const sel = await selected(page);
      if (!sel) { nulls += 1; if (!inside) bad.push(`(${r},${c}) 越界`); }
      else if (sel.row !== r || sel.col !== c) { mismatch += 1; bad.push(`(${r},${c})->(${sel.row},${sel.col})`); }
      if (sel) await clickAt(page, p);
    }
  }
  ok(`REQ-049/all64-${tag}`, mismatch === 0 && nulls === 0,
    `64 格点击：错格 ${mismatch}，null ${nulls}${bad.length ? '；示例 ' + bad.slice(0, 5).join(' ') : ''}`);

  // 6) 棋盘投影矩形外点击 → 不选中
  await clickAt(page, visualCss(g, 60, 60));
  ok(`REQ-049/outside-${tag}`, (await selected(page)) === null, '棋盘外（逻辑 60,60）点击后 selected=null');

  // 7) 拖拽阈值：0.4 格 = 点击选中；有效相邻拖拽 → 扣 1 步
  const before = await state(page);
  const c44 = cellCenter(g, 4, 4);
  const cellCss = 64 * scaleCss;
  await page.mouse.move(c44.x, c44.y);
  await page.mouse.down();
  await page.mouse.move(c44.x + cellCss * 0.4, c44.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  const selSmall = await selected(page);
  const afterSmall = await state(page);
  ok(`REQ-049/threshold-${tag}`,
    selSmall && selSmall.row === 4 && selSmall.col === 4 && afterSmall.movesLeft === before.movesLeft,
    `0.4 格拖拽 → selected=${selSmall ? `(${selSmall.row},${selSmall.col})` : 'null'}，步数 ${before.movesLeft}→${afterSmall.movesLeft}`);

  const move = await page.evaluate(() => window.__wmgTest.findMove());
  if (move) {
    const p1 = cellCenter(g, move.a.row, move.a.col);
    const p2 = cellCenter(g, move.b.row, move.b.col);
    await page.mouse.move(p1.x, p1.y);
    await page.mouse.down();
    await page.mouse.move(p2.x, p2.y, { steps: 8 });
    await page.mouse.up();
    for (let k = 0; k < 80; k += 1) {
      const cur = await state(page);
      if (cur.status !== 'settling' && cur.movesLeft === afterSmall.movesLeft - 1) break;
      if (cur.status === 'won' || cur.status === 'lost') break;
      await page.waitForTimeout(50);
    }
    const afterDrag = await state(page);
    ok(`REQ-003/drag-${tag}`, afterDrag.movesLeft === afterSmall.movesLeft - 1,
      `视觉拖动 (${move.a.row},${move.a.col})->(${move.b.row},${move.b.col}) 后步数 ${afterSmall.movesLeft}→${afterDrag.movesLeft}，status=${afterDrag.status}`);
  } else {
    ok(`REQ-003/drag-${tag}`, false, 'findMove() 返回 null，无法构造有效拖拽');
  }

  ok(`REQ-051/pageerror-${tag}`, pageErrors.length === 0, `pageerror=${JSON.stringify(pageErrors)}`);
  await page.screenshot({ path: `${OUT}/g6-layout-${vp.w}x${vp.h}-dpr${vp.dpr}.png` });
  await ctx.close();
}

// 8) 第 8 关：石块/死格点击忽略（REQ-049 失败路径）
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await openLevel(page, 8);
  const g = await info(page);
  const hole = cellCenter(g, 3, 3);
  await clickAt(page, hole);
  const selHole = await selected(page);
  const stone = cellCenter(g, 2, 3);
  await clickAt(page, stone);
  const selStone = await selected(page);
  const normal = cellCenter(g, 1, 1);
  await clickAt(page, normal);
  const selNormal = await selected(page);
  ok('REQ-049/obstacle-ignore',
    selHole === null && selStone === null && selNormal && selNormal.row === 1 && selNormal.col === 1,
    `死格(3,3)->${selHole ? 'selected' : 'null'}，石块(2,3)->${selStone ? 'selected' : 'null'}，普通格(1,1)->${selNormal ? `(${selNormal.row},${selNormal.col})` : 'null'}`);
  await page.screenshot({ path: `${OUT}/g6-level8-obstacles.png` });
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\nSUMMARY total=${results.length} pass=${results.length - failed.length} fail=${failed.length}`);
for (const f of failed) console.log('FAILED:', f.id, '::', f.detail);
process.exit(failed.length ? 1 : 0);
