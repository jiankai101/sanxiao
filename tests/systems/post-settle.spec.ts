import { describe, expect, it } from 'vitest';
import { createGame, hasAnyMove, inspectSwap, multisetOf, resolveSwap, toIndex } from '../../src/core/index';
import type { Board, CellCoord, GameState, LevelConfig } from '../../src/core/types';
import { ensurePlayableAfterSettle } from '../../src/systems/game/post-settle';
import { getLevel } from '../../src/systems/level/levels';

/** QA 复现序列（第 8 关 seed=1）：五步后棋盘无任何可行交换。 */
const QA_REPRO_SEQUENCE: ReadonlyArray<readonly [number, number, number, number]> = [
  [1, 2, 1, 3],
  [3, 5, 4, 5],
  [1, 6, 1, 7],
  [1, 6, 2, 6],
  [1, 3, 1, 4],
];

const level8 = (): LevelConfig => {
  const level = getLevel(8);
  if (!level) throw new Error('level 8 missing');
  return level;
};

const coord = (row: number, col: number): CellCoord => ({ row, col }) as CellCoord;

function replay(state: GameState, level: LevelConfig, sequence: typeof QA_REPRO_SEQUENCE): GameState {
  let current = state;
  for (const [fromRow, fromCol, toRow, toCol] of sequence) {
    const result = resolveSwap(current, level, toIndex(fromRow, fromCol), toIndex(toRow, toCol));
    expect(result.rounds.length).toBeGreaterThan(0);
    current = result.state;
  }
  return current;
}

/** 与运行时 findMove 相同的相邻交换搜索。 */
function findMove(board: Board): { a: CellCoord; b: CellCoord } | null {
  for (let index = 0; index < 64; index += 1) {
    const row = Math.floor(index / 8) + 1;
    const col = (index % 8) + 1;
    const right = col < 8 ? index + 1 : -1;
    const down = row < 8 ? index + 8 : -1;
    for (const target of [right, down]) {
      if (target < 0) continue;
      if (inspectSwap(board, index, target).valid) {
        return {
          a: coord(row, col),
          b: target === right ? coord(row, col + 1) : coord(row + 1, col),
        };
      }
    }
  }
  return null;
}

describe('REQ-016 结算后无可行步重排（BUG-002）', () => {
  it('REQ-016 BUG-002 QA 复现序列：结算后自动重排，shuffle 事件 ≥1 且对局可继续', () => {
    const level = level8();
    const settled = replay(createGame(level, 1), level, QA_REPRO_SEQUENCE);

    // 前置断言：复现序列确实把棋盘带到死局（修复前运行时在此卡死）。
    expect(settled.status).toBe('playing');
    expect(settled.movesLeft).toBe(25);
    expect(hasAnyMove(settled.board)).toBe(false);
    expect(findMove(settled.board)).toBeNull();

    const post = ensurePlayableAfterSettle(settled, level);

    expect(post.shuffled).toBe(true);
    expect(post.failed).toBe(false);
    expect(post.forfeited).toBe(false);
    expect(post.events.filter((event) => event.type === 'shuffle')).toHaveLength(1);
    expect(hasAnyMove(post.state.board)).toBe(true);
    const move = findMove(post.state.board);
    expect(move).not.toBeNull();

    // 重排不改变步数、分数、统计与已结算结果。
    expect(post.state.movesLeft).toBe(settled.movesLeft);
    expect(post.state.score).toBe(settled.score);
    expect(post.state.stats).toEqual(settled.stats);
    expect(post.state.settlementId).toBe(settled.settlementId);
    expect(post.state.status).toBe('playing');

    // 重排后仍能正常结算：下一步有效交换扣 1 步。
    const next = resolveSwap(post.state, level, toIndex(move!.a.row, move!.a.col), toIndex(move!.b.row, move!.b.col));
    expect(next.rounds.length).toBeGreaterThan(0);
    expect(next.state.movesLeft).toBe(24);
    expect(next.outcome).not.toBe('lost');
  });

  it('REQ-016 重排保持元素多重集与障碍布局不变', () => {
    const level = level8();
    const settled = replay(createGame(level, 1), level, QA_REPRO_SEQUENCE);
    const post = ensurePlayableAfterSettle(settled, level);

    expect(multisetOf(post.state.board)).toEqual(multisetOf(settled.board));
    expect(post.state.board.cells.map((cell) => cell.obstacle)).toEqual(
      settled.board.cells.map((cell) => cell.obstacle),
    );
  });

  it('REQ-016 有可行步时不重排、不产生事件', () => {
    const level1 = getLevel(1);
    if (!level1) throw new Error('level 1 missing');
    const state = createGame(level1, 1);
    expect(hasAnyMove(state.board)).toBe(true);

    const post = ensurePlayableAfterSettle(state, level1);
    expect(post.shuffled).toBe(false);
    expect(post.failed).toBe(false);
    expect(post.forfeited).toBe(false);
    expect(post.events).toEqual([]);
    expect(post.state).toBe(state);
  });

  it('REQ-016 已结束对局不触发重排', () => {
    const level = level8();
    const settled = replay(createGame(level, 1), level, QA_REPRO_SEQUENCE);
    const finished: GameState = { ...settled, status: 'won' };

    const post = ensurePlayableAfterSettle(finished, level);
    expect(post.state).toBe(finished);
    expect(post.events).toEqual([]);
    expect(post.shuffled).toBe(false);
  });

  it('REQ-016 重排失败时立即判负（确定降级路径，不抛异常）', () => {
    const level = level8();
    const settled = replay(createGame(level, 1), level, QA_REPRO_SEQUENCE);
    // 极端情况：无可行步且已无剩余步数，core ensurePlayable 会返回 failed。
    const stalled: GameState = { ...settled, movesLeft: 0 };

    const post = ensurePlayableAfterSettle(stalled, level);
    expect(post.failed).toBe(true);
    expect(post.forfeited).toBe(true);
    expect(post.shuffled).toBe(false);
    expect(post.state.status).toBe('lost');
    expect(post.events).toEqual([{ type: 'lost' }]);
    expect(post.state.score).toBe(stalled.score);
    expect(post.state.movesLeft).toBe(0);
  });
});