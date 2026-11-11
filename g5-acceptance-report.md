# G5 独立验收报告 —— 001-core-game（Web 三消小游戏 MVP）

- 验收任务：task-7 / attempt 1（房间 room-1794319989719887800，验收者 pt-qa-verifier）
- 验收依据：`specs/001-core-game/spec.md` v1.1.1（51 条 REQ）＋ `specs/constitution.md` v1.1.1；仅以规格反推用例，**未参考实现自测通过与否作为期望值来源**
- 验收对象：`src/**`、`assets/**`、`dist/`（生产构建）、`tests/**`
- 验收环境：Windows / Node v24.15.0 / Chrome（Playwright `channel=chrome`）/ 视口 960×720、1280×800、600×800、360×640、320×568 / DPR 1 与 3
- 验收日期：2026-11-11
- 验收方式：独立审计脚本（`…/.qa-verify/`，非产品代码）＋ 生产构建浏览器实测 ＋ 人工复算（关卡表/计分/排序/存档矩阵）＋ 溯源检查

## 0. 总结论

**存在缺陷（4 个：1× Critical、1× High、2× Low）。**

- 51 条 REQ：**PASS 45 / FAIL 6 / BLOCKED 0**
  - 功能缺陷导致 FAIL：REQ-016、REQ-040、REQ-041、REQ-049
  - 追溯缺失导致 FAIL：REQ-045、REQ-048（功能实测通过，但无任何自动化用例覆盖且用例名不含 REQ 编号，违反 spec 第 7 章「用例名必须包含 REQ 编号」与本次验收规则第 4 条）
- 阻断发布的两处问题：
  1. **BUG-001（Critical）** 画布渲染与命中测试存在「双重留边偏移」：只要视口不是 4:3，棋盘整体偏移、底部/右侧被裁掉，且点击落点与视觉棋盘错位 1~4 格 → 常规桌面/手机视口下实际不可正常游玩。
  2. **BUG-002（High）** REQ-016 无可行步重排未接入运行时：160 局随机对局中出现 6 次「死局 + 仍有步数」且 0 次重排，玩家卡死（已在浏览器复现）。
- 不得表述为「基本可用」：上述两项分别导致「多数视口不可玩」与「约 3.8% 对局卡死」。

---

## 1. 验收矩阵（REQ-001 ~ REQ-051）

> 证据代号：**[U]** 独立单测审计 `.qa-verify/a-core|b-board|c-ui|d-req016.spec.ts`（83 检查全绿）；**[P]** 生产构建浏览器审计 `.qa-verify/browser-prod.mjs`（38 检查，30 PASS / 8 FAIL，FAIL 全为 BUG-001）；**[W]** 通关链路浏览器审计 `.qa-verify/browser-win.mjs`（22/22）；**[M]** 资源/音频/设置/性能浏览器审计 `.qa-verify/browser-misc.mjs`（16/16）；**[E]** 项目自带 `npx playwright test`（26/26）；**[A]** 资源独立校验 `.qa-verify/assets_check.py`；**[B]** 构建/单测命令输出。

