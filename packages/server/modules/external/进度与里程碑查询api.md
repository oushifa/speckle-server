# 进度信息与里程碑信息查询 API 使用文档

本文档详细说明如何通过外部接口（External API）按项目查询**进度信息**与**里程碑信息**：

- **进度信息**：任务名称、构件编码、计划开始/结束时间、实际开始/结束时间、备注；
- **里程碑信息**：仅返回标签（`tags`）中包含 `milestone` 的里程碑，包含任务名称、计划开始/结束时间、实际开始/结束时间、当前状态、备注。

---

## 1. 接口基本信息

| 接口名称       | 接口路径                                                          | 请求方式 | 说明                                                    |
| :------------- | :---------------------------------------------------------------- | :------- | :------------------------------------------------------ |
| 进度信息查询   | `/api/v1/external/projects/:projectId/progress-v2/actual-records` | `GET`    | 查询项目「进度管理」中登记的全部进度填报记录            |
| 里程碑信息查询 | `/api/v1/external/projects/:projectId/progress-v2/milestones`     | `GET`    | 查询项目「进度管理」中标签包含 `milestone` 的里程碑记录 |

- **数据格式**：`Accept: application/json`
- **数据来源**：均为项目「进度管理」模块的数据（进度填报记录 / 里程碑），按项目（`projectId`）隔离查询。

---

## 2. 身份认证说明

两个接口均需携带预先配置的外部 API 令牌（服务器环境变量 `EXTERNAL_API_TOKEN`）。客户端支持以下三种认证方式之一：

| 认证方式                 | Header / Parameter | 示例值                                                      |
| :----------------------- | :----------------- | :---------------------------------------------------------- |
| **自定义 Header (推荐)** | `x-external-token` | `x-external-token: your_secure_external_api_token_here`     |
| **标准 Bearer Header**   | `Authorization`    | `Authorization: Bearer your_secure_external_api_token_here` |
| **URL Query 参数**       | `token`            | `?token=your_secure_external_api_token_here`                |

> [!CAUTION]
> 若请求未携带 Token，或提供的 Token 与服务器配置不匹配，接口将返回 `401 Unauthorized` 错误。
> 若服务器未配置 `EXTERNAL_API_TOKEN` 环境变量，则返回 `500 Internal Server Error`。

---

## 3. 接口一：进度信息查询

查询项目下登记的全部进度填报记录，按填报日期倒序返回。

### 3.1 请求参数

#### Path Parameters

| 属性名          | 类型     | 是否必填 | 描述                        |
| :-------------- | :------- | :------- | :-------------------------- |
| **`projectId`** | `string` | **是**   | 项目（Stream）唯一标识符 ID |

#### Query Parameters

| 属性名       | 类型     | 是否必填 | 默认值 | 描述                                                        |
| :----------- | :------- | :------- | :----- | :---------------------------------------------------------- |
| **`search`** | `string` | 否       | -      | 模糊搜索关键字（匹配任务名称、填报人）                      |
| **`token`**  | `string` | 否       | -      | 认证令牌（当未在 Header 中携带 Token 时，可通过该参数传递） |

### 3.2 请求示例 (Request)

```http
GET /api/v1/external/projects/project_id_1/progress-v2/actual-records?search=钢筋 HTTP/1.1
Host: http://your-server-domain:3000
x-external-token: your_secure_external_api_token_here
```

### 3.3 成功响应示例 (`200 OK`)

```json
{
  "projectId": "project_id_1",
  "totalCount": 2,
  "progressRecords": [
    {
      "id": "v2act_man1",
      "projectId": "project_id_1",
      "taskName": "地下一层顶板钢筋绑扎",
      "componentCode": "CB1-99",
      "componentCodes": ["CB1-99", "14-94.04.01.00.00.1NB01010101CB1-99"],
      "planStartDate": "2026-09-01T00:00:00.000Z",
      "planEndDate": "2026-09-10T00:00:00.000Z",
      "actualStartDate": "2026-09-02T00:00:00.000Z",
      "actualEndDate": "2026-09-12T00:00:00.000Z",
      "remark": "受降雨影响顺延一天"
    },
    {
      "id": "v2act_res1",
      "projectId": "project_id_1",
      "taskName": "地下一层顶板混凝土浇筑",
      "componentCode": null,
      "componentCodes": ["14-94.04.01.00.00.1NB01010101CB1-77"],
      "planStartDate": "2026-09-04T00:00:00.000Z",
      "planEndDate": "2026-09-08T00:00:00.000Z",
      "actualStartDate": null,
      "actualEndDate": null,
      "remark": null
    }
  ]
}
```

### 3.4 响应字段说明

