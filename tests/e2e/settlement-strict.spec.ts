import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startLevel } from './helpers';

/** Deterministic level-1 win (seed 1): six adjacent swaps, score 2790, 3 stars. */
const WINNING_MOVES = [
  { a: { row: 1, col: 2 }, b: { row: 2, col: 2 } },
  { a: { row: 1, col: 5 }, b: { row: 2, col: 5 } },
  { a: { row: 1, col: 4 }, b: { row: 2, col: 4 } },
  { a: { row: 2, col: 2 }, b: { row: 2, col: 3 } },
  { a: { row: 2, col: 4 }, b: { row: 2, col: 5 } },
  { a: { row: 2, col: 5 }, b: { row: 3, col: 5 } },
] as const;

test.describe('REQ-020/REQ-028/REQ-034 settlement timing and victory record', () => {
  test('fixed seed full win writes leaderboard; t+200ms click is dead, t+350ms works', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-11T00:00:00Z') });
    await page.goto('/?seed=1');
    await startLevel(page, 1);

    // First five moves run with a flowing clock so the real tween/step timers advance.
    for (let i = 0; i < WINNING_MOVES.length - 1; i += 1) {
      const move = WINNING_MOVES[i]!;
      await page.evaluate(({ a, b }) => window.__wmgTest?.swap(a, b), move);
      await expect.poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft).toBe(20 - (i + 1));
    }

    // Freeze before the last swap, then advance in 25ms slices until the result
    // panel exists. This removes wall-clock jitter from the 300ms lock check.
    const freezeAt = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(freezeAt + 1000);
    const last = WINNING_MOVES[WINNING_MOVES.length - 1]!;
    await page.evaluate(({ a, b }) => window.__wmgTest?.swap(a, b), last);

    let unlockAt: number | null = null;
    for (let guard = 0; guard < 240 && unlockAt === null; guard += 1) {
      await page.clock.runFor(25);
      unlockAt = await page.evaluate(() => window.__wmgTest?.panelUnlockAt() ?? null);
    }
    expect(unlockAt).not.toBeNull();
    await expect(page.locator('#panel-result')).toBeVisible();
    await expect(page.locator('#panel-result')).toContainText('胜利');
    await expect(page.locator('#panel-result')).toContainText('本局分数 2790');

    const nowAtPanel = await page.evaluate(() => performance.now());
    // Sanity: we paused within the 300ms lock window (panel shown at unlockAt-300).
    expect(unlockAt! - nowAtPanel).toBeGreaterThan(200);

    // t = panelShown + 200ms: click must be a no-op.
    await page.clock.runFor(unlockAt! - 100 - nowAtPanel);
    expect(await page.evaluate(() => performance.now())).toBeCloseTo(unlockAt! - 100, 3);
    const firstButton = page.locator('#panel-result button').first();
    expect(await firstButton.isDisabled()).toBe(true);
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('#panel-result button')?.click());
    expect(await page.locator('.dialog').count()).toBe(0);
    await expect(page.locator('#panel-result')).toBeVisible();

    // t = panelShown + 350ms: the unlock timer has fired and the click works.
    await page.clock.runFor(150);
    expect(await page.evaluate(() => performance.now())).toBeCloseTo(unlockAt! + 50, 3);
    expect(await firstButton.isDisabled()).toBe(false);
    await firstButton.click();
    await expect(page.locator('.dialog')).toContainText('重开本局');

    // Victory must have written both the local leaderboard and the save record.
    const evidence = await page.evaluate(() => {
      const leaderboard = JSON.parse(localStorage.getItem('wmg.leaderboard.v1') ?? 'null');
      const save = JSON.parse(localStorage.getItem('wmg.save.v1') ?? 'null');
      return { leaderboard, save };
    });
    expect(evidence.leaderboard.boardVersion).toBe(1);
    expect(evidence.leaderboard.records).toHaveLength(1);
    expect(evidence.leaderboard.records[0]).toMatchObject({
      levelId: 1,
      score: 2790,
      stars: 3,
      movesUsed: 6,
      seed: 1,
    });
    expect(evidence.save.unlockedLevelId).toBe(2);
    const levelOne = evidence.save.levelRecords.find((record: { levelId: number }) => record.levelId === 1);
    expect(levelOne).toMatchObject({ bestScore: 2790, bestStars: 3, clearCount: 1 });
    expect(evidence.save.stats.totalMoves).toBe(6);
    expect(evidence.save.lastSessionInterrupted).toBe(false);

    const artifact = {
      seed: 1,
      winningMoves: WINNING_MOVES,
      strictLock: { atPanelPlus200ms: 'disabled/no-op', atPanelPlus350ms: 'enabled/opened-confirm' },
      leaderboard: evidence.leaderboard,
      save: evidence.save,
    };
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/task-16-victory-evidence.json', JSON.stringify(artifact, null, 2));
  });
});