| REQ-ID | 验收用例（由需求反推，非代码反推） | 结论 | 证据 |
|---|---|---|---|
| REQ-001 | 8 关 × 30 种子生成：64 格、每格恰 1 元素或 1 障碍、无初始 ≥3 连、至少 1 个可行交换；不可满足的关卡配置须抛初始化失败而非死循环 | PASS | [U] `REQ-001 初始生成`：240 次生成全部满足；单元素关卡抛 `BoardInitError`；[P] 画布 64 格全部读到元素 |
| REQ-002 | 同种子 + 同操作序列两局逐帧棋盘与最终分数深度相等；`core/` 不得出现 `Math.random/Date.now` | PASS | [U] 424242 种子 8 步快照 JSON 全等；对 `src/core/**` 全文检索 `Math.random|Date.now|performance.now|window.|document.` 命中 0 处，`any` 命中 0 处 |
| REQ-003 | 拖动（主轴 ≥0.5 格）与两段点击都触发交换；点击已选格取消选中 | PASS | [U] 20px(=0.5×40) 判定交换、19.9px 判点击、|dy| 主轴与负向方向正确；[P] 真实鼠标拖动有效交换（20→19 步）、点击同格取消选中不扣步 |
| REQ-004 | 不相邻/同格/棋盘外/石块/死格：不交换、不扣步、分数不变、选中态清除或转移、播 invalid 音 | PASS | [U] 5 类非法输入均 `valid=false` 且棋盘深相等；[P] 棋盘外点击与非相邻两段点击后步数/分数不变；`onInputEvent('invalid')→sfx('invalid')` 路径存在 |
| REQ-005 | 交换后存在 ≥1 处横/竖 ≥3 连 → 交换保留并进入消除 | PASS | [U] 构造 4 连交换 `valid=true` 且 `runs.length=1`；不产生连线的交换 `reason='no-match'` 且返回原棋盘 |
| REQ-006 | 无效交换：200ms 回弹、步数/分数/障碍层数不变 | PASS | [U] 无效交换 `rounds=[]`、棋盘深相等、分数/步数不变；`REVERT_MS=200`；[E] `invalid revert (200ms)` 用例通过 |
| REQ-007 | 横/竖 ≥3 判匹配；L/T 按并集一次消除且交叉格只计 1；冰下可匹配、石块/死格不参与 | PASS | [U] h3/v3/h6 各 1 条连线；L 形 2 条 run 并集 5 格且 `matched` 无重复；石块遮挡后 run=[]；冰覆盖仍匹配 |
| REQ-008 | 消除后同列整体下移、顶部按当前元素集等概率补充；石块阻挡下落、冰不阻挡 | PASS | [U] 石块段上方元素原位保留、下方补充、`spawned` 精确等于 3 格；冰格元素照常下落；200 组随机清空后每列无悬空；L7 补充集不含「晶」 |
| REQ-009 | 每轮下落重新检测、c 从 1 递增、M(c)=min(1+0.5(c−1),4)；结束一次性写回 | PASS | [U] 40 种子 × 最长 20 步：每轮 `cascade=i+1`、`moveLeft` 恰 −1、总分=ΣscoreGain；倍率序列 1/1.5/2/2.5/3/3.5/4/4/4 |
| REQ-010 | 横/竖 4 连生成对应直线特化，位置优先玩家交换格；同轮两处 4 连生成 2 个 | PASS | [U] 横 4 连 → `line-h` 且 index ∈ {swap.from,swap.to}；竖 4 连 → `line-v`（1 个） |
| REQ-011 | ≥5 连生成 1 个彩虹（无颜色），不计入本轮消除数量 | PASS | [U] 5 连 → `{special:'rainbow', kind:null}`；[E] `special creation (300ms)` 用例通过 |
| REQ-012 | 直线特化清整行（含障碍 −1 层）、额外元素 +30 分；彩虹+普通清全盘该色；彩虹被波及时取最多色（并列按星/水/叶/火/晶/电） | PASS | [U] 行清除 6 格（死格跳过）、石块入 `damagedStones`、`lineExtra=5`、`triggered` 正确；彩虹+普通清除数 ≥ 该色全盘数且 <64；[U] `mostCommonKind` 按 TILE_KINDS 顺序取并列 |
| REQ-013 | 彩虹+彩虹清空全盘（死格除外）、障碍各 −1、每格 60 分计倍率 | PASS | [U] 首轮 cleared=64、scoreGain=3840（c=1）；含死格棋盘 cleared 不含死格且死格仍为 hole |
| REQ-014 | `ROUND((60N+B+30S)×M(c))`；示例 180 / 435 / 3840；总分为整数 | PASS | [U] 三个基准示例逐条复算相等；(N,B,S,c) 6 组组合与独立公式一致；>100 轮真实结算逐轮复算一致 |
| REQ-015 | 仅有效交换扣 1 步，且整轮连锁结束后一次性扣；无效/重排/重开不扣 | PASS | [U] 无效交换步数不变；有效交换（含多轮连锁）步数恰 −1、`stats.movesUsed+1`；[P] 20→19 |
| REQ-016 | 结算后无可行交换且步数>0 → 保分布重排（不扣步）、播 shuffle 音并提示 2 秒；100 次失败重生成、再失败判负 | **FAIL** | 核心函数 `ensurePlayable` 单测通过（保分布、无新连、重排后有步、不扣步），但**全仓库无任何调用点**（`src/systems|ui|render` 检索 `ensurePlayable|shuffle` 仅命中 toast/sfx 文案），`resolveSwap` 结算后不检测 `hasAnyMove`。[U] 160 局随机对局出现 6 次「死局且 status=playing、步数>0」，`shuffle` 事件 0 次；[桌面复现] 第 8 关 seed=1 五步后卡死（详见 BUG-002） |
| REQ-017 | 6 状态枚举固定、非法转移抛错；settling 期间输入被忽略且状态/步数不变 | PASS | [U] `GAME_STATUSES` 与 5.2 转移表逐项；非法转移抛 `IllegalTransitionError`；[E] 结算/输入锁用例通过；[P] 拖动后 `status=settling` 期间无额外扣步 |
| REQ-018 | 目标达成即 won（含步数同时归零）；未达成且步数 0 → lost；否则继续 | PASS | [U] 1490 分 +1 步交换 → 1780 分、步数 0、`outcome=won`；0 分 +1 步 → `lost`；6 关 AND 目标未满足时即使分数超限仍 continue |
| REQ-019 | 重开：二次确认、新种子、分数/步数重置、历史记录不变、不写排行榜 | PASS | [U] `restartGame` 新种子/清零；[E] 重开确认后步数回 20、seed 改变、排行榜条数仍为 0；[W] 通关后重开不影响已写记录（记录数保持 1） |
| REQ-020 | 中途返回选关：本局作废、不写存档分数、不写排行榜、解锁进度与最高分保留 | PASS | [U] `abandonGame` 返回 `persist:false`/`settlementId:null` 且不改原 state；[E] 返回选关后排行榜 0 条；[P] 返回后存档无对局字段 |
| REQ-021 | 8 关线性解锁：初始仅第 1 关；≥1 星解锁下一关；未解锁点击不进入并显示「通过上一关解锁」；已解锁可无限重玩 | PASS | [P] 8 卡/锁 7 张、锁定文案「通过上一关解锁」；[W] 通关后解锁卡数=2 且刷新后保持；[U] `buildLevelCards` 逐关判定 |
| REQ-022 | 三类目标（分数/收集/障碍）AND 组合，全部满足才 won | PASS | [U] 6 关「火 18 + 分数 2000」任一未达均 continue，全达才 won |
| REQ-023 | 冰块 1 层、元素可匹配、该格消除时 −1 并破冰、计入障碍目标、不阻挡下落 | PASS | [U] 冰覆盖仍参与匹配；冰格下落后元素穿过；`goals.spec` 破冰计数；[B] `iceBroken` 统计与关卡 3/6/7 目标 |
| REQ-024 | 石块 2 层、占位不可匹配不可下落、相邻消除 −1、破坏后按普通格补充、破坏前阻挡 | PASS | [U] 石块格无元素且不参与匹配；石块阻挡本列下落、下方补充；破坏后下落恢复（`gravity.spec` 石破用例）；相邻消除计入 `damagedStones` |
| REQ-025 | 死格永久不可用、不被任何特化清除、阻挡下落；第 8 关 4 格坐标精确且为空 | PASS | [U] 第 8 关 (3,3)(3,6)(6,2)(6,7) 均 `hole` 且 `tile=null`；行清除与彩虹+彩虹均不涉及死格；死格阻挡下落 |
| REQ-026 | 1★=达成全部目标、2★/3★ 按分数阈值、失败 0★、封顶 3★；仅保留历史最高星级 | PASS | [U] 1500/1999→1★、2000/2599→2★、2600/999999→3★、失败→0；`maxStars(3,1)=3`；[W] 2790 分→3★ 与阈值一致；存档 `bestStars=max` |
| REQ-027 | D=需求点÷步数，逐关等于 0.750/0.818/0.900/1.083/1.154/1.462/1.564/1.833（±0.01），严格递增且相邻增幅 ≤0.35 | PASS | [U] 按第 6 章权重独立复算 8 关 D 与表值差 ≤0.001，增幅 0.068/0.082/0.183/0.071/0.308/0.102/0.269 均 ≤0.35 |
| REQ-028 | 结算面板显示关卡名/结果/本局分数/历史最高分/星级/剩余步数/逐项目标；胜利有下一关、失败隐藏；两个面板均有重开与返回选关；面板出现 300ms 内点击无效 | PASS | [W] 面板文本含「胜利/本局分数/历史最高分/剩余步数/★」，出现瞬间按钮 disabled、400ms 后可点；[U] `buildResultModel` 失败 `showNext=false`；[E] 严格 300ms 用例通过 |
| REQ-029 | 持久化字段集合、`saveVersion=1`、每关记录与设置/统计/updatedAt；读取时版本≠1 按损坏处理 | PASS | [U] 默认存档字段与 8.1 表逐项；写入 `saveVersion=1`；`version=2` → `{ok:false,reason:'version'}`；[P] 实际存档键为 saveVersion/lastSessionInterrupted/unlockedLevelId/levelRecords/settings/stats/updatedAt |
| REQ-030 | 仅四处写入；开局写 true、结算/返回写 false（结算合并 1 次）；不得写对局进行态；单次写入 ≤100ms 不阻塞；true 时进主菜单提示一次并立即写 false | PASS | [U] 结算 1 次 `setItem` 且标记合并、无 board/score/movesLeft/cascade 字段；解锁只升不降；同值不写盘；[P] 存档键枚举无对局字段、刷新后提示一次并写回 false、二次进入不再提示；写入实测 payload 1105 B、`setItem` 均值 0.005ms |
| REQ-031 | 解析失败/必填缺失/类型错误/版本≠1 → 备份到独立键（含时间戳）+ 默认初始化 + 5 秒「存档已重置」；仍可进第 1 关；`lastSessionInterrupted` 缺失按 false 不判损坏 | PASS | [U] 6 类损坏矩阵全部 `ok:false`；缺失 flag → `ok:true` 且 false；[P] 注入坏 JSON 后出现「存档已重置」、生成 1 个 `wmg.backup.save.<ISO>` 键、可正常进第 1 关；`TOAST_CORRUPT_MS=5000` |
| REQ-032 | localStorage 不可用或 QuotaExceededError → 内存存档 + 常驻提示条，功能不中断 | PASS | [P] 禁用 localStorage 后显示「当前为临时存档，刷新将丢失进度」且可开局、无 pageerror；[U] 抛异常与配额异常两条路径均降级内存且设置仍可读回 |
| REQ-033 | 重置进度：二次确认后清存档与排行榜，回第 1 关未通关，提示 3 秒 | PASS | [U] `resetProgress` 后 `unlockedLevelId=1`、星级/clearCount 归零、设置回默认；[E] 「重置进度回第 1 关并清空排行榜」通过；`TOAST_RESET_MS=3000` |
| REQ-034 | 本地榜：仅 localStorage、UI 出现「本地排行榜」、禁用「全球/在线/全服/服务器排名」、无任何网络请求 | PASS | [P] 与 [W] 界面文案含「本地排行榜」、4 个禁用词均未出现；[P] 第三方请求 0（共 9 个同源请求）；[U] 模型文案检索 0 命中 |
| REQ-035 | 记录字段 id/levelId/score/stars/movesUsed/achievedAt/seed；仅胜利写 1 条、失败不写、同局不重复 | PASS | [W] 通关写入 1 条，字段齐全（`{"id":"1-1794330801868-1","levelId":1,"score":2790,"stars":3,"movesUsed":6,...}`）；第 2 关失败后记录数仍为 1；[U] 同局重复 add 返回 `duplicate` |
| REQ-036 | 排序 score↓→movesUsed↑→achievedAt↑→id↑ | PASS | [U] 四键排序逐项验证；同分同步数不同达成时间先达成者在前；完全并列按 id 升序 |
| REQ-037 | 单关 ≤10、全局 ≤20、超限淘汰末位、写入后立即重排、界面按序展示前 10 且标注关卡 | PASS | [U] 15 条同关裁剪为 10 条（保留 114..105）；30 条跨关裁剪为 20 且每关 ≤10；[W] 首行含「第 1 关 起步/2790/★★★」与达成时间，含上限说明 |
| REQ-038 | 清空本地排行榜：二次确认（含「不可恢复」）、提示 3 秒、不影响进度与设置 | PASS | 代码：确认文案「本地排行榜数据不可恢复。确定清空吗？」；[U] 清空只删排行榜键、存档键保留；[E] 「清空入口二次确认并保持空态」通过 |
| REQ-039 | 6 种元素各有独立 64×64 贴图、形状互异；灰度后仍可两两区分（**3 人一致通过**） | **BLOCKED** | 机器部分 PASS：[A] 6 张 64×64 WebP 带 alpha、主色与 5.1 一致、形状/符号两两不同；灰度合成图 `out/J1-tiles-color-vs-grayscale.png`、整盘灰度 `out/J2-board-grayscale.png`，15 对平均灰度差最小 10.3/255（风险对：水/叶 10.3、水/火 11.5）。**规格明确要求「人工评审 3 人一致通过」，本轮无 3 名评审人 → 状态未完成，不判 PASS**（见 §7.1） |
| REQ-040 | 背景 1920×1080；棋盘绘制于逻辑 (224,96)、512×512；960×720 下元素与槽位对齐误差 ≤1px | **FAIL** | [P] 960×720 下 `e=0,f=0`、棋盘左上=(224,96) 对齐；但 1280×800 下 `e=106.7`（棋盘左上实际 355.6 vs 应为 248.9），600×800 下 `f=175`（235 vs 60），360×640/320×568 同型偏移。见 BUG-001 |
| REQ-041 | 渲染分辨率 = min(dpr,2)；缩放/旋转/DPR 变化 200ms 内重绘、不模糊、状态与步数不重置 | **FAIL** | DPR clamp 与状态保持通过（backing=CSS×min(dpr,2)；600/360/320 缩放后分数/步数不变），但绘制区域超出画布被裁（600×800：绘制 0..625 vs 画布 450；360×640：0..455 vs 270；320×568：0..404 vs 240），底部棋盘不可见。见 BUG-001 |
| REQ-042 | 任一图片加载失败 → 程序化占位、游戏可继续、仅 warn 一次、不弹错误框 | PASS | [M] 拦截 bg-main/board-frame/ui-panel 后：`warning: [assets] image unavailable, using placeholder: bg-main.webp` 仅 1 条、无弹窗、画面仍渲染、可继续操作；[U] 加载器 reject/无 URL 两条路径均返回占位且 warn 1 次 |
| REQ-043 | 色盲模式叠加高对比符号（★ ● ▲ ■ ◆ ✚）或纹理、状态持久化 | PASS | [M] 开启后画布像素变化、存档 `colorblindMode=true`、刷新后仍勾选；[U] 6 符号互异；[E] 设置即时生效用例通过 |
| REQ-044 | 150/200/180/160/300/200ms；减弱动效或 `prefers-reduced-motion` 时全部 ≤100ms 且无位移补间 | PASS（自动证据）；人工观测待补 | [U] 六类时长精确；[补测] `__wmgTest.motionDurations()`：full={swap:150,revert:200,clear:180,fall:160,special:300,panel:200}、reduced 全 100；`__wmgTest.animations()` 真实一局 trace=`swap:150 → special:300 → clear:180 → fall:160 → clear:180 → fall:160`；系统 reduced 偏好下 trace=`reduced-settle:100(R)`；[E] `motion.spec` 补间用例通过。**状态**：时长/无位移已由 trace 覆盖；「肉眼观测记录」未执行（见 §7.2） |
| REQ-045 | 首次手势后播放 BGM 并循环、接缝静音 ≤20ms；hidden 暂停、可见后从暂停点继续 | **FAIL（追溯）** | 功能实测通过：[M] 首屏音频请求 0、首次点击后请求 bgm-main.ogg；[U] `loop=true`、hidden 停止+suspend、visible 从 12.5s 偏移续播；浏览器解码 BGM：60.000s/48kHz/单声道、首末样本 −0.1334/−0.1303（无缝静音）。**但仓库无任何用例名含 REQ-045、也无 BGM 循环/可见性测试** → 追溯 FAIL（BUG-004） |
| REQ-046 | 13 事件与音效一一对应、每次 1 次、同音效 100ms 内 ≤1 次 | PASS | [U] `SFX_MAP` 13 键对应 13 个文件且磁盘存在 ogg+mp3；[U]/[E] 节流：0ms/50ms 只播 1 次、150ms 播第 2 次 |
| REQ-047 | BGM/音效独立开关、音量 0..100、默认 60/80、0..5 与 96..100 不失真、修改立即生效并写入存档、刷新保持 | PASS | [U] `volumeToGain(0)=0`、100→1、5/96 有限且 ∈[0,1]；默认 60/80；[M] 改音量 5 + 减弱动效 → 存档与刷新后 UI 一致；[E] 设置用例通过 |
| REQ-048 | 音频加载/解码失败 → 静默降级、不弹窗、可玩、显示「音频不可用」图标 | **FAIL（追溯）** | 功能实测通过：[U] 解码抛错时 `playSfx` resolve、`unavailable=true`；[M] 拦截全部 ogg/mp3 后「音频不可用」标记可见、仍可开局。**无用例名含 REQ-048，`audio.spec` 也无降级用例** → 追溯 FAIL（BUG-004） |
| REQ-049 | 最近邻吸附、中垂线热区不外溢、等距取列小者再行小者、矩形外忽略；主轴 ≥0.5 格判交换；触摸与鼠标同算法；分级像素要求（≥600 单格 ≥40、320≈21.33、360=24）；DOM 按钮 ≥44×44 且可 Tab/Enter | **FAIL** | 纯函数部分全通过（[U] 吸附/并列/矩形外/阈值/四视口单格尺寸；[M] 可见按钮最小边 ≥44、Tab+Enter 进入对局）。但**热区与绘制棋盘不一致**：点击视觉 (4,4) 实际吸附到 (4,5)@1280×800、(8,4)@600×800、(8,4)@360×640；差异像素中心偏移 72px（1 格）。见 BUG-001 |
| REQ-050 | `aria-live="polite"`、文本严格「分数 {score}，剩余步数 {moves}，目标 {progress}」、同秒 ≤1 次 | PASS | [U] `formatLiveText` 精确为「分数 500，剩余步数 12，目标 火 3/18；分数 500/2000」；[P] 实测真实文本「分数 885，剩余步数 19，目标 分数 885/1500」；`LiveRegion` 1s 节流 |
| REQ-051 | 连续 10 秒 p95 帧间隔 ≤20ms 且 ≥50fps 占比 ≥95%；`dist/` 静态托管可运行、第三方请求 0、首屏 ≤3.0MB | PASS | [M] 10s 采样 2400 帧 p95=4.30ms、≥50fps 占比 100%；[P] `python -m http.server` 托管 `dist/` 首屏可玩、第三方请求 0、首屏传输 198.8KB；[B] 构建产物 JS 152.63kB(gzip 69.64kB)+CSS 6.75kB |

