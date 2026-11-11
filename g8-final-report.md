# G8 最终复核报告（spec v1.1.4）

- 验收角色：qa-verifier（独立验收；本轮未修改产品代码 / spec / plan / tasks / tests / assets）
- 验收基线：`specs/001-core-game/spec.md` **v1.1.4**（CR-010 已发布，51 条 REQ）
- 验收时间：2026-11-11
- 证据目录：`.qa-verify/out/`（本轮 `g8-*` 前缀）
- 判定口径：只依据 spec v1.1.4 正文；不采信实现方 / Manager 既有结论；音效类断言一律基于页内 `AudioBufferSourceNode.prototype.start` 实际播放事件

## 0. 总结论

**存在缺陷（1 个，低：BUG-007）＋ 1 项人工阻塞（REQ-039）。**

| 项目 | 结果 |
|---|---|
| 51 条 REQ | **PASS 49 / FAIL 1 / BLOCKED 1** |
| FAIL 的 REQ | **REQ-041（窗口缩放后重绘完成时间 204.4–212.4ms，超过 200ms 预算）** |
| BLOCKED 的 REQ | **REQ-039（缺 3 人灰度人工评审签署；`tasks.md:858` 该 DoD 仍未勾选）** |
| BUG-001 / 002 / 003 / 004 | **全部关闭** |
| BUG-005 / BUG-006 | **全部关闭** |
| 新增缺陷 | **BUG-007（低，REQ-041 重绘超时 4.4–12.4ms）** |
| 发布建议 | 不满足“全部 PASS”：需处理 BUG-007（或由规格方明确接受 ≤212ms 的容差），并完成 REQ-039 的 3 人灰度评审签署 |

> 说明：`npm test` 222/222、`npx playwright test` 43/43、G8 独立用例 38/38 全绿，但 REQ-041 的 200ms 阈值由独立计时探针实测不达标（见 §3），因此不能按“测试全绿”判 PASS。

---

## 1. 复核方法（本轮独立实现，不复用实现方结论）

| 维度 | 方法 | 证据 |
|---|---|---|
| 音效实际播放 | 自建探针 `.qa-verify/g8-probe.ts`：包装 `fetch → arrayBuffer`、`decodeAudioData`（AudioBuffer 与 URL 关联）、`AudioBufferSourceNode.start`，按 URL 归类 invalid/swap，并统计无法映射 URL 的播放事件 | `out/g8-ab.txt` |
| 命中与坐标 | 用 canvas 2D 绘制变换 `getTransform()` 反推视觉格中心/边界，不复用输入层 `screenToLogical` | `out/g8-layout-regression.txt`、`out/g8-ab.txt` |
| 回弹 | ① `animations()` 中 revert 时长；② 交换前后棋盘区域逐像素均值差；③ 回弹后 `findMove()` 仍非空 | `out/g8-ab.txt`（2 条像素用例） |
| 音频时长 | Chrome `OfflineAudioContext.decodeAudioData`（与运行时同一解码器族），不用容器帧数推算 | `out/g8-decode-durations.txt` |
| 构建可运行 | 生产构建 `dist/` + `vite preview`，真实指针输入、刷新、缩放、第三方请求计数 | `out/g8-prod.txt`、`out/g8-fallback.txt`、`out/g8-audio-prod.txt` |
| 追溯 | 解析 spec / tasks.md / tests 的 REQ 编号（支持 `REQ-022/023/024/026` 组合写法展开） | `out/g8-trace.txt` |

---

## 2. BUG-001 ~ BUG-006 关闭判定

### 2.1 BUG-001（Critical，画布双重留边偏移）—— **关闭**

- 独立方法：从绘制变换反推 64 个格中心并真实点击，7 组配置（960×720、1280×800、600×800、360×640、320×568、1280×800@dpr2、360×640@dpr2）。
- 结果：`SUMMARY total=64 pass=64 fail=0`；四验收视口 all64 均 **错格 0 / null 0**；棋盘投影矩形与 `(224,96) 512×512` 完全一致；死格(3,3)、石块(2,3) 点击返回 null。
- 结论：**关闭**。证据：`out/g8-layout-regression.txt`。

### 2.2 BUG-002（High，死局不重排）—— **关闭**

