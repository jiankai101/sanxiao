/**
 * Adjacent swap validation and rollback decision (REQ-003 ~ REQ-006).
 * Pure: the input board is never modified; a rejected swap returns the original board.
 */
import { DomainError } from '../errors';
import type { Board, RunInfo, SwapContext, SwapRejectReason } from '../types';
import { findMatches } from '../match/detect';
import { cloneBoard, isAdjacent, isBoardIndex, isBlockedCell, toIndex } from './model';

export interface SwapCheck {
  valid: boolean;
  reason: SwapRejectReason | null;
  board: Board;
  runs: RunInfo[];
  swap: SwapContext | null;
}

function swapped(board: Board, a: number, b: number): Board {
  const next = cloneBoard(board);
  const ca = next.cells[a];
  const cb = next.cells[b];
  if (!ca || !cb) throw new DomainError('out-of-bounds', 'swap index outside the board');
  const tileA = ca.tile;
  ca.tile = cb.tile;
  cb.tile = tileA;
  return next;
}

export function inspectSwap(board: Board, a: number, b: number): SwapCheck {
  if (!isBoardIndex(a) || !isBoardIndex(b)) {
    return { valid: false, reason: 'blocked', board, runs: [], swap: null };
  }
  if (a === b || !isAdjacent(a, b)) {
    return { valid: false, reason: 'not-adjacent', board, runs: [], swap: null };
  }
  const cellA = board.cells[a];
  const cellB = board.cells[b];
  if (!cellA || !cellB || cellA.tile === null || cellB.tile === null || isBlockedCell(cellA) || isBlockedCell(cellB)) {
    return { valid: false, reason: 'blocked', board, runs: [], swap: null };
  }

  const tileA = cellA.tile;
  const tileB = cellB.tile;
  const rainbowA = tileA.special === 'rainbow';
  const rainbowB = tileB.special === 'rainbow';
  const normalA = tileA.special === null && tileA.kind !== null;
  const normalB = tileB.special === null && tileB.kind !== null;

  const context: SwapContext = {
    from: a,
    to: b,
    rainbowRainbow: rainbowA && rainbowB,
    rainbowPartnerKind: rainbowA && normalB ? tileB.kind : rainbowB && normalA ? tileA.kind : null,
  };

  const nextBoard = swapped(board, a, b);
  if (context.rainbowRainbow || context.rainbowPartnerKind !== null) {
    return { valid: true, reason: null, board: nextBoard, runs: [], swap: context };
  }

  const matches = findMatches(nextBoard);
  if (matches.runs.length > 0) {
    return { valid: true, reason: null, board: nextBoard, runs: matches.runs, swap: context };
  }
  return { valid: false, reason: 'no-match', board, runs: [], swap: null };
}

/** Convenience: index pair from 1-based coordinates. */
export function swapIndexes(rowA: number, colA: number, rowB: number, colB: number): { a: number; b: number } {
  return { a: toIndex(rowA, colA), b: toIndex(rowB, colB) };
}