---

## 2. 缺陷清单

### BUG-001（Critical）画布「双重留边偏移」：非 4:3 视口下棋盘错位、被裁切、点击命中错格

- **关联 REQ**：REQ-040、REQ-041、REQ-049（并影响 REQ-003 的实际可用性）
- **严重级别**：Critical（常规桌面 1280×800、移动竖屏 600×800/360×640/320×568 全部受影响；玩家点 A 格交换 B 格，且底部整块棋盘不可见）
- **最小复现步骤**
  1. `npm run build` → `python -m http.server 5055 --directory dist` → Chrome 打开 `http://127.0.0.1:5055/`
  2. 视口设为 600×800（或 1280×800），点击「1. 起步」进入第 1 关
  3. 观察：棋盘整体下移/右移，600×800 下第 5~8 行落在画布外不可见；1280×800 下棋盘右侧偏移、左侧出现约 213px 空带
  4. 用鼠标点击**视觉上**第 4 行第 4 列格子中心
- **期望值**（spec REQ-040/REQ-049）
  - 棋盘绘制于逻辑 (224, 96)、尺寸 512×512，按等比缩放投影出「棋盘投影矩形」，960×720 下元素与槽位对齐误差 ≤1px
  - 指针按下落在投影矩形内即选中「距其最近的格」，各格热区并集恰好覆盖投影矩形 → 点击视觉格 = 选中该格
