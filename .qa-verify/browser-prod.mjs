/** G5 浏览器独立验收：生产构建 dist/ 静态托管（无 __wmgTest 钩子）。 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5055/';
const OUT = '.qa-verify/out';
mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (id, cond, detail) => {
  results.push({ id, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'} ${id} :: ${detail}`);
};
const COLS = { star: [242, 194, 48], water: [58, 160, 232], leaf: [87, 194, 74], flame: [232, 80, 58], crystal: [155, 89, 208], bolt: [35, 196, 196] };

const browser = await chromium.launch({ channel: 'chrome' });

async function openLevel1(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
  await page.waitForSelector('#screen-game:not(.hidden)');
  await page.waitForTimeout(600);
}
const hud = async (page) => ({
  score: Number(await page.locator('#hud-score').textContent()),
  moves: Number(await page.locator('#hud-moves').textContent()),
  live: (await page.locator('#game-live').textContent()) ?? '',
});

/** 读取棋盘：按 canvas 变换（即"实际画出来的位置"）采样每一格。 */
async function readBoard(page) {
  return page.evaluate((COLS) => {
    const c = document.getElementById('game');
    const ctx = c.getContext('2d');
    const t = ctx.getTransform();
    const bg = [17, 40, 55];
    const grid = [];
    for (let row = 1; row <= 8; row += 1) {
      const line = [];
      for (let col = 1; col <= 8; col += 1) {
        const counts = new Map();
        for (let dx = -20; dx <= 20; dx += 2) {
          for (let dy = -20; dy <= 20; dy += 2) {
            const x = Math.round(t.e + (224 + (col - 0.5) * 64 + dx) * t.a);
            const y = Math.round(t.f + (96 + (row - 0.5) * 64 + dy) * t.a);
            if (x < 0 || y < 0 || x >= c.width || y >= c.height) continue;
            const p = ctx.getImageData(x, y, 1, 1).data;
            if (p[3] < 200) continue;
            const dist = Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]);
            if (dist < 55) continue;
            let kind = null; let min = Infinity;
            for (const [name, rgb] of Object.entries(COLS)) {
              const d = Math.hypot(p[0] - rgb[0], p[1] - rgb[1], p[2] - rgb[2]);
              if (d < min) { min = d; kind = name; }
            }
            if (min > 90) continue;
            counts.set(kind, (counts.get(kind) || 0) + 1);
          }
        }
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        line.push(top && top[1] >= 20 ? top[0] : null);
      }
      grid.push(line);
    }
    return grid;
  }, COLS);
}

function hasTripleAfterSwap(g, r1, c1, r2, c2) {
  const b = g.map((row) => row.slice());
  const t = b[r1][c1]; b[r1][c1] = b[r2][c2]; b[r2][c2] = t;
  for (let r = 0; r < 8; r += 1) for (let c = 0; c < 6; c += 1) {
    const v = b[r][c];
    if (v && v === b[r][c + 1] && v === b[r][c + 2]) return true;
  }
  for (let c = 0; c < 8; c += 1) for (let r = 0; r < 6; r += 1) {
    const v = b[r][c];
    if (v && v === b[r + 1][c] && v === b[r + 2][c]) return true;
  }
  return false;
}

/** 点击坐标 = 画布矩形等比换算（输入层约定）。 */
async function clickCell(page, row, col) {
  const g = await page.evaluate(() => {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  });
  const s = g.w / 960;
  return { x: g.left + (224 + (col - 0.5) * 64) * s, y: g.top + (96 + (row - 0.5) * 64) * s };
}

async function drag(page, a, b) {
  const p1 = await clickCell(page, a[0], a[1]);
  const p2 = await clickCell(page, b[0], b[1]);
  await page.mouse.move(p1.x, p1.y);
  await page.mouse.down();
  await page.mouse.move(p2.x, p2.y, { steps: 8 });
  await page.mouse.up();
}

