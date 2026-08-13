# 外部数据获取 API 使用说明文档

本模块作为 Speckle Server 的外部 API 管理模块，提供给第三方系统获取项目的项目信息、进度计划、实际进度、质量验收等数据。

---

## 一、 鉴权说明

除了**免登录附件下载接口**外，所有的外部数据查询接口均需要携带预先配置的外部 API 令牌（Fixed Token）进行鉴权。

### 1. 密钥配置

需要在 Speckle Server 容器或服务运行的环境变量中，配置 `EXTERNAL_API_TOKEN`。例如：

```bash
EXTERNAL_API_TOKEN=your_secure_external_api_token_here
```

### 2. 请求携带方式

第三方系统调用外部接口时，可以通过以下两种形式的任一种，在 HTTP 请求头中携带令牌：

- **自定义头部**：`x-external-token: your_secure_external_api_token_here`
- **标准认证头**：`Authorization: Bearer your_secure_external_api_token_here`

---

## 二、 接口列表与调用示例

接口根路径前缀为 `/api/v1/external`。

### 1. 获取项目信息

获取项目的基本属性元数据。

- **URL**：`/api/v1/external/projects/:projectId`
- **Method**：`GET`
- **Headers**：
  ```http
  x-external-token: your_secure_external_api_token_here
  ```
- **响应示例 (`200 OK`)**：
  ```json
  {
    "id": "project_id_1", // 项目（Stream）唯一标识符 ID
    "name": "某地块BIM综合工程项目", // 项目名称
    "description": "这是项目描述信息...", // 项目描述信息（可为空）
    "isPublic": true, // 项目是否公开（对非项目成员可见）
    "createdAt": "2026-06-01T00:00:00.000Z", // 项目创建时间（ISO 8601 格式时间戳）
    "updatedAt": "2026-06-08T00:00:00.000Z" // 项目最近更新时间（ISO 8601 格式时间戳）
  }
  ```

#### 字段说明

| 字段名          | 类型           | 说明                                    |
| :-------------- | :------------- | :-------------------------------------- |
| **id**          | string         | 项目（Stream）唯一标识符 ID             |
| **name**        | string         | 项目名称                                |
| **description** | string \| null | 项目描述信息                            |
| **isPublic**    | boolean        | 项目是否公开（对非项目成员可见）        |
| **createdAt**   | string         | 项目创建时间（ISO 8601 格式时间戳）     |
| **updatedAt**   | string         | 项目最近更新时间（ISO 8601 格式时间戳） |

---

### 2. 获取进度计划任务树

获取经树形加权聚合计算后的项目完整进度计划任务树。

- **URL**：`/api/v1/external/projects/:projectId/progress/plan-tasks`
- **Method**：`GET`
- **Headers**：
  ```http
  x-external-token: your_secure_external_api_token_here
  ```
