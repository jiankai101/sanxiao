import type { CellCoord, LevelConfig, LevelId } from './types';
import { LEVELS } from './levels';

export const LEVEL_MOVES = [20, 22, 24, 24, 26, 26, 28, 30] as const;

/** spec 第 6 章数量：索引 0..7 对应关卡 1..8。 */
const EXPECTED = [
  { ice: 0, stone: 0, hole: 0 },
  { ice: 0, stone: 0, hole: 0 },
  { ice: 18, stone: 0, hole: 0 },
  { ice: 0, stone: 0, hole: 0 },
  { ice: 0, stone: 12, hole: 0 },
  { ice: 10, stone: 0, hole: 0 },
  { ice: 24, stone: 6, hole: 0 },
  { ice: 0, stone: 10, hole: 4 },
] as const;

const LEVEL8_HOLES = new Set(['3,3', '3,6', '6,2', '6,7']);

const key = (c: CellCoord): string => `${c.row},${c.col}`;

export function computeDifficulty(level: LevelConfig): number {
  let points = 0;
  for (const goal of level.goals) {
    if (goal.type === 'score') points += goal.target / 100;
    else if (goal.type === 'collect') points += goal.target * 1;
    else if (goal.obstacle === 'ice') points += goal.target * 1.2;
    else points += goal.target * 2.5;
  }
  return Math.round((points / level.moves) * 1000) / 1000;
}

export interface LevelValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateLevels(levels: readonly LevelConfig[] = LEVELS): LevelValidationResult {
  const errors: string[] = [];

  if (levels.length !== 8) errors.push(`关卡数量应为 8，实际 ${levels.length}`);

  levels.forEach((level, index) => {
    const tag = `L${level.id}`;
    if (level.id !== index + 1) errors.push(`${tag}: 关卡 ID 不连续`);
    if (level.moves !== LEVEL_MOVES[index]) {
      errors.push(`${tag}: 步数应为 ${LEVEL_MOVES[index]}，实际 ${level.moves}`);
    }
    const expectedKinds = level.id <= 4 ? 6 : 5;
    if (level.tileKinds.length !== expectedKinds) {
      errors.push(`${tag}: 元素种类应为 ${expectedKinds}，实际 ${level.tileKinds.length}`);
    }
    if (level.id >= 5 && level.tileKinds.includes('crystal')) {
      errors.push(`${tag}: 第 5-8 关不得包含 crystal`);
    }

    const counts = { ice: 0, stone: 0, hole: 0 };
    const seen = new Map<string, string>();
    for (const spec of level.obstacles) {
      for (const cell of spec.cells) {
        if (cell.row < 1 || cell.row > 8 || cell.col < 1 || cell.col > 8) {
          errors.push(`${tag}: ${spec.type} 坐标越界 (${cell.row},${cell.col})`);
          continue;
        }
        const k = key(cell);
        const prev = seen.get(k);
        if (prev === spec.type) errors.push(`${tag}: ${spec.type} 坐标重复 (${k})`);
        if (prev && (prev === 'stone' || prev === 'hole') !== (spec.type === 'stone' || spec.type === 'hole')) {
          errors.push(`${tag}: ${spec.type} 与 ${prev} 重叠 (${k})`);
        }
        if (prev === 'stone' && spec.type === 'hole') errors.push(`${tag}: 石块与死格重叠 (${k})`);
        seen.set(k, spec.type);
        counts[spec.type] += 1;
      }
    }

    const exp = EXPECTED[index];
    if (counts.ice !== exp.ice) errors.push(`${tag}: 冰块数量应为 ${exp.ice}，实际 ${counts.ice}`);
    if (counts.stone !== exp.stone) errors.push(`${tag}: 石块数量应为 ${exp.stone}，实际 ${counts.stone}`);
    if (counts.hole !== exp.hole) errors.push(`${tag}: 死格数量应为 ${exp.hole}，实际 ${counts.hole}`);

    if (level.id === 3) {
      for (const spec of level.obstacles) {
        if (spec.type !== 'ice') continue;
        for (const cell of spec.cells) {
          if (cell.row < 4 || cell.row > 6 || cell.col < 2 || cell.col > 7) {
            errors.push(`L3: 冰块必须位于行 4-6、列 2-7，( ${key(cell)} ) 越界`);
          }
        }
      }
    }

    if (level.id === 8) {
      const holes = new Set(
        level.obstacles.filter((s) => s.type === 'hole').flatMap((s) => s.cells.map(key)),
      );
      if (holes.size !== 4 || [...LEVEL8_HOLES].some((h) => !holes.has(h))) {
        errors.push('L8: 死格集合必须精确等于 {(3,3),(3,6),(6,2),(6,7)}');
      }
    }

    for (const goal of level.goals) {
      if (goal.type === 'collect' && !level.tileKinds.includes(goal.tile)) {
        errors.push(`${tag}: 收集目标 ${goal.tile} 不在 tileKinds 中`);
      }
      if (goal.type !== 'score' && goal.target <= 0) errors.push(`${tag}: 目标数量必须 > 0`);
      if (goal.type === 'score' && goal.target <= 0) errors.push(`${tag}: 分数目标必须 > 0`);
    }

    const recomputed = computeDifficulty(level);
    if (Math.abs(recomputed - level.difficulty) > 0.01) {
      errors.push(`${tag}: D 应为 ${level.difficulty}，重算 ${recomputed}`);
    }
    if (!(level.stars.two > 0 && level.stars.three > level.stars.two)) {
      errors.push(`${tag}: 星级阈值必须满足 0 < 2★ < 3★`);
    }
  });

  for (let i = 1; i < levels.length; i += 1) {
    const prev = levels[i - 1];
    const cur = levels[i];
    if (!(cur.difficulty > prev.difficulty)) {
      errors.push(`D 必须严格递增：L${prev.id}=${prev.difficulty} → L${cur.id}=${cur.difficulty}`);
    }
    if (cur.difficulty - prev.difficulty > 0.35) {
      errors.push(`相邻 D 增幅超过 0.35：L${prev.id} → L${cur.id}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertLevelsValid(levels: readonly LevelConfig[] = LEVELS): void {
  const result = validateLevels(levels);
  if (!result.ok) throw new Error(`关卡数据异常: ${result.errors.join('; ')}`);
}

export function levelIndex(levelId: LevelId): number {
  return levelId - 1;
}
