import { createGame, restartGame, abandonGame, resolveSwap, toIndex } from '@core/index';
import type { CellCoord, GameState, LevelConfig, ResolveResult } from '@core/types';
import type { GameEngine } from '../contracts';

/** core 端口适配：只做坐标换算与调用，不复制任何玩法规则。 */
export const coreEngine: GameEngine = {
  create(level: LevelConfig, seed: number): GameState {
    return createGame(level, seed);
  },
  trySwap(state: GameState, level: LevelConfig, a: CellCoord, b: CellCoord): ResolveResult {
    return resolveSwap(state, level, toIndex(a.row, a.col), toIndex(b.row, b.col));
  },
  restart(state: GameState, level: LevelConfig, newSeed: number): GameState {
    return restartGame(state, level, newSeed);
  },
  abandon(state: GameState): GameState {
    return abandonGame(state).state;
  },
};
