# Flow Module Design Notes

本文档沉淀 `packages/server/modules/flow` 后续重构方向，目标是从当前的 `resourceType + resourceId + approveStatus 回写` 方案，迁移到基于 `binding` 的统一审批架构。

当前确认的设计决策如下：

- 同一业务对象同一时间只允许一个当前审批
- `MODEL_VERSION` 作为独立 `subjectType`
- `FORM_RECORD.subjectTable` 直接存真实表名
- 第一阶段不再回写 `approveStatus` 到业务表
- 对外接口采用 REST

## 设计目标

- 用统一的 `binding` 关联审批流程和业务对象
- 让 `approval_flow_instances` 成为审批过程事实源
- 支持 `MODEL_VERSION` 与 `FORM_RECORD` 两类业务对象复用同一套流程能力
- 支持“回退到指定节点（包括开始节点）”
- 允许表单类业务对象在回退到开始节点后修改数据并重新送审
- 避免将多轮审批揉进同一个 instance，保证历史清晰可追溯

## 总体思路

- `approval_flow_bindings` 代表业务对象的审批主线
- `approval_flow_instances` 代表某个业务对象的某一轮审批
- `approval_flow_actions` 记录每一轮审批中的动作
- `approval_flow_instance_steps` 记录每一轮审批的节点流转
- `approval_flow_definitions` / `approval_flow_definition_steps` 继续作为流程模板定义

推荐关系如下：

- 一个业务对象只对应一条 `binding`
- 一个 `binding` 可以关联多轮 `instance`
- 同一时间仅允许一个活跃的 `instance`
- “回退到开始节点”与“回退到中间节点”采用不同语义

## 为什么不再以业务表状态为主

不再使用业务表上的 `approveStatus` 作为审批主事实，主要原因：

- 只能表达当前状态，无法表达多轮审批历史
- 无法自然支持一个业务对象关联多次审批
- 容易产生流程状态与业务表状态不一致
- 对 `MODEL_VERSION` 这类细粒度资源不适合

第一阶段所有审批状态都从 `binding + instance` 查询。若未来需要列表性能优化，可增加只读投影，但不作为事实源。

## 核心数据模型

### 1. approval_flow_bindings

该表用于描述“哪个业务对象正在走哪条审批主线”。

建议字段如下：

```sql
approval_flow_bindings
- id                    varchar primary key
- projectId             varchar not null

- subjectType           varchar not null
-- MODEL_VERSION / FORM_RECORD

- subjectId             text not null
-- MODEL_VERSION: versionId
-- FORM_RECORD: 业务表主键

- subjectTable          varchar null
-- FORM_RECORD 必填，例如 quality_acceptance_forms
-- MODEL_VERSION 为空

- subjectKey            text not null unique
-- MODEL_VERSION -> model_version:{versionId}
-- FORM_RECORD   -> {table}:{rowId}

- definitionId          varchar not null
- templateId            varchar not null

- currentInstanceId     varchar null
- currentRoundNo        int not null default 0

- status                varchar not null
-- DRAFT / IN_REVIEW / RETURNED / APPROVED / REJECTED / CANCELED

- lastSubmittedAt       timestamp null
- lastSubmittedBy       varchar null
- lastReturnedAt        timestamp null
- lastReturnedBy        varchar null
- finishedAt            timestamp null

- metadata              jsonb null

- createdAt             timestamp not null
- updatedAt             timestamp not null
- creator               varchar not null
- updater               varchar not null
```

说明：

- `subjectKey` 是全局统一业务键
- 同一个业务对象只保留一条 binding，因此对 `subjectKey` 做唯一约束
- `currentInstanceId` 指向当前或最近一轮审批实例
- `status` 反映当前业务对象所处审批阶段，而不是步骤级状态

索引建议：

- `unique(subjectKey)`
- `index(projectId, subjectType, subjectId)`
- `index(currentInstanceId)`
- `index(projectId, status)`

### 2. approval_flow_instances

现有实例表继续保留，但建议补充以下字段：

```sql
- bindingId             varchar not null
- roundNo               int not null
- subjectSnapshot       jsonb not null
```

说明：

- `bindingId` 标识这轮实例属于哪个业务对象审批主线
- `roundNo` 用于区分第几轮送审
- `subjectSnapshot` 存储“本轮送审时”的业务快照

`subjectSnapshot` 很关键，因为审批人应当审阅本轮提交的数据快照，而不是实时业务表内容。

### 3. approval_flow_actions

建议在现有动作类型基础上补充：

```text
STARTED
STEP_APPROVED
APPROVED
RETURNED_TO_START
RETURNED_TO_STEP
RESUBMITTED
REJECTED
CANCELED
TIMEOUT_REJECTED
REACTIVATED
RESET_TO_UNSUBMITTED
```