- `tests/e2e/shuffle.spec.ts:13`（第 8 关 seed=1 QA 复现序列）本轮全量 E2E 实测通过：重排发生、shuffle 事件 ≥1、`findMove` 非 null、对局可继续。
- 结论：**关闭**。证据：`out/g8-playwright.txt`（ok 9）。

### 2.3 BUG-003（Low，MP3 时长与 spec 10.2 不符）—— **关闭**

- 14/14 MP3 解码时长 |误差| ≤ 24ms（最大 12ms）；14/14 OGG |误差| ≤ 2.7ms；全部 48kHz 单声道；音频合计 1,878.1KiB ≤ 2048KiB。
- 结论：**关闭**。证据：`out/g8-decode-durations.txt`。

### 2.4 BUG-004（Low，REQ-045/REQ-048 无用例）—— **关闭**

- 单测：`tests/systems/audio.spec.ts` 7 条（13 事件映射、100ms 节流、首手势/可见性、解码失败、音量边界）本轮 verbose 复跑通过。
- E2E：`audio-live.spec.ts` 2 条通过（首手势后 BGM 播放 + hidden 暂停/visible 续播；音频失败静默降级 + 「音频不可用」）。
- 生产构建独立复核：首手势前 BGM 请求 0、首手势后 ≥1；阻断全部 `.ogg/.mp3` 后徽标显示「音频不可用」、无弹窗、无 pageerror、仍可完成有效交换（步数 20→19）。
- 结论：**关闭**。证据：`out/g8-targeted-vitest.txt`、`out/g8-playwright.txt`（ok 2/26）、`out/g8-audio-prod.txt`。

### 2.5 BUG-005（Medium，B 类「同格 / 非相邻」未播 invalid）—— **关闭**

按 spec v1.1.4 / CR-010 四类落点，四视口各测一遍（`.qa-verify/g8-ab.spec.ts`，断言均为实际播放事件）：

| 视口 | A1 棋盘外 | A2 石块 | A3 死格 | 同格（取消选中） | 非相邻（选中转移） | 相邻无匹配（B 类） |
|---|---|---|---|---|---|---|
| 1280×800 | PASS | PASS | PASS | PASS | PASS | PASS |
| 600×800 | PASS | PASS | PASS | PASS | PASS | PASS |
| 360×640 | PASS | PASS | PASS | PASS | PASS | PASS |
| 320×568 | PASS | PASS | PASS | PASS | PASS | PASS |

- A 类三类：选中态、moves、score、`#game-live` 均不变；invalid 播放 0、swap 播放 0。
- 同格：选中清空（取消选中），invalid 0、swap 0，moves/score 不变。
- 非相邻：选中转移至 (1,8)，invalid 0、swap 0，moves/score 不变，aria 播报不变。
- B 类（相邻无匹配）：invalid 实际播放 **恰好 1 次**（poll 到 1 后再等 700ms 复核仍为 1），invalid 请求 ≥1；选中清空；moves/score 不变；`animations()` 记录 `revert` **200ms**；`findMove()` 仍非空（可继续）；交换前后棋盘区域逐像素平均差 < 1（1280 与 320 各测一次）。
- 结论：**关闭**。证据：`out/g8-ab.txt`（38 passed，含像素回弹用例）。

### 2.6 BUG-006（Low，invalid 断言空转）—— **关闭**

- 静态：`tests/e2e` 17 个文件 1,147 行非注释代码中，旧空转正则 `sfx-invalid\.(ogg|mp3)` 出现 **0 次**（唯一命中在 `sfx-probe.ts` 注释里说明历史问题）；构建产物 `sfx-invalid-BqsWogSh.ogg` 对旧正则 false、对新正则 true；`sfx-probe.ts` 同时包装 fetch/decodeAudioData/start，探针失效会抛错；`outside-board.spec.ts`、`invalid-sfx.spec.ts` 均接入探针与灵敏度自检。
- 动态负控（1280×800 与 320×568 各一組）：
  - 负控 1：真跑 B 类 → `invalidStarts = 1`，此时断言 `toBe(0)` **按预期抛错**（证明「0 次」断言有灵敏度）。
  - 负控 2：仅 A 类棋盘外点击 → `invalidStarts = 0`，此时断言 `toBeGreaterThanOrEqual(1)` **按预期抛错**（证明「≥1 次」断言不会无条件通过）。
