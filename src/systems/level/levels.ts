import type { CellCoord, Goal, LevelConfig, ObstacleSpec, TileKind } from './types';

const ALL_KINDS: readonly TileKind[] = ['star', 'water', 'leaf', 'flame', 'crystal', 'bolt'];
const L5_KINDS: readonly TileKind[] = ['star', 'water', 'leaf', 'flame', 'bolt'];

const grid = (
  rows: readonly number[],
  cols: readonly number[],
): readonly CellCoord[] =>
  rows.flatMap((row) =>
    cols.map((col) => ({ row, col }) as CellCoord),
  );

const at = (row: number, col: number): CellCoord => ({ row, col }) as CellCoord;

const score = (target: number): Goal => ({ id: 'score', type: 'score', target });
const collect = (tile: TileKind, target: number): Goal => ({
  id: `collect-${tile}`,
  type: 'collect',
  tile,
  target,
});
const ice = (target: number): Goal => ({ id: 'ice', type: 'obstacle', obstacle: 'ice', target });
const stone = (target: number): Goal => ({ id: 'stone', type: 'obstacle', obstacle: 'stone', target });

const noObstacles: readonly ObstacleSpec[] = [];

/**
 * 8 关数据，逐项来自 spec 第 6 章；障碍坐标来自 plan 13.3 的确定性建议布局。
 * 纯数据模块：无函数副作用、无 DOM、无存储。
 */
export const LEVELS: readonly LevelConfig[] = [
  {
    id: 1, name: '起步', tileKinds: ALL_KINDS, moves: 20,
    goals: [score(1500)], obstacles: noObstacles,
    stars: { two: 2000, three: 2600 }, difficulty: 0.75,
  },
  {
    id: 2, name: '初潮', tileKinds: ALL_KINDS, moves: 22,
    goals: [collect('water', 18)], obstacles: noObstacles,
    stars: { two: 1800, three: 2400 }, difficulty: 0.818,
  },
  {
    id: 3, name: '薄冰', tileKinds: ALL_KINDS, moves: 24,
    goals: [ice(18)],
    obstacles: [{ type: 'ice', cells: grid([4, 5, 6], [2, 3, 4, 5, 6, 7]) }],
    stars: { two: 2200, three: 2900 }, difficulty: 0.9,
  },
  {
    id: 4, name: '连锁', tileKinds: ALL_KINDS, moves: 24,
    goals: [score(2600)], obstacles: noObstacles,
    stars: { two: 3200, three: 4000 }, difficulty: 1.083,
  },
  {
    id: 5, name: '石障', tileKinds: L5_KINDS, moves: 26,
    goals: [stone(12)],
    obstacles: [{ type: 'stone', cells: grid([2, 4, 6, 8], [2, 4, 6]) }],
    stars: { two: 3000, three: 3900 }, difficulty: 1.154,
  },
  {
    id: 6, name: '双线', tileKinds: L5_KINDS, moves: 26,
    goals: [collect('flame', 18), score(2000)],
    obstacles: [{ type: 'ice', cells: grid([3, 4], [2, 3, 4, 5, 6]) }],
    stars: { two: 3600, three: 4600 }, difficulty: 1.462,
  },
  {
    id: 7, name: '暴风', tileKinds: L5_KINDS, moves: 28,
    goals: [ice(24), stone(6)],
    obstacles: [
      { type: 'ice', cells: grid([2, 3, 4, 5], [2, 3, 4, 5, 6, 7]) },
      {
        type: 'stone',
        cells: [
          at(7, 2), at(7, 4), at(7, 6),
          at(8, 3), at(8, 5), at(8, 7),
        ],
      },
    ],
    stars: { two: 3800, three: 4900 }, difficulty: 1.564,
  },
  {
    id: 8, name: '终章', tileKinds: L5_KINDS, moves: 30,
    goals: [score(3000), stone(10)],
    obstacles: [
      {
        type: 'stone',
        cells: [
          at(2, 3), at(2, 6), at(4, 3), at(4, 6), at(5, 1),
          at(5, 8), at(6, 3), at(6, 6), at(8, 3), at(8, 6),
        ],
      },
      {
        type: 'hole',
        cells: [at(3, 3), at(3, 6), at(6, 2), at(6, 7)],
      },
    ],
    stars: { two: 4400, three: 5600 }, difficulty: 1.833,
  },
];

export const LEVEL_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function getLevel(levelId: number): LevelConfig | undefined {
  return LEVELS.find((level) => level.id === levelId);
}

export function levelName(levelId: number): string {
  return getLevel(levelId)?.name ?? `关卡 ${levelId}`;
}
