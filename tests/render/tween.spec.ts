import { describe, expect, it } from 'vitest';
import { createEmptyBoard, issueTile } from '../../src/core/board/model';
import { CELL_SIZE } from '../../src/core/constants';
import { drawBoard } from '../../src/render/board-renderer';
import { REDUCED_MOTION, durationFor, tweenOffset } from '../../src/render/animation';
import type { AnimationKind } from '../../src/render/animation';
import { drawTiles, tweenedRect } from '../../src/render/tile-renderer';
import { cellOffset, progressAt, resolveTileTween } from '../../src/render/tween';
import type { Board } from '../../src/core/types';
import { callsOf, createMockContext } from './mock-ctx';
import type { MockContext } from './mock-ctx';

const images = { get: (name: string) => `img:${name}` };
const KINDS: AnimationKind[] = ['swap', 'revert', 'clear', 'fall', 'special', 'panel'];

function boardWithTiles(): Board {
  const board = createEmptyBoard();
  board.cells[0]!.tile = issueTile(board, 'star');
  board.cells[1]!.tile = issueTile(board, 'water');
  return board;
}

type AlphaAwareContext = MockContext & { globalAlpha?: number };

/** Records ctx.globalAlpha at the moment each drawn image is issued. */
function alphaTrackingContext(): { ctx: MockContext; alphas: Array<number | undefined> } {
  const ctx = createMockContext() as AlphaAwareContext;
  const alphas: Array<number | undefined> = [];
  const record = ctx.drawImage;
  ctx.drawImage = (image: unknown, x: number, y: number, w: number, h: number) => {
    alphas.push(ctx.globalAlpha);
    record(image, x, y, w, h);
  };
  return { ctx, alphas };
}

