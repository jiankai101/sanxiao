# 001-core-game 任务清单（tasks.md）

- 特性编号：001-core-game
- 文档版本：v1.1.3
- 上游：`/specs/001-core-game/spec.md` v1.1.4（51 条 REQ，CR-008 / CR-009 / CR-010 已统一命中失败口径：仅相邻无匹配播 invalid，同格 / 非相邻不播）、`/specs/001-core-game/plan.md` v1.1.3（G2 技术方案）、`/specs/constitution.md` v1.1.1
- 最近变更：v1.1.3（2026-11-11，TASK-008 / TASK-027 的 DoD 与实施要点按 CR-010 对齐：A 类静默忽略；同格＝取消选中、非相邻＝选中转移，均不交换 / 不扣步 / 分数不变 / 不播 invalid；仅相邻有效格交换后无匹配＝200ms 回弹 + 1 次 invalid 音效；TASK 编号、REQ 映射、依赖与文件边界零改动）
- 角色：`impl-core`、`impl-systems`、`asset-maker`
- 粒度：每个任务 0.25 或 0.5 个工作日，均 ≤ 半天
- 验收：无孤儿任务、无未覆盖 REQ、每条 TASK 有可测 DoD、三角色文件边界无重叠

---

## 0. 阅读说明

### 0.1 任务状态口径

- `REQ` 列是任务的**需求来源**；一个任务至少对应 1 条 REQ，否则视为孤儿任务。
- `依赖` 列是硬前置；依赖未完成不得开工。
- `DoD` 全部为可执行/可观察的断言，不接受“看起来完成”。
- 命中失败口径（spec v1.1.4，CR-008 / CR-009 / CR-010）：**A 类**（棋盘投影矩形外 / 石块格 / 死格）静默忽略——不改变选中态、不交换、不扣步、分数不变、**不播 invalid 音效**、不做 aria 播报；**同格点击**＝取消选中、**非相邻点击**＝选中转移，两者均不构成交换尝试——不交换、不扣步、分数不变、**不播 invalid 音效**；**B 类**（相邻有效格交换后无匹配）——200ms 回弹、不扣步、分数不变、**播 1 次 invalid 音效**、交换后选中态清空。TASK-008 / TASK-027 / TASK-036 的 DoD 按此口径验收。
- `SC-xx` 指 `plan.md` 第 18 章的规格冲突与裁决记录。SC-01 / SC-02 / SC-05 已裁决（CR-003 / CR-004 / CR-005），对应 DoD 已解除挂起并按裁决口径改写；SC-03 / SC-04 / SC-07 为架构口径，不改 REQ、不阻塞验收。

### 0.2 角色与文件硬边界

| 角色 | 可写路径 | 禁止写入 |
|---|---|---|
| impl-core | `src/core/**`、`src/render/**`、`tests/core/**`、`tests/render/**` | `src/systems/**`、`src/ui/**`、`assets/**`、`index.html`、`vite.config.ts`、`package.json`、`tsconfig.json`、`tests/e2e/**` |
| impl-systems | `src/systems/**`、`src/ui/**`、`index.html`、`vite.config.ts`、`package.json`、`tsconfig.json`、`vitest.config.ts`、`playwright.config.ts`、`tests/systems/**`、`tests/ui/**`、`tests/e2e/**` | `src/core/**`、`src/render/**`、`assets/**` |
| asset-maker | `assets/**`（含 `assets/manifest.md`） | `src/**`、`tests/**`、`index.html`、`vite.config.ts`、`package.json` |

共享契约 `src/core/types.ts` 由 impl-core 维护；impl-systems 只读/import，不得并行修改。需要改契约时，先由 impl-core 在 TASK-002 变更并通知，再改下游。

> 任务描述中的「vite 配置」在本方案中涵盖 `package.json`、`tsconfig.json`、`vitest.config.ts`、`playwright.config.ts` 等构建/测试配置；这些文件不与 `src/core|render` 或 `assets` 重叠。`tests/**` 按角色隔离（core/render vs systems/ui/e2e）。

### 0.3 并行组

| 组 | 含义 | 可并行任务 |
|---|---|---|
| G0 | 骨架/资源规范 | TASK-001、TASK-004 |
| G1 | 契约/关卡/资源生产 | TASK-002、TASK-003、TASK-038、TASK-039、TASK-040 |
| G2 | 核心基础 + 存储 + 渲染宿主 | TASK-005、TASK-006、TASK-009、TASK-018、TASK-024、TASK-026、TASK-028、TASK-033 |
| G3 | 匹配/交换/特化/存档服务 | TASK-007、TASK-008、TASK-010、TASK-012、TASK-014、TASK-019、TASK-025 |
| G4 | 连锁/目标/渲染动画 | TASK-011、TASK-013、TASK-015、TASK-016、TASK-017、TASK-020、TASK-021、TASK-027、TASK-029、TASK-031、TASK-032 |
| G5 | 集成 | TASK-022、TASK-023、TASK-030 |
| G6 | 装配 | TASK-034 |
| G7 | E2E/性能 | TASK-035、TASK-036、TASK-037、TASK-041 |

> G0-G7 是建议排期，不是强制串行；只要满足每行的硬依赖，同组/跨组可并行。关键路径见第 4 章。

---

## 1. 任务总览

| TASK-ID | 标题 | 角色 | REQ | 依赖 | 预估 | 组 |
|---|---|---|---|---|---|---:|
| TASK-001 | 工程骨架与构建链 | impl-systems | REQ-051 | — | 0.5d | G0 |
| TASK-002 | 核心契约与数值常量 | impl-core | REQ-001,002,014,027,044 | TASK-001 | 0.5d | G1 |
| TASK-003 | 8 关数据与校验 | impl-systems | REQ-021,022,025,027 | TASK-002 | 0.5d | G1 |
| TASK-004 | 资源规范与 manifest | asset-maker | REQ-039,040 | — | 0.5d | G0 |
| TASK-005 | 种子 PRNG | impl-core | REQ-002 | TASK-002 | 0.25d | G2 |
| TASK-006 | 初始棋盘与障碍布局 | impl-core | REQ-001,025 | TASK-002,005 | 0.5d | G2 |
| TASK-007 | 匹配检测 | impl-core | REQ-007 | TASK-006 | 0.5d | G3 |
| TASK-008 | 交换合法性与回弹 | impl-core | REQ-003,004,005,006 | TASK-006,007 | 0.5d | G3 |
| TASK-009 | 计分器 | impl-core | REQ-009,014 | TASK-002 | 0.5d | G2 |
| TASK-010 | 特化生成 | impl-core | REQ-010,011 | TASK-007,009 | 0.5d | G3 |
| TASK-011 | 特化触发 | impl-core | REQ-012,013 | TASK-009,010 | 0.5d | G4 |
| TASK-012 | 重力/补充/障碍 | impl-core | REQ-008,023,024 | TASK-006,007 | 0.5d | G3 |
| TASK-013 | 连锁结算引擎 | impl-core | REQ-009,015,018,022 | TASK-008,009,010,011,012 | 0.5d | G4 |
| TASK-014 | 状态机与输入锁 | impl-core | REQ-017,018 | TASK-002 | 0.5d | G3 |
| TASK-015 | 无可行步重排 | impl-core | REQ-016 | TASK-006,007,013 | 0.5d | G4 |
| TASK-016 | 目标进度与星级 | impl-core | REQ-022,023,024,026 | TASK-003,013 | 0.5d | G4 |
| TASK-017 | 对局编排 API | impl-core | REQ-019,020 | TASK-013,014,015,016 | 0.5d | G4 |
| TASK-018 | Canvas 宿主/DPR/坐标 | impl-core | REQ-040,041,049 | TASK-002 | 0.5d | G2 |
| TASK-019 | 资源加载与占位 | impl-core | REQ-039,042 | TASK-004,018 | 0.5d | G3 |
| TASK-020 | 棋盘/元素/障碍绘制 | impl-core | REQ-039,040,043 | TASK-018,019 | 0.5d | G4 |
| TASK-021 | 动画与减弱动效 | impl-core | REQ-017,044 | TASK-018,020 | 0.5d | G4 |
| TASK-022 | 主循环/粒子/帧预算 | impl-core | REQ-051 | TASK-018,021 | 0.5d | G5 |
| TASK-023 | 渲染集成层 | impl-core | REQ-040,044,051 | TASK-013,020,021,022 | 0.5d | G5 |
| TASK-024 | 存档仓储/校验/降级 | impl-systems | REQ-029,031,032 | TASK-001,002,003 | 0.5d | G2 |
| TASK-025 | 存档写入/重置 | impl-systems | REQ-030,033 | TASK-024 | 0.5d | G3 |
| TASK-026 | 本地排行榜仓储 | impl-systems | REQ-034,035,036,037,038 | TASK-001,002 | 0.5d | G2 |
| TASK-027 | 输入抽象 | impl-systems | REQ-003,004,049 | TASK-018 | 0.5d | G4 |
| TASK-028 | HUD 与 aria-live | impl-systems | REQ-050 | TASK-002 | 0.5d | G2 |
| TASK-029 | 选关与解锁 | impl-systems | REQ-021,026 | TASK-003,024,028 | 0.5d | G4 |
| TASK-030 | 结算面板/局内操作 | impl-systems | REQ-019,020,028 | TASK-025,026,028,029 | 0.5d | G5 |
| TASK-031 | 设置页 | impl-systems | REQ-033,038,043,047 | TASK-024,025,026,028 | 0.5d | G4 |
| TASK-032 | 本地排行榜界面 | impl-systems | REQ-034,036,037,038 | TASK-026,028 | 0.5d | G4 |
| TASK-033 | 音频引擎 | impl-systems | REQ-045,046,047,048 | TASK-001,002,004 | 0.5d | G2 |
| TASK-034 | 应用装配与降级 | impl-systems | REQ-030, REQ-051 | TASK-017,023,027,028,030,031,032,033 | 0.5d | G6 |
| TASK-035 | E2E 核心链路 | impl-systems | REQ-019,020,028,030,033 | TASK-034 | 0.5d | G7 |
| TASK-036 | E2E 输入/可访问性/音频/网络 | impl-systems | REQ-034,041,043,045,047,049,050 | TASK-031,033,034 | 0.5d | G7 |
| TASK-037 | 性能与发布验收 | impl-systems | REQ-034,044,051 | TASK-035,036 | 0.5d | G7 |
| TASK-038 | 元素/特化/障碍贴图 | asset-maker | REQ-039,042 | TASK-004 | 0.5d | G1 |
| TASK-039 | 背景/边框/面板/图标 | asset-maker | REQ-040 | TASK-004 | 0.5d | G1 |
| TASK-040 | BGM 与 13 事件音效 | asset-maker | REQ-045,046,048 | TASK-004 | 0.5d | G1 |
| TASK-041 | 资源验收与体积报告 | asset-maker | REQ-039,040,042,051 | TASK-020,038,039,040 | 0.5d | G7 |

