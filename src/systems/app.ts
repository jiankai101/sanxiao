import { starsFor } from '@core/index';
import type { CellCoord, GameEvent, GameState, LevelConfig, ResolveResult } from '@core/types';
import type { GameEngine } from './contracts';
import { coreEngine } from './game/core-engine';
import { isSelectableCellAt } from './game/board-selectable';
import { ensurePlayableAfterSettle } from './game/post-settle';
import { getLevel } from './level/levels';
import { assertLevelsValid } from './level/validate';
import type { LeaderboardStore } from './leaderboard/store';
import { compareRecords } from './leaderboard/sort';
import type { SaveService } from './storage/save-service';
import type { SettingsV1 } from './storage/schema';
import type { SfxEvent } from './audio/sfx-map';
import type { AudioEngine } from './audio/audio-engine';
import type { ScenePort } from './game/scene-port';
import type { BoardGeometry } from '../ui/input/pointer';
import { BoardInput, type BoardInputEvent } from '../ui/input/board-input';
import { BoardPointer } from '../ui/input/pointer';
import { Router } from './router';
import { LiveRegion } from '../ui/live-region';
import { LowMovesNotifier, buildHudModel, formatLiveText, renderHud, type HudElements } from '../ui/hud';
import { ToastHost, TOAST_CORRUPT_MS, TOAST_RESET_MS, TOAST_SHUFFLE_MS } from '../ui/toast';
import { confirmDialog } from '../ui/dialogs';
import { renderLevelSelect } from '../ui/screens/level-select';
import { buildResultModel, renderResultPanel } from '../ui/screens/result-panel';
import { renderPauseMenu } from '../ui/screens/pause-menu';
import { renderSettings } from '../ui/screens/settings';
import { buildLeaderboardModel, renderLeaderboard } from '../ui/screens/leaderboard';

export interface AppElements {
  root: HTMLElement;
  levelSelect: HTMLElement;
  gameScreen: HTMLElement;
  hud: HudElements;
  panels: {
    settings: HTMLElement;
    leaderboard: HTMLElement;
    result: HTMLElement;
    pause: HTMLElement;
  };
  live: HTMLElement;
  toastRoot: HTMLElement;
  audioBadge: HTMLElement;
  pauseBtn: HTMLButtonElement;
  restartBtn: HTMLButtonElement;
  backBtn: HTMLButtonElement;
}

export interface AppStartup {
  recovered: boolean;
  temporary: boolean;
}

export interface AppDeps {
  canvas: HTMLCanvasElement;
  elements: AppElements;
  save: SaveService;
  leaderboard: LeaderboardStore;
  audio: AudioEngine;
  scene: ScenePort;
  geometry: BoardGeometry;
  startup: AppStartup;
  engine?: GameEngine;
  seedProvider?: () => number;
  now?: () => number;
  confirm?: (options: { title: string; message: string; confirmText?: string; cancelText?: string }) => Promise<boolean>;
}

const randomSeed = (): number => {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] as number;
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
};

export class AppController {
  private readonly router: Router;
  private readonly toast: ToastHost;
  private readonly live: LiveRegion;
  private readonly input: BoardInput;
  private readonly pointer: BoardPointer;
  private readonly lowMoves = new LowMovesNotifier();
  private readonly engine: GameEngine;
  private readonly now: () => number;
  private readonly confirm: NonNullable<AppDeps['confirm']>;
  private readonly seedProvider: () => number;
  private readonly motionQuery: MediaQueryList | null;
  private reducedMotion = false;
  private readonly onMotionPreferenceChange = (): void => {
    this.applySettings(this.deps.save.settings);
    this.sceneRender();
  };

  private state: GameState | null = null;
  private level: LevelConfig | null = null;
  private locked = false;
  private paused = false;
  private inputUnlockAt = 0;
  private panelUnlockAt = 0;
  private playStartedAt = 0;
  private playAccumMs = 0;
  private shuffleEvents = 0;
  private disposed = false;

