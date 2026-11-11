# task-36 报告：tasks.md 上游行修订（plan v1.1.3）

- 任务：`task-36` / attempt 1（room-1794319989719887800，执行者 pt-architect）
- 交付文件：`specs/001-core-game/tasks.md`
- 改动范围：仅文首 L5「上游」一处版本指向（纯元数据，1 行）
- 文档版本：保持 `v1.1.3` 不变（仅上游指向变化，不升版）
- 未改动：任何 TASK 卡、REQ 映射、依赖、文件边界、`spec.md`、`plan.md`、`constitution.md`、代码、测试、资源

## 1. 一行说明

tasks.md L5「上游」中的 plan 版本由 `v1.1.2` 修正为 `v1.1.3`，与 plan.md 现行 v1.1.3 对齐；spec v1.1.4、constitution v1.1.1 原本即正确，未动。

## 2. 改前 / 改后原文对照（L5）

改前：

> - 上游：`/specs/001-core-game/spec.md` v1.1.4（51 条 REQ，CR-008 / CR-009 / CR-010 已统一命中失败口径：仅相邻无匹配播 invalid，同格 / 非相邻不播）、`/specs/001-core-game/plan.md` **v1.1.2**（G2 技术方案）、`/specs/constitution.md` v1.1.1

改后：

> - 上游：`/specs/001-core-game/spec.md` v1.1.4（51 条 REQ，CR-008 / CR-009 / CR-010 已统一命中失败口径：仅相邻无匹配播 invalid，同格 / 非相邻不播）、`/specs/001-core-game/plan.md` **v1.1.3**（G2 技术方案）、`/specs/constitution.md` v1.1.1

差异仅为 `plan.md` 后的 `v1.1.2` → `v1.1.3`；该子串全文唯一（替换前计数 1），等长替换，文件体量不变。

## 3. 哈希与体量

| 文件 | 改前 | 改后 |
|---|---|---|
| `specs/001-core-game/tasks.md` | 61182 B / `9E18B5645F986BCDA3999A12675F77A856F7AA847B42E8D0C2800EA2239C1CD2` | 61182 B / `1567119185ECDB7DB54E0EBCBF29BFD94EE7F5CD7E1ABFF024A5B3E742F91C53` |
| `specs/001-core-game/spec.md`（未改） | 67033 B | 67033 B / `F4E7756F6004E497632E72190C32BB764B8316D7BD157EC466FECCBFB82D735B` |
| `specs/001-core-game/plan.md`（未改） | 107101 B | 107101 B / `B7D5F3F6BCBE5F4ECF8198F6CA1DF7FC2C14220780C9E7BCD827E4A067574360` |
| `specs/constitution.md`（未改） | 13476 B | 13476 B / `4F3E86249C77E71B71989BCE0D487A666FCECECAB980D8B60442E9CEFB3B38F5` |

行数：992 行（含末尾空行），改前改后一致；编码 UTF-8 无 BOM，行尾 LF，均保持不变。

## 4. 版本链路校验

| 文档 | 现行版本 | tasks.md L5 指向 | 一致 |
|---|---|---|---|
| `specs/constitution.md` | v1.1.1（L4） | v1.1.1 | 是 |
| `specs/001-core-game/spec.md` | v1.1.4（L4） | v1.1.4 | 是 |
| `specs/001-core-game/plan.md` | v1.1.3（L5） | v1.1.3 | 是 |
| `specs/001-core-game/tasks.md` | v1.1.3（L4） | — | 保持不升版 |

## 5. TASK / REQ 映射零变化自检

- `### TASK-` 详情标题：**41** 个（TASK-001 ~ TASK-041，无缺号、无新增）。
- 「1. 任务总览」映射表：**41** 行，每行 REQ 列非空，孤儿任务 **0**。
- 展开映射表 REQ 列（含 `REQ-001,002,014` 这类缩写写法）：覆盖 **REQ-001 ~ REQ-051 共 51 条，缺失 0**。
- 映射表与改版前基线 `.tmp/tasks-v1.1.2-backup.md` 的 41 行逐行文本一致（本次上游修订未触碰表格），且 task-32 报告已存证 v1.1.2 → v1.1.3 期间映射零改动。
- 本次编辑为对 L5 唯一子串的一次等长替换，L1-L4、L6 之后全文未参与写入。

## 6. 结论

上游三处版本已与 constitution v1.1.1 / spec v1.1.4 / plan v1.1.3 完全一致；TASK 41 个与 REQ 51 条映射零变化；无阻塞问题。