- **响应示例 (`200 OK`)**：
  ```json
  {
    "projectId": "project_id_1", // 项目唯一标识符 ID
    "planTasks": [
      // 进度计划任务节点列表
      {
        "id": "task_id_root", // 计划任务在系统内的唯一标识符 ID
        "projectId": "project_id_1", // 关联的项目 ID
        "planFileId": "file_123", // 导入此进度计划所用的 MPP 原始文件关联 ID
        "externalId": null, // 在原 MPP 计划文件中的任务唯一标识符（UID）
        "wbs": "1", // 进度计划任务的 WBS 树形大纲编码（例如 "1.2.3"）
        "taskName": "基础工程", // 任务名称
        "parentId": null, // 父级任务的系统内唯一标识符 ID，为空表示根任务
        "level": 0, // 任务节点所处的树形层级（从 0 开始）
        "sortOrder": 1, // 任务节点在大纲中的排序顺序序号
        "duration": "10d", // 任务工期（例如 "10d" 表示 10 天）
        "startDate": "2026-06-01T00:00:00.000Z", // 计划开始日期（ISO 8601 格式时间戳）
        "endDate": "2026-06-10T00:00:00.000Z", // 计划结束日期（ISO 8601 格式时间戳）
        "milestoneType": null, // 里程碑类型（'project' 项目里程碑 / 'phase' 阶段里程碑 / 'acceptance' 验收里程碑，为空表示普通任务）
        "milestoneDescription": null, // 里程碑任务的备注与详情描述信息
        "isCriticalTask": true, // 是否为项目关键路径上的紧迫任务
        "predecessor": null, // 前置任务依赖关系定义
        "inspection": null, // 关联的质量检验批标识信息
        "BIM": [
          // 关联的三维模型构件集合
          {
            "modelId": "model_1", // 关联的三维模型版本（Commit）唯一 ID
            "applicationIds": ["app_1", "app_2"], // 关联的构件在三维浏览器中的唯一构件 ID（applicationId）集合
            "bimIds": ["CB-01", "CB-02"], // 对应构件的局部唯一序号码集合（与 applicationIds 长度一一对应）
            "bimCodes": ["class_space_sec_CB-01", "class_space_sec_CB-02"] // 对应构件的第三方完整构件编码集合（与 applicationIds 长度一一对应，格式为 `分类对象代码+空间代码+分部分项代码+序号码`）
          }
        ],
        "hasChildren": true, // 该任务节点是否拥有下级子任务
        "canEditBimAssociation": false, // 是否允许手动编辑/覆盖关联的 BIM 构件（仅有叶子任务才允许，父任务由系统计算推导）
        "totalElementCount": 150, // 当前任务或其下子任务绑定的三维构件总数
        "finishedElementCount": 75, // 截至目前已完成并验收通过的构件总数
        "inProgressElementCount": 20, // 当前正在施工中的构件总数
        "notStartedElementCount": 55, // 尚未开始施工的关联构件总数
        "delayedElementCount": 10, // 因延期未按时完成的构件总数
        "completionRate": 50.0, // 该进度任务按子节点工期加权计算后的综合进度百分比完成率 (%)
        "taskStatus": "in_progress", // 该任务的当前执行状态（'not_started' 未开始 / 'in_progress' 施工中 / 'finished_on_time' 按时完成 / 'finished_delayed' 延期完成 / 'delayed' 已逾期 / 'no_bim_link' 未关联构件）
        "totalTaskCount": 5, // 当前节点下属包含的所有子任务总数（含自身）
        "linkedTaskCount": 3, // 下属子任务中已关联模型构件的子任务数
        "finishedTaskCount": 2, // 下属子任务中已完成的子任务数
        "delayedTaskCount": 1, // 下属子任务中发生延期/逾期的子任务数
        "createdAt": "2026-06-01T08:00:00.000Z", // 任务创建时间
        "updatedAt": "2026-06-08T09:00:00.000Z" // 任务最近修改时间
      }
    ]
  }
  ```

#### 字段说明

