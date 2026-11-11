# TASK-31 / BUG-005 + BUG-006 修复报告

- TASK-ID：TASK-31（对齐 CR-010 的测试断言 + 消除 hashed URL 正则空转）
- 对应 REQ：REQ-003、REQ-004、REQ-006、REQ-049（音效侧关联 REQ-046 invalid 事件面）
- 规格基线：`specs/001-core-game/spec.md` v1.1.4（CR-010），未修改 spec / plan / tasks
- 结论：**未改 `src/`**（复核后确认实现与 CR-010 一致）；测试从「断言错误」和「断言空转」两类失效中修复，`npm test` 220/220、`npx playwright test` 41/41 全绿，并附两个方向的负控灵敏度证明
- 证据目录：`docs/task-31-evidence/`

---

## 1. 修改文件清单

| 文件 | 变更 | SHA-256 |
|---|---|---|
| `tests/e2e/sfx-probe.ts` | 新增：页内音效探针（fetch → decodeAudioData → AudioBufferSourceNode.start 三段关联）+ 哈希容忍正则 + 灵敏度自检 helper | `C2EC0AD6775607FA19F2BE9921099939BAF8F08DD845A8EFD692BFE69BD37222` |
| `tests/e2e/outside-board.spec.ts` | 重写音效断言：改用探针 + 哈希容忍正则；每个 A 类用例末尾追加 B 类灵敏度自检 | `DA098FD5BD9D17922C916A90F7A4A87746773593ED68E321C1E28B61A2818E26` |
| `tests/e2e/invalid-sfx.spec.ts` | 新增：CR-010 四类落点 E2E（同格 / 非相邻 / 相邻无匹配 / 石块 / 死格） | `3DC19D4512972B728F62044AFD07F587CADCC715C4EA93F3EE1FCA5F01A03DA7` |
| `tests/ui/input.spec.ts` | 同格 / 非相邻用例补「无 invalid、无 swap」断言；原「位移未达阈值且换格 → invalid」用例按 CR-010 重命名为「B 类（相邻）」并补 no-swap 断言 | `535D38E95333C60B2922F05E8829DC99843FC3F02141F684200F987F218E478A` |
| `docs/task-31-evidence/*` | 复跑与负控原始日志 | — |

`src/`、`spec.md`、`plan.md`、`tasks.md`：**零改动**。

---

## 2. BUG-005：测试断言对齐 CR-010

### 2.1 复核结论：实现符合 v1.1.4，无需改产品代码

| CR-010 条款 | 实现位置 | 复核结果 |
|---|---|---|
| 同格点击＝取消选中、不播 invalid | `src/ui/input/board-input.ts` `handleClick()` 同格分支 → `deselect` | 符合（app 对 `deselect` 不播任何音效） |
| 非相邻点击＝选中转移、不播 invalid | 同函数非相邻分支 → `selected = cell` + `select` | 符合 |
| A 类（棋盘外 / 石块 / 死格）静默、不播 invalid | `press()`/`release()` 的 `cell === null`、`!isSelectable()` 早退 | 符合 |
| 仅「相邻有效格交换后无匹配」播 1 次 invalid | `src/systems/app.ts` `handleSwap()` 的 `rejected || rounds.length === 0` 分支 → `sfx('swap')` + `sfx('invalid')` + `revert` + `clearSelection()` | 符合（E2E 实测 invalid 播放恰好 1 次、步数/分数不变） |

补充的几何说明（供评审理解「输入层 invalid 分支为何只剩相邻一种」）：拖拽阈值 = 0.5 × `cellCssSize`，而相邻格热区中垂线也恰在 0.5 格处；指针从一个格跨到**非相邻**格至少要移动 1 格，必然 ≥ 阈值而走 `swap` 分支。因此 `release()` 中「未达阈值但换格 → invalid」在几何上只可能落到相邻格，与 CR-010 收窄后的 B 类口径一致。

### 2.2 断言变化（`tests/ui/input.spec.ts`）

| 用例 | 修改前 | 修改后 |
|---|---|---|
| 点击自身 / 点击非相邻 | 只断言 `deselect` / `select`，**未断言不发 invalid**（BUG-005 的测试盲区：错误期望曾被 G7 指为「把错误行为固化为期望」，而正确行为反而没有显式保护） | 断言 `deselect` / `select` + 区间内**无 `invalid`、无 `swap`**，并断言选中态（`null` / 转移目标） |
| 「两个有效格、位移未达阈值且不是同一格 → invalid」 | 名称与 CR-010 的 B 类定义（相邻 + 无匹配）不对应，易被误读为「任意换格都 invalid」 | 更名为「B 类（相邻）：位移未达阈值但抬起点落在相邻格 → invalid，选中清空」，补 `无 swap` 断言与 CR-010 口径注释 |

单测数量不变（220），因为改的是既有用例的期望与断言强度，不是新增覆盖点。

---

## 3. BUG-006：hashed URL 正则空转 → 实际播放事件断言

### 3.1 空转根因与取证