- **实际值**
  - 绘制变换多叠加了一次留边偏移：1280×800 `e=106.7`（棋盘左上实际 x=355.6，应为 248.9）；600×800 `f=175`（实际 y=235，应为 60）；360×640 `f=185`；320×568 `f=164`
  - 场景绘制范围超出画布被裁：600×800 绘制 0..625 vs 画布高 450；360×640 0..455 vs 270；320×568 0..404 vs 240；1280×800 宽 0..1173.3 vs 1067
  - 点击视觉 (4,4) 实际吸附：1280×800 → (4,5)；600×800 → (8,4)；360×640 → (8,4)；仅 960×720（无留边）正确
- **证据**
  - `node .qa-verify/browser-prod.mjs` → 38 检查中 8 条 FAIL，全部为该问题的 `REQ-040/align-*` 与 `REQ-041/fit-*`（原始输出：`画布盒 1066.7×800.0 @(106.7,0.0)，绘制变换 e=106.7 f=0.0；棋盘左上应在画布内 (248.9,106.7)，实际 (355.6,106.7)`）
  - 选中高亮偏移实测：点击 (4,4) 后 `#game` 截图差异区域中心 x=676，而点击点画布内 x=604（相差 72px ≈ 1 格）
  - 截图：`.qa-verify/out/layout-600x800.png`（底部 3 行被裁）、`.qa-verify/out/layout-1280x800.png`（整体右偏、左侧空带）
  - 成因定位（只读证据）：`CanvasHost` 的 `canvasTransform(snapshot,dpr)` 使用 `computeLayout(window.innerWidth, window.innerHeight)` 的 `offsetX/offsetY`；而 `#game` 元素自身已按 4:3 居中（CSS `position:absolute; inset:0; margin:auto` + 宽高属性 = `cssWidth/cssHeight`），输入层 `screenToLogical` 仅按 canvas 矩形换算 → 渲染与命中相差一个 offset
