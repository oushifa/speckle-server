# 审批流程 API 接口与使用指南

本文档用于指导开发人员和系统集成人员通过 REST API 接口来配置、发起和管理项目中的审批流程。系统将业务对象（如表单记录或 BIM 模型）抽象为 **主体 (Subject)**，通过 **绑定 (Binding)** 关系与 **流程定义 (Definition)** 关联，并生成 **审批实例 (Instance)** 进行流转。

---

## 1. 核心概念与关系模型

- **审批定义 (Approval Definition)**：审批流配置模板，包括名称、分类（表单 / 模型）、节点步骤、审批人列表及或签/依次审批模式。
- **审批绑定 (Approval Binding)**：业务主体与流程定义之间的桥梁。一个业务主体（如“月度验工计价单 #101”）只能有一个处于激活状态的绑定，但能生成多个历史审批实例。
- **审批实例 (Approval Instance)**：流程流转的运行实体，包含当前的步骤、审批日志、审核人员的操作记录（通过/驳回）和状态。

---

## 2. 流程定义配置接口

### 2.1 获取项目的审批定义列表

用于查询当前项目下已创建的流程模板。

- **请求方式**：`GET`
- **请求路径**：`/api/projects/:projectId/approval-definitions`
- **路径参数**：
  - `projectId` (string) - 项目 ID
- **返回结果**：
  ```json
  [
    {
      "id": "def-12345",
      "templateId": "m_measure",
      "name": "月度验工计价审核流",
      "category": "表单",
      "isActive": true,
      "description": "适用于月度工程量和验工计价表审批",
      "steps": [
        {
          "id": "step-1",
          "role": "监理工程师",
          "approvers": ["张三", "李四"],
          "selectedApprovers": [{ "id": "user-a", "name": "张三", "avatar": null }],
          "mode": "OR"
        }
      ],
      "createdAt": "2026-06-04T10:00:00Z",
      "updatedAt": "2026-06-04T11:00:00Z"
    }
  ]
  ```

### 2.2 创建或更新审批定义

- **请求方式**：`POST`
- **请求路径**：`/api/projects/:projectId/approval-definitions`
- **路径参数**：
  - `projectId` (string) - 项目 ID
- **请求 Body**：
  ```json
  {
    "id": "flow-1717520000000", // 可选，不传为新建，传且模板已存在为更新
    "name": "月度验工计价审核流",
    "category": "表单", // 仅支持 '表单' | '模型'
    "isActive": true,
    "description": "适用于月度工程量和验工计价表审批",
    "steps": [
      {
        "role": "监理工程师",
        "mode": "OR", // 'OR' (或签) 或 'AND' (依次审批)
        "selectedApprovers": [{ "id": "user-a" }]
      }
    ]
  }
  ```

### 2.3 删除审批定义

- **请求方式**：`DELETE`
- **请求路径**：`/api/projects/:projectId/approval-definitions/:id`
- **路径参数**：
  - `projectId` (string) - 项目 ID
  - `id` (string) - 审批定义 ID

---

## 3. 发起审批与绑定

在具体的业务系统（如工作台模型、月度验工计价表）中，业务数据在准备完毕后，可以通过以下接口发起并绑定审批流。

### 3.1 查询业务主体的审批绑定状态

在渲染业务页面（如某行数据）时，先根据业务的唯一标识查询其是否有绑定的流程以及当前状态。

- **请求方式**：`GET`
- **请求路径**：`/api/approval-bindings/by-subject`
- **Query 参数**：

  - `projectId` (string, 必填) - 项目 ID
  - `subjectType` (string, 必填) - 主体类型，可选值：`FORM_RECORD` (表单类) 或 `MODEL` (模型类)
  - `subjectId` (string, 必填) - 业务主体的唯一 ID (例如计价单 ID)
  - `subjectTable` (string) - 如果 `subjectType` 为 `FORM_RECORD`，必须提供具体的表单数据库表名

