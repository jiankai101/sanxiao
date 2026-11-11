# 001-core-game 技术方案（plan.md）

- 特性编号：001-core-game
- 文档类型：技术方案（G2）与实现拆解依据（G3）
- 文档版本：v1.1.3
- 编写角色：Architect / Planner
- 上游输入：`/specs/constitution.md` v1.1.1、`/specs/001-core-game/spec.md` v1.1.4（已发布，G1 已确认内容，51 条 REQ；CR-002 澄清排行榜时间语义；CR-003/CR-004/CR-005 落地 SC-01/SC-02/SC-05 三项裁决；CR-006 对齐宪法 5.2/5.3 可访问性措辞；CR-007 将第 10.1 章图片格式统一为 WebP（带 alpha）；CR-008 命中失败拆为 A 类静默忽略 / B 类无效交换；CR-009 按 A/B 类修正第 10.2 章 sfx-invalid 触发事件列；CR-010 将 B 类收窄为「相邻有效格交换后无匹配」）、`/specs/001-core-game/tasks.md` v1.1.3（已按 CR-010 对齐 TASK-008 / TASK-027）
- 最近变更：v1.1.3（2026-11-11，按 spec v1.1.4 的 CR-010 口径收窄无效交换：仅「相邻有效格交换后无匹配」播放 200ms 回弹 + 1 次 invalid；同格点击＝取消选中、非相邻点击＝选中转移，均不交换 / 不扣步 / 分数不变 / 不播 invalid；同步第 5.2 / 5.4 / 8.4 / 10.2 / 14.2 / 17.2 / 19 章；版本号 +0.0.1，REQ 编号、TASK 编号与映射零改动）
- 下游交付：`/specs/001-core-game/tasks.md`
- 设计范围：只做架构、数据结构、算法、接口与验收设计；不写业务代码、不修改规格

---

## 0. 结论摘要

1. 采用**纯前端单页 + TypeScript 5 strict + Vite 6 + Canvas 2D**。运行时第三方依赖为 0；存档、设置、本地排行榜全部使用 `localStorage`；无后端、无账号、无网络请求。
2. 代码按「纯逻辑（core）／渲染（render）／应用系统（systems）／DOM 界面（ui）」分层。`core` 不访问 DOM、Canvas、存储、时间与全局随机源，所有随机行为由注入的 32 位种子 PRNG 产生。
3. 对局采用「事件驱动的逻辑结算 + 时间轴动画回放」：`core` 一次算出整轮连锁的确定性结果，`render` 只负责把结果按 150/200/180/160/300/200ms 的时间轴播放；逻辑与动画彻底解耦，保证同种子同操作可复现。
4. 棋盘为 8×8、单格 64 逻辑像素、画布 960×720；元素 6 种（第 5-8 关 5 种）；三类目标（分数/收集/障碍）按 AND 组合；8 关数值全部来自 spec 第 5、6 章。
5. 存档使用 `saveVersion = 1` 的显式 schema，读取时做严格类型校验；损坏/版本不符时先备份再默认初始化；`localStorage` 不可用或配额超限时降级为内存存档并常驻提示。
6. 排行榜明确为**本地排行榜**：单机、无名、仅当前浏览器可见；排序键为 `score desc → movesUsed asc → achievedAt asc → id asc`；单关 10 条、全局 20 条。
7. 原 2 个规格冲突（REQ-049 热区几何、E-04 中断提示持久化）与 1 个工程门禁（覆盖率工具）均已裁决并登记 CR-003 / CR-004 / CR-005，spec 与宪法同步升至 v1.1.0；此后 CR-006（宪法 5.2 / 5.3 可访问性措辞对齐）、CR-007（spec 第 10.1 章图片格式统一为 WebP）使上游升至 v1.1.1，CR-008（命中失败拆为 A 类静默忽略 / B 类无效交换）与 CR-009（第 10.2 章 sfx-invalid 触发事件列按 A/B 类修正）升至 v1.1.3，CR-010（B 类收窄为相邻有效格交换后无匹配；同格＝取消选中、非相邻＝选中转移，均不播 invalid）使上游升至 v1.1.4；本方案按裁决口径执行（见第 5、8、10、14、17、18 章）。本文不自行改写任何 REQ。

---

## 1. 输入、范围与前置状态

### 1.1 输入

| 输入 | 状态 | 本方案的使用方式 |
|---|---|---|
| `constitution.md` v1.1.1 | 已发布，只读 | 技术栈、依赖白名单（含 CR-005 放行的 `@vitest/coverage-v8`）、代码规范、性能与可测试性红线（CR-006 仅对齐 5.2 / 5.3 可访问性措辞） |
| `spec.md` v1.1.4，51 条 REQ | 已发布；G1 五项已确认；CR-001 定版、CR-002 澄清排行榜时间语义、CR-003/004/005 落地三项裁决、CR-006/CR-007 为措辞与版本对齐、CR-008/CR-009 统一命中失败口径为 A 类静默忽略 / B 类无效交换、CR-010 将 B 类收窄为「相邻有效格交换后无匹配」（同格＝取消选中、非相邻＝选中转移，均不播 invalid；REQ 数、数值与阈值不变） | 需求、数值、关卡、存档、排行榜、美术、音效的唯一事实源 |
| `spec.md` 文档头 | v1.1.4 已发布（CR-001 ~ CR-010 已登记） | 架构按 v1.1.4 执行；SC-01/SC-02/SC-05 已裁决，SC-06 已关闭 |

### 1.2 范围

本方案覆盖：

- 目录与模块边界、依赖方向、并行写入边界；
- 主循环、状态机、逻辑与动画的时序；
- 棋盘/元素/障碍/特化的数据结构与算法；
- 种子 PRNG 与可复现测试方案；
- Canvas 分层、DPR、缩放、动画与性能预算；
- 鼠标+触摸统一输入抽象；
- 存档 schema、校验、迁移/降级、写入时机；
- 本地排行榜 schema、排序、容量、去重；
- 8 关数据格式与数值校验；
- 音频引擎与事件映射；
- 构建、静态托管、测试策略与手工验收清单。

本方案不覆盖：

- 任何业务代码、美术成品、音频成品的实际制作；
- 规格变更；如实现中发现规格缺口，按第 19 章登记，不自行补需求；
- 账号、后端、服务端排行榜、联机、支付、广告、埋点、PWA（均属 spec 第 11 章 Out of Scope）。

### 1.3 设计原则

| 原则 | 落地方式 |
|---|---|
| 单一事实源 | 所有数值常量集中在 `src/core/constants.ts`，注释标注来源 REQ；关卡数值集中在 `src/systems/level/levels.ts` |
| 纯逻辑可测 | `core/` 全部函数无副作用，输入输出可 JSON 序列化；Node 环境直接跑 Vitest |
| 确定性 | 种子 + 操作序列决定棋盘与分数；禁止 `Math.random()`、`Date.now()` 进入 core |
| 逻辑/表现分离 | core 产出 `GameEvent[]` 与 `RoundResult[]`；render 只按事件播放，不改状态 |
| 失败可降级 | 存档、图片、音频、Canvas 不可用时均有明确降级路径，不白屏、不阻断游戏 |
| 并行不冲突 | 三角色按目录硬边界写入；共享契约只由 impl-core 维护，其他角色只读 |

---

## 2. 技术栈与选型理由

### 2.1 选定技术栈

| 层 | 选型 | 版本/约束 | 理由 |
|---|---|---|---|
| 语言 | TypeScript | 5.x，`strict: true` | 规格要求；棋盘/目标/存档均为结构化数据，类型可约束边界 |
| 构建 | Vite | 6.x | 零配置静态构建、原生 ESM、快速 HMR；产物为纯静态文件 |
| 渲染 | Canvas 2D | 浏览器原生 | 8×8 棋盘 + 64px 贴图 + 粒子，2D 足够；避免 WebGL 上下文丢失与着色器复杂度 |
| UI | 原生 DOM + CSS | 无框架 | 运行时依赖必须为 0；面板、按钮、设置页用 DOM 更易做 44px 热区、焦点与 aria-live |
| 状态 | 不可变普通对象 | 无状态库 | 对局状态可 JSON 往返；避免第三方状态库 |
| 随机 | 自实现 mulberry32 | 32 位种子 | 代码 <20 行、状态可序列化、分布足够、跨浏览器一致 |
| 存档 | `localStorage` | 同步、同源 | 宪法允许的唯一持久化手段；单机 MVP 数据量 <20KB |
| 音频 | Web Audio API + HTMLAudio 回退 | 原生 | 低延迟 SFX、精确循环 BGM；无音频库依赖 |
| 单测 | Vitest | devDependency | 与 Vite 同源、Node 环境跑纯逻辑 |
| E2E | Playwright | devDependency | 鼠标/触摸、DPR、Network、localStorage 均可测 |
| 部署 | 任意静态文件服务器 | `dist/` | 无 Node 运行时、无环境变量、无服务端路由 |

### 2.2 被否决的方案

| 方案 | 否决理由 |
|---|---|
| Phaser / PixiJS | 运行时依赖，违反宪法 2.2；体积与首屏预算不可控；本项目玩法不需要完整游戏引擎 |
| React / Vue | 运行时依赖；对局核心是 Canvas，DOM 只需少量面板；引入框架无收益 |
| WebGL | 8×8 棋盘规模小，2D 足够；WebGL 增加上下文丢失、着色器、移动端兼容成本 |
| 后端 + 数据库排行榜 | 宪法 2.3 绝对禁止；MVP 明确为本地榜 |
| IndexedDB / Cookie / Cache API | 宪法 2.3 只允许 localStorage；且无大容量需求 |
| 第三方动画库 | 动画只有 6 类固定时长，时间轴 <150 行可自实现；避免依赖 |
| 合成（merge）玩法 | G1-Q1 已确认采用三消；本方案不实现合成算法 |

### 2.3 与宪法红线的逐项对应

| 宪法条款 | 设计响应 |
|---|---|
| 2.1 强制栈 | TS5 strict / Vite6 / Canvas2D / 纯前端静态产物 |
| 2.2 依赖白名单 | `dependencies = {}`；devDependencies 6 项：5 个基线包 + 仅测试期的 `@vitest/coverage-v8`（CR-005 已放行，不进入运行时产物） |
| 2.3 禁止后端/账号/支付/服务端榜/跨域 | 无 fetch/XHR/WebSocket；资源全部同源打包；排行榜为 localStorage 本地榜 |
| 2.3 禁止 UI 内嵌业务规则 | 匹配、计分、胜负、目标判定全部在 `src/core`；UI 只调用 API 与渲染事件 |
| 3 纯函数 | core 接收 `seed/rngState/state/level/now` 参数，不读全局 |
| 3 副作用集中 | DOM/Canvas/音频/存储只在 `render`、`ui`、`systems/audio`、`systems/storage` |
| 4 性能 | 单帧绘制预算 8ms、p95 帧间隔 ≤20ms、首屏 gzip ≤3.0MB、DPR≤2 |
| 5 可访问性 | DOM 按钮 44px、aria-live、减弱动效、色盲模式、焦点样式 |
| 6 可测试性 | 种子复现、状态可序列化、用例名含 REQ 编号、core 覆盖率门槛 |

---

## 3. 目录结构

```text
/
├─ index.html                       # 唯一 HTML 入口；canvas + DOM UI 挂载点 + aria-live
├─ package.json                     # scripts；dependencies 为空
├─ package-lock.json                # 必须提交
├─ tsconfig.json                    # strict、noEmit、路径别名（如 @core/@render）
├─ vite.config.ts                   # base './'、build 目标、publicDir 关闭
├─ vitest.config.ts                 # Node 环境；core/systems 单测
├─ playwright.config.ts             # E2E；桌面 + 移动 viewport
├─ .gitignore
├─ specs/
│  ├─ constitution.md               # 只读
│  └─ 001-core-game/
│     ├─ spec.md                    # 只读（G1 冻结内容）
│     ├─ plan.md                    # 本文
│     └─ tasks.md                   # G3 任务清单
├─ assets/                          # 美术/音频源文件；asset-maker 独占
│  ├─ manifest.md                   # 资源清单、尺寸、体积、校验记录
│  ├─ bg-main.webp
│  ├─ board-frame.webp
│  ├─ cell-empty.webp
│  ├─ tile-star.webp / tile-water.webp / tile-leaf.webp
│  ├─ tile-flame.webp / tile-crystal.webp / tile-bolt.webp
│  ├─ tile-select.webp
│  ├─ special-line-h.webp / special-line-v.webp / special-rainbow.webp
│  ├─ obs-ice.webp / obs-stone-2.webp / obs-stone-1.webp / obs-hole.webp
│  ├─ fx-clear.webp
│  ├─ ui-panel.webp
│  ├─ icon-*.svg                    # 14 个 SVG 图标
│  ├─ bgm-main.ogg / bgm-main.mp3
│  └─ sfx-*.ogg / sfx-*.mp3         # 13 个事件音效，双格式
├─ src/
│  ├─ core/                         # 纯逻辑；impl-core 独占
│  │  ├─ index.ts                   # 公共导出
│  │  ├─ types.ts                   # 共享领域类型（其他角色只读）
│  │  ├─ constants.ts               # 数值常量；注释标注 REQ
│  │  ├─ errors.ts                  # DomainError / IllegalTransitionError
│  │  ├─ rng.ts                     # mulberry32 + 种子工具
│  │  ├─ board/
│  │  │  ├─ model.ts                # Board/Cell 查询、坐标换算、不可变更新
│  │  │  ├─ generate.ts             # 初始棋盘生成；1000 次重试
│  │  │  ├─ swap.ts                 # 交换、合法性、回弹快照
│  │  │  ├─ gravity.ts              # 下落、补充、阻挡
│  │  │  └─ shuffle.ts              # 无可行步检测、保分布重排
│  │  ├─ match/detect.ts            # 横/竖/L/T 匹配与 run 元数据
│  │  ├─ score/score.ts             # 计分公式、倍率、长度奖励
│  │  ├─ special/
│  │  │  ├─ generate.ts             # 4 连/≥5 连特化生成
│  │  │  └─ trigger.ts              # 直线/彩虹/彩虹+彩虹触发
│  │  ├─ goals.ts                   # 三类目标进度与星级
│  │  ├─ state-machine.ts           # 6 状态与非法转移
│  │  ├─ resolve.ts                 # 单轮/连锁结算引擎
│  │  └─ game.ts                    # 对局编排 API（start/restart/abandon）
│  ├─ render/                       # Canvas 渲染；impl-core 独占
│  │  ├─ canvas-host.ts             # canvas 尺寸、DPR、resize
│  │  ├─ layout.ts                  # 960×720 逻辑布局、屏幕↔逻辑坐标
│  │  ├─ assets.ts                  # 资源 URL 映射与加载
│  │  ├─ placeholders.ts            # 程序化占位（纯色+形状）
│  │  ├─ board-renderer.ts          # 背景、棋盘框、槽位、障碍
│  │  ├─ tile-renderer.ts           # 元素、特化、选中、色盲符号
│  │  ├─ animation.ts               # 时间轴、缓动、减弱动效策略
│  │  ├─ fx.ts                      # 粒子/闪光，对象池
│  │  ├─ loop.ts                    # rAF 主循环、帧统计、可见性暂停
│  │  └─ scene.ts                   # 组合渲染器；消费 core 事件
│  ├─ systems/                     # 应用系统；impl-systems 独占
│  │  ├─ main.ts                    # 装配入口（宪法 main.ts 的落地位置）
│  │  ├─ app.ts                     # 应用控制器；状态机与各服务编排
│  │  ├─ router.ts                  # 选关/对局/设置/排行榜视图切换
│  │  ├─ level/
│  │  │  ├─ types.ts                # 从 @core/types 重导出关卡类型（单一来源）
│  │  │  ├─ levels.ts               # 8 关数据
│  │  │  └─ validate.ts             # 关卡数值/坐标校验
│  │  ├─ storage/
│  │  │  ├─ schema.ts               # SaveDataV1、类型守卫、默认值
│  │  │  ├─ save-store.ts           # localStorage 读写、备份、内存降级
│  │  │  ├─ save-service.ts         # 写入时机、结算/设置/解锁
│  │  │  ├─ memory-store.ts         # StorageLike 的内存实现
│  │  │  └─ migrations.ts           # 版本迁移注册表（v1 为空）
│  │  ├─ leaderboard/
│  │  │  ├─ schema.ts               # LeaderboardDataV1、记录类型
│  │  │  ├─ sort.ts                 # 比较器
│  │  │  ├─ prune.ts                # 单关 10 / 全局 20 淘汰
│  │  │  └─ store.ts                # 读写、去重、清空
│  │  └─ audio/
│  │     ├─ audio-engine.ts         # BGM/SFX、音量、可见性
│  │     ├─ sfx-map.ts              # 13 事件 → 文件
│  │     └─ asset-picker.ts         # OGG/MP3 能力检测
│  └─ ui/                           # DOM 界面；impl-systems 独占
│     ├─ hud.ts                     # 分数/步数/目标
│     ├─ live-region.ts             # aria-live 节流
│     ├─ toast.ts                   # 2s/3s/5s 提示
│     ├─ dialogs.ts                 # 二次确认
│     ├─ input/
│     │  ├─ pointer.ts              # Pointer Events 抽象
│     │  └─ board-input.ts          # 拖拽/两段点击/热区
│     └─ screens/
│        ├─ level-select.ts
│        ├─ result-panel.ts
│        ├─ pause-menu.ts
│        ├─ settings.ts
│        └─ leaderboard.ts
└─ tests/
   ├─ core/                         # impl-core
   ├─ render/                       # impl-core
   ├─ systems/                      # impl-systems
   ├─ ui/                           # impl-systems（纯 view-model；无 jsdom）
   └─ e2e/                          # impl-systems（Playwright）
```

