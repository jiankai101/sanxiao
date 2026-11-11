/**
 * G5 独立验收审计（REQ 反推，不依赖实现自测）。
 * 本文件不修改产品代码：只 import 公开模块并对 spec.md 的数值/规则做断言。
 */
import { describe, expect, test } from 'vitest';
import * as C from '@core/constants';
import type { LevelConfig, TileKind } from '@core/types';
import { LEVELS, getLevel } from '@systems/level/levels';
import { multiplier, scoreRound } from '@core/score/score';
import { starsFor, maxStars, evaluateOutcome, emptyStats } from '@core/goals';
import { generateBoard, hasAnyMove } from '@core/board/generate';
import { findMatches } from '@core/match/detect';
import { applyGravity } from '@core/board/gravity';
import { inspectSwap } from '@core/board/swap';
import { createEmptyBoard, issueTile, cloneBoard, toIndex, boardsEqual } from '@core/board/model';
import { createGame, restartGame, abandonGame } from '@core/game';
import { resolveSwap } from '@core/resolve';
import { BoardInitError } from '@core/errors';
import { pickNearestCell, computeLayout, cellCssSize } from '@render/layout';
import { CanvasHost } from '@render/canvas-host';
import { BoardInput } from '@ui/input/board-input';
import { parseSaveText, defaultSave, SAVE_VERSION } from '@systems/storage/schema';
import { compareRecords, sortRecords } from '@systems/leaderboard/sort';
import { pruneRecords } from '@systems/leaderboard/prune';

const hex = (s: string) => s.toUpperCase();

describe('spec 5.1 棋盘与渲染常量', () => {
  test('grid/size/canvas/origin per spec 5.1', () => {
    expect(C.BOARD_COLS).toBe(8);
    expect(C.BOARD_ROWS).toBe(8);
    expect(C.CELL_SIZE).toBe(64);
    expect(C.BOARD_SIZE).toBe(512);
    expect(C.CANVAS_W).toBe(960);
    expect(C.CANVAS_H).toBe(720);
    expect(C.BOARD_X).toBe(224);
    expect(C.BOARD_Y).toBe(96);
    expect(C.INITIAL_RETRY_LIMIT).toBe(1000);
  });

  test('tile kinds order and colours per spec 5.1', () => {
    expect(C.TILE_KINDS).toEqual(['star', 'water', 'leaf', 'flame', 'crystal', 'bolt']);
    expect(C.TILE_KINDS_L5).toEqual(['star', 'water', 'leaf', 'flame', 'bolt']);
    expect(hex(C.TILE_COLORS.star)).toBe('#F2C230');
    expect(hex(C.TILE_COLORS.water)).toBe('#3AA0E8');
    expect(hex(C.TILE_COLORS.leaf)).toBe('#57C24A');
    expect(hex(C.TILE_COLORS.flame)).toBe('#E8503A');
    expect(hex(C.TILE_COLORS.crystal)).toBe('#9B59D0');
    expect(hex(C.TILE_COLORS.bolt)).toBe('#23C4C4');
  });
});

describe('spec 5.2 / 5.6 / REQ-044 时长与提示常量', () => {
  test('animation durations', () => {
    expect(C.SWAP_MS).toBe(150);
    expect(C.REVERT_MS).toBe(200);
    expect(C.CLEAR_MS).toBe(180);
    expect(C.FALL_MS).toBe(160);
    expect(C.SPECIAL_MS).toBe(300);
    expect(C.PANEL_FADE_MS).toBe(200);
    expect(C.REDUCED_MOTION_MAX_MS).toBe(100);
    expect(C.PANEL_INPUT_LOCK_MS).toBe(300);
  });
  test('shuffle / low-moves thresholds', () => {
    expect(C.SHUFFLE_RETRY_LIMIT).toBe(100);
    expect(C.SHUFFLE_TOAST_MS).toBe(2000);
    expect(C.LOW_MOVES_THRESHOLD).toBe(3);
  });
  test('REQ-041 DPR clamp and REQ-049 breakpoint', () => {
    expect(C.DPR_MAX).toBe(2);
    expect(C.HOTZONE_BREAKPOINT_CSS_PX).toBe(600);
    expect(C.HOTZONE_MIN_CELL_CSS_PX).toBe(40);
    expect(C.DRAG_THRESHOLD_CELL_RATIO).toBe(0.5);
  });
  test('REQ-029 / 037 / 047 storage and leaderboard constants', () => {
    expect(C.SAVE_VERSION).toBe(1);
    expect(C.LEADERBOARD_PER_LEVEL).toBe(10);
    expect(C.LEADERBOARD_TOTAL).toBe(20);
    expect(C.BGM_DEFAULT_VOLUME).toBe(60);
    expect(C.SFX_DEFAULT_VOLUME).toBe(80);
    expect(C.SFX_THROTTLE_MS).toBe(100);
  });
});