其中：

- `RETURNED_TO_START` 表示退回发起人修改，不是最终驳回
- `RETURNED_TO_STEP` 表示同一轮实例回退到指定中间节点继续审批
- `RESUBMITTED` 表示用户修改后重新送审并开启新一轮 instance
- `REJECTED` 表示终态拒绝

### 4. approval_flow_instances.status

建议实例状态扩展为：

```text
IN_REVIEW
RETURNED
APPROVED
REJECTED
CANCELED
```

说明：

- `RETURNED` 表示这一轮审批已结束，并退回给发起人处理
- 用户处理后重新送审，不修改旧 instance，而是新建下一轮 instance

## Subject 类型设计

### MODEL_VERSION

`MODEL_VERSION` 代表模型版本级审批资源。

字段约定：

- `subjectType = MODEL_VERSION`
- `subjectId = versionId`
- `subjectTable = null`
- `subjectKey = model_version:{versionId}`

送审时建议写入的 `subjectSnapshot`：

```json
{
  "versionId": "v_001",
  "modelId": "m_001",
  "modelName": "结构模型",
  "branchId": "b_001",
  "versionNumber": 12,
  "commitId": "c_001",
  "createdAt": "2026-06-03T10:00:00Z",
  "createdBy": "u_001"
}
```

关键规则：

- version 是不可变资源
- 一轮审批只对应一个 version
- 审批回退到开始节点，不表示可以修改 version 内容本身
- 如果模型内容需要变更，应当创建新 version，并以新 version 重新送审

因此：

- `MODEL_VERSION` 的“回退到开始节点”只允许修改送审附加信息或重新提交
- 不允许修改原 version 的核心业务内容

### FORM_RECORD

`FORM_RECORD` 代表任意业务表中的一行数据。

字段约定：

- `subjectType = FORM_RECORD`
- `subjectTable = 真实业务表名`
- `subjectId = 业务主键`
- `subjectKey = {table}:{rowId}`

以质量验收单为例：

```text
subjectType = FORM_RECORD
subjectTable = quality_acceptance_forms
subjectId = qa_001
subjectKey = quality_acceptance_forms:qa_001
```

送审时建议写入的 `subjectSnapshot`：

```json
{
  "table": "quality_acceptance_forms",
  "formId": "qa_001",
  "title": "1#墩承台验收",
  "code": "QA-2026-001",
  "projectId": "p_001"
}
```

关键规则：

- `FORM_RECORD` 被退回到开始节点后，允许发起人修改业务数据
- 重提时创建新一轮 instance，并生成新的 `subjectSnapshot`
- 审批过程中展示的是实例内快照，不是实时业务表

## 回退到指定节点设计

### 推荐方案

“回退到指定节点”拆成两类：

1. 回退到开始节点
2. 回退到中间审批节点

推荐语义如下：

#### 回退到开始节点

回退到开始节点不在同一个 instance 里回卷步骤，而是：

1. 当前 instance 结束，状态记为 `RETURNED`
2. binding 状态更新为 `RETURNED`
3. 对 `FORM_RECORD` 开放业务编辑
4. 用户完成修改后，通过 `resubmit` 新建下一轮 instance

不推荐在同一个 instance 内部直接将步骤退回到开始节点，原因如下：

- 多轮审批会混在同一条实例历史里
- 节点状态和审批意见难以按轮次区分
- 业务数据修改前后无法清晰对应
- 实现复杂度高，且后续难维护

#### 回退到中间审批节点

回退到中间审批节点时，保留同一轮 instance，不新建轮次：

1. 当前节点结束，写入 `RETURNED_TO_STEP` 动作
2. 目标节点之后的步骤重置为 `WAITING`
3. 目标节点重置为 `PENDING`
4. instance 状态保持 `IN_REVIEW`
5. binding 状态保持 `IN_REVIEW`

适用场景：

- 审批人希望回到上一个审批节点补充审核
- 不需要业务发起人修改原始数据
- 希望保留在同一轮审批中处理

因此统一规则是：

- 回退到开始节点 = 结束当前轮次，允许业务修改，之后重提
- 回退到中间节点 = 同一轮内回卷节点，不允许业务进入可编辑态

### 状态机

以 `FORM_RECORD` 回退到开始节点为例：

```text
首次送审
-> binding.status = IN_REVIEW
-> instance(round=1).status = IN_REVIEW

审批通过
-> binding.status = APPROVED
-> instance(round=1).status = APPROVED

退回到开始节点
-> binding.status = RETURNED
-> instance(round=1).status = RETURNED

用户修改并重提
-> binding.status = IN_REVIEW
-> instance(round=2).status = IN_REVIEW
```

