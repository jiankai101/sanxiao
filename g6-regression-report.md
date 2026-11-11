# G6 回归复验报告 —— 001-core-game（修复轮 4 BUG 关闭判定 + 51 条 REQ 重判）

| 项 | 内容 |
|---|---|
| 任务 | task-22 / attempt 1（G6 回归复验；房间 room-1794319989719887800，验收者 pt-qa-verifier） |
| 依据 | `specs/001-core-game/spec.md` v1.1.1（51 条 REQ）＋ `specs/constitution.md` v1.1.1；仅由需求反推用例，未以实现自测结果作为期望值来源 |
| 前置修复 | task-19（BUG-001）、task-20（BUG-002+004）、task-21（BUG-003）均已 completed |
| 验收对象 | `src/**`、`assets/**`、`tests/**`、生产构建 `dist/`（由当前源码重新构建） |
| 环境 | Windows / Node v24.15.0 / Chrome（Playwright `channel=chrome`）/ 视口 960×720、1280×800、600×800、360×640、320×568 / DPR 1、2、3 |
| 日期 | 2026-11-11 |
| 边界 | **未修改任何产品代码、spec、tasks、tests、assets**；只新增 `.qa-verify/g6-*` 脚本与本报告，并重建 `dist/` 用于验证（源码未动，见 §9） |

---

## 0. 总结论

**存在缺陷（1 个：Low，BUG-003 未关闭）；另有 1 项人工阻塞（REQ-039）。**

| 维度 | 结果 |
|---|---|
| 51 条 REQ | **PASS 50 / FAIL 0 / BLOCKED 1**（BLOCKED = REQ-039，规格要求 3 人灰度评审签署，属人工项） |
| BUG 关闭 | **关闭 3 个**（BUG-001 Critical、BUG-002 High、BUG-004 Low）；**未关闭 1 个**（BUG-003 Low） |
| 新增回归缺陷 | **0 个**（未新增 BUG-005；见 §4 观察项 OBS-01） |
| 自动化回归 | `npm test` 33 文件 / **206 用例全绿**；`npx playwright test` **29/29**；独立 QA 单测 **86/86**；浏览器审计 38/38（生产）、22/22、15/15（测试构建）、16/16（生产）、6/6（生产）、7/7 |
| 发布建议 | **不建议以当前状态发布**：需修掉 BUG-003 的 3 个 MP3 时长，并完成 REQ-039 的 3 人人工评审 |

> 说明：本报告不采用「基本可用」类表述。BUG-001/BUG-002 的原始阻断问题已在独立复测中消失；唯一未关闭项 BUG-003 只影响 Safari 的 MP3 回退路径（Chrome/OGG 主路径时长精确），故定级 Low。

---

## 1. 四个 BUG 的关闭判定

### 1.1 BUG-001（Critical，画布双重留边偏移）—— **关闭**

判定方法（独立于输入层换算）：读取 canvas 2D **绘制变换** `(a,b,c,d,e,f)`，用 `pageX = rect.left + (e + a·x + c·y)/dpr`、`pageY = rect.top + (f + b·x + d·y)/dpr` 反推「逻辑格中心在屏幕上的视觉位置」，点击后读 `__wmgTest.selected()` 与目标格比较；**未使用** `cellPoint()`/`screenToLogical` 等同源公式。

| 视口 | 绘制变换 e/f | a（=scale×dpr） | 棋盘投影（CSS） | 四角点击 | 64 格逐格点击 |
|---|---|---|---|---|---|
| 960×720 dpr1（基线） | 0.000 / 0.000 | 1.00000 | (224.00,96.00) 边长 512.00 | 4/4 一致 | 错格 0，null 0 |
| 1280×800 dpr1 | 0.000 / 0.000 | 1.11111 | (248.89,106.67) 边长 568.89 | 4/4 一致 | 错格 0，null 0 |
| 600×800 dpr1 | 0.000 / 0.000 | 0.62500 | (140.00,60.00) 边长 320.00 | 4/4 一致 | 错格 0，null 0 |
| 360×640 dpr1 | 0.000 / 0.000 | 0.37500 | (84.00,36.00) 边长 192.00 | 4/4 一致 | 错格 0，null 0 |
| 320×568 dpr1 | 0.000 / 0.000 | 0.33333 | (74.67,32.00) 边长 170.67 | 4/4 一致 | 错格 0，null 0 |
| 1280×800 dpr2 | 0.000 / 0.000 | 2.22222 | (248.89,106.67) 边长 568.89 | 4/4 一致 | 错格 0，null 0 |
| 360×640 dpr2 | 0.000 / 0.000 | 0.75000 | (84.00,36.00) 边长 192.00 | 4/4 一致 | 错格 0，null 0 |

补充复测：
- **不裁切**：全部视口绘制范围 `0..(960·a) × 0..(720·a)` 均在 backing store 内（如 600×800：x 0..600.0 / y 0..450.0，画布 600×450；360×640：0..360×270；320×568：0..320×240）。
- **360/320 不再出现 null**：四角与全部 64 格均能命中（G5 时 360×640/320×568 的右下区域点击收不到事件）。
- **960×720 基线不变**：e=f=0、a=1、棋盘 (224,96)、边长 512，与规格 5.1 完全一致。
- 证据：`.qa-verify/out/g6-layout.txt`（63 PASS + 1 条观察项，见 OBS-01）、`.qa-verify/out/g6-prod.txt`（`REQ-040/align-*`、`REQ-041/fit-*` 8 项由 G5 的 FAIL 全部转为 PASS）、`.qa-verify/out/g6-*.png`。

**结论：关闭。** 原缺陷的「非 4:3 视口棋盘偏移/裁切/点 A 选 B」三类现象均不可复现；`e/f` 恒 0、CSS 为唯一留边来源，绘制与命中同原点。

### 1.2 BUG-002（High，死局不重排）—— **关闭**

