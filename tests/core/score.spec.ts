import { describe, expect, it } from 'vitest';
import { lengthBonus, multiplier, scoreRound } from '../../src/core/score/score';
import { DomainError } from '../../src/core/errors';
import type { RunInfo } from '../../src/core/types';

const run = (length: number, orientation: 'h' | 'v' = 'h'): RunInfo => ({
  cells: Array.from({ length }, (_, i) => i),
  orientation,
  kind: 'star',
  length,
});

describe('REQ-014 scoring formula', () => {
  it('matches the spec examples: 3-run c=1 -> 180, 4-run c=2 -> 435, rainbow x2 -> 3840', () => {
    expect(scoreRound({ clearedCount: 3, runs: [run(3)], lineExtra: 0, cascade: 1 })).toBe(180);
    expect(scoreRound({ clearedCount: 4, runs: [run(4)], lineExtra: 0, cascade: 2 })).toBe(435);
    expect(scoreRound({ clearedCount: 64, runs: [], lineExtra: 0, cascade: 1 })).toBe(3840);
  });

  it('multiplier sequence c=1..8 is [1,1.5,2,2.5,3,3.5,4,4]', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(multiplier)).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4]);
    expect(multiplier(99)).toBe(4);
  });

  it('adds 50 per 4-run and 120 per 5+ run', () => {
    expect(lengthBonus([run(4), run(4)])).toBe(100);
    expect(lengthBonus([run(5)])).toBe(120);
    expect(lengthBonus([run(6)])).toBe(120);
    expect(scoreRound({ clearedCount: 8, runs: [run(4), run(4)], lineExtra: 0, cascade: 1 })).toBe(580);
    expect(scoreRound({ clearedCount: 5, runs: [run(5)], lineExtra: 0, cascade: 1 })).toBe(420);
  });

  it('counts line-special extras (S) before the multiplier', () => {
    expect(scoreRound({ clearedCount: 3, runs: [run(3)], lineExtra: 3, cascade: 1 })).toBe(270);
    expect(scoreRound({ clearedCount: 3, runs: [run(3)], lineExtra: 3, cascade: 2 })).toBe(405);
  });

  it('always returns integers and rejects NaN/Infinity', () => {
    for (let c = 1; c <= 12; c += 1) {
      const value = scoreRound({ clearedCount: 7, runs: [run(4)], lineExtra: 2, cascade: c });
      expect(Number.isInteger(value)).toBe(true);
      expect(Number.isNaN(value)).toBe(false);
    }
    expect(() => scoreRound({ clearedCount: Number.NaN, runs: [], lineExtra: 0, cascade: 1 })).toThrow(DomainError);
    expect(() => scoreRound({ clearedCount: 1, runs: [], lineExtra: Number.POSITIVE_INFINITY, cascade: 1 })).toThrow(DomainError);
    expect(() => scoreRound({ clearedCount: 1, runs: [], lineExtra: 0, cascade: Number.NaN })).toThrow(DomainError);
  });
});