构建产物文件名被 Vite 哈希化：`dist/assets/sfx-invalid-BqsWogSh.ogg`。
`tests/e2e/outside-board.spec.ts:26` 旧正则 `/sfx-invalid\.(ogg|mp3)(\?|$)/` 要求 `sfx-invalid` 后**紧跟** `.ogg/.mp3`，对哈希名恒为 `false`，于是 `expect(invalidSfx).toEqual([])` 永远成立（3 个 A 类用例、共 3 处空转断言）。

`docs/task-31-evidence/regex-proof.txt`：

```
url=http://127.0.0.1:4173/assets/sfx-invalid-BqsWogSh.ogg
old_regex=false
new_regex=true
audio_live_route_regex=true
```

### 3.2 新断言体系（三层证据）

`tests/e2e/sfx-probe.ts` 在任何页面脚本之前注入：

1. 包装 `fetch`：记录请求 URL，并把 `response.arrayBuffer()` 返回的 `ArrayBuffer` 与 URL 建立 `WeakMap` 关联；
2. 包装 `BaseAudioContext.prototype.decodeAudioData`：把解码产物 `AudioBuffer` 与 URL 关联（因此不依赖文件名、也不依赖时长阈值，OGG / MP3 两条回退路径都适用）；
3. 包装 `AudioBufferSourceNode.prototype.start`：记录**实际开始播放**的 URL 与 buffer duration。

判定口径：

- `invalidStarts`：mark 之后 `start()` 且 URL 命中 `/sfx-invalid[^/]*\.(ogg|mp3)(\?|$)/` 的次数（主证据）；
- `invalidFetches`：同一正则下的请求次数（辅证，防止「播放了但走了缓存」时主证据缺失时误判）；
- `unlabelledStarts`：无法映射回 URL 的播放次数；**>0 直接判失败**，避免探针失效后再次出现「静默全绿」。

### 3.3 断言前后对照

| 位置 | 修改前 | 修改后 |
|---|---|---|
| `outside-board.spec.ts` 3 个 A 类用例 | `expect(invalidSfx).toEqual([])`（请求正则，哈希名恒 false → 空转） | `invalidStarts=0` + `invalidFetches=0` + `unlabelledStarts=0`，且每个用例末尾跑一次 B 类**灵敏度自检**（同会话必须记到 ≥1 次 invalid 播放） |
| 新增 `invalid-sfx.spec.ts` B 类相邻无匹配 | 无 E2E 覆盖（G7 曾用独立用例发现） | `invalidStarts === 1`、`invalidFetches === 1`、`movesLeft/score` 不变、选中清空 |
| 新增同格 / 非相邻 / 石块 / 死格用例 | 无 E2E 音效断言 | 四个用例均 `invalidStarts=0`、`invalidFetches=0`，且各自末尾跑灵敏度自检 |

A 类 3 个用例 + 同格 / 非相邻 / 石块 / 死格 4 个用例 = **7 个「无 invalid」断言，全部在同会话内被 B 类自检「点亮」**，因此不是空转。

### 3.4 其他 e2e 巡检（任务第 3 项）

逐文件扫描 `tests/**` 中含 `sfx-` / `ogg|mp3` / `AudioBuffer` 的断言：

| 位置 | 结论 |
|---|---|
| `tests/e2e/outside-board.spec.ts` | **唯一**一处 hashed URL 正则空转，已修 |
| `tests/e2e/audio-live.spec.ts:33` `page.route(/\.(ogg|mp3)(\?|$)/)` | 无问题：只要求以 `.ogg/.mp3` 结尾，哈希名可匹配（`regex-proof.txt` 第 4 行实测 `true`） |
| `tests/e2e/audio-network.spec.ts` | 只统计第三方域请求，无文件名匹配 |
| `tests/e2e/motion.spec.ts`、`tests/systems/audio.spec.ts` | 断言的是 tween / 引擎内部事件，不走 URL 匹配 |
| 其余 e2e | 无 sfx URL 断言 |

---

## 4. 灵敏度证明（不是空转的实证）

临时负控用例 `tests/e2e/zz-negative-control.spec.ts`（跑完已删除，原始输出 `docs/task-31-evidence/negative-control.txt`）：

| 负控 | 场景 | 探针实测 | 故意反向的断言 | 结果 |
|---|---|---|---|---|
| NEG-CONTROL 1 | 真跑「相邻无匹配」B 类交换 | `invalidStarts = 1`，`invalidFetches = 1` | `expect(invalidStarts).toBe(0)` | **按预期失败**：`Expected: 0 / Received: 1` → 证明「0 次」断言真的会抓到 invalid 播放 |
| NEG-CONTROL 2 | 只做 A 类棋盘外点击 | `invalidStarts = 0`，`invalidFetches = 0` | `expect(invalidStarts).toBeGreaterThanOrEqual(1)` | **按预期失败**：`Expected: >= 1 / Received: 0` → 证明「≥1 次」断言不会无条件通过 |

两个负控都失败 = 断言在两个方向都有灵敏度；正式用例则全部通过（B 类记到 1 次、A 类/同格/非相邻记到 0 次）。

