/** G5 独立验收审计 part B：棋盘生成 / 匹配 / 下落 / 交换 / 结算 / 特化。 */
import { describe, expect, test } from 'vitest';
import type { Board, Cell, GameState, LevelConfig, TileKind } from '@core/types';
import { LEVELS, getLevel } from '@systems/level/levels';
import { generateBoard, hasAnyMove } from '@core/board/generate';
import { findMatches } from '@core/match/detect';
import { applyGravity } from '@core/board/gravity';
import { inspectSwap } from '@core/board/swap';
import { createEmptyBoard, issueTile, cloneBoard, toIndex, boardsEqual, isPlayableCell } from '@core/board/model';
import { generateSpecials } from '@core/special/generate';
import { expandClears } from '@core/special/trigger';
import { ensurePlayable, multisetOf } from '@core/board/shuffle';
import { createGame } from '@core/game';
import { resolveSwap } from '@core/resolve';
import { SeededRng } from '@core/rng';
import { BoardInitError } from '@core/errors';

const LETTER: Record<string, TileKind> = { a: 'star', b: 'water', c: 'leaf', d: 'flame', e: 'crystal', f: 'bolt' };

/** 背景盘：bg(r,c) = (r + 2c) % 6 —— 横/竖都不会出现 3 连。 */
function bgBoard(): Board {
  const board = createEmptyBoard();
  const kinds: TileKind[] = ['star', 'water', 'leaf', 'flame', 'crystal', 'bolt'];
  for (let r = 1; r <= 8; r += 1) {
    for (let c = 1; c <= 8; c += 1) {
      (board.cells[toIndex(r, c)] as Cell).tile = issueTile(board, kinds[(r + 2 * c) % 6]!);
    }
  }
  return board;
}
function put(board: Board, r: number, c: number, ch: string): void {
  const kind = LETTER[ch];
  (board.cells[toIndex(r, c)] as Cell).tile = kind ? { id: 9000 + r * 8 + c, kind, special: null } : null;
}
const runsOf = (board: Board) => findMatches(board).runs.map((r) => `${r.orientation}${r.length}@${r.cells[0]}`);

describe('REQ-001 初始生成（全部 8 关 × 30 种子）', () => {
  test('64 格、每格 1 元素或 1 障碍、无初始三连、至少 1 个可行交换', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const { board } = generateBoard(level, seed);
        expect(board.cells.length).toBe(64);
        for (const cell of board.cells) {
          const hasTile = cell.tile !== null;
          const playable = cell.obstacle === null || cell.obstacle.type === 'ice';
          if (playable) expect(hasTile).toBe(true);
          else expect(hasTile).toBe(false);
        }
        expect(findMatches(board).runs).toEqual([]);
        expect(hasAnyMove(board)).toBe(true);
      }
    }
  });

  test('第 5-8 关不出现「晶」', () => {
    for (const id of [5, 6, 7, 8]) {
      const level = getLevel(id)!;
      const seen = new Set<string>();
      for (let seed = 1; seed <= 20; seed += 1) {
        for (const cell of generateBoard(level, seed).board.cells) if (cell.tile?.kind) seen.add(cell.tile.kind);
      }
      expect(seen.has('crystal')).toBe(false);
    }
  });

  test('REQ-025 第 8 关 4 个死格为空、石块格无元素', () => {
    const level = getLevel(8)!;
    const { board } = generateBoard(level, 7);
    for (const [r, c] of [[3, 3], [3, 6], [6, 2], [6, 7]]) {
      const cell = board.cells[toIndex(r!, c!)] as Cell;
      expect(cell.obstacle?.type).toBe('hole');
      expect(cell.tile).toBeNull();
    }
    for (const { row, col } of level.obstacles.find((o) => o.type === 'stone')!.cells) {
      const cell = board.cells[toIndex(row, col)] as Cell;
      expect(cell.obstacle).toEqual({ type: 'stone', layers: 2 });
      expect(cell.tile).toBeNull();
    }
  });

  test('REQ-001 生成重试达上限 → 初始化失败（不死循环）', () => {
    const impossible: LevelConfig = { ...getLevel(1)!, tileKinds: ['star'] };
    expect(() => generateBoard(impossible, 1)).toThrowError(BoardInitError);
  });
});

