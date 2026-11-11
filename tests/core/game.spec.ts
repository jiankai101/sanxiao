import { describe, expect, it } from 'vitest';
import { abandonGame, createGame, restartGame } from '../../src/core/game';
import { DomainError } from '../../src/core/errors';
import { makeLevel } from './support';
import type { LevelId } from '../../src/core/types';

describe('REQ-019/020 game orchestration API', () => {
  it('creates a playing state with a full board and level moves', () => {
    const level = makeLevel({ moves: 22 });
    const state = createGame(level, 0x11112222);
    expect(state.status).toBe('playing');
    expect(state.levelId).toBe(1);
    expect(state.score).toBe(0);
    expect(state.movesLeft).toBe(22);
    expect(state.board.cells).toHaveLength(64);
    expect(state.goals).toHaveLength(1);
    expect(state.settlementId).toBeNull();
    expect(state.seed).toBe(0x11112222);
    expect(state.rngState).toBeGreaterThanOrEqual(0);
  });

  it('rejects unknown level ids', () => {
    expect(() => createGame(makeLevel({ id: 9 as LevelId }), 1)).toThrow(DomainError);
    expect(() => createGame(makeLevel({ moves: 0 }), 1)).toThrow(DomainError);
    expect(() => createGame(makeLevel({ goals: [] }), 1)).toThrow(DomainError);
  });

  it('restarts with a new seed and resets score, moves and goals', () => {
    const level = makeLevel();
    const first = createGame(level, 100);
    const dirty = { ...first, score: 999, movesLeft: 2, cascade: 5, stats: { ...first.stats, clearedTiles: 30 } };
    const restarted = restartGame(dirty, level, 200);
    expect(restarted.seed).toBe(200);
    expect(restarted.score).toBe(0);
    expect(restarted.movesLeft).toBe(level.moves);
    expect(restarted.cascade).toBe(0);
    expect(restarted.stats.clearedTiles).toBe(0);
    expect(restarted.board.cells).not.toEqual(first.board.cells);
    expect(JSON.stringify(restarted.board)).not.toBe(JSON.stringify(first.board));
  });

  it('abandons without persistence or settlement events (REQ-020)', () => {
    const state = createGame(makeLevel(), 5);
    const result = abandonGame(state);
    expect(result.persist).toBe(false);
    expect(result.settlementId).toBeNull();
    expect(result.state.status).toBe('idle');
    expect(state.status).toBe('playing');
  });
});