- **影响评估**：`npx playwright test` 的 26 条 E2E 全绿，但其 `cellPoint()` 与输入层同用「canvas 矩形换算」，因此测试点击永远落在逻辑坐标、不会暴露视觉与热区不一致 → **现有 E2E 覆盖不到该缺陷**（本次为独立验收发现）

### BUG-002（High）REQ-016 无可行步重排未接入运行时：死局卡死，无重排、无提示

- **关联 REQ**：REQ-016（并违反 E-02）
- **严重级别**：High（对局被永久卡住；模拟 160 局出现 6 次，约 3.8%）
- **最小复现步骤**
  1. `npm run build:test` → 静态托管 `dist/`，Chrome 打开 `/?seed=1`
  2. `__wmgTest.startLevel(8)`（或先解锁第 8 关进入）
  3. 依次拖动 5 次：(1,2)→(1,3)、(3,5)→(4,5)、(1,6)→(1,7)、(1,6)→(2,6)、(1,3)→(1,4)
  4. 观察 HUD 与任意点击
- **期望值**：结算后检测到「无任何可产生匹配的相邻交换且剩余步数 > 0」→ 立即保分布重排（元素多重集不变）、不扣步、播 shuffle 音并提示「无可消除步骤，已重排」2 秒；重排 100 次失败则保留分布重生成，仍失败判负
- **实际值**：`status=playing`、`movesLeft=25`、`score=1170`、`findMove()=null`（全盘无合法交换），`#toast-root` 空，继续点击无任何反应（步数/分数/棋盘均不变），无 shuffle 音
- **证据**
  - 浏览器复现输出：`STATE {"status":"playing","levelId":8,"seed":1,"score":1170,"movesLeft":25}` / `findMove null` / `toastRoot ""` / `after click` 同值；`pageerror=[]`
  - 截图：`.qa-verify/out/G-deadlock-level8.png`
  - 规模验证：`npx vitest run --config .qa-verify/vitest.qa.config.ts .qa-verify/d-req016.spec.ts` → `{"games":160,"dead":6,"deadWithShuffleEvent":0,"settledDeadExample":{"level":8,"seed":1,"step":5,"movesLeft":25,"score":1170}}`
  - 代码证据：`ensurePlayable`（`src/core/board/shuffle.ts`）仅被 `src/core/index.ts` 重导出，`src/systems/**`、`src/ui/**`、`src/render/**` 内无任何调用点；`resolveSwap` 结算末尾只做 `evaluateOutcome`，不检测 `hasAnyMove`；`app.ts` 只在收到 `shuffle` 事件时播放音效与提示，而该事件永不会被产生
  - 说明：`ensurePlayable` 本身行为正确（[U] 保分布、重排后无立即三连且重新有步、不扣步）→ 属集成缺失，不是核心算法缺陷

### BUG-003（Low）MP3 回退音频时长与 spec 10.2 不符，两套格式时长不一致

