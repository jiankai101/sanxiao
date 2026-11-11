import { describe, expect, it } from 'vitest';
import { createEmptyBoard, issueTile } from '../../src/core/board/model';
import { expandClears, mostCommonKind } from '../../src/core/special/trigger';
import { checkerBoard, indexOf, setTile } from './support';

describe('REQ-012/013 special triggering', () => {
  it('line-h clears the whole row, damages ice/stone, never touches holes', () => {
    const board = checkerBoard();
    setTile(board, 4, 4, 'water', 'line-h');
    board.cells[indexOf(4, 6)]!.obstacle = { type: 'hole' };
    board.cells[indexOf(4, 6)]!.tile = null;
    board.cells[indexOf(4, 2)]!.obstacle = { type: 'ice', layers: 1 };
    board.cells[indexOf(5, 4)]!.obstacle = { type: 'stone', layers: 2 };
    board.cells[indexOf(5, 4)]!.tile = null;

    const result = expandClears(board, [indexOf(4, 4)], [], {
      from: indexOf(4, 4),
      to: indexOf(4, 3),
      rainbowRainbow: false,
      rainbowPartnerKind: null,
    });
    for (let col = 1; col <= 8; col += 1) {
      if (col === 6) continue;
      expect(result.cleared).toContain(indexOf(4, col));
    }
    expect(result.cleared).not.toContain(indexOf(4, 6));
    expect(result.cleared).not.toContain(indexOf(5, 4));
    expect(result.damagedStones).toContain(indexOf(5, 4));
    expect(result.lineExtra).toHaveLength(6);
    expect(result.triggered).toContainEqual({ index: indexOf(4, 4), special: 'line-h' });
  });

  it('counts each line extra once and excludes base matches', () => {
    const board = checkerBoard();
    setTile(board, 2, 2, 'leaf', 'line-v');
    const base = [indexOf(1, 2), indexOf(2, 2), indexOf(3, 2)];
    const result = expandClears(board, base, [], null);
    expect(result.cleared).toHaveLength(8);
    expect(result.lineExtra).toHaveLength(5);
    expect(new Set(result.lineExtra).size).toBe(5);
  });

  it('clears every tile of the swapped colour for rainbow+plain', () => {
    const board = createEmptyBoard();
    board.cells[indexOf(1, 1)]!.tile = issueTile(board, 'star', 'rainbow');
    setTile(board, 1, 2, 'star');
    setTile(board, 6, 6, 'star');
    setTile(board, 3, 3, 'water');
    setTile(board, 3, 4, 'water');
    const result = expandClears(board, [], [], {
      from: indexOf(1, 1),
      to: indexOf(1, 2),
      rainbowRainbow: false,
      rainbowPartnerKind: 'star',
    });
    expect(result.cleared).toEqual([indexOf(1, 1), indexOf(1, 2), indexOf(6, 6)].sort((a, b) => a - b));
  });

  it('clears the most common colour when a rainbow is hit by a wave, ties by kind order', () => {
    const board = createEmptyBoard();
    board.cells[indexOf(1, 1)]!.tile = issueTile(board, 'star', 'rainbow');
    setTile(board, 2, 2, 'star');
    setTile(board, 2, 3, 'star');
    setTile(board, 3, 2, 'water');
    setTile(board, 3, 3, 'water');
    expect(mostCommonKind(board)).toBe('star');
    const result = expandClears(board, [indexOf(1, 1)], [], null);
    expect(result.cleared).toContain(indexOf(2, 2));
    expect(result.cleared).toContain(indexOf(2, 3));
    expect(result.cleared).not.toContain(indexOf(3, 2));
  });

  it('rainbow+rainbow clears all 64 tiles and reports rainbowAll', () => {
    const board = checkerBoard();
    board.cells[indexOf(4, 4)]!.tile = issueTile(board, 'star', 'rainbow');
    board.cells[indexOf(4, 5)]!.tile = issueTile(board, 'water', 'rainbow');
    const result = expandClears(board, [], [], {
      from: indexOf(4, 4),
      to: indexOf(4, 5),
      rainbowRainbow: true,
      rainbowPartnerKind: null,
    });
    expect(result.rainbowAll).toBe(true);
    expect(result.cleared).toHaveLength(64);
    expect(result.lineExtra).toHaveLength(0);
  });
});


