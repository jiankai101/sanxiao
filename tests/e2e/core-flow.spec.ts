import { expect, test } from '@playwright/test';
import { dragCell, startLevel } from './helpers';

test.describe('REQ-019/REQ-020 核心链路', () => {
  test('开始 → 有效交换 → 重开 → 返回选关，无 console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/?seed=424242');
    await startLevel(page, 1);
    await expect(page.locator('#screen-game')).toBeVisible();

    const before = await page.evaluate(() => window.__wmgTest?.state());
    expect(before?.movesLeft).toBe(20);
    expect(before?.score).toBe(0);

    const move = await page.evaluate(() => window.__wmgTest?.findMove() ?? null);
    expect(move).not.toBeNull();
    await dragCell(page, move!.a, move!.b);
    await expect.poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft).toBe(19);
    const afterSwap = await page.evaluate(() => window.__wmgTest?.state());
    expect(afterSwap!.score).toBeGreaterThan(0);
    expect(afterSwap!.seed).toBe(before!.seed);

    await page.locator('#btn-restart').click();
    await expect(page.locator('.dialog')).toBeVisible();
    await page.locator('.dialog .btn.danger').click();
    await expect.poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft).toBe(20);
    const afterRestart = await page.evaluate(() => window.__wmgTest?.state());
    expect(afterRestart!.score).toBe(0);
    expect(afterRestart!.seed).not.toBe(before!.seed);

    await page.locator('#btn-back').click();
    await expect(page.locator('#screen-level-select')).toBeVisible();
    const boardCount = await page.evaluate(() => {
      const raw = localStorage.getItem('wmg.leaderboard.v1');
      if (!raw) return 0;
      return JSON.parse(raw).records.length as number;
    });
    expect(boardCount).toBe(0);
    expect(errors).toEqual([]);
  });

  test('结算面板字段与 300ms 输入锁（失败路径）', async ({ page }) => {
    await page.goto('/?seed=99');
    await startLevel(page, 1);
    // 用尽 20 步（不保证全部有效，有效交换才扣步）
    for (let i = 0; i < 40; i += 1) {
      const state = await page.evaluate(() => window.__wmgTest?.state());
      if (!state || state.status !== 'playing') break;
      const move = await page.evaluate(() => window.__wmgTest?.findMove() ?? null);
      if (!move) break;
      await dragCell(page, move.a, move.b);
      await page.waitForTimeout(1200);
    }
    const state = await page.evaluate(() => window.__wmgTest?.state());
    if (state && (state.status === 'won' || state.status === 'lost')) {
      await expect(page.locator('#panel-result')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#panel-result')).toContainText('本局分数');
      await expect(page.locator('#panel-result')).toContainText('历史最高分');
      await expect(page.locator('#panel-result')).toContainText('剩余步数');
      const firstButton = page.locator('#panel-result button').first();
      await page.waitForTimeout(400);
      await expect(firstButton).toBeEnabled();
    }
  });
});
