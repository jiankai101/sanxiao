/**
 * Public domain contract for 001-core-game.
 * Single source of truth: impl-systems re-exports these types, never redefines them.
 * Everything declared here is plain data (JSON.stringify friendly).
 */

export type TileKind = 'star' | 'water' | 'leaf' | 'flame' | 'crystal' | 'bolt';
export type SpecialKind = 'line-h' | 'line-v' | 'rainbow';

export interface Tile {
  /** Monotonic id, only used to track render/animation. */
  id: number;
  /** Rainbow tiles have kind = null. */
  kind: TileKind | null;
  special: SpecialKind | null;
}

export type Obstacle =
  | { type: 'ice'; layers: 1 }
  | { type: 'stone'; layers: 1 | 2 }
  | { type: 'hole' };

export interface Cell {
  tile: Tile | null;
  /** Ice coexists with a tile (overlay); stone/hole never carry a tile. */
  obstacle: Obstacle | null;
}

export interface Board {
  cols: 8;
  rows: 8;
  /** length 64, index = (row - 1) * 8 + (col - 1) */
  cells: Cell[];
  nextTileId: number;
}

export type CellCoord = { row: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; col: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 };
export type LevelId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Goal =
  | { id: string; type: 'score'; target: number }
  | { id: string; type: 'collect'; tile: TileKind; target: number }
  | { id: string; type: 'obstacle'; obstacle: 'ice' | 'stone'; target: number };

export type ObstacleSpec =
  | { type: 'ice'; cells: readonly CellCoord[] }
  | { type: 'stone'; cells: readonly CellCoord[] }
  | { type: 'hole'; cells: readonly CellCoord[] };

export interface LevelConfig {
  id: LevelId;
  name: string;
  tileKinds: readonly TileKind[];
  moves: number;
  goals: readonly Goal[];
  obstacles: readonly ObstacleSpec[];
  stars: { two: number; three: number };
  difficulty: number;
}

export type GameStatus = 'idle' | 'playing' | 'settling' | 'won' | 'lost' | 'result';

export interface GoalProgress {
  goalId: string;
  current: number;
  target: number;
  done: boolean;
}

export interface GameStats {
  movesUsed: number;
  clearedTiles: number;
  iceBroken: number;
  stoneBroken: number;
  collected: Record<TileKind, number>;
}

export interface GameState {
  status: GameStatus;
  levelId: LevelId;
  seed: number;
  /** uint32 */
  rngState: number;
  board: Board;
  score: number;
  movesLeft: number;
  /** current cascade index, 1 when the first round is running */
  cascade: number;
  goals: GoalProgress[];
  stats: GameStats;
  settlementId: string | null;
}

export interface RunInfo {
  cells: number[];
  orientation: 'h' | 'v';
  kind: TileKind;
  length: number;
}

export interface SpecialCreation {
  index: number;
  special: SpecialKind;
  /** null only for rainbow */
  kind: TileKind | null;
}

export interface RoundResult {
  cascade: number;
  runs: RunInfo[];
  cleared: number[];
  specialsCreated: SpecialCreation[];
  scoreGain: number;
  iceBroken: number;
  stoneBroken: number;
  collected: Partial<Record<TileKind, number>>;
  boardAfterClear: Board;
  boardAfterGravity: Board;
}

export type GameEvent =
  | { type: 'swap-committed'; a: number; b: number }
  | { type: 'swap-rejected'; a: number; b: number; reason: SwapRejectReason }
  | { type: 'round-start'; cascade: number }
  | { type: 'tiles-cleared'; cells: number[]; cascade: number }
  | { type: 'special-created'; index: number; special: SpecialKind }
  | { type: 'special-triggered'; special: SpecialKind; origin: number }
  | { type: 'obstacle-hit'; index: number; obstacle: 'ice' | 'stone'; layersAfter: number }
  | { type: 'gravity'; moves: { from: number; to: number }[]; spawned: number[] }
  | { type: 'shuffle'; cells: number[] }
  | { type: 'score-changed'; score: number; delta: number }
  | { type: 'moves-changed'; movesLeft: number }
  | { type: 'won' }
  | { type: 'lost' };

export type SwapRejectReason = 'not-adjacent' | 'blocked' | 'no-match';

export type SwapContext = {
  /** player's dragged cell (origin) */
  from: number;
  /** target cell */
  to: number;
  rainbowRainbow: boolean;
  /** non-null when a rainbow is swapped with a plain tile */
  rainbowPartnerKind: TileKind | null;
};

export interface ResolveResult {
  state: GameState;
  rounds: RoundResult[];
  events: GameEvent[];
  outcome: 'continue' | 'won' | 'lost';
}

export interface GravityResult {
  board: Board;
  moves: { from: number; to: number }[];
  spawned: number[];
}

export interface MatchResult {
  runs: RunInfo[];
  matched: number[];
}
