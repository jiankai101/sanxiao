/**
 * Systems-side visual timeline for REQ-044.
 *
 * The core resolve pipeline is synchronous: `ResolveResult` already contains the
 * final board.  This module turns those immutable snapshots into per-frame
 * `drawBoard()` options (offset / alpha / scale) using the render layer's
 * `progressAt()` + `TileTween` contract.  It never mutates game state and never
 * reimplements interpolation.
 *
 * Step ordering comes from `buildSceneSteps()` (the render layer stays the single
 * source of truth for swap -> special? -> clear -> fall); compositing within one
 * frame follows fall (movement) -> clear (fade) -> special (highlight), bottom-up.
 */
import { cloneBoard, toRowCol } from '@core/index';
import type { Board, Cell, ResolveResult, RoundResult } from '@core/types';
import { durationFor } from '@render/animation';
import type { AnimationKind, MotionPolicy } from '@render/animation';
import { progressAt } from '@render/tween';
import type { EasingName, TileTween, TileTweenMap } from '@render/tween';
import type { SceneStep, SceneStepKind } from '@render/scene';
import { buildSceneSteps } from '@render/scene';

/** Bottom-up draw order inside a visual frame (REQ-044). */
export const TWEEN_LAYER_ORDER = ['fall', 'clear', 'special'] as const;
export type TweenLayerKind = (typeof TWEEN_LAYER_ORDER)[number];

export type TweenStepKind = SceneStepKind | 'revert';

export const STEP_EASING: Readonly<Record<TweenStepKind, EasingName>> = {
  swap: 'easeOutCubic',
  revert: 'easeOutCubic',
  clear: 'easeOutCubic',
  fall: 'easeOutCubic',
  special: 'easeOutCubic',
  panel: 'easeOutCubic',
};

/** Duration of one scene step under a motion policy (REQ-044). */
export function stepDurationMs(kind: TweenStepKind, policy: MotionPolicy): number {
  return durationFor(kind as AnimationKind, policy);
}

export interface VisualPlan {
  result: ResolveResult;
  steps: readonly SceneStep[];
  /** pre-swap board supplied by the caller; null when unavailable */
  fromBoard: Board | null;
  /** board after the committed swap (tiles only), null if no swap event */
  swappedBoard: Board | null;
  swap: { a: number; b: number } | null;
  /** cascade -> board at the start of that round's clear step */
  roundBoards: ReadonlyMap<number, Board>;
  rounds: ReadonlyMap<number, RoundResult>;
}

export interface VisualFrame {
  board: Board;
  tweens: TileTweenMap;
}

function swapTiles(board: Board, a: number, b: number): Board {
  const next = cloneBoard(board);
  const cellA = next.cells[a] as Cell | undefined;
  const cellB = next.cells[b] as Cell | undefined;
  if (!cellA || !cellB) return next;
  const tile = cellA.tile;
  cellA.tile = cellB.tile;
  cellB.tile = tile;
  return next;
}

/**
 * Precomputes the immutable boards each step needs so per-frame work stays O(64).
 */
export function createVisualPlan(result: ResolveResult, fromBoard: Board | null): VisualPlan {
  const steps = buildSceneSteps(result);
  const swapEvent = result.events.find((event) => event.type === 'swap-committed');
  const swap = swapEvent && swapEvent.type === 'swap-committed' ? { a: swapEvent.a, b: swapEvent.b } : null;
  const swappedBoard = swap && fromBoard ? swapTiles(fromBoard, swap.a, swap.b) : null;

  const roundBoards = new Map<number, Board>();
  const rounds = new Map<number, RoundResult>();
  for (let i = 0; i < result.rounds.length; i += 1) {
    const round = result.rounds[i] as RoundResult;
    rounds.set(round.cascade, round);
    const before = i === 0 ? swappedBoard : (result.rounds[i - 1] as RoundResult).boardAfterGravity;
    roundBoards.set(round.cascade, before ?? round.boardAfterClear);
  }

  return { result, steps, fromBoard, swappedBoard, swap, roundBoards, rounds };
}

function swapFrame(plan: VisualPlan, progress: number): VisualFrame {
  const board = plan.fromBoard ?? plan.result.state.board;
  if (!plan.swap) return { board, tweens: new Map() };
  const from = toRowCol(plan.swap.a);
  const to = toRowCol(plan.swap.b);
  const map = new Map<number, TileTween>();
  map.set(plan.swap.a, {
    offsetX: (to.col - from.col) * progress,
    offsetY: (to.row - from.row) * progress,
    unit: 'cell',
  });
  map.set(plan.swap.b, {
    offsetX: (from.col - to.col) * progress,
    offsetY: (from.row - to.row) * progress,
    unit: 'cell',
  });
  return { board, tweens: map };
}

