/**
 * 渲染适配层：把 @render 的绘制函数与 scene 时间轴接到 ScenePort。
 * 不含玩法规则，只读 GameState；动画只影响绘制，不改状态。
 *
 * REQ-044: the systems main loop consumes the render layer's tween API
 * (`progressAt` / `TileTween`) and feeds per-frame options into `drawBoard`.
 * Step count and the single commit are still owned by `playResolve()`.
 */
import type { Board, CellCoord, GameState, ResolveResult } from '@core/types';
import { IMAGE_FILES, createAssetStore } from '@render/assets';
import { drawBoard } from '@render/board-renderer';
import { durationFor } from '@render/animation';
import type { MotionPolicy } from '@render/animation';
import { progressAt } from '@render/tween';
import type { TileTweenMap } from '@render/tween';
import { playResolve, SCENE_BUDGET_MS, type SceneHandle, type SceneStep } from '@render/scene';
import type { LayoutSnapshot } from '@render/layout';
import type { ScenePort, SceneSettings, SceneUiState } from './scene-port';
import { createVisualPlan, frameAt, revertTweens, stepProgress } from './tween-timeline';
import { recordAnimation } from '../animation-trace';

const CANVAS_W = 960;
const CANVAS_H = 720;

interface VisualOverride {
  board: Board;
  tweens: TileTweenMap;
  motion: MotionPolicy;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function createCoreScene(canvas: HTMLCanvasElement): ScenePort {
  const ctx = canvas.getContext('2d');
  const store = createAssetStore();
  const images = new Map<string, unknown>();
  let snapshot: LayoutSnapshot | null = null;
  let dpr = 1;
  let state: GameState | null = null;
  let ui: SceneUiState = { selected: null, hover: null };
  let settings: SceneSettings = { reducedMotion: false, colorblindMode: false };
  let handle: SceneHandle | null = null;
  let visual: VisualOverride | null = null;
  let frameRaf: number | null = null;
  let commitTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const indexOf = (cell: CellCoord | null): number | null =>
    cell ? (cell.row - 1) * 8 + (cell.col - 1) : null;

  const motionPolicy = (): MotionPolicy => ({ reduced: settings.reducedMotion });

  const draw = (): void => {
    if (!ctx || !snapshot) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = dpr * snapshot.scale;
    ctx.setTransform(scale, 0, 0, scale, snapshot.offsetX * dpr, snapshot.offsetY * dpr);

    const bg = images.get('bg-main.webp');
    if (bg !== undefined) {
      ctx.drawImage(bg as CanvasImageSource, 0, 0, CANVAS_W, CANVAS_H);
    } else {
      ctx.fillStyle = '#141a33';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    ctx.fillStyle = 'rgba(6,10,26,0.55)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const frame = images.get('board-frame.webp');
    if (frame !== undefined) ctx.drawImage(frame as CanvasImageSource, 200, 72, 560, 560);

    const board = visual?.board ?? state?.board ?? null;
    if (board) {
      drawBoard(ctx, board, {
        images: { get: (name: string) => images.get(name) },
        colorblind: settings.colorblindMode,
        selected: indexOf(ui.selected),
        tweens: visual?.tweens,
        motion: visual?.motion ?? motionPolicy(),
      });
    }
  };

  const stopFrameLoop = (): void => {
    if (frameRaf !== null) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRaf);
      frameRaf = null;
    }
  };

  const stopCommitTimer = (): void => {
    if (commitTimer !== null) {
      clearTimeout(commitTimer);
      commitTimer = null;
    }
  };

  const stopAll = (): void => {
    handle?.stop();
    handle = null;
    stopFrameLoop();
    stopCommitTimer();
  };

  const runFrameLoop = (tick: (timestamp: number) => void): void => {
    if (typeof requestAnimationFrame !== 'function') {
      // Non-browser host (unit tests / fallback): draw the final frame directly.
      tick(nowMs());
      return;
    }
    frameRaf = requestAnimationFrame(tick);
  };

  void (async () => {
    for (const name of IMAGE_FILES) {
      if (name.startsWith('icon-')) continue;
      const loaded = await store.loadImage(name);
      if (loaded.ok && loaded.image) images.set(name, loaded.image);
    }
    draw();
  })();

  return {
    resize(next, nextDpr) {
      snapshot = next;
      dpr = nextDpr;
      draw();
    },
    render(nextState, nextUi) {
      state = nextState;
      ui = nextUi;
      draw();
    },
    play(result: ResolveResult, onCommit: () => void, fromBoard?: Board) {
      stopAll();
      visual = null;

      if (settings.reducedMotion) {
        // <=100ms snap, no displacement tween (REQ-044).
        const duration = durationFor('swap', { reduced: true });
        recordAnimation('reduced-settle', duration, true);
        commitTimer = setTimeout(() => {
          commitTimer = null;
          if (disposed) return;
          visual = null;
          draw();
          onCommit();
        }, duration);
        return;
      }

      const plan = createVisualPlan(result, fromBoard ?? null);
      const fullMotion: MotionPolicy = { reduced: false };
      const totalMs = plan.steps.reduce((sum, step) => sum + step.duration, 0);
      const compressed = totalMs > SCENE_BUDGET_MS;
      const scale = compressed && totalMs > 0 ? SCENE_BUDGET_MS / totalMs : 1;

      let current: SceneStep | null = null;
      let stepStartedAt = 0;

      const tick = (timestamp: number): void => {
        frameRaf = null;
        if (disposed || current === null) return;
        const duration = current.duration * scale;
        const p = stepProgress(current, timestamp - stepStartedAt, duration);
        const frameAtStep = frameAt(plan, current, p);
        visual = { board: frameAtStep.board, tweens: frameAtStep.tweens, motion: fullMotion };
        draw();
        frameRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(tick) : null;
      };

      handle = playResolve(result, {
        onStep: (step) => {
          current = step;
          stepStartedAt = nowMs();
          recordAnimation(step.kind, step.duration * scale, false);
          // Draw the step's first frame immediately so the motion starts on time.
          const frameAtStep = frameAt(plan, step, 0);
          visual = { board: frameAtStep.board, tweens: frameAtStep.tweens, motion: fullMotion };
          draw();
        },
        onCommit: () => {
          stopFrameLoop();
          visual = null;
          draw();
          onCommit();
        },
      });

      if (current !== null) runFrameLoop(tick);
    },
    reject(a: CellCoord, b: CellCoord) {
      stopAll();
      const board = state?.board ?? null;
      const fromIndex = indexOf(a);
      const toIndex = indexOf(b);
      if (!board || fromIndex === null || toIndex === null) {
        draw();
        return;
      }
      const policy = motionPolicy();
      const duration = durationFor('revert', policy);
      recordAnimation('revert', duration, policy.reduced);
      const startedAt = nowMs();

      const tick = (timestamp: number): void => {
        frameRaf = null;
        if (disposed) return;
        const p = progressAt(timestamp - startedAt, duration, 'easeOutCubic');
        visual = { board, tweens: revertTweens(fromIndex, toIndex, p, policy), motion: policy };
        draw();
        if (p < 1) frameRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(tick) : null;
        else visual = null;
      };
      runFrameLoop(tick);
    },
    setSettings(next) {
      settings = { ...next };
      draw();
    },
    dispose() {
      disposed = true;
      stopAll();
      visual = null;
      state = null;
    },
  };
}

