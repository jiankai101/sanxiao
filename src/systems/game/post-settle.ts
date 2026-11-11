/**
 * REQ-016 无可行步重排的系统层接线（BUG-002）。
 *
 * 结算提交后、下一次输入解锁前调用：只调用 core 的 `ensurePlayable`，
 * 不复制任何玩法规则；重排不消耗步数、不改分数、不改已结算结果。
 * 失败（含极端异常）时按 spec REQ-016 末句「立即判负」降级。
 */
import { ensurePlayable } from '@core/index';
import type { GameEvent, GameState, LevelConfig } from '@core/types';

export interface PostSettleOutcome {
  /** 重排后的对局状态；未重排时与原状态同一引用。 */
  state: GameState;
  /** 需要由 systems 播放的事件（目前只有 shuffle / lost）。 */
  events: GameEvent[];
  /** 是否真正发生了保分布重排。 */
  shuffled: boolean;
  /** core 是否报告重排失败（尝试上限耗尽）。 */
  failed: boolean;
  /** 是否因重排失败而立即判负。 */
  forfeited: boolean;
}

const unchanged = (state: GameState): PostSettleOutcome => ({
  state,
  events: [],
  shuffled: false,
  failed: false,
  forfeited: false,
});

const forfeit = (state: GameState): PostSettleOutcome => ({
  state: { ...state, status: 'lost' },
  events: [{ type: 'lost' }],
  shuffled: false,
  failed: true,
  forfeited: true,
});

export function ensurePlayableAfterSettle(state: GameState, level: LevelConfig): PostSettleOutcome {
  // 只有仍在进行的对局才需要保证可继续；won/lost/idle 不再重排。
  if (state.status !== 'playing') return unchanged(state);

  let ensured: ReturnType<typeof ensurePlayable>;
  try {
    ensured = ensurePlayable(state, level);
  } catch {
    // 极端情况：重排实现抛错。走确定降级路径，立即判负而不是卡死。
    return forfeit(state);
  }

  if (ensured.shuffled) {
    return {
      state: ensured.state,
      events: ensured.events.slice(),
      shuffled: true,
      failed: false,
      forfeited: false,
    };
  }
  if (ensured.failed) return forfeit(state);
  return unchanged(state);
}