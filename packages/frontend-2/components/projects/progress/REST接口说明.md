# 进度管理 REST 接口说明

## 1. 文档目标

本文档用于说明当前 `进度管理` 模块已经提供的 REST 接口、请求参数、返回结构以及前端使用方法，便于后续页面开发和联调。

适用范围：

- `进度计划`
- `实际进度`
- `形象进度`
- 构件快照
- 任务快照
- 统计接口

## 2. 基础说明

### 2.1 接口前缀

统一前缀：

```text
/api/v1/projects/:projectId/progress
```

### 2.2 鉴权说明

前端调用时默认应走项目内统一鉴权 `$fetch` 链路，而不是手写无鉴权请求。<mccoremem id="01KRFYCG19SPMZSH0GGQWG4WR4|01KRGVB0AF6MJ2E3ECVXWHJD9V" />

当前前端协议层文件：

- `packages/frontend-2/lib/projects/api/progress.ts`

### 2.3 构件主键

本模块计划与实际的主关联键是：

- `modelId + applicationId`

其中：

- `applicationId` 为构件业务主键
- `modelId` 用于区分不同模型中的构件

## 3. 计划文件接口

### 3.1 获取当前计划文件

- 方法：`GET`
- 路径：`/api/v1/projects/:projectId/progress/plan-file`

用途：

- 获取当前项目最新计划文件信息

返回示例：

```json
{
  "data": {
    "id": "abc1234567",
    "projectId": "stream1234",
    "blobId": "blob123",
    "fileName": "progress-plan.mpp",
    "fileType": "mpp",
    "fileSize": 10240,
    "creator": "user1",
    "updater": "user1",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:00:00.000Z"
  }
}
```

前端调用：

```ts
import { getLatestProgressPlanFile } from '~/lib/projects/api/progress'

const file = await getLatestProgressPlanFile({
  projectId,
  apiOrigin
})
```

### 3.2 上传计划文件并触发导入

- 方法：`POST`
- 路径：`/api/v1/projects/:projectId/progress/plan-file`

请求体：

```json
{
  "blobId": "blob123",
  "fileName": "progress-plan.mpp",
  "fileType": "mpp",
  "fileSize": 10240
}
```

用途：

- 保存计划文件记录
- 触发 `.mpp` 导入
- 自动重建计划任务
- 自动重建任务构件明细
- 自动重算构件快照和任务快照

返回示例：

```json
{
  "data": {
    "id": "abc1234567",
    "projectId": "stream1234",
    "blobId": "blob123",
    "fileName": "progress-plan.mpp",
    "fileType": "mpp",
    "fileSize": 10240,
    "creator": "user1",
    "updater": "user1",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:00:00.000Z"
  },
  "importSummary": {
    "status": "completed",
    "importedTaskCount": 125
  }
}
```

前端调用：

```ts
import { uploadProgressPlanFile } from '~/lib/projects/api/progress'

const result = await uploadProgressPlanFile({
  projectId,
  file,
  apiOrigin
})
```

### 3.3 下载当前计划文件

- 方法：`GET`
- 路径：`/api/v1/projects/:projectId/progress/plan-file/download`

用途：

- 下载当前最新 `.mpp` 原文件

前端调用：

```ts
import { downloadLatestProgressPlanFile } from '~/lib/projects/api/progress'

await downloadLatestProgressPlanFile({
  projectId,
  apiOrigin
})
```

## 4. 计划任务接口

### 4.1 获取计划任务列表

- 方法：`GET`
- 路径：`/api/v1/projects/:projectId/progress/plan-tasks`

用途：

- 获取当前项目计划任务列表
- 返回任务时间、层级和 BIM 关联结果

返回字段重点：

- `id`
- `taskName`
- `startDate`
- `endDate`
- `predecessor`
- `applicationIds`
- `selections`

返回示例：

```json
{
  "data": [
    {
      "id": "task001",
      "projectId": "stream1234",
      "planFileId": "planfile001",
      "externalId": "100",
      "wbs": "1.2.3",
      "taskName": "二层墙体施工",
      "parentId": "task000",
      "level": 2,
      "sortOrder": 10,
      "duration": "5d",
      "startDate": "2026-05-10T00:00:00.000Z",
      "endDate": "2026-05-15T00:00:00.000Z",
      "predecessor": null,
      "inspection": null,
      "modelId": null,
      "modelIds": ["modelA"],
      "applicationIds": ["app-1", "app-2"],
      "selections": [
        {
          "modelId": "modelA",
          "applicationIds": ["app-1", "app-2"]
        }
      ],
      "createdAt": "2026-05-14T10:00:00.000Z",
      "updatedAt": "2026-05-14T10:00:00.000Z"
    }
  ]
}
```

前端调用：

