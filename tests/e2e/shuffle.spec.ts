import { expect, test } from '@playwright/test';

/** QA 复现序列（第 8 关 seed=1）：五步后棋盘无任何可行交换。 */
const QA_REPRO_SEQUENCE = [
  { a: { row: 1, col: 2 }, b: { row: 1, col: 3 } },
  { a: { row: 3, col: 5 }, b: { row: 4, col: 5 } },
  { a: { row: 1, col: 6 }, b: { row: 1, col: 7 } },
  { a: { row: 1, col: 6 }, b: { row: 2, col: 6 } },
  { a: { row: 1, col: 3 }, b: { row: 1, col: 4 } },
] as const;

test.describe('REQ-016 BUG-002 结算后死局自动重排', () => {
  test('第 8 关 seed=1 QA 复现序列：重排发生、shuffle 事件 ≥1、findMove 非 null、对局可继续', async ({ page }) => {
    await page.goto('/?seed=1');
    await page.evaluate(() => window.__wmgTest?.startLevel(8));
    await expect
      .poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft)
      .toBe(30);

    for (const [index, move] of QA_REPRO_SEQUENCE.entries()) {
      await page.evaluate(({ a, b }) => window.__wmgTest?.swap(a, b), move);
      await expect
        .poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft, { timeout: 30_000 })
        .toBe(30 - (index + 1));
    }

    const state = await page.evaluate(() => window.__wmgTest?.state());
    expect(state?.status).toBe('playing');
    expect(state?.movesLeft).toBe(25);
    expect(state?.score).toBe(1170);

    // 修复前此处 status=playing 但无可行步、shuffle 计数为 0。
    expect(await page.evaluate(() => window.__wmgTest?.shuffleEvents())).toBeGreaterThanOrEqual(1);
    const move = await page.evaluate(() => window.__wmgTest?.findMove() ?? null);
    expect(move).not.toBeNull();
    await expect(page.locator('#toast-root')).toContainText('无可消除步骤，已重排');

    // 对局可继续：重排后的首个有效交换仍然正常结算并扣 1 步。
    await page.evaluate(({ a, b }) => window.__wmgTest?.swap(a, b), move!);
    await expect
      .poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft, { timeout: 30_000 })
      .toBe(24);
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after?.status).toBe('playing');
    expect(after?.score).toBeGreaterThanOrEqual(1170);
  });
});