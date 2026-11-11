/** G6 独立回归：BUG-002 死局重排（第 8 关 seed=1 五步复现序列，真实鼠标拖拽，视觉坐标取自绘制变换）。 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = 'http://127.0.0.1:5056/';
mkdirSync('.qa-verify/out', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}?seed=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
await page.evaluate(() => window.__wmgTest.startLevel(8));
await page.waitForSelector('#screen-game:not(.hidden)');
await page.waitForTimeout(500);

const g = await page.evaluate(() => {
  const c = document.getElementById('game');
  const r = c.getBoundingClientRect();
  const t = c.getContext('2d').getTransform();
  return { left: r.left, top: r.top, a: t.a, e: t.e, f: t.f, dpr: devicePixelRatio };
});
const pt = (row, col) => ({
  x: g.left + (g.e + (224 + (col - 0.5) * 64) * g.a) / g.dpr,
  y: g.top + (g.f + (96 + (row - 0.5) * 64) * g.a) / g.dpr,
});
const state = () => page.evaluate(() => window.__wmgTest.state());
const findMove = () => page.evaluate(() => window.__wmgTest.findMove());
const shuffles = () => page.evaluate(() => window.__wmgTest.shuffleEvents());

async function drag(a, b) {
  const p1 = pt(a.row, a.col), p2 = pt(b.row, b.col);
  const before = await state();
  await page.mouse.move(p1.x, p1.y);
  await page.mouse.down();
  await page.mouse.move(p2.x, p2.y, { steps: 8 });
  await page.mouse.up();
  for (let k = 0; k < 120; k += 1) {
    const cur = await state();
    if (cur.status === 'won' || cur.status === 'lost') return cur;
    if (cur.status !== 'settling' && cur.movesLeft === before.movesLeft - 1) break;
    await page.waitForTimeout(50);
  }
  return state();
}

const start = await state();
const seq = [
  [{ row: 1, col: 2 }, { row: 1, col: 3 }],
  [{ row: 3, col: 5 }, { row: 4, col: 5 }],
  [{ row: 1, col: 6 }, { row: 1, col: 7 }],
  [{ row: 1, col: 6 }, { row: 2, col: 6 }],
  [{ row: 1, col: 3 }, { row: 1, col: 4 }],
];
const log = [];
for (const [a, b] of seq) {
  const st = await drag(a, b);
  const sh = await shuffles();
  const mv = await findMove();
  log.push({ move: `(${a.row},${a.col})->(${b.row},${b.col})`, status: st.status, movesLeft: st.movesLeft, score: st.score, shuffles: sh, findMove: mv ? `${mv.a.row},${mv.a.col}->${mv.b.row},${mv.b.col}` : null });
  console.log('STEP', JSON.stringify(log[log.length - 1]));
  await page.waitForTimeout(120);
}
const after = await state();
const toast = (await page.locator('#toast-root').textContent().catch(() => '')) ?? '';
const sh = await shuffles();
const mv = await findMove();
console.log('AFTER', JSON.stringify({ start, after, shuffles: sh, findMove: mv, toast }));

const checks = [];
const chk = (id, cond, detail) => { checks.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id} :: ${detail}`); };

chk('REQ-016/deadlock-detected-shuffled', sh >= 1, `5 步后 shuffle 事件数=${sh}（期望 ≥1）`);
chk('REQ-016/still-playing', after.status === 'playing', `status=${after.status}`);
chk('REQ-016/no-step-cost', after.movesLeft === start.movesLeft - 5, `步数 ${start.movesLeft}->${after.movesLeft}（5 次有效交换应只扣 5 步）`);
chk('REQ-016/has-move-after-shuffle', mv !== null, `重排后 findMove=${JSON.stringify(mv)}`);
chk('REQ-016/toast', toast.includes('无可消除步骤，已重排'), `toast=${JSON.stringify(toast.trim())}`);
await page.screenshot({ path: '.qa-verify/out/g6-shuffle-level8.png' });

// 继续对局：再用视觉坐标拖一次 findMove
if (mv) {
  const st2 = await drag(mv.a, mv.b);
  chk('REQ-016/playable-after-shuffle', st2.movesLeft === after.movesLeft - 1 && ['playing', 'won', 'lost'].includes(st2.status),
    `重排后继续交换 ${JSON.stringify(mv)}：步数 ${after.movesLeft}->${st2.movesLeft}，status=${st2.status}`);
} else {
  chk('REQ-016/playable-after-shuffle', false, '重排后无可行步，无法继续');
}

chk('REQ-051/pageerror', errors.length === 0, `pageerror=${JSON.stringify(errors)}`);
await browser.close();
const failed = checks.filter((c) => !c.pass);
console.log(`SUMMARY total=${checks.length} pass=${checks.length - failed.length} fail=${failed.length}`);
process.exit(failed.length ? 1 : 0);
