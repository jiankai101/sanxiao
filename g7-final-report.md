# G7 终验报告（spec v1.1.3）

- 验收角色：qa-verifier（独立验收，不修改产品代码/spec/plan/tasks/tests/assets）
- 验收依据：`specs/001-core-game/spec.md` v1.1.3（51 条 REQ，CR-008 / CR-009 已发布）
- 验收时间：2026-11-11
- 证据目录：`.qa-verify/out/`
- 结论口径：只依据 spec 判定，不采用实现方/Manager 既有结论作为通过依据。

## 0. 总结论

**存在缺陷（2 个：BUG-005 中、BUG-006 低）＋ 1 项人工阻塞（REQ-039）。**

| 项目 | 结果 |
|---|---|
| 51 条 REQ | **PASS 49 / FAIL 1 / BLOCKED 1** |
| FAIL 的 REQ | **REQ-004（B 类同格/非相邻未播放 invalid 音效）** |
| BLOCKED 的 REQ | **REQ-039（缺 3 人灰度人工评审签署，规格明确的人工验收条件）** |
| BUG-001 / BUG-002 / BUG-004 | **关闭** |
| BUG-003 | **关闭**（Chrome decodeAudioData 口径 14/14 MP3 ≤24ms） |
| 新增缺陷 | **BUG-005（中）**、**BUG-006（低，测试有效性）** |
| 发布建议 | **不满足“全部 PASS”，不建议以当前状态发布**：需修复 BUG-005，并完成 REQ-039 人工评审。 |

> 说明：`tests/` 全量 220 单测 + 36 E2E 全绿，但 G7 独立 A/B 用例（`.qa-verify/g7-ab.spec.ts`）在四个视口均复现 B 类 invalid 音效缺失；这是测试覆盖盲区导致的“全绿但不符合 spec”，不能据此判 PASS。

---

## 1. BUG-001 ~ BUG-004 关闭判定

### 1.1 BUG-001（Critical，画布双重留边偏移）—— **关闭**

- 独立方法：从 canvas 2D 绘制变换反推 64 个格的视觉中心并真实点击，不复用输入层 `screenToLogical` / `cellPoint` 换算。
- 结果：`g7-layout-regression.txt` **SUMMARY total=64 pass=64 fail=0**。
- 四视口 `all64`：1280×800 / 600×800 / 360×640 / 320×568 均为 **错格 0、null 0**；960×720 基线与 DPR=2 两组也通过；死格(3,3)、石块(2,3) 点击返回 null，普通格(1,1) 正常选中。
- 结论：**关闭**。证据：`.qa-verify/out/g7-layout-regression.txt`。

### 1.2 BUG-002（High，死局不重排）—— **关闭**

- E2E 用例：`tests/e2e/shuffle.spec.ts:13`，第 8 关 seed=1 QA 复现序列，断言“重排发生、shuffle 事件 ≥1、findMove 非 null、对局可继续”。
- 全量 E2E 实测通过（`g7-playwright.txt` 中该用例 ok）。
- 结论：**关闭**。证据：`.qa-verify/out/g7-playwright.txt`。

### 1.3 BUG-003（Low，MP3 时长与 spec 10.2 不符）—— **关闭**

权威口径：Chrome `OfflineAudioContext.decodeAudioData`（与游戏运行时 `AudioContext.decodeAudioData` 同一解码器族），**不使用 frames×1152 容器声明值**。脚本：`.qa-verify/g7-decode-durations.mjs`。