以“回退到中间节点”为例：

```text
首次送审
-> binding.status = IN_REVIEW
-> instance(round=1).status = IN_REVIEW
-> 当前步骤 = step_3

审批人回退到 step_2
-> binding.status = IN_REVIEW
-> instance(round=1).status = IN_REVIEW
-> step_3 状态重置
-> step_2 状态 = PENDING
```

### 节点回退规则

建议流程定义中的开始节点继续作为逻辑节点 `stepIndex = 0` 存在于流程模型中，但运行时做如下区分：

- 回退目标为 `stepIndex = 0`：按“回退到开始节点”处理，结束当前轮次
- 回退目标为 `stepIndex > 0`：按“回退到中间节点”处理，保留当前轮次

审批动作请求中建议显式传递：

```json
{
  "targetStep": 0,
  "comment": "请按意见修改后重新提交"
}
```

或：

```json
{
  "targetStep": 2,
  "comment": "请专业负责人补充审核"
}
```

### 两类 subject 的差异

#### FORM_RECORD

- 回退到开始节点 = 允许修改业务数据
- 修改完成后在同一 binding 下发起下一轮 instance
- 回退到中间节点 = 不允许编辑业务数据，仅在审批流中回到目标审批节点

#### MODEL_VERSION

- 回退到开始节点 = 允许修改附加说明或决定重新送审
- 不允许修改原 version 内容本体
- 若要变更模型内容，必须产出新 version，并以新的 `subjectKey` 发起新审批
- 回退到中间节点 = 同一轮审批内回到指定节点，不改变 version 本体

## REST API 草案

第一阶段采用 REST 接口，不扩展新的 GraphQL 入口。

### 查询接口

```text
GET /api/approval-bindings/by-subject?subjectType=MODEL_VERSION&subjectId={id}
GET /api/approval-bindings/by-subject?subjectType=FORM_RECORD&subjectTable={table}&subjectId={id}
GET /api/approval-bindings/{bindingId}
GET /api/approval-bindings/{bindingId}/instances
GET /api/approval-instances/{instanceId}
```

### 发起送审

```text
POST /api/approval-bindings/submit
```

请求示例：

```json
{
  "projectId": "p1",
  "subjectType": "FORM_RECORD",
  "subjectTable": "quality_acceptance_forms",
  "subjectId": "qa_001",
  "definitionId": "flow_def_001",
  "formData": {
    "remark": "请审批"
  },
  "comment": "首次送审"
}
```

或模型版本：

```json
{
  "projectId": "p1",
  "subjectType": "MODEL_VERSION",
  "subjectId": "version_001",
  "definitionId": "flow_def_002",
  "formData": {
    "remark": "版本送审"
  }
}
```

服务端处理步骤：

1. 校验 subject 是否存在
2. 根据 `subjectType` / `subjectTable` 读取业务对象
3. 生成 `subjectSnapshot`
4. 创建或获取 binding
5. 校验当前 binding 是否已有活跃 instance
6. 创建新一轮 instance
7. 更新 binding 的 `currentInstanceId`、`currentRoundNo`、`status`

### 审批动作

```text
POST /api/approval-instances/{instanceId}/approve
POST /api/approval-instances/{instanceId}/return-to-start
POST /api/approval-instances/{instanceId}/return-to-step
POST /api/approval-instances/{instanceId}/reject
POST /api/approval-instances/{instanceId}/cancel
```

其中：

- `approve`：当前轮次审批通过
- `return-to-start`：当前轮次退回发起人修改
- `return-to-step`：当前轮次回退到指定审批节点
- `reject`：当前轮次终态拒绝
- `cancel`：发起人或管理员取消当前轮次

`return-to-step` 请求示例：

```json
{
  "targetStep": 2,
  "comment": "请退回到专业负责人节点补充审核"
}
```

### 回退后重提

```text
POST /api/approval-bindings/{bindingId}/resubmit
```

请求示例：

```json
{
  "formData": {
    "remark": "已按意见修改，重新送审"
  },
  "comment": "第2轮送审"
}
```

服务端处理步骤：

1. 校验 binding 当前状态为 `RETURNED`
2. 校验当前用户是否为该业务对象的发起人/提交人
3. 重新读取业务对象
4. 生成新一轮 `subjectSnapshot`
5. 创建新的 instance，`roundNo = currentRoundNo + 1`
6. 写入 `RESUBMITTED` 动作
7. 更新 binding 状态为 `IN_REVIEW`

### 回退接口语义约束

- `return-to-start`
  - 目标固定为开始节点
  - 当前轮次结束
  - binding 进入 `RETURNED`
  - `FORM_RECORD` 允许发起人修改业务数据