function specialFrame(plan: VisualPlan, round: RoundResult, progress: number): VisualFrame {
  const board = plan.roundBoards.get(round.cascade) ?? round.boardAfterClear;
  const map = new Map<number, TileTween>();
  const pulse = Math.sin(Math.PI * Math.max(0, Math.min(1, progress)));
  for (const creation of round.specialsCreated) {
    map.set(creation.index, { scale: 1 + 0.18 * pulse });
  }
  return { board, tweens: map };
}

function clearFrame(plan: VisualPlan, round: RoundResult, progress: number): VisualFrame {
  const board = plan.roundBoards.get(round.cascade) ?? round.boardAfterClear;
  const map = new Map<number, TileTween>();
  for (const index of round.cleared) {
    map.set(index, { alpha: 1 - progress, scale: 1 - 0.28 * progress });
  }
  return { board, tweens: map };
}

function fallFrame(round: RoundResult, progress: number): VisualFrame {
  const board = round.boardAfterGravity;
  const sourceIndex = new Map<number, number>();
  for (let i = 0; i < round.boardAfterClear.cells.length; i += 1) {
    const tile = (round.boardAfterClear.cells[i] as Cell).tile;
    if (tile) sourceIndex.set(tile.id, i);
  }
  const map = new Map<number, TileTween>();
  for (let i = 0; i < board.cells.length; i += 1) {
    const tile = (board.cells[i] as Cell).tile;
    if (!tile) continue;
    const source = sourceIndex.get(tile.id);
    if (source === undefined) {
      // Newly spawned tile: enters from one cell above and fades in.
      map.set(i, { offsetY: -1.2 * (1 - progress), unit: 'cell', alpha: Math.min(1, 0.25 + 0.75 * progress) });
      continue;
    }
    if (source === i) continue;
    const from = toRowCol(source);
    const to = toRowCol(i);
    const offsetX = (from.col - to.col) * (1 - progress);
    const offsetY = (from.row - to.row) * (1 - progress);
    if (offsetX === 0 && offsetY === 0) continue;
    map.set(i, { offsetX, offsetY, unit: 'cell' });
  }
  return { board, tweens: map };
}

/** Builds the visual frame for one scene step at eased progress in [0,1]. */
export function frameAt(plan: VisualPlan, step: SceneStep, progress: number): VisualFrame {
  const p = Math.max(0, Math.min(1, progress));
  if (step.kind === 'swap') return swapFrame(plan, p);
  const round = step.cascade === null ? undefined : plan.rounds.get(step.cascade);
  if (!round) {
    return { board: plan.result.state.board, tweens: new Map() };
  }
  if (step.kind === 'special') return specialFrame(plan, round, p);
  if (step.kind === 'clear') return clearFrame(plan, round, p);
  if (step.kind === 'fall') return fallFrame(round, p);
  return { board: plan.result.state.board, tweens: new Map() };
}

/** Eased progress for a step, driven by the render layer's progressAt(). */
export function stepProgress(step: SceneStep, elapsedMs: number, durationMs: number): number {
  return progressAt(elapsedMs, durationMs, STEP_EASING[step.kind]);
}

/**
 * Invalid-swap rebound: both cells nudge toward each other and return.
 * Reduced motion keeps the 100ms pulse but drops every displacement.
 */
export function revertTweens(a: number, b: number, progress: number, motion: MotionPolicy): TileTweenMap {
  const p = Math.max(0, Math.min(1, progress));
  const wave = Math.sin(Math.PI * p);
  const map = new Map<number, TileTween>();
  if (motion.reduced) {
    const scale = 1 - 0.06 * wave;
    map.set(a, { scale });
    map.set(b, { scale });
    return map;
  }
  const from = toRowCol(a);
  const to = toRowCol(b);
  const amp = 0.18;
  map.set(a, { offsetX: (to.col - from.col) * amp * wave, offsetY: (to.row - from.row) * amp * wave, unit: 'cell' });
  map.set(b, { offsetX: (from.col - to.col) * amp * wave, offsetY: (from.row - to.row) * amp * wave, unit: 'cell' });
  return map;
}

/** Convenience for tests: merged tween map for all layers, later layers win. */
export function composeLayerTweens(layers: Partial<Record<TweenLayerKind, TileTweenMap>>): TileTweenMap {
  const merged = new Map<number, TileTween>();
  for (const kind of TWEEN_LAYER_ORDER) {
    const layer = layers[kind];
    if (!layer) continue;
    for (const [index, tween] of layer) merged.set(index, { ...merged.get(index), ...tween });
  }
  return merged;
}