### 3.1 宪法模块名与目录的映射

| 宪法第 3 节模块 | 本方案目录 | 说明 |
|---|---|---|
| `core/` | `src/core/` | 纯逻辑 |
| `render/` | `src/render/` | Canvas 绘制 |
| `audio/` | `src/systems/audio/` | 副作用层；由 impl-systems 负责 |
| `ui/` | `src/ui/` | DOM 界面 |
| `storage/` | `src/systems/storage/`、`src/systems/leaderboard/` | 存档与本地榜；由 impl-systems 负责 |
| `main.ts` | `src/systems/main.ts` | 装配入口；避免与 impl-core 的 `src/` 根文件冲突 |

> 该映射不改变宪法「逻辑/副作用分离」的实质，只把副作用层统一收敛到 `src/systems`，以满足任务给定的三角色并行边界。

---

## 4. 模块边界与依赖规则

### 4.1 依赖方向

```text
ui  ──►  systems/app  ──►  core
 │           │  │
 │           │  ├──► systems/storage ──► core/types
 │           │  ├──► systems/leaderboard ──► core/types
 │           │  └──► systems/audio ──► core/types（事件名）
 │           └──► render/scene ──► core/types
 └──► systems/app（只通过控制器接口，不直接改 core 状态）
```

硬规则：

1. `core` 不得 import `render`、`ui`、`systems`、DOM、Node API。
2. `render` 只能 import `core` 的类型与只读快照；不得 import `systems`、`ui`。
3. `systems` 可以 import `core`、`render`、`ui`；`ui` 不得 import `systems/storage` 的具体实现，只接收注入的回调/视图模型。
4. 禁止循环依赖；`src/core/index.ts` 是唯一公共入口。
5. 跨层数据只传普通对象/数组/字符串/数字/布尔；不传类实例、函数、Map、Set。
6. `src/core/types.ts` 是共享契约；其他角色只读。需要改契约时，由 impl-core 先改并通知，其他角色不得并行修改。

### 4.2 三角色写入边界（硬边界）

| 角色 | 可写路径 | 明确禁止写入 | 主要交付 |
|---|---|---|---|
| impl-core | `src/core/**`、`src/render/**`、`tests/core/**`、`tests/render/**` | `src/systems/**`、`src/ui/**`、`assets/**`、`index.html`、`vite.config.ts`、`package.json`、`tsconfig.json`、`tests/e2e/**` | 纯逻辑、渲染、动画、性能埋点 |
| impl-systems | `src/systems/**`、`src/ui/**`、`index.html`、`vite.config.ts`、`package.json`、`tsconfig.json`、`vitest.config.ts`、`playwright.config.ts`、`tests/systems/**`、`tests/ui/**`、`tests/e2e/**` | `src/core/**`、`src/render/**`、`assets/**` | 关卡数据、存档、排行榜、输入、UI、音频、装配、构建 |
| asset-maker | `assets/**`（含 `assets/manifest.md`） | `src/**`、`tests/**`、`index.html`、`vite.config.ts`、`package.json` | 图片、SVG、音频、资源清单 |

补充规则：

- `package.json` / `tsconfig.json` / `vite.config.ts` 只由 impl-systems 修改；impl-core 需要新脚本或路径别名时，通过任务消息提出，不直接改。
- `src/core/types.ts` 由 impl-core 维护；asset-maker 不写代码；impl-systems 只 import 类型。
- 测试目录按角色隔离；禁止两个角色同时写同一个测试文件。
- `assets/manifest.md` 是资源验收的唯一清单；impl-core 只按文件名读取，不修改清单。

### 4.3 构建期资源引用

- `src/render/assets.ts` 使用 Vite 的 `import.meta.glob('../../assets/*.{webp,svg,ogg,mp3}', { eager: true, query: '?url', import: 'default' })` 生成「文件名 → URL」映射。资源格式口径：图片仅 WebP（透明素材带 alpha）/ SVG，音频仅 OGG / MP3。
- 这样 `assets/` 仍是唯一源目录，不需要 `public/` 副本，也不会把 `manifest.md` 打进产物。
- 音频只取 URL，不在首屏解码；BGM 在首次手势后才 `fetch`/`decodeAudioData`，因此不计入首屏传输体积。
- 资源缺失时 `assets.ts` 返回 `undefined`，由 `placeholders.ts` 生成纯色+形状占位；不抛出未捕获异常。

---

## 5. 运行时架构与主循环

### 5.1 启动顺序

```text
index.html
  └─ src/systems/main.ts
       ├─ 1. 检测 Canvas 2D；不支持 → 静态降级页（E-14）
       ├─ 2. 创建 CanvasHost（尺寸/DPR/坐标）
       ├─ 3. 创建 SaveStore（localStorage 或内存降级）
       ├─ 4. 读取存档；损坏 → 备份 + 默认值 + 5s 提示
       ├─ 5. 创建 LeaderboardStore（独立键）
       ├─ 6. 创建 AudioEngine（不播放；等待首次手势）
       ├─ 7. 创建 AppController（状态机、关卡、渲染、UI）
       ├─ 8. 渲染选关界面；启动 rAF 循环
       └─ 9. 绑定 pointerdown 一次，解锁 AudioContext
```

启动期间不得发起任何网络请求；所有资源由同源静态文件提供。

### 5.2 对局状态机

状态枚举（与 REQ-017 完全一致）：

```text
idle | playing | settling | won | lost | result
```

| 当前 | 事件 | 下一状态 | 副作用 |
|---|---|---|---|
| idle | START_LEVEL | playing | 生成种子/棋盘、载入关卡、显示目标与步数 |
| playing | VALID_SWAP | settling | 锁定输入、扣步在结算结束后一次性执行 |
| playing | INVALID_SWAP（仅 B 类＝相邻有效格交换后无匹配） | playing | 200ms 回弹、1 次 invalid 音效、不扣步；同格 / 非相邻不产生本事件 |
| playing | ABANDON | idle | 本局作废；不写存档分数、不写排行榜 |
| settling | SETTLE_CONTINUE | playing | 解锁输入；若无可交换则触发重排 |
| settling | SETTLE_WIN | won | 写存档/排行榜、播放胜利音效 |
| settling | SETTLE_LOSE | lost | 写存档（不写排行榜）、播放失败音效 |
| won | SHOW_RESULT | result | 面板淡入 200ms；300ms 输入锁 |
| lost | SHOW_RESULT | result | 同上；隐藏「下一关」 |
| result | RESTART | playing | 新种子、分数/步数重置；不写排行榜 |
| result | NEXT_LEVEL | playing | 进入下一关（仅胜利且有下一关） |
| result | BACK_TO_SELECT | idle | 返回选关 |
| 其他 | 任意 | — | 抛 `IllegalTransitionError`（测试可断言） |

命中失败分类（CR-008 / CR-010）：A 类（棋盘投影矩形外 / 石块格 / 死格）由输入层静默忽略，**不产生 `INVALID_SWAP`**、不扣步、不播 invalid 音效、不做 aria 播报、不改变选中态；同格点击＝取消选中、非相邻点击＝选中转移，均为正常选中操作，**不产生 `INVALID_SWAP`**、不播 invalid、不扣步；`INVALID_SWAP` 仅对应 B 类（相邻有效格交换后无匹配的 200ms 回弹）。

输入允许条件：`status === 'playing'` 且 `performance.now() >= inputUnlockAt`。`settling` 与面板出现后 300ms 内一律忽略。

### 5.3 主循环

- 使用单个 `requestAnimationFrame` 循环；`loop.ts` 维护 `lastTs`、帧间隔环形缓冲、p95 统计。
- 逻辑不在每帧推进：交换/消除/下落是事件驱动的离散结算；每帧只推进动画时间轴与绘制。
- `document.visibilityState === 'hidden'` 时取消 rAF、暂停 BGM；恢复时把 `lastTs` 重置为当前时间，**不追帧、不补算**（E-10）。
- 单次有效交换的完整动画（含全部连锁）目标 ≤ 6 秒；若事件轮次过多，`scene.ts` 在不改变最终状态的前提下压缩等待时间（不跳过结算结果），并在测试模式记录告警。
- 每帧绘制预算 8ms；`loop.ts` 用 `performance.now()` 打点，测试构建暴露只读统计。

### 5.4 逻辑与动画的桥接

```text
AppController.requestSwap(a,b)
  → core.trySwap(state,a,b)
      ├─ rejected（仅 B 类＝相邻无匹配）→ render 播放 200ms 回弹 + 1 次 invalid 音效（A 类落点、同格取消选中、非相邻选中转移均由输入层处理，不进入本流程、不播 invalid）
      └─ valid   → core.resolveSwap(state, swap)
                      → ResolveResult { state, rounds[], events[], outcome }
  → scene.play(rounds, events)
      → 逐轮播放：交换 150ms → 消除 180ms → 下落 160ms → 下一轮
  → AppController.commit(resolveResult.state)
      → 写存档/排行榜、切换状态、更新 HUD
```

关键约束：

- `core.resolveSwap` 是纯函数，一次算完所有连锁，不等待动画；因此同种子同操作的最终结果与帧率无关。
- `scene.play` 只消费事件，不改 `state`；动画期间 UI 显示逻辑快照的插值。
- 只有 `commit` 后才写存档/排行榜，避免动画中断造成半写入。
- 结算面板出现后 300ms 内 `inputUnlockAt = panelShownAt + 300`，所有棋盘与面板按钮点击被忽略（REQ-028）。

---

## 6. 数据结构

### 6.1 棋盘、格、元素、障碍

```ts
export type TileKind = 'star' | 'water' | 'leaf' | 'flame' | 'crystal' | 'bolt';
export type SpecialKind = 'line-h' | 'line-v' | 'rainbow';

export interface Tile {
  id: number;                 // 单调递增，仅用于渲染/动画追踪
  kind: TileKind | null;      // 彩虹为 null
  special: SpecialKind | null;
}

export type Obstacle =
  | { type: 'ice'; layers: 1 }
  | { type: 'stone'; layers: 1 | 2 }
  | { type: 'hole' };

export interface Cell {
  tile: Tile | null;
  obstacle: Obstacle | null;  // 冰块可与 tile 共存（覆盖层）
}

export interface Board {
  cols: 8;
  rows: 8;
  cells: Cell[];              // 长度 64，index = (row-1)*8 + (col-1)
  nextTileId: number;
}
```

语义约定（对应 SC-03）：

- 普通格：`tile != null, obstacle == null`。
- 冰块格：`tile != null, obstacle.type == 'ice'`；冰是覆盖层，元素可匹配。
- 石块格：`tile == null, obstacle.type == 'stone'`；不可放元素、不可匹配、阻挡下落。
- 死格：`tile == null, obstacle.type == 'hole'`；永久不可用。
- 彩虹元素：`special === 'rainbow'` 且 `kind === null`；直线特化保留原 `kind`。
- 所有坐标对外 1 基（与 spec 一致），内部换算为 0 基索引；换算函数只在 `board/model.ts`。

### 6.2 对局状态

```ts
export type GameStatus = 'idle' | 'playing' | 'settling' | 'won' | 'lost' | 'result';

export interface GoalProgress {
  goalId: string;
  current: number;
  target: number;
  done: boolean;
}

export interface GameStats {
  movesUsed: number;
  clearedTiles: number;
  iceBroken: number;
  stoneBroken: number;
  collected: Record<TileKind, number>;
}

export interface GameState {
  status: GameStatus;
  levelId: 1|2|3|4|5|6|7|8;
  seed: number;               // uint32
  rngState: number;           // uint32
  board: Board;
  score: number;
  movesLeft: number;
  cascade: number;            // 当前轮次 c，从 1 开始
  goals: GoalProgress[];
  stats: GameStats;
  settlementId: string | null; // 结算幂等键；未结算为 null
}
```

### 6.3 结算结果与事件