  constructor(private readonly deps: AppDeps) {
    this.engine = deps.engine ?? coreEngine;
    this.now = deps.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.confirm = deps.confirm ?? confirmDialog;
    this.seedProvider = deps.seedProvider ?? randomSeed;

    this.motionQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    this.router = new Router(
      {
        screens: { 'level-select': deps.elements.levelSelect, game: deps.elements.gameScreen },
        panels: deps.elements.panels,
      },
      { isReducedMotion: () => this.reducedMotion },
    );
    this.toast = new ToastHost(deps.elements.toastRoot);
    this.live = new LiveRegion(deps.elements.live);
    this.input = new BoardInput({
      geometry: deps.geometry,
      isInputAllowed: () => this.canAcceptInput(),
      isSelectable: (cell) => isSelectableCellAt(this.state?.board, cell),
      emit: (event) => this.onInputEvent(event),
    });
    this.pointer = new BoardPointer(deps.canvas, deps.geometry, {
      onPress: (sample) => this.input.press(sample),
      onMove: (sample) => this.input.move(sample),
      onRelease: (sample) => this.input.release(sample),
      onCancel: () => this.input.cancel(),
    }, { isInputAllowed: () => this.canAcceptInput() });

    this.bindButtons();
    this.bindVisibility();
    this.motionQuery?.addEventListener?.('change', this.onMotionPreferenceChange);
    this.applySettings(deps.save.settings);
  }

  init(): void {
    const validation = assertSafe();
    if (!validation) {
      this.toast.show('关卡数据异常', { durationMs: TOAST_CORRUPT_MS });
      return;
    }
    if (this.deps.startup.temporary) {
      this.toast.showPersistent('当前为临时存档，刷新将丢失进度');
    }
    if (this.deps.startup.recovered) {
      this.toast.show('存档已重置', { durationMs: TOAST_CORRUPT_MS });
    }

    if (this.deps.save.data.lastSessionInterrupted) {
      this.toast.show('上一局已中断', { durationMs: 3000 });
      this.deps.save.setSessionInterrupted(false);
    }

    this.renderLevelSelect();
    this.router.showScreen('level-select');
  }

  // ---------- 对局 ----------

  startLevel(levelId: number): void {
    const level = getLevel(levelId);
    if (!level) {
      this.toast.show('关卡数据异常', { durationMs: TOAST_CORRUPT_MS });
      return;
    }
    let state: GameState;
    try {
      state = this.engine.create(level, this.seedProvider());
    } catch {
      this.toast.show('关卡初始化失败，请重试', { durationMs: TOAST_CORRUPT_MS });
      this.renderLevelSelect();
      this.router.showScreen('level-select');
      return;
    }

    this.level = level;
    this.state = state;
    this.locked = false;
    this.paused = false;
    this.router.closeAllPanels();
    this.router.showScreen('game');
    this.inputUnlockAt = this.now();
    this.panelUnlockAt = 0;
    this.playStartedAt = this.now();
    this.playAccumMs = 0;
    this.lowMoves.reset();
    this.shuffleEvents = 0;
    this.deps.save.setSessionInterrupted(true);
    this.deps.audio.unlock();
    this.sceneSettings();
    this.sceneRender();
    this.updateHud();
    this.sfx('click');
  }

  private handleSwap(a: CellCoord, b: CellCoord): void {
    if (!this.canAcceptInput() || !this.state || !this.level) return;
    const fromBoard = this.state.board;
    let result: ResolveResult;
    try {
      result = this.engine.trySwap(this.state, this.level, a, b);
    } catch {
      this.toast.show('本局结算出现异常，请重开', { durationMs: TOAST_CORRUPT_MS });
      return;
    }
    const rejected = result.events.some((event) => event.type === 'swap-rejected');
    if (rejected || result.rounds.length === 0) {
      this.sfx('swap');
      this.sfx('invalid');
      this.deps.scene.reject(a, b);
      this.input.clearSelection();
      return;
    }

    this.locked = true;
    this.state = { ...this.state, status: 'settling' };
    this.sfx('swap');
    this.playEventSounds(result.events);
    this.sceneRender();
    this.deps.scene.play(result, () => this.commit(result), fromBoard);
  }

  private commit(result: ResolveResult): void {
    if (this.disposed) return;
    // REQ-016 / BUG-002：结算提交后、进入下一次输入前，若无可行步则保分布重排。
    const post = this.level ? ensurePlayableAfterSettle(result.state, this.level) : null;
    this.state = post ? post.state : result.state;
    this.locked = false;
    this.inputUnlockAt = this.now();
    this.sceneRender();
    this.updateHud();
    if (post && post.events.length > 0) this.playEventSounds(post.events);
    if (post?.forfeited) {
      // 重排失败（极端情况）的确定降级路径：立即判负并结算。
      this.settle(false);
      return;
    }
    if (result.outcome === 'won' || result.outcome === 'lost') {
      this.settle(result.outcome === 'won');
    }
  }

