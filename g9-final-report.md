# G9 收尾复核报告（spec v1.1.4）

- 验收角色：qa-verifier（独立验收；本轮未修改产品代码 / spec / plan / tasks / tests / assets；仅新增 `.qa-verify/` 下的自建探针与证据）
- 验收基线：`specs/001-core-game/spec.md` **v1.1.4**，51 条 REQ（本轮文本与 G8 基线二进制逐字比对一致：`same_text=True`）
- 复核时间：2026-11-11
- 证据目录：`.qa-verify/out/g9-*`
- 判定口径：只以 spec v1.1.4 正文为准；不采信实现方 / Manager 既有结论；REQ-041 的计时全部用本轮自建探针（不复用 `tests/e2e/resize.spec.ts`）。

## 0. 总结论

**存在缺陷（1 个，低：BUG-008）＋ 1 项人工阻塞（REQ-039）。**

| 项目 | 结果 |
|---|---|
| 51 条 REQ | **PASS 50 / FAIL 0 / BLOCKED 1** |
| BLOCKED 的 REQ | **REQ-039**（缺 3 人灰度人工评审签署；`tasks.md:858` 仍未勾选） |
| BUG-001 ~ BUG-006 | **全部关闭（本轮独立复验通过）** |
| BUG-007 | **关闭**（四视口 idle 实测 resize→重绘 121.7–146.7ms，全部 ≤200ms） |
| 新增缺陷 | **BUG-008（低）：全量 E2E 16 worker 并发下 REQ-041 首帧指标可复现 >200ms（215.2 / 253.8ms，2/2 次失败）** |
| 全量回归 | typecheck PASS / npm test **223/223 PASS** / build PASS / playwright **45 passed + 1 failed**（resize.spec 首帧断言） |
| 发布建议 | 产品侧 REQ 全绿（除人工项）；**但 `npx playwright test` 当前不是全绿**，须由 Manager 裁决 BUG-008（要么放宽该条“首帧”断言/串行跑，要么接受并发下超预算）后再发布 |

> 精确表述：**除 REQ-039 人工项外，50 条 REQ 全部 PASS**；但套件层面存在 1 个低严重级别缺陷（BUG-008），因此本轮不能给出“全部 PASS / 测试全绿”的结论。

---

## 1. 复核方法（本轮独立实现）

| 维度 | 方法 | 证据 |
|---|---|---|
| resize 计时 | 自建 `.qa-verify/g9-resize.mjs`：页内记录 `resize` 事件起点，MutationObserver 监听 canvas `width/height` 重绑定（并在同一微任务内读像素证明“绘制已完成”），rAF 轮询记录内容/上屏时间；**计时全程在页内，无 CDP 往返** | `g9-resize.txt`、`g9-resize-load16.txt`、`g9-resize-final.txt` |
| 生产构建 | `npm run build` 后 `vite preview` 起真实 dist，真实点击进入第 1 关，再 resize / 旋转 | `g9-prod-resize.txt`、`g9-prod-rotate.txt` |
| 命中与坐标 | 从 canvas 2D 绘制变换 `(a,d,e,f)` 反推视觉格中心并点击，不复用输入层换算 | `g9-layout.txt` |
| 音效 | 自建探针包装 `fetch → arrayBuffer → decodeAudioData → AudioBufferSourceNode.start`，断言“实际播放事件” | `g9-ab.txt` |
| 音频时长 | Chrome `OfflineAudioContext.decodeAudioData`（与运行时同解码器族），不按容器帧数推算 | `g9-decode.txt` |
| 追溯 | 展开 `REQ-009/015/018` 这类合并写法后统计 spec ↔ tasks ↔ tests | `g9-trace.txt`、`g9-g8-matrix.txt` |

本轮机器：Windows / Chrome（Playwright `channel: chrome`）/ dsf=1（另有 1.5、3 的专项上下文）；工作区无 git 仓库，故以“文件清单 + 证据”代替 diff。

---

## 2. BUG-007 关闭判定（REQ-041）

### 2.1 计时口径