- **返回结果**：
  - **未发起过**：返回 `null`。
  - **已发起过**：
    ```json
    {
      "id": "bind-9876",
      "projectId": "proj-1",
      "subjectType": "FORM_RECORD",
      "subjectId": "val-101",
      "subjectTable": "monthly_measurements",
      "definitionId": "def-12345",
      "status": "UNDER_REVIEW", // 可选值: PENDING, UNDER_REVIEW, APPROVED, REJECTED, CANCELED
      "currentInstanceId": "inst-5555" // 当前正在流转的审批实例 ID
    }
    ```

### 3.2 首次提交发起审批

将业务主体与选定的审批定义模板进行绑定，并触发流程流转。

- **请求方式**：`POST`
- **请求路径**：`/api/approval-bindings/submit`
- **请求 Body 结构说明**：
  - `projectId` (string, 必填) - 项目 ID
  - `subjectType` (string, 必填) - 主体类型：`FORM_RECORD` 或 `MODEL`
  - `subjectId` (string, 必填) - 绑定的业务 ID (表单主键 ID 或模型/版本 ID)
  - `subjectTable` (string) - 表单记录对应的数据库表名 (仅在 `subjectType === "FORM_RECORD"` 时为必填，`MODEL` 时不传或传 `null`)
  - `definitionId` (string, 必填) - 流程定义 ID
  - `formData` (object, 可选) - 审批附属的表单自定义字段值集合
  - `comment` (string, 可选) - 发起时提交的备注/附言

#### 示例 1：表单类审批发起 (以月度验工计价表为例)

- **请求 Body**：
  ```json
  {
    "projectId": "proj-1",
    "subjectType": "FORM_RECORD",
    "subjectId": "val-101",
    "subjectTable": "monthly_measurements", // 表单类审批必须传入物理表名，后台用于数据同步和流转校验
    "definitionId": "def-12345",
    "formData": {
      "reason": "常规月度工程量申报",
      "amount": 125000.5
    },
    "comment": "请监理及现场负责人尽快审批"
  }
  ```

#### 示例 2：模型类审批发起 (以三维 BIM 模型版本审查为例)

- **请求 Body**：
  ```json
  {
    "projectId": "proj-1",
    "subjectType": "MODEL",
    "subjectId": "model-commit-7788", // 传入具体的模型版本 Commit ID 或分支模型 ID
    "subjectTable": null, // 模型类审批不需要传入物理表名，传 null 或直接省略该字段
    "definitionId": "def-67890",
    "formData": {
      "versionLabel": "主楼结构施工图 v2.1",
      "discipline": "结构专业",
      "elementsCount": 1540
    }, // 可选，在此携带模型版本的附加元数据，供审批页面读取展示
    "comment": "结构模型已完成调整，请审查构件规范性"
  }
  ```

#### ⚠️ formData 在流转过程中的变更规则

- **审批中只读（Read-only）**：在流程处于流转中（`UNDER_REVIEW`）状态时，后续节点审批人在调用通过（`/approve`）或驳回（`/reject`）接口时，**无法**直接修改 `formData` 内容。`formData` 对所有审核节点只读。
- **重新发起时允许覆盖（Update on Resubmit）**：如果流程已被驳回（`REJECTED`）或取消（`CANCELED`），发起人在调用 **重新发起审批** 接口（`resubmit`）时，可以随请求传入新的 `formData`。该新数据将覆盖旧的表单值并随流程进入下一轮审批流转。

### 3.3 重新发起审批

若先前的审批已被驳回（`REJECTED`）或取消（`CANCELED`），可通过本接口保留绑定关系并重新发起审核。

- **请求方式**：`POST`
- **请求路径**：`/api/approval-bindings/:bindingId/resubmit`
- **路径参数**：
  - `bindingId` (string) - 审批绑定 ID
- **请求 Body**：
  ```json
  {
    "formData": {
      "reason": "修改后的月度工程量申报",
      "amount": 120000.0
    }, // 可选
    "comment": "已按驳回意见修正数据，重新提交" // 可选
  }
  ```