**总计：41 个任务；按 0.25/0.5 天计约 20.25 人日。**

---

## 2. 任务详情
### TASK-001 工程骨架与构建链

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G0
- 对应 REQ：REQ-051
- 前置：无
- 产出：
  - `package.json`、`package-lock.json`、`tsconfig.json`、`vite.config.ts`、`vitest.config.ts`、`playwright.config.ts`、`.gitignore`
  - `index.html`（`#app`、`canvas#game`、`#game-live`、noscript/降级容器）
  - `src/systems/main.ts` 最小启动桩（仅 import app，不写业务规则）
- 实施要点：
  - `dependencies` 空；`devDependencies` 6 个包：`typescript`、`vite`、`vitest`、`@playwright/test`、`@types/node`、`@vitest/coverage-v8`（CR-005 放行，仅测试期，不进入运行时产物）。
  - `strict: true`、`noEmit`、`moduleResolution: bundler`；路径别名 `@core/*`、`@render/*`、`@systems/*`、`@ui/*`。
  - Vite `base: './'`、`publicDir: false`；`__TEST__` 由 `mode === 'test'` 注入。
  - scripts 按 plan 16.1，并新增 `test:coverage`: `vitest run --coverage --coverage.provider=v8`。
  - `vitest.config.ts`：`test.coverage.provider='v8'`、`coverage.include=['src/core/**']`、`coverage.reporter=['text','json-summary']`、`thresholds { lines: 80, branches: 70 }`。
- DoD：
  - [ ] `npm ci` 成功；`npm run typecheck` 0 error。
  - [ ] `npm run build` 生成 `dist/index.html` 与至少 1 个 JS/CSS 资源；`npm run preview` 可打开。
  - [ ] `package.json.dependencies` 为空对象；devDependencies 键集合恰为上述 6 个包（无多余包）。
  - [ ] `index.html` 含 canvas、`#game-live[aria-live="polite"]`、`#app`。
  - [ ] 构建产物无 `console.debug`；无第三方 URL。
  - [ ] `npm run test -- --passWithNoTests` 成功。
  - [ ] `npm run test:coverage -- --passWithNoTests` 可执行；`coverage.include` 仅含 `src/core/**`；阈值配置为行 80 / 分支 70。
- 验证：`npm ci && npm run typecheck && npm run build && npm run test -- --passWithNoTests`

### TASK-002 核心契约与数值常量

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G1
- 对应 REQ：REQ-001, REQ-002, REQ-014, REQ-027, REQ-044
- 前置：TASK-001
- 产出：`src/core/types.ts`、`src/core/constants.ts`、`src/core/errors.ts`、`src/core/index.ts`、`tests/core/constants.spec.ts`、`tests/core/purity.spec.ts`
- 实施要点：
  - 定义 `TileKind`、`SpecialKind`、`Tile`、`Cell`、`Board`、`GameState`、`RoundResult`、`GameEvent`、`Goal`、`LevelConfig`。
  - 常量逐项来自 spec 5.1/5.2/5.3/5.6 与 REQ-044；每个常量注释 `// spec 5.x / REQ-xxx`。
  - 定义 `DomainError`、`IllegalTransitionError`、`BoardInitError`。
  - 不写具体算法；算法任务依赖本任务。
- DoD：
  - [ ] 常量测试逐项断言 plan 附录 A 的值（棋盘/计分/动画/重试/阈值）。
  - [ ] `types.ts` 可被 `JSON.stringify` 的结构无函数、无 Map/Set、无循环引用。
  - [ ] 扫描 `src/core/**` 不含 `window`、`document`、`Math.random`、`Date.now`、`performance.now`。
  - [ ] `src/core/index.ts` 只导出公共 API；无 `any`。
- 验证：`npm run test -- tests/core/constants.spec.ts tests/core/purity.spec.ts`

### TASK-003 8 关数据与校验

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G1
- 对应 REQ：REQ-021, REQ-022, REQ-025, REQ-027
- 前置：TASK-002
- 产出：`src/systems/level/types.ts`、`src/systems/level/levels.ts`、`src/systems/level/validate.ts`、`tests/systems/levels.spec.ts`
- 实施要点：
  - `src/systems/level/types.ts` 只从 `@core/types` 重导出关卡类型，不重复定义。
  - 8 关数据逐项照录 spec 第 6 章；步数 `[20,22,24,24,26,26,28,30]`；第 5-8 关 5 种元素。
  - 障碍坐标采用 plan 13.3 的建议；第 8 关死格必须精确。
  - `validateLevels()` 校验坐标、数量、目标元素、D、星级、步数、ID 连续性。
  - 不实现业务算法；只提供数据与校验。
- DoD：
  - [ ] 8 关 ID 1..8 连续；名称/目标/步数/星级与 spec 表逐项相等。
  - [ ] D 重算误差 ≤0.01，严格递增，相邻增幅 ≤0.35。
  - [ ] 第 8 关死格集合等于 `{(3,3),(3,6),(6,2),(6,7)}`。
  - [ ] 冰块/石块数量、区域约束全部通过；无坐标越界/重叠。
  - [ ] 第 2 关 2★=1800（不得改成 2000）。
- 验证：`npm run test -- tests/systems/levels.spec.ts`

### TASK-004 资源规范与 manifest

- 角色：asset-maker ｜ 预估：0.5d ｜ 组：G0
- 对应 REQ：REQ-039, REQ-040
- 前置：无
- 产出：`assets/manifest.md`（含 33 个图片 + 28 个音频文件的清单、尺寸、格式、主色、体积上限、验收记录模板）
- 实施要点：
  - 逐项列出 spec 10.1/10.2 的全部文件名；标注 64×64、1920×1080、560×560、720×520、SVG 尺寸。
  - 定义 6 种元素的形状/主色/灰度区分要点；色盲符号 ★ ● ▲ ■ ◆ ✚。
  - 定义音频 OGG/MP3 双格式、时长、码率、循环点要求。
  - 只写资源规范，不写代码。
- DoD：
  - [ ] manifest 覆盖 33 个图片文件与 28 个音频文件（14 个名称 ×2 格式），无遗漏/多余。
  - [ ] 每个资源有用途、尺寸/时长、格式、体积上限。
  - [ ] 6 种元素形状与主色与 spec 5.1 完全一致。
  - [ ] 含“灰度两两可辨”的人工评审记录模板（3 人）。
- 验证：人工对照 spec 10.1/10.2 清单逐项勾选。

### TASK-005 种子 PRNG

- 角色：impl-core ｜ 预估：0.25d ｜ 组：G2
- 对应 REQ：REQ-002
- 前置：TASK-002
- 产出：`src/core/rng.ts`、`tests/core/rng.spec.ts`
- 实施要点：
  - mulberry32 纯函数；`Rng` 封装 `nextUint32/nextInt/pick/shuffle`。
  - 状态 uint32；每次调用返回新状态，不修改入参。
  - 拒绝采样实现无偏 `nextInt`；Fisher-Yates 返回新数组。
- DoD：
  - [ ] 固定 seed 的前 100 个输出与黄金值一致（测试内固化）。
  - [ ] 两次相同 seed/调用序列输出完全一致。
  - [ ] `nextInt(6)` 在 60,000 次采样中每个值出现次数在 9,000-11,000（健康检查）。
  - [ ] `shuffle` 不修改入参；元素多重集保持不变。
  - [ ] 无 `Math.random`。
- 验证：`npm run test -- tests/core/rng.spec.ts`

### TASK-006 初始棋盘与障碍布局

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G2
- 对应 REQ：REQ-001, REQ-025
- 前置：TASK-002, TASK-005
- 产出：`src/core/board/model.ts`、`src/core/board/generate.ts`、`tests/core/generate.spec.ts`
- 实施要点：
  - 按 LevelConfig 放置冰块/石块/死格；冰块保留 tile 位，石块/死格为空。
  - 行优先填充，避免左侧 2/上方 2 同种；1000 次重试；`BoardInitError`。
  - `hasAnyMove` 检测至少 1 个可行交换；彩虹存在时直接视为有解。
  - 提供 `toIndex/toRowCol/getCell` 等纯查询。