```ts
import { getProgressPlanTasks } from '~/lib/projects/api/progress'

const tasks = await getProgressPlanTasks({
  projectId,
  apiOrigin
})
```

### 4.2 更新任务 BIM 关联

- 方法：`PUT`
- 路径：`/api/v1/projects/:projectId/progress/plan-tasks/:taskId/bim-association`

请求体：

```json
{
  "modelId": null,
  "modelIds": ["modelA", "modelB"],
  "applicationIds": ["app-1", "app-2", "app-3"],
  "selections": [
    {
      "modelId": "modelA",
      "applicationIds": ["app-1", "app-2"]
    },
    {
      "modelId": "modelB",
      "applicationIds": ["app-3"]
    }
  ]
}
```

用途：

- 更新某个计划任务绑定的构件
- 自动重建该任务的 `task_elements`
- 自动重算受影响构件快照和任务快照

前端调用：

```ts
import { updateProgressPlanTaskBimAssociation } from '~/lib/projects/api/progress'

const updated = await updateProgressPlanTaskBimAssociation({
  projectId,
  taskId,
  selections,
  apiOrigin
})
```

### 4.3 手动导入计划任务

- 方法：`POST`
- 路径：`/api/v1/projects/:projectId/progress/plan-tasks/import`

请求体：

```json
{
  "planFileId": "planfile001",
  "tasks": [
    {
      "externalId": "100",
      "parentExternalId": "10",
      "wbs": "1.2.3",
      "name": "二层墙体施工",
      "level": 2,
      "sortOrder": 10,
      "duration": "5d",
      "planStart": "2026-05-10T00:00:00.000Z",
      "planEnd": "2026-05-15T00:00:00.000Z",
      "predecessor": null,
      "inspectionBatch": null,
      "bimElements": {
        "selections": [
          {
            "modelId": "modelA",
            "applicationIds": ["app-1", "app-2"]
          }
        ]
      }
    }
  ]
}
```

用途：

- 以接口方式直接替换计划任务
- 自动同步快照链路

## 5. 实际进度接口

### 5.1 获取实际记录列表

- 方法：`GET`
- 路径：`/api/v1/projects/:projectId/progress/actual-records`

用途：

- 获取实际进度台账
- 返回 `开始构件` 和 `完成构件` 两套多模型结果

返回字段重点：

- `taskName`
- `reportDate`
- `startSelections`
- `finishSelections`
- `startElementCodes`
- `finishElementCodes`

前端调用：

```ts
import { getActualProgressRecords } from '~/lib/projects/api/progress'

const records = await getActualProgressRecords({
  projectId,
  apiOrigin
})
```

### 5.2 新增实际记录

- 方法：`POST`
- 路径：`/api/v1/projects/:projectId/progress/actual-records`

请求体：

```json
{
  "taskName": "二层墙体施工日报",
  "reportDate": "2026-05-14",
  "startElementCodes": "app-1、app-2",
  "finishElementCodes": "app-3",
  "startModelIds": ["modelA"],
  "startApplicationIds": ["app-1", "app-2"],
  "startSelections": [
    {
      "modelId": "modelA",
      "applicationIds": ["app-1", "app-2"]
    }
  ],
  "finishModelIds": ["modelA"],
  "finishApplicationIds": ["app-3"],
  "finishSelections": [
    {
      "modelId": "modelA",
      "applicationIds": ["app-3"]
    }
  ],
  "remark": "今日完成部分墙体",
  "constructionRecord": "完成绑扎与支模",
  "qualityRecord": "检查正常",
  "safetyRecord": "无异常"
}
```

用途：

- 新增一条实际进度记录
- 自动展开开始/完成构件事件
- 自动重算受影响构件快照和任务快照

前端调用：

```ts
import { createActualProgressRecord } from '~/lib/projects/api/progress'

const created = await createActualProgressRecord({
  projectId,
  apiOrigin,
  input: form
})
```

### 5.3 编辑实际记录

- 方法：`PUT`
- 路径：`/api/v1/projects/:projectId/progress/actual-records/:recordId`

用途：

- 更新一条实际记录
- 自动根据旧记录和新记录差异重算事件、构件快照和任务快照

前端调用：

```ts
import { updateActualProgressRecord } from '~/lib/projects/api/progress'

const updated = await updateActualProgressRecord({
  projectId,
  recordId,
  apiOrigin,
  input: form
})
```

### 5.4 删除实际记录

- 方法：`DELETE`
- 路径：`/api/v1/projects/:projectId/progress/actual-records/:recordId`

用途：

- 删除一条实际记录
- 同步删除该记录事件并重算受影响快照

前端调用：

```ts
import { deleteActualProgressRecord } from '~/lib/projects/api/progress'

await deleteActualProgressRecord({
  projectId,
  recordId,
  apiOrigin
})
```