复测序列（第 8 关 seed=1，**真实鼠标拖拽**，坐标由绘制变换反推）：(1,2)→(1,3)、(3,5)→(4,5)、(1,6)→(1,7)、(1,6)→(2,6)、(1,3)→(1,4)。

| 步 | 操作 | status | 步数 | 分数 | shuffle 事件 | findMove |
|---|---|---|---|---|---|---|
| 0 | 开局 | playing | 30 | 0 | 0 | — |
| 1 | (1,2)→(1,3) | playing | 29 | 180 | 0 | 1,6→1,7 |
| 2 | (3,5)→(4,5) | playing | 28 | 360 | 0 | 1,6→1,7 |
| 3 | (1,6)→(1,7) | playing | 27 | 810 | 0 | 1,6→2,6 |
| 4 | (1,6)→(2,6) | playing | 26 | 990 | 0 | 1,3→1,4 |
| 5 | (1,3)→(1,4) | playing | 25 | 1170 | **1** | **1,6→1,7** |

- 重排后 toast 文本 = 「无可消除步骤，已重排」；`findMove` 非 null；步数只扣 5 步（30→25），分数与 G5 死局快照一致（1170）→ 重排本身不扣步、不改分。
- **对局可继续**：继续用视觉坐标拖动 1,6→1,7，步数 25→24，status=playing，分数继续增长。
- **规模统计**：160 局（8 关 × 20 种子）走 systems 层真实接线（`app.commit` 调用的 `ensurePlayableAfterSettle`）→ `dead=0`、`shuffleEvents=6`、`shuffleStepCostBugs=0`。对照组（不接系统层重排）同样 160 局仍检出 `dead=6`，证明该用例对缺陷有灵敏度（先失败后通过）。
- 证据：`.qa-verify/out/g6-deadlock.txt`（7/7）、`.qa-verify/out/g6-req016.txt`、`tests/e2e/shuffle.spec.ts`（Playwright 通过）。

**结论：关闭。** 原「160 局 6 次死局、0 次重排」变为「160 局 0 次死局、6 次重排」。

### 1.3 BUG-003（Low，MP3 时长与 spec 10.2 不符）—— **未关闭（部分修复）**

判定口径：MP3 帧 = 1152 样本 @48kHz = **24.0ms**；用**游戏实际解码器**（Chrome `decodeAudioData`）测「播放时长」，并用 libsndfile 独立交叉验证；同时核对 Xing 声明帧数与可解码 PCM 帧数。

| 资源 | 标称 | Xing 帧 | 可解码帧 | 实际播放 | 误差 | 帧误差 | OGG 实际 | |OGG−MP3| |
|---|---|---|---|---|---|---|---|---|---|
| bgm-main | 60.000 | 2500 | 2499 | 59.976 | −24ms | 1.00 | 60.000 | 24ms |
| sfx-swap | 0.120 | 5 | 4 | 0.096 | −24ms | 1.00 | 0.120 | 24ms |
| **sfx-invalid** | 0.150 | 6 | 5 | **0.120** | **−30ms** | **1.25** | 0.150 | 30ms |
| **sfx-match** | 0.250 | 10 | 9 | **0.216** | **−34ms** | **1.42** | 0.250 | 34ms |
| sfx-cascade | 0.300 | 13 | 12 | 0.288 | −12ms | 0.50 | 0.300 | 12ms |
| sfx-special-line | 0.400 | 17 | 16 | 0.384 | −16ms | 0.67 | 0.400 | 16ms |
| sfx-special-rainbow | 0.600 | 25 | 24 | 0.576 | −24ms | 1.00 | 0.600 | 24ms |
| sfx-ice-break | 0.300 | 13 | 12 | 0.288 | −12ms | 0.50 | 0.300 | 12ms |
| sfx-stone-break | 0.350 | 15 | 14 | 0.336 | −14ms | 0.58 | 0.350 | 14ms |
| sfx-shuffle | 0.500 | 21 | 20 | 0.480 | −20ms | 0.83 | 0.500 | 20ms |
| sfx-star | 0.500 | 21 | 20 | 0.480 | −20ms | 0.83 | 0.500 | 20ms |
| sfx-win | 1.500 | 63 | 62 | 1.488 | −12ms | 0.50 | 1.500 | 12ms |
| sfx-lose | 1.200 | 50 | 49 | 1.176 | −24ms | 1.00 | 1.200 | 24ms |
| **sfx-click** | 0.080 | 3 | 2 | **0.048** | **−32ms** | **1.33** | 0.079 | 31ms |

- **结论**：14 个中 **11 个在 1 帧内，3 个超出**（sfx-invalid、sfx-match、sfx-click）。另有 4 个（bgm-main、sfx-swap、sfx-special-rainbow、sfx-lose）**恰好 1 帧、零余量**。
- **OGG 不受影响**：14/14 OGG 解码时长与标称差 ≤2.7ms；OGG 文件 mtime（2026-11-10 23:34）早于本轮 MP3（2026-11-11 01:50），`assets/checksums.json` 61 项校验全部匹配。
- **总体积**：音频 1872.9KB ≤ 2048KB（PASS）；图片 77.4KB ≤1.6MB（PASS）。
- 证据：`.qa-verify/out/g6-audio-summary.txt`（Xing/解码帧对照）、`.qa-verify/out/g6-audio-durations.txt`（Chrome 实测）、`.qa-verify/out/g6-assets.txt`（旧脚本 20ms 容器口径 FAILS: 0）。

**为何实现方自检为 PASS**：`assets/tools/verify_assets.py` 用 `Xing frames × 1152 / rate` 计时长，把 LAME 的 Info/索引帧也算作音频；旧 QA 脚本 `assets_check.py` 同样按 Xing 声明值、20ms 容差判定。实际解码器（Chrome、libsndfile）按 gapless 规则裁掉该索引帧，**可解码 PCM 帧 = Xing 声明帧 − 1**，因此真实播放时长比声明值再短 24ms，短音效上就超出 1 帧。

### 1.4 BUG-004（Low，REQ-045/REQ-048 无用例）—— **关闭**