- DoD：
  - [ ] 固定 200 个种子生成的棋盘均 64 格、无初始三连、至少 1 个可行交换。
  - [ ] 第 8 关 4 个死格为空且无 tile；石块格为空；冰块格有 tile。
  - [ ] 强制 `hasAnyMove=false` 的桩在 1000 次后抛 `BoardInitError`，不无限循环。
  - [ ] 相同 seed 生成结果深相等。
- 验证：`npm run test -- tests/core/generate.spec.ts`

### TASK-007 匹配检测

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G3
- 对应 REQ：REQ-007
- 前置：TASK-006
- 产出：`src/core/match/detect.ts`、`tests/core/match.spec.ts`
- 实施要点：
  - 扫描 8 行 + 8 列，生成最长连续 run（≥3）；返回 `{runs, matched}`。
  - L/T 形按并集去重；冰块下元素参与；石块/死格跳过。
  - 不拆分重叠 run；6 连只生成 1 个 length=6 的 run。
- DoD：
  - [ ] 横 3/竖 3/横 4/竖 5 用例全部命中。
  - [ ] L 形与 T 形：交叉格只出现 1 次；消除集合等于并集。
  - [ ] 冰块格可匹配；石块/死格不参与。
  - [ ] 6 连返回 1 个 run（length=6），不返回两个重叠 3 连。
- 验证：`npm run test -- tests/core/match.spec.ts`

### TASK-008 交换合法性与回弹

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G3
- 对应 REQ：REQ-003, REQ-004, REQ-005, REQ-006
- 前置：TASK-006, TASK-007
- 产出：`src/core/board/swap.ts`、`tests/core/swap.spec.ts`
- 实施要点：
  - 校验越界、同格、非相邻、石块/死格/空；返回 `rejected` 原因。
  - A/B 类口径（CR-008 / CR-010）：A 类（越界 / 石块 / 死格）正常由输入层拦截、不进入本函数，本任务不为该路径产出任何音效事件。
  - 非相邻 / 同格 / 无匹配 / 越界 / 障碍格均返回 `rejected` 语义与原因码；同格＝取消选中、非相邻＝选中转移，均不构成交换尝试，不播 `sfx-invalid`。仅 B 类（相邻有效格交换后无匹配）由 UI 侧播放 1 次 `sfx-invalid` 并 200ms 回弹；本任务只产出 `rejected` 语义与原因码。
  - 交换后调用 `findMatches`；无匹配回退到原棋盘快照。
  - 彩虹+普通、彩虹+彩虹直接有效；彩虹+直线特化按 REQ-005 判定（SC-07）。
  - 不修改 `movesLeft`；扣步由 TASK-013 统一做。
- DoD：
  - [ ] 非相邻/同格/无匹配/越界/障碍格均 `rejected` 且棋盘深相等；原因码区分 `blocked`（A 类防御分支）、`not-adjacent`（同格 / 非相邻，正常选中操作）与 `no-match`（相邻无匹配，B 类）。
  - [ ] 本层不播放 `sfx-invalid`：音效仅由 UI 在「相邻有效格交换后无匹配」B 类路径触发；同格 / 非相邻 / A 类均不触发。
  - [ ] 有效交换保留，返回匹配 runs；无效交换回退后棋盘/分数/步数不变。
  - [ ] 彩虹+普通、彩虹+彩虹即使无三连也 `valid`；彩虹+直线特化无三连时 `rejected`。
  - [ ] 返回对象可 JSON 往返。
- 验证：`npm run test -- tests/core/swap.spec.ts`

### TASK-009 计分器

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G2
- 对应 REQ：REQ-009, REQ-014
- 前置：TASK-002
- 产出：`src/core/score/score.ts`、`tests/core/score.spec.ts`
- 实施要点：
  - `M(c) = min(1 + 0.5*(c-1), 4.0)`；`scoreGain = Math.round((60*N + B + 30*S) * M(c))`。
  - B：每个 4 连 +50、每个 ≥5 连 +120；S：直线特化额外波及格数。
  - 输出整数；拒绝 NaN/Infinity（抛 DomainError）。
- DoD：
  - [ ] 3 连 c=1 → 180；4 连 c=2 → 435；彩虹+彩虹 64 格 c=1 → 3840。
  - [ ] c=1..8 倍率序列 `[1,1.5,2,2.5,3,3.5,4,4]`。
  - [ ] 两处 4 连 B=100；一处 5 连 B=120；S=3 时额外 +90（在倍率前）。
  - [ ] 结果均为整数、非 NaN。
- 验证：`npm run test -- tests/core/score.spec.ts`

### TASK-010 特化生成

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G3
- 对应 REQ：REQ-010, REQ-011
- 前置：TASK-007, TASK-009
- 产出：`src/core/special/generate.ts`、`tests/core/special-generate.spec.ts`
- 实施要点：
  - 4 连 → 横/竖直线；≥5 连 → 彩虹；位置裁决顺序见 plan 8.5。
  - 同轮两处 4 连生成 2 个；位置冲突时按 run 长度/索引顺延。
  - 新特化替换原元素，不计入本轮 N。
- DoD：
  - [ ] 横 4 连生成 `line-h`，竖 4 连生成 `line-v`；位置符合目标格/最左/最上规则。
  - [ ] 5 连生成 1 个 `rainbow`，`kind=null`；不再额外生成直线。
  - [ ] 同轮两处 4 连生成 2 个特化，坐标互不重叠。
  - [ ] 交换两格都在 run 中时，按“目标格→源格→最左/最上”唯一裁决（固定用例）。
  - [ ] 生成的特化不计入该轮 N（计分测试断言）。
- 验证：`npm run test -- tests/core/special-generate.spec.ts`

### TASK-011 特化触发

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G4
- 对应 REQ：REQ-012, REQ-013
- 前置：TASK-009, TASK-010
- 产出：`src/core/special/trigger.ts`、`tests/core/special-trigger.spec.ts`
- 实施要点：
  - 直线清整行/整列，冰块/石块 -1；额外格计入 S。
  - 彩虹+普通清同色；彩虹被波及时取数量最多颜色，按星/水滴/叶/火/晶/电顺序破并列。
  - 彩虹+彩虹清全盘（死格除外），障碍 -1，N=64、S=0 时得 3840。
  - 特化连锁用 visited 防重复；未定义组合按 SC-07。
- DoD：
  - [ ] 横线清整行、竖线清整列；石块/冰块各 -1；死格不变。
  - [ ] S 只统计直线额外波及格；重复波及只计一次。
  - [ ] 彩虹+普通清全盘该颜色；彩虹被波及时按数量最多颜色，并列按元素顺序。
  - [ ] 彩虹+彩虹清 64 格、障碍 -1、c=1 得 3840。
  - [ ] 特化连锁不重复触发同一特化（visited 测试）。
- 验证：`npm run test -- tests/core/special-trigger.spec.ts`

### TASK-012 重力/补充/障碍

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G3
- 对应 REQ：REQ-008, REQ-023, REQ-024
- 前置：TASK-006, TASK-007
- 产出：`src/core/board/gravity.ts`、`tests/core/gravity.spec.ts`
- 实施要点：
  - 逐列按石块/死格分段；段内元素稳定下移；顶部补充。
  - 冰块不阻挡；石块破坏前阻挡；死格永久阻挡。
  - 补充等概率：6 种各 1/6，5 种各 1/5。
  - 返回 `moves` 与 `spawned` 供动画。
- DoD：
  - [ ] 消除后同列元素下移，列内无悬空；顺序稳定。
  - [ ] 石块/死格上下分段，上方元素不穿过；冰块不阻挡。
  - [ ] 石块 2→1→0 后该格可下落并在顶部补充。
  - [ ] 固定种子 10,000 次补充的 kind 分布偏差 <5%。
  - [ ] 下落完成后 64 格无 `undefined`（空仅限石块/死格）。
- 验证：`npm run test -- tests/core/gravity.spec.ts`

### TASK-013 连锁结算引擎

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G4
- 对应 REQ：REQ-009, REQ-015, REQ-018, REQ-022
- 前置：TASK-008, TASK-009, TASK-010, TASK-011, TASK-012
- 产出：`src/core/resolve.ts`、`tests/core/resolve.spec.ts`
- 实施要点：
  - 循环：匹配→生成特化→扩展清除→计分→消除→重力→c+1；无匹配结束。
  - 完整结算后 `movesLeft -= 1` 一次；无效交换不进入。
  - 胜负只在结束后判定一次；先判目标，再判步数。
  - 返回 `rounds/events/outcome`；不写存档。
- DoD：
  - [ ] 单次 3 连：1 轮、180 分、步数 -1。
  - [ ] 构造 2 轮连锁：倍率 1.5，总分等于两轮公式和。
  - [ ] 步数只在最后 -1；无效交换步数不变。
  - [ ] 目标达成且步数同时为 0 → `won`；目标未达成且步数 0 → `lost`。
  - [ ] 相同 seed/操作序列两次运行 rounds/score 深相等。
- 验证：`npm run test -- tests/core/resolve.spec.ts`