### 5.5 Excel 导入实际记录

- 方法：`POST`
- 路径：`/api/v1/projects/:projectId/progress/actual-records/import`

请求体：

```json
{
  "blobId": "blob123",
  "fileName": "实际进度填报.xlsx"
}
```

用途：

- 从上传后的 Excel 触发导入
- 批量生成实际记录
- 同步生成事件并重算快照

返回示例：

```json
{
  "data": {
    "createdCount": 20
  }
}
```

前端调用：

```ts
import { importActualProgressRecordsFromExcel } from '~/lib/projects/api/progress'

const result = await importActualProgressRecordsFromExcel({
  projectId,
  apiOrigin,
  file
})
```

## 6. 构件快照接口

### 6.1 获取构件快照列表

- 方法：`GET`
- 路径：`/api/v1/projects/:projectId/progress/element-snapshots`

查询参数：

- `modelId`
- `progressStatus`
- `page`
- `limit`

`progressStatus` 当前支持：

- `not_started`
- `ready_not_started`
- `delayed_not_started`
- `in_progress`
- `in_progress_delayed`
- `finished_ahead`
- `finished_on_time`
- `finished_delayed`

用途：

- 形象进度着色
- 构件维度筛选
- 构件维度统计

返回示例：

```json
{
  "data": [
    {
      "id": "snap001",
      "projectId": "stream1234",
      "modelId": "modelA",
      "applicationId": "app-1",
      "plannedStartAt": "2026-05-10T00:00:00.000Z",
      "plannedFinishAt": "2026-05-15T00:00:00.000Z",
      "actualStartAt": "2026-05-12T00:00:00.000Z",
      "actualFinishAt": "2026-05-14T00:00:00.000Z",
      "progressStatus": "finished_ahead",
      "progressPercent": 100,
      "isAheadStart": false,
      "isDelayedFinish": false,
      "lastReportAt": "2026-05-14T00:00:00.000Z",
      "createdAt": "2026-05-14T10:00:00.000Z",
      "updatedAt": "2026-05-14T10:05:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 50
  }
}
```

前端调用：

```ts
import { getProgressElementSnapshots } from '~/lib/projects/api/progress'

const payload = await getProgressElementSnapshots({
  projectId,
  apiOrigin,
  modelId,
  progressStatus: 'in_progress_delayed',
  page: 1,
  limit: 50
})
```

常见使用方式：

- `physicalPage.vue` 先查当前模型的构件快照
- 再把 `(modelId, applicationId) -> progressStatus` 映射到 Viewer 颜色
- 其中 `ready_not_started / delayed_not_started / in_progress_delayed` 可用于区分是否已进入延期状态

## 7. 任务快照接口

### 7.1 获取任务快照列表

- 方法：`GET`
- 路径：`/api/v1/projects/:projectId/progress/task-snapshots`

查询参数：

- `taskStatus`
- `keyword`
- `page`
- `limit`

用途：

- 展示任务完成率
- 展示任务是否逾期
- 展示任务实际开始/完成时间

返回示例：

```json
{
  "data": [
    {
      "id": "tasksnap001",
      "projectId": "stream1234",
      "taskId": "task001",
      "taskName": "二层墙体施工",
      "wbs": "1.2.3",
      "totalElementCount": 10,
      "finishedElementCount": 8,
      "inProgressElementCount": 2,
      "notStartedElementCount": 0,
      "delayedElementCount": 1,
      "completionRate": 80,
      "plannedStartAt": "2026-05-10T00:00:00.000Z",
      "plannedFinishAt": "2026-05-15T00:00:00.000Z",
      "actualStartAt": "2026-05-12T00:00:00.000Z",
      "actualFinishAt": null,
      "taskStatus": "in_progress",
      "lastCalculatedAt": "2026-05-14T10:05:00.000Z",
      "createdAt": "2026-05-14T10:00:00.000Z",
      "updatedAt": "2026-05-14T10:05:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 50
  }
}
```

前端调用：

```ts
import { getProgressTaskSnapshots } from '~/lib/projects/api/progress'

const payload = await getProgressTaskSnapshots({
  projectId,
  apiOrigin,
  taskStatus: 'delayed',
  keyword: '墙体',
  page: 1,
  limit: 20
})
```

常见使用方式：

- 计划任务列表页加状态列和完成率列
- 逾期任务列表直接按 `taskStatus = delayed` 查询

## 8. 统计接口

### 8.1 获取进度统计

- 方法：`GET`
- 路径：`/api/v1/projects/:projectId/progress/statistics`

用途：

- 获取首页或页面顶部统计卡片数据

返回示例：