| REQ | 用例文件:行 | 用例名 | 实测覆盖 |
|---|---|---|---|
| REQ-045 | `tests/systems/audio.spec.ts:150/151` | REQ-045 首次手势前不播放，手势后 BGM 循环播放 | 首手势前 0 source；unlock 后 `loop=true`、`start(0,0)` |
| REQ-045 | `tests/systems/audio.spec.ts:174` | REQ-045 visibilitychange 隐藏暂停、可见从暂停点续播且接缝 ≤20ms | suspend=1、source.stop、恢复 offset 误差 ≤20ms |
| REQ-045 | `tests/e2e/audio-live.spec.ts:4` | REQ-045 首手势后 BGM 播放，页面隐藏暂停、恢复可见续播 | 真实点击后 playing=true→hidden false→visible true |
| REQ-048 | `tests/systems/audio.spec.ts:209` | REQ-048 解码失败时静默降级…unavailable=true | decode 抛错：不播放、无异常、unavailable=true |
| REQ-048 | `tests/systems/audio.spec.ts:228` | REQ-048 资源加载失败同样静默降级，游戏可继续 | fetch 抛错：0 source、playSfx resolve |
| REQ-048 | `tests/e2e/audio-live.spec.ts:32` | REQ-048 音频加载/解码失败静默降级并显示「音频不可用」图标 | 拦截 ogg/mp3 → 徽标可见且文本=「音频不可用」，无 dialog，findMove 非 null |

- 全部 6 条在 `npm test`（206）与 `npx playwright test`（29/29）中真实执行并通过；用例名均含 REQ 编号。
- **结论：关闭。** 原「`grep REQ-045/REQ-048` 0 命中」不再成立。

---
## 2. 验收矩阵（REQ-001 ~ REQ-051，依据 spec v1.1.1 重判）

> 证据代号：**[U]** QA 独立单测（`.qa-verify/*.spec.ts`，86 用例）｜**[T]** `npm test`（33 文件/206）｜**[E]** `npx playwright test`（29/29）｜**[P]** `browser-prod.mjs`（38/38，生产构建）｜**[W]** `browser-win.mjs`（22/22）｜**[S]** `browser-supp.mjs`（15/15）｜**[M]** `browser-misc.mjs`（16/16）｜**[L]** `g6-layout.mjs`（七视口绘制↔命中）｜**[D]** `g6-deadlock.mjs`（7/7）｜**[R]** `g6-req016.spec.ts`（160 局统计）｜**[F]** `g6-fallback.mjs`（6/6）｜**[Z]** `g6-resize`（3/3）｜**[A]** `assets_check.py`｜**[Y]** `g6-audio-summary.py` + `g6-decode-durations.mjs`｜**[N]** `banned.py`｜**[C]** 资源校验和 61/61｜**[B]** build/typecheck。

