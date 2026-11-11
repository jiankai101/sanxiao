# TASK-26 报告：CR-008 落地（棋盘外点击 → 静默忽略）+ 测试对齐

- TASK-ID：task-26（parent task-1，依赖 task-25）
- REQ-ID：REQ-004（A/B 两类非法输入）、REQ-049（命中失败路径 A 类定义源）
- 依据：spec v1.1.2（CR-008），A 类 = 静默忽略（矩形外 / 石块格 / 死格），B 类 = 无效交换（两个有效格之间）

## 1. 修改文件清单

| 文件 | 类型 | 说明 |
| --- | --- | --- |
| `src/ui/input/board-input.ts` | 修改 | A 类分支改为静默 return；`invalid` 事件收窄为 B 类专用（cell 必为有效格）；补充 A/B 判定位置注释 |
| `tests/ui/input.spec.ts` | 修改 | 旧「矩形外 = invalid」期望值改为新口径；新增拖出棋盘、拖过边缘、B 类保留 invalid 三组用例 |
| `tests/e2e/outside-board.spec.ts` | 新增 | 棋盘外点击/拖拽 E2E：selected、moves/score、aria live、invalid 音效四项断言 |
| `task-26-cr008-report.md` | 新增 | 本报告 |

未改动：`spec.md` / `plan.md` / `tasks.md`、`src/core/**`、`src/render/**`、`assets/**`、`src/systems/app.ts`（invalid 事件仍由 app 播放音效，B 类路径零改动）。

## 2. A/B 类在代码中的判定位置（`src/ui/input/board-input.ts`）

A 类（静默忽略，不 emit 任何事件；不改变选中态、不交换、不扣步、不播 invalid、不触发 aria）：

1. L67-68 `press()`：`sample.cell === null`（按下点在棋盘投影矩形外）→ `return`。原实现会 `selected = null` 并 emit `{type:'invalid', cell:null}`，现已删除。
2. L89-90 `release()`：`sample.cell === null`（抬起/点击点在投影矩形外，含从有效格拖出棋盘）→ `return`，保留 `selected`。
3. L91-92 `release()`：`!isSelectable(sample.cell)`（石块 / 死格，task-24 已有行为）→ `return`。
4. L104-105 `release()`：拖拽主轴越过棋盘边缘（目标 row/col 越出 1..8）→ `return`，不再 emit invalid、不再清空选中。

B 类（保留 invalid 事件 → `app.onInputEvent` 播放 `sfx-invalid`）：

- L113-117 `release()`：起点与抬起点均为有效格、位移未达 0.5 格阈值且两格不同 → emit `{ type:'invalid', cell }` 并清除选中（与 CR-008 前一致）。
- `BoardInputEvent.invalid` 类型收窄为 `{ type:'invalid'; cell: CellCoord }`（L16），从类型层面杜绝 A 类再发出 invalid；`app.ts` 的 `case 'invalid'` 未改动。

## 3. 为什么修改既有单测期望值（非放宽断言）

原用例 `棋盘外（吸附 null）→ invalid，不产生交换` 固化了 v1.1.1 的旧口径（矩形外 → invalid + 清空选中）。CR-008 已将同一场景重定义为 A 类「静默忽略」，因此该期望值属于**规格口径变更导致的必然更新**。新断言严格更强：

- 事件数在操作前后完全相等（旧断言只看 `events[0]`）；
- 断言不存在 `invalid` / `deselect` / `swap`（旧断言只排除 swap）；
- 断言已有选中 `(2,2)` 在矩形外点击后保持不变（旧口径相反）；
- 另加拖出矩形、拖过边缘两组用例覆盖 A 类的其他落点形态。

B 类未被放宽：新增 `B 类：两个有效格、位移未达阈值且不是同一格 → 保留 invalid 事件`，并保留既有 blocked-hit 全组用例。

## 4. 新增 E2E（`tests/e2e/outside-board.spec.ts`）

点击点取逻辑坐标 (100, 660)，位于棋盘投影矩形 (x 224..736, y 96..608) 之外的画布留白处。音效计数通过监听 `sfx-invalid.ogg|mp3` 的网络请求实现（`AudioEngine` 按需 fetch 音频资源）。

1. 先选中 (1,1) 再点棋盘外：`selected` 仍为 `{1,1}`；moves/score 与操作前一致；`#game-live` 文本不变（无 aria 播报）；`sfx-invalid` 请求数为 0。
2. 无选中时点棋盘外：`selected` 仍为 null；moves/score 不变；无 invalid 音效。
3. 从 (1,1) 拖出棋盘后松开：`selected` 保持 `{1,1}`；不交换、不扣步；无 invalid 音效。

## 5. 测试命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过（tsc --noEmit，无输出错误） |
| `npm test` | **34 个测试文件 / 220 个用例全部通过**；`tests/ui/input.spec.ts` 18 个用例通过 |
| `npx playwright test tests/e2e/outside-board.spec.ts` | 3 passed |
| `npx playwright test` | **36 passed**（含既有 B 类/无效交换/石块/死格/输入等价用例，零回归） |

B 类零回归关键用例：`tests/e2e/motion.spec.ts` invalid revert、`tests/e2e/core-flow.spec.ts` 失败路径、`tests/e2e/blocked-hit.spec.ts` 全组、`tests/ui/input.spec.ts` B 类新增用例，均通过。

## 6. 自测步骤与预期输出

1. `npm test` → 34 files / 220 tests passed。
2. `npx playwright test` → 36 passed。
3. 手动：`npm run dev` 打开页面 → 进入第 1 关 → 点击任一普通格（出现选中框）→ 点击画布左下留白 → 选中框保持、步数/分数不变、无错误音效。

## 7. 已知限制

- E2E 的 invalid 音效断言依赖「音频资源按需 fetch」：对全新页面会话可证明未播放 invalid；若同一会话此前已加载过该音效，重复播放不会再次产生请求。因此以单测层「不 emit invalid 事件」为权威断言，E2E 作为端到端补充（页面每次均重新加载，且操作前已断言请求数为 0）。
- E2E 固定 1280×800 视口与单一留白点；分辨率无关性由 `tests/ui/input.spec.ts` 的纯逻辑用例覆盖（吸附 null / 越界分支均与视口无关）。
- spec 第 10.2 章 `sfx-invalid`「触发事件」列仍含「障碍格点击」（与 A 类冲突，task-25 已登记建议 CR-009）；本任务禁止改 spec/第 10 章，未改动。
