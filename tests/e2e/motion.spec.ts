import { expect, test } from '@playwright/test';
import { dragCell, startLevel } from './helpers';

test.describe('REQ-044 visible tween wiring + favicon', () => {
  test('declares an inline favicon and loads with no console error or 404', async ({ page }) => {
    const errors: string[] = [];
    const failed: Array<{ url: string; status: number }> = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() });
    });

    await page.goto('/');
    await expect(page.locator('#screen-level-select')).toBeVisible();
    await page.waitForTimeout(500);

    const icon = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(icon).toContain('data:image/svg+xml');
    expect(failed).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('exposes the six REQ-044 durations and records real swap/clear/fall tweens', async ({ page }) => {
    await page.goto('/?seed=424242');
    await startLevel(page, 1);

    const durations = await page.evaluate(() => window.__wmgTest?.motionDurations());
    expect(durations?.full).toEqual({ swap: 150, revert: 200, clear: 180, fall: 160, special: 300, panel: 200 });
    for (const value of Object.values(durations?.reduced ?? {})) expect(value).toBeLessThanOrEqual(100);

    await page.evaluate(() => window.__wmgTest?.resetAnimations());
    const move = await page.evaluate(() => window.__wmgTest?.findMove() ?? null);
    expect(move).not.toBeNull();
    await dragCell(page, move!.a, move!.b);
    await expect.poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft).toBe(19);

    const trace = (await page.evaluate(() => window.__wmgTest?.animations())) ?? [];
    const find = (kind: string) => trace.find((entry) => entry.kind === kind);
    expect(find('swap')?.durationMs).toBe(150);
    expect(find('clear')?.durationMs).toBe(180);
    expect(find('fall')?.durationMs).toBe(160);

    const perf = await page.evaluate(() => window.__wmgPerf?.());
    expect(perf?.p95 ?? 0).toBeLessThanOrEqual(20);
  });

  test('swap draws a distinct intermediate canvas frame (visible interpolation)', async ({ page }) => {
    await page.goto('/?seed=424242');
    await startLevel(page, 1);
    const snapshot = () => page.evaluate(() => (document.getElementById('game') as HTMLCanvasElement).toDataURL('image/png'));
    const before = await snapshot();
    const move = await page.evaluate(() => window.__wmgTest?.findMove() ?? null);
    expect(move).not.toBeNull();
    await dragCell(page, move!.a, move!.b);
    await page.waitForTimeout(60);
    const mid = await snapshot();
    await expect.poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft).toBe(19);
    await page.waitForTimeout(200);
    const after = await snapshot();
    expect(mid).not.toBe(before);
    expect(mid).not.toBe(after);
  });

  test('invalid revert (200ms) and special creation (300ms) animate on screen', async ({ page }) => {
    await page.goto('/?seed=1');
    await startLevel(page, 1);
    const snapshot = () => page.evaluate(() => (document.getElementById('game') as HTMLCanvasElement).toDataURL('image/png'));

    await page.evaluate(() => window.__wmgTest?.resetAnimations());
    const beforeInvalid = await snapshot();
    await page.evaluate(() => window.__wmgTest?.swap({ row: 1, col: 1 }, { row: 1, col: 2 }));
    await page.waitForTimeout(70);
    expect(await snapshot()).not.toBe(beforeInvalid);
    await page.waitForTimeout(220);
    expect((await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft).toBe(20);
    const revert = (await page.evaluate(() => window.__wmgTest?.animations()))?.find((entry) => entry.kind === 'revert');
    expect(revert?.durationMs).toBe(200);

    await page.evaluate(() => window.__wmgTest?.resetAnimations());
    const beforeSpecial = await snapshot();
    await page.evaluate(() => window.__wmgTest?.swap({ row: 2, col: 3 }, { row: 3, col: 3 }));
    await page.waitForTimeout(70);
    expect(await snapshot()).not.toBe(beforeSpecial);
    await page.waitForTimeout(120);
    expect(await snapshot()).not.toBe(beforeSpecial);
    await expect.poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft).toBe(19);
    const trace = (await page.evaluate(() => window.__wmgTest?.animations())) ?? [];
    expect(trace.find((entry) => entry.kind === 'special')?.durationMs).toBe(300);
  });

  test('panel fade uses 200ms and 100ms under reduced motion', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#screen-level-select')).toBeVisible();
    await page.evaluate(() => window.__wmgTest?.openSettings());
    const normal = await page.locator('#panel-settings').evaluate((el) => {
      const style = getComputedStyle(el);
      return { name: style.animationName, duration: style.animationDuration };
    });
    expect(normal.name).toBe('panel-fade-in');
    expect(normal.duration).toBe('0.2s');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(page.locator('#screen-level-select')).toBeVisible();
    await page.evaluate(() => window.__wmgTest?.openSettings());
    const reduced = await page.locator('#panel-settings').evaluate((el) => getComputedStyle(el).animationDuration);
    expect(reduced).toBe('0.1s');
  });
});



