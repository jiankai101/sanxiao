import { expect, test, type Page } from '@playwright/test';
import { cellPoint, startLevel } from './helpers';
import {
  expectInvalidSfxProbeSensitivity,
  installAudioProbe,
  markAudioProbe,
  readInvalidSfx,
  settleSfx,
} from './sfx-probe';

/**
 * CR-008 / REQ-049 A 类：棋盘投影矩形外的按下/点击/拖拽落点 → 静默忽略。
 * 断言：selected 不变、moves/score 不变、无 aria 播报（#game-live 不变）、无 invalid 音效。
 *
 * BUG-006 修复后的音效断言有三层：
 *  1) 实际播放证据：页内 hook `AudioBufferSourceNode.prototype.start`，按 fetch→decode 映射回资源 URL；
 *  2) 请求证据：正则 `/sfx-invalid[^/]*\.(ogg|mp3)(\?|$)/` 容忍 Vite 哈希（sfx-invalid-BqsWogSh.ogg）；
 *  3) 灵敏度自检：每个用例末尾在同一 page 会话跑一次「相邻无匹配」B 类交换，
 *     证明探针确实能记到 invalid 播放，因此前面的 0 次断言不是空转。
 */
async function canvasPoint(page: Page, logicalX: number, logicalY: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('#game').boundingBox();
  if (!box) throw new Error('canvas not visible');
  const scale = box.width / 960;
  return { x: box.x + logicalX * scale, y: box.y + logicalY * scale };
}

/** 画布左下方留白：逻辑 (100, 660) 在棋盘投影矩形 (x 224..736, y 96..608) 之外。 */
async function outsidePoint(page: Page): Promise<{ x: number; y: number }> {
  return canvasPoint(page, 100, 660);
}

async function bootLevel(page: Page, levelId = 1): Promise<void> {
  await installAudioProbe(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?seed=20261110');
  await page.waitForFunction(() => Boolean(window.__wmgTest));
  await startLevel(page, levelId);
}

/** 零音效断言：实际播放 0 次且请求 0 次，并保证探针把区间内每个 buffer 都标出了 URL。 */
async function expectNoInvalidSfx(page: Page, mark: Awaited<ReturnType<typeof markAudioProbe>>): Promise<void> {
  await settleSfx(page);
  const report = await readInvalidSfx(page, mark);
  expect(report.invalidStarts).toBe(0);
  expect(report.invalidFetches).toBe(0);
  expect(report.unlabelledStarts).toBe(0);
}

test.describe('REQ-049 A 类静默忽略：棋盘投影矩形外', () => {
  test('点击棋盘外留白 → selected/moves/score 不变，无 invalid 音效、无 aria 播报', async ({ page }) => {
    await bootLevel(page);

    const cell = await cellPoint(page, 1, 1);
    await page.mouse.click(cell.x, cell.y);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });

    const liveBefore = await page.locator('#game-live').textContent();
    const before = await page.evaluate(() => window.__wmgTest?.state());
    expect(before).not.toBeNull();
    const mark = await markAudioProbe(page);

    const outside = await outsidePoint(page);
    await page.mouse.click(outside.x, outside.y);

    await expectNoInvalidSfx(page, mark);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after).toMatchObject({ movesLeft: before!.movesLeft, score: before!.score });
    expect(await page.locator('#game-live').textContent()).toBe(liveBefore);

    await expectInvalidSfxProbeSensitivity(page);
  });

  test('无选中时点击棋盘外留白 → 不产生选中、步数/分数不变、无 invalid 音效', async ({ page }) => {
    await bootLevel(page);

    const before = await page.evaluate(() => window.__wmgTest?.state());
    expect(before).not.toBeNull();
    const mark = await markAudioProbe(page);

    const outside = await outsidePoint(page);
    await page.mouse.click(outside.x, outside.y);

    await expectNoInvalidSfx(page, mark);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toBeNull();
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after).toMatchObject({ movesLeft: before!.movesLeft, score: before!.score });

    await expectInvalidSfxProbeSensitivity(page);
  });

  test('从有效格拖出棋盘并松开 → 静默忽略，选中保持、不交换、无 invalid 音效', async ({ page }) => {
    await bootLevel(page);

    const cell = await cellPoint(page, 1, 1);
    await page.mouse.click(cell.x, cell.y);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });

    const before = await page.evaluate(() => window.__wmgTest?.state());
    const mark = await markAudioProbe(page);

    const outside = await outsidePoint(page);
    await page.mouse.move(cell.x, cell.y);
    await page.mouse.down();
    await page.mouse.move(outside.x, outside.y, { steps: 8 });
    await page.mouse.up();

    await expectNoInvalidSfx(page, mark);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after).toMatchObject({ movesLeft: before!.movesLeft, score: before!.score });

    await expectInvalidSfxProbeSensitivity(page);
  });
});