| 字段名                        | 类型             | 说明                                                                                                                                                                          |
| :---------------------------- | :--------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **projectId**                 | string           | 项目唯一标识符 ID                                                                                                                                                             |
| **planTasks**                 | Array            | 进度计划任务节点数组，每个任务节点包含以下属性：                                                                                                                              |
| ├─ **id**                     | string           | 计划任务在系统内的唯一标识符 ID                                                                                                                                               |
| ├─ **projectId**              | string           | 关联的项目 ID                                                                                                                                                                 |
| ├─ **planFileId**             | string           | 导入此进度计划所用的 MPP 原始文件关联 ID                                                                                                                                      |
| ├─ **externalId**             | string \| null   | 在原 MPP 计划文件中的任务唯一标识符（UID）                                                                                                                                    |
| ├─ **wbs**                    | string \| null   | 进度计划任务的 WBS 树形大纲编码（例如 "1.2.3"）                                                                                                                               |
| ├─ **taskName**               | string           | 任务名称                                                                                                                                                                      |
| ├─ **parentId**               | string \| null   | 父级任务的系统内唯一标识符 ID，为空表示根任务                                                                                                                                 |
| ├─ **level**                  | number           | 任务节点所处的树形层级（从 0 开始）                                                                                                                                           |
| ├─ **sortOrder**              | number           | 任务节点在大纲中的排序顺序序号                                                                                                                                                |
| ├─ **duration**               | string \| null   | 任务工期（例如 "10d" 表示 10 天）                                                                                                                                             |
| ├─ **startDate**              | string \| null   | 计划开始日期（ISO 8601 格式）                                                                                                                                                 |
| ├─ **endDate**                | string \| null   | 计划结束日期（ISO 8601 格式）                                                                                                                                                 |
| ├─ **milestoneType**          | string \| null   | 里程碑类型（'project' 项目里程碑 / 'phase' 阶段里程碑 / 'acceptance' 验收里程碑，为空表示普通任务）                                                                           |
| ├─ **milestoneDescription**   | string \| null   | 里程碑任务的备注与详情描述信息                                                                                                                                                |
| ├─ **isCriticalTask**         | boolean          | 是否为项目关键路径上的紧迫任务                                                                                                                                                |
| ├─ **predecessor**            | string \| null   | 前置任务依赖关系定义                                                                                                                                                          |
| ├─ **inspection**             | string \| null   | 关联的质量检验批标识信息                                                                                                                                                      |
| ├─ **BIM**                    | Array            | 关联的三维模型构件集合，每个条目包含：                                                                                                                                        |
| │ ├─ **modelId**              | string           | 关联的三维模型版本（Commit）唯一 ID                                                                                                                                           |
| │ ├─ **applicationIds**       | string[]         | 该模型下关联的构件在三维浏览器中的唯一构件 ID（applicationId）集合                                                                                                            |
| │ ├─ **bimIds**               | (string\|null)[] | 对应构件的局部唯一**序号码**集合（与 applicationIds 长度一一对应）                                                                                                            |
| │ └─ **bimCodes**             | (string\|null)[] | 对应构件的第三方**完整构件编码**集合（与 applicationIds 长度一一对应，格式为 `分类对象代码+空间代码+分部分项代码+序号码`）                                                    |
| ├─ **hasChildren**            | boolean          | 该任务节点是否拥有下级子任务                                                                                                                                                  |
| ├─ **canEditBimAssociation**  | boolean          | 是否允许手动编辑/覆盖关联的 BIM 构件（仅有叶子任务才允许，父任务由系统计算推导）                                                                                              |
| ├─ **totalElementCount**      | number           | 当前任务或其下子任务绑定的三维构件总数                                                                                                                                        |
| ├─ **finishedElementCount**   | number           | 截至目前已完成并验收通过的构件总数                                                                                                                                            |
| ├─ **inProgressElementCount** | number           | 当前正在施工中的构件总数                                                                                                                                                      |
| ├─ **notStartedElementCount** | number           | 尚未开始施工的关联构件总数                                                                                                                                                    |
| ├─ **delayedElementCount**    | number           | 因延期未按时完成的构件总数                                                                                                                                                    |
| ├─ **completionRate**         | number           | 该进度任务按子节点工期加权计算后的综合进度百分比完成率 (%)                                                                                                                    |
| ├─ **taskStatus**             | string \| null   | 该任务的当前执行状态（'not_started' 未开始 / 'in_progress' 施工中 / 'finished_on_time' 按时完成 / 'finished_delayed' 延期完成 / 'delayed' 已逾期 / 'no_bim_link' 未关联构件） |
| ├─ **totalTaskCount**         | number           | 当前节点下属包含的所有子任务总数（含自身）                                                                                                                                    |
| ├─ **linkedTaskCount**        | number           | 下属子任务中已关联模型构件的子任务数                                                                                                                                          |
| ├─ **finishedTaskCount**      | number           | 下属子任务中已完成的子任务数                                                                                                                                                  |
| ├─ **delayedTaskCount**       | number           | 下属子任务中发生延期/逾期的子任务数                                                                                                                                           |
| ├─ **createdAt**              | string           | 任务创建时间                                                                                                                                                                  |
| └─ **updatedAt**              | string           | 任务最近修改时间                                                                                                                                                              |

---

### 3. 获取实际进度汇报记录

获取该项目下的实际进度汇报历史列表（按日期倒序）。

- **URL**：`/api/v1/external/projects/:projectId/progress/actual-records`
- **Method**：`GET`
- **Headers**：
  ```http
  x-external-token: your_secure_external_api_token_here
  ```
