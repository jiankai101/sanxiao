import { describe, expect, it } from 'vitest';
import { LowMovesNotifier, buildHudModel, formatLiveText } from '../../src/ui/hud';
import { ThrottledAnnouncer } from '../../src/ui/live-region';
import type { GoalProgress } from '../../src/systems/contracts';
import { LEVELS } from '../../src/systems/level/levels';

const goals: GoalProgress[] = [
  { goalId: 'score', current: 1200, target: 1500, done: false },
  { goalId: 'collect-water', current: 4, target: 18, done: false },
];

describe('REQ-050 HUD 与 aria-live 文本', () => {
  it('文本格式逐字符匹配', () => {
    const model = buildHudModel({ score: 1200, movesLeft: 7, goals, level: LEVELS[0] });
    expect(formatLiveText(model)).toBe('分数 1200，剩余步数 7，目标 分数 1200/1500；水滴 4/18');
  });

  it('目标完成状态进入模型', () => {
    const model = buildHudModel({
      score: 1500,
      movesLeft: 3,
      goals: [{ goalId: 'score', current: 1500, target: 1500, done: true }],
      level: LEVELS[0],
    });
    expect(model.goals[0]!.done).toBe(true);
    expect(model.lowMoves).toBe(true);
  });

  it('同一秒 10 次变化只播报 1 次，内容为最后一帧', () => {
    let t = 0;
    const timers = new Map<number, { at: number; fn: () => void }>();
    let seq = 0;
    const emitted: string[] = [];
    const announcer = new ThrottledAnnouncer((text) => emitted.push(text), {
      now: () => t,
      setTimer: (fn, ms) => {
        seq += 1;
        timers.set(seq, { at: t + ms, fn });
        return seq;
      },
      clearTimer: (id) => timers.delete(id),
    });

    for (let i = 0; i < 10; i += 1) {
      announcer.update(`分数 ${i}`);
      t += 100;
    }
    expect(emitted).toEqual(['分数 0']);
    t = 1000;
    for (const [id, timer] of [...timers.entries()]) {
      if (timer.at <= t) {
        timers.delete(id);
        timer.fn();
      }
    }
    expect(emitted).toEqual(['分数 0', '分数 9']);
  });
});

describe('REQ-028/TASK-028 低步数提示', () => {
  it('≤3 步只提示一次，0 步不重复', () => {
    const notifier = new LowMovesNotifier();
    expect(notifier.check(5)).toBe(false);
    expect(notifier.check(3)).toBe(true);
    expect(notifier.check(2)).toBe(false);
    expect(notifier.check(0)).toBe(false);
  });
});
