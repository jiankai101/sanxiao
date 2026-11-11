/**
 * 领域契约：唯一来源为 `@core/types`（impl-core 维护）。
 * 本文件只做类型重导出 + systems 侧端口定义，不重复定义任何领域类型。
 */
export type {
  Board,
  Cell,
  CellCoord,
  GameEvent,
  GameState,
  GameStatus,
  GameStats,
  Goal,
  GoalProgress,
  GravityResult,
  LevelConfig,
  LevelId,
  MatchResult,
  Obstacle,
  ObstacleSpec,
  ResolveResult,
  RoundResult,
  RunInfo,
  SpecialCreation,
  SpecialKind,
  SwapContext,
  SwapRejectReason,
  Tile,
  TileKind,
} from '@core/types';

import type { CellCoord, GameState, LevelConfig, ResolveResult } from '@core/types';

export interface GameEngine {
  create(level: LevelConfig, seed: number): GameState;
  trySwap(state: GameState, level: LevelConfig, a: CellCoord, b: CellCoord): ResolveResult;
  restart(state: GameState, level: LevelConfig, newSeed: number): GameState;
  abandon(state: GameState): GameState;
}