| 指标 | 定义 |
|---|---|
| `rebuildMs` | 页面 `resize` 事件 → canvas 后备缓冲重建（MutationObserver 捕获 `width` 属性变更） |
| `contentMs` | 同上 → 新尺寸画布上出现真实绘制内容（棋盘区像素 alpha>0） |
| `paintMs` | 同上 → 内容存在后的下一帧 rAF 时间戳（上屏的保守上界） |
| `syncAlpha` | 在“width 变更”的同一微任务里立即取像素；=255 证明**绘制与后备缓冲重建在同一同步任务内完成** |

### 2.2 四视口 idle（单标签页、串行，2 轮）

| 轮次 | 视口 | rebuild | content | paint | CSS | 后备缓冲 | 比值 | syncAlpha |
|---|---|---|---|---|---|---|---|---|
| 1 | 1280×800 | 121.7ms | 146.7ms | 145.6ms | 1066.7 | 1067 | 1.000 | 255 |
| 1 | 600×800 | 122.2ms | 133.0ms | 130.9ms | 600 | 600 | 1.000 | 255 |
| 1 | 360×640 | 127.4ms | 132.6ms | 130.2ms | 360 | 360 | 1.000 | 255 |
| 1 | 320×568 | 123.1ms | 126.8ms | 123.4ms | 320 | 320 | 1.000 | 255 |
| 2 | 1280×800 | 128.4ms | 143.1ms | 141.7ms | 1066.7 | 1067 | 1.000 | 255 |
| 2 | 600×800 | 126.4ms | 132.6ms | 128.9ms | 600 | 600 | 1.000 | 255 |
| 2 | 360×640 | 127.1ms | 131.6ms | 129.9ms | 360 | 360 | 1.000 | 255 |
| 2 | 320×568 | 122.5ms | 126.3ms | 122.6ms | 320 | 320 | 1.000 | 255 |

- **四视口全部 ≤200ms**：最大 rebuild 128.4ms、最大 content 146.7ms、最大 paint 145.6ms。
- 对比 BUG-007 存量证据（G8：204.4–212.4ms 单跑）：系统性超时已消除，根因（debounce 用满 200ms 预算）已修复为 120ms。

### 2.3 生产构建（release dist）复核

| 视口 | rebuild | paint | CSS | 后备缓冲 | 比值 | syncAlpha |
|---|---|---|---|---|---|---|
| 1280×800 | 140.6ms | 145.4ms | 1066.7 | 1067 | 1.000 | 255 |
| 600×800 | 128.1ms | 132.5ms | 600 | 600 | 1.000 | 255 |
| 360×640 | 130.5ms | 132.5ms | 360 | 360 | 1.000 | 255 |
| 320×568 | 132.5ms | 130.8ms | 320 | 320 | 1.000 | 255 |

旋转（竖↔横）：360×640 → 640×360（CSS 480×360）→ 320×568 → 568×320（CSS 426.7×320）全部 PASS，rebuild 125.4–142.3ms、paint 124.3–141.2ms、比值 1.000–1.001。
生产页另有：`__wmgTest === undefined`（无测试钩子）、`pageerror`/`console.error` 0 条、第三方请求 0 条、HUD（分数 0 / 步数 20 / 处于对局界面）在 8 次 resize 前后完全一致。

### 2.4 DPR clamp = min(dpr,2)

| deviceScaleFactor | CSS 宽 | 后备缓冲宽 | 实测比值 | rebuild | content | paint |
|---|---|---|---|---|---|---|
| 1 | 360 | 360 | 1.000 | 124.6ms | 130.3ms | 131.7ms |
| 1.5 | 360 | 540 | 1.500 | 121.8ms | 128.2ms | 129.0ms |
| 3 | 360 | 720 | **2.000** | 121.0ms | 127.8ms | 128.3ms |

DPR=3 时按 2 倍重建（不超采样、不模糊），与 REQ-041「渲染分辨率 = min(devicePixelRatio, 2)」一致。

### 2.5 对局状态与步数不重置

先在第 1 关真实走一步有效交换（(1,2)↔(2,2)），再做 8 次 resize：

```
before: {status: playing, levelId: 1, seed: 20261111, score: 450, movesLeft: 19}
after : {status: playing, levelId: 1, seed: 20261111, score: 450, movesLeft: 19}
```

生产构建另测 HUD 文本：resize 前后均为 `score=0 / moves=20` 且仍停留对局界面。