- `return-to-step`
  - 目标必须是 `stepIndex > 0`
  - 当前轮次不结束
  - instance 继续保留为 `IN_REVIEW`
  - 不允许业务对象进入可编辑态

## Handler 路由建议

虽然 `FORM_RECORD.subjectTable` 存真实表名，但服务端不要做动态 SQL 通用写表。

推荐做法是引入 subject handler 路由层：

```ts
interface ApprovalSubjectHandler {
  getSubjectSnapshot(params: unknown): Promise<Record<string, unknown>>
  canSubmit(params: unknown): Promise<void>
  canResubmit(params: unknown): Promise<void>
  canEditWhenReturned(params: unknown): Promise<void>
}
```

建议注册方式：

- `MODEL_VERSION -> ModelVersionApprovalHandler`
- `FORM_RECORD + quality_acceptance_forms -> QualityAcceptanceApprovalHandler`
- `FORM_RECORD + monthly_measurements -> MonthlyMeasurementApprovalHandler`

这样做的好处：

- 每个业务模块自己维护业务校验规则
- flow 模块只负责审批编排，不直接耦合各业务表结构
- 可以避免后续把业务逻辑都堆在 flow 模块里

此外建议在 flow 模块内提供统一回退策略实现：

- `returnToStart(instanceId, comment)`
- `returnToStep(instanceId, targetStep, comment)`

两者共享权限校验与动作日志写入，但在 instance/binding 状态变更策略上分开实现。

## 查询策略

### 查询某个业务对象当前审批

通过 `subjectKey` 查 binding，再关联当前 instance：

```text
subjectKey -> binding -> currentInstanceId -> instance details
```

### 查询某个业务对象审批历史

通过 `bindingId` 查全部 instances：

```text
bindingId -> instances(order by roundNo desc)
```

### 列表页批量查询

以质量验收单列表为例：

1. 先查业务数据列表
2. 通过 `subjectTable + subjectId` 批量查 binding
3. 关联当前 instance 获取状态、当前步骤、更新时间

## 业务编辑规则

### FORM_RECORD

- 当 binding 不存在：允许编辑
- 当 binding.status = `RETURNED`：允许编辑
- 当 binding.status = `IN_REVIEW`：禁止编辑
- 当 binding.status = `APPROVED` / `REJECTED` / `CANCELED`：根据业务模块自行决定后续是否允许编辑

### MODEL_VERSION

- version 内容本身不可编辑
- `RETURNED` 仅表示允许重新提交送审附加信息
- 若模型内容需要调整，必须生成新 version

## 实施细节建议

### approval_flow_instance_steps 回退处理

对“回退到中间节点”建议按以下规则重置实例步骤：

- 目标步骤之前且已完成的步骤保持 `APPROVED`
- 目标步骤重置为 `PENDING`
- 目标步骤的 `approvedByIds` 清空
- 目标步骤之后的步骤统一重置为 `WAITING`
- 被回退的当前步骤写入回退动作后改为 `CANCELED` 或新增 `RETURNED` 步骤态

第一阶段为了降低枚举改动，可先采用：

- 当前步骤写动作日志，不新增步骤状态
- 目标步骤重置为 `PENDING`
- 后续步骤重置为 `WAITING`

### 审批详情展示建议

前端展示“回退到指定节点”时建议分为：

- `退回开始`：显示“已退回发起人修改，等待重新提交”
- `退回节点`：显示“已退回到节点 Step N”

并在动作日志 `metadata` 中记录：

```json
{
  "targetStep": 2,
  "targetType": "STEP"
}
```

或：

```json
{
  "targetStep": 0,
  "targetType": "START"
}
```

## 第一阶段实施建议

建议按以下顺序推进：

1. 新建 `approval_flow_bindings` migration
2. 为 `approval_flow_instances` 增加 `bindingId`、`roundNo`、`subjectSnapshot`
3. 扩展 `approval_flow_actions` / `approval_flow_instances.status` 枚举
4. 新增 REST router 与 service
5. 引入 subject handler 机制
6. 先接入 `FORM_RECORD + quality_acceptance_forms`
7. 再接入 `MODEL_VERSION`

## 推荐的后续拆分

建议后续在本模块内按职责继续拆分：

- `rest/approvalBindings.ts`
- `services/approvalBindings.ts`
- `services/subjectHandlers/modelVersion.ts`
- `services/subjectHandlers/formRecords/qualityAcceptance.ts`
- `services/subjectHandlers/formRecords/monthlyMeasurements.ts`

## 待确认但默认按以下处理

- `return-to-start` 仅允许退回给当前 binding 的发起人/提交人处理
- `MODEL_VERSION` 被退回后，允许修改附加说明再重提
- 第一阶段不做审批状态投影表
- 第一阶段不保留业务表 `approveStatus`