```json
{
  "data": {
    "totalElements": 100,
    "finishedElements": 60,
    "inProgressElements": 20,
    "notStartedElements": 20,
    "finishedAheadElements": 10,
    "finishedOnTimeElements": 40,
    "finishedDelayedElements": 10,
    "aheadStartElements": 5,
    "delayedFinishElements": 10,
    "totalTasks": 20,
    "finishedTasks": 8,
    "delayedTasks": 3,
    "inProgressTasks": 6,
    "notStartedTasks": 3,
    "completionRate": 60
  }
}
```

前端调用：

```ts
import { getProgressStatistics } from '~/lib/projects/api/progress'

const stats = await getProgressStatistics({
  projectId,
  apiOrigin
})
```

常见使用方式：

- 顶部统计卡片
- 进度概览页
- 形象进度页右上角指标区

## 9. 全量重建快照接口

### 9.1 按项目重建全部构件快照与任务快照

- 方法：`POST`
- 路径：`/api/v1/projects/:projectId/progress/rebuild-snapshots`

用途：

- 从项目原始数据全量重建派生层
- 适合在以下场景手动执行一次：
  - 状态口径调整后，需要把历史快照全部重算
  - 怀疑 `task_elements`、`actual_element_events`、`element_snapshots`、`task_snapshots` 不一致
  - 导入或批量修复历史数据后，希望一次性校平

重建范围：

- `project_progress_task_elements`
- `project_progress_actual_element_events`
- `project_progress_element_snapshots`
- `project_progress_task_snapshots`

执行方式：

- 先按项目清空上述 4 张派生表
- 再从 `plan_tasks` 和 `actual_records` 重新展开并重建

返回示例：

```json
{
  "data": {
    "status": "completed",
    "planTaskCount": 125,
    "actualRecordCount": 38,
    "affectedElementCount": 420,
    "rebuiltTaskSnapshotCount": 125
  }
}
```

前端调用：

```ts
import { rebuildProgressSnapshots } from '~/lib/projects/api/progress'

const summary = await rebuildProgressSnapshots({
  projectId,
  apiOrigin
})
```

使用建议：

- 这是写接口，建议只放在管理员入口或运维入口
- 执行成功后，再刷新 `element-snapshots`、`task-snapshots`、`statistics`
- 如果项目数据量较大，建议在界面上提供“重建中”提示和结果摘要展示

## 10. 推荐前端使用方式

### 9.1 进度计划页

建议组合调用：

- `getProgressPlanTasks`
- `updateProgressPlanTaskBimAssociation`
- `uploadProgressPlanFile`
- `downloadLatestProgressPlanFile`

推荐做法：

- 任务列表仍读取 `plan-tasks`
- 如果要展示完成率、是否逾期，叠加查询 `task-snapshots`

### 9.2 实际进度页

建议组合调用：

- `getActualProgressRecords`
- `createActualProgressRecord`
- `updateActualProgressRecord`
- `deleteActualProgressRecord`
- `importActualProgressRecordsFromExcel`

推荐做法：

- 表单继续维护 `startSelections` 和 `finishSelections`
- 不在前端自行计算快照状态

### 9.3 形象进度页

建议组合调用：

- `getProgressElementSnapshots`
- `getProgressStatistics`
- `rebuildProgressSnapshots`

推荐做法：

- 先按模型查询构件快照
- 将 `progressStatus` 映射颜色
- 统计卡片直接读取 `statistics`

## 11. 开发注意事项

### 10.1 页面不要自行聚合快照

不建议前端自行把：

- 计划任务
- 实际记录
- BIM 关联

重新拼成状态结果。

推荐统一使用：

- `element-snapshots`
- `task-snapshots`
- `statistics`

### 10.2 计划与实际的主关联口径

当前后端设计主线不是 `taskId`，而是构件：

- 计划任务通过构件描述计划时间
- 实际记录通过构件描述实际事件
- 快照和统计都按构件维度聚合，再反推任务状态

### 10.3 当前未完成的消费层

虽然接口已具备，但页面侧仍待切换：

- `physicalPage.vue`
- 任务维度统计区
- 任务状态展示区

## 12. 对应前端 API 方法清单

当前 `packages/frontend-2/lib/projects/api/progress.ts` 已包含以下方法：

- `getLatestProgressPlanFile`
- `uploadProgressPlanFile`
- `getProgressPlanTasks`
- `updateProgressPlanTaskBimAssociation`
- `getActualProgressRecords`
- `createActualProgressRecord`
- `importActualProgressRecordsFromExcel`
- `updateActualProgressRecord`
- `deleteActualProgressRecord`
- `getProgressElementSnapshots`
- `getProgressTaskSnapshots`
- `getProgressStatistics`
- `rebuildProgressSnapshots`

后续页面开发时，优先复用这些方法，不建议重复手写请求。
