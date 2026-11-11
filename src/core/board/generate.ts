/**
 * Initial board generation and obstacle placement (REQ-001, REQ-025).
 * Row-major fill rejects any tile that would complete a left/up triple,
 * then checks that at least one valid swap exists; up to 1000 attempts.
 */
import { BOARD_COLS, BOARD_ROWS, INITIAL_RETRY_LIMIT, TILE_KINDS } from '../constants';
import { BoardInitError, DomainError } from '../errors';
import type { Board, Cell, LevelConfig, TileKind } from '../types';
import { createRng } from '../rng';
import { findMatches } from '../match/detect';
import {
  cloneBoard,
  createEmptyBoard,
  isPlayableCell,
  getCell,
  issueTile,
  toIndex,
} from './model';

export interface GenerateBoardResult {
  board: Board;
  rngState: number;
  attempts: number;
}

function assertLevelTiles(level: LevelConfig): void {
  if (!level.tileKinds.length) {
    throw new DomainError('bad-level', 'level.tileKinds must not be empty');
  }
  for (const kind of level.tileKinds) {
    if (!TILE_KINDS.includes(kind)) {
      throw new DomainError('bad-level', `unknown tile kind: ${String(kind)}`);
    }
  }
}

function placeObstacles(board: Board, level: LevelConfig): void {
  for (const spec of level.obstacles) {
    for (const coord of spec.cells) {
      const cell = getCell(board, toIndex(coord.row, coord.col));
      if (cell.obstacle !== null) {
        throw new DomainError('bad-level', `overlapping obstacle at (${coord.row},${coord.col})`);
      }
      if (spec.type === 'ice') cell.obstacle = { type: 'ice', layers: 1 };
      if (spec.type === 'stone') cell.obstacle = { type: 'stone', layers: 2 };
      if (spec.type === 'hole') cell.obstacle = { type: 'hole' };
    }
  }
}

function kindAt(board: Board, row: number, col: number): TileKind | null {
  if (row < 1 || col < 1 || row > BOARD_ROWS || col > BOARD_COLS) return null;
  const cell = board.cells[toIndex(row, col)];
  return cell && cell.tile ? cell.tile.kind : null;
}

/** A tile of `kind` at (row,col) would complete a horizontal or vertical triple. */
export function wouldMatchAt(board: Board, row: number, col: number, kind: TileKind): boolean {
  const left1 = kindAt(board, row, col - 1);
  const left2 = kindAt(board, row, col - 2);
  if (left1 === kind && left2 === kind) return true;
  const up1 = kindAt(board, row - 1, col);
  const up2 = kindAt(board, row - 2, col);
  if (up1 === kind && up2 === kind) return true;
  return false;
}

function boardAfterSwap(board: Board, a: number, b: number): Board {
  const cells: Cell[] = board.cells.slice();
  const ca = cells[a] as Cell;
  const cb = cells[b] as Cell;
  cells[a] = { tile: cb.tile, obstacle: ca.obstacle };
  cells[b] = { tile: ca.tile, obstacle: cb.obstacle };
  return { ...board, cells };
}

export function hasAnyMove(board: Board): boolean {
  for (const cell of board.cells) {
    if (cell.tile && cell.tile.special === 'rainbow') return true;
  }
  for (let row = 1; row <= BOARD_ROWS; row += 1) {
    for (let col = 1; col <= BOARD_COLS; col += 1) {
      const index = toIndex(row, col);
      const cell = getCell(board, index);
      if (!cell.tile) continue;
      if (col < BOARD_COLS) {
        const right = index + 1;
        if (getCell(board, right).tile && findMatches(boardAfterSwap(board, index, right)).runs.length > 0) {
          return true;
        }
      }
      if (row < BOARD_ROWS) {
        const down = index + BOARD_COLS;
        if (getCell(board, down).tile && findMatches(boardAfterSwap(board, index, down)).runs.length > 0) {
          return true;
        }
      }
    }
  }
  return false;
}

export function generateBoard(level: LevelConfig, seed: number): GenerateBoardResult {
  assertLevelTiles(level);
  const rng = createRng(seed);
  for (let attempt = 1; attempt <= INITIAL_RETRY_LIMIT; attempt += 1) {
    const board = createEmptyBoard();
    placeObstacles(board, level);
    let failed = false;
    for (let row = 1; row <= BOARD_ROWS && !failed; row += 1) {
      for (let col = 1; col <= BOARD_COLS; col += 1) {
        const cell = getCell(board, toIndex(row, col));
        if (!isPlayableCell(cell)) continue;
        const candidates = level.tileKinds.filter((kind) => !wouldMatchAt(board, row, col, kind));
        if (candidates.length === 0) {
          failed = true;
          break;
        }
        const kind = candidates[rng.nextInt(candidates.length)] as TileKind;
        cell.tile = issueTile(board, kind);
      }
    }
    if (failed) continue;
    if (hasAnyMove(board)) {
      return { board, rngState: rng.state, attempts: attempt };
    }
  }
  throw new BoardInitError();
}

export function cloneGeneratedBoard(board: Board): Board {
  return cloneBoard(board);
}

/** Rebuilds the obstacle layer on a fresh board (used by restart/new seed). */
export function buildLevelBoard(level: LevelConfig): Board {
  const board = createEmptyBoard();
  placeObstacles(board, level);
  return board;
}