```ts
export interface RunInfo {
  cells: number[];            // 本 run 的格子索引
  orientation: 'h' | 'v';
  kind: TileKind;
  length: number;
}

export interface RoundResult {
  cascade: number;            // c
  runs: RunInfo[];
  cleared: number[];          // 本轮最终清除的格子索引（去重）
  specialsCreated: { index: number; special: SpecialKind }[];
  scoreGain: number;
  iceBroken: number;
  stoneBroken: number;
  collected: Partial<Record<TileKind, number>>;
  boardAfterClear: Board;     // 消除后、下落前
  boardAfterGravity: Board;   // 下落补充后
}

export type GameEvent =
  | { type: 'swap-committed'; a: number; b: number }
  | { type: 'swap-rejected'; a: number; b: number; reason: 'not-adjacent' | 'blocked' | 'no-match' }
  | { type: 'round-start'; cascade: number }
  | { type: 'tiles-cleared'; cells: number[]; cascade: number }
  | { type: 'special-created'; index: number; special: SpecialKind }
  | { type: 'special-triggered'; special: SpecialKind; origin: number }
  | { type: 'obstacle-hit'; index: number; obstacle: 'ice' | 'stone'; layersAfter: number }
  | { type: 'gravity'; moves: { from: number; to: number }[]; spawned: number[] }
  | { type: 'shuffle'; cells: number[] }
  | { type: 'score-changed'; score: number; delta: number }
  | { type: 'moves-changed'; movesLeft: number }
  | { type: 'won' }
  | { type: 'lost' };

export interface ResolveResult {
  state: GameState;
  rounds: RoundResult[];
  events: GameEvent[];
  outcome: 'continue' | 'won' | 'lost';
}
```

所有事件均为普通对象，可直接 JSON 序列化，便于测试与调试回放。

### 6.4 不变量

1. `board.cells.length === 64`；索引与行列一一对应。
2. `stone`/`hole` 格 `tile === null`；`ice` 格 `tile !== null`。
3. 初始棋盘无任何横/竖 ≥3 同种连线；至少存在 1 个可产生匹配的相邻交换。
4. 结算完成后不存在「可下落但悬空」的元素；石块/死格阻挡列。
5. 一轮内同一格最多清除一次；L/T 形按并集。
6. `score`、`movesLeft`、`cascade` 均为整数；`score >= 0`，`movesLeft >= 0`。
7. `status === 'settling'` 时输入被拒绝；`status === 'won'/'lost'` 只由结算结束进入。
8. 彩虹元素 `kind === null`；直线特化 `kind !== null`。
---

## 7. 随机数与可复现方案

### 7.1 PRNG 选型

采用 **mulberry32**（32 位状态、32 位输出），原因：

- 代码 <20 行，无依赖，跨浏览器结果一致；
- 状态就是一个 uint32，可直接存入 `GameState.rngState` 并 JSON 往返；
- 对 8×8 棋盘的生成/补充/重排足够，不需要密码学随机；
- 同种子同调用序列输出完全一致，满足 REQ-002。

```ts
// 纯函数形态：输入状态，返回值与下一状态
export function nextUint32(state: number): { value: number; state: number } {
  let a = (state + 0x6D2B79F5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, state: a };
}
```

封装接口（`src/core/rng.ts`）：

```ts
export interface Rng {
  state: number;
  nextUint32(): number;
  nextInt(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}
```

- `nextInt(n)` 使用拒绝采样避免模偏差（n ≤ 64，偏差可忽略，但仍按无偏实现）。
- `shuffle` 使用 Fisher-Yates，返回新数组，不修改入参。
- core 中禁止 `Math.random()`、`Date.now()`、`performance.now()`；由测试 `grep` + 静态断言保证。

### 7.2 种子来源与生命周期

| 场景 | 种子来源 | 说明 |
|---|---|---|
| 新开一关 | systems 层 `crypto.getRandomValues(new Uint32Array(1))[0]` | 浏览器安全随机；不可用时回退 `Date.now() ^ (performance.now()*1000)`，仅 systems 层允许 |
| 重开本局 | 重新生成种子 | REQ-019 要求新棋盘 |
| 下一关 | 重新生成种子 | 每关独立 |
| 排行榜记录 | 保存本局 `seed` | REQ-035 要求可复现 |
| 自动化测试 | 固定种子（如 `0x12345678`） | 单测/E2E 使用 |

种子以 uint32 数字存储；排行榜 schema 允许 `string | number`，本实现写 number。展示时可格式化为 8 位十六进制，仅用于调试，不作为 UI 必需字段。

### 7.3 可复现测试

1. 相同 seed + 相同 `[{a,b}, ...]` 操作序列执行两次，比较：
   - 每次交换后的 `board` 深相等；
   - 每轮 `RoundResult` 深相等；
   - 最终 `score`、`movesLeft`、`status`、`goals` 深相等。
2. 序列化测试：`JSON.parse(JSON.stringify(state))` 后继续执行同一操作序列，结果与原状态一致。
3. 禁止随机源泄漏：扫描 `src/core/**`，不得出现 `Math.random`、`Date.now`、`performance.now`、`window`、`document`。
4. 生成器统计测试（非业务断言）：固定 1000 个种子，初始棋盘均满足 REQ-001 约束；补充元素分布卡方检验不拒绝均匀假设（p > 0.01，仅作健康检查）。

---

## 8. 核心算法（三消；不含合成）

> G1-Q1 已确认采用三消（相邻交换 match-3），本方案不实现合成（merge）算法；以下为棋盘生成、匹配、消除、连锁与重排算法。

### 8.1 坐标与索引

- spec 使用 1 基行列；代码内部统一 0 基索引：`index = (row - 1) * 8 + (col - 1)`。
- `toIndex(row, col)`、`toRowCol(index)` 只在 `src/core/board/model.ts` 实现。
- 关卡数据中的 `CellCoord` 使用 1 基，载入时由 `level/validate.ts` 校验范围并转换为索引。
- 相邻只允许上下左右；对角不算相邻（REQ-003）。

### 8.2 初始棋盘生成（REQ-001、REQ-025）

```text
generateBoard(level, seed):
  rng = createRng(seed)
  for attempt in 1..1000:
    board = emptyBoard()
    placeObstacles(board, level)        // 石块/死格为空；冰块保留 tile 位
    for each cell in row-major order:
      if cell is stone/hole: continue
      kinds = level.tileKinds
      candidates = kinds.filter(k => !wouldMatchAt(board, cell, k))
      if candidates.empty: fail attempt
      board[cell].tile = makeTile(rng.pick(candidates))
    if hasAnyMove(board): return { board, rngState: rng.state }
  throw BoardInitError('关卡初始化失败，请重试')
```

`wouldMatchAt` 只检查左侧连续 2 个与上方连续 2 个同种元素；这样按行优先填充即可保证初始无三连。冰块格参与检查；石块/死格跳过。

`hasAnyMove`：遍历每个非阻挡格与其右/下邻格，模拟交换后调用 `findMatches`；任一产生匹配即返回 true。若棋盘存在彩虹元素，则彩虹与任意相邻普通元素交换都视为有效，直接返回 true。

### 8.3 匹配检测（REQ-007）

```text
findMatches(board):
  runs = []
  for each row: scan consecutive same-kind tiles length >= 3 → RunInfo('h')
  for each col: scan consecutive same-kind tiles length >= 3 → RunInfo('v')
  matched = union of all run.cells
  return { runs, matched }
```

- 只扫描 `tile != null` 的格；冰块下的元素参与；石块/死格跳过。
- L/T 形由「行 run + 列 run 的并集」自然得到；同一格在 `matched` 中只出现一次。
- run 元数据保留 `length/orientation/kind`，供长度奖励与特化生成使用。
- 同一行可能出现重叠 run（例如 6 连同时包含两个 3 连窗口）；扫描时按**最长连续段**生成一个 run，不拆成多个重叠 run。这样 6 连只计一次 +120，不重复计奖。

### 8.4 交换合法性（REQ-003 ~ REQ-006）

```text
trySwap(state, a, b):
  if !inBounds(a) or !inBounds(b): reject('blocked')   // 防御分支：A 类落点由输入层静默忽略，正常不进入本函数
  if a == b: reject('not-adjacent')       // 同格：UI 已按取消选中处理，不构成交换尝试，不播 invalid（防御分支）
  if !adjacent(a,b): reject('not-adjacent')  // 防御分支：UI 已按选中转移处理，不播 invalid
  if cell[a].tile == null or cell[b].tile == null: reject('blocked')  // 石块/死格/空（A 类）：防御分支，不播 invalid 音效
  swap tiles
  if both tiles are rainbow: return valid (rainbow+rainbow)
  if one tile is rainbow and the other is a normal tile (special == null): return valid (rainbow+normal)
  // 彩虹 + 直线特化属于未定义组合：不自动生效，继续按 REQ-005 判定是否形成匹配
  matches = findMatches(board)
  if matches.nonEmpty: return valid
  swap back; return reject('no-match')
```

- 彩虹与普通/彩虹交换即使不产生三连也有效（否则 REQ-012/REQ-013 无法触发）。
- 直线特化与普通元素交换不自动生效；只有它被匹配/被其他特化波及时才触发（REQ-012 的“被消除时”）。
- B 类无效交换（仅「两个相邻有效格交换后无匹配」）由 UI 播放 200ms 回弹与 1 次 invalid 音效；core 返回交换前快照，保证步数/分数/障碍层数不变。A 类（矩形外 / 石块格 / 死格）由输入层静默忽略；同格点击（取消选中）与非相邻点击（选中转移）属于正常选中操作，均不进入 `trySwap`、不播 invalid（CR-008 / CR-010）。

### 8.5 特化生成（REQ-010、REQ-011）

对每个 `RunInfo`：

| 条件 | 生成 | 位置规则 |
|---|---|---|
| `length === 4`，横向 | `line-h` | 优先玩家本次交换涉及且在该 run 中的格；若两个都涉及，取“被拖动元素的目标格”；否则取 run 最左格 |
| `length === 4`，竖向 | `line-v` | 同上；竖向取目标格 / 最上格 |
| `length >= 5` | `rainbow` | 同上；彩虹 `kind = null` |
| 同轮两处 4 连 | 各生成 1 个 | 两处独立；若位置冲突，按 run 长度降序、再按索引升序选下一个非特化格 |

补充规则：

- 连锁轮（非玩家直接交换）没有“玩家涉及格”，横向取最左、竖向取最上（REQ-010）。
- 一个 run 只生成 1 个特化；≥5 连只生成彩虹，不再额外生成直线。
- 新生成的特化替换该格原元素，**不计入本轮 N**（REQ-010/011）；`expandClears` 必须把 `created` 位置从 `cleared` 中排除，否则特化会被误删。
- 若同轮既有 ≥5 连又有 4 连且共享格：彩虹优先占用共享格；4 连顺延到下一个非特化格；无可用格则跳过该 4 连特化（测试记录警告）。这是为满足 REQ-002 确定性而定义的裁决顺序。
- 特化生成位置若原本是冰块格，冰层仍在该格；特化元素在冰下，冰破后仍保留特化。

### 8.6 消除扩展与计分（REQ-012 ~ REQ-014）

```text
expandClears(board, matched, swapContext, created):
  createdIndexes = new Set(created.map(c => c.index))
  cleared = new Set(matched.filter(i => !createdIndexes.has(i)))
  // 新生成特化的位置不进入 cleared
  baseCount = matched.size
  specialQueue = all special tiles in cleared
  lineExtra = new Set()
  rainbowCleared = new Set()
  while specialQueue not empty:
    s = pop
    if visited(s): continue
    if s.special is line-h: add entire row to cleared; lineExtra.add(extra cells)
    if s.special is line-v: add entire col to cleared; lineExtra.add(extra cells)
    if s.special is rainbow:
      if swapContext is rainbow+rainbow: add all non-hole tiles to cleared; rainbowAll = true
      else if swapContext.partnerKind != null: add all tiles of partnerKind
      else: add all tiles of mostCommonKind(board)
    newly added specials → push queue
  return { cleared, lineExtra, rainbowAll }
```

计分口径（与 REQ-012/014 及 3840 基准一致）：

- `N` = 本轮最终被清除的元素总数（去重，含特化自身；不含石块/死格）。
- `B` = 4 连 +50/处、≥5 连 +120/处；每个 `RunInfo` 计一次。
- `S` = **直线特化额外波及**、且不属于基础匹配集合的元素数；每个 +30。
- 彩虹清色、彩虹+彩虹的清除计入 `N`，`S = 0`；因此彩虹+彩虹清 64 格、c=1 得 `60×64 = 3840`，与 spec 基准一致。
- 公式：`scoreGain = Math.round((60*N + B + 30*S) * M(c))`；`M(c) = min(1 + 0.5*(c-1), 4.0)`。
- 同一格被多个特化波及只计一次；`lineExtra` 也只计一次。
- 冰层：`cleared` 中的冰块格 → 冰层 -1（1→0 时冰破，计入 `iceBroken`）。
- 石块：在 `cleared` 中（直线整行/整列）或与 `cleared` 上下左右相邻 → 层数 -1；2→1→0，0 时变为普通空格并计入 `stoneBroken`。
- 死格：永不加入 `cleared`，不受伤。
- 彩虹+普通：若交换伙伴是普通元素，清除全盘该颜色；若伙伴是直线特化，按 SC-07 的默认语义（未定义组合不产生额外组合技，仅按 REQ-005 判定）；若伙伴是彩虹，走彩虹+彩虹。

### 8.7 下落与补充（REQ-008、REQ-023、REQ-024）

```text
applyGravity(board, rng, tileKinds):
  for each column:
    segments = split column by stone/hole (blockers)
    for each segment bottom-up:
      compact tiles downward (stable order)
      fill top empty cells with rng.pick(tileKinds)
  return { board, moves, spawned }
```

- 冰块不阻挡下落；石块破坏前阻挡；死格永久阻挡。
- 石块被破坏后变为普通空格，下一次重力会把它所在列上方的元素落下来，并在顶部补充。
- 补充概率：直接 `nextInt(kinds.length)` 等概率；L1-L4 6 种各 1/6，L5-L8 5 种各 1/5。
- 新元素 `id` 单调递增，保证动画可追踪。
- 下落结束后必须满足「无悬空元素」不变量；测试逐列断言。

### 8.8 连锁结算（REQ-009、REQ-015、REQ-018）

```text
resolveSwap(state, swap):
  state = state with swapped board
  c = 1
  rounds = []
  loop:
    matches = findMatches(board)
    if matches.empty: break
    created = generateSpecials(matches, swap, c)
    expanded = expandClears(board, matches, swap, created)
    gain = scoreRound(expanded, matches.runs, c)
    board = removeCleared(expanded.cleared)      // created 位置保留，不进入 cleared
    board = applySpecials(board, created)        // 在保留格写入新特化
    board = applyGravity(board, rng, level.tileKinds)
    rounds.push(...)
    c += 1
    if c > 1000: throw Error('cascade guard')  // 仅防实现死循环，正常不触发
  movesLeft -= 1                              // 仅在完整结算后扣 1 步
  outcome = evaluateOutcome(state, level)
  return { state, rounds, events, outcome }
```

- `outcome` 顺序：先判 `allGoalsDone` → `won`（即使 movesLeft 同时为 0）；否则 `movesLeft === 0` → `lost`；否则 `continue`。`continue` 返回后由调用方执行 `ensurePlayable`：若无可交换且 `movesLeft > 0` 则重排；重排仍失败则判负。
- 胜负只在连锁完全结束后判定一次（REQ-018）。
- 无效交换不进入此函数，不扣步（REQ-015）。
- 重排/特化连锁/重开不扣步。

### 8.9 无可行步重排（REQ-016）

