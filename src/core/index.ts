/** Public core API. Render/systems layers import from here. */

export * from './types';
export * from './constants';
export * from './errors';
export { createRng, nextUint32, SeededRng } from './rng';
export type { Rng, RngDraw } from './rng';

export {
  toIndex,
  toRowCol,
  isBoardIndex,
  isInsideBoard,
  isAdjacent,
  createEmptyBoard,
  createTile,
  issueTile,
  getCell,
  isBlockedCell,
  isStoneCell,
  isHoleCell,
  isPlayableCell,
  playableIndexes,
  tileIndexes,
  cloneBoard,
  cloneCell,
  boardsEqual,
  cellsEqual,
} from './board/model';

export { generateBoard, hasAnyMove, wouldMatchAt, buildLevelBoard } from './board/generate';
export type { GenerateBoardResult } from './board/generate';
export { inspectSwap, swapIndexes } from './board/swap';
export type { SwapCheck } from './board/swap';
export { applyGravity } from './board/gravity';
export { ensurePlayable, multisetOf } from './board/shuffle';
export type { EnsurePlayableResult } from './board/shuffle';

export { findMatches, hasMatches } from './match/detect';
export { multiplier, lengthBonus, scoreRound } from './score/score';
export type { ScoreRoundInput } from './score/score';
export { generateSpecials } from './special/generate';
export { expandClears, mostCommonKind } from './special/trigger';
export type { ExpandResult } from './special/trigger';

export { resolveSwap } from './resolve';
export {
  GAME_STATUSES,
  canTransition,
  transition,
  canAcceptInput,
  panelUnlockAt,
} from './state-machine';
export type { GameEventName } from './state-machine';
export {
  emptyStats,
  cloneStats,
  computeGoalProgress,
  allGoalsDone,
  evaluateOutcome,
  starsFor,
  maxStars,
} from './goals';
export { createGame, restartGame, abandonGame, assertLevel, LEVEL_IDS } from './game';
export type { AbandonResult } from './game';