- **响应示例 (`200 OK`)**：
  ```json
  {
    "projectId": "project_id_1", // 项目唯一标识符 ID
    "actualRecords": [
      // 实际进度汇报记录列表
      {
        "id": "record_id_1", // 实际填报记录的唯一标识符 ID
        "projectId": "project_id_1", // 关联的项目 ID
        "taskName": "地基浇筑", // 汇报的任务名称
        "year": "2026", // 汇报的日历年份（如 "2026"）
        "month": "06", // 汇报的日历月份（如 "06"）
        "day": "05", // 汇报的日历日期（如 "05"）
        "weekDay": "星期五", // 汇报日期的星期几（如 "星期五"）
        "reportDate": "2026-06-05", // 汇报日期（格式为 "YYYY-MM-DD"）
        "startElementCodes": "E-001、E-002", // 今日开始施工的构件列表文本汇总（逗号或顿号拼接）
        "finishElementCodes": "E-001", // 今日完成施工的构件列表文本汇总（逗号或顿号拼接）
        "startBIM": [
          // 今日开始施工关联的 BIM 模型构件列表
          {
            "modelId": "model_1", // 关联的模型版本唯一 ID
            "applicationIds": ["app_1", "app_2"], // 关联的构件在三维浏览器中的唯一构件 ID（applicationId）集合
            "bimIds": ["CB-01", "CB-02"], // 对应构件的局部唯一序号码集合（与 applicationIds 长度一一对应）
            "bimCodes": ["class_space_sec_CB-01", "class_space_sec_CB-02"] // 对应构件的第三方完整构件编码集合（与 applicationIds 长度一一对应，格式为 `分类对象代码+空间代码+分部分项代码+序号码`）
          }
        ],
        "finishBIM": [], // 今日完成施工关联的 BIM 模型构件列表（结构同上，为空表示无今日完成关联）
        "remark": "基坑排水正常，混凝土浇筑按计划推进", // 填报备注信息
        "highTemperature": "32℃", // 当日最高气温描述（如 "32℃"）
        "lowTemperature": "21℃", // 当日最低气温描述（如 "21℃"）
        "morningWeather": "晴", // 上午天气情况（如 "晴"）
        "afternoonWeather": "多云", // 下午天气情况（如 "多云"）
        "nightCondition": "正常", // 夜间施工环境或施工状态说明（如 "正常"）
        "constructionRecord": "完成基坑垫层浇筑", // 现场生产施工进展记录内容
        "qualityRecord": "坍落度检测符合要求", // 质量检测、抽检结果记录
        "safetyRecord": "现场防护到位，无安全隐患", // 安全巡检、隐患排查记录
        "mortarConcreteSampleRecord": "回弹试块留置3组", // 砂浆、混凝土试件留置记录情况
        "materialEquipmentRecord": "商品砼泵车1台在场", // 材料与机械设备进场/在场情况记录
        "siteAppearanceRecord": "场地整洁", // 施工现场形象面貌、卫生状况描述
        "overtimeRecord": "无", // 加班与夜间施工审批记录情况
        "otherRecord": "", // 其它未尽的重要现场情况记录
        "siteLeader": "张工", // 施工现场负责人（如 "张工"）
        "reporter": "李工", // 日志填报/记录人姓名
        "constructionLog": "日志详情...", // 自动汇总的日志详情文本
        "createdAt": "2026-06-05T17:30:00.000Z", // 填报记录创建时间
        "updatedAt": "2026-06-05T17:35:00.000Z" // 填报记录最近更新时间
      }
    ]
  }
  ```

#### 字段说明