| 文件 | 标称 | MP3 解码 | MP3 误差 | OGG 解码 | OGG 误差 |
|---|---:|---:|---:|---:|---:|
| bgm-main | 60.000s | 60.0000s | 0.0ms | 60.0000s | 0.0ms |
| sfx-swap | 0.120s | 0.1200s | 0.0ms | 0.1173s | -2.7ms |
| sfx-invalid | 0.150s | 0.1440s | -6.0ms | 0.1493s | -0.7ms |
| sfx-match | 0.250s | 0.2400s | -10.0ms | 0.2473s | -2.7ms |
| sfx-cascade | 0.300s | 0.3120s | +12.0ms | 0.2973s | -2.7ms |
| sfx-special-line | 0.400s | 0.4080s | +8.0ms | 0.3987s | -1.3ms |
| sfx-special-rainbow | 0.600s | 0.6000s | 0.0ms | 0.5973s | -2.7ms |
| sfx-ice-break | 0.300s | 0.3120s | +12.0ms | 0.2973s | -2.7ms |
| sfx-stone-break | 0.350s | 0.3600s | +10.0ms | 0.3473s | -2.7ms |
| sfx-shuffle | 0.500s | 0.5040s | +4.0ms | 0.4973s | -2.7ms |
| sfx-star | 0.500s | 0.5040s | +4.0ms | 0.4973s | -2.7ms |
| sfx-win | 1.500s | 1.5120s | +12.0ms | 1.5000s | 0.0ms |
| sfx-lose | 1.200s | 1.2000s | 0.0ms | 1.2000s | 0.0ms |
| sfx-click | 0.080s | 0.0720s | -8.0ms | 0.0787s | -1.3ms |

- MP3：**14/14 在 ±24ms（1 帧）内，最大 |误差| 12ms**；此前 3 个超差项（invalid -30ms、match -34ms、click -32ms）现为 -6/-10/-8ms。
- OGG：**14/14 在 ±24ms 内，最大 |误差| 2.7ms**；14 个 OGG SHA256 与 `assets/checksums.json` 全部一致，本轮未发现 OGG 时长/格式/接缝回归。说明：工作区无 VCS 与修复前字节快照，无法独立证明“历史字节完全未变”，但当前 OGG 验收值与修复后基准无回归，不影响 BUG-003 以 MP3 解码时长关闭。
- 音频总量：`1,923,189 bytes = 1,878.1 KiB`，≤ 2048 KiB（2.0MB）。
- 格式：14 个 MP3 均为 128kbps / 48kHz / 单声道；14 个 OGG 均为 nominal 96kbps / 48kHz / 单声道（`g7-bitrate.txt`）。
- BGM 循环接缝：OGG `|x[-1]-x[0]| = 0.00312`，MP3 `0.00607`；边界 100ms 内最长近静音 `0.17ms`，≤20ms，未退化。
- 证据：`.qa-verify/out/g7-decode-durations.txt`、`g7-audio-static.txt`、`g7-seam.txt`、`g7-bitrate.txt`。
- 说明：旧 `.qa-verify/assets_check.py` 的 MP3 段仍用容器帧数×1152，按 task-29 明确禁止的口径会产生 11 个假 FAIL；本报告不采用该段判定，仅采用其图片检查段。

### 1.4 BUG-004（Low，REQ-045/REQ-048 无用例）—— **关闭**

- `tests/e2e/audio-live.spec.ts` 2 条用例通过：首手势后 BGM 播放、hidden 暂停、visible 续播；音频加载/解码失败静默降级并显示「音频不可用」。
- `tests/systems/audio.spec.ts` 7 条单测通过（事件映射、节流、visible/暂停、解码失败、音量增益边界）。
- 全量 E2E 36 passed，其中 REQ-045/048 两条 runtime 用例均在列。
- 结论：**关闭**。证据：`.qa-verify/out/g7-playwright.txt`、`g7-npm-test.txt`。

---

## 2. A/B 命中口径实测（spec v1.1.3 / CR-008 / CR-009）

测试文件：`.qa-verify/g7-ab.spec.ts`；运行配置 `.qa-verify/playwright.g7.config.ts`；输出 `.qa-verify/out/g7-ab-final.txt`。
音效判定：页内 hook `AudioBufferSourceNode.prototype.start` 记录实际播放 buffer 的 `duration`（invalid = 0.1493s OGG / 0.144s MP3），同时记录 `sfx-invalid-*.ogg|mp3` 请求；不只看网络请求。

| 视口 | A 矩形外 | A 石块格 | A 死格 | B 同格 | B 非相邻 | B 无匹配回弹 |
|---|---|---|---|---|---|---|
| 1280×800 | PASS | PASS | PASS | **FAIL** | **FAIL** | PASS |
| 600×800 | PASS | PASS | PASS | **FAIL** | **FAIL** | PASS |
| 360×640 | PASS | PASS | PASS | **FAIL** | **FAIL** | PASS |
| 320×568 | PASS | PASS | PASS | **FAIL** | **FAIL** | PASS |