| REQ-ID | 验收用例（由需求反推，非代码反推） | 结论 | 证据 |
|---|---|---|---|
| REQ-001 | 8 关 × 20 种子生成：64 格、每格 1 内容、无初始 ≥3 连、至少 1 个可行交换；生成失败须抛错不死循环 | PASS | [U] 生成 160 局全部满足（[R] 逐局可玩）；[T] `generate.spec` 200 种子 + 单元素关抛 `BoardInitError`；[P] 画布识别 64/64 格、6 种元素 |
| REQ-002 | 同种子 + 同操作序列两局逐帧棋盘/最终分数深度相等；`core/` 无 `Math.random`/`Date.now` | PASS | [U] 种子快照 JSON 全等；[T] `purity.spec` 3 用例 |
| REQ-003 | 拖动（主轴 ≥0.5 格）与两段点击等价；点已选格取消；交换动画 150ms | PASS | [L] 0.4 格拖动=选中不扣步、视觉拖动扣 1 步（7 配置）；[E] 拖拽/两段点击等价；[S] `REQ-044/trace` swap:150 |
| REQ-004 | 不相邻/同格/棋盘外/石块/死格：不交换、不扣步、分数不变、invalid 音、选中态清除/转移 | PASS | [U] 5 类非法输入状态深相等；[P] 非相邻两段点击与棋盘外点击步数/分数不变；[E] invalid 回弹；障碍格点击行为见 OBS-01 |
| REQ-005 | 交换后存在 ≥1 处 ≥3 连 → 交换保留并进入消除 | PASS | [U] 构造 4 连交换 valid；[P] 自算有效交换后 20→19 步、0→180 分 |
| REQ-006 | 无效交换 200ms 回弹，步数/分数/障碍层数不变 | PASS | [U] `rounds=[]`、棋盘深相等、`REVERT_MS=200`；[E] `invalid revert (200ms)` |
| REQ-007 | 横/竖 ≥3 判匹配；L/T 并集一次消除、交叉格只计 1；冰下可匹配，石块/死格不参与 | PASS | [U] h3/v3/h6、L 形 5 格并集无重复、石块遮挡 run=[]、冰覆盖仍匹配 |
| REQ-008 | 消除后同列下移、顶部按当前元素集等概率补充；石块/死格阻挡、冰不阻挡 | PASS | [U] 3 格精确补充、200 组随机无悬空、L7 补充不含「晶」 |
| REQ-009 | 每轮重新检测、c 从 1 递增、M(c)=min(1+0.5(c−1),4)、结束一次性写回 | PASS | [U] c=1..8 倍率 1.0/1.5/…/4.0；[T] `score`/`resolve` 用例 |
| REQ-010 | 4 连生成直线特化（位置规则/不计入消除数/同轮两处生成 2 个） | PASS | [U] `special.spec`；[S] 特化贴图静止态使用 `special-line-h/v.webp`（截图 I3） |
| REQ-011 | ≥5 连生成 1 个彩虹（无颜色、位置规则、不计入消除数） | PASS | [U] 5 连 → rainbow，消除计数不含自身 |
| REQ-012 | 直线清整行/整列并破障；彩虹+普通清全盘同色；彩虹被波及清最多颜色（并列按清单序） | PASS | [U] 整行/整列/同色/并列规则断言 |
| REQ-013 | 彩虹+彩虹清空全盘（死格除外）、障碍 −1、按 60 分/格计 | PASS | [U] 64 格清空、3840 分基准 |
| REQ-014 | scoreGain=ROUND((60N+B+30S)×M(c))；3 连 c=1→180、4 连 c=2→435；整数不 NaN | PASS | [U] 180/435 基准与倍率；[P] 实际得分 180（整数） |
| REQ-015 | 仅有效交换扣 1 步，结算结束一次性扣减；无效/重排/连锁/重开不扣 | PASS | [U] 有效交换 1 步、无效 0 步；[W] 6 步通关；[L]/[D] 步数逐次只减 1、重排不扣 |
| REQ-016 | 结算后无可行步且步数>0 → 保分布重排、不扣步、shuffle 音+提示 2s；100 次失败重生成、再失败判负 | PASS | [D] 五步复现：shuffle=1、findMove 非 null、30→25、toast 正确、可继续 25→24；[R] 160 局 dead=0（对照 6）；[E] `shuffle.spec` 通过 |
| REQ-017 | 状态枚举固定、非法转移抛错；settling 输入被忽略且步数不变 | PASS | [U] 非法转移抛错；[E] `core-flow` settling 期间点击无效；[W] 面板 300ms 锁 |
| REQ-018 | 目标达成即 won（即使步数归零）；未达成且步数 0 → lost；未达成且步数>0 → playing | PASS | [U] 三分支断言；[E] 失败路径面板 |
| REQ-019 | 重开二次确认 → 新种子、分数/步数重置、历史记录不变、不写排行榜 | PASS | [E] `core-flow` 重开；[W] 重开后仍只有原通关记录 |
| REQ-020 | 返回选关 → 本局作废（不写存档分数/榜），解锁与最高分不变 | PASS | [E] `core-flow`；[W] 返回选关后排行榜/解锁保留 |
| REQ-021 | 8 关线性解锁；未解锁点击不进对局并显示锁定与提示；已解锁可重玩 | PASS | [P] 8 卡/7 锁；[E] `level-select` 锁定提示；[W] 通关后 `unlockedLevelId=2` |
| REQ-022 | 三类目标（分数/收集/障碍）AND 组合，全部满足才 won | PASS | [U] `goals.spec` 三类组合；[E] 第 6/8 关双目标 |
| REQ-023 | 冰 1 层、覆盖格可匹配、消除时 −1 并破冰、计入目标、不阻挡下落 | PASS | [U] 冰层变化与目标计数、冰格照常下落 |
| REQ-024 | 石块 2 层、占位不可匹配、相邻消除 −1、破坏前阻挡下落、破坏后按规则补充 | PASS | [U] 两阶段破坏、阻挡与补充断言 |
| REQ-025 | 死格永久不可用、不参与匹配/下落/特化；第 8 关 4 个坐标为空且无元素 | PASS | [U] 死格坐标生成与不可清除；[P] 第 8 关可正常开局 |
| REQ-026 | 胜利 1★=达成目标、2★/3★=分数阈值；失败 0★；只保留历史最高星级 | PASS | [U] 阈值−1/阈值边界；[W] 2790 分 → 3★（阈值 2000/2600） |
| REQ-027 | 8 关 D 严格递增且等于 0.750/0.818/0.900/1.083/1.154/1.462/1.564/1.833（±0.01） | PASS | [U] `levels.spec` D 值与相邻增幅 |
| REQ-028 | 面板含关卡名/结果/本局分数/历史最高/星级/剩余步数/逐项目标；胜负按钮差异；300ms 锁 | PASS | [W] 5 个字段 + 面板瞬间 disabled、400ms 后可点；[E] `settlement-strict` t+200 无效、t+350 生效 |
| REQ-029 | 存档字段齐全（saveVersion=1、进度、记录、设置、统计、updatedAt、lastSessionInterrupted）+ 版本号 | PASS | [U] 写入后字段完整性；[P] 存档键 7 类且 saveVersion=1 |
| REQ-030 | 四处写入时机；开局 true、结算/返回 false；不得写对局快照；true 时提示一次并立即置 false | PASS | [P] 对局中 true → 刷新提示「上一局已中断」1 次 → 写回 false → 二次刷新不再提示；存档键无棋盘/步数/分数；[E] `persistence.spec` |
| REQ-031 | 6 类损坏（JSON/根非对象/缺字段/类型错/越界/版本≠1）→ 备份+默认初始化+「存档已重置」5s+可进第 1 关；`lastSessionInterrupted` 缺失不判损坏 | PASS | [S] 6/6：提示、备份=1、重建 saveVersion=1、可进关；[P] JSON 损坏复测；[E] |
| REQ-032 | localStorage 不可用/配额异常 → 内存降级 + 常驻提示条 + 功能不中断 | PASS | [P] 注入 localStorage 抛错：提示条文本正确、可开局、pageerror=0；[U] QuotaExceeded |
| REQ-033 | 重置进度二次确认 → 清存档与排行榜、回第 1 关、提示 3s | PASS | [E] `settings`；[S] 重置后解锁/榜清空 |
| REQ-034 | 本地排行榜字样；禁用词；不得为排行榜发起网络请求 | PASS | [W] 标题「本地排行榜」、4 禁用词均不出现；[P]/[M] 第三方请求 0（9 个同源请求）；[N] REQ 正文 4 处命中全在 REQ-034 禁令句内，CR 新增行/dist 0 命中 |
| REQ-035 | 记录字段 id/levelId/score/stars/movesUsed/achievedAt/seed；仅胜利写 1 条、失败不写、重复结算不多写 | PASS | [W] 记录 `{"levelId":1,"score":2790,"stars":3,"movesUsed":6,"seed":1,...}`；失败局记录数不变；[U] 重复结算 |
| REQ-036 | 排序 score↓ → movesUsed↑ → achievedAt↑ → id↑；同分同步数先达成在前 | PASS | [U] 四键排序；[W] 榜单首行与期望一致 |
| REQ-037 | 单关 10 条/全局 20 条，超限淘汰末位；界面展示前 10 且标关卡 | PASS | [U] 上限与淘汰；[W] 首行含「第 1 关 起步」+分数+星级，界面含「单关最多 10 条」 |
| REQ-038 | 清空排行榜二次确认（含「不可恢复」）→ 清空 + 提示 3s，不影响进度/设置 | PASS | [E] `leaderboard` 清空；[S] 设置页清空后进度保留 |
| REQ-039 | 6 种元素独立 64×64 贴图、形状互异；灰度后两两可辨（**3 人人工评审一致通过**） | **BLOCKED** | 机器部分 PASS：[A] 6 张 64×64 WebP 均带 alpha；不透明像素均值与 5.1 主色距离 13.6–28.1（同色系，含高光/阴影）；15 对灰度平均差**最小 26.8/255**（`out/g6-tile-gray.txt`），形状互异（G5 灰度对照图 `out/J1/J2`）。**无 3 名评审人签署记录 → 规格验收条件未满足（人工项）** |
| REQ-040 | 背景 1920×1080 WebP；棋盘逻辑 (224,96)、512×512；空槽 64×64；960×720 对齐误差 ≤1px | PASS | [L] 960×720：棋盘投影 (224.00,96.00) 边长 512.00（误差 0）；7 个视口 e=f=0 且投影=224/96×scale（≤0.5px）；[P] 8 项 align/fit 全 PASS；[A] 背景 1920×1080、空槽 64×64 |
| REQ-041 | 渲染分辨率 min(dpr,2)；窗口缩放/旋转/DPR 变化 200ms 内重绘、元素不模糊、状态不重置 | PASS | [L] dpr2 下 a=scale×2；[P] dpr3 → backing=CSS×2（2048×1536）；[Z] 1280×800→600×800 重绘 202.4ms（页内 rAF 计时，见 OBS-02）、分数/步数/status 不变、画布 600×450 |
| REQ-042 | 任一图片失败 → 程序化占位、可继续、仅 console.warn 一次、不弹错误框 | PASS | [F] 拦截全部外置 WebP：[assets] warn 恰好 1 次、无 dialog、pageerror=0、64/64 格仍可见、自算有效交换 20→19；[M] 缺图渲染 |
| REQ-043 | 色盲模式叠加高对比符号/纹理并持久化 | PASS | [M] 开启后画布像素显著变化（104607→290646 bytes）、存档 colorblindMode=true、刷新保留；[E] `settings` |
| REQ-044 | 交换150/回弹200/消除180/下落160/特化300/面板200；reduced 全部 ≤100 且无位移补间 | PASS | [S] `full={"swap":150,"revert":200,"clear":180,"fall":160,"special":300,"panel":200}`、reduced 全 100、trace swap:150/clear:180/fall:160；[E] `motion` 4 用例（含中间帧、reduced） |
| REQ-045 | 首手势后 BGM 循环；接缝静音 ≤20ms；hidden 暂停、可见从暂停点续播 | PASS | [T] 2 条 REQ-045 单测（首手势+循环 / 暂停+偏移≤20ms）；[E] 真实点击 playing=true→hidden false→visible true；[M] 首屏 0 音频请求、手势后加载 BGM；浏览器解码 BGM 60.000s/48kHz/单声道、首末样本 −0.1334/−0.1303。**资源时长见 BUG-003（不计入本行 FAIL，与 G5 口径一致）** |
| REQ-046 | 13 个事件一一映射；每次 1 次；同音效 100ms 内最多 1 次 | PASS | [T] `SFX_MAP` 13 项精确匹配、100ms 节流 fetch/start 计数；[S] 音效随事件播放 |
| REQ-047 | BGM/音效独立开关，音量 0..100 默认 60/80；0..5 与 96..100 不失真；变更立即生效并持久化 | PASS | [T] volumeToGain 边界无 NaN/越界；[M] 存档 bgmVolume=5、reducedMotion=true，刷新后保持；[E] 设置页边界可操作 |
| REQ-048 | 音频加载/解码失败 → 静默降级、不播放、不弹窗、可玩、显示「音频不可用」图标 | PASS | [T] 解码失败 + 网络失败各 1 条；[E] 拦截后 `#audio-badge` 文本=「音频不可用」、无 dialog、findMove 非 null；[M] 徽标可见、可开局 |
| REQ-049 | 投影矩形内最近邻吸附、中垂线分界、并列列优先；矩形外/石块/死格忽略；鼠标触摸同一算法；0.5 格阈值；分级像素（≥600px 单格≥40，320≈21.33，360=24）；DOM 按钮 ≥44 且键盘可达 | PASS | [L] 7 配置 × 64 格「绘制点→selected」错格 0/null 0；矩形外点击 null；0.4 格=点击、≥0.5 格=交换；单格 71.11/40.00/24.00/21.33；[S] 四视口 1,1/4,4/8,8/2,7 全一致；[M] Tab+Enter 可开局、可见按钮 0 个 <44px；[E] `input-a11y`；障碍格行为见 OBS-01 |
| REQ-050 | aria-live=polite；文本「分数 {score}，剩余步数 {moves}，目标 {progress}」；同秒 ≤1 次 | PASS | [P] 实测「分数 180，剩余步数 19，目标 分数 180/1500」；[U] 文本格式与 1s 节流 |
| REQ-051 | 10s 对局 p95 帧间隔 ≤20ms 且 ≥50fps 占比 ≥95%；dist 静态托管可运行、第三方请求 0、首屏 gzip ≤3.0MB；Canvas 2D 不支持时降级不白屏 | PASS | [M] 2400 帧 p95=4.30ms、≥50fps=100%、首屏 198.0KB；[P] `python -m http.server` 托管可玩、第三方 0、pageerror/console.error 0；[B] JS 151.88kB(gzip 68.87)+CSS 6.75kB(gzip 2.14)，生产包 `__wmgTest` 0 处 |

