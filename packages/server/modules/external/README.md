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
    "id": "project_id_1",
    "name": "某地块BIM综合工程项目",
    "description": "这是项目描述信息...",
    "isPublic": true,
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-08T00:00:00.000Z"
  }
  ```

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
    "projectId": "project_id_1",
    "planTasks": [
      {
        "id": "task_id_root",
        "projectId": "project_id_1",
        "planFileId": "file_123",
        "externalId": null,
        "wbs": "1",
        "taskName": "基础工程",
        "parentId": null,
        "level": 0,
        "sortOrder": 1,
        "duration": "10d",
        "startDate": "2026-06-01T00:00:00.000Z",
        "endDate": "2026-06-10T00:00:00.000Z",
        "milestoneType": null,
        "milestoneDescription": null,
        "isCriticalTask": true,
        "predecessor": null,
        "inspection": null,
        "BIM": [],
        "hasChildren": true,
        "canEditBimAssociation": false,
        "totalElementCount": 150,
        "finishedElementCount": 75,
        "inProgressElementCount": 20,
        "notStartedElementCount": 55,
        "delayedElementCount": 10,
        "completionRate": 50.0,
        "taskStatus": "in_progress",
        "totalTaskCount": 5,
        "linkedTaskCount": 3,
        "finishedTaskCount": 2,
        "delayedTaskCount": 1,
        "createdAt": "2026-06-01T08:00:00.000Z",
        "updatedAt": "2026-06-08T09:00:00.000Z"
      }
    ]
  }
  ```

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
    "projectId": "project_id_1",
    "actualRecords": [
      {
        "id": "record_id_1",
        "projectId": "project_id_1",
        "taskName": "地基浇筑",
        "year": "2026",
        "month": "06",
        "day": "05",
        "weekDay": "星期五",
        "reportDate": "2026-06-05",
        "startElementCodes": "E-001、E-002",
        "finishElementCodes": "E-001",
        "startBIM": [
          {
            "modelId": "model_1",
            "applicationIds": ["app_1", "app_2"],
            "bimIds": [null, null]
          }
        ],
        "finishBIM": [],
        "remark": "基坑排水正常，混凝土浇筑按计划推进",
        "highTemperature": "32℃",
        "lowTemperature": "21℃",
        "morningWeather": "晴",
        "afternoonWeather": "多云",
        "nightCondition": "正常",
        "constructionRecord": "完成基坑垫层浇筑",
        "qualityRecord": "坍落度检测符合要求",
        "safetyRecord": "现场防护到位，无安全隐患",
        "mortarConcreteSampleRecord": "回弹试块留置3组",
        "materialEquipmentRecord": "商品砼泵车1台在场",
        "siteAppearanceRecord": "场地整洁",
        "overtimeRecord": "无",
        "otherRecord": "",
        "siteLeader": "张工",
        "reporter": "李工",
        "constructionLog": "日志详情...",
        "createdAt": "2026-06-05T17:30:00.000Z",
        "updatedAt": "2026-06-05T17:35:00.000Z"
      }
    ]
  }
  ```

---

### 4. 获取质量验收记录列表

获取项目下已有的质量验收表单列表。

- **URL**：`/api/v1/external/projects/:projectId/quality-acceptance/forms`
- **Method**：`GET`
- **Query Parameters**：
  - `limit` *(optional)*：分页条数限制，默认 `25`，最大支持 `100`。
  - `cursor` *(optional)*：用于分页的游标（例如上一页返回的 `cursor` 串）。
  - `search` *(optional)*：模糊搜索关键字（匹配名称、编码、检验批编号、验收部位及验收内容）。
- **Headers**：
  ```http
  x-external-token: your_secure_external_api_token_here
  ```
- **响应示例 (`200 OK`)**：
  ```json
  {
    "totalCount": 1,
    "cursor": "2026-06-05T18:00:00.000Z|form_id_123",
    "items": [
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
        "inspectorId": "user_id_inspector",
        "creatorId": "user_id_creator",
        "workVolume": 1200.5,
        "unit": "㎡",
        "BIM": [
          {
            "modelId": "model_防水_1",
            "applicationIds": ["app_b_01", "app_b_02"],
            "bimIds": [null, null]
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
  ```
  > [!NOTE]
  > 在返回的 `items` 中，原来的 `attachments` 附件 ID 列表已由服务器自动解析，转换为了包含 **24小时有效期限和数字防伪签名** 的免登录绝对下载链接。

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