补充：`outside-board.spec.ts` 与 `invalid-sfx.spec.ts` 中每个「无 invalid」用例末尾都内嵌 `expectInvalidSfxProbeSensitivity()`，在同一 page 会话重载到 `seed=20261110` 第 1 关真跑一次 B 类交换并 poll 到 `invalidStarts ≥ 1`。这样**单个用例**即可自证：探针在该会话是活的，前面的 0 次不是空转。

---

## 5. 测试命令与结果

| 命令 | 结果 | 证据 |
|---|---|---|
| `npm run typecheck` | PASS（exit 0） | `docs/task-31-evidence/typecheck.txt` |
| `npm test` | PASS：34 files / **220 tests** | `docs/task-31-evidence/npm-test.txt` |
| `npx playwright test` | PASS：**41 tests**（原 36 + 新增 5） | `docs/task-31-evidence/e2e-full.txt` |
| 构建 | E2E `webServer` 执行 `npm run build:test`（`tsc --noEmit && vite build --mode test`）成功，`strictPort` 4173 正常起来 | `e2e-full.txt` 中 WebServer 启动段 |

E2E 新增/改动用例清单：

```
tests/e2e/invalid-sfx.spec.ts:43  同格点击（已选中 A 再点 A）→ 取消选中，无 invalid 播放
tests/e2e/invalid-sfx.spec.ts:60  非相邻点击（已选中 A 点非相邻 B）→ 选中转移，无 invalid 播放
tests/e2e/invalid-sfx.spec.ts:77  相邻交换后无匹配（B 类）→ 播放 invalid 1 次，不扣步、分数不变
tests/e2e/invalid-sfx.spec.ts:97  石块格落点（A 类）→ 静默忽略，选中保持，无 invalid 播放
tests/e2e/invalid-sfx.spec.ts:114 死格落点（A 类）→ 静默忽略，选中保持，无 invalid 播放
tests/e2e/outside-board.spec.ts   3 个 A 类用例改用探针 + 灵敏度自检
```

自测步骤（可复现）：

1. `npm run typecheck` → 无输出错误，exit 0。
2. `npm test` → `Test Files 34 passed / Tests 220 passed`。
3. `npx playwright test` → `41 passed`。
4. 复现 BUG-006 空转证据：`node -e` 用旧/新正则分别测试 `http://127.0.0.1:4173/assets/sfx-invalid-BqsWogSh.ogg` → `false` / `true`。

---

## 6. 已知限制 / 需 Manager 裁决

1. **`tasks.md` TASK-027 DoD 与 CR-010 冲突（文档漂移，未改）**
   `specs/001-core-game/tasks.md:599` 仍写「非相邻/同格/无匹配 → invalid 事件（B 类）」，与 v1.1.4 相反。CR-010 明确本 CR 不改 tasks/plan，且旧表述以 CR 为准；本任务按规则未修改 `tasks.md`，建议由 Manager 在下一轮文档对齐中同步该行（否则后续执行者仍可能照旧写错测试，正是 BUG-005 的成因）。
2. **spec 第 15 章 CR-008 / CR-009 历史行仍描述旧口径（历史记录，未改）**
   CR-008/CR-009 条目正文保留「同格 / 非相邻 → 播 invalid」的当时裁决，属不可改的历史记录；当前有效口径只看 REQ-003 / REQ-004 / E-01b / E-01c / 第 10.2 章（CR-010 已统一）。建议 QA 复核时以 CR-010 五处口径为准。
3. **输入层边界语义（低风险，行为已存在，未改）**
   `release()` 中「位移 < 阈值但抬起点已跨进相邻格」会 emit `invalid`（播 1 次 invalid、清空选中），而不是按 REQ-003「位移 < 0.5 格视为点击」把这次手势当作对抬起格的点击（无选中时应只是「选中该格」）。该分支只在按下点距格边界 < 0.5 格、且位移刚好跨过中垂线时触发；本次按 Manager 指示「保留相邻无匹配 → invalid 断言」，`input.spec` 的 `B 类（相邻）` 用例即固定了当前行为。若 Manager 认为该边界应严格按「点击」处理，需要新开 CR 并同时改 `src/ui/input/board-input.ts` 的 `release()` 与该用例（本任务范围内不改 `src/`）。
4. **「无音效」断言的观察窗口**
   零断言用 `settleSfx()`（600ms）等待 fetch → decode → start 走完；本地 preview 下远快于该窗口，且同用例的 B 类自检会在同一会话再验证探针可用。若未来在极慢设备上 decode 超过 600ms，理论上存在「音效在断言之后才 start」的漏检；需要时可把窗口改为「等 `audio()` 解锁 + 网络 idle」的自适应等待。
5. **E2E 仅覆盖 Chromium (Chrome channel)**
   探针按 URL 归类，不依赖 OGG/MP3 的时长差异，因此格式回退路径本身不受影响；但 Safari（MP3 回退 + 用户手势策略差异）未纳入本次自动化验证范围。
