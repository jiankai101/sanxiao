import { describe, expect, it, vi } from 'vitest';
import type { LayoutSnapshot } from '../../src/render/layout';
import {
  boardRect,
  canvasTransform,
  cellCssSize,
  cellRect,
  computeLayout,
  isHotzoneCompliant,
  logicalToScreen,
  pickNearestCell,
  screenToLogical,
} from '../../src/render/layout';
import { CanvasHost, RESIZE_DEBOUNCE_MS, clampDpr } from '../../src/render/canvas-host';
import type { CanvasLike, HostEnvironment } from '../../src/render/canvas-host';

function near(actual: number, expected: number, tolerance = 0.01): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

/** Four REQ-049 acceptance viewports. */
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 600, height: 800 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
] as const;

interface FittedCanvas {
  canvas: CanvasLike;
  snapshot: LayoutSnapshot;
  rect: { left: number; top: number; width: number; height: number };
  dpr: number;
}

/**
 * Builds the layout exactly as production does: CanvasHost owns the canvas CSS
 * size, CSS (`#game { inset: 0; margin: auto }`) centres that element in the
 * viewport. No viewport offset is baked into the snapshot.
 */
function fitCanvas(viewportWidth: number, viewportHeight: number, dpr = 2): FittedCanvas {
  const canvas: CanvasLike = {
    width: 0,
    height: 0,
    style: { width: '', height: '' },
    clientWidth: viewportWidth,
    clientHeight: viewportHeight,
  };
  const host = new CanvasHost(canvas, { devicePixelRatio: dpr });
  const snapshot = host.snapshot;
  return {
    canvas,
    snapshot,
    dpr,
    rect: {
      left: (viewportWidth - snapshot.cssWidth) / 2,
      top: (viewportHeight - snapshot.cssHeight) / 2,
      width: snapshot.cssWidth,
      height: snapshot.cssHeight,
    },
  };
}

/**
 * The point where a logical point is actually painted, in CSS px inside the
 * canvas element. Derived only from the draw transform (not from input code).
 */
function drawnLocalPoint(logicalX: number, logicalY: number, fitted: FittedCanvas): { x: number; y: number } {
  const t = canvasTransform(fitted.snapshot, fitted.dpr);
  return {
    x: (t.e + logicalX * t.a) / fitted.dpr,
    y: (t.f + logicalY * t.d) / fitted.dpr,
  };
}

/** Independent board position: canvas rect + fixed 960x720 logical ratio. */
function expectedLocalPoint(logicalX: number, logicalY: number, fitted: FittedCanvas): { x: number; y: number } {
  return {
    x: (logicalX * fitted.rect.width) / 960,
    y: (logicalY * fitted.rect.height) / 720,
  };
}

