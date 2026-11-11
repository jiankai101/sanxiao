# BUG-007 修复报告：resize 防抖收紧（REQ-041）

- 任务：task-37 / BUG-007（Low）
- 关联需求：REQ-041「窗口缩放、旋转或 DPR 变化后 200ms 内完成重绘，元素不模糊」
- 范围：`src/render/canvas-host.ts`、`src/systems/main.ts`、`tests/render/layout.spec.ts`、`tests/e2e/resize.spec.ts`
- 未改动：core 语义、assets、spec/plan/tasks、REQ 数值、既有断言（只收紧不改宽）

## 1. 根因与修复

根因：`main.ts` 的 resize 监听与 `CanvasHost.debounceMs` 默认值都是 200ms，防抖本身即用尽 200ms 预算，重绘必然从 200ms 之后开始。

修复：
1. 新增 `export const RESIZE_DEBOUNCE_MS = 120`（canvas-host.ts），作为唯一来源。
2. `CanvasHost.debounceMs` 默认值 200ms → `RESIZE_DEBOUNCE_MS`（120ms）。
3. `main.ts` 的 `new CanvasHost(..., { debounceMs })` 与 window resize 的 `setTimeout` 都改用 `RESIZE_DEBOUNCE_MS`（120ms），其他时序不变。
4. 重绘路径不变：`applyViewport()`（重建后备缓冲，DPR clamp 仍为 `min(devicePixelRatio, 2)`）→ `scene.resize()` → `app.renderFrame()`；未触发任何对局状态重建。

120ms 预算：120ms 防抖 + 一次 60Hz 帧（≈16.7ms）≈ 137ms，低于 200ms；单测断言 `RESIZE_DEBOUNCE_MS + 17 <= 200`。

## 2. 四视口实测（resize → 完成重绘）

计时口径（与 G8 同法）：页内 `resize` 事件记录起点的 `performance.now()`；`MutationObserver` 监听 canvas width/height 变更（回调在 `applyViewport + renderFrame` 同步任务之后触发，即"重绘完成"）；再取一个 `requestAnimationFrame` 时间戳作为首帧上屏时间。

### 2.1 单跑 `npx playwright test tests/e2e/resize.spec.ts`

| 视口 | 后备缓冲重建（MutationObserver） | 首帧上屏（rAF） | 结果 |
|---|---|---|---|
| 1280×800 | 128.9ms | 149.8ms | PASS ≤200ms |
| 600×800 | 124.3ms | 145.0ms | PASS ≤200ms |
| 360×640 | 123.8ms | 141.4ms | PASS ≤200ms |
| 320×568 | 130.0ms | 149.8ms | PASS ≤200ms |

### 2.2 全量并行 `npx playwright test`（16 workers，最差负载）

| 视口 | 后备缓冲重建 | 首帧上屏 | 结果 |
|---|---|---|---|
| 1280×800 | 122.6ms | 174.3ms | PASS ≤200ms |
| 600×800 | 123.4ms | 172.2ms | PASS ≤200ms |
| 360×640 | 127.7ms | 170.0ms | PASS ≤200ms |
| 320×568 | 126.8ms | 162.4ms | PASS ≤200ms |

对比修复前 G8：204.4–208.5ms（后备缓冲）/ 207.5–212.4ms（首帧），现已全部回到 200ms 内。

## 3. 测试改动

- `tests/render/layout.spec.ts`
  - DPR clamp 用例：`debounceMs` 断言 200 → `RESIZE_DEBOUNCE_MS`，并断言其 ≤150ms。
  - 原单视口 200ms 用例扩展为四视口（1280×800 / 600×800 / 360×640 / 320×568）：断言调度延迟 == 120ms、`119ms` 未回调 / `120ms` 恰好回调一次、后备缓冲 == `cssWidth × 2`、CSS 尺寸一致、状态 token 不变。
  - 新增抖动合并用例：5 次 `handleResize()`（间隔 100ms < 120ms）只触发 1 次 `onResize`。
- `tests/e2e/resize.spec.ts`（新增，3 条）
  1. 四视口各 resize 一次：重建与首帧均 ≤200ms；`canvas.width ≈ cssWidth × min(DPR,2)`；对局快照（status/levelId/seed/score/movesLeft）与 resize 前完全相等。
  2. 连续 5 次 resize 抖动 → 后备缓冲只重建 1 次（计数 `HTMLCanvasElement.width` setter）。
  3. `deviceScaleFactor: 3` 下 resize：DPR 夹到 2，重建与首帧仍 ≤200ms。

## 4. 验证命令与结果

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx vitest run` | PASS 34 files / 223 tests（原 222 + 新增 1，原 200ms 单视口用例被四视口用例取代） |
| `npx playwright test` | PASS 46 / 46（原 43 + 新增 3） |
| `npm run build` | PASS（dist 产物生成） |

## 5. 已知限制

- 首帧上屏耗时包含浏览器合成调度，并行高负载下会从 ~145ms 升到 ~174ms；仍 ≤200ms，但余量小于后备缓冲重建指标。规格阈值未放宽。
- 本机无 git 仓库，未提供 diff；改动文件即上文 4 个。
- 未验证真实移动端旋转（只用四种视口 + `deviceScaleFactor` 模拟）；逻辑入口与桌面一致。