describe('REQ-007 匹配检测', () => {
  test('背景盘无匹配（fixture 自检）', () => {
    expect(runsOf(bgBoard())).toEqual([]);
  });

  test('横 3 / 6 连各只返回 1 条连线', () => {
    const h3 = bgBoard();
    put(h3, 3, 3, 'a'); put(h3, 3, 4, 'a'); put(h3, 3, 5, 'a');
    const r3 = findMatches(h3).runs;
    expect(r3).toHaveLength(1);
    expect(r3[0]).toMatchObject({ orientation: 'h', length: 3, kind: 'star' });

    const h6 = bgBoard();
    for (let c = 1; c <= 6; c += 1) put(h6, 1, c, 'a');
    const r6 = findMatches(h6).runs;
    expect(r6).toHaveLength(1);
    expect(r6[0]!.length).toBe(6);
  });

  test('竖 3 只返回 1 条连线', () => {
    const v3 = bgBoard();
    put(v3, 2, 3, 'a'); put(v3, 3, 3, 'a'); put(v3, 4, 3, 'a');
    const runs = findMatches(v3).runs;
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ orientation: 'v', length: 3 });
  });

  test('L 形按并集一次性消除，交叉格只计 1 次', () => {
    const l = bgBoard();
    put(l, 3, 3, 'a'); put(l, 3, 4, 'a'); put(l, 3, 5, 'a'); put(l, 4, 4, 'a'); put(l, 5, 4, 'a');
    const result = findMatches(l);
    expect(result.runs).toHaveLength(2);
    expect(new Set(result.matched).size).toBe(result.matched.length);
    expect(result.matched.length).toBe(5);
    for (const index of result.matched) expect((l.cells[index] as Cell).tile!.kind).toBe('star');
  });

  test('石块不参与匹配；冰下元素可匹配（REQ-023）', () => {
    const ice = bgBoard();
    put(ice, 3, 3, 'a'); put(ice, 3, 4, 'a'); put(ice, 3, 5, 'a');
    for (let c = 3; c <= 5; c += 1) (ice.cells[toIndex(3, c)] as Cell).obstacle = { type: 'ice', layers: 1 };
    expect(findMatches(ice).runs).toHaveLength(1);

    const stone = bgBoard();
    put(stone, 3, 3, 'a'); put(stone, 3, 5, 'a');
    (stone.cells[toIndex(3, 4)] as Cell).obstacle = { type: 'stone', layers: 2 };
    (stone.cells[toIndex(3, 4)] as Cell).tile = null;
    expect(findMatches(stone).runs).toEqual([]);
  });
});