### 2.6 连续 resize 抖动合并

| 项 | 结果 |
|---|---|
| 派发事件数 | 5 次（间隔 25ms，总跨度 100ms < debounce 120ms） |
| canvas `width` 属性变更次数 | **1**（`height` 1 次，合计 2 次属性写入 = 1 次重建） |
| 重建相对最后一次 resize 的延迟 | 132ms（一次独立运行 122.6ms），符合 120ms 防抖 + 一次同步绘制 |

### 2.7 判定

**BUG-007 = 关闭。** 依据：① 四视口 + 生产构建 + 旋转场景 resize→重绘均在 121–147ms ≤200ms；② DPR clamp 精确为 min(dpr,2)；③ 对局状态/步数/分数不重置；④ 连续 resize 仅重建 1 次；⑤ 绘制与后备缓冲重建同任务完成（syncAlpha=255，72/72 样本）。

---

## 3. 并发负载与新增 BUG-008

### 3.1 自建 16 页并发探针（64 样本/轮，两轮）

| 轮次 | 指标 | min | p50 | p90 | max | >200ms |
|---|---|---|---|---|---|---|
| A（`g9-resize-load16.txt`） | rebuild | 120.9 | 126.6 | 134.9 | 136.0 | 0/64 |
| A | content | 149.2 | 186.8 | 213.9 | 230.1 | 23/64 |
| A | paint | 148.9 | 184.1 | 213.3 | 229.7 | 21/64 |
| B（`g9-resize-final.txt`） | rebuild | 121.0 | 130.7 | 154.6 | 204.1 | 1/64 |
| B | content | 145.4 | 207.6 | 249.3 | 263.8 | 34/64 |
| B | paint | 145.7 | 212.4 | 273.3 | 293.2 | 39/64 |

8 页并发时：content ≤160.8ms、paint ≤171.4ms（全部 ≤200ms）。

### 3.2 项目自带 REQ-041 E2E 在 16 worker 全量跑中可复现失败

| 运行 | 结果 | 失败明细 |
|---|---|---|
| `npx playwright test` #1 | 45 passed / **1 failed** | `resize.spec.ts:143` frameMs：1280×800 **182.8ms**、600×800 **215.2ms**（rebind 122.8 / 130.6ms） |
| `npx playwright test` #2 | 45 passed / **1 failed** | 1280×800 **187.0ms**、600×800 **199.5ms**、360×640 **253.8ms**（rebind 131.7 / 125.5 / 122.4ms） |

两次均为同一条用例（`tests/e2e/resize.spec.ts:118 四视口 resize 后备缓冲重建与首帧重绘均不超过 200ms`），且**rebind 始终 ≤132ms**，超标的只是“首帧”指标。

### 3.3 定性

- 确定性部分（防抖 120ms + 后备缓冲重建 + 同步绘制）在 1–16 并发下实测 121–204ms，其中 16 并发仅 1/64 样本触及 204.1ms。
- 超出 200ms 的部分主要来自**浏览器帧调度/合成**延迟：16 个 Chromium 页面同时 resize 时 rAF 时间戳被整体推后（p90 227–273ms），而同一时刻画布内容已在 121–155ms 内绘制完毕。
- 结论：这是**并发环境下的帧调度抖动 + 该用例的“首帧”阈值设置过紧**，不是 debounce 逻辑回归；但“`npx playwright test` 全绿”这一交付事实不成立。

### 3.4 新增 BUG-008（低）

- ID：BUG-008　级别：**低**　关联：REQ-041（测试层面）/ TASK-036
- 现象：全量 `npx playwright test`（16 worker）下 `resize.spec.ts:118` 的“首帧 ≤200ms”断言连续 2 次失败（215.2ms、253.8ms）。
- 最小复现：`npm run build:test && npx vite preview --port 4173` 后 `npx playwright test`（并发 16）→ 观察 `resize.spec.ts:118` 失败；单跑 `npx playwright test tests/e2e/resize.spec.ts` 通过。
- 期望 vs 实际：期望 rebind 与首帧均 ≤200ms；实际 rebind 122.4–131.7ms（达标），首帧 187.0–253.8ms（超标）。
- 影响：发布门禁“E2E 全绿”无法达成；产品在单标签页/常规并发下无用户可见问题。
- 建议（不属本轮改动范围）：该断言只对 `rebind` 设 200ms 硬阈值，首帧改测 p95 或放宽到 300ms；或把 resize 用例串行执行。