### TASK-014 状态机与输入锁

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G3
- 对应 REQ：REQ-017, REQ-018
- 前置：TASK-002
- 产出：`src/core/state-machine.ts`、`tests/core/state-machine.spec.ts`
- 实施要点：
  - 6 状态与 plan 5.2 转移表；非法转移抛 `IllegalTransitionError`。
  - 提供 `canAcceptInput(state, now, inputUnlockAt)`。
  - 不依赖时间；`now`/`inputUnlockAt` 由参数传入。
- DoD：
  - [ ] 合法转移逐条通过；非法转移（如 playing→won）抛错。
  - [ ] `settling` 与 result 前 300ms `canAcceptInput=false`。
  - [ ] 状态枚举字符串与 REQ-017 完全一致。
  - [ ] 无 `Date.now`/`performance.now`。
- 验证：`npm run test -- tests/core/state-machine.spec.ts`
### TASK-015 无可行步重排

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G4
- 对应 REQ：REQ-016
- 前置：TASK-006, TASK-007, TASK-013
- 产出：`src/core/board/shuffle.ts`、`tests/core/shuffle.spec.ts`
- 实施要点：
  - `hasAnyMove`；无可行步且 movesLeft>0 时重排。
  - 保分布 Fisher-Yates；100 次；失败后同多重集重新落位 100 次；仍失败判负。
  - 不扣步；返回 shuffle 事件；重排后不得立即三连。
- DoD：
  - [ ] 构造无可行步棋盘 → 重排后有可行步、元素多重集不变。
  - [ ] 桩强制 100 次失败 → 进入重生成分支；再失败 → `lost`。
  - [ ] 重排不改变 `movesLeft`、`score`。
  - [ ] 重排后无初始三连。
- 验证：`npm run test -- tests/core/shuffle.spec.ts`

### TASK-016 目标进度与星级

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G4
- 对应 REQ：REQ-022, REQ-023, REQ-024, REQ-026
- 前置：TASK-003, TASK-013
- 产出：`src/core/goals.ts`、`tests/core/goals.spec.ts`
- 实施要点：
  - 三类目标进度：score/collect/obstacle；AND 判定。
  - 冰破/石破计数来自 RoundResult；收集计数按 kind。
  - 星级：失败 0；胜利 1/2/3；`maxStars` 保留历史最高。
- DoD：
  - [ ] 三类目标各 1 个用例；任一未达成 → 不胜利。
  - [ ] 冰/石只有层数归零才计数；第 8 关死格不计。
  - [ ] 阈值-1/阈值/阈值+1 的星级边界正确；3★ 封顶。
  - [ ] `maxStars(2,1)=2`，低星不覆盖高星。
- 验证：`npm run test -- tests/core/goals.spec.ts`

### TASK-017 对局编排 API

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G4
- 对应 REQ：REQ-019, REQ-020
- 前置：TASK-013, TASK-014, TASK-015, TASK-016
- 产出：`src/core/game.ts`、`tests/core/game.spec.ts`
- 实施要点：
  - `createGame(level, seed)`、`restartGame(state, newSeed)`、`abandonGame(state)`。
  - 重开重置分数/步数/目标；保留历史记录由 systems 负责，core 不写存储。
  - 退出返回“无持久化副作用”的结果；不生成排行榜记录。
- DoD：
  - [ ] 重开使用新种子，分数 0、步数为关卡初始值、目标进度清零。
  - [ ] 退出返回 `persist: false` 语义；不产生结算事件。
  - [ ] core 无 storage/network/DOM import。
  - [ ] 非法 levelId 抛 DomainError。
- 验证：`npm run test -- tests/core/game.spec.ts`

### TASK-018 Canvas 宿主/DPR/坐标

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G2
- 对应 REQ：REQ-040, REQ-041, REQ-049
- 前置：TASK-002
- 产出：`src/render/canvas-host.ts`、`src/render/layout.ts`、`tests/render/layout.spec.ts`
- 实施要点：
  - 逻辑 960×720；CSS 等比缩放、4:3、letterbox；`ResizeObserver`。
  - 导出 `cellCssSize(viewportWidth) = 64 × viewportWidth ÷ 960` 与常量 `HOTZONE_BREAKPOINT_CSS_PX = 600`、`HOTZONE_MIN_CELL_CSS_PX = 40`。
  - DPR = `min(devicePixelRatio, 2)`；resize 后 200ms 内重绘。
  - 屏幕↔逻辑坐标换算；`pickNearestCell(logical, snapshot)` 做最近邻吸附，返回 `(row,col)` 或 `null`（中垂线划分 + 等距列优先再行优先）。
  - 监听 `ResizeObserver`、`window.resize`、`matchMedia` DPR 变化；200ms debounce。
  - SC-01 已按 CR-003 关闭：实现最近邻吸附 + 600 px 分级像素，不再存在移动端挂起项。
- DoD：
  - [ ] 960×720 逻辑布局常量正确；棋盘 (224,96)、512×512。
  - [ ] DPR 1/2/3 下 backing store 尺寸正确；DPR 3 时按 2 处理。
  - [ ] resize/旋转后 200ms 内触发重绘，状态不重置（测试桩）。
  - [ ] 屏幕中心点映射回逻辑中心；棋盘四角映射误差 <1px。
  - [ ] `pickNearestCell`：格内任意点吸附到该格；相邻格中心连线的中垂线点上按「列小者优先→行小者优先」裁决；投影矩形外返回 `null`。
  - [ ] `cellCssSize`：1280→85.33、600→40、360→24、320→21.33（误差 ≤0.01，覆盖断点两侧 599/600/601）。
  - [ ] 视口 ≥600 px 时单格热区 ≥40×40；<600 px 无下限、实测等于 `cellCssSize`（不挂起、不 skip）。
- 验证：`npm run test -- tests/render/layout.spec.ts`

### TASK-019 资源加载与占位

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G3
- 对应 REQ：REQ-039, REQ-042
- 前置：TASK-004, TASK-018
- 产出：`src/render/assets.ts`、`src/render/placeholders.ts`、`tests/render/assets.spec.ts`
- 实施要点：
  - `import.meta.glob` 建立 33 图片 + 28 音频 URL 映射；按文件名取 URL。
  - 图片 onerror → 占位；仅 console.warn 一次；不弹窗。
  - 占位形状与正式元素一致，保证灰度可辨。
- DoD：
  - [ ] 资源映射覆盖 manifest 的全部 33 个图片文件名。
  - [ ] 模拟 1 个 404：返回占位、只 warn 一次、不抛异常。
  - [ ] 占位绘制调用包含 6 种形状；颜色与主色一致。
  - [ ] 资源缺失时游戏逻辑仍可继续（渲染桩测试）。
- 验证：`npm run test -- tests/render/assets.spec.ts`

### TASK-020 棋盘/元素/障碍绘制

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G4
- 对应 REQ：REQ-039, REQ-040, REQ-043
- 前置：TASK-018, TASK-019
- 产出：`src/render/board-renderer.ts`、`src/render/tile-renderer.ts`、`tests/render/draw-calls.spec.ts`
- 实施要点：
  - 背景/外框/槽位/元素/冰块/石块/死格/选中/色盲符号。
  - 元素对齐 `(224+col*64, 96+row*64)`；误差 ≤1px。
  - 色盲符号 ★ ● ▲ ■ ◆ ✚；白/黑描边。
- DoD：
  - [ ] 64 个槽位坐标断言正确；元素绘制矩形 64×64；对齐误差 ≤1px。
  - [ ] 6 种元素使用不同贴图/形状；灰度信息由形状区分（截图/绘制参数断言）。
  - [ ] 冰块叠加在元素下方；石块按 2/1 层贴图；死格无元素。
  - [ ] 色盲模式为 6 种元素各绘制对应符号；关闭时不绘制。
  - [ ] 选中格有高亮描边。
- 验证：`npm run test -- tests/render/draw-calls.spec.ts` + 手工截图对照

### TASK-021 动画与减弱动效

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G4
- 对应 REQ：REQ-017, REQ-044
- 前置：TASK-018, TASK-020
- 产出：`src/render/animation.ts`、`tests/render/animation.spec.ts`
- 实施要点：
  - 时间轴：交换 150、回弹 200、消除 180、下落 160、特化 300、面板 200。
  - `prefers-reduced-motion` 或设置开关 → 全部 ≤100ms 且无位移补间。
  - 提供 `inputUnlockAt` 回调；面板 300ms 锁。
- DoD：
  - [ ] 6 类动画时长常量与 REQ-044 逐项相等。
  - [ ] reduced 模式下每类时长 ≤100ms，位移补间为 0。
  - [ ] 动画结束回调只触发一次；最终状态与起始状态快照一致。
  - [ ] 面板 300ms 内 `canAcceptInput=false`。
- 验证：`npm run test -- tests/render/animation.spec.ts`

### TASK-022 主循环/粒子/帧预算

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G5
- 对应 REQ：REQ-051
- 前置：TASK-018, TASK-021
- 产出：`src/render/loop.ts`、`src/render/fx.ts`、`tests/render/loop.spec.ts`
- 实施要点：
  - 单 rAF；`visibilitychange` 取消/恢复；恢复不追帧。
  - 帧间隔环形缓冲 600；计算 p95、<50fps 占比。
  - 粒子对象池上限 64；背景离屏预渲染。
