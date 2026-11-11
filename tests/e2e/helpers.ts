import type { Page } from '@playwright/test';

/** 棋盘格中心 → 页面坐标（canvas 已等比缩放并居中）。 */
export async function cellPoint(page: Page, row: number, col: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('#game').boundingBox();
  if (!box) throw new Error('canvas not visible');
  const scale = box.width / 960;
  return {
    x: box.x + (224 + (col - 0.5) * 64) * scale,
    y: box.y + (96 + (row - 0.5) * 64) * scale,
  };
}

/** 棋盘格边界（相邻格中垂线）→ 页面坐标；用于构造「贴近边界」的按下点。 */
export async function cellBoundaryPoint(
  page: Page,
  row: number,
  col: number,
  edge: 'left' | 'right' | 'top' | 'bottom',
): Promise<{ x: number; y: number }> {
  const box = await page.locator('#game').boundingBox();
  if (!box) throw new Error('canvas not visible');
  const scale = box.width / 960;
  const centerX = box.x + (224 + (col - 0.5) * 64) * scale;
  const centerY = box.y + (96 + (row - 0.5) * 64) * scale;
  switch (edge) {
    case 'left':
      return { x: box.x + (224 + (col - 1) * 64) * scale, y: centerY };
    case 'right':
      return { x: box.x + (224 + col * 64) * scale, y: centerY };
    case 'top':
      return { x: centerX, y: box.y + (96 + (row - 1) * 64) * scale };
    case 'bottom':
      return { x: centerX, y: box.y + (96 + row * 64) * scale };
  }
}

/** 当前页面中一个视觉格的 CSS 像素尺寸（用于构造 < 0.5 格位移）。 */
export async function cellCssPx(page: Page): Promise<number> {
  const box = await page.locator('#game').boundingBox();
  if (!box) throw new Error('canvas not visible');
  return (64 * box.width) / 960;
}

export async function dragCell(page: Page, from: { row: number; col: number }, to: { row: number; col: number }): Promise<void> {
  const a = await cellPoint(page, from.row, from.col);
  const b = await cellPoint(page, to.row, to.col);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

export async function startLevel(page: Page, levelId = 1): Promise<void> {
  await page.evaluate((id) => window.__wmgTest?.startLevel(id), levelId);
  await page.waitForTimeout(150);
}