---

## 4. 审批处理接口

当前节点的处理人在登录后，可使用以下接口对审批任务进行推进和驳回。

### 4.1 获取审批实例的详细信息

获取当前流程的流转日志、节点状态及当前步骤。

- **请求方式**：`GET`
- **请求路径**：`/api/approval-instances/:instanceId`
- **路径参数**：
  - `instanceId` (string) - 审批实例 ID
- **返回结果**：
  ```json
  {
    "id": "inst-5555",
    "projectId": "proj-1",
    "status": "UNDER_REVIEW",
    "currentStep": 1,
    "definition": {
      "id": "def-12345",
      "name": "月度验工计价审核流"
    },
    "steps": [
      {
        "id": "step-1",
        "name": "监理工程师",
        "stepIndex": 1,
        "status": "PENDING", // WAITING, PENDING, APPROVED, REJECTED, CANCELED
        "requiredApprovals": 1,
        "approvedByIds": [],
        "approvers": [{ "id": "user-a", "name": "张三" }],
        "startedAt": "2026-06-04T10:00:00Z",
        "dueAt": "2026-06-05T10:00:00Z"
      }
    ],
    "actions": [
      {
        "id": "act-1",
        "action": "STARTED",
        "fromStatus": "PENDING",
        "toStatus": "UNDER_REVIEW",
        "comment": "发起备注",
        "actor": { "id": "user-b", "name": "发起人李四" },
        "createdAt": "2026-06-04T10:00:00Z"
      }
    ]
  }
  ```

### 4.2 通过审批 (Approve)

推进当前节点。如果当前是最后一个节点，则整个流程结束并更新绑定状态为 `APPROVED`。

- **请求方式**：`POST`
- **请求路径**：`/api/approval-instances/:instanceId/approve`
- **请求 Body**：
  ```json
  {
    "comment": "审核通过，无异议" // 可选意见
  }
  ```

### 4.3 驳回审批 (Reject)

拒绝当前审批，流程将置为 `REJECTED` 状态中止（或回退）。

- **请求方式**：`POST`
- **请求路径**：`/api/approval-instances/:instanceId/reject`
- **请求 Body**：
  ```json
  {
    "comment": "驳回原因：数据有误，需重新核算工程量" // 必填原因说明
  }
  ```

### 4.4 取消/撤销审批 (Cancel)

通常由发起人或管理员使用，提前中止流程，状态更新为 `CANCELED`。

- **请求方式**：`POST`
- **请求路径**：`/api/approval-instances/:instanceId/cancel`
- **请求 Body**：
  ```json
  {
    "comment": "由发起人撤销" // 可选意见说明
  }
  ```

### 4.5 回退至开始节点 (Return to Start)

直接将审批重置回初始发起状态。

- **请求方式**：`POST`
- **请求路径**：`/api/approval-instances/:instanceId/return-to-start`
- **请求 Body**：
  ```json
  {
    "comment": "需要发起人重新补充材料" // 必填原因说明
  }
  ```

### 4.6 回退至指定步骤 (Return to Step)

回退到历史通过的某一个节点步骤。

- **请求方式**：`POST`
- **请求路径**：`/api/approval-instances/:instanceId/return-to-step`
- **请求 Body**：
  ```json
  {
    "targetStep": 1, // 必填目标步骤的 stepIndex (必须大于0)
    "comment": "退回重新确认细节" // 必填原因说明
  }
  ```

---

> [!IMPORTANT] > **业务对接规范提示：**
>
> 1. **状态轮询与回写**：业务系统在发起审批后，需根据接口返回的 `status`（如 `APPROVED` 或 `REJECTED`）来进行本地业务逻辑的状态变更。
> 2. **表单验证**：在业务发起 `submit` 时，如果 `subjectType` 为 `FORM_RECORD`，必须提供对应的真实数据库表名 `subjectTable`，后台将进行校验。