| 字段名                            | 类型           | 说明                                                                                            |
| :-------------------------------- | :------------- | :---------------------------------------------------------------------------------------------- |
| **projectId**                     | string         | 项目唯一标识符 ID                                                                               |
| **actualRecords**                 | Array          | 实际进度填报汇报记录数组，每个记录包含：                                                        |
| ├─ **id**                         | string         | 实际填报记录的唯一标识符 ID                                                                     |
| ├─ **projectId**                  | string         | 关联的项目 ID                                                                                   |
| ├─ **taskName**                   | string         | 汇报的任务名称                                                                                  |
| ├─ **year**                       | string         | 汇报的日历年份（如 "2026"）                                                                     |
| ├─ **month**                      | string         | 汇报的日历月份（如 "06"）                                                                       |
| ├─ **day**                        | string         | 汇报的日历日期（如 "05"）                                                                       |
| ├─ **weekDay**                    | string         | 汇报日期的星期几（如 "星期五"）                                                                 |
| ├─ **reportDate**                 | string         | 汇报日期（格式为 "YYYY-MM-DD"）                                                                 |
| ├─ **startElementCodes**          | string         | 今日开始施工的构件列表文本汇总（逗号或顿号拼接）                                                |
| ├─ **finishElementCodes**         | string         | 今日完成施工的构件列表文本汇总（逗号或顿号拼接）                                                |
| ├─ **startBIM**                   | Array          | 今日开始施工关联的 BIM 模型构件列表（结构同上，含 modelId、applicationIds、bimIds 及 bimCodes） |
| ├─ **finishBIM**                  | Array          | 今日完成施工关联的 BIM 模型构件列表（结构同上，含 modelId、applicationIds、bimIds 及 bimCodes） |
| ├─ **remark**                     | string \| null | 填报备注信息                                                                                    |
| ├─ **highTemperature**            | string \| null | 当日最高气温描述（如 "32℃"）                                                                    |
| ├─ **lowTemperature**             | string \| null | 当日最低气温描述（如 "21℃"）                                                                    |
| ├─ **morningWeather**             | string \| null | 上午天气情况（如 "晴"）                                                                         |
| ├─ **afternoonWeather**           | string \| null | 下午天气情况（如 "多云"）                                                                       |
| ├─ **nightCondition**             | string \| null | 夜间施工环境或施工状态说明（如 "正常"）                                                         |
| ├─ **constructionRecord**         | string \| null | 现场生产施工进展记录内容                                                                        |
| ├─ **qualityRecord**              | string \| null | 质量检测、抽检结果记录                                                                          |
| ├─ **safetyRecord**               | string \| null | 安全巡检、隐患排查记录                                                                          |
| ├─ **mortarConcreteSampleRecord** | string \| null | 砂浆、混凝土试件留置记录情况                                                                    |
| ├─ **materialEquipmentRecord**    | string \| null | 材料与机械设备进场/在场情况记录                                                                 |
| ├─ **siteAppearanceRecord**       | string \| null | 施工现场形象面貌、卫生状况描述                                                                  |
| ├─ **overtimeRecord**             | string \| null | 加班与夜间施工审批记录情况                                                                      |
| ├─ **otherRecord**                | string \| null | 其它未尽的重要现场情况记录                                                                      |
| ├─ **siteLeader**                 | string \| null | 施工现场负责人（如 "张工"）                                                                     |
| ├─ **reporter**                   | string \| null | 日志填报/记录人姓名                                                                             |
| ├─ **constructionLog**            | string \| null | 自动汇总的日志详情文本                                                                          |
| ├─ **createdAt**                  | string         | 填报记录创建时间                                                                                |
| └─ **updatedAt**                  | string         | 填报记录最近更新时间                                                                            |

---

### 4. 获取质量验收记录列表

获取项目下已有的质量验收表单列表。

- **URL**：`/api/v1/external/projects/:projectId/quality-acceptance/forms`
- **Method**：`GET`
- **Query Parameters**：
  - `limit` _(optional)_：分页条数限制，默认 `25`，最大支持 `100`。
  - `cursor` _(optional)_：用于分页的游标（例如上一页返回的 `cursor` 串）。
  - `search` _(optional)_：模糊搜索关键字（匹配名称、编码、检验批编号、验收部位及验收内容）。
- **Headers**：
  ```http
  x-external-token: your_secure_external_api_token_here
  ```