汇总：**24 个 G7 A/B 用例，16 passed / 8 failed**；8 个失败全部是 B 类“同格 / 非相邻”未产生 invalid 音效。

- A 类三类落点：选中态不变、moves/score 不变、`#game-live` 文本不变、无 invalid buffer start、无 invalid 请求；**全部通过**。
- B 无匹配回弹：点击 (1,1) 后点击相邻 (1,2)（seed=20261110 下为无匹配交换），moves 20→20、score 0→0、invalid buffer start ≥1、invalid 请求 ≥1；**全部通过**。
- B 同格：点击 (1,1) 选中后再次点击 (1,1)，选中态清空、moves/score 不变，但 **invalid buffer start = 0、invalid 请求 = 0**；四个视口均失败。
- B 非相邻：点击 (1,1) 选中后点击 (1,8)，选中态转移到 (1,8)、moves/score 不变，但 **invalid buffer start = 0、invalid 请求 = 0**；四个视口均失败。

结论：**A 类达标；B 类未达标**。REQ-004 判 FAIL，详见 BUG-005。

---

## 3. 全量与关键链路

| 检查 | 结果 | 证据 |
|---|---|---|
| `npm run typecheck` | PASS（exit 0） | `out/g7-typecheck.txt` |
| `npm test` | PASS：34 files / 220 tests | `out/g7-npm-test.txt` |
| `npm run build` | PASS：127 modules，dist 生成 | `out/g7-build.txt` |
| `npx playwright test` | PASS：36 passed | `out/g7-playwright.txt` |
| G7 A/B 独立用例 | **16 passed / 8 failed**（见 §2） | `out/g7-ab-final.txt` |
| BUG-001 四视口绘制↔命中 | PASS：64/64，错格 0/null 0；360/320 无 null | `out/g7-layout-regression.txt` |
| 窗口缩放 | PASS：resize→重绘 200.8ms（MutationObserver；200ms debounce），状态保持；画布 600×450 | `out/g7-resize-mutation.txt`、`out/g7-resize.txt` |
| 10 秒对局 p95 | PASS：samples=600，p95=4.3ms，lowFpsRatio=0 | `out/g7-perf.txt` |
| 第三方请求 | PASS：external=0，pageerrors=0 | `out/g7-perf.txt`、`out/g7-playwright.txt` |
| 首屏 gzip | PASS：非音频 dist 文件 gzip 112.2 KiB（≤3.0MB） | `out/g7-gzip.txt` |
| 禁用词扫描 | PASS：dist JS/HTML/CSS 中「全球/在线/全服/服务器排名」0 命中；spec 仅 REQ-034 自身禁用句命中 | `out/g7-banned.txt` |
| 图片资源 | PASS：33 个文件尺寸/格式正确；图片合计 77.4KB；首屏图片 71.9KB | `out/g7-assets-check.txt` |
| 音频资源 | PASS：28 文件 1,878.1KiB；14 MP3/14 OGG 格式/时长见 §1.3 | `out/g7-decode-durations.txt`、`g7-bitrate.txt` |
| 6 类损坏存档 | PASS：JSON 解析失败/必填字段缺失/类型错误/版本不匹配/数值越界/日期非法，各自备份+默认+recovered | `out/g7-npm-test.txt`（`tests/systems/storage.spec.ts`） |
| 固定种子通关写榜 | PASS：seed=1，2790 分、3★、movesUsed=6；榜单 1 条；存档 unlocked=2 | `out/g7-playwright.txt`（`settlement-strict.spec.ts`） |
| 刷新中断提示一次 | PASS：首次刷新提示「上一局已中断」，标记写 false；二次刷新不再提示 | `out/g7-playwright.txt`（`persistence.spec.ts`） |

---

## 4. 51 条 REQ 验收矩阵

