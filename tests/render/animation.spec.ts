import { describe, expect, it } from 'vitest';
import { ANIMATION_DURATIONS, AnimationQueue, REDUCED_MOTION, durationFor, tweenOffset } from '../../src/render/animation';
import { canAcceptInput, panelUnlockAt } from '../../src/core/state-machine';
import { CLEAR_MS, FALL_MS, PANEL_FADE_MS, REVERT_MS, SPECIAL_MS, SWAP_MS } from '../../src/core/constants';
import type { AnimationKind } from '../../src/render/animation';

const KINDS: AnimationKind[] = ['swap', 'revert', 'clear', 'fall', 'special', 'panel'];

describe('REQ-044 animation timeline & reduced motion', () => {
  it('matches the six required durations', () => {
    expect(ANIMATION_DURATIONS).toEqual({
      swap: SWAP_MS,
      revert: REVERT_MS,
      clear: CLEAR_MS,
      fall: FALL_MS,
      special: SPECIAL_MS,
      panel: PANEL_FADE_MS,
    });
    expect(Object.values(ANIMATION_DURATIONS)).toEqual([150, 200, 180, 160, 300, 200]);
  });

  it('caps every reduced-motion duration at 100ms and disables displacement tweens', () => {
    for (const kind of KINDS) {
      expect(durationFor(kind, REDUCED_MOTION)).toBeLessThanOrEqual(100);
      expect(durationFor(kind, REDUCED_MOTION)).toBe(durationFor(kind, REDUCED_MOTION));
    }
    expect(durationFor('special', REDUCED_MOTION)).toBe(100);
    expect(tweenOffset(0.4, REDUCED_MOTION)).toBe(0);
    expect(tweenOffset(1, REDUCED_MOTION)).toBe(0);
    expect(tweenOffset(0.5, { reduced: false })).toBeGreaterThan(0);
  });

  it('fires each completion callback exactly once and never mutates the snapshot', () => {
    let now = 0;
    const queue = new AnimationQueue(() => now);
    const snapshot = { board: 'immutable', score: 42 };
    const copy = JSON.parse(JSON.stringify(snapshot));
    const done = { swap: 0, clear: 0 };
    queue.play('swap', { onDone: () => (done.swap += 1) });
    queue.play('clear', { onDone: () => (done.clear += 1) });
    now = 100;
    queue.tick();
    expect(done).toEqual({ swap: 0, clear: 0 });
    now = 150;
    queue.tick();
    expect(done.swap).toBe(1);
    now = 330;
    queue.tick();
    queue.tick(400);
    expect(done).toEqual({ swap: 1, clear: 1 });
    expect(queue.activeCount).toBe(0);
    expect(snapshot).toEqual(copy);
  });

  it('keeps the 300ms panel input lock even with reduced motion', () => {
    const shownAt = 1000;
    const unlock = panelUnlockAt(shownAt);
    expect(canAcceptInput('playing', shownAt + 299, unlock)).toBe(false);
    expect(canAcceptInput('playing', shownAt + 300, unlock)).toBe(true);
    expect(canAcceptInput('result', shownAt + 5000, unlock)).toBe(false);
  });
});