- **关联 REQ**：REQ-045/REQ-046/REQ-048 的资源侧（第 10.2 章「统一格式…两套文件内容必须一致」与时长列）
- **严重级别**：Low（听感差异极小；Safari 回退路径受影响）
- **最小复现步骤**：`python .qa-verify/assets_check.py`（解析 OGG 末页 granule 与 MP3 帧头/帧数）
- **期望值**：14 个音频 OGG 与 MP3 时长均等于 spec 10.2 列值，且两套内容一致（如 sfx-click 0.08s、sfx-swap 0.12s、sfx-win 1.50s、bgm-main 60.0s）
- **实际值**：OGG 全部精确匹配；MP3 每个文件多 1 帧（24ms）或量化到 24ms 整倍：bgm 60.024、swap 0.144、invalid 0.192、match 0.288、cascade 0.336、special-line 0.432、special-rainbow 0.624、ice-break 0.336、stone-break 0.384、shuffle/star 0.528、win 1.536、lose 1.224、click 0.120（0.08 规格 +50%）
- **证据**：`.qa-verify/assets_check.py` 输出 `FAILS: 14`（全部为 MP3 时长）；OGG 侧 14/14 OK；体积 1879.2KB ≤ 2048KB
- **备注**：LAME/Info 帧在部分浏览器会被 gapless 裁剪，实际播放可能听不出差异；但按字节级时长与「两套一致」条款仍未达标

### BUG-004（Low）REQ-045、REQ-048 无任何自动化用例（追溯缺失）

- **关联 REQ**：REQ-045、REQ-048；同时违反 spec 第 7 章「用例名必须包含 REQ 编号」与本次任务规则第 4 条
- **严重级别**：Low（功能实测通过，但回归无保护）
- **最小复现步骤**
  1. `grep -r "REQ-045" tests/` → 0 命中；`grep -r "REQ-048" tests/` → 0 命中
  2. 阅读 `tests/systems/audio.spec.ts`：仅 3 个用例（REQ-046 映射、REQ-047 音量、REQ-046 节流），无 BGM 循环/可见性暂停、无解码失败降级
- **期望值**：REQ-045（BGM 首次手势后循环、hidden 暂停/visible 续播、接缝 ≤20ms）与 REQ-048（解码失败静默降级 + 「音频不可用」图标）各有命名含 REQ 编号的可执行用例
- **实际值**：二者均无；本次由验收方以 `.qa-verify/c-ui.spec.ts`、`browser-misc.mjs` 临时补测通过（BGM 60.000s/48kHz/单声道、首末样本 −0.1334/−0.1303；拦截音频后徽标可见）

### 观察项（不单独计为缺陷）

- **OBS-01** `tests/tmp-find-win.spec.ts` 调试用临时用例仍在 `npm test` 范围内（每次运行打印一段种子 JSON），不影响通过率但污染输出，建议移除。
- **OBS-02** spec 措辞冲突（未判 BLOCKED）：REQ-004 与 10.2 要求「落在棋盘外/石块/死格」播放 invalid 音效；3.3 与 REQ-049 写作「忽略…不播报错误」。按「播报 = aria-live 播报、音效 = 音效」可自洽（REQ-050 亦以「播报」指 aria-live）；实现取音效版，与 REQ-004/10.2 一致，本次按该解读验收。

---

## 3. 追溯完整性检查

### 3.1 REQ → TASK

- `tasks.md` 共 41 个 TASK；**51/51 条 REQ 均至少对应 1 个 TASK**，无孤儿任务、无未覆盖 REQ（脚本化解析 `|| TASK-… ||` 表格行并展开 `REQ-003,004,005,006` 形式的简写）。
- 复核要点：REQ-016 有 TASK-015（核心函数）但**缺「结算后调用」的集成任务**，导致缺陷可在「所有 TASK 完成」的情况下漏过 → 建议补一条集成任务或在 TASK-013/TASK-034 的 DoD 中显式加入「结算后无可行步 → 调用 ensurePlayable」。

### 3.2 REQ → 测试

- 49/51 条 REQ 至少被 1 个用例名（describe/it，含 `REQ-003/004/005/006` 简写）引用。
- **缺失 2 条**：REQ-045、REQ-048（详见 BUG-004）。
- 按 spec 第 7 章「用例名必须包含 REQ 编号」抽查：`tests/core/*`、`tests/render/*`、`tests/systems/*`、`tests/ui/*`、`tests/e2e/*` 的 describe 块普遍合规；`tests/tmp-find-win.spec.ts` 无 REQ 编号（见 OBS-01）。

### 3.3 测试有效性抽查（是否真能挡住缺陷）

| 检查点 | 结论 |
|---|---|
| BUG-001 是否被现有 E2E 覆盖 | **否**。`tests/e2e/helpers.ts#cellPoint` 与输入层同用「canvas 矩形等比换算」，点击永远落在逻辑坐标，无法对比「绘制位置 vs 热区位置」 |
| BUG-002 是否被现有测试覆盖 | **否**。`shuffle.spec.ts` 只测 `ensurePlayable` 纯函数；无「结算 → 无可行步 → 产生 shuffle 事件」的链路用例 |
| 300ms 面板输入锁 | 是（`settlement-strict.spec.ts` 用 page.clock 严格验证 t+200 无效、t+350 生效） |
| 存档损坏/版本/配额 | 是（`storage.spec.ts` 6 类损坏 + 配额；`persistence.spec.ts` 浏览器级） |
| 通关写榜 | 是（`settlement-strict.spec.ts` + 本次 [W] 独立复测） |

---

## 4. 验证执行记录（可复跑）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `npm run typecheck` | 0 error |
| 2 | `npm test` | 33 文件 / 192 用例全绿（含 `tmp-find-win.spec.ts`） |
| 3 | `npm run build` | 成功；`dist/assets/index-*.js` 152.63 kB（gzip 69.64 kB）、CSS 6.75 kB（gzip 2.14 kB）；产物内 `__wmgTest` 命中 0 |
| 4 | `npx playwright test` | 26/26 通过（Chrome；build:test + vite preview:4173） |
| 5 | `npx vitest run --config .qa-verify/vitest.qa.config.ts` | **83 独立检查全绿**（a-core 27 / b-board 27 / c-ui 26 / d-req016 2 / dump 1） |
| 6 | `node .qa-verify/browser-prod.mjs` | 38 检查：30 PASS / **8 FAIL**（全部为 BUG-001） |
| 7 | `node .qa-verify/browser-win.mjs` | 22/22 PASS（真实拖动通关第 1 关，6 步 2790 分 → 排行榜/存档/解锁/刷新） |
| 8 | `node .qa-verify/browser-misc.mjs` | 16/16 PASS（BGM 延迟加载、首屏 198.8KB、键盘可达、按钮 44px、色盲、缺图降级、音频降级、p95=4.30ms、≥50fps=100%） |
| 9 | `python .qa-verify/assets_check.py` | 33 图片尺寸/格式/alpha 全对；图片 77.4KB、音频 1879.2KB；**MP3 14 个时长不符（BUG-003）**；OGG 14/14 精确 |
| 10 | `node .qa-verify/browser-audio.mjs` | BGM 解码：60.000s / 48000Hz / 1ch；首末样本 −0.1334 / −0.1303（无接缝静音） |
| 11 | `node .qa-verify/browser-dead.mjs` | 第 8 关 seed=1 五步后 `status=playing, movesLeft=25, findMove=null`，无 shuffle 提示（BUG-002） |