// ============ A. 960x720（4:3，无 letterbox）核心玩法 ============
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
  const page = await ctx.newPage();
  const requests = []; const errors = []; const consoleErrors = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('requestfailed', (r) => errors.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await openLevel1(page);
  ok('REQ-051/static', await page.locator('#screen-level-select').count() === 1, 'dist/ 由纯静态服务器(python http.server)托管并完成首屏渲染');
  ok('REQ-021/unlock', (await page.locator('#screen-level-select .level-card.locked').count()) === 7, '初始仅第 1 关解锁（8 卡 / 锁 7 张）');
  const thirdParty = requests.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:'));
  ok('REQ-034/051/network', thirdParty.length === 0, `第三方请求数=${thirdParty.length}，总请求=${requests.length}`);

  let h = await hud(page);
  ok('REQ-001/HUD', h.moves === 20 && h.score === 0, `第 1 关初始 分数=${h.score} 步数=${h.moves}`);

  const grid = await readBoard(page);
  const kinds = new Set(grid.flat().filter(Boolean));
  const nulls = grid.flat().filter((v) => !v).length;
  ok('REQ-040/render', nulls === 0 && kinds.size === 6, `64 格全部识别：6 种元素，未识别 ${nulls} 格`);
  await page.screenshot({ path: `${OUT}/A1-board-960.png` });

  let cand = null;
  for (let r = 0; r < 8 && !cand; r += 1) for (let c = 0; c < 8 && !cand; c += 1) {
    if (c < 7 && hasTripleAfterSwap(grid, r, c, r, c + 1)) cand = [[r + 1, c + 1], [r + 1, c + 2]];
    else if (r < 7 && hasTripleAfterSwap(grid, r, c, r + 1, c)) cand = [[r + 1, c + 1], [r + 2, c + 1]];
  }
  ok('REQ-005/probe', !!cand, `按 spec REQ-005 自算的有效交换=${JSON.stringify(cand)}`);
  await drag(page, cand[0], cand[1]);
  let after = null;
  for (let i = 0; i < 50; i += 1) { const cur = await hud(page); if (cur.moves === 19) { after = cur; break; } await page.waitForTimeout(100); }
  ok('REQ-003/REQ-015', after !== null, `拖动相邻交换：步数 20 → ${after ? after.moves : '未变化'}`);
  ok('REQ-014', after !== null && after.score > 0 && Number.isInteger(after.score), `分数 0 → ${after ? after.score : 'n/a'}（整数）`);
  const m = after?.live.match(/^分数 (\d+)，剩余步数 (\d+)，目标 (.+)$/);
  ok('REQ-050', !!m && Number(m[1]) === after.score && Number(m[2]) === after.moves, `aria-live = ${JSON.stringify(after?.live)}`);
  await page.screenshot({ path: `${OUT}/A2-after-swap.png` });

  // 无效输入：矩形外点击 / 非相邻两段点击
  const base = await hud(page);
  const box = await page.locator('#game').boundingBox();
  await page.mouse.click(box.x + 20, box.y + 20);
  await page.waitForTimeout(300);
  let cur = await hud(page);
  ok('REQ-049/outside', cur.moves === base.moves && cur.score === base.score, `棋盘投影矩形外点击：步数 ${base.moves}→${cur.moves}，分数 ${base.score}→${cur.score}`);
  const p11 = await clickCell(page, 1, 1); const p33 = await clickCell(page, 3, 3);
  await page.mouse.click(p11.x, p11.y); await page.mouse.click(p33.x, p33.y);
  await page.waitForTimeout(300);
  cur = await hud(page);
  ok('REQ-004/nonadj', cur.moves === base.moves && cur.score === base.score, `非相邻两段点击：步数 ${base.moves}→${cur.moves}（不交换/不扣步）`);
  // 再次点击同一格取消选中：不扣步
  await page.mouse.click(p11.x, p11.y); await page.mouse.click(p11.x, p11.y);
  await page.waitForTimeout(200);
  cur = await hud(page);
  ok('REQ-003/deselect', cur.moves === base.moves, `点击已选格取消选中，步数保持 ${cur.moves}`);

  // 缩放：状态不重置
  const beforeResize = await hud(page);
  for (const v of [{ w: 600, h: 800 }, { w: 360, h: 640 }, { w: 320, h: 568 }]) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await page.waitForTimeout(420);
    const c2 = await hud(page);
    ok(`REQ-041/state-${v.w}`, c2.moves === beforeResize.moves && c2.score === beforeResize.score,
      `缩放到 ${v.w}×${v.h} 后分数/步数保持（${c2.score}/${c2.moves}）`);
  }
  await page.setViewportSize({ width: 960, height: 720 });
  await page.waitForTimeout(300);

  // 刷新：不恢复对局、保留进度、一次中断提示
  const raw = await page.evaluate(() => localStorage.getItem('wmg.save.v1'));
  const parsed = JSON.parse(raw);
  ok('REQ-030/flag', parsed.lastSessionInterrupted === true, `对局中 lastSessionInterrupted=${parsed.lastSessionInterrupted}`);
  ok('REQ-030/no-snapshot', !('board' in parsed) && !('score' in parsed) && !('movesLeft' in parsed) && !('cascade' in parsed),
    `存档键=${Object.keys(parsed).join(',')}`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  const t1 = await page.locator('#toast-root .toast').textContent().catch(() => '');
  ok('REQ-030/E-04', (await page.locator('#screen-level-select').isVisible()) && (t1 ?? '').includes('上一局已中断'),
    `刷新后回到选关、提示=${JSON.stringify(t1)}（不恢复对局）`);
  ok('REQ-030/flag-reset', JSON.parse(await page.evaluate(() => localStorage.getItem('wmg.save.v1'))).lastSessionInterrupted === false, '提示后立即写回 false');
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(400);
  const t2 = await page.locator('#toast-root .toast').textContent().catch(() => '');
  ok('REQ-030/once', !(t2 ?? '').includes('上一局已中断'), `同一会话二次进入不重复提示（toast=${JSON.stringify(t2)}）`);

  // 存档损坏
  await page.evaluate(() => localStorage.setItem('wmg.save.v1', '{"saveVersion":1,"unlockedLevelId":oops'));
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  const t3 = await page.locator('#toast-root .toast').textContent().catch(() => '');
  ok('REQ-031/toast', (t3 ?? '').includes('存档已重置'), `损坏提示=${JSON.stringify(t3)}`);
  const backups = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('wmg.backup.save.')));
  ok('REQ-031/backup', backups.length === 1, `备份键=${JSON.stringify(backups)}`);
  await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
  await page.waitForSelector('#screen-game:not(.hidden)');
  ok('REQ-031/playable', (await hud(page)).moves === 20, '损坏后仍可正常进入第 1 关（步数 20）');
  await page.screenshot({ path: `${OUT}/A3-corrupt-recovered.png` });

  ok('REQ-051/pageerror', errors.length === 0, `pageerror/requestfailed=${JSON.stringify(errors)}`);
  ok('REQ-051/console', consoleErrors.length === 0, `console.error=${JSON.stringify(consoleErrors)}`);
  await ctx.close();
}