- **响应示例 (`200 OK`)**：
  ```json
  {
    "totalCount": 1, // 符合筛选条件的质量验收表单总记录数
    "cursor": "2026-06-05T18:00:00.000Z|form_id_123", // 用于分页的游标（当拥有下一页数据时返回）
    "items": [
      // 质量验收表单列表
      {
        "id": "form_id_123", // 质量验收表单系统内唯一 ID
        "projectId": "project_id_1", // 表单关联的项目 ID
        "boqItemId": "boq_item_99", // 关联的工程量清单（BOQ）行唯一标识符 ID
        "name": "地基防水分项工程质量验收", // 验收表单的名称
        "code": "QA-2026-009", // 验收单编码
        "inspectionLotNumber": "LOT-DB-002", // 绑定的建筑检验批编号
        "acceptancePart": "基础底板", // 验收部位（区域、层数、构件区间等）
        "acceptanceContent": "卷材防水层外观及搭接长度检查", // 具体的验收核验内容描述
        "actualStartDate": "2026-06-04T00:00:00.000Z", // 施工/验收的开始时间（ISO 8601 格式时间戳）
        "actualFinishDate": "2026-06-05T00:00:00.000Z", // 验收通过/完成日期时间
        "inspectorId": "user_id_inspector", // 负责现场验收的质检人/监理人用户 ID
        "creatorId": "user_id_creator", // 表单创建人的用户 ID
        "workVolume": 1200.5, // 验收的工程量数值
        "unit": "㎡", // 清单工程量单位（如 "㎡"、"m³" 等）
        "BIM": [
          // 关联的 BIM 模型构件集合
          {
            "modelId": "model_防水_1", // 关联的 Speckle 模型版本唯一 ID
            "applicationIds": ["app_b_01", "app_b_02"], // 关联的构件在三维浏览器中的唯一构件 ID（applicationId）集合
            "bimIds": ["CB-01", "CB-02"], // 对应构件的局部唯一序号码集合（与 applicationIds 长度一一对应）
            "bimCodes": ["class_space_sec_CB-01", "class_space_sec_CB-02"] // 对应构件的第三方完整构件编码集合（与 applicationIds 长度一一对应，格式为 `分类对象代码+空间代码+分部分项代码+序号码`）
          }
        ],
        "approveStatus": "APPROVED", // 绑定的审批流月度验工审核状态（'PENDING' / 'APPROVED' / 'REJECTED' / 'CANCELED'，为空表示表单未送审）
        "attachments": [
          // 该验收表单下挂载的图片、PDF 等附件安全下载链接列表
          "http://localhost:3000/api/v1/external/projects/project_id_1/blobs/blob_file_id_888?expires=1686389623000&signature=a59f518e3..."
        ],
        "createdAt": "2026-06-05T10:00:00.000Z", // 表单创建时间
        "updatedAt": "2026-06-05T18:00:00.000Z" // 表单最近更新时间
      }
    ]
  }
  ```

#### 字段说明

| 字段名                     | 类型           | 说明                                                                                                                                  |
| :------------------------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **totalCount**             | number         | 符合筛选条件的质量验收表单总记录数                                                                                                    |
| **cursor**                 | string \| null | 分页游标。当拥有下一页数据时返回，请求下一页时需将其传入 `cursor` Query 参数中                                                        |
| **items**                  | Array          | 质量验收单数组，每张表单包含属性如下：                                                                                                |
| ├─ **id**                  | string         | 质量验收表单系统内唯一 ID                                                                                                             |
| ├─ **projectId**           | string         | 表单关联的项目 ID                                                                                                                     |
| ├─ **boqItemId**           | string \| null | 关联的工程量清单（BOQ）行唯一标识符 ID                                                                                                |
| ├─ **name**                | string         | 验收表单的名称                                                                                                                        |
| ├─ **code**                | string \| null | 验收单编码                                                                                                                            |
| ├─ **inspectionLotNumber** | string         | 绑定的建筑检验批编号                                                                                                                  |
| ├─ **acceptancePart**      | string         | 验收部位（区域、层数、构件区间等）                                                                                                    |
| ├─ **acceptanceContent**   | string \| null | 具体的验收核验内容描述                                                                                                                |
| ├─ **actualStartDate**     | string \| null | 施工/验收的开始时间（ISO 8601 格式时间戳）                                                                                            |
| ├─ **actualFinishDate**    | string         | 验收通过/完成日期时间（即验收通过时间）                                                                                               |
| ├─ **inspectorId**         | string \| null | 负责现场验收的质检人/监理人用户 ID                                                                                                    |
| ├─ **creatorId**           | string         | 表单创建人的用户 ID                                                                                                                   |
| ├─ **workVolume**          | number         | 验收的工程量量数值                                                                                                                    |
| ├─ **unit**                | string \| null | 清单工程量单位（如 "㎡"、"m³" 等）                                                                                                    |
| ├─ **BIM**                 | Array          | 关联的 BIM 模型构件集合（结构同上，含 modelId、applicationIds、bimIds 及 bimCodes 字段）                                              |
| ├─ **approveStatus**       | string \| null | 绑定的审批流月度验工审核状态（如 'PENDING' 审批中 / 'APPROVED' 审批通过 / 'REJECTED' 被退回 / 'CANCELED' 被撤销，为空表示表单未送审） |
| ├─ **attachments**         | string[]       | 该验收表单下挂载的图片、PDF 等附件安全下载链接列表                                                                                    |
| ├─ **createdAt**           | string         | 表单创建时间                                                                                                                          |
| └─ **updatedAt**           | string         | 表单更新时间                                                                                                                          |

