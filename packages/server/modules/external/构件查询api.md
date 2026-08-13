# 根据构件编码查询质量验收信息 API 使用文档

本文档详细说明如何通过外部接口（External API）传入构件编码（`componentCodes`）查询对应的质量验收表单信息。

---

## 1. 接口基本信息

- **接口路径**：
  - `/api/v1/external/quality-acceptance/by-component-codes` _(推荐路径)_
  - `/api/v1/external/projects/:projectId/quality-acceptance/by-component-codes` _(兼容带 projectId 的 URL 路径)_
- **请求方式**：`POST`
- **数据格式**：`Content-Type: application/json`

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

| 属性名                              | 类型             | 是否必填 | 默认值 | 描述                                                                                                                                                |
| :---------------------------------- | :--------------- | :------- | :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`componentCodes`**                | `Array<string>`  | **是**   | -      | 待查询的构件编码数组。示例：`["class_space_sec_CB-01", "class_space_sec_CB-02"]`                                                                    |
| **`project_id`** _(或 `projectId`)_ | `string \| null` | **否**   | `null` | 项目唯一标识符 ID（Stream ID）。<br>• **传值时**：限制仅在指定的项目范围内查询；<br>• **不传/为空时**：自动全量遍历数据库中所有项目的质量验收表单。 |
| **`model_id`** _(或 `modelId`)_     | `string \| null` | **否**   | `null` | 模型/版本 ID。<br>• **传值时**：限制仅匹配包含该模型 ID 的构件与表单；<br>• **不传/为空时**：不限制模型范围。                                       |

---

## 4. 请求与响应示例

### 4.1 请求示例 (Request)

```json
POST /api/v1/external/quality-acceptance/by-component-codes
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
            "http://your-server-domain:3000/api/v1/external/projects/project_id_1/blobs/blob_file_id_888?expires=1686389623000&signature=a59f518e3..."
          ],
          "createdAt": "2026-06-05T10:00:00.000Z",
          "updatedAt": "2026-06-05T18:00:00.000Z"
        }
      ]
    },
    {
      "componentCode": "class_space_sec_CB-02",
      "forms": []
    }
  ]
}
```

#### 响应字段说明

| 字段名                                               | 类型             | 说明                                                                            |
| :--------------------------------------------------- | :--------------- | :------------------------------------------------------------------------------ |
| **`projectId`**                                      | `string \| null` | 请求中传入的项目 ID，全量查询时返回 `null`                                      |
| **`modelId`**                                        | `string \| null` | 请求中传入的模型 ID，未限定模型时返回 `null`                                    |
| **`results`**                                        | `Array`          | 查询结果列表，按输入的 `componentCodes` 顺序依次返回                            |
| ├─ **`componentCode`**                               | `string`         | 构件编码                                                                        |
| └─ **`forms`**                                       | `Array`          | 该构件绑定的质量验收表单数组，每张表单字段如下：                                |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`id`**                  | `string`         | 质量验收表单系统唯一 ID                                                         |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`projectId`**           | `string`         | 表单关联的项目 ID                                                               |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`boqItemId`**           | `string \| null` | 关联工程量清单行 ID                                                             |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`name`**                | `string`         | 质量验收表单名称                                                                |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`code`**                | `string \| null` | 验收单编码                                                                      |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`inspectionLotNumber`** | `string`         | 检验批编号                                                                      |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`acceptancePart`**      | `string`         | 验收部位                                                                        |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`acceptanceContent`**   | `string \| null` | 验收核验内容描述                                                                |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`actualStartDate`**     | `string \| null` | 施工/验收开始时间 (ISO 8601)                                                    |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`actualFinishDate`**    | `string \| null` | 验收完成/通过时间 (ISO 8601)                                                    |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`acceptanceTime`**      | `string \| null` | 验收通过时间                                                                    |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`inspectorId`**         | `string \| null` | 质检人/监理人用户 ID                                                            |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`creatorId`**           | `string`         | 表单创建人用户 ID                                                               |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`workVolume`**          | `number`         | 验收工程量数值                                                                  |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`unit`**                | `string \| null` | 清单工程量单位                                                                  |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`BIM`**                 | `Array`          | 关联的 BIM 模型构件集合（含 `modelId`, `applicationIds`, `bimIds`, `bimCodes`） |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`approveStatus`**       | `string \| null` | 审批流状态 (`PENDING` / `APPROVED` / `REJECTED` / `CANCELED`)                   |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`attachments`**         | `Array<string>`  | 表单附件安全免登录下载绝对 URL 列表 (24 小时有效)                               |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **`createdAt`**           | `string`         | 表单创建时间 (ISO 8601)                                                         |
| &nbsp;&nbsp;&nbsp;&nbsp;└─ **`updatedAt`**           | `string`         | 表单更新时间 (ISO 8601)                                                         |

---

## 5. 错误码与提示信息

| HTTP 状态码                     | 错误提示示例                                                                     | 原因说明                                                 | 解决建议                                                             |
| :------------------------------ | :------------------------------------------------------------------------------- | :------------------------------------------------------- | :------------------------------------------------------------------- |
| **`400 Bad Request`**           | `{"error": "Invalid request: componentCodes is required and must be an array."}` | 未在 Body 中传入 `componentCodes` 字段，或该字段不是数组 | 检查请求 Body，确保 `componentCodes` 为非空数组                      |
| **`401 Unauthorized`**          | `{"error": "Unauthorized: Invalid or missing external API token."}`              | 未提供 Token，或 Token 与服务端不匹配                    | 检查请求 Header (`x-external-token` 或 `Authorization`) 是否配置正确 |
| **`404 Not Found`**             | `{"error": "Project not found."}`                                                | 请求中显式提供了 `project_id`，但系统内不存在该项目      | 检查传入的 `project_id` 是否正确                                     |
| **`500 Internal Server Error`** | `{"error": "EXTERNAL_API_TOKEN is not configured on the server."}`               | 服务端运行环境中未设置 `EXTERNAL_API_TOKEN` 环境变量     | 请系统管理员在服务器环境变量中添加 `EXTERNAL_API_TOKEN`              |

---

## 6. 代码调用示例

### 6.1 cURL

```bash
curl -X POST "http://your-server-domain:3000/api/v1/external/quality-acceptance/by-component-codes" \
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
  'http://your-server-domain:3000/api/v1/external/quality-acceptance/by-component-codes',
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

url = "http://your-server-domain:3000/api/v1/external/quality-acceptance/by-component-codes"
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
    print("查询成功:", data["results"])
else:
    print(f"错误 {response.status_code}:", response.json().get("error"))
```