// ============ B. 布局一致性（REQ-040/REQ-041/REQ-049/E-05） ============
{
  for (const vp of [{ w: 960, h: 720 }, { w: 1280, h: 800 }, { w: 600, h: 800 }, { w: 360, h: 640 }, { w: 320, h: 568 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await openLevel1(page);
    const g = await page.evaluate(() => {
      const c = document.getElementById('game');
      const r = c.getBoundingClientRect();
      const t = c.getContext('2d').getTransform();
      return { left: r.left, top: r.top, w: r.width, h: r.height, a: t.a, e: t.e, f: t.f, cw: c.width, ch: c.height };
    });
    const expectedScale = g.w / 960;
    const drawnRight = g.e + 960 * g.a;
    const drawnBottom = g.f + 720 * g.a;
    const aligned = Math.abs(g.e) < 0.5 && Math.abs(g.f) < 0.5;
    const fits = drawnRight <= g.cw + 0.5 && drawnBottom <= g.ch + 0.5;
    ok(`REQ-040/align-${vp.w}x${vp.h}`, aligned,
      `画布盒 ${g.w.toFixed(1)}×${g.h.toFixed(1)} @(${g.left.toFixed(1)},${g.top.toFixed(1)})，绘制变换 e=${g.e.toFixed(1)} f=${g.f.toFixed(1)}；棋盘左上应在画布内 (${(224 * expectedScale).toFixed(1)},${(96 * expectedScale).toFixed(1)})，实际 (${(g.e + 224 * g.a).toFixed(1)},${(g.f + 96 * g.a).toFixed(1)})`);
    ok(`REQ-041/fit-${vp.w}x${vp.h}`, fits,
      `场景绘制范围 0..${drawnRight.toFixed(1)} × 0..${drawnBottom.toFixed(1)}，画布 ${g.cw}×${g.ch}${fits ? '' : '（超出部分被裁掉）'}`);
    if (!fits || !aligned) await page.screenshot({ path: `${OUT}/B-layout-${vp.w}x${vp.h}.png` });
    await ctx.close();
  }
}

// ============ C. DPR 上限 ============
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  const i = await page.evaluate(() => {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    return { w: c.width, h: c.height, cssW: r.width, cssH: r.height, dpr: devicePixelRatio };
  });
  ok('REQ-041/DPR', Math.abs(i.w - i.cssW * Math.min(i.dpr, 2)) < 2 && Math.abs(i.h - i.cssH * Math.min(i.dpr, 2)) < 2,
    `dpr=${i.dpr}：backing ${i.w}×${i.h} = CSS ${i.cssW.toFixed(1)}×${i.cssH.toFixed(1)} × min(dpr,2)`);
  await ctx.close();
}

// ============ D. localStorage 不可用 ============
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  const bar = await page.locator('#toast-root .storage-bar').textContent().catch(() => '');
  ok('REQ-032/banner', (bar ?? '').includes('当前为临时存档，刷新将丢失进度'), `常驻提示条=${JSON.stringify(bar)}`);
  await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
  await page.waitForSelector('#screen-game:not(.hidden)');
  ok('REQ-032/playable', (await hud(page)).moves === 20 && errs.length === 0, `无 localStorage 仍可开局，pageerror=${errs.length}`);
  await page.screenshot({ path: `${OUT}/D-temporary-storage.png` });
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\nSUMMARY total=${results.length} pass=${results.length - failed.length} fail=${failed.length}`);
for (const f of failed) console.log('FAILED:', f.id, '::', f.detail);
process.exit(failed.length ? 1 : 0);
