/** G6 独立回归：REQ-042 图片资源缺失降级（拦截 dist 中真实外置的 WebP，而非被内联的贴图）。
 *  注意：tile-*.webp 体积 < 4KB 会被 Vite 内联为 data URI，无法通过路由拦截，
 *  因此本轮拦截 4 个外置资源：bg-main / board-frame / fx-clear / ui-panel。 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = 'http://127.0.0.1:5055/';
mkdirSync('.qa-verify/out', { recursive: true });
const checks = [];
const ok = (id, cond, detail) => { checks.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id} :: ${detail}`); };
const COLS = { star: [242, 194, 48], water: [58, 160, 232], leaf: [87, 194, 74], flame: [232, 80, 58], crystal: [155, 89, 208], bolt: [35, 196, 196] };

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await ctx.newPage();
const warns = []; const errs = [];
page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));
await page.route('**/*.webp', (route) => route.abort());
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
await page.waitForSelector('#screen-game:not(.hidden)');
await page.waitForTimeout(1200);

const assetWarns = warns.filter((w) => w.includes('[assets]'));
ok('REQ-042/warn-exactly-once', assetWarns.length === 1, `[assets] console.warn 次数=${assetWarns.length}（规格：仅 1 次）${assetWarns.length ? '：' + JSON.stringify(assetWarns) : ''}`);
ok('REQ-042/no-dialog', (await page.locator('.dialog').count()) === 0, `.dialog 数量=${await page.locator('.dialog').count()}`);
ok('REQ-042/no-pageerror', errs.length === 0, `pageerror=${JSON.stringify(errs)}`);

const nonBlank = await page.evaluate(() => {
  const c = document.getElementById('game');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 2000) if (d[i] > 0) n += 1;
  return n;
});
ok('REQ-042/renders', nonBlank > 1000, `画布非透明采样点=${nonBlank}`);

// 读盘 + 自算有效交换（不使用产品测试钩子）
const board = await page.evaluate((COLS) => {
  const c = document.getElementById('game');
  const ctx2 = c.getContext('2d');
  const t = ctx2.getTransform();
  const bg = [17, 40, 55];
  const out = [];
  for (let row = 1; row <= 8; row += 1) {
    const line = [];
    for (let col = 1; col <= 8; col += 1) {
      const counts = new Map();
      for (let dx = -18; dx <= 18; dx += 3) {
        for (let dy = -18; dy <= 18; dy += 3) {
          const x = Math.round(t.e + (224 + (col - 0.5) * 64 + dx) * t.a);
          const y = Math.round(t.f + (96 + (row - 0.5) * 64 + dy) * t.a);
          if (x < 0 || y < 0 || x >= c.width || y >= c.height) continue;
          const p = ctx2.getImageData(x, y, 1, 1).data;
          if (p[3] < 200) continue;
          if (Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) < 55) continue;
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
      line.push(top && top[1] >= 10 ? top[0] : null);
    }
    out.push(line);
  }
  return out;
}, COLS);
const recognized = board.flat().filter(Boolean).length;
ok('REQ-042/board-visible', recognized === 64, `缺图后仍识别出 ${recognized}/64 格`);

function validMove(g) {
  for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const r2 = r + dr, c2 = c + dc;
      if (r2 > 7 || c2 > 7) continue;
      const b = g.map((row) => row.slice());
      const t = b[r][c]; b[r][c] = b[r2][c2]; b[r2][c2] = t;
      let hit = false;
      for (let i = 0; i < 8 && !hit; i += 1) for (let j = 0; j < 6 && !hit; j += 1) {
        const v = b[i][j];
        if (v && v === b[i][j + 1] && v === b[i][j + 2]) hit = true;
      }
      for (let j = 0; j < 8 && !hit; j += 1) for (let i = 0; i < 6 && !hit; i += 1) {
        const v = b[i][j];
        if (v && v === b[i + 1][j] && v === b[i + 2][j]) hit = true;
      }
      if (hit) return { a: { row: r + 1, col: c + 1 }, b: { row: r2 + 1, col: c2 + 1 } };
    }
  }
  return null;
}
const move = validMove(board);
const cellPoint = async (row, col) => {
  const box = await page.locator('#game').boundingBox();
  const s = box.width / 960;
  return { x: box.x + (224 + (col - 0.5) * 64) * s, y: box.y + (96 + (row - 0.5) * 64) * s };
};
const movesBefore = Number(await page.locator('#hud-moves').textContent());
if (move) {
  const p1 = await cellPoint(move.a.row, move.a.col);
  const p2 = await cellPoint(move.b.row, move.b.col);
  await page.mouse.move(p1.x, p1.y); await page.mouse.down();
  await page.mouse.move(p2.x, p2.y, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(1500);
}
const movesAfter = Number(await page.locator('#hud-moves').textContent());
ok('REQ-042/playable', move !== null && movesAfter === movesBefore - 1,
  `缺图后自算有效交换 ${move ? JSON.stringify(move) : 'null'}，步数 ${movesBefore}→${movesAfter}`);
await page.screenshot({ path: '.qa-verify/out/g6-missing-assets.png' });
await browser.close();
const failed = checks.filter((c) => !c.pass);
console.log(`SUMMARY total=${checks.length} pass=${checks.length - failed.length} fail=${failed.length}`);
process.exit(failed.length ? 1 : 0);