- 结论：**关闭**。证据：`out/g8-sfx-assert-scan.txt`、`out/g8-ab.txt`（负控 4 条 ok）。

---

## 3. 新增缺陷：BUG-007（Low，REQ-041 重绘超时）

- 关联 REQ：**REQ-041**（“窗口缩放、旋转或 DPR 变化后 200ms 内完成重绘，元素不模糊”）。
- 最小复现：
  1. `npm run build` 后 `vite preview`（5057）打开 960×720。
  2. 页内记录 `resize` 事件时间，并每 2ms 轮询 `canvas.width` 到位时间，随后用 `requestAnimationFrame` 记录首帧时间。
  3. `setViewportSize(360×640)`（另测 600×800、320×568）。
- 期望值：canvas 后备缓冲重建与首帧绘制均 ≤ 200ms。
- 实际值：后备缓冲到位 **204.4–208.5ms（轮询，1280/600/360/320 四视口）**，MutationObserver 口径为 200.8–200.9ms；首帧 **207.5–212.4ms**（MutationObserver 口径 204.0–204.2ms）。四视口全部 > 200ms。
- 根因（只读定位，未改）：`src/systems/main.ts:119` 的 resize 监听使用 200ms `setTimeout`；`src/render/canvas-host.ts` 的 `debounceMs` 默认 200ms。200ms 防抖本身即用尽预算，重绘最早只能从 200ms 开始，必然无法“200ms 内完成”。
- 影响：缩放期间画布按旧后备缓冲拉伸约 200–212ms，元素短暂模糊；对局状态与步数不重置（该子项 PASS）。
- 证据：`out/g8-resize-mutation.txt`（delta 200.9ms）、`out/g8-resize-precise.txt`（dAttr 204.4–208.5ms，dPaint 207.5–212.4ms）。
- 建议：把防抖降到 ≤150ms，或在 resize 时立即 `applyViewport()`（尺寸计算为轻量操作），仅对重绘做合并；修复后需复测到 ≤200ms。

---

## 4. 全量与关键链路

| 检查 | 结果 | 证据 |
|---|---|---|
| `npm run typecheck` | PASS（exit 0） | `out/g8-typecheck.txt` |
| `npm test` | PASS：34 files / **222 tests** | `out/g8-npm-test.txt` |
| `npm run build` | PASS：127 modules；JS 153.45kB / gzip 69.86kB | `out/g8-build.txt` |
| `npx playwright test` | PASS：**43 tests** | `out/g8-playwright.txt` |
| G8 独立用例（A/B + 边界 + 负控 + 像素回弹） | PASS：**38/38** | `out/g8-ab.txt` |
| BUG-001 四视口 64 格 | PASS：64/64，错格 0/null 0（7 组配置） | `out/g8-layout-regression.txt` |
| BUG-002 seed=1 重排 | PASS（ok 9） | `out/g8-playwright.txt` |
| BUG-003 decodeAudioData | PASS：14/14 MP3，14/14 OGG，48k mono，1,878.1KiB | `out/g8-decode-durations.txt` |
| REQ-045/048 用例有效性 + 生产实测 | PASS（单测 7 + E2E 2 + 生产 7/7） | `out/g8-targeted-vitest.txt`、`out/g8-audio-prod.txt` |
| 通关写榜 | PASS：seed=1 全胜 2790 分 / 3★ / movesUsed=6 / seed=1；榜单 1 条；`unlockedLevelId=2` | `out/g8-playwright.txt`（ok 13） |
| 6 类损坏存档 | PASS：JSON 解析失败 / 必填缺失 / 类型错误 / 版本不匹配 / 数值越界 / 日期非法，各自备份 + 默认存档 + recovered=true | `out/g8-targeted-vitest.txt` |
| 刷新中断提示一次 | PASS：首次刷新提示「上一局已中断」并写 false；二次刷新无提示 | `out/g8-playwright.txt`（ok 23） |
| 零第三方请求 | PASS：10s 对局 external=0；生产冒烟 external=0 | `out/g8-perf.txt`、`out/g8-prod.txt` |
| 10s p95 | PASS：samples=600，p95=4.3ms，lowFpsRatio=0 | `out/g8-perf.txt` |
| 首屏 gzip | PASS：非音频 dist 111.6KiB ≤ 3.0MB | `out/g8-gzip.txt` |
| 图片资源 | PASS：33 文件，77.4KB；首屏 71.9KB | `out/g8-assets-check.txt`（图片段） |
| 生产构建静态直跑 | PASS：14/14（8 关卡、真实指针有效交换、缩放、刷新、存档 ×1、0 外部请求、0 console error） | `out/g8-prod.txt` |
| 图片缺失降级 | PASS：6/6（warn 恰好 1 次、无弹窗、64/64 格可识别、仍可有效交换） | `out/g8-fallback.txt` |
| 禁用词 | PASS：dist JS/HTML/CSS 0 命中；「本地排行榜」等文案存在 | `out/g8-banned.txt` |
| 追溯完整性 | PASS：51 REQ / 41 TASK / 0 缺失（组合编号已展开） | `out/g8-trace.txt` |

