/**
 * Match detection (REQ-007).
 * Scans 8 rows and 8 columns; every maximal >=3 same-kind segment becomes one run.
 * Overlapping runs (L/T) are kept separate but the cleared set is their union.
 */
import { BOARD_COLS, BOARD_ROWS } from '../constants';
import type { Board, MatchResult, RunInfo, TileKind } from '../types';
import { toIndex } from '../board/model';

function kindAt(board: Board, row: number, col: number): TileKind | null {
  const cell = board.cells[toIndex(row, col)];
  if (!cell || cell.tile === null) return null;
  return cell.tile.kind;
}

export function findMatches(board: Board): MatchResult {
  const runs: RunInfo[] = [];
  const matched = new Set<number>();

  for (let row = 1; row <= BOARD_ROWS; row += 1) {
    let runStart = 1;
    let runKind = kindAt(board, row, 1);
    for (let col = 2; col <= BOARD_COLS + 1; col += 1) {
      const kind = col <= BOARD_COLS ? kindAt(board, row, col) : null;
      if (kind === runKind && kind !== null) continue;
      const length = col - runStart;
      if (runKind !== null && length >= 3) {
        const cells: number[] = [];
        for (let c = runStart; c < col; c += 1) cells.push(toIndex(row, c));
        runs.push({ cells, orientation: 'h', kind: runKind, length });
        for (const index of cells) matched.add(index);
      }
      runStart = col;
      runKind = kind;
    }
  }

  for (let col = 1; col <= BOARD_COLS; col += 1) {
    let runStart = 1;
    let runKind = kindAt(board, 1, col);
    for (let row = 2; row <= BOARD_ROWS + 1; row += 1) {
      const kind = row <= BOARD_ROWS ? kindAt(board, row, col) : null;
      if (kind === runKind && kind !== null) continue;
      const length = row - runStart;
      if (runKind !== null && length >= 3) {
        const cells: number[] = [];
        for (let r = runStart; r < row; r += 1) cells.push(toIndex(r, col));
        runs.push({ cells, orientation: 'v', kind: runKind, length });
        for (const index of cells) matched.add(index);
      }
      runStart = row;
      runKind = kind;
    }
  }

  return { runs, matched: [...matched].sort((a, b) => a - b) };
}

export function hasMatches(board: Board): boolean {
  return findMatches(board).runs.length > 0;
}
