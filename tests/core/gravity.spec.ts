import { describe, expect, it } from 'vitest';
import { applyGravity } from '../../src/core/board/gravity';
import { createRng } from '../../src/core/rng';
import { TILE_KINDS, TILE_KINDS_L5 } from '../../src/core/constants';
import type { Board } from '../../src/core/types';
import { checkerBoard, indexOf } from './support';

function clearCell(board: Board, row: number, col: number): void {
  const cell = board.cells[indexOf(row, col)];
  if (!cell) throw new Error('bad cell');
  cell.tile = null;
}

function assertNoFloating(board: Board): void {
  for (let col = 1; col <= 8; col += 1) {
    let sawEmptyBelow = false;
    for (let row = 8; row >= 1; row -= 1) {
      const cell = board.cells[indexOf(row, col)];
      if (!cell) throw new Error('bad cell');
      if (cell.obstacle && cell.obstacle.type !== 'ice') {
        sawEmptyBelow = false;
        continue;
      }
      if (cell.tile === null) sawEmptyBelow = true;
      else if (sawEmptyBelow) throw new Error(`floating tile at (${row},${col})`);
    }
  }
  for (const cell of board.cells) {
    if (cell.obstacle && cell.obstacle.type !== 'ice') {
      expect(cell.tile).toBeNull();
    } else {
      expect(cell.tile).not.toBeNull();
    }
  }
}

describe('REQ-008/023/024 gravity & refill', () => {
  it('drops tiles down a cleared column and refills the top', () => {
    const board = checkerBoard();
    const idAt7 = board.cells[indexOf(7, 1)]?.tile?.id;
    clearCell(board, 8, 1);
    const result = applyGravity(board, createRng(5), TILE_KINDS);
    expect(result.board.cells[indexOf(8, 1)]?.tile?.id).toBe(idAt7);
    expect(result.spawned).toContain(indexOf(1, 1));
    expect(result.moves.some((move) => move.to === indexOf(8, 1))).toBe(true);
    assertNoFloating(result.board);
  });

  it('does not let tiles pass a stone, but ice does not block', () => {
    const blocked = checkerBoard();
    blocked.cells[indexOf(5, 1)]!.obstacle = { type: 'stone', layers: 2 };
    blocked.cells[indexOf(5, 1)]!.tile = null;
    const aboveId = blocked.cells[indexOf(4, 1)]?.tile?.id;
    clearCell(blocked, 8, 1);
    const blockedResult = applyGravity(blocked, createRng(6), TILE_KINDS);
    expect(blockedResult.board.cells[indexOf(4, 1)]?.tile?.id).toBe(aboveId);
    assertNoFloating(blockedResult.board);

    const iced = checkerBoard();
    iced.cells[indexOf(5, 1)]!.obstacle = { type: 'ice', layers: 1 };
    const iceTileId = iced.cells[indexOf(5, 1)]?.tile?.id;
    clearCell(iced, 8, 1);
    const icedResult = applyGravity(iced, createRng(7), TILE_KINDS);
    expect(icedResult.board.cells[indexOf(6, 1)]?.tile?.id).toBe(iceTileId);
    expect(icedResult.board.cells[indexOf(5, 1)]?.obstacle).toEqual({ type: 'ice', layers: 1 });
    assertNoFloating(icedResult.board);
  });

  it('fills a stone cell once its last layer is gone (2 -> 1 -> 0)', () => {
    const board = checkerBoard();
    board.cells[indexOf(5, 1)]!.obstacle = { type: 'stone', layers: 2 };
    board.cells[indexOf(5, 1)]!.tile = null;
    board.cells[indexOf(5, 1)]!.obstacle = { type: 'stone', layers: 1 };
    board.cells[indexOf(5, 1)]!.obstacle = null;
    clearCell(board, 8, 1);
    const result = applyGravity(board, createRng(8), TILE_KINDS);
    expect(result.board.cells[indexOf(5, 1)]?.tile).not.toBeNull();
    assertNoFloating(result.board);
  });

  it('is uniform: 10,000 refills deviate less than 5% (5-kind level)', () => {
    const rng = createRng(0xabcdef);
    const counts = new Map<string, number>();
    const base = checkerBoard();
    let total = 0;
    for (let iteration = 0; iteration < 1250; iteration += 1) {
      const board = { ...base, cells: base.cells.map((cell) => ({ tile: cell.tile ? { ...cell.tile } : null, obstacle: cell.obstacle ? { ...cell.obstacle } : null })) };
      for (let col = 1; col <= 8; col += 1) clearCell(board, 8, col);
      const result = applyGravity(board, rng, TILE_KINDS_L5);
      for (const index of result.spawned) {
        const kind = result.board.cells[index]?.tile?.kind ?? 'none';
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
        total += 1;
      }
    }
    expect(total).toBe(10000);
    const expected = total / TILE_KINDS_L5.length;
    for (const kind of TILE_KINDS_L5) {
      const count = counts.get(kind) ?? 0;
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.05);
    }
  });

  it('leaves no undefined cells after a resolution-style clear', () => {
    const board = checkerBoard();
    for (let row = 6; row <= 8; row += 1) {
      for (let col = 2; col <= 4; col += 1) clearCell(board, row, col);
    }
    const result = applyGravity(board, createRng(11), TILE_KINDS);
    expect(result.board.cells).toHaveLength(64);
    assertNoFloating(result.board);
  });
});