- DoD：
  - [ ] 模拟 600 帧，p95 计算正确；统计 API 返回样本数。
  - [ ] hidden 后 rAF 取消；visible 后 `lastTs` 重置，无补帧。
  - [ ] 粒子超过 64 时复用最旧，不新增对象。
  - [ ] 绘制回调打点 ≤8ms（测试桩环境下逻辑开销断言）。
- 验证：`npm run test -- tests/render/loop.spec.ts`

### TASK-023 渲染集成层

- 角色：impl-core ｜ 预估：0.5d ｜ 组：G5
- 对应 REQ：REQ-040, REQ-044, REQ-051
- 前置：TASK-013, TASK-020, TASK-021, TASK-022
- 产出：`src/render/scene.ts`、`tests/render/scene.spec.ts`
- 实施要点：
  - 消费 `ResolveResult.rounds/events`，按轮播放交换→消除→下落。
  - 只读快照；不修改 core state；播放完调用 `onCommit`。
  - 连锁轮次间隔正确；6 秒总时长保护（只压缩等待，不跳结果）。
- DoD：
  - [ ] 给定 2 轮 ResolveResult，播放顺序为 round1 clear/fall → round2 clear/fall。
  - [ ] 事件与动画一一对应；无事件遗漏/重复。
  - [ ] `onCommit` 在全部动画结束后只调用一次，传入最终 state。
  - [ ] 渲染过程不修改传入 state（深比较）。
- 验证：`npm run test -- tests/render/scene.spec.ts`

### TASK-024 存档仓储/校验/降级

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G2
- 对应 REQ：REQ-029, REQ-031, REQ-032
- 前置：TASK-001, TASK-002, TASK-003
- 产出：`src/systems/storage/schema.ts`、`save-store.ts`、`memory-store.ts`、`migrations.ts`、`tests/systems/storage.spec.ts`
- 实施要点：
  - `SaveDataV1`、默认值、6 类损坏样本、备份键、内存降级。
  - `StorageLike` 注入，测试用内存实现；不依赖 jsdom。
  - 存档/排行榜独立键。
- DoD：
  - [ ] 默认存档 8 条记录、字段/默认值与 spec 8.1 一致。
  - [ ] 6 类损坏（JSON 错、缺字段、类型错、版本 2、范围错、日期错）各自备份 + 重置 + `recovered=true`。
  - [ ] 备份键含 ISO 时间戳；原值可读。
  - [ ] `setItem` 抛 QuotaExceeded → 内存降级；后续读写正常；`temporary=true`。
  - [ ] 单次写入 <100ms（10KB payload 基准）。
  - [ ] 存档损坏不影响排行榜键。
- 验证：`npm run test -- tests/systems/storage.spec.ts`

### TASK-025 存档写入/重置

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G3
- 对应 REQ：REQ-030, REQ-033
- 前置：TASK-024
- 产出：`src/systems/storage/save-service.ts`、`tests/systems/save-service.spec.ts`
- 实施要点：
  - 四个写入入口，与 REQ-030 四处写入时机一一对应：`recordSettlement`、`updateSettings`、`unlockNextLevel`、`setSessionInterrupted`；无第五入口。
  - 结算/返回关卡选择时把 `lastSessionInterrupted` 置 `false`，与结算数据合并为**一次** `setItem`；开局置 `true`。
  - 胜/负都写 bestScore/lastPlayedAt/stats；bestStars/clearCount 仅胜。
  - 重置进度：二次确认后清存档+排行榜，回第 1 关；3s 提示。
- DoD：
  - [ ] 结算写 1 次；设置写 1 次；解锁写 1 次；中断标记置位/清除各 1 次；中途退出 0 次结算写入。
  - [ ] 结算路径 `setItem` 调用次数 = 1（标记与结算数据合并写入，spy 断言）。
  - [ ] 标记写入不增加任何对局快照字段（序列化结果键集合与 REQ-029 字段表逐一比对）。
  - [ ] 失败不增加 clearCount/bestStars；胜利按 max 更新。
  - [ ] 重开不写排行榜、不覆盖历史最高。
  - [ ] 重置后 unlockedLevelId=1、8 条记录归零、排行榜空。
  - [ ] 写入调用次数用 spy 断言，无额外写入。
- 验证：`npm run test -- tests/systems/save-service.spec.ts`

### TASK-026 本地排行榜仓储

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G2
- 对应 REQ：REQ-034, REQ-035, REQ-036, REQ-037, REQ-038
- 前置：TASK-001, TASK-002
- 产出：`src/systems/leaderboard/schema.ts`、`sort.ts`、`prune.ts`、`store.ts`、`tests/systems/leaderboard.spec.ts`
- 实施要点：
  - `LeaderboardDataV1`；记录字段与 spec 9.2 一致；`achievedAt` 是达成时间戳，不是单局耗时（CR-002）。
  - 比较器：score desc → movesUsed asc → achievedAt asc → id asc。
  - 单关 10、全局 20；写入后立即重排/淘汰。
  - 仅胜利写 1 条；settlementId 幂等；清空不影响存档。
- DoD：
  - [ ] 字段完整、类型/范围校验；损坏备份 + 空榜。
  - [ ] 同分/同步数/同时间排序用例通过；id 兜底稳定。
  - [ ] 第 11 条同关记录淘汰末位；第 21 条全局记录淘汰末位。
  - [ ] 同一 settlementId 写两次只保留 1 条。
  - [ ] 清空后存档键不变；UI 文案「本地排行榜」可检索。
- 验证：`npm run test -- tests/systems/leaderboard.spec.ts`

### TASK-027 输入抽象

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G4
- 对应 REQ：REQ-003, REQ-004, REQ-049
- 前置：TASK-018
- 产出：`src/ui/input/pointer.ts`、`src/ui/input/board-input.ts`、`tests/ui/input.spec.ts`
- 实施要点：
  - Pointer Events 统一鼠标/触摸；只处理主指针；`setPointerCapture`。
  - 阈值 `DRAG_THRESHOLD_CELL_RATIO = 0.5`：主轴位移 ≥ 0.5 格宽/高判交换；< 0.5 格判点击。固定 16 CSS px 阈值已废止（CR-003）。
  - 棋盘外/石块/死格 → 静默忽略（A 类：不改变选中态、不扣步、不播 invalid 音效、无 aria 播报），不产生 invalid 事件；settling 忽略；`touch-action:none`。
  - 同格点击＝取消选中、非相邻有效格点击＝选中转移；两者均不构成交换尝试，不交换、不扣步、分数不变、不播 invalid 音效（CR-010）。
  - 命中直接调用 `layout.pickNearestCell`（不另写坐标换算）；热区为中垂线划分，不外扩、不重叠；鼠标与触摸同算法。
- DoD：
  - [ ] 鼠标拖拽与触摸滑动产生相同 `swap` 语义事件。
  - [ ] 主轴位移 < 0.5 格视为点击；≥ 0.5 格且目标相邻触发交换；阈值随 `cellCssSize` 变化（320/360/600/1280 四档各验一次）。
  - [ ] 同格点击＝取消选中、非相邻点击＝选中转移：两者均不交换、不扣步、分数不变、不产生 invalid 事件；仅相邻有效格交换后无匹配 → 200ms 回弹 + 1 次 invalid 音效（B 类），不扣步；棋盘外/石块/死格 → 静默忽略（A 类），不产生 invalid 事件、不扣步、选中态不变。
  - [ ] `pointercancel`、多指第二指不产生交换。
  - [ ] 吸附：格内任意点命中该格；中垂线等距点按列优先再行优先；投影矩形外 → 静默忽略（A 类：不扣步、不播 invalid 音效、不做 aria 播报、选中态不变）。
  - [ ] 斜向拖拽只取主轴（`|dx| ≥ |dy|` 为水平）；吸附为 `null` 时不进入位移判定。
  - [ ] 同一组坐标序列，鼠标与触摸产生完全相同的 `swap` 语义事件（共用 `pickNearestCell`，无触摸分支）。
- 验证：`npm run test -- tests/ui/input.spec.ts`

### TASK-028 HUD 与 aria-live

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G2
- 对应 REQ：REQ-050
- 前置：TASK-002
- 产出：`src/ui/hud.ts`、`src/ui/live-region.ts`、`tests/ui/hud.spec.ts`
- 实施要点：
  - 分数/步数/目标逐项；≤3 步高亮并提示一次。
  - aria-live 文本严格 `分数 {score}，剩余步数 {moves}，目标 {progress}`。
  - 同一秒最多 1 次；合并最后一帧。
- DoD：
  - [ ] 初始/变化后文本格式逐字符匹配。
  - [ ] 1 秒内 10 次变化只播报 1 次，内容为最后一次。
  - [ ] ≤3 步只提示一次；0 步不重复。
  - [ ] `aria-live="polite"`、`aria-atomic="true"`、`.sr-only` 非 display:none。
- 验证：`npm run test -- tests/ui/hud.spec.ts`

### TASK-029 选关与解锁

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G4
- 对应 REQ：REQ-021, REQ-026
- 前置：TASK-003, TASK-024, TASK-028
- 产出：`src/ui/screens/level-select.ts`、`tests/e2e/level-select.spec.ts`
- 实施要点：
  - 8 个卡片；未解锁显示锁与「通过上一关解锁」；已解锁可无限重玩。
  - 显示历史最高星级/分数；点击进入对局。
  - 解锁：≥1 星后 `unlockedLevelId = max(current, id+1)`。
