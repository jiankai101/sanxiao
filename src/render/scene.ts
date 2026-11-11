/**
 * Render integration layer (REQ-040, REQ-044, REQ-051).
 * Consumes a ResolveResult, plays swap -> special -> clear -> fall per cascade and
 * commits exactly once at the end. The result object is treated as read-only.
 */
import { CLEAR_MS, FALL_MS, SPECIAL_MS, SWAP_MS } from '../core/constants';
import type { GameState, ResolveResult } from '../core/types';

export type SceneStepKind = 'swap' | 'special' | 'clear' | 'fall' | 'panel';

export interface SceneStep {
  kind: SceneStepKind;
  cascade: number | null;
  duration: number;
}

export interface SceneOptions {
  onCommit: (state: GameState) => void;
  onStep?: (step: SceneStep) => void;
  schedule?: (callback: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
  warn?: (message: string) => void;
  budgetMs?: number;
}

export interface SceneHandle {
  readonly steps: readonly SceneStep[];
  readonly totalMs: number;
  readonly compressed: boolean;
  stop: () => void;
}

export const SCENE_BUDGET_MS = 6000;

export function buildSceneSteps(result: ResolveResult): SceneStep[] {
  const steps: SceneStep[] = [];
  const hasSwap = result.events.some((event) => event.type === 'swap-committed');
  if (hasSwap) steps.push({ kind: 'swap', cascade: null, duration: SWAP_MS });
  for (const round of result.rounds) {
    if (round.specialsCreated.length > 0) {
      steps.push({ kind: 'special', cascade: round.cascade, duration: SPECIAL_MS });
    }
    steps.push({ kind: 'clear', cascade: round.cascade, duration: CLEAR_MS });
    steps.push({ kind: 'fall', cascade: round.cascade, duration: FALL_MS });
  }
  return steps;
}

export function playResolve(result: ResolveResult, options: SceneOptions): SceneHandle {
  const steps = buildSceneSteps(result);
  const budget = options.budgetMs ?? SCENE_BUDGET_MS;
  const totalMs = steps.reduce((sum, step) => sum + step.duration, 0);
  const compressed = totalMs > budget;
  const scale = compressed && totalMs > 0 ? budget / totalMs : 1;
  if (compressed) options.warn?.(`[scene] compressed ${totalMs}ms of animation into ${budget}ms`);

  const schedule = options.schedule ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
  const cancel = options.cancel ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let index = 0;
  let stopped = false;
  let committed = false;
  let pending: unknown = null;

  const finish = (): void => {
    if (committed || stopped) return;
    committed = true;
    options.onCommit(result.state);
  };

  const advance = (): void => {
    if (stopped) return;
    if (index >= steps.length) {
      finish();
      return;
    }
    const step = steps[index] as SceneStep;
    index += 1;
    options.onStep?.(step);
    const wait = step.duration * scale;
    pending = schedule(() => {
      pending = null;
      advance();
    }, wait);
  };

  advance();

  return {
    steps,
    totalMs,
    compressed,
    stop: () => {
      stopped = true;
      if (pending !== null) {
        cancel(pending);
        pending = null;
      }
    },
  };
}