```text
ensurePlayable(state):
  if hasAnyMove(board): return state
  if movesLeft == 0: return lost
  tiles = all non-blocker tiles in row-major order
  for attempt in 1..100:
    shuffled = rng.shuffle(tiles)
    candidate = placeTilesOnSameCells(shuffled)
    if !findMatches(candidate).nonEmpty && hasAnyMove(candidate):
      return candidate + shuffle event
  // 保留分布重新生成棋盘：同样元素多重集，重新随机落位
  for attempt in 1..100:
    candidate = randomPlaceSameMultiset(tiles, rng)
    if !findMatches(candidate).nonEmpty && hasAnyMove(candidate):
      return candidate + shuffle event
  return lost
```

- 重排不扣步，播放 shuffle 音效并提示「无可消除步骤，已重排」2 秒。
- 保分布：各 `TileKind` 数量完全不变；特化元素作为整体保留（不降级为普通元素）。
- 100 次失败后重生成；仍失败判负（REQ-016）。
- 重排后不得立即产生三连；否则继续尝试。

### 8.10 目标与星级（REQ-022、REQ-023、REQ-024、REQ-026）

```ts
type Goal =
  | { type: 'score'; target: number }
  | { type: 'collect'; tile: TileKind; target: number }
  | { type: 'obstacle'; obstacle: 'ice' | 'stone'; target: number };
```

- 分数目标：`state.score >= target`。
- 收集目标：`stats.collected[tile] >= target`；每次清除该 kind 元素累加。
- 障碍目标：`stats.iceBroken` / `stats.stoneBroken` 达到 target；层数归零才计数。
- AND：全部 `done` 才胜利；HUD 逐项显示 `current/target`。
- 星级：失败 0★；胜利时 1★（全部目标），`score >= stars.two` → 2★，`score >= stars.three` → 3★；3★ 封顶。
- 存档 `bestStars = max(old, new)`；低星重玩不覆盖高星（REQ-026）。
- 历史最高分 `bestScore = max(old, score)`，失败局也参与最高分比较；`clearCount` 仅胜利 +1；`lastPlayedAt` 每次结算更新。该语义与 REQ-030 的“结算完成（胜/负）写入”一致。

### 8.11 复杂度与性能

| 操作 | 复杂度 | 说明 |
|---|---|---|
| 匹配扫描 | O(64) | 8 行 + 8 列 |
| 消除扩展 | O(64 + 特化数×8) |  visited 去重 |
| 重力/补充 | O(64) | 逐列分段 |
| 可行步检测 | O(64×4×64) 最坏 | 只用于生成/重排/结算后，不在每帧执行 |
| 单轮结算 | < 1ms（现代桌面） | 纯数组操作；测试基准 1000 次 < 50ms |
| 渲染 | 单帧 ≤8ms | 预渲染背景、对象池、无每帧分配 |

---

## 9. 渲染设计

### 9.1 逻辑布局

| 区域 | 逻辑坐标 | 尺寸 | 内容 |
|---|---|---|---|
| 画布 | (0,0) | 960×720 | 4:3 |
| 棋盘 | (224,96) | 512×512 | 8×8，单格 64 |
| 棋盘外框 | (200,72) | 560×560 | `board-frame.webp`，含 24px 内边距 |
| 顶部 HUD | (0,0) | 960×96 | 分数、关卡名、设置/暂停按钮（DOM 叠加） |
| 底部目标区 | (0,608) | 960×112 | 目标进度、剩余步数（DOM 叠加） |
| 左右留白 | 224px | — | 装饰/背景 |

- 逻辑分辨率固定 960×720；CSS 尺寸按容器等比缩放，保持 4:3，多余空间 letterbox。
- `ctx.setTransform(scaleX, 0, 0, scaleY, offsetX, offsetY)` 把逻辑坐标映射到设备像素；所有绘制用逻辑坐标。
- 屏幕 → 逻辑：`lx = (clientX - rect.left) * 960 / rect.width`；`ly = (clientY - rect.top) * 720 / rect.height`。
- 监听 `ResizeObserver`、`window.resize`、`matchMedia` 的 DPR 变化；200ms debounce；DPR 上限 2。
- 背景 1920×1080 与 4:3 画布比例不同：使用 `cover` 裁切，锚点居中；棋盘区域不被背景干扰。该裁切是视觉实现选择，不改变逻辑布局。

### 9.2 渲染分层

| 层 | 内容 | 更新频率 | 实现 |
|---|---|---|---|
| L0 背景 | `bg-main.webp` 预渲染到离屏 canvas（960×720） | 初始化/尺寸变化 | 每帧 `drawImage` 一次 |
| L1 棋盘 | 外框、64 个空槽、障碍底图 | 棋盘变化/动画 | `board-renderer.ts` |
| L2 元素 | 普通元素、特化、选中高亮、色盲符号 | 每帧 | `tile-renderer.ts` |
| L3 特效 | 消除闪光、粒子、特化闪光 | 动画期间 | `fx.ts`，对象池上限 64 |
| L4 DOM UI | HUD、面板、按钮、设置、排行榜 | 状态变化 | `ui/`，绝对定位在 canvas 上方 |

- 单 canvas 绘制 L0-L3；DOM L4 负责可访问性、44px 热区、焦点与 aria-live。
- 背景预渲染避免每帧缩放 1920×1080 图片；尺寸变化时重建离屏 canvas。
- 不使用 `filter: blur`、大面积阴影、每帧 `createLinearGradient`；渐变在初始化时缓存。

### 9.3 资源加载与占位（REQ-042）

```ts
const urls = import.meta.glob('../../assets/*.{webp,svg,ogg,mp3}', {
  eager: true, query: '?url', import: 'default'
});
export function assetUrl(name: string): string | undefined { ... }
```

- 图片：`new Image()` 加载；`onerror` → `placeholders.ts` 生成纯色+形状；`console.warn` 仅一次（模块级 flag）。
- 占位形状与正式贴图同形状（星/水滴/叶/火焰/菱形/闪电），保证灰度可辨。
- 资源加载不阻塞启动：先渲染占位，加载完成后替换；已加载图片缓存。
- 资源缺失不弹错误框，游戏可继续（REQ-042）。

### 9.4 元素与障碍绘制（REQ-039、REQ-040、REQ-043）

- 每种元素 64×64；绘制到格子 `(224 + col*64, 96 + row*64)`，对齐误差 ≤1px。
- 选择高亮：`tile-select.webp` 叠加 + 2px 描边；不改变元素尺寸。
- 冰块：元素下方绘制 `obs-ice.webp`，半透明蓝白；破冰后移除。
- 石块：`obs-stone-2.webp` / `obs-stone-1.webp` 按层数；破坏后换空槽并下落。
- 死格：`obs-hole.webp`；不绘制元素。
- 色盲模式：在元素中心叠加高对比符号（★ ● ▲ ■ ◆ ✚），白/黑双层描边；符号与形状对应关系固定，不随关卡变化。
- 特化：
  - 直线：原元素贴图 + 横向/纵向箭头纹理；
  - 彩虹：七彩环，中心透明；
  - 彩虹不显示颜色符号，避免误导。

### 9.5 动画时间轴（REQ-044）

| 动画 | 默认时长 | 缓动 | 减弱动效 |
|---|---:|---|---|
| 交换 | 150ms | ease-out cubic | ≤100ms，直接换位 |
| 无效回弹 | 200ms | ease-in-out | ≤100ms，无位移补间 |
| 单轮消除 | 180ms | ease-in quad | ≤100ms，透明度切换 |
| 单轮下落 | 160ms | ease-in quad（重力感） | ≤100ms，直接落位 |
| 特化触发 | 300ms | ease-out back（轻微） | ≤100ms，闪光 |
| 结算面板淡入 | 200ms | linear | ≤100ms |

- `AnimationQueue` 按 `startTime` 排序；每帧用 `now - start` 计算进度，不依赖帧率。
- 动画只影响绘制偏移/缩放/透明度；逻辑状态在 `commit` 时已确定。
- 连锁轮次间隔：上一轮下落结束即开始下一轮消除；无额外等待。
- 减弱动效：`prefers-reduced-motion: reduce` 或存档 `reducedMotion=true` 时，`MotionPolicy.reduced=true`；所有时长 `min(base, 100)` 且禁用位移补间。
- 面板 300ms 输入锁独立于动画时长；减弱动效下仍保留 300ms 防误触。

### 9.6 命中测试与热区

- 画布命中：屏幕坐标 → 逻辑坐标 → 棋盘投影矩形 → 最近邻格吸附 `(col,row)`（REQ-049，CR-003）；落在投影矩形外返回 `null`。
- 吸附算法：以 8×8 格中心为种子点做最近邻划分，即相邻格热区边界为两格中心连线的**几何中垂线**。该划分天然互不重叠、并集恰好覆盖投影矩形；点到两格中心等距时按「列索引小者优先，列相同则行索引小者优先」裁决。
- 吸附函数落点：`src/render/layout.ts` 的 `pickNearestCell(logical, layoutSnapshot)`（impl-core 维护，纯函数、无 DOM 依赖），`src/ui/input/board-input.ts`（impl-systems）只调用，不另写一套换算。
- 棋盘热区：以格子中心为锚，视觉格 64×64；热区几何 = 中垂线划分后的 Voronoi 单元，**不做外扩、也不做内缩**。
- 分级像素要求（REQ-049 / CR-003）：视口宽度 ≥600 CSS px 时单格热区 ≥40×40 CSS px（600 ÷ 960 × 64 = 40，600 px 即临界断点）；视口 <600 CSS px 时不设最小像素下限，接受等比缩放实际值（320 px → ≈21.33 px、360 px → 24 px，`cellCssSize = 64 × 视口宽 ÷ 960`）。
- 该分级像素要求替代宪法 5.2「所有可交互元素最小 44×44 CSS px」在 Canvas 棋盘格上的适用（依据 CR-003）；DOM 按钮不受此替代影响。
- DOM 按钮：`min-width/min-height: 44px`；焦点轮廓 `2px solid`，对比度 ≥3:1；必须可 Tab 聚焦并以 Enter/Space 激活。

### 9.7 性能预算与测量

| 指标 | 预算 | 实现/测量 |
|---|---|---|
| 单帧绘制 | ≤8ms | `loop.ts` 打点，测试构建暴露 p95 |
| 帧间隔 p95 | ≤20ms | 10 秒对局采样，环形缓冲 600 帧 |
| 低帧占比 | <50fps 的帧 ≤5% | 同一样本 |
| 首屏 gzip | ≤3.0MB | `vite build` + gzip 统计脚本 |
| 初始 JS | ≤200KB（gzip） | 构建报告断言 |
| 内存 | ≤200MB | Chrome Performance Memory 手工记录 |
| DPR | `min(devicePixelRatio, 2)` | `canvas-host.ts` |
| 粒子 | ≤64 个同时 | 对象池；超出复用最旧 |

优化手段：背景离屏预渲染、图片缓存、无每帧对象分配、事件驱动结算、单 canvas、避免 `shadowBlur`、避免每帧布局读取（`getBoundingClientRect` 只在 resize/pointerdown 缓存）。

---

## 10. 输入抽象（鼠标 + 触摸统一）

### 10.1 Pointer Events 统一模型

`src/ui/input/pointer.ts` 只做三件事：

1. 监听 `pointerdown` / `pointermove` / `pointerup` / `pointercancel`；
2. 把 `clientX/clientY` 转为逻辑坐标，并调用 `layout.pickNearestCell` 做最近邻吸附（REQ-049）；
3. 输出语义事件：`press(cell)`、`drag(from,to)`、`release(cell)`、`cancel()`。

```ts
export interface BoardPointerEvent {
  pointerId: number;
  pointerType: 'mouse' | 'touch' | 'pen';
  cell: CellCoord | null;
  clientX: number;
  clientY: number;
  isPrimary: boolean;
}
```

- 只处理 `isPrimary === true` 的指针；多指触摸忽略后续指针，避免误交换。
- `pointerdown` 时 `setPointerCapture`；`pointerup`/`pointercancel` 释放。
- canvas 设置 `touch-action: none`，阻止页面滚动/缩放；页面其他区域保留正常滚动。
- `pointercancel`（来电、系统手势）一律取消当前拖拽，不扣步。

### 10.2 最近邻吸附、拖拽与两段点击

命中（REQ-049，CR-003）：`pointerdown` 的 `clientX/clientY` → 逻辑坐标 → `layout.pickNearestCell(logical)`。点落在棋盘投影矩形内即吸附到距其最近的格，相邻热区边界为两格中心连线的中垂线；投影矩形外、石块格、死格 → `null`。鼠标、触摸、笔共用同一函数，不设触摸专用分支。

| 操作 | 判定 | 结果 |
|---|---|---|
| 按下 A → 移动 → 抬起 | **主轴位移 ≥ 0.5 格宽（水平）/ ≥ 0.5 格高（垂直）**，且目标为上下左右相邻 | 提交交换 A↔B |
| 按下 A → 抬起（主轴位移 < 0.5 格） | 点击 | 选中 A；若 A 已选中则取消选中（同格：不交换、不扣步、分数不变、**不播 invalid 音效**，REQ-003） |
| 已选中 A → 点击相邻 B | 点击 | 提交交换 A↔B |
| 已选中 A → 点击非相邻普通格 B | 点击 | 选中态转移到 B（REQ-004 的“清除或转移”取转移）；不交换、不扣步、分数不变、**不播 invalid 音效**（REQ-003 / CR-010） |
| 点击石块/死格/棋盘外（吸附为 `null`） | 静默忽略（A 类） | 不改变选中态（不新增、不清除、不转移）、不交换、不扣步、分数不变；**不播 invalid 音效**、不做 aria 播报 |
| `settling` / 面板 300ms 锁 | 输入锁 | 完全忽略，不播报错误 |

- 阈值量化：`DRAG_THRESHOLD_CELL_RATIO = 0.5`；水平阈值 = `0.5 × cellCssSize`，垂直阈值 = `0.5 × cellCssSize`，其中 `cellCssSize = 64 × 视口宽 ÷ 960`。**固定的 16 CSS px 阈值已废止**（CR-003 同步修订 REQ-003，两处阈值同源，避免同一手势两套判定）。
- 分级像素（REQ-049）：视口 ≥600 CSS px 时单格 ≥40×40 CSS px；<600 CSS px 不设下限，按等比缩放实际值（320 px ≈21.33、360 px = 24）。600 px 为唯一断点，由 `layout.cellCssSize` 计算，不硬编码在输入层。
- 主轴与方向：`|dx| ≥ |dy|` → 水平轴，否则垂直轴；目标格 = 起点格沿主轴符号方向 +1。斜向拖拽只取主轴，主轴位移达标即判交换。
- 位移量在**屏幕/CSS 坐标**测量，与吸附共用同一布局快照，避免 DPR 与 CSS 缩放的双重换算误差。
- 判定顺序固定为「先吸附、后手势」：吸附为 `null` 时按 A 类静默忽略处理（不产生 invalid 事件、不播 invalid 音效），不进入位移判定，避免矩形外拖拽被误判为交换。
- 拖拽过程中高亮当前吸附格；松手时吸附格非相邻 → 不构成相邻交换尝试（不提交交换、不扣步、不播 invalid 音效）；B 类 invalid 仅限两个相邻有效格交换后无匹配（CR-010）。
- 点击已选中 A 自身 → 取消选中（REQ-003）；同格不构成交换尝试，不交换、不扣步、分数不变、不播 invalid 音效。
- 选中态在交换提交、状态切换时清除；同格点击取消选中、非相邻点击转移选中；B 类（相邻无匹配）回弹后按 REQ-004 清空选中；A 类落点（矩形外 / 石块格 / 死格）一律不改变选中态（不新增、不清除、不转移）。

