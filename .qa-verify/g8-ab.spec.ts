import { expect, test, type Page } from '@playwright/test';
import { installG8Probe, mark, since } from './g8-probe';

/**
 * G8 独立复核（spec v1.1.4 / CR-010）
 * - BUG-005：四类落点 × 四视口，断言基于 AudioBufferSourceNode.start 实际播放
 * - BUG-006：负控（构造应触发场景，断言「0 次」必须失败；构造不应触发场景，断言「≥1」必须失败）
 * - 输入边界：按下点贴近格边界、位移 0.4 格但抬起跨格 → 按点击处理
 */

const VPS = [
  { width: 1280, height: 800 },
  { width: 600, height: 800 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
];

type Geom = { left: number; top: number; w: number; h: number; dpr: number; a: number; d: number; e: number; f: number };
type Pt = { x: number; y: number };

async function geom(page: Page): Promise<Geom> {
  return page.evaluate(() => {
    const c = document.getElementById('game') as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    const t = c.getContext('2d')!.getTransform();
    return { left: r.left, top: r.top, w: r.width, h: r.height, dpr: window.devicePixelRatio, a: t.a, d: t.d, e: t.e, f: t.f };
  });
}

/** 逻辑坐标 → CSS 点，仅依据 canvas 绘制变换（与输入层换算代码无关）。 */
function css(g: Geom, x: number, y: number): Pt {
  return { x: g.left + (g.e + g.a * x) / g.dpr, y: g.top + (g.f + g.d * y) / g.dpr };
}
const center = (g: Geom, row: number, col: number): Pt => css(g, 224 + (col - 0.5) * 64, 96 + (row - 0.5) * 64);
const cellCss = (g: Geom): number => (64 * g.w) / 960;

async function boot(page: Page, vp: { width: number; height: number }, level: number): Promise<void> {
  await installG8Probe(page);
  await page.setViewportSize(vp);
  await page.goto('/?seed=20261110');
  await page.waitForFunction(() => Boolean((window as any).__wmgTest));
  await page.evaluate((id) => (window as any).__wmgTest.startLevel(id), level);
  await page.waitForTimeout(260);
}

const state = (page: Page) => page.evaluate(() => (window as any).__wmgTest.state());
const selected = (page: Page) => page.evaluate(() => (window as any).__wmgTest.selected());
const live = (page: Page) => page.evaluate(() => document.querySelector('#game-live')?.textContent ?? null);

async function clickCell(page: Page, row: number, col: number): Promise<void> {
  const p = center(await geom(page), row, col);
  await page.mouse.click(p.x, p.y);
}

/** 无 invalid 的统一断言（同时要求探针本身可用：hookErrors 为空、可映射 URL）。 */
async function expectSilent(page: Page, m: { starts: number; fetches: number }, extraWait = 700) {
  await page.waitForTimeout(extraWait);
  const r = await since(page, m);
  expect(r.invalidStarts, 'invalid 实际播放次数').toBe(0);
  expect(r.unlabelled, '无法映射 URL 的播放事件').toBe(0);
  return r;
}

for (const vp of VPS) {
  const tag = `${vp.width}x${vp.height}`;

  test(`G8 ${tag} A1 棋盘外点击：静默忽略，无 invalid`, async ({ page }) => {
    await boot(page, vp, 1);
    await clickCell(page, 1, 1);
    expect(await selected(page)).toEqual({ row: 1, col: 1 });
    expect((await page.evaluate(() => (window as any).__wmgTest.audio())).unlocked).toBe(true);
    const before = await state(page);
    const beforeLive = await live(page);

    const m = await mark(page);
    const p = css(await geom(page), 60, 60);
    await page.mouse.click(p.x, p.y);
    const r = await expectSilent(page, m);

    expect(await selected(page)).toEqual({ row: 1, col: 1 });
    expect(await live(page)).toBe(beforeLive);
    expect(await state(page)).toMatchObject({ movesLeft: before.movesLeft, score: before.score, status: 'playing' });
    expect(r.swapStarts).toBe(0);
  });

  test(`G8 ${tag} A2 石块格点击：静默忽略，无 invalid`, async ({ page }) => {
    await boot(page, vp, 5); // 第 5 关石块坐标 grid([2,4,6,8],[2,4,6])
    await clickCell(page, 1, 1);
    expect(await selected(page)).toEqual({ row: 1, col: 1 });
    const before = await state(page);
    const beforeLive = await live(page);

    const m = await mark(page);
    await clickCell(page, 2, 2);
    const r = await expectSilent(page, m);

    expect(await selected(page)).toEqual({ row: 1, col: 1 });
    expect(await live(page)).toBe(beforeLive);
    expect(await state(page)).toMatchObject({ movesLeft: before.movesLeft, score: before.score });
    expect(r.swapStarts).toBe(0);
  });

  test(`G8 ${tag} A3 死格点击：静默忽略，无 invalid`, async ({ page }) => {
    await boot(page, vp, 8); // 第 8 关死格 (3,3)(3,6)(6,2)(6,7)
    await clickCell(page, 1, 1);
    expect(await selected(page)).toEqual({ row: 1, col: 1 });
    const before = await state(page);
    const beforeLive = await live(page);

    const m = await mark(page);
    await clickCell(page, 3, 3);
    const r = await expectSilent(page, m);

    expect(await selected(page)).toEqual({ row: 1, col: 1 });
    expect(await live(page)).toBe(beforeLive);
    expect(await state(page)).toMatchObject({ movesLeft: before.movesLeft, score: before.score });
    expect(r.swapStarts).toBe(0);
  });

  test(`G8 ${tag} 同格点击：取消选中，无 invalid / 无 swap`, async ({ page }) => {
    await boot(page, vp, 1);
    await clickCell(page, 1, 1);
    const before = await state(page);

    const m = await mark(page);
    await clickCell(page, 1, 1);
    const r = await expectSilent(page, m);

    expect(await selected(page)).toBeNull();
    expect(r.swapStarts).toBe(0);
    expect(await state(page)).toMatchObject({ movesLeft: before.movesLeft, score: before.score, status: 'playing' });
  });

  test(`G8 ${tag} 非相邻点击：选中转移，无 invalid / 无 swap`, async ({ page }) => {
    await boot(page, vp, 1);
    await clickCell(page, 1, 1);
    const before = await state(page);
    const beforeLive = await live(page);

    const m = await mark(page);
    await clickCell(page, 1, 8);
    const r = await expectSilent(page, m);

    expect(await selected(page)).toEqual({ row: 1, col: 8 });
    expect(r.swapStarts).toBe(0);
    expect(await state(page)).toMatchObject({ movesLeft: before.movesLeft, score: before.score, status: 'playing' });
    expect(await live(page)).toBe(beforeLive);
  });

  test(`G8 ${tag} 相邻无匹配：invalid 恰好 1 次 + 200ms 回弹 + 选中清空`, async ({ page }) => {
    await boot(page, vp, 1);
    await clickCell(page, 1, 1);
    const before = await state(page);
    await page.evaluate(() => (window as any).__wmgTest.resetAnimations());

    const m = await mark(page);
    await clickCell(page, 1, 2); // seed=20261110 第 1 关：(1,1)↔(1,2) 相邻、交换后无匹配

    await expect.poll(async () => (await since(page, m)).invalidStarts, { timeout: 6000 }).toBe(1);
    await page.waitForTimeout(700);
    const r = await since(page, m);
    expect(r.invalidStarts, 'invalid 播放次数必须恰好 1').toBe(1);
    expect(r.fetches.filter((u) => /sfx-invalid[^/]*\.(ogg|mp3)/.test(u)).length).toBeGreaterThanOrEqual(1);
    expect(r.unlabelled).toBe(0);

    expect(await selected(page)).toBeNull();
    expect(await state(page)).toMatchObject({ movesLeft: before.movesLeft, score: before.score, status: 'playing' });

    const anims = await page.evaluate(() => (window as any).__wmgTest.animations());
    const revert = anims.filter((a: any) => a.kind === 'revert');
    expect(revert.length, 'revert 动画应记录 1 次').toBe(1);
    expect(revert[0].durationMs, '回弹时长 200ms').toBe(200);
    expect(revert[0].reduced).toBe(false);

    expect(await page.evaluate(() => (window as any).__wmgTest.findMove() !== null)).toBe(true);
  });

  test(`G8 ${tag} 输入边界：位移 0.4 格但抬起跨格 → 相邻交换（无 invalid）`, async ({ page }) => {
    await boot(page, vp, 1);
    const mv = await page.evaluate(() => (window as any).__wmgTest.findMove());
    expect(mv, '第 1 关必须存在可行步').not.toBeNull();

    const g = await geom(page);
    const a = mv.a as { row: number; col: number };
    const b = mv.b as { row: number; col: number };
    await clickCell(page, a.row, a.col);
    expect(await selected(page)).toEqual(a);

    // 共享边界 + 方向
    let edge: Pt;
    let dir: Pt;
    if (b.col === a.col + 1) {
      edge = css(g, 224 + a.col * 64, 96 + (a.row - 0.5) * 64);
      dir = { x: 1, y: 0 };
    } else if (b.col === a.col - 1) {
      edge = css(g, 224 + (a.col - 1) * 64, 96 + (a.row - 0.5) * 64);
      dir = { x: -1, y: 0 };
    } else if (b.row === a.row + 1) {
      edge = css(g, 224 + (a.col - 0.5) * 64, 96 + a.row * 64);
      dir = { x: 0, y: 1 };
    } else {
      edge = css(g, 224 + (a.col - 0.5) * 64, 96 + (a.row - 1) * 64);
      dir = { x: 0, y: -1 };
    }

    const before = await state(page);
    const m = await mark(page);
    const px = cellCss(g);
    const start = { x: edge.x - dir.x * 4, y: edge.y - dir.y * 4 }; // 边界内侧 4px，仍在起点格
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + dir.x * 0.4 * px, start.y + dir.y * 0.4 * px, { steps: 6 });
    await page.mouse.up();

    await expect
      .poll(async () => (await state(page))?.movesLeft, { timeout: 10000 })
      .toBe(before.movesLeft - 1);
    const r = await since(page, m);
    expect(r.invalidStarts, '边界点击不得播放 invalid').toBe(0);
    expect(r.unlabelled).toBe(0);
    const after = await state(page);
    expect(after.score).toBeGreaterThan(before.score);
    expect(await selected(page)).toBeNull();
  });

  test(`G8 ${tag} 输入边界：位移 0.4 格仍落回原格 → 取消选中（无 invalid）`, async ({ page }) => {
    await boot(page, vp, 1);
    await clickCell(page, 1, 1);
    expect(await selected(page)).toEqual({ row: 1, col: 1 });
    const before = await state(page);

    const g = await geom(page);
    const px = cellCss(g);
    const leftEdge = css(g, 224, 96 + 0.5 * 64);
    const start = { x: leftEdge.x + 4, y: leftEdge.y };
    const m = await mark(page);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 0.4 * px, start.y, { steps: 6 });
    await page.mouse.up();

    const r = await expectSilent(page, m);
    expect(await selected(page)).toBeNull();
    expect(r.swapStarts).toBe(0);
    expect(await state(page)).toMatchObject({ movesLeft: before.movesLeft, score: before.score });
  });
}

