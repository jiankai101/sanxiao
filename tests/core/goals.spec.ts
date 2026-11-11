import { describe, expect, it } from 'vitest';
import { allGoalsDone, computeGoalProgress, emptyStats, evaluateOutcome, maxStars, starsFor } from '../../src/core/goals';
import { makeLevel } from './support';

describe('REQ-022/023/024/026 goals & stars', () => {
  it('tracks score, collect and obstacle goals', () => {
    const level = makeLevel({
      goals: [
        { id: 'score', type: 'score', target: 1500 },
        { id: 'water', type: 'collect', tile: 'water', target: 18 },
        { id: 'ice', type: 'obstacle', obstacle: 'ice', target: 18 },
      ],
    });
    const stats = emptyStats();
    stats.collected.water = 18;
    stats.iceBroken = 18;
    const progress = computeGoalProgress(level.goals, 1500, stats);
    expect(progress.map((p) => [p.goalId, p.current, p.target, p.done])).toEqual([
      ['score', 1500, 1500, true],
      ['water', 18, 18, true],
      ['ice', 18, 18, true],
    ]);
    expect(allGoalsDone(progress)).toBe(true);
  });

  it('requires every goal (AND) before a win', () => {
    const level = makeLevel({
      goals: [
        { id: 'water', type: 'collect', tile: 'water', target: 18 },
        { id: 'score', type: 'score', target: 2000 },
      ],
    });
    const stats = emptyStats();
    stats.collected.water = 18;
    const progress = computeGoalProgress(level.goals, 1999, stats);
    expect(allGoalsDone(progress)).toBe(false);
    expect(evaluateOutcome({ score: 1999, movesLeft: 5, stats }, level)).toBe('continue');
    expect(evaluateOutcome({ score: 2000, movesLeft: 0, stats }, level)).toBe('won');
  });

  it('counts obstacle goals only through broken counters (holes never count)', () => {
    const level = makeLevel({ goals: [{ id: 'stone', type: 'obstacle', obstacle: 'stone', target: 1 }] });
    const stats = emptyStats();
    expect(evaluateOutcome({ score: 0, movesLeft: 3, stats }, level)).toBe('continue');
    stats.stoneBroken = 1;
    expect(evaluateOutcome({ score: 0, movesLeft: 3, stats }, level)).toBe('won');
    expect(stats.iceBroken).toBe(0);
  });

  it('applies star thresholds at boundary -1 / boundary / +1', () => {
    const stars = { two: 2000, three: 2600 };
    expect(starsFor(1999, stars, true)).toBe(1);
    expect(starsFor(2000, stars, true)).toBe(2);
    expect(starsFor(2599, stars, true)).toBe(2);
    expect(starsFor(2600, stars, true)).toBe(3);
    expect(starsFor(99999, stars, true)).toBe(3);
    expect(starsFor(99999, stars, false)).toBe(0);
  });

  it('keeps the historical maximum star count', () => {
    expect(maxStars(2, 1)).toBe(2);
    expect(maxStars(1, 3)).toBe(3);
    expect(maxStars(0, 0)).toBe(0);
  });

  it('loses only when moves are exhausted without all goals', () => {
    const level = makeLevel({ goals: [{ id: 'score', type: 'score', target: 1500 }] });
    const stats = emptyStats();
    expect(evaluateOutcome({ score: 0, movesLeft: 0, stats }, level)).toBe('lost');
    expect(evaluateOutcome({ score: 0, movesLeft: 1, stats }, level)).toBe('continue');
  });
});