> 追溯性：51/51 REQ 在 `tasks.md` 有 TASK 映射，51/51 REQ 在 `tests/**` 有含编号用例（含 `REQ-003/004/005/006` 这类组合编号展开）。`REQ-004` 虽有测试，但 `tests/ui/input.spec.ts:47` 把“点击非相邻普通格转移选中、无 invalid”固化为期望，与 spec 相反，故测试存在但不有效，判 FAIL。

| REQ-ID | 用例 / 测试 | TASK | 结论 | 证据 |
|---|---|---|---|---|
| REQ-001 | `generate.spec` 200 seeds、64 格、无初始三连、至少 1 步 | TASK-002/006 | PASS | `g7-npm-test.txt` |
| REQ-002 | `rng/purity` 同 seed 双跑快照深比较；core 无 Math.random/Date.now | TASK-002/005 | PASS | `g7-npm-test.txt` |
| REQ-003 | `swap.spec`、`input-a11y` 鼠标/触摸拖拽与两段点击、0.5 格阈值 | TASK-008/027 | PASS | `g7-npm-test.txt`、`g7-playwright.txt` |
| REQ-004 | `input.spec` A/B；G7 4 视口 A 三类+B 三类 | TASK-008/027 | **FAIL** | `g7-ab-final.txt` 8 failed；BUG-005 |
| REQ-005 | `swap.spec` 有效三连交换保留 | TASK-008 | PASS | `g7-npm-test.txt` |
| REQ-006 | `swap.spec` 无匹配回弹、状态/步数不变 | TASK-008 | PASS | `g7-npm-test.txt`、`g7-ab-final.txt`（B 无匹配） |
| REQ-007 | `match.spec` 横/竖/L/T 并集、冰块可匹配、石块/死格不匹配 | TASK-007 | PASS | `g7-npm-test.txt` |
| REQ-008 | `gravity.spec` 下落/补充、石块/死格阻挡 | TASK-012 | PASS | `g7-npm-test.txt` |
| REQ-009 | `resolve.spec` c=1..8 倍率与连锁 | TASK-009/013 | PASS | `g7-npm-test.txt` |
| REQ-010 | `special-generate.spec` 4 连生成横/竖特化、双 4 连 | TASK-010 | PASS | `g7-npm-test.txt` |
| REQ-011 | `special-generate.spec` 5 连生成 1 个彩虹 | TASK-010 | PASS | `g7-npm-test.txt` |
| REQ-012 | `special-trigger.spec` 整行/列、同色、彩虹被波及 | TASK-011 | PASS | `g7-npm-test.txt` |
| REQ-013 | `special-trigger.spec` 彩虹+彩虹清 64 格、3840 分 | TASK-011 | PASS | `g7-npm-test.txt` |
| REQ-014 | `score.spec` 180/435 基准、整数/NaN | TASK-002/009 | PASS | `g7-npm-test.txt` |
| REQ-015 | `resolve.spec` 仅有效交换扣 1 步 | TASK-013 | PASS | `g7-npm-test.txt` |
| REQ-016 | `shuffle.spec`/E2E seed=1 重排，不扣步、shuffle 音效/提示 | TASK-015 | PASS | `g7-npm-test.txt`、`g7-playwright.txt` |
| REQ-017 | `state-machine.spec` 六状态、非法转移抛错、settling 锁输入 | TASK-014/021 | PASS | `g7-npm-test.txt` |
| REQ-018 | `resolve.spec` 目标达成即胜/步数 0 判负/继续 playing | TASK-013/014 | PASS | `g7-npm-test.txt` |
| REQ-019 | `core-flow` 重开二次确认、新种子、分数步数归零、不写榜 | TASK-017/030/035 | PASS | `g7-playwright.txt` |
| REQ-020 | `core-flow`/`settlement-strict` 中途返回选关不写分/榜 | TASK-017/030/035 | PASS | `g7-playwright.txt` |
| REQ-021 | `levels.spec` 8 关 IDs/步数；`level-select` 锁定与解锁 | TASK-003/029 | PASS | `g7-npm-test.txt`、`g7-playwright.txt` |
| REQ-022 | `goals.spec` 三类目标 AND | TASK-003/013/016 | PASS | `g7-npm-test.txt` |
| REQ-023 | `goals.spec`/`gravity.spec` 冰层 -1、目标计数、不阻挡下落 | TASK-012/016 | PASS | `g7-npm-test.txt` |
| REQ-024 | `goals.spec`/`gravity.spec` 石块 2 层、邻格消除、破坏后补充 | TASK-012/016 | PASS | `g7-npm-test.txt` |
| REQ-025 | `generate.spec`/`levels.spec` 第 8 关 4 死格坐标、不可清除 | TASK-003/006 | PASS | `g7-npm-test.txt` |
| REQ-026 | `goals.spec` 星级阈值 -1/阈值/+1、历史最高星 | TASK-016/029 | PASS | `g7-npm-test.txt` |
| REQ-027 | `levels.spec` D 序列 0.750→1.833、严格递增、增幅≤0.35 | TASK-002/003 | PASS | `g7-npm-test.txt` |
| REQ-028 | `settlement-strict`/`hud` 面板字段、下一关隐藏、300ms 锁 | TASK-030/035 | PASS | `g7-playwright.txt`、`g7-npm-test.txt` |
| REQ-029 | `storage.spec` 8 条记录、saveVersion=1、字段默认值 | TASK-024 | PASS | `g7-npm-test.txt` |
| REQ-030 | `save-service`/`persistence` 四处写入、true/false、刷新提示一次 | TASK-025/034/035 | PASS | `g7-npm-test.txt`、`g7-playwright.txt` |
| REQ-031 | `storage.spec` 6 类损坏各自备份+默认；`persistence` E2E 可进第 1 关 | TASK-024 | PASS | `g7-npm-test.txt`、`g7-playwright.txt` |
| REQ-032 | `storage.spec` QuotaExceeded → 内存降级、temporary=true | TASK-024 | PASS | `g7-npm-test.txt` |
| REQ-033 | `settings` 重置进度回第 1 关并清榜 | TASK-025/031/035 | PASS | `g7-playwright.txt` |
| REQ-034 | `leaderboard`/`audio-network` 「本地排行榜」、零第三方请求 | TASK-026/032/036/037 | PASS | `g7-playwright.txt`、`g7-perf.txt` |
| REQ-035 | `leaderboard.spec` 字段与胜利单条写入、失败不写 | TASK-026 | PASS | `g7-npm-test.txt`、`g7-playwright.txt` |
| REQ-036 | `leaderboard.spec` score↓ / moves↑ / achievedAt↑ / id↑ | TASK-026/032 | PASS | `g7-npm-test.txt` |
| REQ-037 | `leaderboard.spec` 单关 10 / 全局 20、淘汰末位 | TASK-026/032 | PASS | `g7-npm-test.txt` |
| REQ-038 | `leaderboard`/`settings` 二次确认含「不可恢复」、清空提示 | TASK-026/031/032 | PASS | `g7-npm-test.txt`、`g7-playwright.txt` |
| REQ-039 | 6 张 64×64 元素贴图、形状互异、灰度两两可辨（**3 人评审**） | TASK-004/019/020/038/041 | **BLOCKED** | 机器代理 PASS（`g7-tile-gray.txt`，最小灰度差 26.8/255）；无 3 人签署记录 |
| REQ-040 | `layout`/`scene` 棋盘 (224,96) 512×512、对齐≤1px | TASK-004/018/020/023/039/041 | PASS | `g7-layout-regression.txt` |
| REQ-041 | `layout`/resize 四视口、DPR=2、200ms 重绘、状态不重置 | TASK-018/036 | PASS | `g7-layout-regression.txt`、`g7-resize-mutation.txt`（200.8ms） |
| REQ-042 | `assets.spec` 图片 404 走占位、warn 一次、不抛错 | TASK-019/038/041 | PASS | `g7-npm-test.txt` |
| REQ-043 | `settings` 色盲符号叠加与持久化 | TASK-020/031/036 | PASS | `g7-playwright.txt` |
| REQ-044 | 六类动画 150/200/180/160/300/200ms；reduced ≤100ms 无位移 | TASK-002/021/023/037 | PASS | `g7-npm-test.txt`、`g7-playwright.txt` |
| REQ-045 | 首手势后 BGM、hidden 暂停/可见续播、接缝≤20ms | TASK-033/036/040 | PASS | `g7-playwright.txt`、`g7-seam.txt` |
| REQ-046 | 13 事件→音效映射、每次 1 次、100ms 节流 | TASK-033/040 | PASS | `g7-npm-test.txt`（B 路径事件缺失归 REQ-004/BUG-005） |
| REQ-047 | BGM/SFX 独立开关、0..100、默认 60/80、刷新保持 | TASK-031/033/036 | PASS | `g7-npm-test.txt`、`g7-playwright.txt` |
| REQ-048 | 加载/解码失败静默降级 + 「音频不可用」图标 | TASK-033/040 | PASS | `g7-playwright.txt`、`g7-npm-test.txt` |
| REQ-049 | 四视口最近邻吸附、64 格 0 偏差、600 断点、A 类静默 | TASK-018/027/036 | PASS | `g7-layout-regression.txt`、`g7-ab-final.txt` |
| REQ-050 | aria-live 格式「分数…剩余步数…目标…」、同秒≤1 次 | TASK-028/036 | PASS | `g7-npm-test.txt`、`g7-ab-final.txt`（A 类不变） |
| REQ-051 | 10s p95≤20ms、≥50fps≥95%、dist 静态可运行、第三方 0、gzip≤3MB | TASK-001/022/023/034/037/041 | PASS | `g7-perf.txt`（p95 4.3ms/lowFps 0）、`g7-gzip.txt`（112.2KiB） |