**证据文件**：`g5-acceptance-report.md`（本报告）、`.qa-verify/`（审计脚本 + 输出）、`.qa-verify/out/*.png`：
`01/02/03`（选关/开局/交换后）、`A1~A3`（960×720 核心链路与损坏存档恢复）、`B-layout-600x800.png`、`B-layout-1280x800.png`、`layout-600x800.png`、`layout-1280x800.png`（BUG-001）、`G-deadlock-level8.png`（BUG-002）、`E1-victory-panel.png`、`E2-leaderboard.png`（通关写榜）、`F1-colorblind.png`、`F2b-missing-bg.png`、`F3-audio-unavailable.png`、`D-temporary-storage.png`。

---

## 5. 遗留（不可由自动化验收完成，非本轮缺陷判定依据）

1. **REQ-039 人工灰度评审**：spec 要求「3 人一致通过」；本次仅做机器代理（6 张 64×64 贴图形状/符号两两不同，灰度 15 对平均差最小 10.3/255），人工评审未执行。
2. **REQ-045 BGM 主观试听**：接缝静音已用波形测得（首末样本差 0.003、前后 20ms 无静音），但「听感/循环自然度」需真机人工确认。
3. **真机音频**：本轮环境无音频输出设备，播放/可见性切换仅在 WebAudio 桩与浏览器解码层验证（行为正确），未做扬声器实听。
4. **Firefox / WebKit**：`playwright.config.ts` 仅配置 Chrome（官方 Chromium 下载受网络限制），跨内核结果未覆盖。

---

## 6. 验收结论（复述）

**存在缺陷：4 个（Critical 1、High 1、Low 2）；REQ 维度 PASS 45 / FAIL 6 / BLOCKED 0。**

发布建议：**不建议以当前状态发布**。BUG-001、BUG-002 均需修复后重新提交独立验收（建议同时补充「绘制位置 vs 热区位置一致性」与「死局 → 重排」两条链路用例，避免回归）。


---

# 增补验收（第 2 轮，依据 Manager 基线口径）

> 触发：Manager 下发「验收基线」消息，要求补充：人工/环境项状态标注、实现方 4 项已知限制的独立判定、四视口吸附复测、6 类损坏存档复测、禁用词扫描口径、300ms 锁严格断言复核。
> 本轮未新增/修改任何产品代码与规格；仅追加测试构建（`build:test`）探测与证据。

## 7. 人工/环境项：验证方式与状态（不默认 PASS）

| 项 | 验证方式 | 状态 | 结论处理 |
|---|---|---|---|
| REQ-039 3 人灰度评审 | 机器代理（6 贴图灰度化 + 15 对像素差）+ 灰度对照图 `out/J1-tiles-color-vs-grayscale.png`、整盘灰度 `out/J2-board-grayscale.png`；**人工评审需 3 名评审人签署** | **未完成**（无 3 名评审人） | **REQ-039 判定改为 BLOCKED**（规格把「3 人一致通过」写为验收条件，不能以机器代理替代） |
| REQ-044 视觉时长 | `__wmgTest.motionDurations()` / `__wmgTest.animations()`（测试构建 + `?seed=1`）取得真实 trace；`prefers-reduced-motion` 上下文单独取 trace | 自动证据**已完成**；「人工肉眼观测记录」**未执行** | 仍判 PASS（数值与时序为规格条款，已由 trace 覆盖）；人工观测列为遗留 §8.2 |
| REQ-045~048 真机有声播放/切后台续播 | 本机无音频设备：WebAudio 桩（循环/hidden 暂停/可见续播）+ 浏览器 `decodeAudioData` 解码 BGM（60.000s/48kHz/单声道、首末样本 −0.1334/−0.1303）+ 拦截音频验证降级徽标 | 真机**未验证** | REQ-045/047 行为判 PASS（保留环境限制说明）；REQ-048 因**无用例**仍判 FAIL（追溯） |
| E2E 内核覆盖 | 仅系统 Chrome（`channel=chrome`，配置仅 chromium 项目） | Firefox/WebKit **未跑** | 记为**覆盖限制**，不计缺陷（与 Manager 口径一致） |

## 8. 四视口吸附复测（强化 BUG-001）

方法：在测试构建中按**绘制变换**算出「视觉格中心」并点击，再读 `__wmgTest.selected()`，比较「点到哪一格 / 实际选中哪一格」。

| 视口 | (1,1) | (4,4) | (2,7) | (8,8) | 结果 |
|---|---|---|---|---|---|
| 960×720（4:3 对照） | 1,1 ✓ | 4,4 ✓ | 2,7 ✓ | 8,8 ✓ | 全部一致（无留边时正常） |
| 1280×800 | → **1,2** | → **4,5** | → **2,8** | → null（点在画布外） | 整体右偏 1 格 |
| 600×800 | → **5,1** | → **8,4** | → **6,7** | → null | 整体下偏 ~4 格 |
| 360×640 | → null | → null | → null | → null | 点击点全在画布外 → **完全不可操作** |
| 320×568 | → null | → null | → null | → null | 同上 |

证据：`node .qa-verify/browser-supp.mjs`（4 条 `REQ-049/absorb-*` 全 FAIL）；截图 `out/B-layout-360x640.png`、`out/B-layout-320x568.png`、`out/layout-600x800.png`。
判定：**BUG-001 维持 Critical，且影响面比首轮更严重**——在 360/320 视口下画布内只剩上半部分棋盘，点击视觉位置甚至收不到事件。

