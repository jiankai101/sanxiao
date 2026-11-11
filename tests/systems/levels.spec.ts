import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/systems/level/levels';
import { computeDifficulty, validateLevels } from '../../src/systems/level/validate';

describe('REQ-021/REQ-022/REQ-027 关卡数据', () => {
  it('REQ-021 8 关 ID 连续、步数精确匹配', () => {
    expect(LEVELS).toHaveLength(8);
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(LEVELS.map((l) => l.moves)).toEqual([20, 22, 24, 24, 26, 26, 28, 30]);
  });

  it('REQ-027 D 序列逐项匹配 spec 且严格递增、增幅 ≤0.35', () => {
    const expected = [0.75, 0.818, 0.9, 1.083, 1.154, 1.462, 1.564, 1.833];
    LEVELS.forEach((level, i) => {
      expect(Math.abs(computeDifficulty(level) - expected[i]!)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(level.difficulty - expected[i]!)).toBeLessThanOrEqual(0.01);
    });
    for (let i = 1; i < LEVELS.length; i += 1) {
      expect(LEVELS[i]!.difficulty).toBeGreaterThan(LEVELS[i - 1]!.difficulty);
      expect(LEVELS[i]!.difficulty - LEVELS[i - 1]!.difficulty).toBeLessThanOrEqual(0.35);
    }
  });

  it('REQ-022 三类目标按 AND 组合且元素在 tileKinds 中', () => {
    const types = LEVELS.flatMap((l) => l.goals.map((g) => g.type));
    expect(new Set(types)).toEqual(new Set(['score', 'collect', 'obstacle']));
    expect(LEVELS[5]!.goals).toHaveLength(2);
    expect(LEVELS[6]!.goals).toHaveLength(2);
    expect(LEVELS[7]!.goals).toHaveLength(2);
    for (const level of LEVELS) {
      for (const goal of level.goals) {
        if (goal.type === 'collect') expect(level.tileKinds).toContain(goal.tile);
      }
    }
  });

  it('REQ-025 第 8 关死格集合精确', () => {
    const holes = LEVELS[7]!.obstacles.filter((o) => o.type === 'hole').flatMap((o) => o.cells);
    expect(new Set(holes.map((c) => `${c.row},${c.col}`))).toEqual(new Set(['3,3', '3,6', '6,2', '6,7']));
  });

  it('第 3 关冰块位于中心 6×3 区域，第 5-8 关使用 5 种元素', () => {
    const ice = LEVELS[2]!.obstacles.filter((o) => o.type === 'ice').flatMap((o) => o.cells);
    expect(ice).toHaveLength(18);
    for (const cell of ice) {
      expect(cell.row).toBeGreaterThanOrEqual(4);
      expect(cell.row).toBeLessThanOrEqual(6);
      expect(cell.col).toBeGreaterThanOrEqual(2);
      expect(cell.col).toBeLessThanOrEqual(7);
    }
    for (const level of LEVELS.slice(4)) {
      expect(level.tileKinds).toHaveLength(5);
      expect(level.tileKinds).not.toContain('crystal');
    }
  });

  it('第 2 关 2★ 阈值保持 1800（不得改为 2000）', () => {
    expect(LEVELS[1]!.stars).toEqual({ two: 1800, three: 2400 });
  });

  it('validateLevels 对合法数据返回 ok 且无错误', () => {
    const result = validateLevels();
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('validateLevels 能发现步数被篡改', () => {
    const broken = LEVELS.map((l) => ({ ...l }));
    broken[0] = { ...broken[0]!, moves: 99 };
    const result = validateLevels(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('步数'))).toBe(true);
  });
});