---

## 4. BUG-001 ~ BUG-007 关闭判定

| BUG | 级别 | 关联 REQ | 本轮结论 | 本轮独立证据 |
|---|---|---|---|---|
| BUG-001 | Critical | REQ-040/049 | **关闭** | `.qa-verify/g9-layout.mjs`：7 组配置 × 64 格真实点击，`错格 0 / null 0`，棋盘投影 (224,96) 512×512（四视口缩放后同步缩放）；`g9-layout.txt` `SUMMARY total=64 pass=64 fail=0` |
| BUG-002 | High | REQ-016 | **关闭** | 全量 E2E `shuffle.spec.ts:13` 第 8 关 seed=1 QA 序列通过：重排发生、shuffle 事件≥1、`findMove` 非 null、可继续（`g9-playwright.txt` ok 16，17.6s） |
| BUG-003 | Low | §10.2 / REQ-051 | **关闭** | `g9-decode.txt`：MP3 14/14 |err|≤24ms（最大 12.0ms）、OGG 14/14（最大 2.7ms）、14/14 为 48kHz 单声道、音频合计 1878.1KiB ≤2048KiB |
| BUG-004 | Low | REQ-045/048 | **关闭** | `g9-targeted-vitest.txt`（audio 7 条：13 事件映射、100ms 节流、首手势/可见性、解码失败、音量边界）+ 全量 E2E `audio-live.spec.ts` 2 条通过 |
| BUG-005 | Medium | REQ-003/004 | **关闭** | `g9-ab.txt` 38/38：四视口 ×（A1 棋盘外 / A2 石块 / A3 死格 / 同格 / 非相邻 / 相邻无匹配），全部基于 `AudioBufferSourceNode.start` 实际播放事件 |
| BUG-006 | Low | REQ-004/046 | **关闭** | 同上：2 个负控（应触发场景断言“0 次”必须失败、不应触发场景断言“≥1 次”必须失败）在 1280×800 与 320×568 均按预期失败→证明断言非空转；B 类回弹两视口逐像素均值差 <1 |
| BUG-007 | Low | REQ-041 | **关闭** | 见 §2：四视口/生产构建/旋转 121–147ms、DPR clamp、状态不重置、抖动合并 1 次 |

---

## 5. 全量回归抽查

| 命令 | 结果 | 证据 |
|---|---|---|
| `npm run typecheck` | PASS（exit 0） | `g9-typecheck.txt` |
| `npm test` | **PASS：34 files / 223 tests** | `g9-npm-test.txt` |
| `npm run build` | PASS（`dist/index-*.js` 153.46kB / gzip 69.86kB） | `g9-build.txt`、`g9-build-release.txt` |
| `npx playwright test` | **45 passed / 1 failed**（见 §3.2） | `g9-playwright.txt`（run1）、`g9-playwright-run2.txt`（run2） |
| 定向 verbose 单测（storage/leaderboard/save-service/levels/goals/resolve/audio） | PASS：7 files / **57 tests** | `g9-targeted-vitest.txt` |
| 生产 dist 可运行 + resize/旋转 | PASS（无 pageerror、无第三方请求、无测试钩子） | `g9-prod-resize.txt`、`g9-prod-rotate.txt` |

### 5.1 四项“不得回归”抽查

| 项 | 本轮结果 | 证据 |
|---|---|---|
| BUG-001 四视口 64 格 0 偏差 | **PASS**：960×720 / 1280×800 / 600×800 / 360×640 / 320×568 / 1280×800@dpr2 / 360×640@dpr2 全部错格 0、null 0 | `g9-layout.txt` |
| BUG-002 seed=1 重排 | **PASS**：全量 E2E `shuffle.spec.ts:13` 通过（两次全量跑均 ok） | `g9-playwright*.txt` |
| BUG-003 decodeAudioData 14/14 | **PASS**：MP3/OGG 各 14/14 | `g9-decode.txt` |
| BUG-005 四类落点 invalid 计数 | **PASS**：四视口 × 6 场景 + 边界 2 例 + 负控 4 例 + 回弹 2 例 = 38/38 | `g9-ab.txt` |