> [!NOTE]
> 在返回的 `items` 中，原来的 `attachments` 附件 ID 列表已由服务器自动解析，转换为了包含 **24 小时有效期限和数字防伪签名** 的免登录绝对下载链接。

### 5. 根据构件编码查询质量验收信息

根据传入的构件编码数组（`componentCodes`），查询绑定的质量验收表单信息。支持通过 `project_id` 和 `model_id` 进行条件限定；若不提供这两个参数，则自动执行全库全量遍历查询。

- **URL**：
  - `/api/v1/external/quality-acceptance/by-component-codes` _(推荐)_
  - `/api/v1/external/projects/:projectId/quality-acceptance/by-component-codes` _(兼顾带 projectId 路径)_
- **Method**：`POST`
- **Headers**：（选其一提供有效的 API Token）
  - `x-external-token: your_secure_external_api_token_here`
  - `Authorization: Bearer your_secure_external_api_token_here`
- **Request Body (JSON)**：

  ```json
  {
    "project_id": "project_id_1", // (可选) 限定项目 ID，不传则全量遍历
    "model_id": "model_id_1", // (可选) 限定模型/版本 ID，不传则全量遍历
    "componentCodes": [
      // (必填) 构件编码数组
      "class_space_sec_CB-01",
      "class_space_sec_CB-02"
    ]
  }
  ```

- **响应示例 (`200 OK`)**：

  ```json
  {
    "projectId": "project_id_1", // 若请求未传则为 null
    "modelId": "model_id_1", // 若请求未传则为 null
    "results": [
      // 每个构件编码对应的质量验收表单列表
      {
        "componentCode": "class_space_sec_CB-01",
        "forms": [
          {
            "id": "form_id_123",
            "projectId": "project_id_1",
            "boqItemId": "boq_item_99",
            "name": "地基防水分项工程质量验收",
            "code": "QA-2026-009",
            "inspectionLotNumber": "LOT-DB-002",
            "acceptancePart": "基础底板",
            "acceptanceContent": "卷材防水层外观及搭接长度检查",
            "actualStartDate": "2026-06-04T00:00:00.000Z",
            "actualFinishDate": "2026-06-05T00:00:00.000Z",
            "acceptanceTime": "2026-06-05T00:00:00.000Z",
            "inspectorId": "user_id_inspector",
            "creatorId": "user_id_creator",
            "workVolume": 1200.5,
            "unit": "㎡",
            "BIM": [
              {
                "modelId": "model_id_1",
                "applicationIds": ["app_b_01"],
                "bimIds": ["CB-01"],
                "bimCodes": ["class_space_sec_CB-01"]
              }
            ],
            "approveStatus": "APPROVED",
            "attachments": [
              "http://localhost:3000/api/v1/external/projects/project_id_1/blobs/blob_file_id_888?expires=1686389623000&signature=a59f518e3..."
            ],
            "createdAt": "2026-06-05T10:00:00.000Z",
            "updatedAt": "2026-06-05T18:00:00.000Z"
          }
        ]
      }
    ]
  }
  ```

- **错误响应示例**：
  - **401 Unauthorized（缺少或无效 Token）**：
    ```json
    {
      "error": "Unauthorized: Invalid or missing external API token."
    }
    ```
  - **400 Bad Request（未传 componentCodes 或非数组）**：
    ```json
    {
      "error": "Invalid request: componentCodes is required and must be an array."
    }
    ```

---

## 三、 免登录附件下载机制

对于数据同步给第三方系统后的文件查看需求，我们提供了限时免登录下载机制。

### 1. 链接结构

`/api/v1/external/projects/:projectId/blobs/:blobId?expires=<timestamp>&signature=<hmac_signature>`

- `expires`：到期时间戳（从生成时间起 24 小时后，单位：毫秒）。
- `signature`：数字防伪签名。服务端利用 `SESSION_SECRET` 作为加密盐值，对 `projectId`、`blobId`、`expires` 拼接串运行 HMAC-SHA256 算法生成签名，防止被篡改。

### 2. 校验流程

当第三方直接点击或使用该链接请求文件时：

1. **无需**在 Header 携带 `x-external-token`。
2. 校验 URL 中的过期时间 `expires` 是否在当前时间之后。
3. 校验 `signature` 串与服务端使用相同密钥计算的值是否 100% 吻合。
4. 校验通过，服务端直接将该文件从项目对象存储（如 MinIO/S3）中以文件流的形式响应给客户端下载。