  private settle(won: boolean): void {
    const level = this.level;
    const state = this.state;
    if (!level || !state) return;

    const stars = starsFor(state.score, level.stars, won);
    const previousBest = this.deps.save.record(level.id).bestScore;
    this.stopPlayClock();

    this.deps.save.recordSettlement({
      levelId: level.id,
      won,
      score: state.score,
      stars,
      movesUsed: state.stats.movesUsed,
      clearedTiles: state.stats.clearedTiles,
      playSeconds: this.takePlaySeconds(),
    });

    if (won) {
      this.deps.leaderboard.add({
        levelId: level.id,
        score: state.score,
        stars,
        movesUsed: state.stats.movesUsed,
        achievedAt: new Date().toISOString(),
        seed: state.seed,
        settlementId: state.settlementId ?? undefined,
      });
      this.deps.save.unlockNextLevel(level.id);
    }

    this.sfx(won ? 'win' : 'lose');
    for (let i = 1; i <= stars; i += 1) {
      setTimeout(() => this.sfx('star'), i * 150);
    }
    this.showResult(won, Math.max(previousBest, state.score), stars);
  }

  private showResult(won: boolean, bestScore: number, stars: number): void {
    const level = this.level;
    const state = this.state;
    if (!level || !state) return;
    const panel = this.deps.elements.panels.result;
    const model = buildResultModel({
      level,
      won,
      score: state.score,
      bestScore,
      stars,
      movesLeft: state.movesLeft,
      goals: state.goals,
      hasNextLevel: level.id < 8,
    });
    renderResultPanel(panel, model, {
      onRestart: () => void this.confirmRestart(),
      onNext: () => this.startLevel(level.id + 1),
      onBack: () => this.backToSelect(),
    });
    this.panelUnlockAt = this.now() + 300;
    const buttons = Array.from(panel.querySelectorAll('button'));
    for (const button of buttons) button.disabled = true;
    setTimeout(() => {
      for (const button of buttons) button.disabled = false;
    }, 300);
    this.router.openPanel('result');
    const first = panel.querySelector('button') as HTMLButtonElement | null;
    setTimeout(() => first?.focus(), 0);
  }

  private async confirmRestart(): Promise<void> {
    const ok = await this.confirm({
      title: '重开本局',
      message: '将使用新棋盘重新开始，本局进度作废。确定重开吗？',
      confirmText: '重开',
    });
    if (ok) this.restartLevel();
  }

  restartLevel(): void {
    if (!this.state || !this.level) return;
    const seed = this.seedProvider();
    this.state = this.engine.restart(this.state, this.level, seed);
    this.locked = false;
    this.paused = false;
    this.router.closeAllPanels();
    this.router.showScreen('game');
    this.inputUnlockAt = this.now();
    this.playStartedAt = this.now();
    this.playAccumMs = 0;
    this.lowMoves.reset();
    this.shuffleEvents = 0;
    this.deps.save.setSessionInterrupted(true);
    this.input.clearSelection();
    this.sceneRender();
    this.updateHud();
    this.sfx('click');
  }

  backToSelect(): void {
    if (this.state) {
      this.state = this.engine.abandon(this.state);
      this.deps.save.setSessionInterrupted(false);
    }
    this.state = null;
    this.level = null;
    this.locked = false;
    this.paused = false;
    this.playStartedAt = 0;
    this.playAccumMs = 0;
    this.input.clearSelection();
    this.router.closeAllPanels();
    this.router.showScreen('level-select');
    this.renderLevelSelect();
  }

  // ---------- 面板 ----------

  openSettings(): void {
    const panel = this.deps.elements.panels.settings;
    renderSettings(panel, this.deps.save.settings, {
      onChange: (patch) => this.changeSettings(patch),
      onResetProgress: () => void this.resetProgress(),
      onClearLeaderboard: () => void this.clearLeaderboard(),
      onClose: () => this.router.closePanel('settings'),
    });
    this.router.openPanel('settings');
    this.sfx('click');
  }