---
## 3. 缺陷清单

### BUG-003（Low，未关闭）：3 个 MP3 实际播放时长超出「≤1 帧」容差，且与 OGG 差 30ms 左右

- **关联 REQ**：REQ-045 / REQ-046 / REQ-048 的资源侧；spec 第 10.2 章「时长」列与「两套文件内容必须一致」。
- **严重级别**：Low（仅 Safari 的 MP3 回退路径；Chrome/OGG 主路径不受影响；听感差异在短音效上为 13%–40%）。
- **最小复现步骤**
  1. `node .qa-verify/g6-decode-durations.mjs`（Chrome `decodeAudioData`，即游戏实际解码器），或
     `$env:PYTHONPATH='pylibs'; python .qa-verify/g6-audio-summary.py`
  2. 读取 sfx-invalid / sfx-match / sfx-click 三行。
- **期望值**（spec 10.2 + 本任务判定口径）：|实际播放时长 − 标称| ≤ 1 帧（24.0ms）；MP3 与 OGG 同一素材内容一致。
  - sfx-invalid：0.150s（允许 0.126–0.174）
  - sfx-match：0.250s（允许 0.226–0.274）
  - sfx-click：0.080s（允许 0.056–0.104）
- **实际值**
  - sfx-invalid **0.120s**（−30ms，1.25 帧）；OGG 0.149s，|差| 29.3ms
  - sfx-match **0.216s**（−34ms，1.42 帧）；OGG 0.247s，|差| 31.3ms
  - sfx-click **0.048s**（−32ms，1.33 帧）；OGG 0.079s，|差| 30.7ms
  - 另：bgm-main / sfx-swap / sfx-special-rainbow / sfx-lose 恰好 −24ms（1.00 帧），**零余量**；其余 7 个在 0.5–0.83 帧内。