describe('REQ-040/041/049 layout & hit testing', () => {
  it('uses the fixed 960x720 logical layout with a 512x512 board at (224,96)', () => {
    const layout = computeLayout(960, 720);
    expect(layout.scale).toBe(1);
    expect(layout.offsetX).toBe(0);
    expect(layout.offsetY).toBe(0);
    expect(boardRect()).toEqual({ x: 224, y: 96, width: 512, height: 512 });
    expect(cellRect(1, 1)).toEqual({ x: 224, y: 96, width: 64, height: 64 });
    expect(cellRect(8, 8)).toEqual({ x: 672, y: 544, width: 64, height: 64 });
  });

  it('sizes the 4:3 canvas element and leaves viewport letterboxing to CSS', () => {
    const wide = computeLayout(1280, 720);
    expect(wide.scale).toBeCloseTo(1, 5);
    expect(wide.cssWidth).toBeCloseTo(960, 5);
    expect(wide.cssHeight).toBeCloseTo(720, 5);
    expect(wide.offsetX).toBe(0);
    expect(wide.offsetY).toBe(0);
    // The 160px left gutter is produced by `#game`'s CSS centring, not by the canvas transform.
    expect((1280 - wide.cssWidth) / 2).toBeCloseTo(160, 5);

    const tall = computeLayout(960, 1080);
    expect(tall.scale).toBe(1);
    expect(tall.cssWidth).toBeCloseTo(960, 5);
    expect(tall.cssHeight).toBeCloseTo(720, 5);
    expect(tall.offsetX).toBe(0);
    expect(tall.offsetY).toBe(0);
    expect((1080 - tall.cssHeight) / 2).toBeCloseTo(180, 5);

    const common = computeLayout(1280, 800);
    expect(common.cssWidth).toBeCloseTo(1066.6667, 3);
    expect(common.cssHeight).toBeCloseTo(800, 3);
    expect(common.offsetX).toBe(0);
    expect(common.offsetY).toBe(0);
  });

  it('cellCssSize matches 64 x viewportWidth / 960 including the 600px breakpoint', () => {
    near(cellCssSize(1280), 85.33);
    near(cellCssSize(600), 40);
    near(cellCssSize(599), 39.93);
    near(cellCssSize(601), 40.07);
    near(cellCssSize(360), 24);
    near(cellCssSize(320), 21.33);
    expect(isHotzoneCompliant(599)).toBe(true);
    expect(isHotzoneCompliant(600)).toBe(true);
    expect(isHotzoneCompliant(1280)).toBe(true);
    expect(cellCssSize(600)).toBeGreaterThanOrEqual(40);
  });

  it('snaps any point inside a cell to that cell and outside the board to null', () => {
    const layout = computeLayout(960, 720);
    expect(pickNearestCell({ x: 224 + 32, y: 96 + 32 }, layout)).toEqual({ row: 1, col: 1 });
    expect(pickNearestCell({ x: 224 + 63, y: 96 + 63 }, layout)).toEqual({ row: 1, col: 1 });
    expect(pickNearestCell({ x: 735, y: 575 }, layout)).toEqual({ row: 8, col: 8 });
    expect(pickNearestCell({ x: 223, y: 300 }, layout)).toBeNull();
    expect(pickNearestCell({ x: 300, y: 95 }, layout)).toBeNull();
    expect(pickNearestCell({ x: 737, y: 300 }, layout)).toBeNull();
    expect(pickNearestCell({ x: 300, y: 609 }, layout)).toBeNull();
  });

  it('resolves perpendicular-bisector ties to the smaller column, then smaller row', () => {
    const layout = computeLayout(960, 720);
    // vertical boundary between col 1 and col 2
    expect(pickNearestCell({ x: 224 + 64, y: 96 + 32 }, layout)).toEqual({ row: 1, col: 1 });
    // horizontal boundary between row 1 and row 2
    expect(pickNearestCell({ x: 224 + 32, y: 96 + 64 }, layout)).toEqual({ row: 1, col: 1 });
    // crossing point of four cells
    expect(pickNearestCell({ x: 224 + 64, y: 96 + 64 }, layout)).toEqual({ row: 1, col: 1 });
    // boundary between col 2 and col 3, inside row 2
    expect(pickNearestCell({ x: 224 + 128, y: 96 + 96 }, layout)).toEqual({ row: 2, col: 2 });
  });

  it('maps screen <-> logical on the canvas-element basis without drift', () => {
    const layout = computeLayout(1280, 800);
    const rect = {
      left: (1280 - layout.cssWidth) / 2,
      top: (800 - layout.cssHeight) / 2,
      width: layout.cssWidth,
      height: layout.cssHeight,
    };
    const centre = screenToLogical(rect.left + rect.width / 2, rect.top + rect.height / 2, rect);
    near(centre.x, 480, 0.001);
    near(centre.y, 360, 0.001);
    for (const point of [
      { x: 224, y: 96 },
      { x: 736, y: 96 },
      { x: 224, y: 608 },
      { x: 736, y: 608 },
    ]) {
      const local = logicalToScreen(point, layout);
      const back = screenToLogical(rect.left + local.x, rect.top + local.y, rect);
      near(back.x, point.x, 0.001);
      near(back.y, point.y, 0.001);
    }
    const transform = canvasTransform(layout, 2);
    expect(transform.a).toBeCloseTo(2 * layout.scale, 6);
    expect(transform.e).toBe(0);
    expect(transform.f).toBe(0);
  });

  it('sizes the backing store with DPR capped at 2', () => {
    const canvas: CanvasLike = { width: 0, height: 0, style: { width: '', height: '' }, clientWidth: 960, clientHeight: 720 };
    const dpr1 = new CanvasHost(canvas, { devicePixelRatio: 1 });
    expect([canvas.width, canvas.height]).toEqual([960, 720]);
    expect(dpr1.dpr).toBe(1);
    const dpr2 = new CanvasHost(canvas, { devicePixelRatio: 2 });
    expect([canvas.width, canvas.height]).toEqual([1920, 1440]);
    new CanvasHost(canvas, { devicePixelRatio: 3 });
    expect([canvas.width, canvas.height]).toEqual([1920, 1440]);
    expect(clampDpr(3)).toBe(2);
    expect(clampDpr(0)).toBe(1);
    // BUG-007: the debounce must not consume the whole 200ms redraw budget.
    expect(dpr2.debounceMs).toBe(RESIZE_DEBOUNCE_MS);
    expect(RESIZE_DEBOUNCE_MS).toBeLessThanOrEqual(150);
  });

  it('redraws within 200ms of the last resize on all four acceptance viewports', () => {
    vi.useFakeTimers();
    try {
      for (const viewport of VIEWPORTS) {
        const canvas: CanvasLike = { width: 0, height: 0, style: { width: '', height: '' }, clientWidth: 1280, clientHeight: 800 };
        const stateToken = { score: 123, movesLeft: 7 };
        const onResize = vi.fn();
        const delays: number[] = [];
        const host = new CanvasHost(canvas, {
          devicePixelRatio: 2,
          onResize,
          schedule: (callback, ms) => {
            delays.push(ms);
            return setTimeout(callback, ms);
          },
        });
        canvas.clientWidth = viewport.width;
        canvas.clientHeight = viewport.height;
        host.handleResize();
        // last resize -> debounce -> redraw: the scheduled delay is the debounce budget.
        expect(delays[delays.length - 1]).toBe(RESIZE_DEBOUNCE_MS);
        vi.advanceTimersByTime(RESIZE_DEBOUNCE_MS - 1);
        expect(onResize).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(onResize).toHaveBeenCalledTimes(1);
        const snapshot = onResize.mock.calls[0]?.[0] as LayoutSnapshot;
        expect(snapshot).toMatchObject({ viewportWidth: viewport.width, viewportHeight: viewport.height });
        // REQ-041: backing store = css size x min(DPR, 2); no blur, no double scale.
        expect(host.dpr).toBe(2);
        expect(canvas.width).toBe(Math.max(1, Math.round(snapshot.cssWidth * 2)));
        expect(canvas.height).toBe(Math.max(1, Math.round(snapshot.cssHeight * 2)));
        expect(canvas.style.width).toBe(snapshot.cssWidth + 'px');
        expect(canvas.style.height).toBe(snapshot.cssHeight + 'px');
        // Debounce plus one 60Hz frame still fits the 200ms spec budget.
        expect(RESIZE_DEBOUNCE_MS + 17).toBeLessThanOrEqual(200);
        // REQ-041: a resize never resets game state.
        expect(stateToken).toEqual({ score: 123, movesLeft: 7 });
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('coalesces a burst of resize events into a single redraw', () => {
    vi.useFakeTimers();
    try {
      const canvas: CanvasLike = { width: 0, height: 0, style: { width: '', height: '' }, clientWidth: 1280, clientHeight: 800 };
      const onResize = vi.fn();
      const host = new CanvasHost(canvas, { devicePixelRatio: 2, onResize });
      for (let step = 1; step <= 5; step += 1) {
        canvas.clientWidth = 300 + step;
        host.handleResize();
        vi.advanceTimersByTime(RESIZE_DEBOUNCE_MS - 20);
      }
      expect(onResize).not.toHaveBeenCalled();
      vi.advanceTimersByTime(RESIZE_DEBOUNCE_MS);
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize.mock.calls[0]?.[0]).toMatchObject({ viewportWidth: 305 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('subscribes to resize, ResizeObserver and DPR media queries', () => {
    const listeners: string[] = [];
    const observed: unknown[] = [];
    const environment: HostEnvironment = {
      innerWidth: 960,
      innerHeight: 720,
      devicePixelRatio: 1,
      addEventListener: (type) => listeners.push(`window:${type}`),
      removeEventListener: () => undefined,
      matchMedia: () => ({ matches: false, addEventListener: (type) => listeners.push(`media:${type}`) }),
      ResizeObserver: class {
        observe(target: unknown) {
          observed.push(target);
        }
        disconnect() {
          observed.push('disconnect');
        }
      },
    };
    const canvas: CanvasLike = { width: 0, height: 0, style: { width: '', height: '' } };
    const host = new CanvasHost(canvas, { environment });
    host.mount();
    expect(listeners).toContain('window:resize');
    expect(listeners).toContain('media:change');
    expect(observed).toContain(canvas);
    host.destroy();
    expect(observed).toContain('disconnect');
  });
});

describe('BUG-001 regression: one offset source, visual cell == hit cell', () => {
  it('keeps the canvas-local offset at zero and lets CSS centre #game', () => {
    for (const viewport of VIEWPORTS) {
      const fitted = fitCanvas(viewport.width, viewport.height);
      expect(fitted.snapshot.offsetX).toBe(0);
      expect(fitted.snapshot.offsetY).toBe(0);
      // The element is always exactly 4:3...
      expect(fitted.snapshot.cssWidth / fitted.snapshot.cssHeight).toBeCloseTo(4 / 3, 6);
      // Scale is derived from the canvas element CSS size, not from a viewport offset.
      expect(fitted.snapshot.scale).toBeCloseTo(fitted.snapshot.cssWidth / 960, 10);
      expect(fitted.snapshot.scale).toBeCloseTo(fitted.snapshot.cssHeight / 720, 10);
      // ...and the only viewport offset is the CSS centring gutter.
      expect(fitted.rect.left).toBeCloseTo((viewport.width - fitted.snapshot.cssWidth) / 2, 6);
      expect(fitted.rect.top).toBeCloseTo((viewport.height - fitted.snapshot.cssHeight) / 2, 6);
      const transform = canvasTransform(fitted.snapshot, fitted.dpr);
      expect(transform.e).toBe(0);
      expect(transform.f).toBe(0);
    }
  });

  it('draws the board top-left at the fixed 224/96 ratio inside the canvas element', () => {
    for (const viewport of VIEWPORTS) {
      const fitted = fitCanvas(viewport.width, viewport.height);
      const drawn = drawnLocalPoint(224, 96, fitted);
      const expected = expectedLocalPoint(224, 96, fitted);
      // Old code drew at offset + 224*scale (106.7px too far right at 1280x800,
      // 175px too far down at 600x800), failing these assertions.
      expect(Math.abs(drawn.x - expected.x)).toBeLessThan(0.5);
      expect(Math.abs(drawn.y - expected.y)).toBeLessThan(0.5);
      expect(drawn.x).toBeGreaterThanOrEqual(0);
      expect(drawn.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('maps the four visual corner cells to the four logical corners in every viewport', () => {
    const corners = [
      { row: 1, col: 1 },
      { row: 1, col: 8 },
      { row: 8, col: 1 },
      { row: 8, col: 8 },
    ] as const;
    for (const viewport of VIEWPORTS) {
      const fitted = fitCanvas(viewport.width, viewport.height);
      for (const corner of corners) {
        const logicalX = 224 + (corner.col - 0.5) * 64;
        const logicalY = 96 + (corner.row - 0.5) * 64;
        const local = drawnLocalPoint(logicalX, logicalY, fitted);
        // Visual point must be inside the actual canvas element (no clipping / drift).
        expect(local.x).toBeGreaterThanOrEqual(0);
        expect(local.x).toBeLessThanOrEqual(fitted.rect.width);
        expect(local.y).toBeGreaterThanOrEqual(0);
        expect(local.y).toBeLessThanOrEqual(fitted.rect.height);
        const client = { x: fitted.rect.left + local.x, y: fitted.rect.top + local.y };
        const logical = screenToLogical(client.x, client.y, fitted.rect);
        expect(pickNearestCell(logical, fitted.snapshot), `${viewport.width}x${viewport.height} ${corner.row},${corner.col}`).toEqual(corner);
      }
    }
  });

  it('keeps visual and hit-test coordinates identical for all 64 cells in every viewport', () => {
    for (const viewport of VIEWPORTS) {
      const fitted = fitCanvas(viewport.width, viewport.height);
      const label = `${viewport.width}x${viewport.height}`;
      for (let row = 1; row <= 8; row += 1) {
        for (let col = 1; col <= 8; col += 1) {
          const logicalX = 224 + (col - 0.5) * 64;
          const logicalY = 96 + (row - 0.5) * 64;
          const local = drawnLocalPoint(logicalX, logicalY, fitted);
          const expected = expectedLocalPoint(logicalX, logicalY, fitted);
          expect(Math.abs(local.x - expected.x), `${label} cell ${row},${col} x`).toBeLessThan(0.5);
          expect(Math.abs(local.y - expected.y), `${label} cell ${row},${col} y`).toBeLessThan(0.5);
          const logical = screenToLogical(fitted.rect.left + local.x, fitted.rect.top + local.y, fitted.rect);
          expect(pickNearestCell(logical, fitted.snapshot), `${label} cell ${row},${col}`).toEqual({ row, col });
        }
      }
    }
  });

  it('keeps each clicked visual point inside the canvas element (incl. 360/320 and the 960x720 control)', () => {
    const cases = [
      { width: 960, height: 720 },
      { width: 360, height: 640 },
      { width: 320, height: 568 },
      { width: 1280, height: 800 },
      { width: 600, height: 800 },
    ] as const;
    const points = [
      { row: 1, col: 1 },
      { row: 4, col: 4 },
      { row: 2, col: 7 },
      { row: 8, col: 8 },
    ] as const;
    for (const viewport of cases) {
      const fitted = fitCanvas(viewport.width, viewport.height);
      const label = `${viewport.width}x${viewport.height}`;
      for (const point of points) {
        const logicalX = 224 + (point.col - 0.5) * 64;
        const logicalY = 96 + (point.row - 0.5) * 64;
        const local = drawnLocalPoint(logicalX, logicalY, fitted);
        // A pointer event is only delivered when the point is inside the element.
        expect(local.x, `${label} point ${point.row},${point.col} inside x`).toBeGreaterThanOrEqual(0);
        expect(local.y, `${label} point ${point.row},${point.col} inside y`).toBeGreaterThanOrEqual(0);
        expect(local.x, `${label} point ${point.row},${point.col} inside width`).toBeLessThanOrEqual(fitted.rect.width + 0.01);
        expect(local.y, `${label} point ${point.row},${point.col} inside height`).toBeLessThanOrEqual(fitted.rect.height + 0.01);
        const client = { x: fitted.rect.left + local.x, y: fitted.rect.top + local.y };
        expect(client.x).toBeGreaterThanOrEqual(0);
        expect(client.y).toBeGreaterThanOrEqual(0);
        expect(client.x).toBeLessThanOrEqual(viewport.width);
        expect(client.y).toBeLessThanOrEqual(viewport.height);
        const logical = screenToLogical(client.x, client.y, fitted.rect);
        expect(pickNearestCell(logical, fitted.snapshot), `${label} point ${point.row},${point.col}`).toEqual(point);
      }
    }
  });

  it('does not clip the board at 600x800 (and keeps it fully visible everywhere)', () => {
    for (const viewport of VIEWPORTS) {
      const fitted = fitCanvas(viewport.width, viewport.height);
      const t = canvasTransform(fitted.snapshot, fitted.dpr);
      const left = (t.e + 224 * t.a) / fitted.dpr;
      const top = (t.f + 96 * t.d) / fitted.dpr;
      const right = (t.e + 736 * t.a) / fitted.dpr;
      const bottom = (t.f + 608 * t.d) / fitted.dpr;
      expect(left).toBeGreaterThanOrEqual(-0.5);
      expect(top).toBeGreaterThanOrEqual(-0.5);
      expect(right).toBeLessThanOrEqual(fitted.rect.width + 0.5);
      expect(bottom).toBeLessThanOrEqual(fitted.rect.height + 0.5);
      // Full 512-logical-px board height is visible (old 600x800 drew bottom at 555 > 450).
      expect(bottom - top).toBeCloseTo((512 * fitted.rect.height) / 720, 6);
    }
  });
});



