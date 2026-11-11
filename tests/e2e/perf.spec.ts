import { expect, test } from '@playwright/test';
import { startLevel } from './helpers';

test.describe('REQ-051 本地静态构建', () => {
  test('dist 预览可打开且无启动错误', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('#screen-level-select')).toBeVisible();
    await startLevel(page, 1);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});
