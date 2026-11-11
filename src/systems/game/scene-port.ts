import type { Board, CellCoord, GameState, ResolveResult } from '@core/types';
import type { LayoutSnapshot } from '@render/layout';

export interface SceneSettings {
  reducedMotion: boolean;
  colorblindMode: boolean;
}

export interface SceneUiState {
  selected: CellCoord | null;
  hover: CellCoord | null;
}

/** 渲染端口：由 @render/scene 提供；缺失时使用集成垫片。 */
export interface ScenePort {
  resize(snapshot: LayoutSnapshot, dpr: number): void;
  render(state: GameState | null, ui: SceneUiState): void;
  /**
   * 播放一次结算动画。`fromBoard` 是交换前的棋盘快照，仅用于 swap 位移补间；
   * 缺省时退化为直接绘制最终棋盘，不影响步数与结算。
   */
  play(result: ResolveResult, onCommit: () => void, fromBoard?: Board): void;
  reject(a: CellCoord, b: CellCoord): void;
  setSettings(settings: SceneSettings): void;
  dispose(): void;
}