describe('spec 5.3 / REQ-014 计分公式（独立复算）', () => {
  test('multiplier table c=1..9', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(multiplier)).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4, 4]);
  });
  test('spec 5.3 计分基准示例逐条复算', () => {
    expect(scoreRound({ clearedCount: 3, runs: [], lineExtra: 0, cascade: 1 })).toBe(180);
    expect(
      scoreRound({
        clearedCount: 4,
        runs: [{ cells: [0, 1, 2, 3], orientation: 'h', kind: 'star', length: 4 }],
        lineExtra: 0,
        cascade: 2,
      }),
    ).toBe(435);
    expect(scoreRound({ clearedCount: 64, runs: [], lineExtra: 0, cascade: 1 })).toBe(3840);
  });
  test('任意 (N,B,S,c) 组合等于 ROUND((60N+B+30S)*M(c))', () => {
    const cases = [
      { n: 3, bonus: 0, s: 0, c: 1 },
      { n: 5, bonus: 120, s: 0, c: 1 },
      { n: 6, bonus: 50, s: 0, c: 3 },
      { n: 3, bonus: 0, s: 7, c: 2 },
      { n: 10, bonus: 50, s: 2, c: 8 },
      { n: 64, bonus: 0, s: 0, c: 4 },
    ];
    for (const k of cases) {
      const runs: any[] = [];
      if (k.bonus === 50) runs.push({ cells: [0, 1, 2, 3], orientation: 'h', kind: 'star', length: 4 });
      if (k.bonus === 120) runs.push({ cells: [0, 1, 2, 3, 4], orientation: 'h', kind: 'star', length: 5 });
      const expected = Math.round((60 * k.n + k.bonus + 30 * k.s) * Math.min(1 + 0.5 * (k.c - 1), 4));
      expect(scoreRound({ clearedCount: k.n, runs, lineExtra: k.s, cascade: k.c })).toBe(expected);
    }
  });
});

