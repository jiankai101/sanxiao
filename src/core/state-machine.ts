/**
 * Game state machine (REQ-017, REQ-018).
 * Pure: no clock access; callers pass `now` and `inputUnlockAt`.
 */
import { IllegalTransitionError } from './errors';
import type { GameStatus } from './types';

export const GAME_STATUSES: readonly GameStatus[] = ['idle', 'playing', 'settling', 'won', 'lost', 'result'];

export type GameEventName =
  | 'START_LEVEL'
  | 'VALID_SWAP'
  | 'INVALID_SWAP'
  | 'ABANDON'
  | 'SETTLE_CONTINUE'
  | 'SETTLE_WIN'
  | 'SETTLE_LOSE'
  | 'SHOW_RESULT'
  | 'RESTART'
  | 'NEXT_LEVEL'
  | 'BACK_TO_SELECT';

const TRANSITIONS: Readonly<Record<GameStatus, Partial<Record<GameEventName, GameStatus>>>> = {
  idle: { START_LEVEL: 'playing' },
  playing: { VALID_SWAP: 'settling', INVALID_SWAP: 'playing', ABANDON: 'idle' },
  settling: { SETTLE_CONTINUE: 'playing', SETTLE_WIN: 'won', SETTLE_LOSE: 'lost' },
  won: { SHOW_RESULT: 'result' },
  lost: { SHOW_RESULT: 'result' },
  result: { RESTART: 'playing', NEXT_LEVEL: 'playing', BACK_TO_SELECT: 'idle' },
};

export function canTransition(from: GameStatus, event: GameEventName): boolean {
  return TRANSITIONS[from]?.[event] !== undefined;
}

export function transition(from: GameStatus, event: GameEventName): GameStatus {
  const next = TRANSITIONS[from]?.[event];
  if (!next) throw new IllegalTransitionError(from, event);
  return next;
}

/** Board input is accepted only while playing and after the unlock timestamp. */
export function canAcceptInput(status: GameStatus, now: number, inputUnlockAt: number): boolean {
  return status === 'playing' && now >= inputUnlockAt;
}

export function panelUnlockAt(panelShownAt: number, lockMs = 300): number {
  return panelShownAt + lockMs;
}