## 9. 6 类损坏存档复测（浏览器级）

`localStorage['wmg.save.v1']` 分别注入 6 类损坏后刷新，逐项核对：提示文案、备份键数量、重建 saveVersion、能否进第 1 关。

| 损坏类型 | 提示 | 备份键 | 重建后 saveVersion | 可进第 1 关 | 结论 |
|---|---|---|---|---|---|
| JSON 解析失败 | 存档已重置 | 1 | 1 | 是 | PASS |
| 根节点非对象（`[]`） | 存档已重置 | 1 | 1 | 是 | PASS |
| 必填字段缺失（settings） | 存档已重置 | 1 | 1 | 是 | PASS |
| 字段类型错误（bgmEnabled='yes'） | 存档已重置 | 1 | 1 | 是 | PASS |
| 取值越界（unlockedLevelId=9） | 存档已重置 | 1 | 1 | 是 | PASS |
| saveVersion=2（不兼容） | 存档已重置 | 1 | 1 | 是 | PASS |

证据：`node .qa-verify/browser-supp.mjs` → 6 条 `REQ-031/*` 全 PASS。

## 10. 实现方「已知限制」的独立判定

| # | 实现方自述 | 独立判定 | 依据 |
|---|---|---|---|
| L1 | 特化步骤为缩放高亮，未绘制独立特化贴图入场 | **不构成缺陷** | 特化元素**静止态确实使用专用贴图**：`tile-renderer.ts` 按 `SPECIAL_IMAGE` 绘制 `special-line-h/v.webp`、`special-rainbow.webp`；浏览器截图 `out/I3-special-crop.png` 可见横向箭头特化；spec 未要求「入场贴图动画」，REQ-044 只规定特化触发 300ms（trace 实测 `special:300`） |
| L2 | 减弱动效下 swap/clear/fall/special 合并为一次 ≤100ms 快照 | **不构成缺陷** | 系统 reduced 偏好下 `animations()` 仅 `reduced-settle:100(R)`：满足「上述全部 ≤100ms 且无位移补间」；spec 未要求 reduced 下仍逐阶段播放 |
| L3 | 300ms 结算锁严格断言已补 | **已落地且稳定** | `tests/e2e/settlement-strict.spec.ts` 用 `page.clock` 断言面板出现瞬间 disabled、t+200ms 点击无效、t+350ms 可点；`npx playwright test settlement-strict --repeat-each=3` → **3/3 全通过**（每次 6.6s） |
| L4 | 极端长连锁 6s 预算下压缩视觉步长，trace 记录压缩后时长 | **不构成缺陷** | 「6s 预算」属 plan 级实现细节，spec 未设该条款；要求的结果/步数不被跳过由 `scene.spec`（超 6s 只压缩等待）与真实通关实测覆盖 |

## 11. 禁用词扫描（Manager 口径复算）

口径：只扫 REQ 正文与 CR 新增行；宪法 8.3 规则条款示例、CR 历史引述不计 FAIL。

| 扫描范围 | 全球 | 在线 | 全服 | 服务器排名 | 结论 |
|---|---|---|---|---|---|
| REQ-001~051 正文 | 1 | 1 | 1 | 1 | 4 处命中**全部位于 REQ-034 自身的禁令句**（「禁止出现「全球」「在线」「全服」「服务器排名」等表述」），非违规声明 → 不计 FAIL |
| 第 15 章 CR 新增行 | 0 | 0 | 0 | 0 | 无命中 |
| `dist/` 产物文案 | 0 | 0 | 0 | 0 | 无命中（REQ-034 的 UI 断言亦通过，见 [W]/[P]） |

脚本与原始输出：`.qa-verify/banned.py`、`.qa-verify/out/banned-scan.txt`。

## 12. 本轮复测汇总（Manager 指定项）

| 指定项 | 结果 | 证据 |
|---|---|---|
| 固定种子完整通关并写本地榜（score/stars/movesUsed/achievedAt/seed + 排序 score↓→moves↑→achievedAt↑→id） | PASS | [W] 6 步 2790 分 3★；记录 `{"id":"1-…-1","levelId":1,"score":2790,"stars":3,"movesUsed":6,"achievedAt":"…","seed":1}`；排序规则由 [U] 四键用例覆盖；失败局不写 |
| 损坏存档 6 类恢复 | PASS（6/6） | 本报告 §9 |
| 刷新后进度保留 + 一次「上一局已中断」 | PASS | [P] 刷新回选关、提示 1 次并写回 false、二次进入不再提示；解锁/最高分/排行榜保留 |
| 320/360/600/1280 四视口吸附热区 | **FAIL（BUG-001）** | 本报告 §8（1280 偏 1 格、600 偏 4 格、360/320 点击收不到事件）；单格 CSS 尺寸本身正确（85.33/40/24/21.33） |
| 无第三方网络请求 | PASS | [P] 第三方请求 0（9 个同源请求）；[M] 首屏 + 游戏过程均 0 |
| 300ms 锁严格断言 | PASS 且稳定 | §10 L3（repeat-each=3） |

## 13. 修订后的总结论

**存在缺陷（4 个：1× Critical、1× High、2× Low）。**

- REQ 维度（修订）：**PASS 44 / FAIL 6 / BLOCKED 1**
  - BLOCKED：REQ-039（3 人灰度评审未执行，规格明确的验收条件）
  - FAIL：REQ-016、REQ-040、REQ-041、REQ-049（BUG-001/BUG-002）+ REQ-045、REQ-048（追溯缺失，BUG-004）
- 缺陷清单不变：BUG-001（Critical）、BUG-002（High）、BUG-003（Low）、BUG-004（Low）；新增证据进一步确认 BUG-001 在 360/320 视口下使游戏**完全不可操作**。
- 仍需人工完成（不改变上述判定）：REQ-039 的 3 人灰度评审签署；REQ-044 肉眼观测记录；REQ-045~048 真机扬声器实听与切后台续播。
