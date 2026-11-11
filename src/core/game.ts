/**
 * Round orchestration API (REQ-019, REQ-020). No storage, network or DOM access.
 */
import { DomainError } from './errors';
import type { GameState, LevelConfig, LevelId } from './types';
import { generateBoard } from './board/generate';
import { computeGoalProgress, emptyStats } from './goals';

export const LEVEL_IDS: readonly LevelId[] = [1, 2, 3, 4, 5, 6, 7, 8];

export function assertLevel(level: LevelConfig): void {
  if (!LEVEL_IDS.includes(level.id)) {
    throw new DomainError('bad-level', `unknown level id: ${String(level.id)}`);
  }
  if (!Number.isInteger(level.moves) || level.moves <= 0) {
    throw new DomainError('bad-level', 'level.moves must be a positive integer');
  }
  if (level.goals.length === 0) {
    throw new DomainError('bad-level', 'level.goals must not be empty');
  }
}

export function createGame(level: LevelConfig, seed: number): GameState {
  assertLevel(level);
  const generated = generateBoard(level, seed);
  return {
    status: 'playing',
    levelId: level.id,
    seed: seed >>> 0,
    rngState: generated.rngState,
    board: generated.board,
    score: 0,
    movesLeft: level.moves,
    cascade: 0,
    goals: computeGoalProgress(level.goals, 0, emptyStats()),
    stats: emptyStats(),
    settlementId: null,
  };
}

export function restartGame(_state: GameState, level: LevelConfig, newSeed: number): GameState {
  const fresh = createGame(level, newSeed);
  return {
    ...fresh,
    stats: { ...fresh.stats, movesUsed: 0 },
    settlementId: null,
    seed: newSeed >>> 0,
  };
}

export interface AbandonResult {
  state: GameState;
  persist: false;
  settlementId: null;
}

/** Leaving mid-round is a no-op for persistence and leaderboards (REQ-020). */
export function abandonGame(state: GameState): AbandonResult {
  return {
    state: { ...state, status: 'idle', settlementId: null },
    persist: false,
    settlementId: null,
  };
}

