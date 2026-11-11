import { expect, test } from '@playwright/test';

test.describe('REQ-021 选关与解锁', () => {
  test('初始仅第 1 关可点，其余锁定并显示提示', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.level-card');
    await expect(cards).toHaveCount(8);
    await expect(page.locator('[data-level-id="1"]')).toBeEnabled();
    for (let id = 2; id <= 8; id += 1) {
      await expect(page.locator(`[data-level-id="${id}"]`)).toBeDisabled();
      await expect(page.locator(`[data-level-id="${id}"]`)).toContainText('通过上一关解锁');
    }
    await expect(page.locator('[data-level-id="2"]')).toContainText('初潮');
  });

  test('每张卡片显示名称/星级/最高分', async ({ page }) => {
    await page.goto('/');
    const first = page.locator('[data-level-id="1"]');
    await expect(first).toContainText('起步');
    await expect(first.locator('.level-stars')).toContainText('☆☆☆');
    await expect(first).toContainText('最高分 0');
  });
});
