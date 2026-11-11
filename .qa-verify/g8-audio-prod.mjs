/** G8 生产构建音频行为：REQ-045 首手势后请求 BGM；REQ-048 音频加载失败静默降级 + 徽标 + 可玩。 */
import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:5057';
const b = await chromium.launch({ channel: 'chrome' });
const rows = [];
const ok = (id, cond, detail) => { rows.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id} :: ${detail}`); };

// --- REQ-045 首手势 ---
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const urls = [];
  p.on('request', (r) => urls.push(r.url()));
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const bgmBefore = urls.filter((u) => /bgm-main[^/]*\.(ogg|mp3)/.test(u)).length;
  ok('REQ-045/no-bgm-before-gesture', bgmBefore === 0, 'BGM 请求数（首手势前）=' + bgmBefore);
  await p.locator('.level-card[data-level-id="1"]').click();
  await p.waitForTimeout(2500);
  const bgmAfter = urls.filter((u) => /bgm-main[^/]*\.(ogg|mp3)/.test(u)).length;
  ok('REQ-045/bgm-after-gesture', bgmAfter >= 1, 'BGM 请求数（首手势后）=' + bgmAfter);
  await ctx.close();
}

// --- REQ-048 音频失败 ---
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.route(/\.(ogg|mp3)(\?|$)/, (route) => route.abort());
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.locator('.level-card[data-level-id="1"]').click();
  await p.waitForSelector('#screen-game:not(.hidden)');
  await p.waitForTimeout(1500);
  const badge = p.locator('#audio-badge');
  ok('REQ-048/badge-visible', await badge.isVisible(), 'audio-badge visible');
  ok('REQ-048/badge-text', (await badge.textContent())?.trim() === '音频不可用', 'badge text=' + (await badge.textContent())?.trim());
  ok('REQ-048/no-dialog', (await p.locator('.dialog').count()) === 0, 'dialog count=0');
  ok('REQ-048/no-pageerror', errors.length === 0, 'pageerrors=' + JSON.stringify(errors));

  const rect = await p.locator('#game').boundingBox();
  const s = rect.width / 960;
  const pt = (row, col) => ({ x: rect.x + (224 + (col - 0.5) * 64) * s, y: rect.y + (96 + (row - 0.5) * 64) * s });
  let moves = await p.locator('#hud-moves').textContent();
  const before = moves;
  for (let row = 1; row <= 8 && moves === before; row += 1) {
    for (let col = 1; col <= 8 && moves === before; col += 1) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = row + dr, c2 = col + dc;
        if (r2 > 8 || c2 > 8) continue;
        const a = pt(row, col), c = pt(r2, c2);
        await p.mouse.click(a.x, a.y); await p.waitForTimeout(50); await p.mouse.click(c.x, c.y);
        for (let i = 0; i < 12; i += 1) { await p.waitForTimeout(80); moves = await p.locator('#hud-moves').textContent(); if (moves !== before) break; }
        if (moves !== before) break;
      }
    }
  }
  ok('REQ-048/still-playable', moves !== before, `hud moves ${before} -> ${moves}`);
  await p.screenshot({ path: '.qa-verify/out/g8-audio-unavailable.png' });
  await ctx.close();
}
await b.close();
console.log('SUMMARY', rows.filter((r) => r.pass).length + '/' + rows.length);
console.log('RESULT:', rows.every((r) => r.pass) ? 'PASS' : 'FAIL');
process.exit(rows.every((r) => r.pass) ? 0 : 1);