describe('REQ-044 tween progress function', () => {
  it('returns 0 / 0.5 / 1 at the start, midpoint and end of a linear tween', () => {
    expect(progressAt(0, 180)).toBe(0);
    expect(progressAt(90, 180)).toBe(0.5);
    expect(progressAt(180, 180)).toBe(1);
  });

  it('truncates elapsed > duration and clamps negative elapsed', () => {
    expect(progressAt(500, 180)).toBe(1);
    expect(progressAt(-20, 180)).toBe(0);
  });

  it('returns 1 immediately when duration is 0 (instant / reduced-motion snap)', () => {
    expect(progressAt(0, 0)).toBe(1);
    expect(progressAt(50, 0)).toBe(1);
  });

  it('applies the requested easing curve and stays inside 0..1', () => {
    expect(progressAt(90, 180, 'easeOutCubic')).toBeGreaterThan(0.5);
    expect(progressAt(90, 180, 'easeInQuad')).toBeLessThan(0.5);
    expect(progressAt(180, 180, 'easeOutCubic')).toBe(1);
    expect(progressAt(0, 180, 'easeInOut')).toBe(0);
    for (const elapsed of [0, 1, 45, 90, 135, 179, 180, 400]) {
      const p = progressAt(elapsed, 180, 'easeInOut');
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe('REQ-044 per-tile tween drawing', () => {
  it('keeps the current draw args exactly when no tween is supplied', () => {
    const ctx = createMockContext();
    drawTiles(ctx, boardWithTiles(), { images });
    expect(callsOf(ctx, 'drawImage').map((call) => call.args)).toEqual([
      ['img:tile-star.webp', 224, 96, 64, 64],
      ['img:tile-water.webp', 288, 96, 64, 64],
    ]);
  });

  it('translates the tile target rect by the px offset', () => {
    const ctx = createMockContext();
    drawTiles(ctx, boardWithTiles(), { images, tweens: new Map([[0, { offsetX: 32, offsetY: -16 }]]) });
    expect(callsOf(ctx, 'drawImage')[0]?.args).toEqual(['img:tile-star.webp', 256, 80, 64, 64]);
    expect(callsOf(ctx, 'drawImage')[1]?.args).toEqual(['img:tile-water.webp', 288, 96, 64, 64]);
  });

  it('accepts cell-ratio offsets (1 = one 64px cell)', () => {
    const ctx = createMockContext();
    drawTiles(ctx, boardWithTiles(), { images, tweens: new Map([[0, { offsetX: 1, offsetY: 1, unit: 'cell' }]]) });
    expect(callsOf(ctx, 'drawImage')[0]?.args).toEqual(['img:tile-star.webp', 224 + CELL_SIZE, 96 + CELL_SIZE, 64, 64]);
    expect(cellOffset(1, -1)).toEqual({ offsetX: 64, offsetY: -64 });
  });

  it('scales about the tile centre for clear fade-out', () => {
    const ctx = createMockContext();
    drawTiles(ctx, boardWithTiles(), { images, tweens: new Map([[0, { scale: 0.5 }]]) });
    expect(callsOf(ctx, 'drawImage')[0]?.args).toEqual(['img:tile-star.webp', 224 + 16, 96 + 16, 32, 32]);
    expect(tweenedRect({ x: 224, y: 96, width: 64, height: 64 }, { offsetX: 0, offsetY: 0, alpha: 1, scale: 0.5 }))
      .toEqual({ x: 240, y: 112, width: 32, height: 32 });
  });

  it('applies alpha while drawing and restores globalAlpha afterwards', () => {
    const { ctx, alphas } = alphaTrackingContext();
    drawTiles(ctx, boardWithTiles(), { images, tweens: new Map([[0, { alpha: 0.25 }]]) });
    expect(alphas[0]).toBe(0.25);
    expect(alphas[1]).toBe(1);
    expect((ctx as AlphaAwareContext).globalAlpha).toBe(1);
    expect(callsOf(ctx, 'drawImage')[0]?.args).toEqual(['img:tile-star.webp', 224, 96, 64, 64]);
  });

  it('skips fully transparent tiles', () => {
    const ctx = createMockContext();
    drawTiles(ctx, boardWithTiles(), { images, tweens: new Map([[0, { alpha: 0 }]]) });
    expect(callsOf(ctx, 'drawImage')).toHaveLength(1);
    expect(callsOf(ctx, 'drawImage')[0]?.args[0]).toBe('img:tile-water.webp');
  });

  it('passes tweens through drawBoard (scene layer entry point)', () => {
    const ctx = createMockContext();
    drawBoard(ctx, boardWithTiles(), { images, tweens: new Map([[1, { offsetY: -32, alpha: 0.5 }]]) });
    const draws = callsOf(ctx, 'drawImage').filter((call) => String(call.args[0]).startsWith('img:tile-'));
    expect(draws[1]?.args).toEqual(['img:tile-water.webp', 288, 64, 64, 64]);
  });
});

describe('REQ-044 reduced motion keeps the API but drops displacement', () => {
  it('zeroes offsets for reduced motion while keeping alpha/scale', () => {
    const resolved = resolveTileTween({ offsetX: 2, offsetY: -1, unit: 'cell', alpha: 0.5, scale: 0.8 }, REDUCED_MOTION);
    expect(resolved).toEqual({ offsetX: 0, offsetY: 0, alpha: 0.5, scale: 0.8 });
  });

  it('draws at the unshifted rect under reduced motion', () => {
    const ctx = createMockContext();
    drawTiles(ctx, boardWithTiles(), {
      images,
      motion: REDUCED_MOTION,
      tweens: new Map([[0, { offsetX: 1, offsetY: 1, unit: 'cell', alpha: 0.4 }]]),
    });
    expect(callsOf(ctx, 'drawImage')[0]?.args).toEqual(['img:tile-star.webp', 224, 96, 64, 64]);
  });

  it('keeps TASK-021 guarantees: tweenOffset always 0 and every duration <= 100ms', () => {
    expect(tweenOffset(0, REDUCED_MOTION)).toBe(0);
    expect(tweenOffset(0.5, REDUCED_MOTION)).toBe(0);
    expect(tweenOffset(1, REDUCED_MOTION)).toBe(0);
    for (const kind of KINDS) {
      expect(durationFor(kind, REDUCED_MOTION)).toBeLessThanOrEqual(100);
    }
  });
});