describe('spec 第 6 章 关卡表（逐项对照）', () => {
  const expected = [
    { id: 1, name: '起步', moves: 20, kinds: 6, goals: [{ type: 'score', target: 1500 }], d: 0.75, two: 2000, three: 2600 },
    { id: 2, name: '初潮', moves: 22, kinds: 6, goals: [{ type: 'collect', tile: 'water', target: 18 }], d: 0.818, two: 1800, three: 2400 },
    { id: 3, name: '薄冰', moves: 24, kinds: 6, goals: [{ type: 'obstacle', obstacle: 'ice', target: 18 }], d: 0.9, two: 2200, three: 2900 },
    { id: 4, name: '连锁', moves: 24, kinds: 6, goals: [{ type: 'score', target: 2600 }], d: 1.083, two: 3200, three: 4000 },
    { id: 5, name: '石障', moves: 26, kinds: 5, goals: [{ type: 'obstacle', obstacle: 'stone', target: 12 }], d: 1.154, two: 3000, three: 3900 },
    {
      id: 6, name: '双线', moves: 26, kinds: 5,
      goals: [{ type: 'collect', tile: 'flame', target: 18 }, { type: 'score', target: 2000 }],
      d: 1.462, two: 3600, three: 4600,
    },
    {
      id: 7, name: '暴风', moves: 28, kinds: 5,
      goals: [{ type: 'obstacle', obstacle: 'ice', target: 24 }, { type: 'obstacle', obstacle: 'stone', target: 6 }],
      d: 1.564, two: 3800, three: 4900,
    },
    {
      id: 8, name: '终章', moves: 30, kinds: 5,
      goals: [{ type: 'score', target: 3000 }, { type: 'obstacle', obstacle: 'stone', target: 10 }],
      d: 1.833, two: 4400, three: 5600,
    },
  ];

  test('恰好 8 关，id/名称/步数/元素种类/目标/星级阈值逐项一致', () => {
    expect(LEVELS.length).toBe(8);
    expected.forEach((e, i) => {
      const level = LEVELS[i] as LevelConfig;
      expect(level.id).toBe(e.id);
      expect(level.name).toBe(e.name);
      expect(level.moves).toBe(e.moves);
      expect(level.tileKinds.length).toBe(e.kinds);
      expect(level.stars.two).toBe(e.two);
      expect(level.stars.three).toBe(e.three);
      expect(level.goals.map((g) => ({ ...g, id: undefined, tile: (g as any).tile }))).toEqual(
        e.goals.map((g) => ({ id: undefined, ...g })),
      );
    });
  });

  test('第 5-8 关元素子集移除「晶」', () => {
    for (const id of [5, 6, 7, 8]) {
      expect(getLevel(id)!.tileKinds).not.toContain('crystal');
    }
    for (const id of [1, 2, 3, 4]) {
      expect(getLevel(id)!.tileKinds).toContain('crystal');
    }
  });

  test('REQ-027 难度指数按第 6 章权重复算且严格递增、相邻增幅 <= 0.35', () => {
    const weights = { score: (v: number) => v / 100, collect: (v: number) => v, ice: (v: number) => v * 1.2, stone: (v: number) => v * 2.5 };
    const ds = LEVELS.map((level) => {
      let points = 0;
      for (const goal of level.goals) {
        const g: any = goal;
        if (g.type === 'score') points += weights.score(g.target);
        else if (g.type === 'collect') points += weights.collect(g.target);
        else points += (g.obstacle === 'ice' ? weights.ice : weights.stone)(g.target);
      }
      const d = points / level.moves;
      expect(Math.abs(d - level.difficulty)).toBeLessThanOrEqual(0.001);
      return Number(d.toFixed(3));
    });
    expect(ds).toEqual([0.75, 0.818, 0.9, 1.083, 1.154, 1.462, 1.564, 1.833]);
    expected.forEach((e, i) => expect(Math.abs(ds[i]! - e.d)).toBeLessThanOrEqual(0.01));
    for (let i = 1; i < ds.length; i += 1) {
      expect(ds[i]! - ds[i - 1]!).toBeGreaterThan(0);
      expect(ds[i]! - ds[i - 1]!).toBeLessThanOrEqual(0.35);
    }
  });

  test('REQ-022/023/024/025 障碍坐标与层数符合第 6 章 + 5.5', () => {
    const ice = (id: number) => (getLevel(id)!.obstacles.find((o) => o.type === 'ice') as any)?.cells ?? [];
    const stone = (id: number) => (getLevel(id)!.obstacles.find((o) => o.type === 'stone') as any)?.cells ?? [];
    const hole = (id: number) => (getLevel(id)!.obstacles.find((o) => o.type === 'hole') as any)?.cells ?? [];
    expect(ice(3).length).toBe(18);
    expect(stone(5).length).toBe(12);
    expect(ice(6).length).toBe(10);
    expect(ice(7).length).toBe(24);
    expect(stone(7).length).toBe(6);
    expect(stone(8).length).toBe(10);
    expect(hole(8).length).toBe(4);
    const names = hole(8).map((c: any) => `行${c.row}列${c.col}`).sort();
    expect(names).toEqual(['行3列3', '行3列6', '行6列2', '行6列7'].sort());
    for (const id of [1, 2, 4]) {
      expect(getLevel(id)!.obstacles.length).toBe(0);
    }
  });
});

describe('REQ-026 星级评定', () => {
  test('1★ 达成目标 / 2★ 3★ 按分数阈值 / 失败 0★ / 封顶 3★', () => {
    const stars = { two: 2000, three: 2600 };
    expect(starsFor(1500, stars, true)).toBe(1);
    expect(starsFor(1999, stars, true)).toBe(1);
    expect(starsFor(2000, stars, true)).toBe(2);
    expect(starsFor(2599, stars, true)).toBe(2);
    expect(starsFor(2600, stars, true)).toBe(3);
    expect(starsFor(999999, stars, true)).toBe(3);
    expect(starsFor(999999, stars, false)).toBe(0);
    expect(maxStars(3, 1)).toBe(3);
    expect(maxStars(1, 3)).toBe(3);
  });

  test('REQ-022 目标为 AND 组合；REQ-018 胜负判定', () => {
    const level = getLevel(6)!;
    const stats = emptyStats();
    stats.collected.flame = 18;
    expect(evaluateOutcome({ score: 1999, movesLeft: 5, stats }, level)).toBe('continue');
    expect(evaluateOutcome({ score: 2000, movesLeft: 5, stats }, level)).toBe('won');
    stats.collected.flame = 17;
    expect(evaluateOutcome({ score: 99999, movesLeft: 5, stats }, level)).toBe('continue');
    expect(evaluateOutcome({ score: 0, movesLeft: 0, stats }, level)).toBe('lost');
    stats.collected.flame = 18;
    expect(evaluateOutcome({ score: 2000, movesLeft: 0, stats }, level)).toBe('won');
  });
});