  openLeaderboard(): void {
    this.renderLeaderboard(undefined);
    this.router.openPanel('leaderboard');
    this.sfx('click');
  }

  private renderLeaderboard(filterLevelId: number | undefined): void {
    const panel = this.deps.elements.panels.leaderboard;
    const records = this.deps.leaderboard.all().slice().sort(compareRecords);
    renderLeaderboard(panel, buildLeaderboardModel(records, filterLevelId), {
      onFilter: (levelId) => this.renderLeaderboard(levelId),
      onClear: () => void this.clearLeaderboard(),
      onClose: () => this.router.closePanel('leaderboard'),
    });
  }

  private async clearLeaderboard(): Promise<void> {
    const ok = await this.confirm({
      title: '清空本地排行榜',
      message: '本地排行榜数据不可恢复。确定清空吗？',
      confirmText: '清空',
    });
    if (!ok) return;
    this.deps.leaderboard.clear();
    this.toast.show('本地排行榜已清空', { durationMs: TOAST_RESET_MS });
    if (this.router.currentPanel === 'leaderboard') this.renderLeaderboard(undefined);
  }

  private async resetProgress(): Promise<void> {
    const ok = await this.confirm({
      title: '重置游戏进度',
      message: '将清除关卡进度、最高分、星级与本地排行榜，且不可恢复。确定继续吗？',
      confirmText: '重置',
    });
    if (!ok) return;
    this.deps.save.resetProgress();
    this.deps.leaderboard.clear();
    this.applySettings(this.deps.save.settings);
    this.state = null;
    this.level = null;
    this.router.closeAllPanels();
    this.router.showScreen('level-select');
    this.renderLevelSelect();
    this.toast.show('游戏进度已重置', { durationMs: TOAST_RESET_MS });
  }

  openPause(): void {
    if (!this.state || this.state.status !== 'playing') return;
    this.paused = true;
    this.stopPlayClock();
    renderPauseMenu(this.deps.elements.panels.pause, {
      onResume: () => {
        this.paused = false;
        this.playStartedAt = this.now();
        this.router.closePanel('pause');
      },
      onRestart: () => void this.confirmRestart(),
      onBack: () => this.backToSelect(),
    });
    this.router.openPanel('pause');
    this.sfx('click');
  }

  // ---------- 内部 ----------

  private bindButtons(): void {
    this.deps.elements.pauseBtn.addEventListener('click', () => this.openPause());
    this.deps.elements.restartBtn.addEventListener('click', () => void this.confirmRestart());
    this.deps.elements.backBtn.addEventListener('click', () => this.backToSelect());
  }

