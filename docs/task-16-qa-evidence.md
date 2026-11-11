# TASK-16 QA 证据：固定种子通关 + 300ms 结算输入锁

- 任务：TASK-16（实现 B 补正：主循环接入可见补间 + favicon 404 修复）
- 关联需求：REQ-020（结算/输入锁）、REQ-028（面板输入锁）、REQ-034（本地排行榜）、REQ-044、REQ-051
- 自动化用例：`tests/e2e/settlement-strict.spec.ts`
- 复测命令：`npx playwright test tests/e2e/settlement-strict.spec.ts`
- 运行时间：2026-11-11（固定页面时钟 `2026-11-11T00:00:00Z`）
- 结果：1/1 通过

## 1. 固定种子完整通关

- 种子：`?seed=1`（关卡 1「起步」）
- 步数：6/20
- 分数：2790
- 星级：3
- 结果：胜利，结算面板出现

固定走法（行/列均从 1 开始）：

1. (1,2) ↔ (2,2)
2. (1,5) ↔ (2,5)
3. (1,4) ↔ (2,4)
4. (2,2) ↔ (2,3)
5. (2,4) ↔ (2,5)
6. (2,5) ↔ (3,5)

该序列由 core 的 `createGame(level1, 1) + inspectSwap + resolveSwap` 逐步模拟得出；浏览器使用相同种子与 core 端口，逐帧动画不改变逻辑结果。

## 2. 300ms 结算输入锁（严格断言）

测试在最后一次交换前用 `page.clock.pauseAt(...)` 冻结时间，再以 25ms 步进推进到结算面板出现；随后按 `panelUnlockAt` 绝对时间精确推进：

- 面板出现后 t+200ms：首个按钮 `disabled === true`；执行 DOM `click()` 无任何效果，未出现确认对话框，结算面板仍可见。
- 面板出现后 t+350ms：首个按钮 `disabled === false`；点击后出现「重开本局」确认对话框。

测试中校验了推进后的 `performance.now()` 精确等于 `panelUnlockAt - 100`（t+200ms）与 `panelUnlockAt + 50`（t+350ms），不依赖 wall-clock 抖动。

## 3. 胜利写榜与存档

自动化读取 `localStorage` 后断言：

`wmg.leaderboard.v1`：

```json
{
  "boardVersion": 1,
  "records": [
    {
      "id": "1-1794355207702-1",
      "levelId": 1,
      "score": 2790,
      "stars": 3,
      "movesUsed": 6,
      "achievedAt": "2026-11-11T00:00:07.702Z",
      "seed": 1
    }
  ]
}
```

`wmg.save.v1` 关键字段：

- `unlockedLevelId: 2`
- `levelRecords[levelId=1].bestScore: 2790`
- `levelRecords[levelId=1].bestStars: 3`
- `levelRecords[levelId=1].clearCount: 1`
- `stats.totalMoves: 6`
- `lastSessionInterrupted: false`

测试同时将完整证据写入：`test-results/task-16-victory-evidence.json`（每次运行覆盖）。

## 4. 结论

- 固定种子可完整通关并写入本地排行榜与存档。
- 结算面板 300ms 输入锁在 t+200ms 严格无效、t+350ms 严格有效。
- 本补充未修改 `src/core`、`src/render`、`spec.md`、`plan.md`、`tasks.md`。

## 5. 复跑与稳定性（TASK-18 归档复验）

- `npx playwright test tests/e2e/settlement-strict.spec.ts`：1/1 通过（约 6s）。
- `npx playwright test tests/e2e/settlement-strict.spec.ts --repeat-each=3`：3/3 通过（6.5s / 6.5s / 6.6s），未观察到不稳定用例。
- `npm test`：32 个测试文件、191 个用例全部通过。
- `npm run build`：`tsc --noEmit` 无错误，Vite 构建成功。
- 本次复跑重新生成 `test-results/task-16-victory-evidence.json`，其中 `record.id = 1-1794355207702-1`、`achievedAt = 2026-11-11T00:00:07.702Z`；score/stars/movesUsed/seed 与上文断言一致。
- 未修改 `spec.md`、`plan.md`、`tasks.md`、`src/core`、`src/render`、`assets`。
