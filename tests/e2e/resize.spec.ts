import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startLevel } from './helpers';

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 600, height: 800 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
] as const;

interface ResizeProbe {
  startAt: number;
  mutatedAt: number;
  sets: number;
}

interface ResizeMeasurement {
  startAt: number;
  rebindMs: number;
  frameMs: number;
  sets: number;
  cssWidth: number;
  cssHeight: number;
  backWidth: number;
  backHeight: number;
  devicePixelRatio: number;
  state: { status: string; levelId: number; seed: number; score: number; movesLeft: number } | null;
}

/** Records the last resize event, canvas backing-store rebuilds and mutation timing. */
async function installProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const proto = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
    if (!proto || !proto.get || !proto.set) throw new Error('canvas width accessor missing');
    const probe: ResizeProbe = { startAt: 0, mutatedAt: 0, sets: 0 };
    (window as unknown as { __resizeProbe: ResizeProbe }).__resizeProbe = probe;
    Object.defineProperty(canvas, 'width', {
      configurable: true,
      get() {
        return proto.get!.call(this) as number;
      },
      set(value: number) {
        proto.set!.call(this, value);
        probe.sets += 1;
      },
    });
    const observer = new MutationObserver(() => {
      if (probe.startAt > 0 && probe.mutatedAt === 0) probe.mutatedAt = performance.now();
    });
    observer.observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
    window.addEventListener(
      'resize',
      () => {
        probe.startAt = performance.now();
        probe.mutatedAt = 0;
      },
      true,
    );
  });
}

async function measureResize(page: Page, viewport: { width: number; height: number }): Promise<ResizeMeasurement> {
  await page.evaluate(() => {
    const probe = (window as unknown as { __resizeProbe: ResizeProbe }).__resizeProbe;
    probe.startAt = 0;
    probe.mutatedAt = 0;
    probe.sets = 0;
  });
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.waitForFunction(
    () => (window as unknown as { __resizeProbe: ResizeProbe }).__resizeProbe.mutatedAt > 0,
    undefined,
    { polling: 10, timeout: 5000 },
  );
  const sample = await page.evaluate(() => {
    const probe = (window as unknown as { __resizeProbe: ResizeProbe }).__resizeProbe;
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    return {
      startAt: probe.startAt,
      mutatedAt: probe.mutatedAt,
      sets: probe.sets,
      cssWidth: Number.parseFloat(canvas.style.width),
      cssHeight: Number.parseFloat(canvas.style.height),
      backWidth: canvas.width,
      backHeight: canvas.height,
      devicePixelRatio: window.devicePixelRatio,
      state: window.__wmgTest?.state() ?? null,
    };
  });
  // The first painted frame after the backing store was rebuilt completes the redraw.
  const frameAt = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        requestAnimationFrame((timestamp) => resolve(timestamp));
      }),
  );
  return {
    startAt: sample.startAt,
    rebindMs: sample.mutatedAt - sample.startAt,
    frameMs: frameAt - sample.startAt,
    sets: sample.sets,
    cssWidth: sample.cssWidth,
    cssHeight: sample.cssHeight,
    backWidth: sample.backWidth,
    backHeight: sample.backHeight,
    devicePixelRatio: sample.devicePixelRatio,
    state: sample.state,
  };
}

function expectedCssWidth(viewport: { width: number; height: number }): number {
  return 960 * Math.min(viewport.width / 960, viewport.height / 720);
}

test.describe('REQ-041 缩放后 200ms 内完成重绘', () => {
  test('四视口 resize 后备缓冲重建与首帧重绘均不超过 200ms，且状态不重置', async ({ page }) => {
    await page.goto('/?seed=777');
    await startLevel(page, 1);
    await installProbe(page);
    const before = await page.evaluate(() => window.__wmgTest?.state() ?? null);
    expect(before).not.toBeNull();

    const evidence: string[] = [];
    for (const viewport of VIEWPORTS) {
      const metric = await measureResize(page, viewport);
      evidence.push(
        viewport.width +
          'x' +
          viewport.height +
          ': rebind=' +
          metric.rebindMs.toFixed(1) +
          'ms frame=' +
          metric.frameMs.toFixed(1) +
          'ms sets=' +
          metric.sets,
      );
      const context = evidence.join(' | ');
      // 最后一次 resize -> 防抖 -> 后备缓冲重建，整体必须落在 200ms 预算内。
      expect(metric.rebindMs, context).toBeLessThanOrEqual(200);
      // 后备缓冲重建后的首帧绘制同样不超过 200ms。
      expect(metric.frameMs, context).toBeLessThanOrEqual(200);
      expect(metric.rebindMs, context).toBeGreaterThanOrEqual(0);
      // 渲染分辨率 = min(DPR, 2)，CSS 尺寸与布局一致（不模糊、不重复缩放）。
      const clampedDpr = Math.min(metric.devicePixelRatio, 2);
      expect(metric.cssWidth, context).toBeCloseTo(expectedCssWidth(viewport), 1);
      expect(metric.cssHeight, context).toBeCloseTo((metric.cssWidth * 720) / 960, 1);
      expect(Math.abs(metric.backWidth - metric.cssWidth * clampedDpr), context).toBeLessThanOrEqual(1);
      expect(Math.abs(metric.backHeight - metric.cssHeight * clampedDpr), context).toBeLessThanOrEqual(1);
      expect(metric.backWidth / metric.cssWidth, context).toBeCloseTo(clampedDpr, 1);
      // 对局状态与步数不重置。
      expect(metric.state, context).toEqual(before);
    }
    console.log('REQ-041 resize evidence: ' + evidence.join(' | '));
  });

  test('连续 resize 抖动合并为一次后备缓冲重建', async ({ page }) => {
    await page.goto('/');
    await installProbe(page);
    const sets = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const probe = (window as unknown as { __resizeProbe: ResizeProbe }).__resizeProbe;
          probe.startAt = performance.now();
          probe.sets = 0;
          for (let index = 0; index < 5; index += 1) {
            setTimeout(() => window.dispatchEvent(new Event('resize')), index * 25);
          }
          setTimeout(() => resolve(probe.sets), 700);
        }),
    );
    expect(sets).toBe(1);
  });
});

test.describe('REQ-041 DPR clamp', () => {
  test.use({ deviceScaleFactor: 3 });

  test('DPR=3 时后备缓冲仍按 2 倍重建（不模糊、不超采样）', async ({ page }) => {
    await page.goto('/');
    await installProbe(page);
    const metric = await measureResize(page, { width: 360, height: 640 });
    const clampedDpr = Math.min(metric.devicePixelRatio, 2);
    expect(metric.devicePixelRatio).toBe(3);
    expect(clampedDpr).toBe(2);
    expect(metric.backWidth / metric.cssWidth).toBeCloseTo(2, 1);
    expect(Math.abs(metric.backWidth - metric.cssWidth * 2)).toBeLessThanOrEqual(1);
    expect(metric.rebindMs).toBeLessThanOrEqual(200);
    expect(metric.frameMs).toBeLessThanOrEqual(200);
  });
});