describe('REQ-008 / REQ-023 / REQ-024 下落与补充', () => {
  test('石块阻挡本列下落、冰不阻挡、死格阻挡', () => {
    const base = bgBoard();
    const b = cloneBoard(base);
    (b.cells[toIndex(5, 1)] as Cell).obstacle = { type: 'stone', layers: 2 };
    (b.cells[toIndex(5, 1)] as Cell).tile = null;
    const topIds = [1, 2, 3, 4].map((r) => (b.cells[toIndex(r, 1)] as Cell).tile!.id);
    for (const r of [6, 7, 8]) (b.cells[toIndex(r, 1)] as Cell).tile = null;
    const out = applyGravity(b, new SeededRng(12345), ['star', 'water', 'leaf', 'flame', 'crystal', 'bolt']);
    for (const r of [1, 2, 3, 4]) expect((out.board.cells[toIndex(r, 1)] as Cell).tile!.id).toBe(topIds[r - 1]);
    for (const r of [6, 7, 8]) expect((out.board.cells[toIndex(r, 1)] as Cell).tile).not.toBeNull();
    expect(out.spawned.slice().sort()).toEqual([toIndex(6, 1), toIndex(7, 1), toIndex(8, 1)].sort());

    const b2 = cloneBoard(base);
    (b2.cells[toIndex(4, 2)] as Cell).obstacle = { type: 'ice', layers: 1 };
    for (const r of [7, 8]) (b2.cells[toIndex(r, 2)] as Cell).tile = null;
    const top2 = (b2.cells[toIndex(1, 2)] as Cell).tile!.id;
    const out2 = applyGravity(b2, new SeededRng(1), ['star', 'water', 'leaf', 'flame', 'crystal', 'bolt']);
    expect((out2.board.cells[toIndex(3, 2)] as Cell).tile!.id).toBe(top2);
    expect((out2.board.cells[toIndex(4, 2)] as Cell).obstacle).toEqual({ type: 'ice', layers: 1 });

    const b3 = cloneBoard(base);
    (b3.cells[toIndex(4, 3)] as Cell).obstacle = { type: 'hole' };
    (b3.cells[toIndex(4, 3)] as Cell).tile = null;
    (b3.cells[toIndex(6, 3)] as Cell).tile = null;
    const above = (b3.cells[toIndex(1, 3)] as Cell).tile!.id;
    const out3 = applyGravity(b3, new SeededRng(1), ['star', 'water', 'leaf', 'flame', 'crystal', 'bolt']);
    // 死格之上的列段保持原位（不穿过死格）
    expect((out3.board.cells[toIndex(1, 3)] as Cell).tile!.id).toBe(above);
    expect((out3.board.cells[toIndex(3, 3)] as Cell).tile!.id).toBe((b3.cells[toIndex(3, 3)] as Cell).tile!.id);
    expect((out3.board.cells[toIndex(4, 3)] as Cell).tile).toBeNull();
    // 死格之下的列段从顶部补充
    expect(out3.spawned).toContain(toIndex(5, 3));
  });

  test('200 组随机清空后每列无悬空（石块/死格段内）', () => {
    const base = bgBoard();
    const kinds: TileKind[] = ['star', 'water', 'leaf', 'flame', 'crystal', 'bolt'];
    let cleared = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const rng = new SeededRng(seed);
      const b = cloneBoard(base);
      for (let i = 0; i < 10; i += 1) {
        const idx = rng.nextInt(64);
        if (isPlayableCell(b.cells[idx] as Cell)) { (b.cells[idx] as Cell).tile = null; cleared += 1; }
      }
      const out = applyGravity(b, new SeededRng(seed * 7), kinds);
      for (let col = 1; col <= 8; col += 1) {
        for (let row = 1; row <= 8; row += 1) {
          const cell = out.board.cells[toIndex(row, col)] as Cell;
          if (cell.obstacle && cell.obstacle.type !== 'ice') continue;
          expect(cell.tile).not.toBeNull();
        }
      }
    }
    expect(cleared).toBeGreaterThan(0);
  });

  test('补充只用当前关卡元素集（L5-8 不出现「晶」）', () => {
    const level = getLevel(7)!;
    const state = createGame(level, 3);
    const b = cloneBoard(state.board);
    for (let i = 0; i < 64; i += 1) if (isPlayableCell(b.cells[i] as Cell)) (b.cells[i] as Cell).tile = null;
    const out = applyGravity(b, new SeededRng(9), level.tileKinds);
    const kinds = new Set(out.board.cells.filter((c) => c.tile?.kind).map((c) => c.tile!.kind!));
    expect(kinds.has('crystal')).toBe(false);
    expect(out.spawned.length).toBeGreaterThan(30);
  });
});

describe('REQ-003~006 交换合法性', () => {
  test('非相邻 / 同格 / 越界 / 石块 / 死格 → 拒绝且棋盘不变', () => {
    const board = bgBoard();
    const withStone = cloneBoard(board);
    (withStone.cells[toIndex(1, 1)] as Cell).obstacle = { type: 'stone', layers: 2 };
    (withStone.cells[toIndex(1, 1)] as Cell).tile = null;
    const withHole = cloneBoard(board);
    (withHole.cells[toIndex(1, 2)] as Cell).obstacle = { type: 'hole' };
    (withHole.cells[toIndex(1, 2)] as Cell).tile = null;

    const cases: [string, Board, number, number][] = [
      ['同格', board, toIndex(2, 2), toIndex(2, 2)],
      ['非相邻', board, toIndex(2, 2), toIndex(2, 4)],
      ['越界', board, toIndex(1, 1), 64],
      ['石块', withStone, toIndex(1, 1), toIndex(1, 2)],
      ['死格', withHole, toIndex(1, 3), toIndex(1, 2)],
    ];
    for (const [name, b, a, t] of cases) {
      const snapshot = cloneBoard(b);
      expect(inspectSwap(b, a, t).valid, name).toBe(false);
      expect(boardsEqual(b, snapshot), name).toBe(true);
    }
  });

  test('产生 ≥3 连的交换有效；不产生的交换无效且返回原棋盘', () => {
    const b = bgBoard();
    put(b, 3, 2, 'a'); put(b, 3, 3, 'a'); put(b, 3, 5, 'a'); put(b, 4, 4, 'a');
    expect(runsOf(b)).toEqual([]);
    const good = inspectSwap(b, toIndex(4, 4), toIndex(3, 4));
    expect(good.valid).toBe(true);
    expect(good.runs).toHaveLength(1);
    expect(good.runs[0]!.length).toBe(4);
    const bad = inspectSwap(b, toIndex(3, 2), toIndex(3, 3));
    expect(bad.valid).toBe(false);
    expect(bad.reason).toBe('no-match');
    expect(boardsEqual(bad.board, b)).toBe(true);
  });
});

