/** G8 生产构建冒烟：静态服务器直跑、刷新、窗口缩放、真实指针输入、零第三方请求。 */
import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:5057';
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const urls = [];
const errors = [];
const consoleErrors = [];
p.on('request', (r) => urls.push(r.url()));
p.on('pageerror', (e) => errors.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const rows = [];
const ok = (id, cond, detail) => { rows.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id} :: ${detail}`); };

await p.goto(BASE + '/', { waitUntil: 'networkidle' });
ok('boot', await p.locator('#screen-level-select').isVisible(), 'level select visible');
ok('levels', (await p.locator('.level-card').count()) === 8, 'level cards = ' + (await p.locator('.level-card').count()));
ok('no-test-hook-in-prod', await p.evaluate(() => typeof window.__wmgTest === 'undefined'), '__wmgTest undefined (真实生产产物无测试钩子)');

await p.locator('.level-card[data-level-id="1"]').click();
await p.waitForSelector('#screen-game:not(.hidden)');
await p.waitForTimeout(900);
ok('enter-level', await p.locator('#screen-game').isVisible(), 'game screen visible');
const moves0 = await p.locator('#hud-moves').textContent();
ok('hud-moves-initial', moves0 === '20', 'hud moves = ' + moves0);

// 生产构建不接受 ?seed（readFixedSeed 仅在 __TEST__ 生效），因此按真实玩家路径逐个尝试相邻交换，
// 直到出现一次「有效交换」使步数下降（无效交换不扣步、无副作用）。
const rect = await p.locator('#game').boundingBox();
const s = rect.width / 960;
const pt = (row, col) => ({ x: rect.x + (224 + (col - 0.5) * 64) * s, y: rect.y + (96 + (row - 0.5) * 64) * s });
let moves1 = moves0;
let tried = 0;
let used = null;
outer:
for (let row = 1; row <= 8; row += 1) {
  for (let col = 1; col <= 8; col += 1) {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const r2 = row + dr, c2 = col + dc;
      if (r2 > 8 || c2 > 8) continue;
      tried += 1;
      const a = pt(row, col), c = pt(r2, c2);
      await p.mouse.click(a.x, a.y);
      await p.waitForTimeout(60);
      await p.mouse.click(c.x, c.y);
      for (let i = 0; i < 14; i += 1) {
        await p.waitForTimeout(80);
        moves1 = await p.locator('#hud-moves').textContent();
        if (moves1 !== moves0) { used = [row, col, r2, c2]; break outer; }
      }
      if (tried >= 40) break outer;
    }
  }
}
ok('input-valid-swap', moves1 === '19', `tried ${tried} adjacent pairs; hud moves ${moves0} -> ${moves1}; valid pair ${JSON.stringify(used)}`);

await p.setViewportSize({ width: 360, height: 640 });
await p.waitForTimeout(700);
const geo = await p.evaluate(() => { const c = document.getElementById('game'); const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, cw: c.width, ch: c.height, dpr: devicePixelRatio }; });
ok('resize-360', Math.abs(geo.w - 360) < 0.5 && geo.cw === Math.round(360 * Math.min(geo.dpr, 2)), `css ${geo.w}x${geo.h}, canvas ${geo.cw}x${geo.ch}, dpr ${geo.dpr}`);
ok('resize-keeps-moves', (await p.locator('#hud-moves').textContent()) === moves1, 'hud moves unchanged after resize');

await p.reload({ waitUntil: 'networkidle' });
ok('refresh-level-select', await p.locator('#screen-level-select').isVisible(), 'reload shows level select');
ok('refresh-cards', (await p.locator('.level-card').count()) === 8, '8 cards after reload');
const save = await p.evaluate(() => localStorage.getItem('wmg.save.v1'));
let saveOk = false;
try { saveOk = JSON.parse(save).saveVersion === 1; } catch {}
ok('save-version', saveOk, 'saveVersion=1 after play+reload');

const external = urls.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:'));
ok('no-external', external.length === 0, 'external requests = ' + external.length + (external.length ? ' ' + JSON.stringify(external) : ''));
ok('no-pageerror', errors.length === 0, 'pageerrors = ' + errors.length + (errors.length ? ' :: ' + errors.join(' | ') : ''));
ok('no-console-error', consoleErrors.length === 0, 'console errors = ' + consoleErrors.length + (consoleErrors.length ? ' :: ' + consoleErrors.join(' | ') : ''));

await p.setViewportSize({ width: 1280, height: 800 });
await p.waitForTimeout(500);
await p.screenshot({ path: '.qa-verify/out/g8-prod-levelselect.png' });
await ctx.close(); await b.close();
console.log('SUMMARY', rows.filter((r) => r.pass).length + '/' + rows.length);
console.log('RESULT:', rows.every((r) => r.pass) ? 'PASS' : 'FAIL');
process.exit(rows.every((r) => r.pass) ? 0 : 1);
