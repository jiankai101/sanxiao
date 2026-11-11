/**
 * Scoring (REQ-009, REQ-014).
 * scoreGain = round((60*N + B + 30*S) * M(c)), M(c) = min(1 + 0.5*(c-1), 4).
 */
import { BASE_SCORE, BONUS_4, BONUS_5, MULTIPLIER_MAX, SPECIAL_EXTRA } from '../constants';
import { DomainError } from '../errors';
import type { RunInfo } from '../types';

export interface ScoreRoundInput {
  /** distinct tiles removed this round (rainbow itself included) */
  clearedCount: number;
  runs: readonly RunInfo[];
  /** cells cleared only because of a line special, not part of the base match */
  lineExtra: number;
  /** cascade index, starting at 1 */
  cascade: number;
}

export function multiplier(cascade: number): number {
  if (!Number.isFinite(cascade) || cascade < 1) {
    throw new DomainError('bad-cascade', `cascade must be >= 1, got ${cascade}`);
  }
  return Math.min(1 + 0.5 * (cascade - 1), MULTIPLIER_MAX);
}

export function lengthBonus(runs: readonly RunInfo[]): number {
  let bonus = 0;
  for (const run of runs) {
    if (run.length === 4) bonus += BONUS_4;
    else if (run.length >= 5) bonus += BONUS_5;
  }
  return bonus;
}

export function scoreRound(input: ScoreRoundInput): number {
  const { clearedCount, runs, lineExtra, cascade } = input;
  for (const value of [clearedCount, lineExtra, cascade]) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new DomainError('bad-score-input', `non-finite score input: ${String(value)}`);
    }
  }
  if (clearedCount < 0 || lineExtra < 0) {
    throw new DomainError('bad-score-input', 'clearedCount and lineExtra must be >= 0');
  }
  const base = BASE_SCORE * clearedCount + lengthBonus(runs) + SPECIAL_EXTRA * lineExtra;
  const gain = Math.round(base * multiplier(cascade));
  if (!Number.isFinite(gain)) {
    throw new DomainError('bad-score-input', 'score gain is not finite');
  }
  return gain;
}
