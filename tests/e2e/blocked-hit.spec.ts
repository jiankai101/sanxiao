import { expect, test } from '@playwright/test';
import { cellPoint, startLevel } from './helpers';

async function clickCell(page: import('@playwright/test').Page, row: number, col: number): Promise<void> {
  const point = await cellPoint(page, row, col);
  await page.mouse.click(point.x, point.y);
}

async function bootLevel(page: import('@playwright/test').Page, levelId: number): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?seed=20261110');
  await page.waitForFunction(() => Boolean(window.__wmgTest));
  await startLevel(page, levelId);
}

test.describe('REQ-049 blocked hit path', () => {
  test('clicking a stone cell selects nothing and keeps moves/score unchanged', async ({ page }) => {
    await bootLevel(page, 5);
    const before = await page.evaluate(() => window.__wmgTest?.state());
    expect(before).not.toBeNull();

    await clickCell(page, 2, 2); // level 5 stone
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toBeNull();
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after).toMatchObject({ movesLeft: before!.movesLeft, score: before!.score });
  });

  test('clicking a hole cell selects nothing and keeps moves/score unchanged', async ({ page }) => {
    await bootLevel(page, 8);
    const before = await page.evaluate(() => window.__wmgTest?.state());
    expect(before).not.toBeNull();

    await clickCell(page, 3, 3); // level 8 hole
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toBeNull();
    const after = await page.evaluate(() => window.__wmgTest?.state());
    expect(after).toMatchObject({ movesLeft: before!.movesLeft, score: before!.score });
  });

  test('clicking a stone cell keeps an existing selection (invalid click)', async ({ page }) => {
    await bootLevel(page, 5);
    await clickCell(page, 1, 1);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });

    await clickCell(page, 2, 2); // stone
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 1, col: 1 });
    const state = await page.evaluate(() => window.__wmgTest?.state());
    expect(state?.movesLeft).toBe(26);
    expect(state?.score).toBe(0);
  });

  test('ice cells remain selectable and swappable', async ({ page }) => {
    await bootLevel(page, 3);
    await clickCell(page, 4, 2); // level 3 ice
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toEqual({ row: 4, col: 2 });

    await clickCell(page, 3, 2); // adjacent normal cell; deterministic valid swap for seed 20261110
    await expect.poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft).toBe(23);
    const state = await page.evaluate(() => window.__wmgTest?.state());
    expect(state!.score).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__wmgTest?.selected())).toBeNull();
  });
});
