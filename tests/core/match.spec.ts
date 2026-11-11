import { describe, expect, it } from 'vitest';
import { findMatches } from '../../src/core/match/detect';
import { createEmptyBoard } from '../../src/core/board/model';
import type { Board, TileKind } from '../../src/core/types';
import { indexOf, setTile } from './support';

function blank(): Board {
  return createEmptyBoard();
}

function fillLine(board: Board, row: number, cols: readonly number[], kind: TileKind): void {
  for (const col of cols) setTile(board, row, col, kind);
}

describe('REQ-007 match detection', () => {
  it('detects horizontal and vertical triples', () => {
    const h = blank();
    fillLine(h, 2, [2, 3, 4], 'star');
    expect(findMatches(h).runs).toHaveLength(1);
    expect(findMatches(h).runs[0]).toMatchObject({ orientation: 'h', length: 3, kind: 'star' });
    expect(findMatches(h).matched).toEqual([indexOf(2, 2), indexOf(2, 3), indexOf(2, 4)].sort((a, b) => a - b));

    const v = blank();
    setTile(v, 1, 5, 'water');
    setTile(v, 2, 5, 'water');
    setTile(v, 3, 5, 'water');
    const result = findMatches(v);
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]).toMatchObject({ orientation: 'v', length: 3 });
    expect(result.matched).toHaveLength(3);
  });

  it('detects 4 and 5 length runs', () => {
    const h4 = blank();
    fillLine(h4, 3, [1, 2, 3, 4], 'leaf');
    expect(findMatches(h4).runs[0]).toMatchObject({ length: 4, orientation: 'h' });

    const v5 = blank();
    for (let row = 2; row <= 6; row += 1) setTile(v5, row, 7, 'bolt');
    expect(findMatches(v5).runs[0]).toMatchObject({ length: 5, orientation: 'v' });
  });

  it('treats L and T shapes as the union with each crossing cell counted once', () => {
    const l = blank();
    fillLine(l, 2, [2, 3, 4], 'flame');
    setTile(l, 1, 2, 'flame');
    setTile(l, 2, 2, 'flame');
    setTile(l, 3, 2, 'flame');
    const lResult = findMatches(l);
    expect(lResult.runs).toHaveLength(2);
    expect(lResult.matched).toHaveLength(5);
    expect(new Set(lResult.matched).size).toBe(5);

    const t = blank();
    fillLine(t, 2, [2, 3, 4], 'crystal');
    setTile(t, 1, 3, 'crystal');
    setTile(t, 2, 3, 'crystal');
    setTile(t, 3, 3, 'crystal');
    const tResult = findMatches(t);
    expect(tResult.matched).toHaveLength(5);
  });

  it('returns a single length-6 run, never overlapping triples', () => {
    const board = blank();
    fillLine(board, 5, [1, 2, 3, 4, 5, 6], 'star');
    const runs = findMatches(board).runs;
    expect(runs).toHaveLength(1);
    expect(runs[0]?.length).toBe(6);
    expect(findMatches(board).matched).toHaveLength(6);
  });

  it('matches ice-covered tiles and skips stone/hole cells', () => {
    const board = blank();
    for (let col = 1; col <= 3; col += 1) {
      const cell = board.cells[indexOf(2, col)];
      if (!cell) throw new Error('bad cell');
      cell.obstacle = { type: 'ice', layers: 1 };
      setTile(board, 2, col, 'water');
    }
    expect(findMatches(board).matched).toHaveLength(3);

    const blocked = blank();
    for (let col = 1; col <= 3; col += 1) {
      const cell = blocked.cells[indexOf(3, col)];
      if (!cell) throw new Error('bad cell');
      cell.obstacle = col === 2 ? { type: 'hole' } : { type: 'stone', layers: 2 };
    }
    expect(findMatches(blocked).runs).toHaveLength(0);
  });
});
