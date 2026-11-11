import { describe, expect, it } from 'vitest';
import { resolveSwap } from '../../src/core/resolve';
import { createGame } from '../../src/core/game';
import { checkerBoard, indexOf, makeLevel, patternBoard, setTile } from './support';
import type { Board, GameState } from '../../src/core/types';
import { issueTile } from '../../src/core/board/model';

function matchedRowBoard(): Board {
  const board = patternBoard();
  setTile(board, 8, 1, 'star');
  setTile(board, 8, 2, 'star');
  setTile(board, 8, 3, 'water');
  setTile(board, 7, 3, 'star');
  return board;
}

function stateWith(board: Board, overrides: Partial<GameState> = {}): GameState {
  return {
    status: 'playing',
    levelId: 1,
    seed: 1,
    rngState: 1,
    board,
    score: 0,
    movesLeft: 20,
    cascade: 0,
    goals: [],
    stats: {
      movesUsed: 0,
      clearedTiles: 0,
      iceBroken: 0,
      stoneBroken: 0,
      collected: { star: 0, water: 0, leaf: 0, flame: 0, crystal: 0, bolt: 0 },
    },
    settlementId: null,
    ...overrides,
  };
}

describe('REQ-009/015/018 cascade resolution', () => {
  it('resolves a single triple in one round, +180 score and one move spent', () => {
    const level = makeLevel({ moves: 20 });
    const board = matchedRowBoard();
    const state = stateWith(board);
    const result = resolveSwap(state, level, indexOf(7, 3), indexOf(8, 3));
    expect(result.outcome).toBe('continue');
    expect(result.rounds.length).toBe(1);
    expect(result.rounds[0]?.scoreGain).toBe(180);
    expect(result.state.score).toBe(180);
    expect(result.state.movesLeft).toBe(19);
    expect(result.state.stats.movesUsed).toBe(1);
  });

  it('applies the 1.5x multiplier on the second cascade and sums round gains', () => {
    const level = makeLevel({ moves: 20 });
    const board = checkerBoard();
    setTile(board, 6, 1, 'star');
    setTile(board, 7, 1, 'star');
    setTile(board, 8, 1, 'star');
    setTile(board, 3, 1, 'water');
    setTile(board, 6, 2, 'water');
    setTile(board, 6, 3, 'water');
    setTile(board, 6, 4, 'star');
    const state = stateWith(board);
    const result = resolveSwap(state, level, indexOf(7, 3), indexOf(8, 3));
    expect(result.rounds).toHaveLength(2);
    const gains = result.rounds.map((round) => round.scoreGain);
    expect(gains[0]).toBe(180);
    expect(gains[1]).toBe(270);
    expect(result.state.score).toBe(gains.reduce((a, b) => a + b, 0));
    expect(result.state.movesLeft).toBe(19);
  });

  it('never spends a move for a rejected swap', () => {
    const level = makeLevel();
    const board = matchedRowBoard();
    const state = stateWith(board);
    const before = JSON.parse(JSON.stringify(state)) as GameState;
    const result = resolveSwap(state, level, indexOf(8, 1), indexOf(7, 1));
    expect(result.rounds).toHaveLength(0);
    expect(result.events[0]).toMatchObject({ type: 'swap-rejected' });
    expect(result.state.movesLeft).toBe(before.movesLeft);
    expect(result.state.score).toBe(before.score);
    expect(result.state.board).toEqual(before.board);
  });

  it('wins when goals are met even if moves hit zero', () => {
    const level = makeLevel({ moves: 1, goals: [{ id: 'g', type: 'score', target: 1 }] });
    const result = resolveSwap(stateWith(matchedRowBoard(), { movesLeft: 1 }), level, indexOf(7, 3), indexOf(8, 3));
    expect(result.outcome).toBe('won');
    expect(result.state.movesLeft).toBe(0);
    expect(result.state.status).toBe('won');
  });

  it('loses when moves hit zero with goals unmet', () => {
    const level = makeLevel({ moves: 1, goals: [{ id: 'g', type: 'score', target: 999999 }] });
    const result = resolveSwap(stateWith(matchedRowBoard(), { movesLeft: 1 }), level, indexOf(7, 3), indexOf(8, 3));
    expect(result.outcome).toBe('lost');
    expect(result.state.status).toBe('lost');
  });

  it('is deterministic for identical seed + operation', () => {
    const level = makeLevel();
    const a = resolveSwap(stateWith(matchedRowBoard()), level, indexOf(7, 3), indexOf(8, 3));
    const b = resolveSwap(stateWith(matchedRowBoard()), level, indexOf(7, 3), indexOf(8, 3));
    expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(b)));
  });

  it('rainbow+rainbow clears 64 tiles for 3840 in round 1 and breaks obstacles', () => {
    const level = makeLevel();
    const board = checkerBoard();
    board.cells[indexOf(4, 4)]!.tile = issueTile(board, 'star', 'rainbow');
    board.cells[indexOf(4, 5)]!.tile = issueTile(board, 'water', 'rainbow');
    const result = resolveSwap(stateWith(board), level, indexOf(4, 4), indexOf(4, 5));
    const first = result.rounds[0];
    expect(first?.cleared).toHaveLength(64);
    expect(first?.scoreGain).toBe(3840);

    const withObstacles = checkerBoard();
    withObstacles.cells[indexOf(4, 4)]!.tile = issueTile(withObstacles, 'star', 'rainbow');
    withObstacles.cells[indexOf(4, 5)]!.tile = issueTile(withObstacles, 'water', 'rainbow');
    withObstacles.cells[indexOf(1, 1)]!.obstacle = { type: 'ice', layers: 1 };
    withObstacles.cells[indexOf(2, 2)]!.obstacle = { type: 'stone', layers: 2 };
    withObstacles.cells[indexOf(2, 2)]!.tile = null;
    const obstacleResult = resolveSwap(stateWith(withObstacles), level, indexOf(4, 4), indexOf(4, 5));
    expect(obstacleResult.rounds[0]?.iceBroken).toBe(1);
    expect(obstacleResult.rounds[0]?.stoneBroken).toBe(0);
    expect(obstacleResult.rounds[0]?.boardAfterClear.cells[indexOf(2, 2)]?.obstacle).toEqual({ type: 'stone', layers: 1 });
  });

  it('counts ice breaks immediately and stones only at zero layers', () => {
    const level = makeLevel();
    const icy = matchedRowBoard();
    icy.cells[indexOf(8, 1)]!.obstacle = { type: 'ice', layers: 1 };
    const iceResult = resolveSwap(stateWith(icy), level, indexOf(7, 3), indexOf(8, 3));
    expect(iceResult.rounds[0]?.iceBroken).toBe(1);
    expect(iceResult.state.stats.iceBroken).toBe(1);

    const stony = matchedRowBoard();
    stony.cells[indexOf(7, 2)]!.obstacle = { type: 'stone', layers: 2 };
    stony.cells[indexOf(7, 2)]!.tile = null;
    const stoneResult = resolveSwap(stateWith(stony), level, indexOf(7, 3), indexOf(8, 3));
    expect(stoneResult.rounds[0]?.stoneBroken).toBe(0);
    expect(stoneResult.state.stats.stoneBroken).toBe(0);
  });

  it('counts a stone break when the last layer is removed', () => {
    const level = makeLevel();
    const board = matchedRowBoard();
    board.cells[indexOf(7, 2)]!.obstacle = { type: 'stone', layers: 1 };
    board.cells[indexOf(7, 2)]!.tile = null;
    const result = resolveSwap(stateWith(board), level, indexOf(7, 3), indexOf(8, 3));
    expect(result.rounds[0]?.stoneBroken).toBe(1);
    expect(result.state.stats.stoneBroken).toBe(1);
    expect(result.rounds[0]?.boardAfterClear.cells[indexOf(7, 2)]?.obstacle).toBeNull();
  });

  it('createGame -> resolve keeps board consistency and JSON serialisability', () => {
    const level = makeLevel({ moves: 20 });
    const state = createGame(level, 0xfeedbeef);
    const roundTripped = JSON.parse(JSON.stringify(state)) as GameState;
    expect(roundTripped).toEqual(state);
  });
});



