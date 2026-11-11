import '../ui/styles.css';
import { inspectSwap } from '@core/index';
import type { CellCoord } from '@core/types';
import { CanvasHost, RESIZE_DEBOUNCE_MS } from '@render/canvas-host';
import { RenderLoop } from '@render/loop';
import { AppController } from './app';
import { createBoardGeometry } from './game/geometry';
import { createCoreScene } from './game/core-scene';
import { LeaderboardStore } from './leaderboard/store';
import { SaveService } from './storage/save-service';
import { SaveStore } from './storage/save-store';
import { AudioEngine } from './audio/audio-engine';
import { animationTrace, clearAnimationTrace } from './animation-trace';
import { stepDurationMs } from './game/tween-timeline';

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
}

function showFallback(message?: string): void {
  const fallback = document.getElementById('fallback');
  const stage = document.getElementById('stage');
  if (message) {
    const p = fallback?.querySelector('p');
    if (p) p.textContent = message;
  }
  fallback?.classList.remove('hidden');
  stage?.classList.add('hidden');
}

function readFixedSeed(): number | null {
  if (!__TEST__) return null;
  try {
    const value = new URLSearchParams(location.search).get('seed');
    if (value === null) return null;
    const seed = Number(value);
    return Number.isFinite(seed) ? seed >>> 0 : null;
  } catch {
    return null;
  }
}

function boot(): void {
  const canvas = must<HTMLCanvasElement>('game');
  try {
    if (canvas.getContext('2d') === null) {
      showFallback();
      return;
    }
  } catch {
    showFallback();
    return;
  }

  const saveStore = SaveStore.fromGlobal();
  const loaded = saveStore.load();
  const save = new SaveService(saveStore);
  const leaderboard = LeaderboardStore.fromGlobal();
  leaderboard.load();
  const audio = new AudioEngine();
  const scene = createCoreScene(canvas);

  const host = new CanvasHost(canvas, { debounceMs: RESIZE_DEBOUNCE_MS });
  const geometry = createBoardGeometry(canvas, host);

  const applyViewport = (): void => {
    const snapshot = host.applyViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio);
    scene.resize(snapshot, host.dpr);
  };
  applyViewport();

  const fixedSeed = readFixedSeed();
  let seedStep = 0;
  const seedProvider = fixedSeed === null ? undefined : () => (fixedSeed + seedStep++) >>> 0;
  const app = new AppController({
    canvas,
    elements: {
      root: must('app'),
      levelSelect: must('screen-level-select'),
      gameScreen: must('screen-game'),
      hud: { score: must('hud-score'), moves: must('hud-moves'), goals: must('hud-goals') },
      panels: {
        settings: must('panel-settings'),
        leaderboard: must('panel-leaderboard'),
        result: must('panel-result'),
        pause: must('panel-pause'),
      },
      live: must('game-live'),
      toastRoot: must('toast-root'),
      audioBadge: must('audio-badge'),
      pauseBtn: must<HTMLButtonElement>('btn-pause'),
      restartBtn: must<HTMLButtonElement>('btn-restart'),
      backBtn: must<HTMLButtonElement>('btn-back'),
    },
    save,
    leaderboard,
    audio,
    scene,
    geometry,
    startup: { recovered: loaded.recovered, temporary: saveStore.isTemporary },
    seedProvider,
  });
  app.init();

  let resizeTimer: number | null = null;
  window.addEventListener('resize', () => {
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      applyViewport();
      app.renderFrame();
    }, RESIZE_DEBOUNCE_MS) as unknown as number;
  });

  const loop = new RenderLoop({
    raf: (callback) => window.requestAnimationFrame(callback),
    caf: (handle) => window.cancelAnimationFrame(handle as number),
    now: () => performance.now(),
    draw: () => app.renderFrame(),
    visibility: document,
  });
  loop.start();

  window.__wmgPerf = () => ({
    p95: loop.stats.p95(),
    lowFpsRatio: loop.stats.lowFpsRatio(),
    samples: loop.stats.samples,
  });

  if (__TEST__) {
    window.__wmgTest = {
      startLevel: (levelId) => app.startLevel(levelId),
      state: () => app.snapshot(),
      findMove: () => {
        const current = app.snapshot();
        if (!current) return null;
        for (let index = 0; index < 64; index += 1) {
          const row = Math.floor(index / 8) + 1;
          const col = (index % 8) + 1;
          const right = col < 8 ? index + 1 : -1;
          const down = row < 8 ? index + 8 : -1;
          for (const target of [right, down]) {
            if (target < 0) continue;
            const board = app.boardForTests();
            if (!board) return null;
            if (inspectSwap(board, index, target).valid) {
              return {
                a: { row, col },
                b: target === right ? { row, col: col + 1 } : { row: row + 1, col },
              } as { a: CellCoord; b: CellCoord };
            }
          }
        }
        return null;
      },
      swap: (a, b) => app.attemptSwap(a as CellCoord, b as CellCoord),
      selected: () => app.selectedCell,
      openSettings: () => app.openSettings(),
      openLeaderboard: () => app.openLeaderboard(),
      backToSelect: () => app.backToSelect(),
      animations: () => animationTrace().map(({ kind, durationMs, reduced }) => ({ kind, durationMs, reduced })),
      resetAnimations: () => clearAnimationTrace(),
      panelUnlockAt: () => app.panelUnlockAtForTests(),
      shuffleEvents: () => app.shuffleEventsForTests(),
      audio: () => ({ unlocked: audio.isUnlocked, playing: audio.isPlayingBgm, unavailable: audio.unavailable }),
      motionDurations: () => ({
        full: {
          swap: stepDurationMs('swap', { reduced: false }),
          revert: stepDurationMs('revert', { reduced: false }),
          clear: stepDurationMs('clear', { reduced: false }),
          fall: stepDurationMs('fall', { reduced: false }),
          special: stepDurationMs('special', { reduced: false }),
          panel: stepDurationMs('panel', { reduced: false }),
        },
        reduced: {
          swap: stepDurationMs('swap', { reduced: true }),
          revert: stepDurationMs('revert', { reduced: true }),
          clear: stepDurationMs('clear', { reduced: true }),
          fall: stepDurationMs('fall', { reduced: true }),
          special: stepDurationMs('special', { reduced: true }),
          panel: stepDurationMs('panel', { reduced: true }),
        },
      }),
    };
  }
}

try {
  boot();
} catch (error) {
  console.error(error);
  showFallback('启动失败，请刷新页面重试。');
}


