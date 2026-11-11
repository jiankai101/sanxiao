# TASK-20 / BUG-002 + BUG-004 修复报告

角色：impl-systems
范围：`src/systems/**`、`src/ui/**`、`tests/systems/**`、`tests/e2e/**`（未改 `src/core`、`src/render`、`assets`、spec/plan/tasks）

## 1. 任务与需求映射

| TASK-ID | REQ | 内容 |
|---|---|---|
| TASK-030 | REQ-016（BUG-002） | 结算提交后死局重排接入运行时：`ensurePlayable` + shuffle 事件 + 音效 + 2s 提示 + 失败判负 |
| TASK-033 | REQ-045 / REQ-048（BUG-004） | 音频引擎用例补齐：首手势播放、循环接缝 ≤20ms、visibilitychange 暂停/续播、加载/解码失败降级 |
| TASK-036 | REQ-045 / REQ-048 | E2E：真实点击首手势播放、隐藏暂停/恢复续播、音频不可用图标 |

## 2. 修改文件清单

新增：
- `src/systems/game/post-settle.ts`：`ensurePlayableAfterSettle(state, level)`，只调用 core `ensurePlayable`；统一返回 `state/events/shuffled/failed/forfeited`。已结束对局不重排；core 抛错或重排失败时置 `status='lost'` 并返回 `lost` 事件（spec REQ-016「仍失败则立即判负」）。
- `tests/systems/post-settle.spec.ts`：5 条 REQ-016 用例（含 QA 复现序列集成测试）。
- `tests/e2e/shuffle.spec.ts`：第 8 关 seed=1 复现序列的浏览器集成测试。
- `tests/e2e/audio-live.spec.ts`：REQ-045 / REQ-048 运行时用例。

修改：
- `src/systems/app.ts`：`commit()` 在结算提交后、输入解锁前调用 `ensurePlayableAfterSettle`；复用 `playEventSounds` 处理 post-settle 的 `shuffle` 事件（播放 shuffle 音效 + 显示「无可消除步骤，已重排」2s）；统计 shuffle 次数供测试断言；`startLevel/restartLevel` 重置计数。
- `src/systems/main.ts`：`__wmgTest` 增加 `shuffleEvents()`、`audio()` 测试钩子。
- `src/systems/env.d.ts`：补充上述钩子类型。
- `tests/systems/audio.spec.ts`：新增 4 条 REQ-045/REQ-048 用例。

## 3. BUG-002 复现序列前后行为对比

序列（第 8 关，seed=1）：`(1,2)→(1,3)`、`(3,5)→(4,5)`、`(1,6)→(1,7)`、`(1,6)→(2,6)`、`(1,3)→(1,4)`

| 观察点 | 修复前 | 修复后 |
|---|---|---|
| status | `playing`（卡死） | `playing` |
| movesLeft / score | 25 / 1170 | 25 / 1170（不变） |
| `hasAnyMove` | `false` | `true` |
| `findMove` | `null` | 非 `null` |
| shuffle 事件计数 | 0（ensurePlayable 无调用点） | 1（core 第 2 次尝试成功） |
| 可见提示 / 音效 | 无 | 「无可消除步骤，已重排」2s + `sfx-shuffle` |
| 对局可继续 | 否 | 是（下一步有效交换后 movesLeft=24） |

重排前后元素多重集与障碍布局一致（单元测试断言），步数、分数、`stats`、`settlementId` 均未改变。

降级路径：core `ensurePlayable` 返回 `failed`（100 次洗牌 + 100 次随机落位后仍无可行步，或已无剩余步数）或抛错时，系统层立即置 `lost`、发出 `lost` 事件并进入正常失败结算（`settle(false)`），不会停留在不可输入的 `playing`。

## 4. 测试与结果

- `npx tsc --noEmit`：通过
- `npm test`：33 个测试文件、205 条用例全部通过
- `npm run build`：通过（tsc + vite build）
- `npx playwright test`：29 条 E2E 全部通过（含新增 `shuffle.spec.ts`、`audio-live.spec.ts`）
- 新增关键用例：
  - `REQ-016 BUG-002 QA 复现序列：结算后自动重排，shuffle 事件 ≥1 且对局可继续`
  - `REQ-016 重排失败时立即判负（确定降级路径，不抛异常）`
  - `REQ-045 首次手势前不播放，手势后 BGM 循环播放`
  - `REQ-045 visibilitychange 隐藏暂停、可见从暂停点续播且接缝 ≤20ms`
  - `REQ-048 解码失败时静默降级：不播放、不抛异常、unavailable=true`
  - `REQ-048 音频加载/解码失败静默降级并显示「音频不可用」图标`（E2E）

## 5. 已知限制

- shuffle 采用 core 既有算法，重排本身不播放位移动画，仅重新绘制棋盘 + 音效 + 2s 提示（spec 未要求重排动画）。
- 极端失败路径只在「无可行步且无剩余步数」等构造场景下可稳定触发，故以单元测试覆盖，未在 E2E 中伪造该状态。
- 循环接缝 ≤20ms 通过「暂停偏移 → 恢复起点偏移差 ≤20ms」断言；实际听感仍依赖浏览器音频实现。