// ---- BUG-006 负控：证明「0 次 / ≥1 次」断言不是空转 ----
for (const vp of [{ width: 1280, height: 800 }, { width: 320, height: 568 }]) {
  const tag = `${vp.width}x${vp.height}`;

  test(`G8 ${tag} BUG-006 负控1：应触发 invalid 的场景下「期望 0 次」必须失败`, async ({ page }) => {
    await boot(page, vp, 1);
    await clickCell(page, 1, 1);
    const m = await mark(page);
    await clickCell(page, 1, 2);
    await expect.poll(async () => (await since(page, m)).invalidStarts, { timeout: 6000 }).toBeGreaterThanOrEqual(1);
    const r = await since(page, m);
    expect(r.invalidStarts).toBe(1);

    let threw = false;
    try {
      expect(r.invalidStarts, 'NEG-CONTROL').toBe(0);
    } catch {
      threw = true;
    }
    expect(threw, '负控失败：invalid 已实际播放1次，但「期望0次」断言没有抛错').toBe(true);
  });

  test(`G8 ${tag} BUG-006 负控2：不应触发 invalid 的场景下「期望 ≥1 次」必须失败`, async ({ page }) => {
    await boot(page, vp, 1);
    const p = css(await geom(page), 60, 60);
    const m = await mark(page);
    await page.mouse.click(p.x, p.y);
    const r = await expectSilent(page, m);
    expect(r.invalidStarts).toBe(0);

    let threw = false;
    try {
      expect(r.invalidStarts, 'NEG-CONTROL').toBeGreaterThanOrEqual(1);
    } catch {
      threw = true;
    }
    expect(threw, '负控失败：invalid 未播放，但「期望≥1次」断言没有抛错').toBe(true);
  });
}