**矩阵统计：PASS 49 / FAIL 1 / BLOCKED 1，共 51 条。**

---

## 5. 缺陷清单

### BUG-005（中 / Medium）：B 类“同格”“非相邻”两段点击未播放 invalid 音效

- 关联 REQ：**REQ-004**（B 类：同格、非相邻必须播 invalid 且不扣步）；关联 REQ-046 的 invalid 事件触发面。
- 最小复现（1280×800，Chrome，`npm run build:test` + `vite preview`）：
  1. 打开 `/?seed=20261110`，`__wmgTest.startLevel(1)`。
  2. 点击 (1,1) 中心 → 选中 (1,1)。
  3. 点击 (1,8) 中心（两格均为有效格，非相邻）。
  4. 等待 350ms。
- 期望值：moves 20、score 0 不变；**播放 1 次 invalid 音效**（AudioBuffer duration ≈0.1493s，且出现 `sfx-invalid-*.ogg` 请求）；选中态按 REQ-003 规则清除或转移。
- 实际值：moves 20、score 0 不变；`selected` 从 (1,1) 转移到 (1,8)；**invalid buffer start = 0，invalid 请求 = 0**。
- 同格复现：选中 (1,1) 后再次点击 (1,1)，期望 invalid 1 次 + 取消选中；实际选中清空，但 **invalid buffer start = 0，请求 = 0**。
- 影响面：四个验收视口全部复现；G7 24 个 A/B 用例中 8 个失败，全部为该两类。
- 代码位置：`src/ui/input/board-input.ts` `handleClick()`：L135-138 同格直接 `deselect`、L146-149 非相邻直接 `selected = cell`，未 emit `invalid`；`release()` 的 B 类 `invalid` 仅在位移未达阈值且换格时产生（L113-117）。
- 测试侧佐证：`tests/ui/input.spec.ts:47`「点击自身取消选中；点击非相邻普通格转移选中」把错误行为固化为期望，未断言 invalid 音效；`specs/001-core-game/tasks.md:599` 的 TASK-027 DoD 明确要求“非相邻/同格/无匹配 → invalid 事件（B 类）”。
- 证据：`.qa-verify/out/g7-ab-final.txt`（8 failed，逐视口 expected ≥1 / received 0）。
- 修复建议（仅供实现方参考，qa 不代改）：在 `handleClick()` 的同格分支与非相邻分支 emit `{type:'invalid', cell}`（或等价 B 类事件），保持现有选中态规则；同步修正单测期望并补四视口 E2E。

