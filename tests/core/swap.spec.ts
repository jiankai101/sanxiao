import { describe, expect, it } from 'vitest';
import { inspectSwap } from '../../src/core/board/swap';
import { createEmptyBoard, boardsEqual, issueTile } from '../../src/core/board/model';
import type { Board } from '../../src/core/types';
import { indexOf, setTile } from './support';

function swapBoard(): Board {
  const board = createEmptyBoard();
  setTile(board, 4, 1, 'star');
  setTile(board, 5, 1, 'star');
  setTile(board, 6, 1, 'star');
  setTile(board, 4, 2, 'water');
  setTile(board, 5, 2, 'leaf');
  setTile(board, 6, 3, 'leaf');
  return board;
}

describe('REQ-003/004/005/006 swap validation', () => {
  it('accepts a swap that creates a triple and keeps it', () => {
    const board = createEmptyBoard();
    setTile(board, 1, 1, 'star');
    setTile(board, 1, 2, 'star');
    setTile(board, 1, 3, 'water');
    setTile(board, 2, 3, 'star');
    const check = inspectSwap(board, indexOf(1, 3), indexOf(2, 3));
    expect(check.valid).toBe(true);
    expect(check.reason).toBeNull();
    expect(check.runs.some((run) => run.length >= 3)).toBe(true);
    expect(check.board.cells[indexOf(1, 3)]?.tile?.kind).toBe('star');
    expect(board.cells[indexOf(1, 3)]?.tile?.kind).toBe('water');
  });

  it('rejects out-of-bounds, same-cell, non-adjacent and blocked swaps without touching the board', () => {
    const board = swapBoard();
    const snapshot = JSON.parse(JSON.stringify(board)) as Board;
    expect(inspectSwap(board, -1, 0)).toMatchObject({ valid: false, reason: 'blocked' });
    expect(inspectSwap(board, 0, 64)).toMatchObject({ valid: false, reason: 'blocked' });
    expect(inspectSwap(board, 5, 5)).toMatchObject({ valid: false, reason: 'not-adjacent' });
    expect(inspectSwap(board, indexOf(1, 1), indexOf(3, 3))).toMatchObject({ valid: false, reason: 'not-adjacent' });

    const blocked = createEmptyBoard();
    const cell = blocked.cells[indexOf(2, 2)];
    if (!cell) throw new Error('bad cell');
    cell.obstacle = { type: 'stone', layers: 2 };
    setTile(blocked, 2, 1, 'star');
    expect(inspectSwap(blocked, indexOf(2, 1), indexOf(2, 2))).toMatchObject({ valid: false, reason: 'blocked' });

    expect(boardsEqual(board, snapshot)).toBe(true);
  });

  it('rolls back a swap that produces no match', () => {
    const board = createEmptyBoard();
    setTile(board, 1, 1, 'star');
    setTile(board, 1, 2, 'water');
    const before = JSON.parse(JSON.stringify(board)) as Board;
    const check = inspectSwap(board, indexOf(1, 1), indexOf(1, 2));
    expect(check.valid).toBe(false);
    expect(check.reason).toBe('no-match');
    expect(boardsEqual(check.board, before)).toBe(true);
  });

  it('accepts rainbow+plain and rainbow+rainbow even without a triple', () => {
    const withPlain = createEmptyBoard();
    withPlain.cells[indexOf(1, 1)]!.tile = issueTile(withPlain, 'star', 'rainbow');
    withPlain.cells[indexOf(1, 2)]!.tile = issueTile(withPlain, 'water');
    const plain = inspectSwap(withPlain, indexOf(1, 1), indexOf(1, 2));
    expect(plain.valid).toBe(true);
    expect(plain.swap?.rainbowPartnerKind).toBe('water');

    const both = createEmptyBoard();
    both.cells[indexOf(3, 3)]!.tile = issueTile(both, 'star', 'rainbow');
    both.cells[indexOf(3, 4)]!.tile = issueTile(both, 'water', 'rainbow');
    const rainbows = inspectSwap(both, indexOf(3, 3), indexOf(3, 4));
    expect(rainbows.valid).toBe(true);
    expect(rainbows.swap?.rainbowRainbow).toBe(true);
  });

  it('rejects rainbow+line special without a match (SC-07)', () => {
    const board = createEmptyBoard();
    board.cells[indexOf(2, 2)]!.tile = issueTile(board, 'star', 'rainbow');
    board.cells[indexOf(2, 3)]!.tile = issueTile(board, 'water', 'line-v');
    const check = inspectSwap(board, indexOf(2, 2), indexOf(2, 3));
    expect(check.valid).toBe(false);
    expect(check.reason).toBe('no-match');
  });

  it('returns JSON-serialisable results', () => {
    const board = createEmptyBoard();
    setTile(board, 6, 1, 'leaf');
    setTile(board, 6, 2, 'leaf');
    setTile(board, 6, 3, 'bolt');
    setTile(board, 7, 3, 'leaf');
    const check = inspectSwap(board, indexOf(6, 3), indexOf(7, 3));
    const roundTripped = JSON.parse(JSON.stringify(check));
    expect(roundTripped).toEqual(check);
  });
});
