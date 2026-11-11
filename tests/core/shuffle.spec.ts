import { describe, expect, it } from 'vitest';
import { ensurePlayable, multisetOf } from '../../src/core/board/shuffle';
import { hasAnyMove } from '../../src/core/board/generate';
import { findMatches } from '../../src/core/match/detect';
import { boardFromRows, makeLevel } from './support';
import type { GameState } from '../../src/core/types';
import { emptyStats } from '../../src/core/goals';

const NO_MOVE_ROWS = [
  'sswwllff',
  'sswwllff',
  'llffssww',
  'llffssww',
  'sswwllff',
  'sswwllff',
  'llffssww',
  'llffssww',
];

function stateFrom(board: ReturnType<typeof boardFromRows>): GameState {
  return {
    status: 'playing',
    levelId: 1,
    seed: 1,
    rngState: 1,
    board,
    score: 500,
    movesLeft: 10,
    cascade: 0,
    goals: [],
    stats: emptyStats(),
    settlementId: null,
  };
}

describe('REQ-016 no-move reshuffle', () => {
  it('reshuffles a dead board without changing the multiset, score or moves', () => {
    const board = boardFromRows(NO_MOVE_ROWS);
    expect(hasAnyMove(board)).toBe(false);
    const before = multisetOf(board);
    const result = ensurePlayable(stateFrom(board), makeLevel());
    expect(result.failed).toBe(false);
    expect(result.shuffled).toBe(true);
    expect(hasAnyMove(result.state.board)).toBe(true);
    expect(findMatches(result.state.board).runs).toHaveLength(0);
    expect(multisetOf(result.state.board)).toEqual(before);
    expect(result.state.score).toBe(500);
    expect(result.state.movesLeft).toBe(10);
    expect(result.events[0]?.type).toBe('shuffle');
  });

  it('does nothing when a move already exists', () => {
    const board = boardFromRows([
      'sswwllff',
      'swwllffs',
      'wwllffss',
      'wllffssw',
      'llffssww',
      'lffsswwl',
      'ffsswwll',
      'fsswwllf',
    ]);
    const state = stateFrom(board);
    const result = ensurePlayable(state, makeLevel());
    expect(result.shuffled).toBe(false);
    expect(result.state).toBe(state);
  });

  it('fails (and reports lost) when no multiset arrangement can create a move', () => {
    const board = boardFromRows(['ss........', 'ww........', '..........', '..........', '..........', '..........', '..........', '..........']);
    const result = ensurePlayable(stateFrom(board), makeLevel());
    expect(result.failed).toBe(true);
    expect(result.shuffled).toBe(false);
    expect(result.attempts).toBe(200);
  });
});