---

## 6. 51 条 REQ 矩阵（spec v1.1.4）

证据代码：**U**=`npm test` 223 条；**T**=定向 verbose 单测 57 条；**E**=全量 E2E（45 通过）；**L**=`g9-layout.txt`；**AB**=`g9-ab.txt`（38 条）；**D**=`g9-decode.txt`；**P**=生产 dist 探针（`g9-prod-*.txt`）；**R**=`g9-resize*.txt`；**TR**=`g9-trace.txt`。

| REQ | TASK | 用例 / 证据 | 结论 |
|---|---|---|---|
| REQ-001 | TASK-002/006 | `generate.spec` 200 seeds、64 格、无初始三连、至少 1 步 | PASS (U) |
| REQ-002 | TASK-002/005 | `rng/purity.spec` 同 seed 深比较、core 无 Math.random/Date.now | PASS (U) |
| REQ-003 | TASK-008/027 | `input.spec`/`swap.spec`/`input-a11y` + AB 边界 8 例（0.4 格跨格=点击、落回=取消） | PASS (U,E,AB) |
| REQ-004 | TASK-008/027 | AB 四视口 ×（A1/A2/A3/同格/非相邻/相邻无匹配）实际播放事件 | PASS (AB) |
| REQ-005 | TASK-008 | `swap.spec` 有效三连交换保留 | PASS (U) |
| REQ-006 | TASK-008 | `swap.spec` 回弹；AB revert 逐像素复原（均值差<1） | PASS (U,AB) |
| REQ-007 | TASK-007 | `match.spec` 横/竖/L/T 并集、冰块可匹配、石块/死格不匹配 | PASS (U) |
| REQ-008 | TASK-012 | `gravity.spec` 下落/补充、石块/死格阻挡、列高一致 | PASS (U) |
| REQ-009 | TASK-009/013 | `resolve.spec` 连锁 1.5× 第二链、c=1..8 倍率 | PASS (T) |
| REQ-010 | TASK-010 | `special-generate.spec` 横/竖 4 连、双 4 连 | PASS (U) |
| REQ-011 | TASK-010 | `special-generate.spec` ≥5 连生成恰好 1 个彩虹 | PASS (U) |
| REQ-012 | TASK-011 | `special-trigger.spec` 整行/列、同色、被波及彩虹 | PASS (U) |
| REQ-013 | TASK-011 | `special-trigger`/`resolve` 彩虹+彩虹清 64 格、3840 分 | PASS (T) |
| REQ-014 | TASK-002/009 | `score.spec` 180/435 基准、整数/NaN | PASS (U) |
| REQ-015 | TASK-013 | `resolve.spec` 仅有效交换扣 1 步、拒绝不扣步 | PASS (T) |
| REQ-016 | TASK-015 | `shuffle.spec` + E2E seed=1 重排、不扣步、shuffle 提示 | PASS (U,E) |
| REQ-017 | TASK-014/021 | `state-machine.spec` 六状态、非法转移抛错、settling 锁输入 | PASS (U) |
| REQ-018 | TASK-013/014 | `resolve.spec` 目标达成即胜 / 步数 0 判负 / 继续 playing | PASS (T) |
| REQ-019 | TASK-017/030/035 | `core-flow` 重开二次确认、新种子、归零、不写榜 | PASS (E) |
| REQ-020 | TASK-017/030/035 | `core-flow`/`settlement-strict` 中途返回不写分/不写榜 | PASS (E) |
| REQ-021 | TASK-003/029 | `levels.spec` 8 关 ID/步数 20/22/24/24/26/26/28/30；`level-select` 锁定与解锁 | PASS (T,E) |
| REQ-022 | TASK-003/013/016 | `goals.spec` 三类目标 AND、目标元素在 tileKinds | PASS (T) |
| REQ-023 | TASK-012/016 | `resolve`/`goals` 冰层 -1、计入目标、不阻挡下落 | PASS (T) |
| REQ-024 | TASK-012/016 | `resolve`/`gravity` 石块 2 层、邻格消除、破坏后补充 | PASS (T) |
| REQ-025 | TASK-003/006 | `levels.spec` 第 8 关 4 死格坐标；`generate` 死格不可清除 | PASS (T,U) |
| REQ-026 | TASK-016/029 | `goals.spec` 星级 阈值-1/阈值/+1、历史最高星 | PASS (T) |
| REQ-027 | TASK-002/003 | `levels.spec` D 序列逐项匹配 spec、严格递增、增幅≤0.35 | PASS (T) |
| REQ-028 | TASK-030/035 | `settlement-strict` 面板字段/300ms 输入锁；`hud.spec` | PASS (E,U) |
| REQ-029 | TASK-024 | `storage.spec` 8 条记录、saveVersion=1、字段默认值 | PASS (T) |
| REQ-030 | TASK-025/034/035 | `save-service`/`persistence` 四处写入、true/false、刷新提示一次 | PASS (T,E) |
| REQ-031 | TASK-024 | `storage.spec` 6 类损坏各自备份+默认 + lastSessionInterrupted 缺失不判损坏 | PASS (T) |
| REQ-032 | TASK-024 | `storage.spec` QuotaExceeded → 内存降级 temporary=true | PASS (T) |
| REQ-033 | TASK-025/031/035 | `settings.spec` 重置回第 1 关、8 条记录归零、清榜 | PASS (T,E) |
| REQ-034 | TASK-026/032/036/037 | 「本地排行榜」文案 + 禁用词 0 + 第三方请求 0 | PASS (E) |
| REQ-035 | TASK-026 | `leaderboard.spec` 字段、胜利单条写、非法记录拒写、幂等 | PASS (T) |
| REQ-036 | TASK-026/032 | `leaderboard.spec` score↓→moves↑→achievedAt↑→id↑ | PASS (T) |
| REQ-037 | TASK-026/032 | `leaderboard.spec` 单关 10 / 全局 20、淘汰末位 | PASS (T) |
| REQ-038 | TASK-026/031/032 | `leaderboard`/`settings` 二次确认含「不可恢复」、清空只删榜键 | PASS (T,E) |
| REQ-039 | TASK-004/019/020/038/041 | 6×64×64 贴图、灰度最小差 26.8/255（机器部分）；**3 人签署缺失** | **BLOCKED**（`g9-assets-check.txt`、`g9-tile-gray.txt`、`tasks.md:858`） |
| REQ-040 | TASK-004/018/020/023/039/041 | `layout`/`scene` (224,96) 512×512、缩放后投影同步、误差 ≤1px | PASS (U,L) |
| REQ-041 | TASK-018/036 | 四视口+旋转+生产构建 resize→重绘 121–147ms、DPR=min(dpr,2)、状态不重置、抖动 1 次重建；**并发下首帧见 BUG-008** | PASS（附 BUG-008 注） (R,P,E) |
| REQ-042 | TASK-019/038/041 | `assets.spec` 404 → 占位 + warn 仅 1 次；无 URL 不抛错 | PASS (U) |
| REQ-043 | TASK-020/031/036 | `draw-calls.spec` 六符号仅开启时叠加；`settings` 持久化 | PASS (U,E) |
| REQ-044 | TASK-002/021/023/037 | 六类动画 150/200/180/160/300/200ms；reduced ≤100ms 且无位移 | PASS (U,E) |
| REQ-045 | TASK-033/036/040 | 首手势后 BGM、hidden 暂停/续播、接缝 ≤20ms | PASS (T,E) |
| REQ-046 | TASK-033/040 | 13 事件映射、每次 1 次、100ms 节流；B 类 invalid 恰 1 次 | PASS (T,AB) |
| REQ-047 | TASK-031/033/036 | BGM/SFX 独立、0..100、默认 60/80、刷新保持 | PASS (T,E) |
| REQ-048 | TASK-033/040 | 加载/解码失败静默降级 + 「音频不可用」 | PASS (T,E) |
| REQ-049 | TASK-018/027/036 | 四视口最近邻吸附 64/64、600 断点、A 类静默、0.4 格=点击 | PASS (L,AB) |
| REQ-050 | TASK-028/036 | aria-live 文本格式、同秒 ≤1 次；A 类/非相邻不变 | PASS (U,AB) |
| REQ-051 | TASK-001/022/023/034/037/041 | p95 帧间隔 ≤20ms、dist 静态可运行、第三方请求 0、gzip 69.86kB | PASS (E,P) |