  private bindVisibility(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      const hidden = document.visibilityState === 'hidden';
      this.deps.audio.onVisibility(hidden);
      if (hidden) this.stopPlayClock();
      else if (this.state?.status === 'playing' && !this.paused) this.playStartedAt = this.now();
    });
  }

  private changeSettings(patch: Partial<SettingsV1>): void {
    const data = this.deps.save.updateSettings(patch);
    this.applySettings(data.settings);
    this.sceneRender();
  }

  private applySettings(settings: SettingsV1): void {
    this.reducedMotion = settings.reducedMotion || (this.motionQuery?.matches ?? false);
    this.router.setReducedMotion(this.reducedMotion);
    this.deps.audio.setSettings(settings);
    this.deps.scene.setSettings({
      reducedMotion: this.reducedMotion,
      colorblindMode: settings.colorblindMode,
    });
    this.syncAudioBadge();
  }

  private sceneSettings(): void {
    this.applySettings(this.deps.save.settings);
  }

  private sceneRender(): void {
    this.deps.scene.render(this.state, {
      selected: this.input.selection,
      hover: null,
    });
  }

  private canAcceptInput(): boolean {
    if (!this.state || this.locked || this.paused) return false;
    if (this.router.currentPanel !== null) return false;
    if (this.state.status !== 'playing') return false;
    return this.now() >= Math.max(this.inputUnlockAt, this.panelUnlockAt);
  }

  private onInputEvent(event: BoardInputEvent): void {
    switch (event.type) {
      case 'swap':
        this.handleSwap(event.a, event.b);
        break;
      case 'invalid':
        this.sfx('invalid');
        this.sceneRender();
        break;
      case 'select':
      case 'deselect':
        this.sceneRender();
        break;
      case 'hover':
        break;
    }
  }

  private updateHud(): void {
    if (!this.state) return;
    const model = buildHudModel({
      score: this.state.score,
      movesLeft: this.state.movesLeft,
      goals: this.state.goals,
      level: this.level ?? undefined,
    });
    renderHud(this.deps.elements.hud, model);
    this.live.update(formatLiveText(model));
    if (this.lowMoves.check(model.moves)) {
      this.toast.show('剩余步数不多了', { durationMs: TOAST_SHUFFLE_MS });
    }
  }

  private playEventSounds(events: readonly GameEvent[]): void {
    let cascadeSeen = false;
    for (const event of events) {
      if (event.type === 'round-start') {
        if (event.cascade === 1 && !cascadeSeen) {
          this.sfx('match');
          cascadeSeen = true;
        } else if (event.cascade >= 2) {
          this.sfx('cascade');
        }
      } else if (event.type === 'special-triggered') {
        this.sfx(event.special === 'rainbow' ? 'special-rainbow' : 'special-line');
      } else if (event.type === 'obstacle-hit') {
        this.sfx(event.obstacle === 'ice' ? 'ice-break' : 'stone-break');
      } else if (event.type === 'shuffle') {
        this.shuffleEvents += 1;
        this.sfx('shuffle');
        this.toast.show('无可消除步骤，已重排', { durationMs: TOAST_SHUFFLE_MS });
      }
    }
  }

  private sfx(event: SfxEvent): void {
    void this.deps.audio.playSfx(event).then(() => this.syncAudioBadge());
  }

  private syncAudioBadge(): void {
    this.deps.elements.audioBadge.classList.toggle('hidden', !this.deps.audio.unavailable);
  }

  private renderLevelSelect(): void {
    renderLevelSelect(this.deps.elements.levelSelect, this.deps.save.data, {
      onStart: (levelId) => this.startLevel(levelId),
      onBack: () => this.toast.show('已在主菜单', { durationMs: TOAST_SHUFFLE_MS }),
      onSettings: () => this.openSettings(),
      onLeaderboard: () => this.openLeaderboard(),
      onClickSound: () => this.sfx('click'),
    });
  }

  private stopPlayClock(): void {
    if (this.playStartedAt > 0) {
      this.playAccumMs += this.now() - this.playStartedAt;
      this.playStartedAt = 0;
    }
  }

  private takePlaySeconds(): number {
    const seconds = Math.floor(this.playAccumMs / 1000);
    this.playAccumMs = 0;
    return seconds;
  }

  /** rAF 循环调用；只重绘，不推进逻辑。 */
  renderFrame(): void {
    if (this.router.currentScreen === 'game') this.sceneRender();
  }

  /** 测试钩子：只读对局快照。 */
  snapshot(): { status: string; levelId: number; seed: number; score: number; movesLeft: number } | null {
    if (!this.state) return null;
    return {
      status: this.state.status,
      levelId: this.state.levelId,
      seed: this.state.seed,
      score: this.state.score,
      movesLeft: this.state.movesLeft,
    };
  }

  /** 测试钩子：按坐标提交一次交换（与指针路径同一处理函数）。 */
  attemptSwap(a: CellCoord, b: CellCoord): void {
    this.handleSwap(a, b);
  }

  /** 测试钩子：只读棋盘引用（不写）。 */
  boardForTests() {
    return this.state?.board ?? null;
  }

  /** 测试钩子：结算面板输入锁的绝对解锁时间（与 performance.now 同源）。 */
  panelUnlockAtForTests(): number | null {
    return this.panelUnlockAt > 0 ? this.panelUnlockAt : null;
  }

  /** 测试钩子：本局已处理的 shuffle 事件次数（REQ-016 / BUG-002）。 */
  shuffleEventsForTests(): number {
    return this.shuffleEvents;
  }

  get selectedCell(): CellCoord | null {
    return this.input.selection;
  }
  dispose(): void {
    this.disposed = true;
    this.motionQuery?.removeEventListener?.('change', this.onMotionPreferenceChange);
    this.pointer.dispose();
    this.live.dispose();
  }
}

function assertSafe(): boolean {
  try {
    assertLevelsValid();
    return true;
  } catch {
    return false;
  }
}


