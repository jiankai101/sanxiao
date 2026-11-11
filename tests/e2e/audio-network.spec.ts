import { expect, test } from '@playwright/test';
import { startLevel } from './helpers';

test.describe('REQ-034/REQ-051 网络与性能', () => {
  test('第三方请求为 0，本地排行榜文案可见', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('http://127.0.0.1:4173') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        external.push(url);
      }
    });
    await page.goto('/');
    await page.evaluate(() => window.__wmgTest?.openLeaderboard());
    await expect(page.locator('#panel-leaderboard')).toContainText('本地排行榜');
    await page.waitForTimeout(500);
    expect(external).toEqual([]);
  });

  test('3 秒对局采样：p95 帧间隔 ≤20ms', async ({ page }) => {
    await page.goto('/?seed=31415');
    await startLevel(page, 1);
    await page.waitForTimeout(3000);
    const perf = await page.evaluate(() => window.__wmgPerf?.() ?? null);
    expect(perf).not.toBeNull();
    expect(perf!.samples).toBeGreaterThan(60);
    expect(perf!.p95).toBeLessThanOrEqual(20);
  });
});
