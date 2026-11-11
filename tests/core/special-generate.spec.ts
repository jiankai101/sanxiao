import { describe, expect, it } from 'vitest';
import { createEmptyBoard, issueTile } from '../../src/core/board/model';
import { findMatches } from '../../src/core/match/detect';
import { generateSpecials } from '../../src/core/special/generate';
import type { Board } from '../../src/core/types';
import { indexOf, setTile } from './support';

function lineBoard(orientation: 'h' | 'v', length: number, row = 3, col = 3): Board {
  const board = createEmptyBoard();
  for (let i = 0; i < length; i += 1) {
    if (orientation === 'h') setTile(board, row, col + i, 'water');
    else setTile(board, row + i, col, 'water');
  }
  return board;
}

describe('REQ-010/011 special generation', () => {
  it('horizontal 4-run creates line-h at the swapped target cell', () => {
    const board = lineBoard('h', 4, 3, 2);
    const runs = findMatches(board).runs;
    const created = generateSpecials(board, runs, {
      from: indexOf(3, 4),
      to: indexOf(3, 3),
      rainbowRainbow: false,
      rainbowPartnerKind: null,
    });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ index: indexOf(3, 3), special: 'line-h', kind: 'water' });
  });

  it('vertical 4-run creates line-v at the topmost cell during a cascade', () => {
    const board = lineBoard('v', 4, 2, 5);
    const runs = findMatches(board).runs;
    const created = generateSpecials(board, runs, null);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ index: indexOf(2, 5), special: 'line-v' });
  });

  it('5-run creates exactly one rainbow with kind=null', () => {
    const board = lineBoard('h', 5, 4, 1);
    const runs = findMatches(board).runs;
    const created = generateSpecials(board, runs, null);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ special: 'rainbow', kind: null });
    expect(created[0]?.index).toBe(indexOf(4, 1));
  });

  it('two separate 4-runs create two non-overlapping specials', () => {
    const board = createEmptyBoard();
    for (let i = 0; i < 4; i += 1) setTile(board, 2, 1 + i, 'star');
    for (let i = 0; i < 4; i += 1) setTile(board, 6, 1 + i, 'leaf');
    const created = generateSpecials(board, findMatches(board).runs, null);
    expect(created).toHaveLength(2);
    expect(created.map((c) => c.index)).toEqual([indexOf(2, 1), indexOf(6, 1)]);
  });

  it('resolves conflicts deterministically (target -> source -> leftmost/topmost)', () => {
    const board = createEmptyBoard();
    for (let i = 0; i < 4; i += 1) setTile(board, 3, 2 + i, 'bolt');
    const created = generateSpecials(board, findMatches(board).runs, {
      from: indexOf(3, 2),
      to: indexOf(3, 5),
      rainbowRainbow: false,
      rainbowPartnerKind: null,
    });
    expect(created[0]?.index).toBe(indexOf(3, 5));

    const overlap = createEmptyBoard();
    for (let i = 0; i < 4; i += 1) setTile(overlap, 2, 1 + i, 'flame');
    for (let i = 0; i < 4; i += 1) setTile(overlap, 2 + i, 1, 'flame');
    const two = generateSpecials(overlap, findMatches(overlap).runs, null);
    expect(two).toHaveLength(2);
    expect(two[0]?.index).not.toBe(two[1]?.index);
    expect(two.map((c) => c.special).sort()).toEqual(['line-h', 'line-v']);
  });

  it('ignores runs shorter than 4 and existing specials are not claimed twice', () => {
    const board = createEmptyBoard();
    setTile(board, 1, 1, 'star');
    setTile(board, 1, 2, 'star');
    setTile(board, 1, 3, 'star');
    expect(generateSpecials(board, findMatches(board).runs, null)).toHaveLength(0);

    const specialBoard = createEmptyBoard();
    for (let i = 0; i < 4; i += 1) {
      specialBoard.cells[indexOf(2, 1 + i)]!.tile = issueTile(specialBoard, 'leaf', i === 0 ? 'line-h' : null);
    }
    const created = generateSpecials(specialBoard, findMatches(specialBoard).runs, null);
    expect(created[0]?.index).toBe(indexOf(2, 2));
  });
});
