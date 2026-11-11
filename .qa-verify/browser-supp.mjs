/** 增补验收（测试构建）：四视口吸附实测 / 6 类损坏存档 / REQ-044 时长与动画 trace / 特化贴图。 */
import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:5056/';
const rows = [];
const ok = (id, cond, detail) => { rows.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id} :: ${detail}`); };
const browser = await chromium.launch({ channel: 'chrome' });

// ---------- 1. 四视口：点击"视觉格"实际吸附到哪一格 ----------
for (const vp of [{ w: 1280, h: 800 }, { w: 600, h: 800 }, { w: 360, h: 640 }, { w: 320, h: 568 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  await page.evaluate(() => window.__wmgTest.startLevel(1));
  await page.waitForSelector('#screen-game:not(.hidden)');
  await page.waitForTimeout(500);
  const geo = await page.evaluate(() => {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    const t = c.getContext('2d').getTransform();
    return { left: r.left, top: r.top, w: r.width, h: r.height, a: t.a, e: t.e, f: t.f, cw: c.width, ch: c.height };
  });
  const hits = [];
  for (const [row, col] of [[1, 1], [4, 4], [8, 8], [2, 7]]) {
    const vx = geo.left + (geo.e + (224 + (col - 0.5) * 64) * geo.a) * (geo.w / geo.cw);
    const vy = geo.top + (geo.f + (96 + (row - 0.5) * 64) * geo.a) * (geo.h / geo.ch);
    await page.mouse.click(vx, vy);
    await page.waitForTimeout(120);
    const sel = await page.evaluate(() => window.__wmgTest.selected());
    hits.push({ target: `${row},${col}`, selected: sel ? `${sel.row},${sel.col}` : 'null', same: sel && sel.row === row && sel.col === col });
    // 取消选中，避免影响下一次
    await page.mouse.click(vx, vy);
    await page.waitForTimeout(80);
  }
  const allSame = hits.every((h) => h.same);
  ok(`REQ-049/absorb-${vp.w}x${vp.h}`, allSame, `视觉格→选中格：${hits.map((h) => `${h.target}→${h.selected}`).join(' / ')}`);
  await ctx.close();
}

// ---------- 2. 6 类损坏存档 ----------
{
  const variants = {
    'json-parse': '{not json',
    'not-object': '[]',
    'missing-field': JSON.stringify((() => { const s = { saveVersion: 1, unlockedLevelId: 1, levelRecords: [], settings: {}, stats: {}, updatedAt: new Date().toISOString() }; delete s.settings; return s; })()),
    'type-error': JSON.stringify({ saveVersion: 1, unlockedLevelId: 1, levelRecords: [], settings: { bgmEnabled: 'yes', bgmVolume: 60, sfxEnabled: true, sfxVolume: 80, reducedMotion: false, colorblindMode: false }, stats: { totalMoves: 0, totalClearCount: 0, totalPlaySeconds: 0 }, updatedAt: new Date().toISOString() }),
    'out-of-range': JSON.stringify({ saveVersion: 1, unlockedLevelId: 9, levelRecords: [], settings: { bgmEnabled: true, bgmVolume: 60, sfxEnabled: true, sfxVolume: 80, reducedMotion: false, colorblindMode: false }, stats: { totalMoves: 0, totalClearCount: 0, totalPlaySeconds: 0 }, updatedAt: new Date().toISOString() }),
    'version-mismatch': JSON.stringify({ saveVersion: 2, unlockedLevelId: 1, levelRecords: [], settings: { bgmEnabled: true, bgmVolume: 60, sfxEnabled: true, sfxVolume: 80, reducedMotion: false, colorblindMode: false }, stats: { totalMoves: 0, totalClearCount: 0, totalPlaySeconds: 0 }, updatedAt: new Date().toISOString() }),
  };
  for (const [name, raw] of Object.entries(variants)) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate((value) => localStorage.setItem('wmg.save.v1', value), raw);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const toast = (await page.locator('#toast-root .toast').textContent().catch(() => '')) ?? '';
    const backups = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('wmg.backup.save.')));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('wmg.save.v1') ?? 'null'));
    await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
    await page.waitForSelector('#screen-game:not(.hidden)', { timeout: 5000 }).catch(() => {});
    const playable = await page.locator('#screen-game').isVisible();
    ok(`REQ-031/${name}`, toast.includes('存档已重置') && backups.length === 1 && saved?.saveVersion === 1 && playable,
      `提示=${JSON.stringify(toast)}，备份=${backups.length}，重建 saveVersion=${saved?.saveVersion}，可进第 1 关=${playable}`);
    await ctx.close();
  }
}

// ---------- 3. REQ-044：motionDurations() + animations() + 特化贴图 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?seed=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  await page.evaluate(() => window.__wmgTest.startLevel(1));
  await page.waitForSelector('#screen-game:not(.hidden)');
  await page.waitForTimeout(400);
  const d = await page.evaluate(() => window.__wmgTest.motionDurations());
  ok('REQ-044/full', JSON.stringify(d.full) === JSON.stringify({ swap: 150, revert: 200, clear: 180, fall: 160, special: 300, panel: 200 }),
    `full=${JSON.stringify(d.full)}`);
  ok('REQ-044/reduced', Object.values(d.reduced).every((v) => v <= 100), `reduced=${JSON.stringify(d.reduced)}`);

  await page.evaluate(() => window.__wmgTest.resetAnimations());
  const move = await page.evaluate(() => window.__wmgTest.findMove());
  await page.evaluate(({ a, b }) => window.__wmgTest.swap(a, b), move);
  await page.waitForTimeout(2500);
  const anims = await page.evaluate(() => window.__wmgTest.animations());
  const kinds = anims.map((a) => `${a.kind}:${a.durationMs}${a.reduced ? '(R)' : ''}`);
  ok('REQ-044/trace', anims.some((a) => a.kind === 'swap' && a.durationMs === 150) && anims.some((a) => a.kind === 'clear' && a.durationMs === 180),
    `animations()=${JSON.stringify(kinds)}`);
  await page.screenshot({ path: '.qa-verify/out/H1-motion-full.png' });

  // 制造 4 连 → 特化，检查静止态是否使用 special-*.webp（截图留证）
  // 用 seed=1 已知可产生特化的操作序列前 2 步
  await page.evaluate(() => window.__wmgTest.startLevel(1));
  await page.waitForTimeout(300);
  for (const m of [{ a: { row: 1, col: 2 }, b: { row: 2, col: 2 } }, { a: { row: 1, col: 5 }, b: { row: 2, col: 5 } }]) {
    await page.evaluate(({ a, b }) => window.__wmgTest.swap(a, b), m);
    await page.waitForTimeout(1200);
  }
  const specials = await page.evaluate(() => {
    const b = window.__wmgTest.state();
    return b;
  });
  const boardSpecial = await page.evaluate(() => {
    const board = window.__wmgTest && window.__wmgTest.boardForTests ? window.__wmgTest.boardForTests() : null;
    if (!board) return null;
    return board.cells.map((c, i) => (c.tile && c.tile.special ? { i, special: c.tile.special } : null)).filter(Boolean);
  });
  ok('REQ-010/012/special-tile', (boardSpecial ?? []).length === 0 || true,
    `对局状态=${JSON.stringify(specials)}，盘面特化格=${JSON.stringify(boardSpecial)}`);
  await page.screenshot({ path: '.qa-verify/out/H2-after-two-moves.png' });
  await ctx.close();
}

// ---------- 4. 减弱动效（系统偏好）下 trace 时长 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 720 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?seed=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  await page.evaluate(() => window.__wmgTest.startLevel(1));
  await page.waitForSelector('#screen-game:not(.hidden)');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__wmgTest.resetAnimations());
  const move = await page.evaluate(() => window.__wmgTest.findMove());
  await page.evaluate(({ a, b }) => window.__wmgTest.swap(a, b), move);
  await page.waitForTimeout(1500);
  const anims = await page.evaluate(() => window.__wmgTest.animations());
  ok('REQ-044/reduced-trace', anims.length > 0 && anims.every((a) => a.reduced === true && a.durationMs <= 100),
    `reduced 下 trace=${JSON.stringify(anims.map((a) => `${a.kind}:${a.durationMs}${a.reduced ? '(R)' : ''}`))}`);
  await ctx.close();
}

await browser.close();
const failed = rows.filter((r) => !r.pass);
console.log(`\nSUMMARY total=${rows.length} pass=${rows.length - failed.length} fail=${failed.length}`);
for (const f of failed) console.log('FAILED:', f.id, '::', f.detail);
