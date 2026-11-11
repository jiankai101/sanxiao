/**
 * Tile tween helpers (REQ-044 visible interpolation).
 *
 * The resolve pipeline is synchronous: the logical snapshot is already final
 * when the renderer runs.  This module supplies the *visual* interpolation that
 * the systems main loop feeds back into the board renderer every frame:
 *
 *   const p = progressAt(elapsedMs, durationFor(kind, policy), 'easeOutCubic');
 *   drawBoard(ctx, visualBoard, { tweens: new Map([[index, { offsetX: dx, offsetY: dy, unit: 'cell', alpha: 1 - p }]]) });
 *
 * Units
 * -----
 *  - `unit: 'px'`   (default) `offsetX` / `offsetY` are logical canvas px
 *    (the same coordinate space as `cellRect()`; 960x720 logical resolution).
 *  - `unit: 'cell'` `offsetX` / `offsetY` are multiples of `CELL_SIZE` (64 px),
 *    so a swap animation is simply `offsetX: 0 -> 1` for a one-cell move.
 *
 * Pure functions only: no DOM, no clock, no mutation.
 */
import { CELL_SIZE } from '../core/constants';
import { easeInOut, easeInQuad, easeOutCubic } from './animation';
import type { MotionPolicy } from './animation';

export type EasingName = 'linear' | 'easeOutCubic' | 'easeInQuad' | 'easeInOut';

/** Easing curves used by the tween progress function. All map [0,1] -> [0,1]. */
export const EASINGS: Readonly<Record<EasingName, (t: number) => number>> = {
  linear: (t) => t,
  easeOutCubic,
  easeInQuad,
  easeInOut,
};

/**
 * Eased tween progress (REQ-044).
 *
 * @param elapsedMs time since the animation started
 * @param durationMs animation duration from `durationFor()`; `0` (reduced motion
 *   snapshots, instant steps) completes immediately
 * @param easing easing curve, default `linear`
 * @returns progress in `[0, 1]`; `elapsedMs <= 0` -> 0, `elapsedMs >= durationMs` -> 1
 */
export function progressAt(elapsedMs: number, durationMs: number, easing: EasingName = 'linear'): number {
  if (!(durationMs > 0)) return 1;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  const t = Math.min(1, elapsedMs / durationMs);
  const eased = EASINGS[easing](t);
  if (!Number.isFinite(eased)) return t;
  return Math.max(0, Math.min(1, eased));
}

/** Per-cell visual override consumed by the board renderer. */
export interface TileTween {
  /** horizontal offset; px by default, multiples of CELL_SIZE with `unit: 'cell'` */
  offsetX?: number;
  /** vertical offset; px by default, multiples of CELL_SIZE with `unit: 'cell'` */
  offsetY?: number;
  /** offset unit, default `'px'` */
  unit?: 'px' | 'cell';
  /** 0..1 opacity multiplier used for clear fade-out; default 1 */
  alpha?: number;
  /** uniform scale about the tile centre (1 = 64x64); default 1 */
  scale?: number;
}

/** Per-cell tweens keyed by board index (row-major, 0..63). */
export type TileTweenMap = ReadonlyMap<number, TileTween>;

export interface ResolvedTileTween {
  /** logical px */
  offsetX: number;
  offsetY: number;
  alpha: number;
  scale: number;
}

export const IDENTITY_TWEEN: ResolvedTileTween = Object.freeze({ offsetX: 0, offsetY: 0, alpha: 1, scale: 1 });

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Resolves a declarative tween into px/alpha/scale.
 * With `reduced` motion all displacement is dropped (REQ-044: no displacement
 * tween under reduced motion); fades/scales stay available for the <=100ms snap.
 */
export function resolveTileTween(tween: TileTween | undefined, motion: MotionPolicy = { reduced: false }): ResolvedTileTween {
  if (tween === undefined) return IDENTITY_TWEEN;
  const unitScale = tween.unit === 'cell' ? CELL_SIZE : 1;
  const reduced = motion.reduced === true;
  const rawScale = tween.scale ?? 1;
  const scale = rawScale > 0 ? rawScale : 0;
  return {
    offsetX: reduced ? 0 : (tween.offsetX ?? 0) * unitScale,
    offsetY: reduced ? 0 : (tween.offsetY ?? 0) * unitScale,
    alpha: clamp(tween.alpha ?? 1, 0, 1),
    scale,
  };
}

/** Maps a cell-ratio offset (1 = one cell) to logical px. */
export function cellOffset(dxCells: number, dyCells: number): { offsetX: number; offsetY: number } {
  return { offsetX: dxCells * CELL_SIZE, offsetY: dyCells * CELL_SIZE };
}
