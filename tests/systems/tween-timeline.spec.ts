import { describe, expect, it } from 'vitest';
import { cloneBoard, createGame } from '../../src/core/index';
import type { Board, ResolveResult, RoundResult } from '../../src/core/types';
import { REDUCED_MOTION, durationFor } from '../../src/render/animation';
import { resolveTileTween } from '../../src/render/tween';
import { patternBoard } from '../core/support';
import {
  TWEEN_LAYER_ORDER,
  composeLayerTweens,
  createVisualPlan,
  frameAt,
  revertTweens,
  stepDurationMs,
} from '../../src/systems/game/tween-timeline';
import { buildSceneSteps } from '../../src/render/scene';
import { makeLevel } from '../core/support';
import { animationTrace, clearAnimationTrace, recordAnimation } from '../../src/systems/animation-trace';

function makeBoards(): { from: Board; afterClear: Board; afterGravity: Board } {
  const from = patternBoard();
  const afterClear = cloneBoard(from);
  afterClear.cells[0]!.tile = null;
  afterClear.cells[1]!.tile = null;
  afterClear.cells[2]!.tile = null;
  afterClear.cells[0]!.tile = { id: 9001, kind: 'star', special: 'line-h' };

  const afterGravity = cloneBoard(afterClear);
  const moved = afterGravity.cells[8]!.tile;
  if (!moved) throw new Error('fixture missing tile at index 8');
  afterGravity.cells[8]!.tile = null;
  afterGravity.cells[0]!.tile = moved;
  return { from, afterClear, afterGravity };
}

function makeResult(): { result: ResolveResult; from: Board; round: RoundResult } {
  const { from, afterClear, afterGravity } = makeBoards();
  const round: RoundResult = {
    cascade: 1,
    runs: [],
    cleared: [0, 1, 2],
    specialsCreated: [{ index: 0, special: 'line-h', kind: 'star' }],
    scoreGain: 180,
    iceBroken: 0,
    stoneBroken: 0,
    collected: { star: 3 },
    boardAfterClear: afterClear,
    boardAfterGravity: afterGravity,
  };
  const state = createGame(makeLevel(), 7);
  return {
    from,
    round,
    result: {
      state: { ...state, board: afterGravity },
      rounds: [round],
      events: [{ type: 'swap-committed', a: 0, b: 1 }],
      outcome: 'continue',
    },
  };
}

