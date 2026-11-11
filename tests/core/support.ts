import { createEmptyBoard, issueTile } from '../../src/core/board/model';
import type { Board, CellCoord, Goal, LevelConfig, SpecialKind, TileKind } from '../../src/core/types';

export const KIND_BY_CHAR: Readonly<Record<string, TileKind>> = {
  s: 'star',
  w: 'water',
  l: 'leaf',
  f: 'flame',
  c: 'crystal',
  b: 'bolt',
};

/** 8 rows x 8 cols; '.' leaves the cell empty. */
export function boardFromRows(rows: readonly string[]): Board {
  const board = createEmptyBoard();
  rows.forEach((row, r) => {
    [...row].forEach((char, c) => {
      if (char === '.') return;
      const kind = KIND_BY_CHAR[char];
      if (!kind) throw new Error(`bad tile char ${char}`);
      const cell = board.cells[r * 8 + c];
      if (cell) cell.tile = issueTile(board, kind);
    });
  });
  return board;
}

/** Fills every cell with (col + 2*row) mod 6: no horizontal or vertical triple. */
export function patternBoard(): Board {
  const kinds = ['s', 'w', 'l', 'f', 'c', 'b'];
  const rows: string[] = [];
  for (let r = 0; r < 8; r += 1) {
    let row = '';
    for (let c = 0; c < 8; c += 1) row += kinds[(c + 2 * r) % 6];
    rows.push(row);
  }
  return boardFromRows(rows);
}

/** Alias kept for readability in tests that only need a full, match-free board. */
export function checkerBoard(): Board {
  return patternBoard();
}

export function setTile(board: Board, row: number, col: number, kind: TileKind, special: SpecialKind | null = null): void {
  const cell = board.cells[(row - 1) * 8 + (col - 1)];
  if (!cell) throw new Error('bad cell');
  cell.tile = issueTile(board, kind, special);
}

export function indexOf(row: number, col: number): number {
  return (row - 1) * 8 + (col - 1);
}

export const SCORE_ONLY_GOAL: Goal = { id: 'g-score', type: 'score', target: 999999 };

export function makeLevel(overrides: Partial<LevelConfig> = {}): LevelConfig {
  return {
    id: 1,
    name: 'test',
    tileKinds: ['star', 'water', 'leaf', 'flame', 'crystal', 'bolt'],
    moves: 20,
    goals: [SCORE_ONLY_GOAL],
    obstacles: [],
    stars: { two: 2000, three: 2600 },
    difficulty: 0.75,
    ...overrides,
  };
}

export function coords(cells: readonly [number, number][]): CellCoord[] {
  return cells.map(([row, col]) => ({ row: row as CellCoord['row'], col: col as CellCoord['col'] }));
}