### 10.3 与状态机的交互

- `AppController` 在 `pointerdown` 前检查 `canAcceptInput()`：`status === 'playing' && now >= inputUnlockAt`。
- `settling` 时 `pointer.ts` 仍接收事件但不派发语义事件，避免浏览器手势穿透。
- 交换提交后立即进入 `settling`，后续输入忽略，直到 `commit` 解锁。
- 结算面板按钮使用 DOM click，独立于棋盘输入；面板出现 300ms 内按钮 `disabled`/`pointer-events:none`。
---

## 11. 存档设计

### 11.1 存储键与隔离

| 键 | 内容 | 说明 |
|---|---|---|
| `wmg.save.v1` | 主存档 JSON | 关卡进度、最高分/星级、设置、统计 |
| `wmg.leaderboard.v1` | 本地排行榜 JSON | 与存档完全独立；任一损坏不影响另一个 |
| `wmg.backup.save.<ISO>` | 损坏存档原文 | REQ-031 要求含时间戳的独立备份键 |
| `wmg.backup.leaderboard.<ISO>` | 损坏排行榜原文 | 架构健壮性补充；不影响 REQ-031 |
| ~~`wmg.meta.lastSession`~~ | 已废弃的「独立中断标记键」方案 | CR-004 裁决后**不新增独立键**：`lastSessionInterrupted` 作为字段并入 `wmg.save.v1`（REQ-029），避免出现第二份存档事实源 |

- 键名集中在 `src/systems/storage/schema.ts`，禁止散落字符串。
- 存档与排行榜分开读写；排行榜损坏不得触发存档重置，反之亦然（spec 8.2 第 4 条）。
- 不保存进行中对局（REQ-030）；刷新/关闭后回到该关开始态。
- `lastSessionInterrupted` 仅表示「上次会话存在未结算对局」这一语义，**不含**棋盘、当前步数、当前分数、连锁状态等任何对局快照；它不是恢复对局的依据（G1-Q3 不变）。
- 除 `wmg.save.v1` / `wmg.leaderboard.v1` / 备份键外不新增存储键；`sessionStorage`、`IndexedDB`、`beforeunload` 写存储一律禁用（宪法 2.3）。

### 11.2 `SaveDataV1` schema

> 术语对齐：任务书中的 `schemaVersion` 与 spec 的 `saveVersion` 指同一版本字段；落盘键名固定为 `saveVersion`，值为 `1`，不再新增 `schemaVersion` 别名，避免双字段漂移。

```json
{
  "saveVersion": 1,
  "lastSessionInterrupted": false,
  "unlockedLevelId": 1,
  "levelRecords": [
    {
      "levelId": 1,
      "bestScore": 0,
      "bestStars": 0,
      "clearCount": 0,
      "lastPlayedAt": "2026-11-10T00:00:00.000Z"
    }
  ],
  "settings": {
    "bgmEnabled": true,
    "bgmVolume": 60,
    "sfxEnabled": true,
    "sfxVolume": 80,
    "reducedMotion": false,
    "colorblindMode": false
  },
  "stats": {
    "totalMoves": 0,
    "totalClearCount": 0,
    "totalPlaySeconds": 0
  },
  "updatedAt": "2026-11-10T00:00:00.000Z"
}
```

- `levelRecords` 固定 8 项（levelId 1..8），首次初始化全部为零值，避免“缺失记录”分支；读取时仍允许 0..8 项以兼容手工编辑。上方 JSON 仅展示 1 条，实际首次写入含 8 条。
- `bestScore` 整数 ≥0；`bestStars` 0..3；`clearCount` ≥0；`lastPlayedAt` ISO 8601。
- 设置默认值：BGM 开/60、音效开/80、减弱动效关、色盲关（REQ-047）。
- `stats.totalPlaySeconds` 由前台下计时累加，切后台暂停；只用于统计，不参与胜负。
- `updatedAt` 每次成功写入更新。
- `lastSessionInterrupted`：布尔，默认 `false`；取值语义 = 「上次会话存在未结算对局」。仅用于驱动 E-04 的一次性提示，**不是对局快照**，不参与胜负判定，不参与排行榜。

### 11.3 校验与类型守卫

读取流程：

```text
raw = storage.getItem(KEY_SAVE)
if raw == null: return defaultSave()
try parsed = JSON.parse(raw)
catch: handleCorrupt(raw, 'json-parse')
if !isSaveDataV1(parsed): handleCorrupt(raw, 'schema')
if parsed.saveVersion !== 1: handleCorrupt(raw, 'version')
return normalize(parsed)
```

`isSaveDataV1` 逐字段检查：

- 顶层是普通对象；`saveVersion === 1`；
- `unlockedLevelId` 整数 1..8；
- `levelRecords` 数组长度 0..8；每项 `levelId` 1..8 且不重复；数值范围合法；`lastPlayedAt` 可被 `Date.parse` 解析；
- `settings` 六个字段类型/范围正确；`bgmVolume/sfxVolume` 整数 0..100；
- `stats` 三个字段整数 ≥0；
- `updatedAt` 可解析；
- `lastSessionInterrupted`：**缺失 → 读取时补 `false`，不判定为损坏**（REQ-030 / REQ-031 例外 / spec 8.2 第 5 条）；存在但类型不是布尔 → 按类型错误走 `handleCorrupt(raw, 'schema')`。

任一失败 → `handleCorrupt`：

1. 把原始字符串写入 `wmg.backup.save.<new Date().toISOString()>`；若写入失败，忽略备份但继续；
2. 写入默认存档；
3. 返回 `{ data: defaultSave(), recovered: true }`；
4. UI 顶部提示「存档已重置」5 秒（REQ-031）；
5. 游戏可正常进入第 1 关，不白屏、不抛未捕获异常。

`normalize(parsed)` 只做**默认值补齐**（`lastSessionInterrupted` 缺失 → `false`；`levelRecords` 少于 8 项 → 补零值记录），不改变任何已存在字段的合法值；补齐后的对象才是运行时 `SaveDataV1`。

### 11.4 版本与迁移/降级策略

- `SAVE_VERSION = 1`；写入时显式写 `saveVersion: 1`。
- `lastSessionInterrupted` 是 v1.1.0 的**向后兼容增补字段，不提升 `SAVE_VERSION`**（CR-004）：旧档缺该字段按 `false` 处理即可，若提升版本号，旧档会被 REQ-031 判为不兼容而整体重置，属于不可接受的退化。
- `migrations.ts` 维护 `Record<number, (raw: unknown) => unknown>`；当前为空。
- 读到 `saveVersion > 1` 或 `< 1`、非整数、缺失 → 视为不兼容，按损坏处理（REQ-031 / spec 8.2 第 3 条）。
- 未来新增字段必须：提升版本号 → 登记 CR → 定义 v(n)→v(n+1) 迁移 → 加迁移测试；未定义迁移前旧档按损坏处理。
- 不做猜测式宽松迁移；避免把错误数据带入对局。

### 11.5 写入时机与服务

`SaveService` 只暴露**四个**语义方法，与 REQ-030 的四处写入时机一一对应，无第五入口：

| # | 方法 | 触发 | 写入内容 | 关联 |
|---|---|---|---|---|
| 1 | `recordSettlement(result)` | 关卡结算完成（胜/负） | bestScore、bestStars（仅胜）、clearCount（仅胜）、lastPlayedAt、stats、**lastSessionInterrupted = false**、updatedAt | REQ-030 |
| 2 | `updateSettings(patch)` | 设置项变更 | settings、updatedAt | REQ-030/047 |
| 3 | `unlockNextLevel(levelId)` | 通关解锁后 | unlockedLevelId = max(current, levelId+1) | REQ-030/021 |
| 4 | `setSessionInterrupted(value)` | 进入关卡开局置 `true`；返回关卡选择置 `false` | lastSessionInterrupted、updatedAt | REQ-030 |

- 写入时机细节（CR-004）：
  - 开局：生成棋盘、进入 `playing` 前写 `true`（`START_LEVEL` 副作用的最后一步）。
  - 结算：`recordSettlement` 在写结算数据的同时把标记写 `false`，**合并为一次 `setItem`**（先改内存对象再落盘），不得拆成两次写。
  - 返回关卡选择：`BACK_TO_SELECT` / `ABANDON` 时写 `false`（若已是 `false` 则跳过写入，避免无意义 IO）。
  - 主菜单消费：读到 `true` → 显示一次「上一局已中断」→ 立即写 `false`；同一会话内不再重复提示，且不恢复任何对局。
- 标记写入只改一个布尔值，不连带写入棋盘/步数/分数/连锁；载荷增量 <20 字节。
- 结算写入在动画 `commit` 后同步执行；payload <20KB，目标 <5ms，硬上限 100ms。
- 不写进行中对局；不写每步分数；不写临时 UI 状态。
- 写入失败（QuotaExceeded/不可用）→ 切换内存存储 + 常驻提示条（REQ-032），后续读写走内存。
- 设置变更立即写入；滑块 `input` 事件做 100ms 节流，`change` 时强制写入，避免高频写。
- `totalMoves` 在每次有效交换结算后累加；`totalClearCount` 累加本轮消除元素数；`totalPlaySeconds` 每秒累加（前台）。

### 11.6 不可用与配额降级（REQ-032）

```ts
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

- 启动时探测：`setItem('__wmg_probe__','1')` → `removeItem`；抛异常则判定不可用。
- 不可用或写入抛 `QuotaExceededError` → 使用 `MemoryStore`（Map 实现），仅本次会话有效。
- UI 顶部常驻提示条：「当前为临时存档，刷新将丢失进度」；关闭按钮不消失，直到存储恢复（本会话不恢复）。
- 游戏功能不中断；排行榜同样走内存存储。
- `MemoryStore` 与 `localStorage` 行为等价（同一 `StorageLike` 契约），`lastSessionInterrupted` 在内存模式下照常读写，仅本次会话有效；不得因降级而跳过标记写入或改变四处写入语义。

### 11.7 重置进度（REQ-033）

- 入口：设置页「重置游戏进度」。
- 二次确认文案包含「将清除关卡进度、最高分、星级与本地排行榜，且不可恢复」。
- 确认后：`removeItem(SAVE_KEY)`、`removeItem(LEADERBOARD_KEY)`、清空内存副本、写默认存档；回到选关第 1 关未通关状态。
- 完成提示 3 秒。
- 设置也随存档清空回默认值（spec 未要求保留设置；清空后默认值最一致）。

---

## 12. 本地排行榜设计

### 12.1 定位与文案

- 本排行榜是**本地排行榜（Local Leaderboard）**：仅当前浏览器 `localStorage`，仅本机记录。
- UI 必须出现「本地排行榜」字样；禁止出现「全球」「在线」「全服」「服务器排名」。
- 页面加载与游戏过程中不得为排行榜发起任何网络请求；资源全部同源。
- 设置页可见提示：「清除浏览器站点数据将永久丢失本地排行榜记录」。

### 12.2 `LeaderboardDataV1` schema

```json
{
  "boardVersion": 1,
  "records": [
    {
      "id": "1-1731211200000-305419896",
      "levelId": 1,
      "score": 2600,
      "stars": 2,
      "movesUsed": 14,
      "achievedAt": "2026-11-10T00:00:00.000Z",
      "seed": 305419896
    }
  ]
}
```

- `id`：`${levelId}-${achievedAt 的毫秒值}-${seed}`；若同毫秒同种子重复，追加 `-${counter}`，保证唯一。
- **时间语义（CR-002）**：排行榜「时间」= `achievedAt` 达成时间戳（ISO 8601），不是单局耗时秒数；不得新增 `elapsedSeconds` 字段。
- `levelId` 1..8；`score` 整数 ≥0；`stars` 1..3（仅胜利写入）；`movesUsed` 0..30；`achievedAt` ISO 8601；`seed` number。
- 读取时逐字段校验；损坏 → 备份 + 空榜（不影响存档）。

### 12.3 排序比较器

```ts
function compare(a: LeaderboardRecord, b: LeaderboardRecord): number {
  if (a.score !== b.score) return b.score - a.score;          // 分数降序
  if (a.movesUsed !== b.movesUsed) return a.movesUsed - b.movesUsed; // 步数升序
  const ta = Date.parse(a.achievedAt), tb = Date.parse(b.achievedAt);
  if (ta !== tb) return ta - tb;                              // 先达成优先
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;              // id 字典序
}
```

- 排序稳定：比较器完全相等时按 id 兜底，避免浏览器实现差异。
- `Date.parse` 对 ISO 8601 可靠；非法时间在读取校验阶段已拒绝。

### 12.4 容量与淘汰（REQ-037）

写入流程：

```text
records.push(newRecord)
sort(records, compare)
result = []
perLevel = Map<number, number>()
for r of records:
  if perLevel[r.levelId] >= 10: continue
  if result.length >= 20: break
  result.push(r); perLevel[r.levelId]++
save(result)
```

- 单关最多 10 条；全局最多 20 条；超出淘汰排序末位。
- 若新记录排序末位，会被立即淘汰；这是 REQ-037 的预期行为。
- 展示时按关卡筛选，取该关前 10 条；必须标注关卡名与达成时间（REQ-037）。
- 全局上限 20 意味着并非每关都能存满 10 条；以排序优先，UI 需显示「本机记录上限 20 条」提示。

### 12.5 写入时机与幂等（REQ-035）

- 仅在胜利结算写入 1 条；失败不写；中途退出不写；重开不写。
- `settlementId` 由 `${levelId}:${seed}:${achievedAt}:${score}` 生成；写入前检查 `records.some(r => r.id === settlementId 对应 id)`，重复则跳过。
- 同一局重复结算（快速连点/重复 commit）不得写入多条。
- 写入后立即重排并持久化；若存储不可用，走内存榜并显示临时提示。

### 12.6 清空（REQ-038）

- 设置页「清空本地排行榜」→ 二次确认（文案含「本地排行榜数据不可恢复」）→ 清空 → 提示 3 秒。
- 不影响关卡进度、最高分、星级、设置。
- 清空操作只删 `wmg.leaderboard.v1`，不触碰存档键。

---

## 13. 关卡数据格式

### 13.1 类型（单一来源）

```ts
export type LevelId = 1|2|3|4|5|6|7|8;

export interface CellCoord { row: 1|2|3|4|5|6|7|8; col: 1|2|3|4|5|6|7|8; }

export type Goal =
  | { id: string; type: 'score'; target: number }
  | { id: string; type: 'collect'; tile: TileKind; target: number }
  | { id: string; type: 'obstacle'; obstacle: 'ice' | 'stone'; target: number };

export interface LevelConfig {
  id: LevelId;
  name: string;
  tileKinds: readonly TileKind[];       // 6 或 5 种
  moves: number;
  goals: readonly Goal[];               // AND
  obstacles: readonly ObstacleSpec[];   // 冰块/石块/死格
  stars: { two: number; three: number };
  difficulty: number;                   // spec 第 6 章 D
}