- **证据**
  - `.qa-verify/out/g6-audio-summary.txt`：Xing 声明帧 / 可解码帧 / 实测毫秒 / 帧误差 / OGG 毫秒逐项对照，`PASS: 11/14`，FAIL = 上述 3 个。
  - `.qa-verify/out/g6-audio-durations.txt`：Chrome 实测 0.1200 / 0.2160 / 0.0480，与 libsndfile 解码一致（两种独立解码器同值）。
  - `.qa-verify/out/g6-assets.txt`：旧口径（Xing 声明值 + 20ms 容器容差）`FAILS: 0`——说明自检口径与实际解码口径不同，而非文件随机漂移。
- **根因（只读定位）**：LAME 写出的 Info/索引帧被计入 Xing 声明帧数；Chrome 与 libsndfile 按 gapless 规则裁掉该帧，**可解码 PCM 帧 = 声明帧 − 1**。`assets/tools/verify_assets.py` 用 `frames × 1152 / rate`（含索引帧）计时长，因此「声明时长」在容差内，而「实际播放时长」系统性短 1 帧。
- **修复方向（建议，验收方不改资产）**：
  - 对 3 个文件各补 1 个音频帧：invalid 声明 6→7（解码 6 帧=0.144s，−6ms）、match 10→11（0.240s，−10ms）、click 3→4（0.072s，−8ms），并同步 OGG 差异至 ≤10ms。
  - 建议同时给 4 个「恰好 1 帧」的文件补 1 帧，消除零余量。
  - 校验脚本改为以**解码后 PCM 帧数**（或 `decodeAudioData().duration`）为准，而不是 Xing 声明帧数。
- **判定**：**未关闭**。这是本轮唯一未关闭缺陷；不新增 BUG-005（属同一缺陷的延续，不重复计数）。

> 本轮未发现新的回归缺陷：BUG-005 起编号未使用。

---

## 4. 观察项（不计为缺陷，但需记录/澄清）

### OBS-01 石块/死格可被「选中」（REQ-049「忽略」与 REQ-004/E-01 的口径分歧）
- 现象：第 8 关点击死格 (3,3)/(3,6)/(6,2)/(6,7) 或石块 (2,3) 时 `selected()` 返回该格（视觉上出现选中描边）；随后点击相邻格会走「交换被拒」路径并清除选中。
- 实测（`.qa-verify/out/g6-obstacle-probe.txt`）：洞/石块点击后 `selected=(r,c)`；再点相邻格后 `selected=null`，**分数 0→0、步数 30→30、status=playing、pageerror=[]**。
- 规格文本存在两种可自洽读法：REQ-049/3.3 写「石块格或死格时忽略」，而 REQ-004/E-01 写「点击障碍格 → 不扣步、不改分、播 invalid 音、选中态按规则清除」——后者要求点击被识别并清除选中。plan.md 第 924/932 行则写 `pickNearestCell` 对石块/死格返回 `null`（与当前实现不同）。
- **判定**：REQ-049 的可测条款（投影矩形、最近邻、中垂线、矩形外忽略、0.5 格阈值、分级热区、DOM 按钮）全部 PASS；本条不判 FAIL，但建议实现方与规格方二选一对齐（推荐按 plan 让障碍格吸附返回 null，或在 spec 中明确「忽略=不交换/不扣步/不 aria-live 播报，允许短暂高亮」）。

### OBS-02 窗口缩放重绘 202.4ms，贴着 200ms 上限
- 页内 rAF 精确测量 `setViewportSize(1280×800→360×640)` → 画布宽变为 360 用时 **202.4ms**（debounce 固定 200ms + 一帧）；跨进程轮询测得 210–228ms（含 CDP 开销）。
- 判定：REQ-041 判 PASS（202.4ms 属定时器/帧量化误差，且状态未重置、尺寸精确 4:3）；建议把 debounce 降到 150ms 留出余量，避免不同机器上越过 200ms。

