import { describe, expect, it } from 'vitest';
import { generateBoard, hasAnyMove, wouldMatchAt } from '../../src/core/board/generate';
import { createEmptyBoard, getCell, issueTile, toIndex, toRowCol } from '../../src/core/board/model';
import { findMatches } from '../../src/core/match/detect';
import { BoardInitError, DomainError } from '../../src/core/errors';
import { TILE_KINDS_L5 } from '../../src/core/constants';
import { coords, makeLevel, setTile } from './support';

describe('REQ-001/025 board generation', () => {
  it('generates 200 seeds with 64 cells, no initial triple and at least one move', () => {
    const level = makeLevel();
    for (let seed = 1; seed <= 200; seed += 1) {
      const { board } = generateBoard(level, seed);
      expect(board.cells).toHaveLength(64);
      expect(findMatches(board).runs).toHaveLength(0);
      expect(hasAnyMove(board)).toBe(true);
      for (const cell of board.cells) {
        if (!cell.obstacle) expect(cell.tile).not.toBeNull();
      }
    }
  });

  it('places level 8 stones and holes exactly, leaving those cells empty', () => {
    const stoneCells: [number, number][] = [
      [2, 3], [2, 6], [4, 3], [4, 6], [5, 1], [5, 8], [6, 3], [6, 6], [8, 3], [8, 6],
    ];
    const holeCells: [number, number][] = [
      [3, 3], [3, 6], [6, 2], [6, 7],
    ];
    const level = makeLevel({
      id: 8,
      tileKinds: TILE_KINDS_L5,
      obstacles: [
        { type: 'stone', cells: coords(stoneCells) },
        { type: 'hole', cells: coords(holeCells) },
      ],
    });
    const { board } = generateBoard(level, 42);
    for (const [row, col] of holeCells) {
      const cell = getCell(board, toIndex(row, col));
      expect(cell.obstacle).toEqual({ type: 'hole' });
      expect(cell.tile).toBeNull();
    }
    for (const [row, col] of stoneCells) {
      const cell = getCell(board, toIndex(row, col));
      expect(cell.obstacle).toEqual({ type: 'stone', layers: 2 });
      expect(cell.tile).toBeNull();
    }
    const holes = board.cells.filter((cell) => cell.obstacle?.type === 'hole').length;
    const stones = board.cells.filter((cell) => cell.obstacle?.type === 'stone').length;
    expect(holes).toBe(4);
    expect(stones).toBe(10);
    const kinds = new Set(board.cells.flatMap((cell) => (cell.tile?.kind ? [cell.tile.kind] : [])));
    expect([...kinds].sort()).toEqual([...TILE_KINDS_L5].sort());
  });

  it('keeps a tile under ice', () => {
    const level = makeLevel({ obstacles: [{ type: 'ice', cells: coords([[4, 4], [4, 5]]) }] });
    const { board } = generateBoard(level, 9);
    for (const [row, col] of [[4, 4], [4, 5]] as [number, number][]) {
      const cell = getCell(board, toIndex(row, col));
      expect(cell.obstacle).toEqual({ type: 'ice', layers: 1 });
      expect(cell.tile).not.toBeNull();
    }
  });

  it('throws BoardInitError after the 1000 attempt limit', () => {
    const impossible = makeLevel({ tileKinds: ['star'] });
    expect(() => generateBoard(impossible, 3)).toThrow(BoardInitError);
  });

  it('treats a board with a rainbow as playable and reports dead boards', () => {
    const withRainbow = createEmptyBoard();
    withRainbow.cells[0]!.tile = issueTile(withRainbow, 'star', 'rainbow');
    expect(hasAnyMove(withRainbow)).toBe(true);

    const dead = createEmptyBoard();
    const rows = ['sswwllff', 'sswwllff', 'llffssww', 'llffssww', 'sswwllff', 'sswwllff', 'llffssww', 'llffssww'];
    rows.forEach((row, r) => [...row].forEach((char, c) => {
      if (char === 's') setTile(dead, r + 1, c + 1, 'star');
      if (char === 'w') setTile(dead, r + 1, c + 1, 'water');
      if (char === 'l') setTile(dead, r + 1, c + 1, 'leaf');
      if (char === 'f') setTile(dead, r + 1, c + 1, 'flame');
    }));
    expect(hasAnyMove(dead)).toBe(false);
  });

  it('detects would-be triples and rejects impossible coordinates', () => {
    const board = createEmptyBoard();
    setTile(board, 1, 1, 'star');
    setTile(board, 1, 2, 'star');
    expect(wouldMatchAt(board, 1, 3, 'star')).toBe(true);
    expect(wouldMatchAt(board, 1, 3, 'water')).toBe(false);
    expect(() => toIndex(9, 1)).toThrow(DomainError);
    expect(() => getCell(board, 64)).toThrow(DomainError);
    for (let index = 0; index < 64; index += 1) {
      const { row, col } = toRowCol(index);
      expect(toIndex(row, col)).toBe(index);
    }
  });
});
