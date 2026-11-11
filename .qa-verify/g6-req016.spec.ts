import { describe, expect, test } from 'vitest';
import type { GameState } from '@core/types';
import { hasAnyMove } from '@core/board/generate';
import { inspectSwap } from '@core/board/swap';
import { resolveSwap } from '@core/resolve';
import { createGame } from '@core/game';
import { LEVELS } from '@systems/level/levels';
import { ensurePlayableAfterSettle } from '@systems/game/post-settle';
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

/** 以 systems 层真实接线（app.commit 调用的 ensurePlayableAfterSettle）模拟整局。 */
function runGames(usePostSettle: boolean) {
  let games = 0;
  let dead = 0;
  let shuffleEvents = 0;
  let shuffleStepCostBugs = 0;
  const deadExamples: any[] = [];
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 20; seed += 1) {
      games += 1;
      let state = createGame(level, seed);
      const rng = new SeededRng(seed * 31 + level.id);
      for (let step = 0; step < 40; step += 1) {
        const list = moves(state);
        if (list.length === 0) break;
        const move = list[rng.nextInt(list.length)]!;
        const before = state.movesLeft;
        const result = resolveSwap(state, level, move.a, move.b);
        const settled = usePostSettle ? ensurePlayableAfterSettle(result.state, level) : { state: result.state, events: [] as any[] };
        state = settled.state;
        const shuffled = settled.events.filter((e: any) => e.type === 'shuffle').length;
        shuffleEvents += shuffled;
        // 扣步只应来自有效交换本身；重排不得额外扣步
        const consumed = before - state.movesLeft;
        if (shuffled > 0 && (consumed < 0 || consumed > 1)) shuffleStepCostBugs += 1;
        // 结算结束且仍 playing、剩余步数 > 0 → 必须存在可行步，否则就是死局残留
        if (state.status === 'playing' && state.movesLeft > 0 && !hasAnyMove(state.board)) {
          dead += 1;
          if (deadExamples.length < 3) deadExamples.push({ level: level.id, seed, step, movesLeft: state.movesLeft, score: state.score });
        }
        if (state.status !== 'playing') break;
      }
    }
  }
  return { games, dead, shuffleEvents, shuffleStepCostBugs, deadExamples };
}

describe('REQ-016 G6 运行时接线回归', () => {
  test('REQ-016 160 局（8 关 × 20 种子）结算后死局残留必须为 0', () => {
    const guarded = runGames(true);
    console.log('WITH_POST_SETTLE', JSON.stringify(guarded));
    expect(guarded.games).toBe(160);
    expect(guarded.dead).toBe(0);
    expect(guarded.shuffleStepCostBugs).toBe(0);
    expect(guarded.shuffleEvents).toBeGreaterThan(0);
  }, 240000);

  test('REQ-016 对照组：不接系统层重排时该模拟确实会检出死局（证明用例有灵敏度）', () => {
    const control = runGames(false);
    console.log('WITHOUT_POST_SETTLE', JSON.stringify(control));
    expect(control.dead).toBeGreaterThan(0);
  }, 240000);
});
