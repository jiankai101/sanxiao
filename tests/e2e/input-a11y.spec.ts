import { expect, test } from '@playwright/test';
import { dragCell, startLevel } from './helpers';

const VIEWPORTS = [
  { width: 1280, height: 800, min: 40 },
  { width: 600, height: 800, min: 40 },
  { width: 360, height: 640, min: 0 },
  { width: 320, height: 568, min: 0 },
];

for (const viewport of VIEWPORTS) {
  test(`REQ-049 ${viewport.width}×${viewport.height} 单格热区尺寸`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?seed=777');
    await startLevel(page, 1);
    const box = await page.locator('#game').boundingBox();
    expect(box).not.toBeNull();
    const cellCss = (box!.width * (512 / 960)) / 8;
    if (viewport.width >= 600) {
      expect(cellCss).toBeGreaterThanOrEqual(viewport.min - 1e-6);
    } else {
      expect(Math.abs(cellCss - (64 * viewport.width) / 960)).toBeLessThanOrEqual(0.5);
    }
    const live = await page.locator('#game-live').textContent();
    expect(live).toMatch(/^分数 \d+，剩余步数 \d+，目标 .+$/);
  });
}

test.describe('REQ-003 输入等价', () => {
  test('鼠标拖拽产生有效交换并扣 1 步', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?seed=20261110');
    await startLevel(page, 1);
    const move = await page.evaluate(() => window.__wmgTest?.findMove() ?? null);
    expect(move).not.toBeNull();
    await dragCell(page, move!.a, move!.b);
    await expect.poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft).toBe(19);
    const state = await page.evaluate(() => window.__wmgTest?.state());
    expect(state!.score).toBeGreaterThan(0);
  });

  test('两段点击与拖拽等价', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/?seed=8888');
    await startLevel(page, 1);
    const move = await page.evaluate(() => window.__wmgTest?.findMove() ?? null);
    expect(move).not.toBeNull();
    const box = await page.locator('#game').boundingBox();
    const scale = box!.width / 960;
    const a = { x: box!.x + (224 + (move!.a.col - 0.5) * 64) * scale, y: box!.y + (96 + (move!.a.row - 0.5) * 64) * scale };
    const b = { x: box!.x + (224 + (move!.b.col - 0.5) * 64) * scale, y: box!.y + (96 + (move!.b.row - 0.5) * 64) * scale };
    await page.mouse.click(a.x, a.y);
    await page.mouse.click(b.x, b.y);
    await expect.poll(async () => (await page.evaluate(() => window.__wmgTest?.state()))?.movesLeft).toBe(19);
  });
});