- DoD：
  - [ ] 初始仅第 1 关可点；第 2-8 锁定。
  - [ ] 第 1 关 1 星后第 2 关解锁；重玩第 1 关不降级。
  - [ ] 8 个卡片均显示名称/星级/最高分。
  - [ ] 锁定卡片点击不进入对局，显示规定文案。
- 验证：`npm run test:e2e -- level-select.spec.ts`

### TASK-030 结算面板/局内操作

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G5
- 对应 REQ：REQ-019, REQ-020, REQ-028
- 前置：TASK-025, TASK-026, TASK-028, TASK-029
- 产出：`src/ui/screens/result-panel.ts`、`src/ui/screens/pause-menu.ts`、`tests/e2e/result.spec.ts`
- 实施要点：
  - 面板字段：关卡名、结果、分数、最高分、星级、剩余步数、逐项目标。
  - 胜利且有下一关显示「下一关」；失败隐藏。
  - 面板出现 300ms 内禁用按钮；重开二次确认；返回选关作废本局。
- DoD：
  - [ ] 胜利/失败面板字段齐全；失败无「下一关」。
  - [ ] 300ms 内点击无效；300ms 后可操作。
  - [ ] 重开新种子、分数/步数归零，不写排行榜。
  - [ ] 返回选关后进度/最高分不变，无本局排行榜记录。
  - [ ] 面板可键盘 Tab 聚焦（DOM 按钮）。
- 验证：`npm run test:e2e -- result.spec.ts`
### TASK-031 设置页

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G4
- 对应 REQ：REQ-033, REQ-038, REQ-043, REQ-047
- 前置：TASK-024, TASK-025, TASK-026, TASK-028
- 产出：`src/ui/screens/settings.ts`、`tests/e2e/settings.spec.ts`
- 实施要点：
  - BGM/音效独立开关+音量 0..100；默认 60/80；即时生效并持久化。
  - 减弱动效、色盲模式开关；持久化。
  - 重置进度/清空排行榜二次确认；文案含不可恢复。
- DoD：
  - [ ] 改音量/开关后刷新保持；0/5/96/100 边界无异常。
  - [ ] 色盲/减弱动效刷新保持；色盲符号生效。
  - [ ] 重置进度回第 1 关，排行榜清空，提示 3s。
  - [ ] 清空排行榜不影响进度/设置。
  - [ ] 所有按钮热区 ≥44×44。
- 验证：`npm run test:e2e -- settings.spec.ts`

### TASK-032 本地排行榜界面

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G4
- 对应 REQ：REQ-034, REQ-036, REQ-037, REQ-038
- 前置：TASK-026, TASK-028
- 产出：`src/ui/screens/leaderboard.ts`、`tests/e2e/leaderboard.spec.ts`
- 实施要点：
  - 标题必须「本地排行榜」；按关卡筛选，展示前 10 条；标注关卡名/达成时间。
  - 空态文案；本机 20 条上限提示；清空入口跳设置。
  - 禁止「全球」「在线」「全服」「服务器排名」。
- DoD：
  - [ ] 页面含「本地排行榜」；四个禁用词检索为 0。
  - [ ] 每关最多 10 条，排序正确；标注关卡名/时间。
  - [ ] 空态可见；清空后显示空态。
  - [ ] 打开排行榜期间 Network 第三方请求 0。
- 验证：`npm run test:e2e -- leaderboard.spec.ts`

### TASK-033 音频引擎

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G2
- 对应 REQ：REQ-045, REQ-046, REQ-047, REQ-048
- 前置：TASK-001, TASK-002, TASK-004
- 产出：`src/systems/audio/audio-engine.ts`、`sfx-map.ts`、`asset-picker.ts`、`tests/systems/audio.spec.ts`
- 实施要点：
  - 首次手势后创建/恢复 AudioContext，加载 BGM 并循环。
  - 13 事件映射；100ms 节流；BGM/SFX 独立 gain。
  - visibilitychange 暂停/续播；OGG/MP3 能力检测；失败图标。
- DoD：
  - [ ] 事件→文件映射 13 条全量断言。
  - [ ] 首次手势前不播放；手势后 BGM 播放；hidden 暂停、visible 续播。
  - [ ] 同音效 100ms 内只播 1 次。
  - [ ] 音量 0/5/96/100 映射增益在 [0,1]，无 NaN。
  - [ ] 解码失败 → `unavailable=true`，不抛异常，UI 图标可见。
- 验证：`npm run test -- tests/systems/audio.spec.ts`

### TASK-034 应用装配与降级

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G6
- 对应 REQ：REQ-030, REQ-051
- 前置：TASK-017, TASK-023, TASK-027, TASK-028, TASK-030, TASK-031, TASK-032, TASK-033
- 产出：`src/systems/main.ts`、`app.ts`、`router.ts`、`src/ui/toast.ts`、`src/ui/dialogs.ts`
- 实施要点：
  - 启动顺序按 plan 5.1；Canvas 不支持显示降级页。
  - 装配 core/render/systems/ui；所有错误有 UI 提示，不白屏。
  - 中断提示按 CR-004 实现：主菜单读到 `lastSessionInterrupted === true` → 显示一次「上一局已中断」→ 立即写 `false`；开局写 `true`，结算与返回关卡选择写 `false`。
  - 不新增独立存储键；不使用 `sessionStorage`/`IndexedDB`/`beforeunload`。
- DoD：
  - [ ] 无存档/损坏/存储不可用三种启动均进入可玩状态。
  - [ ] Canvas 2D 不可用显示静态降级页，无未捕获异常。
  - [ ] 选关→对局→结算→选关/设置/排行榜路由切换正常。
  - [ ] 控制台无 error；图片/音频降级 warn 除外。
  - [ ] 中途刷新 → 主菜单提示「上一局已中断」1 次并立即置 `false`；同一会话再进入主菜单不再提示。
  - [ ] 提示后不恢复任何对局（棋盘/步数/分数均为该关开始态）。
  - [ ] 存储键集合仅含 `wmg.save.v1`/`wmg.leaderboard.v1`/备份键（无第 4 类存储、无对局快照字段）。
- 验证：`npm run build && npm run preview` + 手工冒烟

### TASK-035 E2E 核心链路

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G7
- 对应 REQ：REQ-019, REQ-020, REQ-028, REQ-030, REQ-033
- 前置：TASK-034
- 产出：`tests/e2e/core-flow.spec.ts`、`tests/e2e/persistence.spec.ts`
- 实施要点：
  - 测试构建固定种子；开始第 1 关→有效交换→结算→重开→刷新。
  - 存档损坏/重置进度场景。
  - 中途退出不写排行榜。
  - 中途刷新场景（REQ-030）：开局 → 刷新 → 主菜单出现一次中断提示 → 再次刷新不再提示。
- DoD：
  - [ ] 完整链路通过 Chromium；无 console error。
  - [ ] 重开后分数/步数归零，种子变化。
  - [ ] 刷新后第 2 关解锁、最高分/星级保留；进行中对局不恢复。
  - [ ] 中途刷新后 `localStorage['wmg.save.v1']` 读得 `lastSessionInterrupted` 由 `true` 变 `false`；二次刷新不再提示（REQ-030）。
  - [ ] 重置进度回第 1 关，排行榜空，提示 3s。
  - [ ] 中途退出后无本局排行榜记录。
- 验证：`npm run test:e2e -- core-flow.spec.ts persistence.spec.ts`

### TASK-036 E2E 输入/可访问性/音频/网络

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G7
- 对应 REQ：REQ-034, REQ-041, REQ-043, REQ-045, REQ-047, REQ-049, REQ-050
- 前置：TASK-031, TASK-033, TASK-034
- 产出：`tests/e2e/input-a11y.spec.ts`、`tests/e2e/audio-network.spec.ts`
- 实施要点：
  - 鼠标/触摸两套；aria-live 文本与节流；色盲/减弱动效持久化。
  - DPR/resize 重绘；音频首手势/隐藏暂停/音量持久化。
  - Network 第三方请求 0；本地排行榜文案。
  - 热区/吸附按 CR-003：四个固定视口（1280×800、600×800、360×640、320×568）逐点断言最近邻吸附与单格 CSS 尺寸。
- DoD：
  - [ ] 鼠标拖拽/两段点击、触摸滑动/点击均成功交换。
  - [ ] aria-live 文本格式正确，1 秒内最多 1 次。
  - [ ] 色盲/减弱动效刷新保持；DPR 变化 200ms 内重绘。
  - [ ] 音频首手势播放、隐藏暂停、恢复续播；音量持久化。
  - [ ] 全流程第三方请求 0；「本地排行榜」文案存在。
  - [ ] 吸附：格内任意点命中该格；相邻格中垂线等距点归属按「列优先→行优先」；投影矩形外点击为 A 类静默忽略（不扣步、无 invalid 音效、无 aria 播报、选中态不变）。
  - [ ] 单格热区：1280×800 与 600×800 视口 ≥40×40；360×640 = 24×24；320×568 ≈21.33×21.33（容差 ±0.5px，不 skip）。
  - [ ] 同一手势在不同视口下产生相同 `swap` 语义（阈值随 `cellCssSize` 缩放，无固定 16px 残留）。
- 验证：`npm run test:e2e -- input-a11y.spec.ts audio-network.spec.ts`

### TASK-037 性能与发布验收

