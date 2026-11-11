import { describe, expect, it } from 'vitest';
import { GAME_STATUSES, canAcceptInput, canTransition, panelUnlockAt, transition } from '../../src/core/state-machine';
import { IllegalTransitionError } from '../../src/core/errors';

describe('REQ-017 game state machine', () => {
  it('exposes exactly the six status strings', () => {
    expect(GAME_STATUSES).toEqual(['idle', 'playing', 'settling', 'won', 'lost', 'result']);
  });

  it('accepts every legal transition from plan 5.2', () => {
    expect(transition('idle', 'START_LEVEL')).toBe('playing');
    expect(transition('playing', 'VALID_SWAP')).toBe('settling');
    expect(transition('playing', 'INVALID_SWAP')).toBe('playing');
    expect(transition('playing', 'ABANDON')).toBe('idle');
    expect(transition('settling', 'SETTLE_CONTINUE')).toBe('playing');
    expect(transition('settling', 'SETTLE_WIN')).toBe('won');
    expect(transition('settling', 'SETTLE_LOSE')).toBe('lost');
    expect(transition('won', 'SHOW_RESULT')).toBe('result');
    expect(transition('lost', 'SHOW_RESULT')).toBe('result');
    expect(transition('result', 'RESTART')).toBe('playing');
    expect(transition('result', 'NEXT_LEVEL')).toBe('playing');
    expect(transition('result', 'BACK_TO_SELECT')).toBe('idle');
    expect(canTransition('playing', 'VALID_SWAP')).toBe(true);
  });

  it('throws IllegalTransitionError on illegal moves', () => {
    expect(() => transition('playing', 'SHOW_RESULT')).toThrow(IllegalTransitionError);
    expect(() => transition('won', 'START_LEVEL')).toThrow(IllegalTransitionError);
    expect(() => transition('idle', 'SETTLE_WIN')).toThrow(IllegalTransitionError);
    expect(canTransition('lost', 'NEXT_LEVEL')).toBe(false);
  });

  it('locks input during settling and for 300ms after the panel appears', () => {
    expect(canAcceptInput('settling', 10_000, 0)).toBe(false);
    expect(canAcceptInput('playing', 999, 1000)).toBe(false);
    expect(canAcceptInput('playing', 1000, 1000)).toBe(true);
    expect(canAcceptInput('result', 5000, 0)).toBe(false);
    const unlock = panelUnlockAt(2000);
    expect(unlock).toBe(2300);
    expect(canAcceptInput('playing', 2299, unlock)).toBe(false);
    expect(canAcceptInput('playing', 2300, unlock)).toBe(true);
  });
});
