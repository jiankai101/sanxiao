import { describe, expect, it } from 'vitest';
import { createEmptyBoard, createGame, issueTile } from '@core/index';
import type { CellCoord, LevelConfig } from '@core/types';
import { LEVELS } from '../../src/systems/level/levels';
import { isSelectableCellAt } from '../../src/systems/game/board-selectable';

const at = (row: number, col: number): CellCoord => ({ row, col }) as CellCoord;

function boardWith(specs: Array<{ coord: CellCoord; obstacle: 'stone' | 'hole' | 'ice' }>) {
  const board = createEmptyBoard();
  for (const { coord, obstacle } of specs) {
    const cell = board.cells[(coord.row - 1) * 8 + (coord.col - 1)];
    if (!cell) throw new Error('bad test cell');
    if (obstacle === 'stone') cell.obstacle = { type: 'stone', layers: 1 };
    if (obstacle === 'hole') cell.obstacle = { type: 'hole' };
    if (obstacle === 'ice') {
      cell.obstacle = { type: 'ice', layers: 1 };
      cell.tile = issueTile(board, 'star');
    } else {
      cell.tile = null;
    }
  }
  return board;
}

describe('REQ-049 obstacle classification for board hits', () => {
  it('stone and hole are blocked (not selectable), ice is an overlay (selectable)', () => {
    const board = boardWith([
      { coord: at(1, 1), obstacle: 'stone' },
      { coord: at(1, 2), obstacle: 'hole' },
      { coord: at(1, 3), obstacle: 'ice' },
    ]);
    expect(isSelectableCellAt(board, at(1, 1))).toBe(false);
    expect(isSelectableCellAt(board, at(1, 2))).toBe(false);
    expect(isSelectableCellAt(board, at(1, 3))).toBe(true);
  });

  it('ordinary cells with a tile stay selectable', () => {
    const board = createEmptyBoard();
    board.cells[0]!.tile = issueTile(board, 'water');
    expect(isSelectableCellAt(board, at(1, 1))).toBe(true);
  });

  it('a missing board is not selectable', () => {
    expect(isSelectableCellAt(null, at(1, 1))).toBe(false);
  });

  it('every stone/hole cell in shipped levels is ignored; every ice cell is selectable', () => {
    for (const level of LEVELS) {
      const board = createGame(level as LevelConfig, 12345).board;
      for (const spec of level.obstacles) {
        for (const coord of spec.cells) {
          const expected = spec.type === 'ice';
          expect(isSelectableCellAt(board, coord), `${level.id}:${spec.type}@${coord.row},${coord.col}`)
            .toBe(expected);
        }
      }
    }
  });
});
