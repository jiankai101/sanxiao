import { expect, test } from '@playwright/test';

test.describe('REQ-045/REQ-048 运行时音频行为', () => {
  test('REQ-045 首手势后 BGM 播放，页面隐藏暂停、恢复可见续播', async ({ page }) => {
    await page.goto('/?seed=1');
    const before = await page.evaluate(() => window.__wmgTest?.audio());
    expect(before?.playing).toBe(false);

    // 真实用户手势：点击第 1 关卡片（REQ-045 首次手势后开始播放）。
    await page.locator('.level-card[data-level-id="1"]').click();
    await expect
      .poll(async () => (await page.evaluate(() => window.__wmgTest?.audio()))?.playing, { timeout: 30_000 })
      .toBe(true);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect
      .poll(async () => (await page.evaluate(() => window.__wmgTest?.audio()))?.playing, { timeout: 10_000 })
      .toBe(false);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect
      .poll(async () => (await page.evaluate(() => window.__wmgTest?.audio()))?.playing, { timeout: 10_000 })
      .toBe(true);
  });

  test('REQ-048 音频加载/解码失败静默降级并显示「音频不可用」图标', async ({ page }) => {
    await page.route(/\.(ogg|mp3)(\?|$)/, (route) => route.abort());
    await page.goto('/?seed=1');
    await page.evaluate(() => window.__wmgTest?.startLevel(1));

    await expect
      .poll(async () => (await page.evaluate(() => window.__wmgTest?.audio()))?.unavailable, { timeout: 30_000 })
      .toBe(true);
    await expect(page.locator('#audio-badge')).toBeVisible();
    await expect(page.locator('#audio-badge')).toHaveText('音频不可用');

    // 静默降级：不弹窗、不白屏，对局仍可继续。
    await expect(page.locator('.dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.__wmgTest?.findMove() ?? null)).not.toBeNull();
    expect((await page.evaluate(() => window.__wmgTest?.state()))?.status).toBe('playing');
  });
});