**矩阵统计：PASS 50 / FAIL 0 / BLOCKED 1，共 51 条。**

---

## 7. 追溯完整性

- REQ → TASK：`g7-taskmap.py` 展开后 **51/51 条 REQ 均有 ≥1 个 TASK**（`g9-g8-matrix.txt` 的第 2 列本轮复核一致）。
- REQ → 测试：`g9-trace.py`（支持 `REQ-009/015/018` 合并写法）→ **`MISSING: []`**，51/51 条 REQ 在 `tests/` 中可检索到对应编号；无“有 REQ 无测试”的缺口（`g9-trace.txt`）。
- spec 版本：本轮 `specs/001-core-game/spec.md` 与 G8 基线拷贝逐字一致（`same_text=True`，34864 字符），未发生规格漂移。

---

## 8. 缺陷清单（累计）

| BUG | 级别 | 关联 REQ | 状态 | 摘要 |
|---|---|---|---|---|
| BUG-001 | Critical | REQ-040/049 | **关闭** | 画布双重留边偏移；64/64 格 0 偏差 |
| BUG-002 | High | REQ-016 | **关闭** | 死局不重排；seed=1 复现序列通过 |
| BUG-003 | Low | §10.2/REQ-051 | **关闭** | MP3 时长超差；decodeAudioData 14/14 ≤24ms |
| BUG-004 | Low | REQ-045/048 | **关闭** | 缺运行时用例；现有用例 + 实测有效 |
| BUG-005 | Medium | REQ-003/004 | **关闭** | 同格/非相邻误播 invalid；v1.1.4 口径四视口全部达标 |
| BUG-006 | Low | REQ-004/046 | **关闭** | invalid 断言空转；负控双向灵敏 |
| BUG-007 | Low | REQ-041 | **关闭** | debounce 用满预算；现 121–147ms |
| **BUG-008** | **Low** | **REQ-041（测试）** | **未关闭（本轮新增）** | **16 worker 全量 E2E 下 resize “首帧”指标 215.2/253.8ms，2/2 次失败；单跑通过** |

