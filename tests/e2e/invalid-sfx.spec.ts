import { expect, test, type Page } from '@playwright/test';
import { cellBoundaryPoint, cellCssPx, cellPoint, startLevel } from './helpers';
import {
  expectInvalidSfxProbeSensitivity,
  installAudioProbe,
  markAudioProbe,
  readInvalidSfx,
  settleSfx,
} from './sfx-probe';

/**
 * CR-010 / REQ-003 / REQ-004 四类落点的 invalid 音效口径（spec v1.1.4）：
 *  - A 类静默忽略（棋盘外 / 石块格 / 死格）：无 invalid 播放（棋盘外见 outside-board.spec.ts）；
 *  - 同格点击（已选中 A 再点 A）＝取消选中：无 invalid；
 *  - 非相邻点击（已选中 A 点非相邻 B）＝选中转移：无 invalid；
 *  - 相邻交换后无匹配（B 类）：播放 1 次 invalid，200ms 回弹，不扣步、分数不变。
 *
 * 断言基于页内 `AudioBufferSourceNode.prototype.start` 实际播放事件（BUG-006），
 * 每个「无 invalid」用例末尾都跑一次 B 类灵敏度自检，证明探针不是空转。
 */
async function bootLevel(page: Page, levelId = 1): Promise<void> {
  await installAudioProbe(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?seed=20261110');
  await page.waitForFunction(() => Boolean(window.__wmgTest));
  await startLevel(page, levelId);
}

async function clickCell(page: Page, row: number, col: number): Promise<void> {
  const point = await cellPoint(page, row, col);
  await page.mouse.click(point.x, point.y);
}

async function expectNoInvalidSfx(page: Page, mark: Awaited<ReturnType<typeof markAudioProbe>>): Promise<void> {
  await settleSfx(page);
  const report = await readInvalidSfx(page, mark);
  expect(report.invalidStarts).toBe(0);
  expect(report.invalidFetches).toBe(0);
  expect(report.unlabelledStarts).toBe(0);
}

test.describe('CR-010 四类落点：invalid 音效口径', () => {
  test('同格点击（已选中 A 再点 A）→ 取消选中，无 invalid 播放', async ({ page }) => {
    await bootLevel(page);
    await clickCell(page, 1, 1);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });
    const before = await page.evaluate(() => window.__wmgTest?.state());
    const mark = await markAudioProbe(page);

    await clickCell(page, 1, 1);

    await expectNoInvalidSfx(page, mark);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toBeNull();
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after).toMatchObject({ movesLeft: before!.movesLeft, score: before!.score });

    await expectInvalidSfxProbeSensitivity(page);
  });

  test('非相邻点击（已选中 A 点非相邻 B）→ 选中转移，无 invalid 播放', async ({ page }) => {
    await bootLevel(page);
    await clickCell(page, 1, 1);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });
    const before = await page.evaluate(() => window.__wmgTest?.state());
    const mark = await markAudioProbe(page);

    await clickCell(page, 1, 8);

    await expectNoInvalidSfx(page, mark);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 8 });
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after).toMatchObject({ movesLeft: before!.movesLeft, score: before!.score });

    await expectInvalidSfxProbeSensitivity(page);
  });

  test('相邻交换后无匹配（B 类）→ 播放 invalid 1 次，不扣步、分数不变', async ({ page }) => {
    await bootLevel(page);
    await clickCell(page, 1, 1);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });
    const before = await page.evaluate(() => window.__wmgTest?.state());
    const mark = await markAudioProbe(page);

    await clickCell(page, 1, 2); // seed=20261110 第 1 关：(1,1)↔(1,2) 相邻交换后无匹配

    await expect
      .poll(async () => (await readInvalidSfx(page, mark)).invalidStarts, { timeout: 5_000 })
      .toBe(1);
    const report = await readInvalidSfx(page, mark);
    expect(report.invalidFetches).toBe(1);
    expect(report.unlabelledStarts).toBe(0);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toBeNull();
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after).toMatchObject({ movesLeft: before!.movesLeft, score: before!.score });
  });

  test('石块格落点（A 类）→ 静默忽略，选中保持，无 invalid 播放', async ({ page }) => {
    await bootLevel(page, 5); // 第 5 关 (2,2) 为石块
    await clickCell(page, 1, 1);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });
    const before = await page.evaluate(() => window.__wmgTest?.state());
    const mark = await markAudioProbe(page);

    await clickCell(page, 2, 2);

    await expectNoInvalidSfx(page, mark);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after).toMatchObject({ movesLeft: before!.movesLeft, score: before!.score });

    await expectInvalidSfxProbeSensitivity(page);
  });

  // REQ-049 / REQ-003：release 语义按主轴位移是否达 0.5 格判定。
  // 边界构造：按下点贴近格边界，位移仅 0.4 格（低于 0.5 格阈值），但已跨过中垂线
  // 吸附到相邻格 —— 必须按点击处理（相邻则交换），不得 emit invalid。
  test('边界点击：位移 0.4 格但跨过中垂线 → 按点击交换，无 invalid 播放', async ({ page }) => {
    await bootLevel(page, 3);
    await clickCell(page, 3, 2); // 第 3 关：(3,2)↔(4,2) 为确定性有效交换
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 3, col: 2 });
    const before = await page.evaluate(() => window.__wmgTest?.state());
    const mark = await markAudioProbe(page);

    const boundary = await cellBoundaryPoint(page, 3, 2, 'bottom');
    const cellPx = await cellCssPx(page);
    const startY = boundary.y - 4; // 贴近横边界、仍在 (3,2) 热区内
    await page.mouse.move(boundary.x, startY);
    await page.mouse.down();
    await page.mouse.move(boundary.x, startY + 0.4 * cellPx, { steps: 6 });
    await page.mouse.up();

    await expectNoInvalidSfx(page, mark);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toBeNull();
    await expect
      .poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft)
      .toBe(before!.movesLeft - 1);
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after!.score).toBeGreaterThan(before!.score);

    await expectInvalidSfxProbeSensitivity(page);
  });

  test('边界点击：已选中 A、位移 0.4 格仍落回 A → 取消选中，无 invalid 播放', async ({ page }) => {
    await bootLevel(page);
    await clickCell(page, 1, 1);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });
    const before = await page.evaluate(() => window.__wmgTest?.state());
    const mark = await markAudioProbe(page);

    const boundary = await cellBoundaryPoint(page, 1, 1, 'left');
    const cellPx = await cellCssPx(page);
    const startX = boundary.x + 4; // 贴近左边界、仍在 (1,1) 热区内
    const y = boundary.y;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX + 0.4 * cellPx, y, { steps: 6 });
    await page.mouse.up();

    await expectNoInvalidSfx(page, mark);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toBeNull();
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after).toMatchObject({ movesLeft: before!.movesLeft, score: before!.score });

    await expectInvalidSfxProbeSensitivity(page);
  });

  test('死格落点（A 类）→ 静默忽略，选中保持，无 invalid 播放', async ({ page }) => {
    await bootLevel(page, 8); // 第 8 关 (3,3) 为死格
    await clickCell(page, 1, 1);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });
    const before = await page.evaluate(() => window.__wmgTest?.state());
    const mark = await markAudioProbe(page);

    await clickCell(page, 3, 3);

    await expectNoInvalidSfx(page, mark);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after).toMatchObject({ movesLeft: before!.movesLeft, score: before!.score });

    await expectInvalidSfxProbeSensitivity(page);
  });
});