describe('REQ-044 systems visual timeline', () => {
  it('keeps the render scene step order and adds no extra steps', () => {
    const { result, from } = makeResult();
    const plan = createVisualPlan(result, from);
    expect(plan.steps.map((step) => step.kind)).toEqual(buildSceneSteps(result).map((step) => step.kind));
    expect(plan.steps.map((step) => step.kind)).toEqual(['swap', 'special', 'clear', 'fall']);
    expect(plan.swap).toEqual({ a: 0, b: 1 });
  });

  it('documents fall -> clear -> special as the bottom-up layer order', () => {
    expect(TWEEN_LAYER_ORDER).toEqual(['fall', 'clear', 'special']);
  });

  it('slides both swapped tiles one cell toward each other over the swap step', () => {
    const { result, from } = makeResult();
    const plan = createVisualPlan(result, from);
    const swap = plan.steps[0]!;
    const start = frameAt(plan, swap, 0);
    expect(start.board).toBe(from);
    expect(start.tweens.size).toBe(2);
    expect(start.tweens.get(0)).toMatchObject({ offsetX: 0, offsetY: 0, unit: 'cell' });
    const end = frameAt(plan, swap, 1);
    expect(end.tweens.get(0)).toMatchObject({ offsetX: 1, offsetY: 0, unit: 'cell' });
    expect(end.tweens.get(1)).toMatchObject({ offsetX: -1, offsetY: 0, unit: 'cell' });
  });

  it('pulses the created special at mid-progress', () => {
    const { result, from } = makeResult();
    const plan = createVisualPlan(result, from);
    const special = plan.steps[1]!;
    const mid = frameAt(plan, special, 0.5);
    expect(mid.tweens.get(0)?.scale).toBeCloseTo(1.18, 5);
    expect(frameAt(plan, special, 0).tweens.get(0)?.scale).toBe(1);
  });

  it('fades and shrinks every cleared cell during the clear step', () => {
    const { result, from } = makeResult();
    const plan = createVisualPlan(result, from);
    const clear = plan.steps[2]!;
    const mid = frameAt(plan, clear, 0.5);
    for (const index of [0, 1, 2]) {
      expect(mid.tweens.get(index)?.alpha).toBeCloseTo(0.5, 5);
      expect(mid.tweens.get(index)?.scale).toBeCloseTo(0.86, 5);
    }
    const end = frameAt(plan, clear, 1);
    expect(end.tweens.get(0)?.alpha).toBe(0);
  });

  it('interpolates a gravity move from its source cell to its target cell', () => {
    const { result, from } = makeResult();
    const plan = createVisualPlan(result, from);
    const fall = plan.steps[3]!;
    const start = frameAt(plan, fall, 0);
    expect(start.board).toBe(result.rounds[0]!.boardAfterGravity);
    // tile moved from index 8 (row 2) to index 0 (row 1): drawn one row lower at p=0
    expect(start.tweens.get(0)).toMatchObject({ offsetY: 1, unit: 'cell' });
    const mid = frameAt(plan, fall, 0.5);
    expect(mid.tweens.get(0)?.offsetY).toBeCloseTo(0.5, 5);
    expect(frameAt(plan, fall, 1).tweens.size).toBe(0);
  });

  it('drops every displacement when the motion policy is reduced', () => {
    const { result, from } = makeResult();
    const plan = createVisualPlan(result, from);
    const swap = frameAt(plan, plan.steps[0]!, 1);
    expect(resolveTileTween(swap.tweens.get(0), REDUCED_MOTION).offsetX).toBe(0);
    const fall = frameAt(plan, plan.steps[3]!, 0);
    expect(resolveTileTween(fall.tweens.get(0), REDUCED_MOTION).offsetY).toBe(0);
    const revert = revertTweens(0, 1, 0.5, REDUCED_MOTION);
    const resolved = resolveTileTween(revert.get(0), REDUCED_MOTION);
    expect(resolved.offsetX).toBe(0);
    expect(resolved.scale).toBeLessThan(1);
  });

  it('uses the six configured REQ-044 durations and clamps reduced motion to 100ms', () => {
    expect(stepDurationMs('swap', { reduced: false })).toBe(150);
    expect(stepDurationMs('revert', { reduced: false })).toBe(200);
    expect(stepDurationMs('clear', { reduced: false })).toBe(180);
    expect(stepDurationMs('fall', { reduced: false })).toBe(160);
    expect(stepDurationMs('special', { reduced: false })).toBe(300);
    expect(stepDurationMs('panel', { reduced: false })).toBe(200);
    for (const kind of ['swap', 'revert', 'clear', 'fall', 'special', 'panel'] as const) {
      expect(stepDurationMs(kind, REDUCED_MOTION)).toBeLessThanOrEqual(100);
      expect(durationFor(kind, REDUCED_MOTION)).toBeLessThanOrEqual(100);
    }
  });

  it('composes layers bottom-up so later layers win on the same cell', () => {
    const merged = composeLayerTweens({
      special: new Map([[0, { scale: 1.2 }]]),
      fall: new Map([[0, { offsetY: 1, unit: 'cell' }]]),
      clear: new Map([[0, { alpha: 0.4 }]]),
    });
    expect(merged.get(0)).toEqual({ offsetY: 1, unit: 'cell', alpha: 0.4, scale: 1.2 });
  });
});

describe('REQ-044 animation trace helper', () => {
  it('records kind / duration / reduced flag and can be cleared', () => {
    clearAnimationTrace();
    recordAnimation('swap', 150, false);
    recordAnimation('clear', 100, true);
    const trace = animationTrace();
    expect(trace.map((entry) => [entry.kind, entry.durationMs, entry.reduced])).toEqual([
      ['swap', 150, false],
      ['clear', 100, true],
    ]);
    clearAnimationTrace();
    expect(animationTrace()).toEqual([]);
  });
});

