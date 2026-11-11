import { expect, test } from '@playwright/test';

test.describe('REQ-034/REQ-037/REQ-038 本地排行榜界面', () => {
  test('标题、空态、上限提示与禁用词', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__wmgTest?.openLeaderboard());
    const panel = page.locator('#panel-leaderboard');
    await expect(panel).toBeVisible();
    await expect(panel.locator('h2')).toHaveText('本地排行榜');
    await expect(panel).toContainText('暂无记录');
    await expect(panel).toContainText('本机记录上限 20 条');
    const text = await panel.innerText();
    for (const word of ['全球', '在线', '全服', '服务器排名']) {
      expect(text.includes(word)).toBe(false);
    }
  });

  test('清空入口二次确认并保持空态', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__wmgTest?.openLeaderboard());
    await page.locator('#btn-leaderboard-clear').click();
    await expect(page.locator('.dialog')).toContainText('本地排行榜数据不可恢复');
    await page.locator('.dialog .btn.danger').click();
    await expect(page.locator('#panel-leaderboard')).toContainText('暂无记录');
    await expect(page.locator('.toast')).toContainText('本地排行榜已清空');
  });
});