> 注：`.qa-verify/assets_check.py` 的 MP3 段仍按容器帧数推算，会产生 11 个假 FAIL；本报告不采用该段，MP3 时长只采用 `decodeAudioData` 口径（同 BUG-003 裁决）。

---

## 5. 51 条 REQ 验收矩阵

> 追溯：51/51 REQ 在 `tasks.md` 有 TASK 映射，51/51 REQ 在 `tests/**` 有含编号用例（`REQ-022/023/024/026` 这类组合标题已展开）；41 个 TASK 连续，无孤儿任务。证据缩写：`T`=`out/g8-targeted-vitest.txt`，`E`=`out/g8-playwright.txt`，`U`=`out/g8-npm-test.txt`，`A`=`out/g8-ab.txt`。

| REQ-ID | 用例 / 测试 | TASK | 结论 | 证据 |
|---|---|---|---|---|
| REQ-001 | `generate.spec` 200 seeds、64 格、无初始三连、至少 1 步、1000 次失败提示 | TASK-002/006 | PASS | U |
| REQ-002 | `rng/purity.spec` 同 seed 深比较；core 无 Math.random/Date.now | TASK-002/005 | PASS | U |
| REQ-003 | `input.spec`/`swap.spec`/`input-a11y` + G8 边界 8 例（0.4 格跨格=点击、落回=取消） | TASK-008/027 | PASS | U, E, A |
| REQ-004 | G8 四视口 × A 三类/同格/非相邻/相邻无匹配（实际播放事件） | TASK-008/027 | PASS | A |
| REQ-005 | `swap.spec` 有效三连交换保留 | TASK-008 | PASS | U |
| REQ-006 | `swap.spec` 回弹；G8 revert=200ms + 像素逐点复原 | TASK-008 | PASS | U, A |
| REQ-007 | `match.spec` 横/竖/L/T 并集、冰块可匹配、石块/死格不匹配 | TASK-007 | PASS | U |
| REQ-008 | `gravity.spec` 下落/补充、石块/死格阻挡 | TASK-012 | PASS | U |
| REQ-009 | `resolve.spec` c=1..8 倍率与连锁 | TASK-009/013 | PASS | T |
| REQ-010 | `special-generate.spec` 横/竖 4 连、双 4 连 | TASK-010 | PASS | U |
| REQ-011 | `special-generate.spec` ≥5 连生成 1 个彩虹 | TASK-010 | PASS | U |
| REQ-012 | `special-trigger.spec` 整行/列、同色、被波及彩虹 | TASK-011 | PASS | U |
| REQ-013 | `special-trigger`/`resolve` 彩虹+彩虹清 64 格、3840 分 | TASK-011 | PASS | T |
| REQ-014 | `score.spec` 180/435、整数/NaN | TASK-002/009 | PASS | U |
| REQ-015 | `resolve.spec` 仅有效交换扣 1 步、拒绝不扣步 | TASK-013 | PASS | T |
| REQ-016 | `shuffle.spec` + E2E seed=1 重排、不扣步、shuffle 提示 | TASK-015 | PASS | U, E |
| REQ-017 | `state-machine.spec` 六状态、非法转移抛错、settling 锁输入 | TASK-014/021 | PASS | U |
| REQ-018 | `resolve.spec` 目标达成即胜/步数 0 判负/继续 playing | TASK-013/014 | PASS | T |
| REQ-019 | `core-flow` 重开二次确认、新种子、归零、不写榜 | TASK-017/030/035 | PASS | E |
| REQ-020 | `core-flow`/`settlement-strict` 中途返回不写分/榜 | TASK-017/030/035 | PASS | E |
| REQ-021 | `levels.spec` 8 关/步数；`level-select` 锁定与解锁 | TASK-003/029 | PASS | T, E |
| REQ-022 | `goals.spec` 三类目标 AND | TASK-003/013/016 | PASS | T |
| REQ-023 | `goals`/`gravity` 冰层 -1、计入目标、不阻挡 | TASK-012/016 | PASS | T |
| REQ-024 | `goals`/`gravity` 石块 2 层、邻格消除、破坏后补充 | TASK-012/016 | PASS | T |
| REQ-025 | `levels.spec` 第 8 关 4 死格坐标；`generate` 不可清除 | TASK-003/006 | PASS | T, U |
| REQ-026 | `goals.spec` 星级 -1/阈值/+1、历史最高星 | TASK-016/029 | PASS | T |
| REQ-027 | `levels.spec` D 序列 0.750→1.833、严格递增、增幅≤0.35 | TASK-002/003 | PASS | T |
| REQ-028 | `settlement-strict` 面板字段/300ms 锁；`hud.spec` | TASK-030/035 | PASS | E, U |
| REQ-029 | `storage.spec` 8 条记录、saveVersion=1、字段默认值 | TASK-024 | PASS | T |
| REQ-030 | `save-service`/`persistence` 四处写入、true/false、刷新提示一次 | TASK-025/034/035 | PASS | T, E |
| REQ-031 | `storage.spec` 6 类损坏各自备份+默认；E2E 可进第 1 关 | TASK-024 | PASS | T, E |
| REQ-032 | `storage.spec` QuotaExceeded → 内存降级 temporary=true | TASK-024 | PASS | T |
| REQ-033 | `settings.spec` 重置进度回第 1 关并清榜 | TASK-025/031/035 | PASS | E |
| REQ-034 | 「本地排行榜」文案 + 禁用词 0 + 第三方请求 0 | TASK-026/032/036/037 | PASS | E, `g8-banned.txt` |
| REQ-035 | `leaderboard.spec` 字段、胜利单条、失败不写、幂等 | TASK-026 | PASS | T, E |
| REQ-036 | `leaderboard.spec` score↓→moves↑→achievedAt↑→id↑ | TASK-026/032 | PASS | T |
| REQ-037 | `leaderboard.spec` 单关 10 / 全局 20、淘汰末位 | TASK-026/032 | PASS | T |
| REQ-038 | `leaderboard`/`settings` 二次确认含「不可恢复」、清空提示 | TASK-026/031/032 | PASS | T, E |
| REQ-039 | 6×64×64 贴图、灰度最小差 26.8/255；**3 人签署缺失** | TASK-004/019/020/038/041 | **BLOCKED** | `g8-assets-check.txt`、`g8-tile-gray.txt`、`tasks.md:858` |
| REQ-040 | `layout`/`scene` (224,96) 512×512、对齐≤1px | TASK-004/018/020/023/039/041 | PASS | `g8-layout-regression.txt` |
| REQ-041 | 四视口 + DPR2 尺寸正确、状态不重置；**重绘 204.4–212.4ms** | TASK-018/036 | **FAIL** | `g8-resize-mutation.txt`、`g8-resize-precise.txt` |
| REQ-042 | `assets.spec` + 生产构建拦截 WebP：占位、warn 1 次、可玩 | TASK-019/038/041 | PASS | U, `g8-fallback.txt` |
| REQ-043 | `draw-calls.spec` 六种符号仅开启时叠加；`persistence` 持久化 | TASK-020/031/036 | PASS | U, E |
| REQ-044 | 六类动画 150/200/180/160/300/200ms；reduced ≤100ms | TASK-002/021/023/037 | PASS | U, E |
| REQ-045 | 首手势后 BGM、hidden 暂停/续播、接缝≤20ms | TASK-033/036/040 | PASS | T, E, `g8-audio-prod.txt` |
| REQ-046 | 13 事件映射、每次 1 次、100ms 节流；B 类 invalid 恰好 1 | TASK-033/040 | PASS | T, A |
| REQ-047 | BGM/SFX 独立、0..100、默认 60/80、刷新保持 | TASK-031/033/036 | PASS | T, E |
| REQ-048 | 加载/解码失败静默降级 + 「音频不可用」 | TASK-033/040 | PASS | T, E, `g8-audio-prod.txt` |
| REQ-049 | 四视口最近邻吸附 64/64、600 断点、A 类静默、0.4 格=点击 | TASK-018/027/036 | PASS | `g8-layout-regression.txt`、A |
| REQ-050 | aria-live 文本格式、同秒≤1 次；A 类/非相邻不变 | TASK-028/036 | PASS | U, A |
| REQ-051 | p95=4.3ms、lowFps=0、dist 静态可运行、第三方 0、gzip 111.6KiB | TASK-001/022/023/034/037/041 | PASS | `g8-perf.txt`、`g8-prod.txt`、`g8-gzip.txt` |