describe('REQ-049 布局与热区（4 个必测视口）', () => {
  test('单格 CSS 尺寸 = 64 * 视口宽 / 960', () => {
    expect(cellCssSize(1280)).toBeCloseTo(85.3333, 3);
    expect(cellCssSize(600)).toBe(40);
    expect(cellCssSize(360)).toBe(24);
    expect(cellCssSize(320)).toBeCloseTo(21.3333, 3);
    expect(cellCssSize(1280)).toBeGreaterThanOrEqual(40);
    expect(cellCssSize(600)).toBeGreaterThanOrEqual(40);
  });

  test('最近邻吸附：中垂线平分、等距取列小者、矩形外为 null', () => {
    const snap = computeLayout(960, 720);
    expect(pickNearestCell({ x: 224 + 32, y: 96 + 32 }, snap)).toEqual({ row: 1, col: 1 });
    // 两格中心中点（x = 224 + 64）等距 → 列索引较小者
    expect(pickNearestCell({ x: 224 + 64, y: 96 + 32 }, snap)).toEqual({ row: 1, col: 1 });
    // 行中垂线等距 → 行索引较小者
    expect(pickNearestCell({ x: 224 + 32, y: 96 + 64 }, snap)).toEqual({ row: 1, col: 1 });
    expect(pickNearestCell({ x: 223.5, y: 96 + 32 }, snap)).toBeNull();
    expect(pickNearestCell({ x: 224 + 32, y: 95.5 }, snap)).toBeNull();
    expect(pickNearestCell({ x: 736.5, y: 96 + 32 }, snap)).toBeNull();
    expect(pickNearestCell({ x: 736, y: 608 }, snap)).toEqual({ row: 8, col: 8 });
  });

  test('REQ-041 DPR 上限 2，画布 backing store 随之调整', () => {
    const make = (dpr: number) => {
      const canvas: any = { width: 0, height: 0, style: { width: '', height: '' }, getContext: () => ({}) };
      const env: any = { innerWidth: 960, innerHeight: 720, devicePixelRatio: dpr, addEventListener() {}, removeEventListener() {} };
      const host = new CanvasHost(canvas, { environment: env, devicePixelRatio: dpr });
      host.applyViewport(960, 720, dpr);
      return { canvas, host };
    };
    expect(make(1).canvas.width).toBe(960);
    expect(make(1).canvas.height).toBe(720);
    expect(make(2).canvas.width).toBe(1920);
    expect(make(2).canvas.height).toBe(1440);
    expect(make(3).canvas.width).toBe(1920);
    expect(make(3).canvas.height).toBe(1440);
    expect(make(3).host.dpr).toBe(2);
  });
});

describe('REQ-003 / REQ-049 交换手势阈值', () => {
  const run = (dx: number, dy: number) => {
    const events: any[] = [];
    const input = new BoardInput({
      geometry: { cellCssSize: () => 40 },
      emit: (e) => events.push(e),
    });
    input.press({ cell: { row: 4, col: 4 } as any, clientX: 100, clientY: 100, pointerId: 1 });
    input.release({ cell: { row: 4, col: 4 } as any, clientX: 100 + dx, clientY: 100 + dy, pointerId: 1 });
    return events;
  };

  test('主轴位移 19.9px(<0.5*40) 视为点击，不交换', () => {
    const events = run(19.9, 0);
    expect(events.some((e) => e.type === 'swap')).toBe(false);
  });

  test('主轴位移 20px(=0.5*40) 判为向右相邻交换', () => {
    const events = run(20, 0);
    expect(events.filter((e) => e.type === 'swap')).toEqual([
      { type: 'swap', a: { row: 4, col: 4 }, b: { row: 4, col: 5 } },
    ]);
  });

  test('主轴取 |dy| 更大时判为向下交换；负向判为向上', () => {
    expect(run(5, 25).find((e) => e.type === 'swap')?.b).toEqual({ row: 5, col: 4 });
    expect(run(-5, -25).find((e) => e.type === 'swap')?.b).toEqual({ row: 3, col: 4 });
  });

  test('两段式点击：相邻点击交换、点击自身取消选中', () => {
    const events: any[] = [];
    const input = new BoardInput({ geometry: { cellCssSize: () => 40 }, emit: (e) => events.push(e) });
    const tap = (row: number, col: number) => {
      input.press({ cell: { row, col } as any, clientX: 0, clientY: 0, pointerId: 1 });
      input.release({ cell: { row, col } as any, clientX: 0, clientY: 0, pointerId: 1 });
    };
    tap(2, 2);
    tap(2, 2);
    expect(events.filter((e) => e.type === 'deselect').length).toBe(1);
    tap(2, 2);
    tap(3, 2);
    expect(events.at(-1)).toEqual({ type: 'swap', a: { row: 2, col: 2 }, b: { row: 3, col: 2 } });
  });
});