| 字段名                   | 类型             | 说明                                                                                                                                                                                                            |
| :----------------------- | :--------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`projectId`**          | `string`         | 项目（Stream）唯一标识符 ID                                                                                                                                                                                     |
| **`totalCount`**         | `number`         | 本次返回的进度信息记录总数                                                                                                                                                                                      |
| **`progressRecords`**    | `Array`          | 进度信息记录列表，按填报日期倒序排列，每条记录字段如下：                                                                                                                                                        |
| ├─ **`id`**              | `string`         | 进度填报记录唯一标识符 ID                                                                                                                                                                                       |
| ├─ **`projectId`**       | `string`         | 关联的项目 ID                                                                                                                                                                                                   |
| ├─ **`taskName`**        | `string`         | 任务名称                                                                                                                                                                                                        |
| ├─ **`componentCode`**   | `string \| null` | 记录上手填/导入的构件编码（通常为序号码），未填写时为 `null`                                                                                                                                                    |
| ├─ **`componentCodes`**  | `string[]`       | 该记录关联的全部构件编码（已去重）。取值顺序为：记录上的构件编码 → 关联 BIM 构件已存储的编码 → 按构件 ID 反查得到的第三方完整构件编码（格式为 `分类对象代码+空间代码+分部分项代码+序号码`），均无匹配时为空数组 |
| ├─ **`planStartDate`**   | `string \| null` | 计划开始时间（ISO 8601 格式时间戳，UTC）                                                                                                                                                                        |
| ├─ **`planEndDate`**     | `string \| null` | 计划结束时间（ISO 8601 格式时间戳，UTC）                                                                                                                                                                        |
| ├─ **`actualStartDate`** | `string \| null` | 实际开始时间（ISO 8601 格式时间戳，UTC）                                                                                                                                                                        |
| ├─ **`actualEndDate`**   | `string \| null` | 实际结束时间（ISO 8601 格式时间戳，UTC）                                                                                                                                                                        |
| └─ **`remark`**          | `string \| null` | 备注说明                                                                                                                                                                                                        |

> [!NOTE] > **构件编码解析规则**：优先取记录上直接存储的 `componentCode` 与关联 BIM 构件中已保存的构件编码；若关联构件未保存编码，则服务端会按构件 ID（`applicationId` / Revit UniqueId / 对象 ID）在项目模型中反查第三方完整构件编码。反查仅在存在未解析构件时触发，不影响常规查询性能。

---

## 4. 接口二：里程碑信息查询

查询项目下的里程碑记录，**仅返回标签（`tags`）中包含 `milestone` 的记录**，按计划结束时间升序返回。

### 4.1 请求参数

#### Path Parameters

| 属性名          | 类型     | 是否必填 | 描述                        |
| :-------------- | :------- | :------- | :-------------------------- |
| **`projectId`** | `string` | **是**   | 项目（Stream）唯一标识符 ID |

#### Query Parameters

| 属性名       | 类型     | 是否必填 | 默认值 | 描述                                                        |
| :----------- | :------- | :------- | :----- | :---------------------------------------------------------- |
| **`search`** | `string` | 否       | -      | 模糊搜索关键字（匹配里程碑名称、负责人）                    |
| **`token`**  | `string` | 否       | -      | 认证令牌（当未在 Header 中携带 Token 时，可通过该参数传递） |

### 4.2 请求示例 (Request)

```http
GET /api/v1/external/projects/project_id_1/progress-v2/milestones HTTP/1.1
Host: http://your-server-domain:3000
x-external-token: your_secure_external_api_token_here
```

### 4.3 成功响应示例 (`200 OK`)

```json
{
  "projectId": "project_id_1",
  "totalCount": 1,
  "milestones": [
    {
      "id": "v2ms_ok1",
      "projectId": "project_id_1",
      "taskName": "主体结构封顶",
      "plannedStart": "2026-10-01T00:00:00.000Z",
      "plannedEnd": "2026-10-31T00:00:00.000Z",
      "actualStart": "2026-10-03T00:00:00.000Z",
      "actualEnd": null,
      "status": "进行中",
      "remark": "受材料到场时间影响",
      "tags": ["milestone"]
    }
  ]
}
```

### 4.4 响应字段说明

| 字段名                | 类型             | 说明                                                                         |
| :-------------------- | :--------------- | :--------------------------------------------------------------------------- |
| **`projectId`**       | `string`         | 项目（Stream）唯一标识符 ID                                                  |
| **`totalCount`**      | `number`         | 本次返回的里程碑记录总数                                                     |
| **`milestones`**      | `Array`          | 里程碑记录列表，按计划结束时间升序排列，每条记录字段如下：                   |
| ├─ **`id`**           | `string`         | 里程碑唯一标识符 ID                                                          |
| ├─ **`projectId`**    | `string`         | 关联的项目 ID                                                                |
| ├─ **`taskName`**     | `string`         | 里程碑（任务）名称                                                           |
| ├─ **`plannedStart`** | `string \| null` | 计划开始时间（ISO 8601 格式时间戳，UTC）                                     |
| ├─ **`plannedEnd`**   | `string \| null` | 计划结束时间（ISO 8601 格式时间戳，UTC）                                     |
| ├─ **`actualStart`**  | `string \| null` | 实际开始时间（ISO 8601 格式时间戳，UTC）                                     |
| ├─ **`actualEnd`**    | `string \| null` | 实际结束时间（ISO 8601 格式时间戳，UTC）                                     |
| ├─ **`status`**       | `string \| null` | 当前状态（`未开始` / `进行中` / `按期完成` / `逾期完成` / `已逾期`）         |
| ├─ **`remark`**       | `string \| null` | 备注说明                                                                     |
| └─ **`tags`**         | `string[]`       | 标签集合，仅返回包含 `milestone` 标签的记录（例如同时含 `key` 关键节点标签） |