// ---- 回弹像素证据：B 类拒绝后棋盘必须逐像素恢复 ----
for (const vp of [{ width: 1280, height: 800 }, { width: 320, height: 568 }]) {
  const tag = `${vp.width}x${vp.height}`;
  test(`G8 ${tag} B 类回弹：交换前后棋盘区域逐像素一致（均值差 < 1）`, async ({ page }) => {
    await boot(page, vp, 1);
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const c = document.getElementById('game') as HTMLCanvasElement;
      const ctx = c.getContext('2d')!;
      const s = ctx.getTransform().a;
      (window as any).__g8snap = Array.from(ctx.getImageData(224 * s, 96 * s, 512 * s, 512 * s).data);
    });
    await page.evaluate(() => (window as any).__wmgTest.swap({ row: 1, col: 1 }, { row: 1, col: 2 }));
    await page.waitForTimeout(900);
    const diff = await page.evaluate(() => {
      const c = document.getElementById('game') as HTMLCanvasElement;
      const ctx = c.getContext('2d')!;
      const s = ctx.getTransform().a;
      const now = ctx.getImageData(224 * s, 96 * s, 512 * s, 512 * s).data;
      const before = (window as any).__g8snap as number[];
      let sum = 0;
      for (let i = 0; i < now.length; i += 1) sum += Math.abs(now[i] - before[i]);
      return sum / now.length;
    });
    expect(diff, `棋盘区域平均像素差 ${diff}`).toBeLessThan(1);
  });
}