**矩阵统计：PASS 49 / FAIL 1 / BLOCKED 1，共 51 条。**

---

## 6. 缺陷清单（累计状态）

| BUG | 级别 | 关联 REQ | 状态 | 摘要 |
|---|---|---|---|---|
| BUG-001 | Critical | REQ-040/049 | **关闭** | 画布双重留边偏移；64/64 格 0 偏差 |
| BUG-002 | High | REQ-016 | **关闭** | 死局不重排；seed=1 复现序列通过 |
| BUG-003 | Low | §10.2 / REQ-051 | **关闭** | MP3 时长超差；decodeAudioData 14/14 ≤24ms |
| BUG-004 | Low | REQ-045/048 | **关闭** | 缺运行时用例；现有用例 + 生产实测有效 |
| BUG-005 | Medium | REQ-003/004 | **关闭** | 同格/非相邻误播 invalid；v1.1.4 口径四视口全部达标 |
| BUG-006 | Low | REQ-004/046 | **关闭** | invalid 断言空转；静态扫描 0 残留 + 双向负控 |
| **BUG-007** | **Low** | **REQ-041** | **新增/未关闭** | **resize 后重绘 204.4–212.4ms > 200ms** |

---

## 7. REQ-039 阻塞说明（不得默认 PASS）

- 机器可验证部分 PASS：`assets/` 中 6 个 `tile-*.webp` 均为 64×64；灰度两两平均差最小 26.8/255（`g8-tile-gray.txt`）；`assets.spec` 校验 6 种贴图存在且可加载。
- 规格明确要求“人工评审 3 人一致通过”；工作区 `docs/`、`specs/` 内检索“签署/签字/评审人”仅命中任务描述，`specs/001-core-game/tasks.md:858` 仍为未勾选项 `- [ ] 灰度评审 3 人签字/记录`。
- 结论：**BLOCKED（人工项）**。要转为 PASS 必须补 3 人签署记录，不能以机器灰度差替代。

---

## 8. 证据索引（`.qa-verify/out/`）

- `g8-typecheck.txt`、`g8-npm-test.txt`、`g8-build.txt`、`g8-build-test.txt`、`g8-playwright.txt`
- `g8-ab.txt`（38 条独立用例）、`g8-ab.spec.ts`、`g8-probe.ts`、`playwright.g8.config.ts`
- `g8-layout-regression.txt`、`g8-decode-durations.txt`、`g8-perf.txt`、`g8-resize-mutation.txt`、`g8-resize-precise.txt`
- `g8-prod.txt`、`g8-fallback.txt`、`g8-audio-prod.txt`、`g8-sfx-assert-scan.txt`、`g8-targeted-vitest.txt`
- `g8-trace.txt`、`g8-gzip.txt`、`g8-assets-check.txt`、`g8-banned.txt`、`g8-tile-gray.txt`、`g8-findmove.txt`
- 截图：`g8-prod-levelselect.png`、`g8-audio-unavailable.png`、`g8-prod-dbg2-selected.png`

