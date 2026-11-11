import { describe, expect, test } from 'vitest';
import type { Cell, GameState, TileKind } from '@core/types';
import { hasAnyMove } from '@core/board/generate';
import { inspectSwap } from '@core/board/swap';
import { resolveSwap } from '@core/resolve';
import { createGame } from '@core/game';
import { getLevel, LEVELS } from '@systems/level/levels';
import { ensurePlayable } from '@core/board/shuffle';
import { createEmptyBoard, issueTile, toIndex } from '@core/board/model';
import { SeededRng } from '@core/rng';

function moves(state: GameState) {
  const out: { a: number; b: number }[] = [];
  for (let i = 0; i < 64; i += 1) {
    const row = Math.floor(i / 8), col = i % 8;
    for (const t of [col < 7 ? i + 1 : -1, row < 7 ? i + 8 : -1]) {
      if (t >= 0 && inspectSwap(state.board, i, t).valid) out.push({ a: i, b: t });
    }
  }
  return out;
}

describe('REQ-016 运行时集成检查', () => {
  test('整局随机对局中是否出现"无可行步但仍 playing"的已结算状态', () => {
    let dead = 0;
    let deadWithShuffleEvent = 0;
    let games = 0;
    let settledDeadExample: any = null;
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 20; seed += 1) {
        games += 1;
        let state = createGame(level, seed);
        const rng = new SeededRng(seed * 31 + level.id);
        for (let step = 0; step < 40; step += 1) {
          const list = moves(state);
          if (list.length === 0) {
            if (state.status === 'playing' && state.movesLeft > 0 && !hasAnyMove(state.board)) {
              dead += 1;
              if (!settledDeadExample) {
                settledDeadExample = { level: level.id, seed, step, movesLeft: state.movesLeft, score: state.score };
              }
            }
            break;
          }
          const move = list[rng.nextInt(list.length)]!;
          const result = resolveSwap(state, level, move.a, move.b);
          if (result.events.some((e) => e.type === 'shuffle')) deadWithShuffleEvent += 1;
          state = result.state;
          if (state.status !== 'playing') break;
        }
      }
    }
    console.log(JSON.stringify({ games, dead, deadWithShuffleEvent, settledDeadExample }));
    expect(games).toBeGreaterThan(0);
  }, 180000);

  test('结算引擎对"死局 + 剩余步数 > 0"不做任何重排（无 shuffle 事件，棋盘保持死局）', () => {
    const level = getLevel(1)!;
    const latin: TileKind[] = ['star', 'water', 'leaf', 'flame', 'crystal', 'bolt'];
    const dead = createEmptyBoard();
    for (let r = 1; r <= 8; r += 1) {
      for (let c = 1; c <= 8; c += 1) {
        (dead.cells[toIndex(r, c)] as Cell).tile = issueTile(dead, latin[(r + c) % 6]!);
      }
    }
    expect(hasAnyMove(dead)).toBe(false);
    const state: GameState = { ...createGame(level, 1), board: dead, movesLeft: 15 };
    // 任意相邻交换都会因无匹配被拒；结算路径不会触发重排
    const result = resolveSwap(state, level, toIndex(1, 1), toIndex(1, 2));
    expect(result.rounds).toEqual([]);
    expect(result.events.some((e) => e.type === 'shuffle')).toBe(false);
    expect(hasAnyMove(result.state.board)).toBe(false);
    // ensurePlayable 有能力修复，但没有被结算/应用层调用（见报告中的调用点检索）
    const fixed = ensurePlayable(result.state, level);
    expect(fixed.shuffled).toBe(true);
    expect(hasAnyMove(fixed.state.board)).toBe(true);
  });
});