export type ObstacleSpec =
  | { type: 'ice'; cells: readonly CellCoord[] }
  | { type: 'stone'; cells: readonly CellCoord[] }
  | { type: 'hole'; cells: readonly CellCoord[] };
```

- `src/core/types.ts` 是 `LevelConfig/Goal/ObstacleSpec/CellCoord/LevelId` 的唯一来源；`src/systems/level/types.ts` 只做类型重导出，不重复定义。
- 关卡数据是纯数据模块，不含函数/DOM/存储；`levels.ts` 只导出常量。
- `validate.ts` 在启动时运行（开发/测试强制；生产可只在测试构建运行），失败显示「关卡数据异常」并回选关（E-13）。
- 坐标 1 基，与 spec 第 6 章一致；棋盘渲染/索引换算在 core。

### 13.2 8 关数值（逐项来自 spec 第 6 章）

| 关卡 | 名称 | 元素 | 目标（AND） | 步数 | 障碍/布局 | 需求点 | D | 2★ | 3★ |
|---|---|---|---|---:|---|---:|---:|---:|---:|
| 1 | 起步 | 6 | 分数 ≥1500 | 20 | 无 | 15.0 | 0.750 | 2000 | 2600 |
| 2 | 初潮 | 6 | 收集水滴 18 | 22 | 无 | 18.0 | 0.818 | 1800 | 2400 |
| 3 | 薄冰 | 6 | 破除冰块 18 | 24 | 冰块 18 格（中心 6×3） | 21.6 | 0.900 | 2200 | 2900 |
| 4 | 连锁 | 6 | 分数 ≥2600 | 24 | 无 | 26.0 | 1.083 | 3200 | 4000 |
| 5 | 石障 | 5 | 破除石块 12 | 26 | 石块 12 格（4 行×3 列） | 30.0 | 1.154 | 3000 | 3900 |
| 6 | 双线 | 5 | 收集火 18 且 分数 ≥2000 | 26 | 冰块 10 格（非目标） | 38.0 | 1.462 | 3600 | 4600 |
| 7 | 暴风 | 5 | 破除冰块 24 且 破除石块 6 | 28 | 冰块 24 + 石块 6 | 43.8 | 1.564 | 3800 | 4900 |
| 8 | 终章 | 5 | 分数 ≥3000 且 破除石块 10 | 30 | 石块 10 + 死格 4 | 55.0 | 1.833 | 4400 | 5600 |

说明：

- 第 2 关 2★ 1800 低于第 1 关 2000，是 spec 明确给出的值；REQ-027 只约束 D 严格递增，**不得**为“看起来更顺”而改星级阈值。
- 第 5-8 关元素子集为星、水滴、叶、火、电；移除「晶」（紫）。
- 第 8 关死格坐标固定：行3列3、行3列6、行6列2、行6列7（1 基）。

### 13.3 障碍坐标落地建议（非需求变更）

spec 只给出数量与区域描述；以下为可实现的确定性布局建议，需在 G2 评审确认。若产品给出精确坐标，只改 `levels.ts` 数据，不动架构。

| 关卡 | 类型 | 建议坐标（1 基） | 数量 |
|---|---|---|---:|
| 3 | 冰块 | 行 4-6 × 列 2-7 | 18 |
| 5 | 石块 | 行 2,4,6,8 × 列 2,4,6 | 12 |
| 6 | 冰块 | 行 3-4 × 列 2-6 | 10 |
| 7 | 冰块 | 行 2-5 × 列 2-7 | 24 |
| 7 | 石块 | (7,2),(7,4),(7,6),(8,3),(8,5),(8,7) | 6 |
| 8 | 石块 | (2,3),(2,6),(4,3),(4,6),(5,1),(5,8),(6,3),(6,6),(8,3),(8,6) | 10 |
| 8 | 死格 | (3,3),(3,6),(6,2),(6,7) | 4 |

校验规则：

1. 坐标均在 1..8；同一格不得同时是 stone 与 hole；ice 不得与 stone/hole 重叠。
2. 第 8 关死格必须与 spec 完全一致。
3. 第 3 关冰块必须在中心 6×3 区域（行 4-6、列 2-7）。
4. 各类型数量与 spec 一致。
5. 关卡目标引用的元素必须在 `tileKinds` 中（第 6 关火）。
6. `difficulty` 重算与 spec 值误差 ≤0.01；D 严格递增；相邻增幅 ≤0.35。
7. 8 关 ID 连续 1..8；步数序列精确匹配 `[20,22,24,24,26,26,28,30]`。

### 13.4 难度计算

```text
demandPoints =
  scoreTarget / 100
  + collectTarget * 1
  + iceTarget * 1.2
  + stoneTarget * 2.5
D = round(demandPoints / moves, 3)
```

- 只对“目标”计数；非目标障碍（第 6 关冰块 10）不计入需求点。
- 第 7 关：24×1.2 + 6×2.5 = 28.8 + 15 = 43.8；43.8/28 = 1.564。
- 第 8 关：30 + 10×2.5 = 55；55/30 = 1.833。
- 测试用 `toBeCloseTo(D, 3)` 或 `Math.abs(diff) <= 0.01`。

---

## 14. 音频设计

### 14.1 引擎结构

```text
AudioEngine
  ├─ ctx: AudioContext | null
  ├─ masterGain
  ├─ bgmGain / sfxGain
  ├─ buffers: Map<name, AudioBuffer>
  ├─ bgmSource: AudioBufferSourceNode | null
  ├─ bgmOffset: number
  ├─ lastPlayedAt: Map<name, number>   // 100ms 节流
  └─ unavailable: boolean
```

- 首次用户手势（`pointerdown`/`click`）后创建/恢复 `AudioContext`，加载并播放 BGM。
- BGM 用 `AudioBufferSourceNode.loop = true`；暂停时记录 `ctx.currentTime - startedAt`，恢复时从 `offset % duration` 重新创建 source，保证循环接缝 ≤20ms。
- SFX 用 `AudioBufferSourceNode` + 每事件单独 gain；预加载小音效，BGM 延迟加载。
- 若 `AudioContext` 不可用或解码失败：`unavailable = true`，不播放、不弹窗；UI 显示「音频不可用」图标（REQ-048）。
- 音量：`gain = (volume/100)^1.5`，避免低音量突变；master 0.9 防削波；0..5 与 96..100 均保持可听/不失真。
- `visibilitychange`：hidden → `ctx.suspend()` + 暂停 BGM 计时；visible → `ctx.resume()` + 从 offset 恢复；不追帧。

### 14.2 事件映射（REQ-046）

| 事件 | 音效文件 | 时长 | 触发 |
|---|---|---:|---|
| swap | `sfx-swap` | 0.12s | 有效/无效交换均播放 |
| invalid | `sfx-invalid` | 0.15s | 仅相邻有效格交换后无匹配的 200ms 回弹（B 类，每次回弹 1 次）；A 类（矩形外 / 石块格 / 死格）与同格（取消选中）/ 非相邻（选中转移）均不触发 |
| match | `sfx-match` | 0.25s | 每轮消除开始 |
| cascade | `sfx-cascade` | 0.30s | 第 2 轮及以后每轮 |
| special-line | `sfx-special-line` | 0.40s | 横/竖特化触发 |
| special-rainbow | `sfx-special-rainbow` | 0.60s | 彩虹触发 |
| ice-break | `sfx-ice-break` | 0.30s | 冰层归零 |
| stone-break | `sfx-stone-break` | 0.35s | 石块归零 |
| shuffle | `sfx-shuffle` | 0.50s | 无可行步重排 |
| star | `sfx-star` | 0.50s | 结算逐星亮起 |
| win | `sfx-win` | 1.50s | 判定 won |
| lose | `sfx-lose` | 1.20s | 判定 lost |
| click | `sfx-click` | 0.08s | 所有 DOM 按钮 |

- 同一音效 100ms 内最多触发 1 次（`lastPlayedAt` 节流）。
- 第 2 轮起同时播放 `match` 与 `cascade`（spec 10.2 的触发定义）。
- B 类无效交换（相邻无匹配）同时播放 `swap` 与 `invalid`（spec 10.2：swap 有效/无效均播放；invalid 额外提示）；A 类静默忽略、同格取消选中、非相邻选中转移均不播放 `invalid`（CR-009 / CR-010）。
- BGM 默认 60；SFX 默认 80；开关/音量独立（REQ-047）。
- 星级出现：按 1→2→3 逐颗播放 `star`，间隔 150ms；减弱动效下间隔 50ms。

### 14.3 格式选择与降级

- 主格式 OGG Vorbis 96kbps 单声道；Safari 回退 MP3 128kbps。
- 能力检测：`new Audio().canPlayType('audio/ogg; codecs="vorbis"')`；空字符串 → MP3。
- 两套文件内容一致；asset-maker 在 manifest 记录时长/码率/校验和。
- 解码失败 → 静默降级 + 图标；不阻断游戏。

---

## 15. UI 与可访问性

### 15.1 视图结构

| 视图 | DOM 根 | 主要内容 |
|---|---|---|
| 选关 | `#screen-level-select` | 8 个关卡卡片、锁定态、星级、返回/设置/排行榜按钮 |
| 对局 | `#screen-game` | canvas、HUD、目标区、暂停/重开/返回按钮、aria-live |
| 结算 | `#panel-result` | 关卡名、结果、分数、最高分、星级、剩余步数、逐项目标、按钮 |
| 设置 | `#panel-settings` | BGM/SFX 开关与音量、减弱动效、色盲模式、重置进度、清空排行榜 |
| 排行榜 | `#panel-leaderboard` | 「本地排行榜」标题、按关卡筛选、前 10 条、空态、清空入口 |
| 暂停 | `#panel-pause` | 继续、重开、返回选关 |

- 所有面板 DOM 叠加在 canvas 上；背景遮罩 `rgba(0,0,0,.55)`。
- 面板显示时焦点移入第一个按钮；关闭后焦点回到触发按钮。
- 按钮最小 44×44 CSS px；图标按钮带 `aria-label`。
- 颜色对比：正文 ≥4.5:1；大号文本 ≥3:1；焦点轮廓 2px、≥3:1。

### 15.2 aria-live（REQ-050）

```html
<div id="game-live" aria-live="polite" aria-atomic="true" class="sr-only"></div>
```

- 文本格式严格为：`分数 {score}，剩余步数 {moves}，目标 {progress}`。
- `progress` 为目标逐项摘要，例如 `分数 1200/1500；水滴 4/18`。
- 变化时更新；同一秒内最多播报 1 次：用 `lastAnnounceAt` 节流，合并最后一帧状态。
- 结算/胜利/失败额外通过 `role="status"` 文本播报一次，不与分数播报叠加。
- `.sr-only` 视觉隐藏但可被读屏读取；不得 `display:none`。

### 15.3 减弱动效与色盲

- 减弱动效：系统 `prefers-reduced-motion: reduce` 或设置开关；所有动画 ≤100ms，无位移补间；BGM/音效不受影响。
- 色盲模式：设置开关；元素叠加 ★ ● ▲ ■ ◆ ✚ 符号；符号颜色白/黑双层描边；状态持久化到存档。
- 灰度可辨：正式贴图本身形状不同；人工评审 3 人在灰度截图下两两区分（REQ-039）。

### 15.4 错误与提示

| 场景 | UI |
|---|---|
| 存档损坏 | 顶部提示「存档已重置」5 秒 |
| 存储不可用 | 常驻提示条「当前为临时存档，刷新将丢失进度」 |
| 关卡初始化失败 | 对局面板「关卡初始化失败，请重试」+ 返回选关 |
| 图片缺失 | 无弹窗；console.warn 一次；占位渲染 |
| 音频不可用 | HUD 小图标「音频不可用」 |
| 关卡数据异常 | 返回选关 + 提示「关卡数据异常」 |
| Canvas 不支持 | 静态降级页，说明浏览器要求 |

---

## 16. 构建与静态托管

