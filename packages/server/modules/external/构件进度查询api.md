# 根据构件编码查询进度信息 API 使用文档

本文档详细说明如何通过外部接口（External API）传入构件编码（`componentCodes`）查询该构件对应的进度信息（项目「进度管理」中登记的进度填报记录）。

---

## 1. 接口基本信息

- **接口路径**：
  - `/api/v1/external/progress/by-component-codes` _(推荐路径)_
  - `/api/v1/external/projects/:projectId/progress/by-component-codes` _(兼容带 projectId 的 URL 路径)_
- **请求方式**：`POST`
- **数据格式**：`Content-Type: application/json`
- **数据来源**：项目「进度管理」模块的进度填报记录（与按项目查询的进度信息接口 `/api/v1/external/projects/:projectId/progress-v2/actual-records` 同源，字段口径一致）

---

## 2. 身份认证说明

外部接口请求必须携带有效的认证 Token。服务器在环境变量中配置 `EXTERNAL_API_TOKEN`，客户端支持以下三种认证方式之一：

| 认证方式                 | Header / Parameter | 示例值                                                      |
| :----------------------- | :----------------- | :---------------------------------------------------------- |
| **自定义 Header (推荐)** | `x-external-token` | `x-external-token: your_secure_external_api_token_here`     |
| **标准 Bearer Header**   | `Authorization`    | `Authorization: Bearer your_secure_external_api_token_here` |
| **URL Query 参数**       | `token`            | `?token=your_secure_external_api_token_here`                |

> [!CAUTION]
> 若请求未携带 Token，或提供的 Token 与服务器配置不匹配，接口将返回 `401 Unauthorized` 错误。

---

## 3. 请求参数说明

### Request Body (JSON)

| 属性名                              | 类型             | 是否必填 | 默认值 | 描述                                                                                                                                                                          |
| :---------------------------------- | :--------------- | :------- | :----- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`componentCodes`**                | `Array<string>`  | **是**   | -      | 待查询的构件编码数组。示例：`["class_space_sec_CB-01", "class_space_sec_CB-02"]`                                                                                              |
| **`project_id`** _(或 `projectId`)_ | `string \| null` | **否**   | `null` | 项目唯一标识符 ID（Stream ID）。<br>• **传值时**：限制仅在指定的项目范围内查询；<br>• **不传/为空时**：自动全量遍历数据库中所有项目的进度填报记录（**性能较差，建议传值**）。 |
| **`model_id`** _(或 `modelId`)_     | `string \| null` | **否**   | `null` | 模型/版本 ID。<br>• **传值时**：仅保留该模型下的 BIM 构件关联参与匹配与编码反查；<br>• **不传/为空时**：不限制模型范围。                                                      |

> [!NOTE] > `project_id` / `model_id` 也可通过 URL Query 参数传入；带路径的 `/projects/:projectId/...` 变体则从路径中读取 `projectId`。

---

## 4. 请求与响应示例

### 4.1 请求示例 (Request)

```json
POST /api/v1/external/progress/by-component-codes
Host: http://your-server-domain:3000
Content-Type: application/json
x-external-token: your_secure_external_api_token_here

{
  "project_id": "project_id_1",
  "model_id": "model_id_1",
  "componentCodes": [
    "class_space_sec_CB-01",
    "class_space_sec_CB-02"
  ]
}
```

### 4.2 成功响应示例 (`200 OK`)

```json
{
  "projectId": "project_id_1",
  "modelId": "model_id_1",
  "results": [
    {
      "componentCode": "class_space_sec_CB-01",
      "progressRecords": [
        {
          "id": "record_id_1",
          "projectId": "project_id_1",
          "taskName": "地下一层顶板钢筋绑扎",
          "componentCode": "CB1-99",
          "componentCodes": ["CB1-99", "14-94.04.01.00.00.1NB01010101CB1-99"],
          "planStartDate": "2026-09-01T00:00:00.000Z",
          "planEndDate": "2026-09-10T00:00:00.000Z",
          "actualStartDate": "2026-09-02T00:00:00.000Z",
          "actualEndDate": "2026-09-12T00:00:00.000Z",
          "remark": "受降雨影响顺延一天"
        }
      ]
    },
    {
      "componentCode": "class_space_sec_CB-02",
      "progressRecords": []
    }
  ]
}
```

#### 响应字段说明

| 字段名                                           | 类型             | 说明                                                                                                                                                      |
| :----------------------------------------------- | :--------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`projectId`**                                  | `string \| null` | 请求中传入的项目 ID，全量查询时返回 `null`                                                                                                                |
| **`modelId`**                                    | `string \| null` | 请求中传入的模型 ID，未限定模型时返回 `null`                                                                                                              |
| **`results`**                                    | `Array`          | 查询结果列表，按输入的 `componentCodes` 顺序依次返回                                                                                                      |
| ├─ **`componentCode`**                           | `string`         | 构件编码                                                                                                                                                  |
| └─ **`progressRecords`**                         | `Array`          | 该构件关联的进度填报记录数组（按填报日期倒序），每条记录字段如下：                                                                                        |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`id`**              | `string`         | 进度填报记录唯一标识符 ID                                                                                                                                 |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`projectId`**       | `string`         | 记录关联的项目 ID                                                                                                                                         |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`taskName`**        | `string`         | 任务名称                                                                                                                                                  |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`componentCode`**   | `string \| null` | 记录上手填/导入的构件编码（通常为序号码），未填写时为 `null`                                                                                              |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`componentCodes`**  | `string[]`       | 该记录关联的全部构件编码（已去重）。取值顺序为：记录上的构件编码 → 关联 BIM 构件已存储的编码 → 按构件 ID 反查得到的第三方完整构件编码，均无匹配时为空数组 |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`planStartDate`**   | `string \| null` | 计划开始时间（ISO 8601 格式时间戳，UTC）                                                                                                                  |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`planEndDate`**     | `string \| null` | 计划结束时间（ISO 8601 格式时间戳，UTC）                                                                                                                  |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`actualStartDate`** | `string \| null` | 实际开始时间（ISO 8601 格式时间戳，UTC）                                                                                                                  |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`actualEndDate`**   | `string \| null` | 实际结束时间（ISO 8601 格式时间戳，UTC）                                                                                                                  |
| &nbsp;&nbsp;&nbsp;&nbsp;└─ **`remark`**          | `string \| null` | 备注说明                                                                                                                                                  |

