# BUG-008 修复报告：时序敏感 E2E 隔离

- TASK-ID: BUG008-TIMING（room task-39）
- REQ-ID: REQ-041（resize 200ms）；REQ-044、REQ-034/REQ-051（帧间隔 p95 性能断言）
- 结论：3 次连续全量 `npx playwright test` 均全绿，46/46；resize 的 200ms 断言保持不变，并在单 worker 的 `timing` project 中串行运行。

## 修改文件

- `playwright.config.ts`
- `bug-008-report.md`（本报告）
- `bug-008-run1.log` / `bug-008-run2.log` / `bug-008-run3.log`（三次全量运行原始日志）

未修改 `src/`、`assets/`、`tests/`（含 `tests/e2e/resize.spec.ts` 的断言）、`specs/`、`plan*`、`tasks*`。

## 配置方案

新增两个 project：

1. `chromium`：默认并行 project，`testIgnore` 排除时序敏感文件，继续使用 Playwright 默认并行 worker（本次 13 个 spec 文件对应 13 workers）。
2. `timing`：`testMatch` 仅匹配以下文件，`workers: 1`、`fullyParallel: false`，并通过 `dependencies: ['chromium']` 在并行 project 全部结束后运行：
   - `tests/e2e/resize.spec.ts`
   - `tests/e2e/motion.spec.ts`
   - `tests/e2e/audio-network.spec.ts`

隔离原因：

- `resize.spec.ts`：BUG-008 复现点是 resize 后首帧 `frameMs <= 200ms`。该阈值表达真实单页面使用预算，不因测试并行度放宽；隔离后消除 16-worker 合成时机争用。
- `motion.spec.ts`：包含 `p95 <= 20ms` 帧间隔断言，以及 60ms/70ms 中间帧快照断言，属于真实合成时序敏感用例。
- `audio-network.spec.ts`：包含“3 秒对局采样 p95 帧间隔 <= 20ms”，同样会受并行浏览器进程挤占。
- `audio-live.spec.ts` 使用 10–30s poll，不是固定毫秒性能预算，未隔离；`perf.spec.ts` 只检查预览启动，也未隔离。

`dependencies: ['chromium']` 用于保证 `timing` 开始时并行 project 已经结束，避免“单 worker 但与其他 project 同时跑”的假隔离。两个 project 共用同一个 `webServer`，不会重复构建或重复启动预览服务。

## 断言未放宽

`tests/e2e/resize.spec.ts` 原样保留：

```ts
expect(metric.rebindMs, context).toBeLessThanOrEqual(200);
expect(metric.frameMs, context).toBeLessThanOrEqual(200);
```

没有改成 300ms，也没有改成 p95 或其他统计放宽。

## 三次全量运行

命令（三次完全相同）：

```powershell
npx playwright test
```

测试总数：修改前后均为 `46 tests in 16 files`；`chromium` 36 条，`timing` 10 条，无重复、无遗漏。

| 运行 | 结果 | 用时 | resize 首帧证据（1280x800 / 600x800 / 360x640 / 320x568） |
|---|---|---|---|
| 1 | 46 passed | 49.0s | frame 145.7 / 149.8 / 150.0 / 150.0ms；rebind 122.9 / 123.7 / 130.0 / 130.9ms |
| 2 | 46 passed | 47.7s | frame 149.7 / 144.7 / 141.2 / 149.8ms；rebind 128.4 / 122.8 / 120.9 / 130.0ms |
| 3 | 46 passed | 47.8s | frame 149.9 / 148.9 / 149.6 / 145.7ms；rebind 127.0 / 123.3 / 128.9 / 128.3ms |

三次运行退出码均为 0，`REQ-041 resize evidence` 均低于 200ms 上限；`timing` project 在三次运行中均为单 worker 顺序执行。

## 总耗时影响

- 三次全量总耗时：47.7–49.0s（含构建与预览启动）。
- `timing` 串行尾段约 14.2–15.2s；这 3 个文件若全部并行本可互相重叠，因此隔离大约增加 10–12s 全量耗时。
- 构建、预览服务和其余 13 个并行 spec 文件不受影响；总测试数不减少。

## 自测步骤与预期

1. 运行 `npx playwright test --list`，预期 `Total: 46 tests in 16 files`，其中 `timing` project 显示 resize/motion/audio-network 共 10 条。
2. 连续运行 `npx playwright test` 3 次，预期每次 `46 passed` 且退出码为 0。
3. 检查输出中的 `REQ-041 resize evidence`，预期四个视口的 `frame` 与 `rebind` 均不超过 200ms。

## 已知限制

- `timing` project 依赖 `chromium` project；如果并行 project 失败，`timing` 会被标记为未执行（skipped），而不是继续跑。这是为了保证隔离边界，不改变任何断言语义。
- 本次未引入 `retries`；稳定性来自运行环境隔离，而不是重试掩盖失败。