- 角色：impl-systems ｜ 预估：0.5d ｜ 组：G7
- 对应 REQ：REQ-034, REQ-044, REQ-051
- 前置：TASK-035, TASK-036
- 产出：`tests/e2e/perf.spec.ts`、`docs/perf-report.md`（或任务结果内报告）
- 实施要点：
  - 10 秒对局采样 p95、<50fps 占比；Lighthouse 生产构建。
  - gzip 首屏/初始 JS 统计；第三方请求计数。
  - 覆盖率按 CR-005 执行：`npm run test:coverage`（provider v8，include 仅 `src/core/**`），阈值行 80 / 分支 70。
- DoD：
  - [ ] p95 帧间隔 ≤20ms；≥50fps 占比 ≥95%；单帧绘制 ≤8ms。
  - [ ] Lighthouse Performance ≥80、Accessibility ≥90、Best Practices ≥90。
  - [ ] 首屏 gzip ≤3.0MB；初始 JS gzip ≤200KB；第三方请求 0。
  - [ ] `dist/` 在静态服务器可运行；无 console error。
  - [ ] `npm run test:coverage` 通过：`core/` 行覆盖率 ≥80%、分支覆盖率 ≥70%；低于阈值即失败。
  - [ ] `coverage/coverage-summary.json` 随任务结果提交，行/分支数值与报告一致（不得手填）。
- 验证：`npm run build && npm run test:e2e -- perf.spec.ts` + Lighthouse 手工报告

### TASK-038 元素/特化/障碍贴图

- 角色：asset-maker ｜ 预估：0.5d ｜ 组：G1
- 对应 REQ：REQ-039, REQ-042
- 前置：TASK-004
- 产出：`assets/tile-star.webp`、`tile-water.webp`、`tile-leaf.webp`、`tile-flame.webp`、`tile-crystal.webp`、`tile-bolt.webp`、`tile-select.webp`、`special-line-h.webp`、`special-line-v.webp`、`special-rainbow.webp`、`obs-ice.webp`、`obs-stone-2.webp`、`obs-stone-1.webp`、`obs-hole.webp`、`fx-clear.webp`（15 个）
- 实施要点：
  - 6 元素 64×64、透明背景、形状星/水滴/叶/火焰/菱形晶体/闪电；主色精确。
  - 特化/障碍/选中/闪光按 spec 10.1 尺寸与备注。
  - 形状差异必须在灰度下可辨；不依赖颜色。
- DoD：
  - [ ] 15 个文件存在，尺寸与格式正确；元素均 64×64。
  - [ ] 6 个主色十六进制与 spec 5.1 完全一致。
  - [ ] 转灰度后 6 种元素两两可辨（3 人评审记录）。
  - [ ] 透明背景无白边/黑边；文件体积记录在 manifest。
- 验证：资源检查脚本 + 3 人灰度评审

### TASK-039 背景/边框/面板/图标

- 角色：asset-maker ｜ 预估：0.5d ｜ 组：G1
- 对应 REQ：REQ-040
- 前置：TASK-004
- 产出：`assets/bg-main.webp`、`board-frame.webp`、`cell-empty.webp`、`ui-panel.webp` + 14 个 `icon-*.svg`（18 个）
- 实施要点：
  - 背景 1920×1080 ≤400KB；外框 560×560（含 24px 内边距）；槽位 64×64；面板 720×520。
  - 图标 32×32/48×48 SVG，单色可换色；含 star-on/off、play、pause、restart、back、lock、sound-on/off、music-on/off、settings、trophy、close。
- DoD：
  - [ ] 18 个文件存在，尺寸/格式正确。
  - [ ] 背景 ≤400KB；外框/槽位/面板与逻辑布局匹配（560 外框对应 512 棋盘）。
  - [ ] 14 个 SVG 均可独立渲染，无外部引用。
  - [ ] 图标在 32px 下清晰，颜色可继承。
- 验证：资源检查脚本 + 视觉抽查

### TASK-040 BGM 与 13 事件音效

- 角色：asset-maker ｜ 预估：0.5d ｜ 组：G1
- 对应 REQ：REQ-045, REQ-046, REQ-048
- 前置：TASK-004
- 产出：`assets/bgm-main.ogg/.mp3` + 13 个 `sfx-*.ogg/.mp3`（28 个文件）
- 实施要点：
  - BGM 60.0s 循环，接缝静音 ≤20ms；OGG 96kbps 单声道，MP3 128kbps 回退。
  - 13 事件：swap/invalid/match/cascade/special-line/special-rainbow/ice-break/stone-break/shuffle/star/win/lose/click。
  - 两套格式内容一致；总音频 ≤2.0MB。
- DoD：
  - [ ] 28 个文件存在；命名与 spec 10.2 一致。
  - [ ] 每个音效时长与 spec 表误差 ≤0.05s；BGM 60.0s。
  - [ ] BGM 循环接缝 ≤20ms（波形/听感检查记录）。
  - [ ] OGG/MP3 响度/内容一致；总大小 ≤2.0MB。
  - [ ] 无爆音/削波；音量 0..5/96..100 试听无异常。
- 验证：ffprobe/波形检查 + 试听记录

### TASK-041 资源验收与体积报告

- 角色：asset-maker ｜ 预估：0.5d ｜ 组：G7
- 对应 REQ：REQ-039, REQ-040, REQ-042, REQ-051
- 前置：TASK-020, TASK-038, TASK-039, TASK-040
- 产出：更新 `assets/manifest.md` 的验收表/体积统计/校验和
- 实施要点：
  - 核对 33 图片 + 28 音频；记录每个文件尺寸/体积/SHA256。
  - 图片合计 ≤1.6MB、首屏图片 ≤1.2MB、音频 ≤2.0MB。
  - 记录 3 人灰度评审、BGM 接缝检查、缺失资源占位验证结果。
- DoD：
  - [ ] 33/28 文件全部存在，无缺失/多余。
  - [ ] 体积三项上限全部满足；报告含实测值。
  - [ ] manifest 与磁盘文件 SHA256 一致。
  - [ ] 灰度评审 3 人签字/记录；占位降级由 TASK-019 测试通过。
- 验证：资源清单脚本 + 人工签字
---

## 3. 需求 → 模块 → 任务映射表（覆盖率 100%）

> 模块列对应 spec 第 14 章的可测性矩阵分组；代码模块列是实际落点。每条 REQ 至少 1 个主任务；辅助任务用于集成/验收。