> [!NOTE] > **匹配规则**：一条进度记录只要满足以下任一条件即视为命中该构件编码，并出现在对应 `componentCode` 的 `progressRecords` 中：
>
> 1. 记录上直接存储的 `componentCode` 与请求编码一致；
> 2. 记录关联 BIM 构件中已保存的构件编码与请求编码一致；
> 3. 服务端按构件 ID（`applicationId` / Revit UniqueId / 对象 ID）在项目模型中反查到**完整构件编码**（构件自身的「构件编码」属性，缺失时按 `分类对象代码+空间代码+分部分项代码+序号码` 拼接）后与请求编码一致。
>
> 其中第 3 条是**无条件执行**的：进度台账里存的「序号码」是构件上的一个独立属性（如 `W04`），**不是完整构件编码（如 `14-94.01.05.00.00.1NB01020102DQ1-W04`）的截断**，两者无法靠字符串比对互相推导。因此只要记录关联了构件 ID，服务端就会反查出完整构件编码一并参与匹配，并写入响应的 `componentCodes`。若记录没有关联任何构件（无法反查），则只能用台账里已有的编码命中，不会做任何字符串猜测。
>
> 传入 `model_id` 时，仅第 2、3 类关联构件按模型过滤（只保留该模型下的构件关联）；第 1 类记录上手填的编码与模型无关，仍参与匹配。**注意：关联构件的模型必须与传入的 `model_id` 一致，否则该关联会被过滤掉。**

---

## 5. 错误码与提示信息

| HTTP 状态码                     | 错误提示示例                                                                     | 原因说明                                                 | 解决建议                                                             |
| :------------------------------ | :------------------------------------------------------------------------------- | :------------------------------------------------------- | :------------------------------------------------------------------- |
| **`400 Bad Request`**           | `{"error": "Invalid request: componentCodes is required and must be an array."}` | 未在 Body 中传入 `componentCodes` 字段，或该字段不是数组 | 检查请求 Body，确保 `componentCodes` 为非空数组                      |
| **`401 Unauthorized`**          | `{"error": "Unauthorized: Invalid or missing external API token."}`              | 未提供 Token，或 Token 与服务端不匹配                    | 检查请求 Header (`x-external-token` 或 `Authorization`) 是否配置正确 |
| **`404 Not Found`**             | `{"error": "Project not found."}`                                                | 请求中显式提供了 `project_id`，但系统内不存在该项目      | 检查传入的 `project_id` 是否正确                                     |
| **`500 Internal Server Error`** | `{"error": "EXTERNAL_API_TOKEN is not configured on the server."}`               | 服务端运行环境中未设置 `EXTERNAL_API_TOKEN` 环境变量     | 请系统管理员在服务器环境变量中添加 `EXTERNAL_API_TOKEN`              |

> [!NOTE] > `componentCodes` 为空数组时不会报错，接口直接返回 `{ "projectId": ..., "modelId": ..., "results": [] }`。

---

## 6. 代码调用示例

### 6.1 cURL

```bash
curl -X POST "http://your-server-domain:3000/api/v1/external/progress/by-component-codes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_secure_external_api_token_here" \
  -d '{
    "project_id": "project_id_1",
    "model_id": "model_id_1",
    "componentCodes": ["class_space_sec_CB-01", "class_space_sec_CB-02"]
  }'
```

### 6.2 JavaScript (Fetch API)

```javascript
const response = await fetch(
  'http://your-server-domain:3000/api/v1/external/progress/by-component-codes',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-external-token': 'your_secure_external_api_token_here'
    },
    body: JSON.stringify({
      project_id: 'project_id_1',
      model_id: 'model_id_1',
      componentCodes: ['class_space_sec_CB-01', 'class_space_sec_CB-02']
    })
  }
)

if (!response.ok) {
  const errorData = await response.json()
  console.error('查询失败:', errorData.error)
} else {
  const data = await response.json()
  console.log('查询结果:', data.results)
}
```

### 6.3 Python (Requests)

```python
import requests

url = "http://your-server-domain:3000/api/v1/external/progress/by-component-codes"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer your_secure_external_api_token_here"
}
payload = {
    "project_id": "project_id_1",
    "model_id": "model_id_1",
    "componentCodes": ["class_space_sec_CB-01", "class_space_sec_CB-02"]
}

response = requests.post(url, json=payload, headers=headers)

if response.status_code == 200:
    data = response.json()
    for item in data["results"]:
        print(item["componentCode"], item["progressRecords"])
else:
    print(f"错误 {response.status_code}:", response.json().get("error"))
```