describe('REQ-009~015 / REQ-018 结算引擎', () => {
  const level = getLevel(1)!;
  const kinds: TileKind[] = ['star', 'water', 'leaf', 'flame', 'crystal', 'bolt'];

  function findMove(state: GameState) {
    for (let i = 0; i < 64; i += 1) {
      const row = Math.floor(i / 8), col = i % 8;
      for (const t of [col < 7 ? i + 1 : -1, row < 7 ? i + 8 : -1]) {
        if (t >= 0 && inspectSwap(state.board, i, t).valid) return { a: i, b: t };
      }
    }
    return null;
  }

  test('有效交换只扣 1 步；每轮 scoreGain 符合 5.3 公式；总分等于各轮之和', () => {
    let checkedRounds = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      let state = createGame(level, seed);
      for (let step = 0; step < 20; step += 1) {
        const before = { score: state.score, moves: state.movesLeft };
        const move = findMove(state);
        if (!move) break;
        const result = resolveSwap(state, level, move.a, move.b);
        expect(result.state.movesLeft).toBe(before.moves - 1);
        expect(result.state.stats.movesUsed).toBe(state.stats.movesUsed + 1);
        let total = 0;
        result.rounds.forEach((round, i) => {
          expect(round.cascade).toBe(i + 1);
          total += round.scoreGain;
          const union = new Set(round.runs.flatMap((r) => r.cells));
          const cleared = new Set(round.cleared);
          const sameSet = union.size === cleared.size && [...union].every((x) => cleared.has(x));
          if (round.specialsCreated.length === 0 && sameSet) {
            const bonus = round.runs.reduce((acc, r) => acc + (r.length === 4 ? 50 : r.length >= 5 ? 120 : 0), 0);
            const expected = Math.round((60 * round.cleared.length + bonus) * Math.min(1 + 0.5 * (round.cascade - 1), 4));
            expect(round.scoreGain, `seed ${seed} step ${step} c${round.cascade}`).toBe(expected);
            checkedRounds += 1;
          }
          expect(Number.isInteger(round.scoreGain)).toBe(true);
        });
        expect(result.state.score).toBe(before.score + total);
        state = result.state;
        if (result.outcome !== 'continue') break;
      }
    }
    expect(checkedRounds).toBeGreaterThan(100);
  });

  test('相同种子 + 相同操作序列 → 棋盘快照与分数完全一致（REQ-002）', () => {
    const play = () => {
      let state = createGame(level, 424242);
      const snapshots: string[] = [];
      for (let step = 0; step < 8; step += 1) {
        const move = findMove(state);
        if (!move) break;
        state = resolveSwap(state, level, move.a, move.b).state;
        snapshots.push(JSON.stringify(state.board));
      }
      return { snapshots, score: state.score, moves: state.movesLeft };
    };
    expect(play()).toEqual(play());
  });

  test('无效交换：轮次 0、分数/步数/棋盘不变（REQ-006/REQ-015）', () => {
    const b = bgBoard();
    const state: GameState = { ...createGame(level, 1), board: b };
    const result = resolveSwap(state, level, toIndex(1, 1), toIndex(1, 2));
    expect(result.rounds).toEqual([]);
    expect(result.events[0]).toMatchObject({ type: 'swap-rejected' });
    expect(result.state.score).toBe(0);
    expect(result.state.movesLeft).toBe(20);
    expect(boardsEqual(result.state.board, b)).toBe(true);
  });

  test('REQ-018 目标达成且步数归零 → won；未达成且步数 0 → lost', () => {
    const build = (score: number) => {
      const b = bgBoard();
      put(b, 3, 2, 'a'); put(b, 3, 3, 'a'); put(b, 3, 5, 'a'); put(b, 4, 4, 'a');
      const base = createGame(level, 1);
      return { ...base, board: b, score, movesLeft: 1 };
    };
    const win = resolveSwap(build(1490), level, toIndex(4, 4), toIndex(3, 4));
    expect(win.rounds.length).toBeGreaterThan(0);
    expect(win.state.score).toBeGreaterThanOrEqual(1500);
    expect(win.state.movesLeft).toBe(0);
    expect(win.outcome).toBe('won');

    const lose = resolveSwap(build(0), level, toIndex(4, 4), toIndex(3, 4));
    expect(lose.state.score).toBeLessThan(1500);
    expect(lose.outcome).toBe('lost');
  });
});