> [!NOTE] > **标签过滤规则**：里程碑记录在系统中可被打上多个标签（如 `milestone` 里程碑、`key` 关键节点）。本接口按需求**只返回标签中包含 `milestone` 的记录**，且标签匹配不区分大小写；仅打 `key` 等其它标签、或未打标签的记录不会出现在响应中。

---

## 5. 需求字段对照表

| 需求字段     | 进度信息响应字段                   | 里程碑信息响应字段        |
| :----------- | :--------------------------------- | :------------------------ |
| 任务名称     | `taskName`                         | `taskName`                |
| 构件编码     | `componentCode` / `componentCodes` | -（里程碑不涉及构件编码） |
| 计划开始时间 | `planStartDate`                    | `plannedStart`            |
| 计划结束时间 | `planEndDate`                      | `plannedEnd`              |
| 实际开始时间 | `actualStartDate`                  | `actualStart`             |
| 实际结束时间 | `actualEndDate`                    | `actualEnd`               |
| 当前状态     | -（进度记录不含状态字段）          | `status`                  |
| 备注         | `remark`                           | `remark`                  |

---

## 6. 错误码与提示信息

| HTTP 状态码                     | 错误提示示例                                                        | 原因说明                                             | 解决建议                                                                           |
| :------------------------------ | :------------------------------------------------------------------ | :--------------------------------------------------- | :--------------------------------------------------------------------------------- |
| **`401 Unauthorized`**          | `{"error": "Unauthorized: Invalid or missing external API token."}` | 未提供 Token，或 Token 与服务端不匹配                | 检查请求 Header（`x-external-token` / `Authorization`）或 `token` 参数是否配置正确 |
| **`404 Not Found`**             | `{"error": "Project not found."}`                                   | `projectId` 对应的项目不存在                         | 检查传入的 `projectId` 是否正确                                                    |
| **`500 Internal Server Error`** | `{"error": "EXTERNAL_API_TOKEN is not configured on the server."}`  | 服务端运行环境中未设置 `EXTERNAL_API_TOKEN` 环境变量 | 请系统管理员在服务器环境变量中添加 `EXTERNAL_API_TOKEN`                            |

---

## 7. 代码调用示例

### 7.1 cURL

```bash
# 进度信息
curl -X GET "http://your-server-domain:3000/api/v1/external/projects/project_id_1/progress-v2/actual-records" \
  -H "Authorization: Bearer your_secure_external_api_token_here"

# 里程碑信息
curl -X GET "http://your-server-domain:3000/api/v1/external/projects/project_id_1/progress-v2/milestones" \
  -H "Authorization: Bearer your_secure_external_api_token_here"
```

### 7.2 JavaScript (Fetch API)

```javascript
const headers = { 'x-external-token': 'your_secure_external_api_token_here' }
const baseUrl =
  'http://your-server-domain:3000/api/v1/external/projects/project_id_1/progress-v2'

// 1. 查询进度信息
const progressResponse = await fetch(`${baseUrl}/actual-records`, { headers })
if (!progressResponse.ok) {
  const errorData = await progressResponse.json()
  console.error('进度信息查询失败:', errorData.error)
} else {
  const { progressRecords } = await progressResponse.json()
  console.log('进度信息:', progressRecords)
}

// 2. 查询里程碑信息
const milestoneResponse = await fetch(`${baseUrl}/milestones`, { headers })
if (!milestoneResponse.ok) {
  const errorData = await milestoneResponse.json()
  console.error('里程碑信息查询失败:', errorData.error)
} else {
  const { milestones } = await milestoneResponse.json()
  console.log('里程碑信息:', milestones)
}
```

### 7.3 Python (Requests)

```python
import requests

base_url = "http://your-server-domain:3000/api/v1/external/projects/project_id_1/progress-v2"
headers = {"Authorization": "Bearer your_secure_external_api_token_here"}

# 1. 查询进度信息
progress_resp = requests.get(f"{base_url}/actual-records", headers=headers)
if progress_resp.status_code == 200:
    for record in progress_resp.json()["progressRecords"]:
        print(record["taskName"], record["componentCodes"],
              record["planStartDate"], record["actualEndDate"], record["remark"])
else:
    print(f"错误 {progress_resp.status_code}:", progress_resp.json().get("error"))

# 2. 查询里程碑信息
milestone_resp = requests.get(f"{base_url}/milestones", headers=headers)
if milestone_resp.status_code == 200:
    for milestone in milestone_resp.json()["milestones"]:
        print(milestone["taskName"], milestone["status"], milestone["remark"])
else:
    print(f"错误 {milestone_resp.status_code}:", milestone_resp.json().get("error"))
```