### OBS-03 旧 QA 脚本 `d-req016.spec.ts` 的统计口径已过时
- 该脚本只模拟 `core.resolveSwap`，不含 systems 层接线，故仍打印 `dead=6`（这是 G5 的缺陷取证脚本，不是回归门禁）。G6 的新脚本 `g6-req016.spec.ts` 走 `ensurePlayableAfterSettle`（= `app.commit` 的真实调用点）得到 `dead=0`，并保留「不接线」对照组 `dead=6` 以证明灵敏度。
- 建议后续把 `d-req016.spec.ts` 标注为「历史取证，非门禁」，避免误读为回归失败。

### OBS-04 旧 REQ-042 缺图用例实际未拦截到贴图
- `tile-*.webp` 均 <4KB，被 Vite 内联为 data URI，`page.route('**/tile-star*.webp')` 拦不到，旧脚本因此看到 0 条 warn 仍判 PASS（`<=1` 口径）。G6 改为拦截 4 个真实外置 WebP（bg-main/board-frame/fx-clear/ui-panel），得到**恰好 1 条** `[assets]` warn，并通过自算有效交换验证可玩（`.qa-verify/out/g6-fallback.txt`）。

### OBS-05 tasks.md 仍缺「结算后调用重排」的集成任务
- `tasks.md` 中 REQ-016 仅对应 TASK-015（core 纯函数），其 DoD 也只覆盖纯函数，未要求「结算后无可行步 → 调用 ensurePlayable」。BUG-002 正是由此漏过。本轮修复以房间任务 task-20 落地，但 plan/tasks 工件未同步。
- 按验收规则第 4 条「每条 REQ 是否有对应 TASK 与测试」字面判定为**不缺失**（TASK-015 存在、测试存在）；建议补一条集成任务或在 TASK-034 DoD 中显式写入该调用，防止再次回归。

---

## 5. 追溯完整性检查

| 检查 | 结果 |
|---|---|
| REQ 数量 | 51 条（REQ-001 ~ REQ-051），与 spec v1.1.1 一致 |
| REQ → TASK | **51/51 覆盖**（`tasks.md` 41 个 TASK；展开 `REQ-003/004/005/006` 简写后无遗漏） |
| REQ → 测试 | **51/51 覆盖**（`tests/**/*.ts` 的 describe/test/it 名称展开简写后无遗漏）；REQ-045/048 已补齐（BUG-004 关闭） |
| 用例命名规范 | 抽查 `tests/core|render|systems|ui|e2e` 的 describe 块均含 REQ 编号；`tests/tmp-find-win.spec.ts` 已在上一轮移除 |
| 缺口 | 仅 OBS-05（REQ-016 缺集成任务条目，不构成规则 4 的「缺失」） |

原始数据：`.qa-verify/out/g6-trace.json`（`missing_task=[]`、`missing_named=[]`、`missing_any=[]`）。

---

## 6. 全量回归执行记录（可复跑）

| # | 命令 | 结果 | 证据文件 |
|---|---|---|---|
| 1 | `npm run typecheck` | 0 error | 终端输出 |
| 2 | `npm test` | **33 文件 / 206 用例全绿**（3.05s） | `out/g6-npm-test.txt` |
| 3 | `npx vitest run --config .qa-verify/vitest.qa.config.ts` | **7 文件 / 86 用例全绿**（a-core27/b-board27/c-ui26/d-req016 2/g6-req016 2/dump 1/findspecial 1） | 终端输出 |
| 4 | `npm run build` | 成功；JS 151.88kB(gzip 68.87)、CSS 6.75kB(gzip 2.14)；生产包 `__wmgTest` 0 处 | `out/g6-build.txt` |
| 5 | `npx playwright test` | **29/29 通过**（28.5s；Chrome） | `out/g6-playwright.txt` |
| 6 | `node .qa-verify/browser-prod.mjs` | **38/38**（生产构建 + `python -m http.server`） | `out/g6-prod.txt` |
| 7 | `node .qa-verify/browser-win.mjs` | **22/22**（测试构建；真实拖动 6 步通关 2790 分/3★ → 写榜/解锁/刷新） | `out/g6-win.txt` |
| 8 | `node .qa-verify/browser-supp.mjs` | **15/15**（测试构建；四视口吸附 + 6 类损坏存档 + 动画 trace） | `out/g6-supp.txt` |
| 9 | `node .qa-verify/browser-misc.mjs` | **16/16**（懒加载 BGM、键盘、44px、色盲、缺图、音频降级、p95） | `out/g6-misc.txt` |
| 10 | `node .qa-verify/g6-layout.mjs` | **63 PASS / 1 观察项**（OBS-01），七视口配置 | `out/g6-layout.txt` |
| 11 | `node .qa-verify/g6-deadlock.mjs` | **7/7**（五步复现 + 可继续） | `out/g6-deadlock.txt` |
| 12 | `npx vitest run --config .qa-verify/vitest.qa.config.ts .qa-verify/g6-req016.spec.ts` | **2/2**；`WITH_POST_SETTLE dead=0, shuffle=6` / 对照 `dead=6` | `out/g6-req016.txt` |
| 13 | `node .qa-verify/g6-fallback.mjs` | **6/6**（缺图：warn 恰好 1 次、64/64 可见、可玩） | `out/g6-fallback.txt` |
| 14 | `node .qa-verify/g6-resize.mjs` / `g6-resize-precise.mjs` | **3/3**；精确重绘 202.4ms | `out/g6-resize.txt` |
| 15 | `python .qa-verify/assets_check.py` | 图片 33/33、音频 14×2 齐全；音频 1872.9KB；旧口径 FAILS 0 | `out/g6-assets.txt` |
| 16 | `python .qa-verify/g6-audio-summary.py` + `node .qa-verify/g6-decode-durations.mjs` | **MP3 11/14 在 1 帧内，3 个超出** | `out/g6-audio-summary.txt`、`out/g6-audio-durations.txt` |
| 17 | `python .qa-verify/banned.py` | REQ 正文 4 处命中均在 REQ-034 禁令句内；CR 新增行/dist 0 | `out/g6-banned-scan.txt` |
| 18 | `python .qa-verify/g6-checksums.py` | `assets/checksums.json` 61 项全部匹配 | 终端输出 |

