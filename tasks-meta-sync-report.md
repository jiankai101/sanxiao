# tasks.md 元数据同步报告（对齐 plan/spec/constitution v1.1.1）

- 任务：task-17（父任务 task-1），执行者 pt-architect，attempt 1
- 日期：2026-11-11
- 目标文件：`specs/001-core-game/tasks.md`（纯元数据维护，未动任何 TASK 卡）

## 1. 改动行（唯一改动，共 2 行）

| 行号 | 改前 | 改后 |
|---|---|---|
| 4 | `- 文档版本：v1.1.0` | `- 文档版本：v1.1.1` |
| 5 | 上游行三处版本尾部：`spec.md` v1.1.0、`plan.md` v1.1.0、`constitution.md` v1.1.0 | 同结构，三处均改为 v1.1.1 |

第 5 行最终内容：

```text
- 上游：`/specs/001-core-game/spec.md` v1.1.1（51 条 REQ）、`/specs/001-core-game/plan.md` v1.1.1（G2 技术方案）、`/specs/constitution.md` v1.1.1
```

## 2. 全文版本引用检索结果

- 检索模式：`v1.0.`、`v1.1.0`、`版本：v`
- 改后命中：仅第 4 行（v1.1.1，本次新值）；全文残留 `v1.1.0` / `v1.0.x` 引用 **0 处**。
- 保留未改写：TASK 卡内历史裁决留痕（CR-002 / CR-003 / CR-004 / CR-005、“spec 9.2”等），符合“仅更新上游/依赖版本指向”的边界。

## 3. 上游版本链路一致性

| 文档 | 当前版本 | 一致性 |
|---|---|---|
| `specs/constitution.md` | v1.1.1 | 一致 |
| `specs/001-core-game/spec.md` | v1.1.1 | 一致 |
| `specs/001-core-game/plan.md` | v1.1.1 | 一致 |
| `specs/001-core-game/tasks.md` | v1.1.1（本次更新） | 一致 |

## 4. 完整性校验

- **零正文改动证明**：将改后文件第 4、5 行的 v1.1.1 反向替换回 v1.1.0，重算 SHA-256 = `240DE8F6943EB26BEF75FC1F42A46E15A189F3DF87BC6BBDEFA6B33FFBEEBEDF`，与改前哈希逐字节一致，即除这 2 行版本号外其余内容 0 变更。
- 文件大小：58162 字节（改前同为 58162，等长替换）
- 行数：985 行（改前 985 行）；行尾 LF、无 BOM，与改前一致
- TASK 卡正文 / DoD / REQ 映射 / 并行分组 / 依赖图 / 关键路径：零改动

## 5. TASK 编号连续性

- TASK 唯一编号 41 个：TASK-001 ~ TASK-041，无缺号、无重复，连续
- 任务总览表行数 41，无新增、无删除

## 6. REQ 覆盖率自检

- REQ 唯一编号 51 个：REQ-001 ~ REQ-051，连续无缺
- REQ→TASK 映射表行数 51
- 覆盖率 51/51 = **100%**；孤儿任务 0

## 7. 未触碰文件

- 未修改 `specs/001-core-game/plan.md`、`specs/001-core-game/spec.md`、`specs/constitution.md`
- 未修改任何 `src/**`、`tests/**`、`assets/**` 文件

## 8. 哈希

| 阶段 | SHA-256 |
|---|---|
| 改前 | `240DE8F6943EB26BEF75FC1F42A46E15A189F3DF87BC6BBDEFA6B33FFBEEBEDF` |
| 改后 | `5328AE9A065D6220F16AB671BE04C7FEBBBE7762EF8945C43B3E11DF0C4A3206` |

## 9. 结论

tasks.md 版本链路已与 plan.md / spec.md / constitution.md 的 v1.1.1 对齐；TASK-001~041 与 51 条 REQ 的映射关系零变化，验收条件全部满足。