### 16.1 npm scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:all": "npm run typecheck && npm run test && npm run build && npm run test:e2e"
  }
}
```

- `dependencies` 为空对象；`devDependencies` 仅 `typescript`、`vite`、`vitest`、`@playwright/test`、`@types/node`（覆盖率工具见 SC-05/CR-003）。
- `package-lock.json` 提交；CI 用 `npm ci`。
- Playwright 浏览器二进制通过 `npx playwright install` 安装，不计入 npm 依赖。

### 16.2 Vite 配置要点

`index.html` 的入口脚本为 `<script type="module" src="/src/systems/main.ts"></script>`，由 Vite 处理为打包入口。

```ts
export default defineConfig(({ mode }) => ({
  base: './',                    // 可部署到任意子路径
  publicDir: false,              // 资源走 import.meta.glob，不复制 public
  build: {
    target: 'es2020',
    sourcemap: false,            // 控制体积；如需排障可临时开启
    assetsInlineLimit: 4096,     // 小 SVG 内联
    cssCodeSplit: true
  },
  define: {
    __TEST__: JSON.stringify(mode === 'test')
  }
}));
```

- `base: './'` 保证 `dist/` 放在任意静态目录子路径可运行。
- 资源通过 `import.meta.glob` 由 Vite 处理哈希与 URL，不依赖 `public/`。
- 生产构建移除 `console.debug`：源码不使用 `console.debug`；测试钩子由 `__TEST__` 编译期常量包裹，生产为 `false` 时 tree-shake。
- 不注入任何环境变量到运行时；无服务端配置。

### 16.3 部署

1. `npm ci && npm run build` 生成 `dist/`。
2. 将 `dist/` 上传到任意静态文件服务器（Nginx、OSS、GitHub Pages、Netlify 等）。
3. 服务器只需正确 MIME：`.js` → `text/javascript`、`.webp` → `image/webp`、`.ogg` → `audio/ogg`、`.mp3` → `audio/mpeg`。
4. 可选缓存：带 hash 的 JS/CSS/图片设长缓存；`index.html` 设 `no-cache`。
5. 无 SPA 路由回退需求（单页单入口）；若使用 History 路由（本方案不使用），才需要 `try_files`。
6. 验收：`npx serve dist` 下打开；断网后（资源已加载）可继续玩；Network 面板第三方域名请求数 = 0。

### 16.4 体积控制

| 项 | 上限 | 手段 |
|---|---:|---|
| 首屏 gzip 总传输 | 3.0MB | 背景/音频延迟；JS 压缩；图片 WebP |
| 初始 JS gzip | 200KB | 无框架；按需加载设置/排行榜面板（可选动态 import） |
| 图片合计 | 1.6MB | WebP（透明素材带 alpha）与 SVG 图标；背景 ≤400KB |
| 首屏图片 | 1.2MB | BGM 不计入；大图延迟 |
| 音频合计 | 2.0MB | OGG 96kbps 单声道（Safari 回退 MP3）；BGM 首次手势后加载 |

> 若首屏 JS 因逻辑模块超出 200KB，优先拆分设置/排行榜/结算面板为动态 `import()`；core 与首关渲染保持同步加载，确保首关 60 秒内可玩。
---

## 17. 测试策略

### 17.1 分层测试

| 层 | 工具 | 环境 | 覆盖重点 |
|---|---|---|---|
| core 单测 | Vitest | Node，无 DOM | 生成、匹配、交换、特化、计分、重力、连锁、状态机、目标/星级、重排 |
| render 单测 | Vitest | Node + 轻量 canvas 2D stub | 坐标变换、DPR、动画时长、布局常量；不做像素级渲染 |
| systems 单测 | Vitest | Node + `StorageLike` 内存实现 | 存档 schema、损坏恢复、配额降级、排行榜排序/容量/去重、关卡校验 |
| ui view-model | Vitest | Node | HUD 文本、aria-live 节流、按钮启用条件；不挂真实 DOM |
| E2E | Playwright | Chromium/Firefox/WebKit | 完整链路、鼠标/触摸、刷新持久化、Network、热区、DPR |
| 手工 | 浏览器 | 真机/桌面 | 灰度可辨、音频接缝、Safari、性能、8 关可通 |

**不引入 jsdom/happy-dom**：devDependencies 白名单不含 DOM 模拟库。UI 的纯逻辑抽成 view-model 在 Node 测试；真实 DOM 行为用 Playwright。这是宪法 2.2 下的必要设计。

### 17.2 必测用例（按 REQ 编号命名）

```text
REQ-001 初始棋盘 64 格且无三连
REQ-002 相同种子与操作序列结果一致
REQ-003 拖拽相邻交换与两段点击等价
REQ-004 命中失败分两类均不扣步（A 类静默忽略 / 仅相邻无匹配播 invalid；同格取消选中、非相邻选中转移不播 invalid）
REQ-005 交换后存在匹配则保留
REQ-006 无效交换回弹后状态不变
REQ-007 L 形按并集只消除一次
REQ-008 石块阻挡列下落
REQ-009 连锁倍率 1.0..4.0
REQ-010 4 连生成直线特化
REQ-011 5 连生成彩虹
REQ-012 直线特化清除整行
REQ-013 彩虹+彩虹清 64 格得 3840
REQ-014 3 连 180 / 4 连 c=2 得 435
REQ-015 仅有效交换扣 1 步
REQ-016 无可行步重排不扣步
REQ-017 settling 输入被忽略
REQ-018 目标达成与步数归零同时发生判胜
REQ-019 重开使用新种子且分数归零
REQ-020 中途退出不写排行榜
REQ-021 8 关线性解锁
REQ-022 三类目标 AND
REQ-023 冰块覆盖元素可匹配
REQ-024 石块两层破坏与阻挡
REQ-025 第 8 关死格坐标
REQ-026 星级阈值边界
REQ-027 8 关 D 值
REQ-028 结算面板字段与 300ms 锁
REQ-029 存档字段完整
REQ-030 四处写入时机与中断标记取值
REQ-031 六类损坏存档恢复
REQ-032 配额超限降级
REQ-033 重置进度
REQ-034 本地排行榜文案与零网络请求
REQ-035 胜利写 1 条、失败不写
REQ-036 同分排序
REQ-037 10/20 条淘汰
REQ-038 清空排行榜
REQ-039 灰度形状两两可辨（人工）
REQ-040 棋盘对齐 ≤1px
REQ-041 DPR 变化 200ms 内重绘
REQ-042 图片 404 走占位
REQ-043 色盲符号持久化
REQ-044 动画时长与减弱动效
REQ-045 首次手势后 BGM 与隐藏暂停
REQ-046 13 事件音效映射
REQ-047 音量边界与持久化
REQ-048 音频解码失败降级
REQ-049 最近邻吸附、0.5 格手势与 600px 分级热区
REQ-050 aria-live 文本与 1 秒节流
REQ-051 p95 帧间隔与静态托管
```

### 17.3 E2E 场景

| 场景 | 步骤 | 断言 |
|---|---|---|
| 首关完整链路 | 打开 → 开始第 1 关 → 完成一次有效交换 → 结算 → 重开 | 分数/步数变化；重开后归零；无 console error |
| 刷新持久化 | 通关第 1 关 → 刷新；再开局后中途刷新 | 第 2 关解锁；最高分/星级保留；无进行中对局；中途刷新后进入主菜单提示「上一局已中断」一次，第二次刷新不再提示（REQ-030） |
| 存档损坏 | 预置非法 JSON → 刷新 | 提示 5 秒；备份键存在；可进第 1 关 |
| 存储不可用 | 注入抛异常的 localStorage → 刷新 | 常驻提示条；可玩；刷新后丢失 |
| 排行榜 | 胜利 3 次 → 打开本地排行榜 | 「本地排行榜」文案；排序正确；无第三方请求 |
| 输入 | 鼠标拖拽/两段点击；触摸滑动/点击 | 两者等价；settling 输入忽略 |
| 可访问性 | 开启色盲/减弱动效 → 刷新 | 符号叠加；动画 ≤100ms；状态保留 |
| 音频 | 首次手势 → 切后台 → 回前台 | BGM 播放/暂停/续播；音量持久化 |
| 缩放/DPR | 改 viewport/DPR → 等待 200ms | 重绘；状态不重置；对齐 ≤1px |
| 热区/吸附 | 1280×800、600×800、360×640、320×568 四视口：格内任意点、中垂线等距点、投影矩形外点 | 吸附到最近格；等距按「列小者优先→行小者优先」；矩形外返回 `null`；≥600 px 单格 ≥40×40；<600 px 单格 = 64×视口宽÷960（24 / ≈21.33） |

E2E 需要固定棋盘时，使用**测试构建**注入种子（`__TEST__` 为 true 时读取 `?seed=`）；生产构建不包含该分支。测试构建命令由 impl-systems 在 TASK-001 提供，例如 `vite build --mode test`。

### 17.4 浏览器手工验收清单

> 每项记录浏览器/版本/设备/结果；DoD 要求至少 Chrome + Safari + 一台 iOS/Android 真机。

1. Chrome/Edge/Firefox/Safari 最近 2 个大版本可打开，无白屏。
2. iOS Safari 16+、Android Chrome 108+ 可玩。
3. 鼠标拖拽、鼠标两段点击、触摸滑动、触摸点击四种方式均可交换。
4. 8 关全部可通关；每关 1★ 在 30 步内可达；2★/3★ 阈值可复现。
5. 刷新/关闭中途对局 → 回到该关开始态；进度/最高分/星级/设置/排行榜保留。
6. 存档损坏 → 备份 + 重置提示 5 秒 + 可进第 1 关。
7. localStorage 不可用/配额超限 → 常驻提示 + 游戏可玩。
8. 本地排行榜文案正确；断网后无请求；清除站点数据后记录丢失提示可见。
9. 音频：首次手势后 BGM 起播；切后台暂停、回前台续播；音量 0/5/96/100 无异常；音频失败显示图标。
10. 减弱动效：系统设置与手动开关均生效，动画 ≤100ms。
11. 色盲模式：6 种符号可辨；刷新后保持。
12. 320/360/768/1440/2560 宽度、横竖屏切换：等比缩放、不拉伸、状态不重置（热区按 SC-01 裁决验收）。
13. 灰度截图：6 种元素两两可辨（3 人评审一致）。
14. 性能：10 秒对局 p95 帧间隔 ≤20ms、≥50fps 占比 ≥95%、单帧绘制 ≤8ms。
15. Lighthouse 生产构建：Performance ≥80、Accessibility ≥90、Best Practices ≥90；首屏 gzip ≤3.0MB；第三方请求 0。
16. 分数 >999999 显示实际数值，不截断；结算面板不溢出。
17. 快速连点结算面板 300ms 内无重复提交；排行榜不重复写入。
18. `dist/` 在 `npx serve dist` 下可运行；无 console error/warn（图片/音频降级 warn 除外）。

### 17.5 覆盖率与用例规范

- `core/` 行覆盖率 ≥80%，分支覆盖率 ≥70%（宪法 6.5；宪法 v1.1.1 未改动该门槛）。
- 覆盖率工具：`@vitest/coverage-v8`。CR-005 已把它加入宪法 2.2 的 devDependencies 白名单（**仅测试期**，不进入运行时产物），运行时依赖仍为 0。门禁不再标记 blocked。
- 覆盖率命令：`npm run test:coverage` → `vitest run --coverage --coverage.provider=v8`；CI 断言行 ≥80%、分支 ≥70%，低于阈值即失败，不得伪造数据。
- 覆盖率统计范围：`coverage.include = ['src/core/**']`（宪法 6.5 口径）；`render/systems/ui` 不计入门槛，但仍须按 REQ 用例覆盖。
- 用例名必须包含 REQ 编号；一个 REQ 至少 1 个用例；边界值（阈值-1/阈值/阈值+1）单独用例。
- 测试期望值来自 spec 数值表，不得复制一份实现作为“期望”。
- REQ-049 的断言方式：`tests/render/layout.spec.ts` 对 `pickNearestCell` 做逐点单测（格内点、中垂线等距点、矩形外点）；`tests/e2e/input-a11y.spec.ts` 在四个固定视口实测单格 CSS 尺寸与吸附结果。
- REQ-030 的断言方式：`tests/systems/save-service.spec.ts` 用 spy 断言四个写入入口各 1 次、结算路径只触发 1 次 `setItem`；`tests/e2e/core-flow.spec.ts` 断言「中途刷新 → 提示一次 → 二次刷新不再提示」。

---

## 18. 规格冲突、缺口与裁决记录

> 本章是 G2 评审的强制阅读项。**SC-01 / SC-02 / SC-05 已由 Manager 裁决并登记 CR-003 / CR-004 / CR-005，spec 与宪法均升至 v1.1.0，相关任务 DoD 已全部解除挂起**（见各小节「最终执行口径」）。SC-03 / SC-04 / SC-07 为架构口径（不改 REQ，不阻塞验收）；SC-06 已关闭。**CR-008 / CR-009 已在 spec v1.1.3 统一命中失败口径（A 类静默忽略 / B 类无效交换），CR-010 在 spec v1.1.4 将 B 类收窄为「相邻有效格交换后无匹配」；本文 v1.1.3 已按该口径对齐第 5.2 / 5.4 / 8.4 / 10.2 / 14.2 / 17.2 / 19 章，REQ 编号与 TASK 映射零改动。**

### SC-01（已裁决，CR-003 选项 A）REQ-049 移动端热区与 960×720 布局几何冲突

**事实（裁决前状态，对应 spec v1.0.1 的原 REQ-049；v1.1.0 已重写该 REQ）：**

- 画布逻辑 960×720，棋盘 512×512（8×64），左右各 224、上下 96/112。
- 视口 320px 时，若画布按容器等比缩放并完整显示：缩放系数 `320/960 = 1/3`，单格 CSS 尺寸 `64/3 = 21.33px`，小于 REQ-049 要求的 30px。
- 视口 360px 时：系数 0.375，单格 24px，小于要求的 40px。
- 要让 320px 下单格达到 30px，棋盘 CSS 宽需 240px，画布 CSS 宽需 `240 × 960/512 = 450px`，超出 320px 视口；360px 下要 40px 单格，画布需 600px，超出 360px。
- 相邻格热区不得重叠（REQ-049），因此不能靠透明外扩补齐；宪法 5.3 又要求等比缩放、4:3、留边、不拉伸。

**结论：** 在「完整显示 960×720」与「320px 下单格 ≥30px / 360px 下 ≥40px」之间，几何上不可同时满足。

**影响任务：** TASK-018（布局/坐标）、TASK-027（命中/热区）、TASK-036（E2E 热区断言）。

**可选裁决（历史留痕；Manager 已于 2026-11-10 选择 A）：**

| 选项 | 内容 | 代价 |
|---|---|---|
| A | 修订 REQ-049 为几何可达值（320px→21px，360px→24px），保留 960×720 完整布局 | 放宽可访问性目标 |
| B | 移动端改为「棋盘占满宽度」的自适应逻辑布局（单格 30/40px），画布逻辑尺寸/比例随断点变化 | 修改 REQ-040/041 与宪法 5.3 的固定 960×720 |
| C | 小屏允许画布横向平移/缩放（不完整显示） | 修改宪法 5.3 的留边/完整显示要求，交互复杂度上升 |

**裁决结果：** 2026-11-10 Manager 采**选项 A**，登记 **CR-003**；spec v1.1.0 已重写 REQ-049 并同步修订 REQ-003（同一手势只保留一套阈值）。上表选项 A/B/C 仅作决策留痕，不再可选。

**最终执行口径（SC-01 关闭）：**

1. 布局不变：逻辑画布 960×720 等比缩放、4:3、留边、不拉伸（宪法 5.3）。
2. 命中改为**最近邻格吸附**：投影矩形内按格中心欧氏距离吸附；相邻热区以两格中心连线的几何中垂线划分，互不重叠且并集恰好覆盖投影矩形；等距按「列小者优先，列相同则行小者优先」。
3. 交换手势：主轴位移 ≥ 0.5 格宽/高判交换，< 0.5 格判点击。**固定 16 CSS px 阈值废止**。
4. 分级像素：视口 ≥600 CSS px → 单格热区 ≥40×40 CSS px；<600 px → 不设下限，按实际值（320 px ≈21.33、360 px = 24）。
5. 验收视口固定四个：1280×800、600×800、360×640、320×568，由 TASK-036 逐一测量。
6. 实现落点**不变、仍在原所有权内**：`src/render/layout.ts`（`pickNearestCell` + `cellCssSize`，impl-core）与 `src/ui/input/board-input.ts`（吸附调用 + 主轴手势判定，impl-systems），两者以纯函数契约对接。

### SC-02（已裁决，CR-004 选项 A）E-04「上一局已中断」提示与 REQ-030 写入时机冲突

**事实（裁决前状态，对应 spec v1.0.1 的三处写入时机）：**

- E-04 要求刷新/关闭后「下次进入时提示『上一局已中断』一次」。
- 要在刷新/关闭后知道“上一局存在”，必须在开局/中断时持久化一个标记；但 REQ-030 把写入时机固定为「结算完成、设置变更、通关解锁」三处，且明确不保存进行中对局。
- 宪法 2.3 禁止 `localStorage` 之外的持久化手段；`sessionStorage` 也不是白名单方案。
- 若用 `beforeunload` 写标记，仍是第 4 类写入，违反 REQ-030 的字面约束。

**影响任务：** TASK-034（装配/中断流程）、TASK-035（E2E 刷新场景）。

**可选裁决（历史留痕；Manager 已于 2026-11-10 选择 A）：**

| 选项 | 内容 | 代价 |
|---|---|---|
| A | 新增一个布尔标记 `lastSessionInterrupted`（不含对局快照），在开局写 true、结算/退出写 false，并登记 CR 修改 REQ-030 | 增加一次轻量写入；仍不恢复对局 |
| B | 删除 E-04 的提示，只保留“回到关卡开始态” | 修改 spec 异常表 |
| C | 提示仅限 SPA 内部导航（不跨刷新） | 不满足 E-04 的刷新/关闭语义 |

**裁决结果：** 2026-11-10 Manager 采**选项 A**，登记 **CR-004**；spec v1.1.0 已在 8.1 新增字段、把 REQ-030 写入时机扩为四处、在 8.2 增补缺失按 `false` 的向后兼容规则。

**最终执行口径（SC-02 关闭）：**

1. 字段：`SaveDataV1.lastSessionInterrupted: boolean`，默认 `false`；语义「上次会话存在未结算对局」，**不含任何棋盘/对局快照**。
2. 四处写入：① 结算完成（胜/负，同时置 `false`）② 设置变更 ③ 通关解锁 ④ 标记写入（开局 `true` / 结算或返回关卡选择 `false`）。结算与标记合并为一次 `setItem`。
3. E-04：进入主菜单若为 `true` → 显示一次「上一局已中断」→ 立即写 `false`；同一会话不重复提示；**不恢复任何进行中对局**。
4. 兼容：字段缺失按 `false`，不提升 `saveVersion`（仍为 1），不触发 REQ-031 重置。
5. 仍禁用 `sessionStorage` / `IndexedDB` / `beforeunload` 写存储（宪法 2.3），不新增独立 localStorage 键。

### SC-03（低，语义澄清）REQ-001「每格恰好 1 个元素或 1 个障碍」与 REQ-023 冰块覆盖元素

**事实：** 冰块格既有元素又有冰层；按字面“元素或障碍”二选一会与 REQ-023「冰块覆盖格元素可正常参与匹配」矛盾。

**架构口径：** `Cell = { tile, obstacle }`；冰是覆盖层，元素与冰共存；石块/死格是阻挡型障碍，`tile = null`。该模型同时满足 REQ-001（每格一个内容主体）与 REQ-023/024/025。无需改 REQ；在 TASK-002/006 的类型与测试中固化。

### SC-04（低，内容缺口）障碍精确坐标未全部给出

**事实：** spec 第 6 章给出数量与区域（如“中心 6×3”“4 行×3 列交叉”“冰块 24 + 石块 6”），但未给出除第 8 关死格外的逐格坐标。

**架构口径：** 第 13.3 节给出可实现的确定性布局建议；`levels.ts` 数据化，`validate.ts` 校验数量/区域/第 8 关死格。产品可在 G2 评审直接调整坐标，不影响架构与任务边界；无需改 REQ。

### SC-05（已裁决，CR-005 选项 A）覆盖率门槛与 devDependencies 白名单冲突

**事实（裁决前状态，对应宪法 v1.0.0 的五项白名单）：**

- 宪法 6.5 要求 `core/` 行覆盖率 ≥80%、分支 ≥70%。
- 宪法 2.2 的 devDependencies 白名单只有 `typescript`、`vite`、`vitest`、`@playwright/test`、`@types/node`。
- Vitest 的覆盖率需要 `@vitest/coverage-v8`（或 istanbul provider），不在白名单；不加则无法执行覆盖率门禁。

**影响任务：** TASK-001（依赖清单）、TASK-037（发布验收）。

**可选裁决（历史留痕；Manager 已于 2026-11-10 选择 A）：**

| 选项 | 内容 |
|---|---|
| A | 登记 CR-003，允许 `@vitest/coverage-v8` 作为**仅测试期** devDependency（不进入运行时产物） |
| B | 豁免覆盖率门禁，改为人工测试用例清单核对（不推荐，违背宪法 6.5） |

**裁决结果：** 2026-11-10 Manager 采**选项 A**，登记 **CR-005**；宪法 v1.1.0 的 2.2 devDependencies 白名单已加入 `@vitest/coverage-v8`（仅测试期，不进入运行时产物），运行时依赖仍为 0，6.5 覆盖率门槛不变。

**最终执行口径（SC-05 关闭）：** TASK-001 直接安装该依赖并新增 `test:coverage` script（`coverage.provider = 'v8'`、`include = ['src/core/**']`）；TASK-037 按 `vitest run --coverage --coverage.provider=v8` 断言 `core/` 行 ≥80%、分支 ≥70%，不再标记 blocked。

### SC-06（已关闭）spec.md 版本发布

**状态：** 2026-11-10 已由 spec-lead 完成并再次升版。`spec.md` 当前为 **v1.1.1 已发布**，CR-001（G1 定版）、CR-002（排行榜「时间」= `achievedAt` 达成时间戳，非耗时秒数）、CR-003/CR-004/CR-005（SC-01/SC-02/SC-05）、CR-006（宪法 5.2 / 5.3 可访问性措辞对齐）、CR-007（第 10.1 章图片格式统一为 WebP）均已登记；REQ 数量仍为 51（编号与总数不变），数值表/关卡/资源清单无变更。

**对本方案的影响：** 本方案按 v1.1.1 执行；第 12 章排行榜记录使用 `achievedAt` ISO 8601 达成时间戳，不新增 `elapsedSeconds` 字段；第 10/11 章按 CR-003/CR-004 更新，第 17 章按 CR-005 更新；第 4.3 / 9.3 / 16.4 章的图片与音频格式口径按 CR-007 统一为 WebP（带 alpha）/ SVG 与 OGG / MP3。

### SC-07（低，实现约定）特化组合与同轮多点生成的未定义分支

**事实：**

- spec 定义了「彩虹+普通」「彩虹+彩虹」「彩虹被其他特化波及」，未定义「直线+彩虹」「直线+直线」的组合技。
- 4 连位置规则写“玩家交换所涉及的格子”，当交换的两格都在 run 中时未给出唯一裁决。

**架构口径（不新增需求）：**

1. 未定义的组合不产生额外组合技；交换有效性仍按 REQ-005 判定。若交换涉及彩虹与普通/彩虹，按已定义规则生效；彩虹与直线特化交换按普通交换判定，只有形成匹配才有效，之后各自按“被消除/被波及”规则触发。
2. 4 连位置裁决顺序：被拖动元素的目标格 → 源格 → run 最左/最上格。该顺序写入 TASK-010 测试，保证 REQ-002 确定性。
3. 若产品需要组合技（如直线+彩虹清全屏），必须新登记 CR-004 扩展 REQ-012/013，并补测试；本方案不自行实现。

### 18.1 风险登记

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 移动端热区无法达标（SC-01） | 已关闭 | 中 | CR-003：最近邻吸附 + 600 px 分级（≥40px；<600px 按实际值），四视口验收 |
| 中断提示无法实现（SC-02） | 已关闭 | 低 | CR-004：`lastSessionInterrupted` 轻量标记，四处写入、无对局快照 |
| 覆盖率工具缺失（SC-05） | 已关闭 | 低 | CR-005：放行 `@vitest/coverage-v8`（仅测试期），门禁可执行 |
| Safari 音频/自动播放限制 | 中 | 中 | 首次手势解锁；MP3 回退；失败图标 |
| 低端机 60fps 不达标 | 中 | 中 | DPR≤2、背景预渲染、粒子池、单 canvas |
| 8 关数值平衡仅纸面验证 | 中 | 中 | 手工全通；记录每关步数/分数；必要时走 CR 调数值 |
| 背景 16:9 与画布 4:3 裁切 | 低 | 低 | cover + 中心锚点；棋盘区独立 |
| localStorage 配额/隐私模式 | 低 | 中 | 内存降级 + 常驻提示 |
| 特殊组合歧义 | 低 | 低 | SC-07 默认口径 + CR 扩展 |
| 规格后续变更未登记 CR | 低 | 中 | 变更控制流程；REQ 编号不复用；G4 前复核 v1.1.4 |

---

## 19. 架构验收清单（G2 DoD）

- [ ] `plan.md` 覆盖任务要求的全部主题：目录、主循环/状态机、数据结构、消除算法、种子、渲染分层、输入、存档 schema、本地榜、构建、测试。
- [ ] 8 关数值、步数、星级、D 与 spec 第 6 章逐项一致；第 2 关 2★ 1800 未被“修正”。
- [ ] 存档 schema 含 `saveVersion=1`、`lastSessionInterrupted`（缺失按 `false`、非布尔判损坏）、字段类型/范围、损坏备份、版本不匹配重置、内存降级。
- [ ] 排行榜明确标注「本地排行榜」，排序/容量/写入时机/清空与 REQ-034~038 一致。
- [ ] 三角色写入边界无重叠（第 4.2 节）。
- [ ] core 无 DOM/存储/时间/全局随机；种子可复现；状态可 JSON 往返。
- [ ] 动画时长与减弱动效符合 REQ-044；结算 300ms 输入锁有落点。
- [ ] 图片/音频/Canvas/存储失败均有降级路径。
- [ ] 测试策略含 Vitest 单测、Playwright E2E、手工浏览器清单；用例名含 REQ 编号。
- [ ] REQ-049：`layout.ts` 提供 `pickNearestCell`（中垂线划分、等距列优先再行优先）与 `cellCssSize`（600 px 断点）；`board-input.ts` 主轴阈值取 0.5 格；四视口（1280×800 / 600×800 / 360×640 / 320×568）断言可复现，无挂起项。
- [ ] REQ-030：`SaveDataV1` 含 `lastSessionInterrupted`（默认 false）；四处写入与 `SaveService` 四个方法一一对应；结算路径合并为一次 `setItem`；主菜单消费后立即置 false 且不恢复对局；`beforeunload` 不写存储。
- [ ] 覆盖率门禁可执行：`@vitest/coverage-v8` 在 devDependencies、`npm run test:coverage` 可运行并断言 core 行 ≥80% / 分支 ≥70%。
- [x] SC-01/SC-02/SC-05 已按 CR-003/CR-004/CR-005 裁决口径落地到第 10/11/17 章与 tasks.md；未自行改 REQ、未改三角色文件边界。
- [x] 命中失败口径与 spec v1.1.4（CR-008 / CR-009 / CR-010）一致：A 类（矩形外 / 石块格 / 死格）静默忽略——不播 invalid、无 aria 播报、选中态不变；同格点击＝取消选中、非相邻点击＝选中转移——均不交换、不扣步、分数不变、不播 invalid；仅 B 类（相邻有效格交换后无匹配）200ms 回弹 + 1 次 invalid 且不扣步；第 5.2 / 5.4 / 8.4 / 10.2 / 14.2 / 17.2 章表述一致。

---

## 附录 A：关键常量索引（代码常量必须逐项一致）

| 常量 | 值 | 来源 |
|---|---|---|
| `BOARD_COLS` / `BOARD_ROWS` | 8 / 8 | spec 5.1 |
| `CELL_SIZE` | 64 | spec 5.1 |
| `BOARD_SIZE` | 512 | spec 5.1 |
| `CANVAS_W` / `CANVAS_H` | 960 / 720 | spec 5.1 |
| `BOARD_X` / `BOARD_Y` | 224 / 96 | spec 5.1 |
| `TILE_KINDS` | star, water, leaf, flame, crystal, bolt | spec 5.1 |
| `TILE_KINDS_L5` | star, water, leaf, flame, bolt | spec 5.1 |
| `INITIAL_RETRY_LIMIT` | 1000 | REQ-001 |
| `SHUFFLE_RETRY_LIMIT` | 100 | REQ-016 |
| `BASE_SCORE` | 60 | spec 5.3 |
| `BONUS_4` | 50 | spec 5.3 |
| `BONUS_5` | 120 | spec 5.3 |
| `SPECIAL_EXTRA` | 30 | spec 5.3 |
| `MULTIPLIER_MAX` | 4.0 | spec 5.3 |
| `SWAP_MS` | 150 | spec 5.2 |
| `REVERT_MS` | 200 | spec 5.2 |
| `CLEAR_MS` | 180 | spec 5.2 |
| `FALL_MS` | 160 | spec 5.2 |
| `SPECIAL_MS` | 300 | spec 5.2 |
| `PANEL_FADE_MS` | 200 | spec 5.2 |
| `REDUCED_MOTION_MAX_MS` | 100 | REQ-044 |
| `PANEL_INPUT_LOCK_MS` | 300 | REQ-028 |
| `DRAG_THRESHOLD_CELL_RATIO` | 0.5 | REQ-003/049（CR-003；替代原 16 CSS px） |
| `HOTZONE_BREAKPOINT_CSS_PX` | 600 | REQ-049（CR-003；600 ÷ 960 × 64 = 40） |
| `HOTZONE_MIN_CELL_CSS_PX` | 40 | REQ-049（CR-003；仅视口 ≥600 px 时适用） |
| `HIT_SNAP_RULE` | 最近格吸附（格中心欧氏距离 + 中垂线 Voronoi；等距列优先再行优先） | REQ-049（CR-003） |
| `SAVE_WRITE_POINTS` | 4（结算 / 设置 / 解锁 / 中断标记） | REQ-030（CR-004） |
| `LAST_SESSION_INTERRUPTED_DEFAULT` | false | REQ-030（CR-004；缺失按 false，不提升 saveVersion） |
| `SAVE_VERSION` | 1 | REQ-029 |
| `LEADERBOARD_PER_LEVEL` | 10 | REQ-037 |
| `LEADERBOARD_TOTAL` | 20 | REQ-037 |
| `BGM_DEFAULT_VOLUME` | 60 | REQ-047 |
| `SFX_DEFAULT_VOLUME` | 80 | REQ-047 |
| `SFX_THROTTLE_MS` | 100 | REQ-046 |
| `DPR_MAX` | 2 | REQ-041 |
| `LOW_MOVES_THRESHOLD` | 3 | spec 5.6 |
| `SHUFFLE_TOAST_MS` | 2000 | REQ-016 |
| `CORRUPT_TOAST_MS` | 5000 | REQ-031 |
| `RESET_TOAST_MS` | 3000 | REQ-033/038 |

## 附录 B：任务依赖图（关键路径）

```text
TASK-001 ─► TASK-002 ─► TASK-005 ─► TASK-006 ─► TASK-007 ─► TASK-008 ─┐
                │                                                     ├─► TASK-013 ─► TASK-023 ─► TASK-034 ─► TASK-035 ─► TASK-037
                ├─► TASK-009 ─► TASK-010 ─► TASK-011 ─────────────────┤
                ├─► TASK-014 ─► TASK-017                              │
                └─► TASK-018 ─► TASK-019 ─► TASK-020 ─► TASK-021 ─► TASK-022 ┘