describe('REQ-029 / REQ-031 存档校验矩阵', () => {
  const base = () => JSON.parse(JSON.stringify(defaultSave('2026-01-01T00:00:00.000Z')));

  test('合法存档解析成功且 saveVersion=1', () => {
    const r = parseSaveText(JSON.stringify(base()));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.saveVersion).toBe(SAVE_VERSION);
  });

  test('JSON 解析失败 / 必填缺失 / 类型错误 / 版本不符 → 判为损坏', () => {
    expect(parseSaveText('{not json').ok).toBe(false);

    const missing = base(); delete missing.unlockedLevelId;
    expect(parseSaveText(JSON.stringify(missing)).ok).toBe(false);

    const badType = base(); badType.settings.bgmVolume = '60';
    expect(parseSaveText(JSON.stringify(badType)).ok).toBe(false);

    const badRange = base(); badRange.settings.sfxVolume = 101;
    expect(parseSaveText(JSON.stringify(badRange)).ok).toBe(false);

    const badStar = base(); badStar.levelRecords[0].bestStars = 4;
    expect(parseSaveText(JSON.stringify(badStar)).ok).toBe(false);

    const v2 = base(); v2.saveVersion = 2;
    const r = parseSaveText(JSON.stringify(v2));
    expect(r).toEqual({ ok: false, reason: 'version' });

    const vMissing = base(); delete vMissing.saveVersion;
    expect(parseSaveText(JSON.stringify(vMissing)).ok).toBe(false);
  });

  test('例外：lastSessionInterrupted 缺失按 false 读取，不视为损坏', () => {
    const noFlag = base(); delete noFlag.lastSessionInterrupted;
    const r = parseSaveText(JSON.stringify(noFlag));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.lastSessionInterrupted).toBe(false);
  });
});

describe('REQ-036 / REQ-037 排行榜排序与容量', () => {
  const rec = (id: string, score: number, movesUsed: number, achievedAt: string, levelId = 1) => ({
    id, levelId, score, stars: 3, movesUsed, achievedAt, seed: 1,
  });

  test('score ↓ → movesUsed ↑ → achievedAt ↑ → id ↑', () => {
    const later = rec('later', 100, 10, '2026-01-02T00:00:00.000Z');
    const earlier = rec('earlier', 100, 10, '2026-01-01T00:00:00.000Z');
    const fewer = rec('fewer', 100, 9, '2026-01-05T00:00:00.000Z');
    const high = rec('high', 120, 30, '2026-01-01T00:00:00.000Z');
    expect(sortRecords([later, earlier, fewer, high]).map((r) => r.id)).toEqual(['high', 'fewer', 'earlier', 'later']);
    expect(compareRecords(earlier, later)).toBeLessThan(0);
    const tieA = rec('tie-a', 100, 10, '2026-01-01T00:00:00.000Z');
    const tieB = rec('tie-b', 100, 10, '2026-01-01T00:00:00.000Z');
    expect(sortRecords([tieB, tieA]).map((r) => r.id)).toEqual(['tie-a', 'tie-b']);
  });

  test('单关 10 条 / 全局 20 条，超限淘汰末位', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      rec(`L1-${i}`, 100 + i, 10, `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`, 1));
    const kept = pruneRecords(many);
    expect(kept.length).toBe(10);
    expect(kept.map((r) => r.score)).toEqual([114, 113, 112, 111, 110, 109, 108, 107, 106, 105]);

    const across = Array.from({ length: 30 }, (_, i) => rec(`R${i}`, 1000 - i, 10, '2026-01-01T00:00:00.000Z', 1 + (i % 8)));
    const pruned = pruneRecords(across);
    expect(pruned.length).toBe(20);
    const perLevel = new Map<number, number>();
    for (const r of pruned) perLevel.set(r.levelId, (perLevel.get(r.levelId) ?? 0) + 1);
    for (const n of perLevel.values()) expect(n).toBeLessThanOrEqual(10);
  });
});

