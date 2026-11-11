import { describe, expect, it } from 'vitest';
import { boardSlotRects, drawBoard, drawBoardBase, slotRectAt } from '../../src/render/board-renderer';
import { drawTiles, TILE_SYMBOLS } from '../../src/render/tile-renderer';
import { createEmptyBoard, issueTile } from '../../src/core/board/model';
import type { Board, TileKind } from '../../src/core/types';
import { callsOf, createMockContext } from './mock-ctx';

const images = { get: (name: string) => `img:${name}` };
const KINDS: TileKind[] = ['star', 'water', 'leaf', 'flame', 'crystal', 'bolt'];

function sixTiles(): Board {
  const board = createEmptyBoard();
  KINDS.forEach((kind, i) => {
    board.cells[i]!.tile = issueTile(board, kind);
  });
  return board;
}

describe('REQ-039/040/043 board & tile drawing', () => {
  it('exposes 64 slots aligned to (224 + col*64, 96 + row*64)', () => {
    const rects = boardSlotRects();
    expect(rects).toHaveLength(64);
    for (let row = 1; row <= 8; row += 1) {
      for (let col = 1; col <= 8; col += 1) {
        const rect = rects[(row - 1) * 8 + (col - 1)];
        expect(rect).toEqual({ x: 224 + (col - 1) * 64, y: 96 + (row - 1) * 64, width: 64, height: 64 });
      }
    }
    expect(slotRectAt(63)).toEqual({ x: 672, y: 544, width: 64, height: 64 });
  });

  it('paints 64 slot rectangles when no images are available', () => {
    const ctx = createMockContext();
    drawBoardBase(ctx, createEmptyBoard());
    expect(callsOf(ctx, 'fillRect')).toHaveLength(64);
  });

  it('draws each tile as a 64x64 rect with six distinct images', () => {
    const ctx = createMockContext();
    drawTiles(ctx, sixTiles(), { images });
    const draws = callsOf(ctx, 'drawImage');
    expect(draws).toHaveLength(6);
    expect(new Set(draws.map((call) => call.args[0]))).toEqual(new Set(KINDS.map((kind) => `img:tile-${kind}.webp`)));
    for (const call of draws) {
      expect(call.args[3]).toBe(64);
      expect(call.args[4]).toBe(64);
    }
    expect(draws[0]?.args.slice(1, 3)).toEqual([224, 96]);
    expect(draws[5]?.args.slice(1, 3)).toEqual([224 + 5 * 64, 96]);
  });

  it('draws ice beneath the tile and stones with the right layer art', () => {
    const board = createEmptyBoard();
    board.cells[0]!.obstacle = { type: 'ice', layers: 1 };
    board.cells[0]!.tile = issueTile(board, 'star');
    board.cells[1]!.obstacle = { type: 'stone', layers: 2 };
    board.cells[2]!.obstacle = { type: 'stone', layers: 1 };
    board.cells[3]!.obstacle = { type: 'hole' };
    const ctx = createMockContext();
    drawBoard(ctx, board, { images });
    const names = callsOf(ctx, 'drawImage').map((call) => call.args[0]);
    expect(names.indexOf('img:obs-ice.webp')).toBeLessThan(names.indexOf('img:tile-star.webp'));
    expect(names).toContain('img:obs-stone-2.webp');
    expect(names).toContain('img:obs-stone-1.webp');
    expect(names).toContain('img:obs-hole.webp');
  });

  it('adds colorblind symbols for all six kinds only when enabled', () => {
    const on = createMockContext();
    drawTiles(on, sixTiles(), { images, colorblind: true });
    const symbols = callsOf(on, 'fillText').map((call) => call.args[0]);
    expect(new Set(symbols)).toEqual(new Set(Object.values(TILE_SYMBOLS)));
    expect(symbols).toHaveLength(6);

    const off = createMockContext();
    drawTiles(off, sixTiles(), { images, colorblind: false });
    expect(callsOf(off, 'fillText')).toHaveLength(0);
  });

  it('highlights the selected cell with a 64x64 stroke', () => {
    const ctx = createMockContext();
    drawTiles(ctx, sixTiles(), { images, selected: 0 });
    expect(callsOf(ctx, 'strokeRect')).toContainEqual({ op: 'strokeRect', args: [224, 96, 64, 64] });
  });

  it('falls back to procedural shapes when textures are missing', () => {
    const ctx = createMockContext();
    drawTiles(ctx, sixTiles(), {});
    expect(callsOf(ctx, 'drawImage')).toHaveLength(0);
    expect(callsOf(ctx, 'fill').length).toBeGreaterThanOrEqual(6);
  });
});