TASK-001 ─► TASK-003 ─► TASK-024 ─► TASK-025 ─► TASK-030 ─┐
TASK-001 ─► TASK-026 ─► TASK-031/TASK-032 ────────────────┤
TASK-001 ─► TASK-027 ─► TASK-028 ─────────────────────────┴─► TASK-034

TASK-004 ─► TASK-038/039/040 ─► TASK-041
```

关键路径约 11 个 0.5 天任务 ≈ 5.5 个工作日；三条角色并行后总工期约 8-10 个工作日（含评审/手工验收）。

## 附录 C：规格引用索引

| 主题 | spec 位置 |
|---|---|
| 核心机制/操作 | 第 3 章 |
| 状态机 | 第 4 章 |
| 数值表 | 第 5 章 |
| 8 关目标/D | 第 6 章 |
| 51 条 REQ | 第 7 章 |
| 存档字段 | 第 8 章 |
| 本地排行榜 | 第 9 章 |
| 美术/音效清单 | 第 10 章 |
| Out of Scope | 第 11 章 |
| 异常与边界 | 第 13 章 |
| 可测性矩阵 | 第 14 章 |

---

> 本文与 `tasks.md` 配套使用。任何 REQ/数值变更必须先走 CR；本文不替代 spec，也不构成对 spec 的修改。