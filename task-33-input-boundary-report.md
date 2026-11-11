# TASK-33 输入边界修复报告

- TASK-ID: task-33
- REQ-ID: REQ-049（主轴位移 < 0.5 格判为点击）、REQ-003（已选中 A + 点击相邻 B = 交换；点击 A 自身 = 取消选中）
- 范围: `src/ui/input/board-input.ts`、`tests/ui/input.spec.ts`、`tests/e2e/invalid-sfx.spec.ts`、`tests/e2e/helpers.ts`

## 1. 问题与修复

修复前：`BoardInput.release()` 在位移未达 0.5 格时，只要抬起点吸附格与按下格不同，就 `emit({ type: 'invalid' })`。
当按下点贴近格边界、位移仅 0.4 格但已跨过中垂线时，会被误判为 B 类无效交换并播放 invalid，违反 REQ-049「< 0.5 格 = 点击」。

修复后判定位置：`src/ui/input/board-input.ts` 的 `release()`。

1. 先保留 A 类过滤：抬起点吸附 `null`（棋盘外）或 `!isSelectable(cell)`（石块/死格）→ 静默返回，不产生事件。
2. 计算 `dx/dy`、主轴、`mainDelta` 与阈值 `0.5 × cellCssSize`。
3. `|mainDelta| >= threshold` → 走原拖动分支（目标格 = 起点格沿主轴 ±1；越界/石块/死格静默忽略；相邻无匹配由 app 层回弹并播 invalid），行为不变。
4. `|mainDelta| < threshold` → **一律**调用 `handleClick(sample.cell)`，点击目标取抬起点吸附格；删除原 `invalid` 分支。
5. `handleClick()` 统一实现点击语义：无选中 → 选中；点击 A 自身 → 取消选中；A 相邻 B → 交换；非相邻 → 选中转移；A 类落点已在 `handleClick` 前被过滤。

`BoardInputEvent` 中的 `invalid` 变体保留，用于兼容 `src/systems/app.ts` 的 B 类回弹处理 switch；`BoardInput` 本身不再产生该事件。

## 2. 边界场景构造方式

- 单元测试（`tests/ui/input.spec.ts`，64px 格，阈值 32px）：
  - 按下 `clientX=106`（贴近边界），抬起 `clientX=131.6`，位移 25.6px = 0.4 格；样本吸附格由 (2,2) 变为 (2,3)。
  - 断言：无选中时选中 (2,3)；已选中 (2,2) 时交换 (2,2)↔(2,3)；抬起仍吸附自身时取消选中；三种情况均无 `invalid` 事件。
- E2E（`tests/e2e/invalid-sfx.spec.ts`）：
  - 新增 `cellBoundaryPoint()` / `cellCssPx()` helper，按 canvas boundingBox + 960 逻辑宽度换算格边界与视觉格 CSS 尺寸。
  - 1280×800 下格边界向内 4px 按下，沿主轴移动 `0.4 × cellCssPx`（约 28.4px，低于阈值约 42.7px）跨过中垂线，抬起吸附到相邻格。
  - 第 3 关选中 (3,2) 后向 (4,2) 做上述手势：断言按点击交换、扣 1 步、分数增加、无 invalid 音效；另用第 1 关 (1,1) 断言落回自身时取消选中且无 invalid。
  - 每个「无 invalid」用例仍执行 `expectInvalidSfxProbeSensitivity()`，证明探针能捕获 B 类 invalid 播放。

## 3. 测试命令与结果

```text
npm run typecheck      -> 通过（tsc --noEmit）
npm test               -> 34 个文件 / 222 个用例全部通过
npx playwright test    -> 43 个 E2E 全部通过（含新增 2 条边界点击用例）
```

## 4. 自测步骤与预期

1. `npm test`：`tests/ui/input.spec.ts` 中断言「0.4 格跨中垂线 → 点击（交换/取消选中），无 invalid」的用例通过。
2. `npx playwright test tests/e2e/invalid-sfx.spec.ts`：7 条用例通过；边界点击后无 invalid 播放、选中/步数/分数符合点击语义。
3. `npx playwright test`：既有拖拽、点击、A 类静默忽略、B 类回弹用例零回归。

## 5. 已知限制

- `BoardInput` 不再产生 `invalid` 事件；该事件变体与 `app.ts` 的 switch 分支为兼容保留。若后续彻底移除，需要同步修改 `src/systems/app.ts`（超出本任务允许范围）。
- 拖动阈值仍沿用 `geometry.cellCssSize()` 的既有定义（`64 × 视口宽 ÷ 960`），本任务未改动布局/几何换算。
- 未改动 `spec.md` / `plan.md` / `tasks.md`，未改动 `src/core`、`src/render`、`assets`。