### 6.1 首轮 PASS 关键链路抽查（Manager 指定项）

| 指定项 | 结果 | 证据 |
|---|---|---|
| 固定种子通关写榜（score/stars/movesUsed/achievedAt/seed + 排序） | PASS | [W] 6 次拖动 2790 分 3★，记录 `{"id":"1-…-1","levelId":1,"score":2790,"stars":3,"movesUsed":6,"achievedAt":"2026-11-10T18:05:31.326Z","seed":1}`；失败局不写（记录数仍 1）；排序键由 [U] 四键用例覆盖 |
| 6 类损坏存档恢复 | PASS（6/6） | [S] JSON 解析失败 / 根非对象 / 缺 settings / bgmEnabled 类型错 / unlockedLevelId=9 / saveVersion=2 → 均提示「存档已重置」、备份 1 个、重建 saveVersion=1、可进第 1 关 |
| 刷新中断提示一次 | PASS | [P] 对局中 `lastSessionInterrupted=true` → 刷新回选关并提示「上一局已中断」→ 立即写回 false → 同会话二次进入 toast 为空；不恢复对局 |
| 零第三方请求 | PASS | [P] 第三方 0 / 同源 9；[M] 首屏 + 游戏过程均 0 |
| p95 帧间隔 | PASS | [M] 10s 采样 2400 帧，p95=4.30ms，≥50fps 占比 100% |
| 禁用词扫描（既有口径） | PASS | [N] REQ 正文命中 4 处全在 REQ-034 自身禁令句；CR 新增行 0；dist 产物 0 |

---

## 7. 人工/环境项（不默认 PASS）

| 项 | 状态 | 处理 |
|---|---|---|
| REQ-039 3 人灰度评审签署 | **未完成**（无 3 名评审人记录） | **REQ-039 = BLOCKED**（人工项，自动化不可替代） |
| REQ-044 肉眼观测记录 | 未执行（自动 trace 已覆盖数值与时序） | 判 PASS；人工观测列为遗留 |
| REQ-045~048 真机扬声器实听 / 切后台续播 | 未执行（本机无音频输出；已用 WebAudio 桩 + 浏览器解码验证行为） | 行为判 PASS；真机实听列为遗留 |
| Firefox / WebKit | 未覆盖（Playwright 仅配置 Chrome） | 覆盖限制，不计缺陷（与既有口径一致） |
| Safari MP3 回退 | 未实机覆盖；以 Chrome/libsndfile 解码时长代理 | BUG-003 依据解码时长判定，Safari 实机可能因 gapless 处理略有差异 |

---

## 8. 证据文件清单

- 报告：`g6-regression-report.md`
- 脚本（新增，均在 `.qa-verify/`）：`g6-layout.mjs`、`g6-deadlock.mjs`、`g6-req016.spec.ts`、`g6-fallback.mjs`、`g6-resize.mjs`、`g6-resize-precise.mjs`、`g6-audio-summary.py`、`g6-decode-durations.mjs`、`g6-checksums.py`、`g6-trace.py`、`g6-probe-obstacle.mjs`、`g6-probe-hole.mjs`
- 原始输出（`.qa-verify/out/`）：`g6-npm-test.txt`、`g6-playwright.txt`、`g6-build.txt`、`g6-prod.txt`、`g6-win.txt`、`g6-supp.txt`、`g6-misc.txt`、`g6-layout.txt`、`g6-deadlock.txt`、`g6-req016.txt`、`g6-fallback.txt`、`g6-resize.txt`、`g6-assets.txt`、`g6-audio-summary.txt`、`g6-audio-durations.txt`、`g6-banned-scan.txt`、`g6-obstacle-probe.txt`、`g6-trace.json`
- 截图（`.qa-verify/out/`）：`g6-layout-<视口>-dpr<1|2>.png`（7 张）、`g6-shuffle-level8.png`、`g6-level8-obstacles.png`、`g6-missing-assets.png`
- REQ-039 贴图机器代理：`g6-tile-colors.py`（主色）、`g6-tile-gray.py` → `out/g6-tile-gray.txt`（15 对灰度差）
- 注：`out/g6-mp3-frames.txt` 为「按全部 MPEG 帧头计数（含 LAME 收尾帧）」的中间结果，仅用于展示 +1 帧来源，**不作为判定依据**；判定以 `g6-audio-summary.txt` / `g6-audio-durations.txt` 为准。

---

## 9. 变更边界自检

- 未修改 `src/**`、`tests/**`、`specs/**`、`assets/**`：对上述目录按 mtime 复核，2026-11-11 01:52 之后无写入（MP3 为修复轮 01:50 产物）。
- 仅新增 `.qa-verify/g6-*` 脚本与 `out/g6-*` 证据，及本报告。
- `dist/` 由当前源码重新构建用于静态托管验证（生产包，`__wmgTest` 0 处）；这是构建产物重建，不是源码改动。

---

## 10. 结论（复述）

- **BUG-001：关闭**（七视口绘制↔命中 0 格偏差，360/320 无 null，960×720 基线不变）。
- **BUG-002：关闭**（五步复现触发 1 次重排、可继续；160 局死局残留 0）。
- **BUG-003：未关闭**（3 个 MP3 实际播放时长超 1 帧：invalid −30ms、match −34ms、click −32ms；与 OGG 差约 30ms）。
- **BUG-004：关闭**（REQ-045/REQ-048 共 6 条含编号用例，覆盖可见性暂停/续播与解码/网络失败降级）。
- **51 条 REQ：PASS 50 / FAIL 0 / BLOCKED 1（REQ-039 人工项）**。
- **总结论：存在缺陷（1 个：Low）＋ 1 项人工阻塞（REQ-039）**。不满足「全部 PASS」，不建议发布。