---

## 9. REQ-039 阻塞说明（不得默认 PASS）

- 机器可验证部分（本轮复验）：`assets/tile-*.webp` 6 个均为 **64×64**；灰度两两平均差最小 **26.8/255**（`g9-assets-check.txt`、`g9-tile-gray.txt`）；`assets.spec` 校验 6 种贴图存在、可加载、占位形状 6 种。
- 规格要求「转灰度后 6 种仍可两两区分（**人工评审 3 人一致通过**）」；`specs/001-core-game/tasks.md:858` 仍为 `- [ ] 灰度评审 3 人签字/记录`，`docs/` 与 `specs/` 内无签署记录。
- 结论：**BLOCKED（人工项）**；必须补 3 人灰度评审签字后才能转 PASS，机器灰度差不能替代人工评审。

---

## 10. 证据索引（`.qa-verify/out/`）

- 回归：`g9-typecheck.txt`、`g9-npm-test.txt`、`g9-build.txt`、`g9-build-test.txt`、`g9-build-release.txt`、`g9-playwright.txt`、`g9-playwright-run2.txt`、`g9-targeted-vitest.txt`
- REQ-041/BUG-007：`g9-resize.txt`、`g9-resize-load16.txt`、`g9-resize-final.txt`、`g9-prod-resize.txt`、`g9-prod-rotate.txt`
- 抽查：`g9-layout.txt`（BUG-001）、`g9-ab.txt`（BUG-005/006）、`g9-decode.txt`（BUG-003）
- 追溯与资源：`g9-trace.txt`、`g9-g8-matrix.txt`、`g9-assets-check.txt`、`g9-tile-gray.txt`
- 探针源码：`.qa-verify/g9-resize.mjs`、`.qa-verify/g9-prod-resize.mjs`、`.qa-verify/g9-prod-rotate.mjs`、`.qa-verify/g9-layout.mjs`、`.qa-verify/g9-trace.py`、`.qa-verify/g9-stats.py`、`.qa-verify/playwright.g9.config.ts`