describe('REQ-010~013 特化生成与触发', () => {
  const level = getLevel(1)!;
  const kinds: TileKind[] = ['star', 'water', 'leaf', 'flame', 'crystal', 'bolt'];

  test('横 4 连 → 横线特化，生成在玩家交换所涉格', () => {
    const b = bgBoard();
    put(b, 3, 2, 'a'); put(b, 3, 3, 'a'); put(b, 3, 5, 'a'); put(b, 4, 4, 'a');
    const swap = { from: toIndex(4, 4), to: toIndex(3, 4), rainbowRainbow: false, rainbowPartnerKind: null };
    const check = inspectSwap(b, swap.from, swap.to);
    const specials = generateSpecials(check.board, check.runs, check.swap);
    expect(specials).toHaveLength(1);
    expect(specials[0]!.special).toBe('line-h');
    expect([swap.from, swap.to]).toContain(specials[0]!.index);
  });

  test('竖 4 连 → 竖线特化', () => {
    const b = bgBoard();
    put(b, 2, 1, 'a'); put(b, 5, 1, 'a'); put(b, 3, 2, 'a');
    expect(runsOf(b)).toEqual([]);
    const check = inspectSwap(b, toIndex(3, 2), toIndex(3, 1));
    expect(check.valid).toBe(true);
    expect(check.runs).toHaveLength(1);
    expect(check.runs[0]).toMatchObject({ orientation: 'v', length: 4 });
    const specials = generateSpecials(check.board, check.runs, check.swap);
    expect(specials).toHaveLength(1);
    expect(specials[0]!.special).toBe('line-v');
  });

  test('≥5 连 → 彩虹特化（kind=null）', () => {
    const b = bgBoard();
    for (let c = 2; c <= 6; c += 1) put(b, 5, c, 'a');
    const runs = findMatches(b).runs;
    expect(runs).toHaveLength(1);
    expect(runs[0]!.length).toBe(5);
    const specials = generateSpecials(b, runs, null);
    expect(specials).toHaveLength(1);
    expect(specials[0]).toMatchObject({ special: 'rainbow', kind: null });
  });

  test('REQ-012 直线特化清除整行；REQ-025 死格不被清除；石块受损', () => {
    const b = bgBoard();
    const lineIndex = toIndex(4, 4);
    (b.cells[lineIndex] as Cell).tile = { id: 500, kind: 'star', special: 'line-h' };
    (b.cells[toIndex(4, 2)] as Cell).obstacle = { type: 'hole' };
    (b.cells[toIndex(4, 2)] as Cell).tile = null;
    (b.cells[toIndex(4, 5)] as Cell).obstacle = { type: 'ice', layers: 1 };
    (b.cells[toIndex(4, 7)] as Cell).obstacle = { type: 'stone', layers: 2 };
    (b.cells[toIndex(4, 7)] as Cell).tile = null;

    const res = expandClears(b, [lineIndex], [], null);
    const inRow = res.cleared.filter((i) => Math.floor(i / 8) === 3);
    expect(inRow.length).toBe(6);
    expect(res.cleared).not.toContain(toIndex(4, 2));
    expect(res.damagedStones).toContain(toIndex(4, 7));
    expect(res.lineExtra.length).toBe(5);
    expect(res.triggered).toEqual([{ index: lineIndex, special: 'line-h' }]);
  });

  test('REQ-013 彩虹 + 彩虹 清空 64 格且 c=1 得 3840', () => {
    const b = bgBoard();
    (b.cells[toIndex(1, 1)] as Cell).tile = { id: 700, kind: null, special: 'rainbow' };
    (b.cells[toIndex(1, 2)] as Cell).tile = { id: 701, kind: null, special: 'rainbow' };
    const state = { ...createGame(level, 5), board: b };
    const result = resolveSwap(state, level, toIndex(1, 1), toIndex(1, 2));
    expect(result.rounds[0]!.cleared.length).toBe(64);
    expect(result.rounds[0]!.scoreGain).toBe(3840);
  });

  test('REQ-013 彩虹+彩虹 对第 8 关死格无效（死格仍为空）', () => {
    const b = bgBoard();
    (b.cells[toIndex(3, 3)] as Cell).obstacle = { type: 'hole' };
    (b.cells[toIndex(3, 3)] as Cell).tile = null;
    (b.cells[toIndex(1, 1)] as Cell).tile = { id: 700, kind: null, special: 'rainbow' };
    (b.cells[toIndex(1, 2)] as Cell).tile = { id: 701, kind: null, special: 'rainbow' };
    const state = { ...createGame(level, 5), board: b };
    const result = resolveSwap(state, level, toIndex(1, 1), toIndex(1, 2));
    expect(result.rounds[0]!.cleared).not.toContain(toIndex(3, 3));
    expect((result.rounds[0]!.boardAfterClear.cells[toIndex(3, 3)] as Cell).obstacle?.type).toBe('hole');
  });

  test('REQ-012 彩虹 + 普通元素 → 清除全盘该颜色', () => {
    const b = bgBoard();
    (b.cells[toIndex(1, 1)] as Cell).tile = { id: 800, kind: null, special: 'rainbow' };
    const partnerKind = (b.cells[toIndex(1, 2)] as Cell).tile!.kind!;
    const partnerCount = b.cells.filter((c) => c.tile?.kind === partnerKind).length;
    const state = { ...createGame(level, 5), board: b };
    const result = resolveSwap(state, level, toIndex(1, 1), toIndex(1, 2));
    expect(result.rounds[0]!.cleared.length).toBeGreaterThanOrEqual(partnerCount);
    expect(result.rounds[0]!.cleared.length).toBeLessThan(64);
  });
});

