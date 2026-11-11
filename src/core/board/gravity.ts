/**
 * Gravity + refill (REQ-008, REQ-023, REQ-024).
 * Each column is split by stone/hole blockers; tiles compact downward inside a
 * segment and the segment's top is refilled with a uniform random kind.
 */
import { BOARD_COLS, BOARD_ROWS } from '../constants';
import { DomainError } from '../errors';
import type { Board, Cell, GravityResult, Tile, TileKind } from '../types';
import type { Rng } from '../rng';
import { cloneBoard, issueTile, toIndex } from './model';

function isBlocker(cell: Cell): boolean {
  if (!cell.obstacle) return false;
  return cell.obstacle.type === 'stone' || cell.obstacle.type === 'hole';
}

export function applyGravity(board: Board, rng: Rng, tileKinds: readonly TileKind[]): GravityResult {
  if (!tileKinds.length) {
    throw new DomainError('bad-level', 'tileKinds must not be empty');
  }
  const next = cloneBoard(board);
  const moves: { from: number; to: number }[] = [];
  const spawned: number[] = [];

  for (let col = 1; col <= BOARD_COLS; col += 1) {
    let segmentBottom = BOARD_ROWS;
    for (let row = BOARD_ROWS; row >= 1; row -= 1) {
      const cell = next.cells[toIndex(row, col)] as Cell;
      if (!isBlocker(cell)) continue;
      compactSegment(next, col, row + 1, segmentBottom, rng, tileKinds, moves, spawned);
      segmentBottom = row - 1;
    }
    compactSegment(next, col, 1, segmentBottom, rng, tileKinds, moves, spawned);
  }

  return { board: next, moves, spawned };
}

function compactSegment(
  board: Board,
  col: number,
  top: number,
  bottom: number,
  rng: Rng,
  tileKinds: readonly TileKind[],
  moves: { from: number; to: number }[],
  spawned: number[],
): void {
  if (bottom < top) return;
  const original: { row: number; tile: Tile }[] = [];
  for (let row = bottom; row >= top; row -= 1) {
    const cell = board.cells[toIndex(row, col)] as Cell;
    if (cell.tile) original.push({ row, tile: cell.tile });
    cell.tile = null;
  }
  let target = bottom;
  for (const entry of original) {
    const to = toIndex(target, col);
    const from = toIndex(entry.row, col);
    (board.cells[to] as Cell).tile = { ...entry.tile };
    if (to !== from) moves.push({ from, to });
    target -= 1;
  }
  for (let row = top; row <= target; row += 1) {
    const index = toIndex(row, col);
    const kind = tileKinds[rng.nextInt(tileKinds.length)] as TileKind;
    (board.cells[index] as Cell).tile = issueTile(board, kind);
    spawned.push(index);
  }
}
