/**
 * Board primitives. Coordinates are 1-based (matches spec), indices are 0-based:
 * index = (row - 1) * 8 + (col - 1).
 */
import { BOARD_COLS, BOARD_ROWS } from '../constants';
import { DomainError } from '../errors';
import type { Board, Cell, CellCoord, Tile, TileKind, SpecialKind } from '../types';

export function toIndex(row: number, col: number): number {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 1 || col < 1 || row > BOARD_ROWS || col > BOARD_COLS) {
    throw new DomainError('out-of-bounds', `cell (${row},${col}) is outside the board`);
  }
  return (row - 1) * BOARD_COLS + (col - 1);
}

export function toRowCol(index: number): CellCoord {
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_COLS * BOARD_ROWS) {
    throw new DomainError('out-of-bounds', `index ${index} is outside the board`);
  }
  return {
    row: (Math.floor(index / BOARD_COLS) + 1) as CellCoord['row'],
    col: ((index % BOARD_COLS) + 1) as CellCoord['col'],
  };
}

export function isBoardIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < BOARD_COLS * BOARD_ROWS;
}

export function isAdjacent(a: number, b: number): boolean {
  if (!isBoardIndex(a) || !isBoardIndex(b) || a === b) return false;
  const pa = toRowCol(a);
  const pb = toRowCol(b);
  return Math.abs(pa.row - pb.row) + Math.abs(pa.col - pb.col) === 1;
}

export function createEmptyBoard(): Board {
  const cells: Cell[] = [];
  for (let i = 0; i < BOARD_COLS * BOARD_ROWS; i += 1) {
    cells.push({ tile: null, obstacle: null });
  }
  return { cols: 8, rows: 8, cells, nextTileId: 1 };
}

export function createTile(id: number, kind: TileKind | null, special: SpecialKind | null = null): Tile {
  return { id, kind, special };
}

/** Mutating helper: appends a tile with a fresh monotonic id. */
export function issueTile(board: Board, kind: TileKind, special: SpecialKind | null = null): Tile {
  const tile: Tile = { id: board.nextTileId, kind, special };
  board.nextTileId += 1;
  return tile;
}

export function getCell(board: Board, index: number): Cell {
  const cell = board.cells[index];
  if (!cell) throw new DomainError('out-of-bounds', `index ${index} has no cell`);
  return cell;
}

export function isBlockedCell(cell: Cell): boolean {
  return cell.obstacle !== null && cell.obstacle.type !== 'ice';
}

export function isStoneCell(cell: Cell): boolean {
  return cell.obstacle !== null && cell.obstacle.type === 'stone';
}

export function isHoleCell(cell: Cell): boolean {
  return cell.obstacle !== null && cell.obstacle.type === 'hole';
}

export function isPlayableCell(cell: Cell): boolean {
  return !isBlockedCell(cell);
}

/** Indices of every cell that can hold a tile (ice included). */
export function playableIndexes(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.cells.length; i += 1) {
    if (isPlayableCell(board.cells[i] as Cell)) out.push(i);
  }
  return out;
}

export function tileIndexes(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.cells.length; i += 1) {
    if ((board.cells[i] as Cell).tile !== null) out.push(i);
  }
  return out;
}

export function cloneCell(cell: Cell): Cell {
  return {
    tile: cell.tile ? { ...cell.tile } : null,
    obstacle: cell.obstacle ? { ...cell.obstacle } : null,
  };
}

export function cloneBoard(board: Board): Board {
  return {
    cols: board.cols,
    rows: board.rows,
    cells: board.cells.map(cloneCell),
    nextTileId: board.nextTileId,
  };
}

export function boardsEqual(a: Board, b: Board): boolean {
  if (a.cols !== b.cols || a.rows !== b.rows || a.nextTileId !== b.nextTileId) return false;
  if (a.cells.length !== b.cells.length) return false;
  for (let i = 0; i < a.cells.length; i += 1) {
    if (!cellsEqual(a.cells[i] as Cell, b.cells[i] as Cell)) return false;
  }
  return true;
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  if (a.obstacle?.type !== b.obstacle?.type) return false;
  if (a.obstacle && b.obstacle && 'layers' in a.obstacle && 'layers' in b.obstacle) {
    if (a.obstacle.layers !== b.obstacle.layers) return false;
  }
  if (a.tile === null || b.tile === null) return a.tile === b.tile;
  return a.tile.id === b.tile.id && a.tile.kind === b.tile.kind && a.tile.special === b.tile.special;
}

export function isInsideBoard(row: number, col: number): boolean {
  return row >= 1 && row <= BOARD_ROWS && col >= 1 && col <= BOARD_COLS;
}