describe('REQ-016 无可行步重排', () => {
  test('死局重排后保分布、无立刻三连、且重新有可行步；不扣步', () => {
    // Latin square (r + c) % 6：无三连且不存在任何可产生匹配的相邻交换（已用实现无关的枚举确认）
    const dead = createEmptyBoard();
    const latin: TileKind[] = ['star', 'water', 'leaf', 'flame', 'crystal', 'bolt'];
    for (let r = 1; r <= 8; r += 1) {
      for (let c = 1; c <= 8; c += 1) {
        (dead.cells[toIndex(r, c)] as Cell).tile = issueTile(dead, latin[(r + c) % 6]!);
      }
    }
    expect(findMatches(dead).runs).toEqual([]);
    expect(hasAnyMove(dead)).toBe(false);

    const state = { ...createGame(getLevel(1)!, 1), board: dead };
    const before = multisetOf(dead);
    const result = ensurePlayable(state, getLevel(1)!);
    expect(result.failed).toBe(false);
    expect(result.shuffled).toBe(true);
    expect(multisetOf(result.state.board)).toEqual(before);
    expect(findMatches(result.state.board).runs).toEqual([]);
    expect(hasAnyMove(result.state.board)).toBe(true);
    expect(result.state.movesLeft).toBe(state.movesLeft);
    expect(result.events.some((e) => e.type === 'shuffle')).toBe(true);
  });

  test('已有可行步时原样返回（不重排）', () => {
    const state = createGame(getLevel(1)!, 3);
    const result = ensurePlayable(state, getLevel(1)!);
    expect(result.shuffled).toBe(false);
    expect(result.state).toBe(state);
  });
});

