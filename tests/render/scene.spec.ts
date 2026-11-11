import { describe, expect, it, vi } from 'vitest';
import { buildSceneSteps, playResolve } from '../../src/render/scene';
import { createGame } from '../../src/core/game';
import { makeLevel } from '../core/support';
import type { ResolveResult, RoundResult } from '../../src/core/types';

function makeResult(roundCount: number, withSpecials = false): ResolveResult {
  const state = createGame(makeLevel(), 7);
  const rounds: RoundResult[] = [];
  for (let i = 1; i <= roundCount; i += 1) {
    rounds.push({
      cascade: i,
      runs: [],
      cleared: [0, 1, 2],
      specialsCreated: withSpecials && i === 1 ? [{ index: 0, special: 'line-h', kind: 'star' }] : [],
      scoreGain: 180,
      iceBroken: 0,
      stoneBroken: 0,
      collected: { star: 3 },
      boardAfterClear: state.board,
      boardAfterGravity: state.board,
    });
  }
  return { state, rounds, events: [{ type: 'swap-committed', a: 0, b: 1 }], outcome: 'continue' };
}

function runToCompletion(result: ResolveResult, options: { budgetMs?: number } = {}) {
  const tasks: { fn: () => void; ms: number }[] = [];
  const steps: string[] = [];
  const commit = vi.fn();
  const handle = playResolve(result, {
    onCommit: commit,
    onStep: (step) => steps.push(`${step.kind}@${step.cascade ?? '-'}`),
    schedule: (fn, ms) => {
      tasks.push({ fn, ms });
      return tasks.length;
    },
    cancel: () => undefined,
    ...options,
  });
  while (tasks.length > 0) {
    const task = tasks.shift();
    task?.fn();
  }
  return { steps, commit, handle, tasks };
}

describe('REQ-040/044/051 scene integration', () => {
  it('plays swap -> clear -> fall per round in cascade order', () => {
    const result = makeResult(2);
    const { steps, commit } = runToCompletion(result);
    expect(steps).toEqual(['swap@-', 'clear@1', 'fall@1', 'clear@2', 'fall@2']);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(result.state);
  });

  it('inserts a special step when a special is created and never mutates the result', () => {
    const result = makeResult(1, true);
    const before = JSON.stringify(result);
    const { steps } = runToCompletion(result);
    expect(steps).toEqual(['swap@-', 'special@1', 'clear@1', 'fall@1']);
    expect(JSON.stringify(result)).toBe(before);
  });

  it('maps every round to exactly one clear and one fall step', () => {
    const result = makeResult(3);
    const steps = buildSceneSteps(result);
    expect(steps.filter((step) => step.kind === 'clear')).toHaveLength(3);
    expect(steps.filter((step) => step.kind === 'fall')).toHaveLength(3);
    expect(steps[0]?.kind).toBe('swap');
  });

  it('compresses waiting (not results) to the 6s budget', () => {
    const result = makeResult(24);
    const { handle } = runToCompletion(result, { budgetMs: 1000 });
    expect(handle.totalMs).toBeGreaterThan(1000);
    expect(handle.compressed).toBe(true);
    expect(handle.steps).toHaveLength(24 * 2 + 1);
    const total = handle.steps.reduce((sum, step) => sum + step.duration, 0);
    expect(total).toBe(handle.totalMs);
  });

  it('commits once even if stop() is called after completion', () => {
    const result = makeResult(1);
    const { commit, handle } = runToCompletion(result);
    expect(commit).toHaveBeenCalledTimes(1);
    handle.stop();
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
