import { expect, test } from '@playwright/test';

test.describe('REQ-028/REQ-033/REQ-043/REQ-047 设置与结算', () => {
  test('设置按钮 ≥44×44 且音量边界可操作', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__wmgTest?.openSettings());
    for (const button of await page.locator('#panel-settings button').all()) {
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('#set-bgmVolume').fill('0');
    await page.locator('#set-bgmVolume').dispatchEvent('change');
    await page.locator('#set-sfxVolume').fill('100');
    await page.locator('#set-sfxVolume').dispatchEvent('change');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wmg.save.v1') ?? '{}').settings);
    expect(stored.bgmVolume).toBe(0);
    expect(stored.sfxVolume).toBe(100);
  });

  test('重置进度回第 1 关并清空排行榜', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__wmgTest?.openSettings());
    await page.locator('#btn-reset-progress').click();
    await expect(page.locator('.dialog')).toContainText('不可恢复');
    await page.locator('.dialog .btn.danger').click();
    await expect(page.locator('.toast')).toContainText('游戏进度已重置');
    await expect(page.locator('[data-level-id="1"]')).toBeEnabled();
    await expect(page.locator('[data-level-id="2"]')).toBeDisabled();
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('wmg.save.v1') ?? '{}'));
    expect(save.unlockedLevelId).toBe(1);
  });
});