### BUG-006（低 / Low，测试有效性）：`outside-board.spec.ts` 的 invalid 网络断言对 hashed URL 不生效

- 位置：`tests/e2e/outside-board.spec.ts:26`，正则 `/sfx-invalid\.(ogg|mp3)(\?|$)/`。
- 实际构建后的请求 URL 为 `.../assets/sfx-invalid-BqsWogSh.ogg`（带 Vite hash），正则不匹配，因此“无 invalid 请求”断言在 invalid 音效真的发生时也会通过。
- 期望：若触发 `sfx-invalid` 请求，该数组非空并令用例失败；实际：始终为空，断言为空转。
- 影响：测试有效性，不影响产品运行时；G7 已用 `AudioBufferSourceNode.prototype.start` + hashed URL 匹配独立验证 A 类确实无 invalid 播放，故 A 类结论不受影响。
- 证据：`.qa-verify/out/g7-probe.txt`（fetches 中为 `sfx-invalid-BqsWogSh.ogg`），`.qa-verify/out/g7-ab-final.txt`（A 类 12/12 通过，使用实际 buffer start 计数）。
- 修复建议：正则改为 `/sfx-invalid[^/]*\.(ogg|mp3)(\?|$)/`，并优先断言实际播放事件而非仅 fetch。

### 已关闭缺陷（不计入当前缺陷数）

