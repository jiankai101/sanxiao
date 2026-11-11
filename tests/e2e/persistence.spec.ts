import { expect, test } from '@playwright/test';
import { startLevel } from './helpers';

test.describe('REQ-030/REQ-031/REQ-032 存档持久化', () => {
  test('设置修改刷新后保留', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__wmgTest?.openSettings());
    await page.locator('#set-sfxEnabled').uncheck();
    await page.locator('#set-colorblindMode').check();
    await page.waitForTimeout(150);
    await page.reload();
    await page.evaluate(() => window.__wmgTest?.openSettings());
    await expect(page.locator('#set-sfxEnabled')).not.toBeChecked();
    await expect(page.locator('#set-colorblindMode')).toBeChecked();
  });

  test('损坏存档 → 备份 + 5s 提示 + 可进第 1 关', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('wmg.save.v1', '{broken'));
    await page.goto('/');
    await expect(page.locator('.toast')).toContainText('存档已重置');
    await expect(page.locator('[data-level-id="1"]')).toBeEnabled();
    const backupKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('wmg.backup.save.')),
    );
    expect(backupKeys.length).toBe(1);
    const raw = await page.evaluate(() => localStorage.getItem('wmg.save.v1'));
    expect(JSON.parse(raw ?? '{}').saveVersion).toBe(1);
  });

  test('中途刷新 → 提示「上一局已中断」一次，二次刷新不再提示', async ({ page }) => {
    await page.goto('/?seed=1234');
    await startLevel(page, 1);
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.locator('.toast')).toContainText('上一局已中断');
    const flag = await page.evaluate(() => JSON.parse(localStorage.getItem('wmg.save.v1') ?? '{}').lastSessionInterrupted);
    expect(flag).toBe(false);
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator('.toast')).toHaveCount(0);
  });
});