| REQ | 规格模块 | 代码模块 | 主任务 | 辅助/验证任务 | 覆盖 |
|---|---|---|---|---|---|
| REQ-001 | 核心玩法 | `src/core/board/generate.ts` | TASK-006 | TASK-002 | ✅ |
| REQ-002 | 核心玩法 | `src/core/rng.ts` | TASK-005 | TASK-002 | ✅ |
| REQ-003 | 核心玩法 | `src/core/board/swap.ts` + `src/ui/input` | TASK-008, TASK-027 | TASK-035 | ✅ |
| REQ-004 | 核心玩法 | `src/core/board/swap.ts` + `src/ui/input` | TASK-008, TASK-027 | TASK-036 | ✅ |
| REQ-005 | 核心玩法 | `src/core/board/swap.ts` | TASK-008 | TASK-013 | ✅ |
| REQ-006 | 核心玩法 | `src/core/board/swap.ts` | TASK-008 | TASK-035 | ✅ |
| REQ-007 | 核心玩法 | `src/core/match/detect.ts` | TASK-007 | TASK-013 | ✅ |
| REQ-008 | 核心玩法 | `src/core/board/gravity.ts` | TASK-012 | TASK-013 | ✅ |
| REQ-009 | 核心玩法 | `src/core/score/score.ts` + `resolve.ts` | TASK-009, TASK-013 | TASK-021 | ✅ |
| REQ-010 | 核心玩法 | `src/core/special/generate.ts` | TASK-010 | TASK-011 | ✅ |
| REQ-011 | 核心玩法 | `src/core/special/generate.ts` | TASK-010 | TASK-011 | ✅ |
| REQ-012 | 核心玩法 | `src/core/special/trigger.ts` | TASK-011 | TASK-020 | ✅ |
| REQ-013 | 核心玩法 | `src/core/special/trigger.ts` | TASK-011 | TASK-020 | ✅ |
| REQ-014 | 核心玩法 | `src/core/score/score.ts` | TASK-009 | TASK-002 | ✅ |
| REQ-015 | 核心玩法 | `src/core/resolve.ts` | TASK-013 | TASK-028 | ✅ |
| REQ-016 | 核心玩法 | `src/core/board/shuffle.ts` | TASK-015 | TASK-034 | ✅ |
| REQ-017 | 核心玩法 | `src/core/state-machine.ts` | TASK-014 | TASK-021, TASK-035 | ✅ |
| REQ-018 | 核心玩法 | `src/core/resolve.ts` + `game.ts` | TASK-013, TASK-014 | TASK-016 | ✅ |
| REQ-019 | 核心玩法 | `src/core/game.ts` + `result-panel.ts` | TASK-017, TASK-030 | TASK-035 | ✅ |
| REQ-020 | 核心玩法 | `src/core/game.ts` + `pause-menu.ts` | TASK-017, TASK-030 | TASK-035 | ✅ |
| REQ-021 | 关卡 | `src/systems/level` + `level-select.ts` | TASK-003, TASK-029 | TASK-035 | ✅ |
| REQ-022 | 关卡 | `src/core/goals.ts` + `src/systems/level` | TASK-003, TASK-013, TASK-016 | TASK-035 | ✅ |
| REQ-023 | 关卡 | `src/core/board/gravity.ts` + `goals.ts` | TASK-012, TASK-016 | TASK-020 | ✅ |
| REQ-024 | 关卡 | `src/core/board/gravity.ts` + `goals.ts` | TASK-012, TASK-016 | TASK-020 | ✅ |
| REQ-025 | 关卡 | `src/core/board/generate.ts` + `level` | TASK-003, TASK-006 | TASK-035 | ✅ |
| REQ-026 | 关卡 | `src/core/goals.ts` + `level-select.ts` | TASK-016, TASK-029 | TASK-030 | ✅ |
| REQ-027 | 关卡 | `src/systems/level` | TASK-003 | TASK-002 | ✅ |
| REQ-028 | 关卡 | `src/ui/screens/result-panel.ts` | TASK-030 | TASK-035 | ✅ |
| REQ-029 | 存档 | `src/systems/storage/schema.ts` | TASK-024 | TASK-035 | ✅ |
| REQ-030 | 存档 | `src/systems/storage/save-service.ts` + `app.ts` | TASK-025, TASK-034 | TASK-035 | ✅ |
| REQ-031 | 存档 | `src/systems/storage/save-store.ts` | TASK-024 | TASK-035 | ✅ |
| REQ-032 | 存档 | `src/systems/storage/memory-store.ts` | TASK-024 | TASK-036 | ✅ |
| REQ-033 | 存档 | `save-service.ts` + `settings.ts` | TASK-025, TASK-031 | TASK-035 | ✅ |
| REQ-034 | 排行榜 | `src/systems/leaderboard` + `leaderboard.ts` | TASK-026, TASK-032 | TASK-036, TASK-037 | ✅ |
| REQ-035 | 排行榜 | `src/systems/leaderboard/store.ts` | TASK-026 | TASK-035 | ✅ |
| REQ-036 | 排行榜 | `src/systems/leaderboard/sort.ts` | TASK-026, TASK-032 | TASK-036 | ✅ |
| REQ-037 | 排行榜 | `src/systems/leaderboard/prune.ts` | TASK-026, TASK-032 | TASK-036 | ✅ |
| REQ-038 | 排行榜 | `leaderboard/store.ts` + `settings.ts` | TASK-026, TASK-031, TASK-032 | TASK-036 | ✅ |
| REQ-039 | 美术 | `src/render/tile-renderer.ts` + `assets` | TASK-004, TASK-019, TASK-020, TASK-038, TASK-041 | TASK-036 | ✅ |
| REQ-040 | 美术 | `src/render/layout.ts` + `assets` | TASK-004, TASK-018, TASK-020, TASK-023, TASK-039, TASK-041 | TASK-036 | ✅ |
| REQ-041 | 美术 | `src/render/canvas-host.ts` | TASK-018 | TASK-036 | ✅ |
| REQ-042 | 美术 | `src/render/placeholders.ts` | TASK-019, TASK-038, TASK-041 | TASK-036 | ✅ |
| REQ-043 | 美术 | `tile-renderer.ts` + `settings.ts` | TASK-020, TASK-031 | TASK-036 | ✅ |
| REQ-044 | 美术 | `src/render/animation.ts` | TASK-002, TASK-021, TASK-023 | TASK-037 | ✅ |
| REQ-045 | 音效 | `src/systems/audio/audio-engine.ts` | TASK-033 | TASK-036, TASK-040 | ✅ |
| REQ-046 | 音效 | `src/systems/audio/sfx-map.ts` | TASK-033 | TASK-040 | ✅ |
| REQ-047 | 音效 | `audio-engine.ts` + `settings.ts` | TASK-031, TASK-033 | TASK-036 | ✅ |
| REQ-048 | 音效 | `audio-engine.ts` | TASK-033 | TASK-040 | ✅ |
| REQ-049 | 输入/可访问性 | `layout.ts` + `board-input.ts` | TASK-018, TASK-027 | TASK-036 | ✅（CR-003） |
| REQ-050 | 输入/可访问性 | `src/ui/live-region.ts` | TASK-028 | TASK-036 | ✅ |
| REQ-051 | 性能 | `loop.ts` + 构建/装配 | TASK-001, TASK-022, TASK-023, TASK-034, TASK-037 | TASK-041 | ✅ |

### 3.1 覆盖率自检

- REQ 总数：51；已映射：51；未覆盖：0；覆盖率 **100%**。
- TASK 总数：41；每个 TASK 至少出现在 1 条 REQ 映射中；孤儿任务 **0**。
- SC-01 已关闭：REQ-049 由 TASK-018（`pickNearestCell` + `cellCssSize`）、TASK-027（0.5 格手势）、TASK-036（四视口 E2E）全覆盖，无挂起项；REQ-030 四处写入由 TASK-025（服务）/ TASK-034（装配与提示）/ TASK-035（E2E）覆盖。
- 机械校验方法：从本表提取 `REQ-(\d{3})` 去重 → 应为 001..051 连续；从任务总览提取 `TASK-\d{3}` → 应为 001..041；两者差集为空。

---

## 4. 并行分组与关键路径

### 4.1 建议排期（工作日）

| 天 | impl-core | impl-systems | asset-maker |
|---|---|---|---|
| D1 | TASK-002 | TASK-001 | TASK-004 |
| D2 | TASK-005, TASK-006 | TASK-003, TASK-024, TASK-026 | TASK-038, TASK-039, TASK-040 |
| D3 | TASK-007, TASK-008, TASK-009, TASK-018 | TASK-025, TASK-027, TASK-028, TASK-033 | 资源修订 |
| D4 | TASK-010, TASK-012, TASK-014, TASK-019 | TASK-029, TASK-031, TASK-032 | TASK-041 准备 |
| D5 | TASK-011, TASK-013, TASK-020, TASK-021 | TASK-030 | TASK-041 |
| D6 | TASK-015, TASK-016, TASK-017, TASK-022 | 联调 | — |
| D7 | TASK-023 | TASK-034 | — |
| D8 | 修复 | TASK-035, TASK-036 | — |
| D9 | 修复 | TASK-037 | — |
| D10 | 缓冲/评审 | 缓冲/评审 | 缓冲/评审 |

> 这是建议排期；实际以依赖关系为准。D4-D5 的 systems 任务较多，可把 TASK-031/TASK-032 前移到 D3 后半。

### 4.2 关键路径

```text
TASK-001 → TASK-002 → TASK-005 → TASK-006 → TASK-007 → TASK-008
→ TASK-013 → TASK-023 → TASK-034 → TASK-035 → TASK-037
```

11 个 0.5 天任务 ≈ 5.5 个工作日；叠加评审、资源制作与手工验收，总工期约 8-10 个工作日。

### 4.3 并行边界检查

| 检查项 | 结论 |
|---|---|
| impl-core 与 impl-systems 文件重叠 | 无；core/render vs systems/ui/config 分离 |
| impl-core 与 asset-maker 文件重叠 | 无；`src/**` vs `assets/**` |
| impl-systems 与 asset-maker 文件重叠 | 无；`src/**`/config vs `assets/**` |
| 测试文件重叠 | 无；`tests/core｜render` vs `tests/systems｜ui｜e2e` |
| 共享契约 | `src/core/types.ts` 仅 impl-core 写，其他只读 |
| 构建配置 | 仅 impl-systems 写 `package.json`/`tsconfig`/`vite.config` |

---

## 5. 里程碑与门禁

| 里程碑 | 完成标志 | 门禁 |
|---|---|---|
| M0 骨架 | TASK-001/002/004 完成 | `npm run build` 通过；manifest 完整 |
| M1 可玩核心 | TASK-006~013 完成 | 单测覆盖 3/4/5 连、特化、连锁、计分基准 |
| M2 可玩闭环 | TASK-017/023/030/034 完成 | 第 1 关可玩到结算；刷新保留 |
| M3 系统完整 | TASK-024~033 完成 | 存档/排行榜/设置/音频/输入全通 |
| M4 8 关可通 | TASK-003 + 手工全通 | 8 关 1★ 可达；D 值校验 |
| M5 发布 | TASK-035~037/041 完成 | 性能/Lighthouse/体积/资源全部达标；SC-01/02/05 已裁决（CR-003/004/005）并验收通过 |

---

## 6. 任务验收汇总（G3 DoD）

- [ ] 41 个 TASK 全部有唯一 ID、角色、REQ、前置、DoD、预估 ≤0.5d。
- [ ] 51 条 REQ 全部映射；覆盖率 100%；孤儿任务 0。
- [ ] 三角色文件边界无重叠；共享契约只读规则明确。
- [ ] 依赖图无环；关键路径与并行组可执行。
- [ ] 每条 TASK 的 DoD 可通过单测/E2E/资源检查/人工评审验证。
- [x] SC-01/SC-02/SC-05 已裁决并落到 TASK-018/025/027/034/035/036/037 的 DoD；未自行改需求、未改文件边界。
- [x] 命中失败口径与 spec v1.1.4（CR-008 / CR-009 / CR-010）一致：A 类静默忽略；同格＝取消选中、非相邻＝选中转移，均不播 invalid；仅相邻无匹配播 1 次 invalid 并 200ms 回弹；TASK-008 / TASK-027 / TASK-036 按此验收；TASK 编号与 REQ 映射零改动。
- [ ] TASK 编号连续（TASK-001 ~ TASK-041）、总数 41，本轮增量为 DoD/映射改写，无新增任务。