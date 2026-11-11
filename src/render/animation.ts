/**
 * Animation timeline (REQ-017, REQ-044). Durations only affect drawing; the logical
 * state is already final, so the queue never mutates game snapshots.
 */
import { CLEAR_MS, FALL_MS, PANEL_FADE_MS, REDUCED_MOTION_MAX_MS, REVERT_MS, SPECIAL_MS, SWAP_MS } from '../core/constants';

export type AnimationKind = 'swap' | 'revert' | 'clear' | 'fall' | 'special' | 'panel';

export const ANIMATION_DURATIONS: Readonly<Record<AnimationKind, number>> = {
  swap: SWAP_MS,
  revert: REVERT_MS,
  clear: CLEAR_MS,
  fall: FALL_MS,
  special: SPECIAL_MS,
  panel: PANEL_FADE_MS,
};

export interface MotionPolicy {
  reduced: boolean;
}

export const FULL_MOTION: MotionPolicy = { reduced: false };
export const REDUCED_MOTION: MotionPolicy = { reduced: true };

export function durationFor(kind: AnimationKind, policy: MotionPolicy): number {
  const base = ANIMATION_DURATIONS[kind];
  return policy.reduced ? Math.min(base, REDUCED_MOTION_MAX_MS) : base;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Displacement tween: reduced motion never translates anything. */
export function tweenOffset(progress: number, policy: MotionPolicy): number {
  if (policy.reduced) return 0;
  const clamped = Math.max(0, Math.min(1, progress));
  return easeOutCubic(clamped);
}

export interface PlayOptions {
  policy?: MotionPolicy;
  onDone?: () => void;
  onProgress?: (progress: number) => void;
}

interface ActiveAnimation {
  kind: AnimationKind;
  start: number;
  duration: number;
  done: boolean;
  options: PlayOptions;
}

export class AnimationQueue {
  private readonly clock: () => number;
  private active: ActiveAnimation[] = [];
  private completed = 0;

  constructor(clock: () => number) {
    this.clock = clock;
  }

  play(kind: AnimationKind, options: PlayOptions = {}): void {
    const policy = options.policy ?? FULL_MOTION;
    this.active.push({
      kind,
      start: this.clock(),
      duration: durationFor(kind, policy),
      done: false,
      options,
    });
  }

  get activeCount(): number {
    return this.active.length;
  }

  get completedCount(): number {
    return this.completed;
  }

  /** Advances the queue; onDone fires exactly once per animation. */
  tick(now: number = this.clock()): void {
    const remaining: ActiveAnimation[] = [];
    for (const animation of this.active) {
      const elapsed = now - animation.start;
      const progress = animation.duration <= 0 ? 1 : Math.min(1, elapsed / animation.duration);
      animation.options.onProgress?.(progress);
      if (progress >= 1) {
        if (!animation.done) {
          animation.done = true;
          this.completed += 1;
          animation.options.onDone?.();
        }
      } else {
        remaining.push(animation);
      }
    }
    this.active = remaining;
  }

  clear(): void {
    this.active = [];
  }
}

export function createAnimationQueue(clock: () => number): AnimationQueue {
  return new AnimationQueue(clock);
}