- BUG-001：关闭（§1.1）
- BUG-002：关闭（§1.2）
- BUG-003：关闭（§1.3）
- BUG-004：关闭（§1.4）

---

## 6. 人工阻塞

### REQ-039（BLOCKED，人工项，不得默认 PASS）

- 规格要求：6 种元素独立 64×64 贴图、形状互不相同；转灰度后 6 种仍可两两区分，**人工评审 3 人一致通过**。
- 机器代理：6 张 64×64 WebP 均带 alpha；15 对灰度平均差最小 **26.8/255**（`g7-tile-gray.txt`）；形状/符号互异；整盘灰度对照图见 `.qa-verify/out/J1-tiles-color-vs-grayscale.png`、`J2-board-grayscale.png`。
- 阻塞原因：工作区与报告中没有 3 名评审人签署/记录；机器代理不能替代规格明确要求的 3 人一致通过。
- 结论：**BLOCKED（人工）**，不是产品缺陷，也不能判 PASS。

---

## 7. 追溯性与覆盖

- `tasks.md` 任务总览：51/51 REQ 均有 TASK 映射（脚本 `g7-taskmap.py`）。
- `tests/**`：51/51 REQ 均有含编号的 describe/test/it（组合编号如 `REQ-003/004/005/006` 展开后覆盖）。
- 关键遗漏：REQ-004 的测试存在但期望错误（见 BUG-005）；因此“有测试”不等于“有效覆盖”，本报告按 FAIL 处理。
- 51 条矩阵无遗漏；REQ 编号 001~051 连续。

## 8. 证据索引

| 文件 | 内容 |
|---|---|
| `.qa-verify/g7-ab.spec.ts` | G7 四视口 A/B 24 用例（产品行为实测） |
| `.qa-verify/playwright.g7.config.ts` | G7 Playwright 配置（独立 4174 端口） |
| `.qa-verify/g7-decode-durations.mjs` | Chrome decodeAudioData 14 MP3/14 OGG 时长 |
| `.qa-verify/g7-audio-static.py` | OGG/MP3 解码、BGM 接缝、checksums |
| `.qa-verify/g7-seam.py` | BGM 循环边界近静音时长 |
| `.qa-verify/g7-bitrate.py` | MP3 128kbps / OGG nominal 96kbps |
| `.qa-verify/g6-layout.mjs` | BUG-001 64 格绘制↔命中独立回归 |
| `.qa-verify/g7-resize-mutation.mjs` | resize 200ms 精确测量（MutationObserver） |
| `.qa-verify/g7-perf.mjs` | 10 秒对局 p95 / 第三方请求 |
| `.qa-verify/g7-gzip.py` | 首屏 gzip 体积 |
| `.qa-verify/g7-trace2.py` | REQ→测试追溯 |
| `.qa-verify/g7-taskmap.py` | REQ→TASK 追溯 |
| `.qa-verify/out/g7-*.txt` | 上述命令原始输出 |
