# 项目与模型 REST 接口文档

本文档包含以下 3 个接口：

1. 查询项目列表（支持分页、筛选）
2. 上传模型（REST）
3. 查询项目模型列表（支持分页、筛选）

## 通用说明

- Base URL：`/`
- 鉴权：需要登录态（会话/Cookie 或等价鉴权方式）
- 分页：
  - 项目列表使用 `cursor` 游标分页（字符串）
  - 项目模型列表使用 `cursor` 时间游标（ISO 时间字符串）
- `limit` 默认 `25`，范围 `1-100`

---

## 1) 查询项目列表

- 方法：`GET`
- 路径：`/api/v1/projects`

### Query 参数

- `limit`（可选，number）：每页数量，默认 `25`，最大 `100`
- `cursor`（可选，string）：上一页返回的游标
- `search`（可选，string）：按项目 `name/description/id` 模糊筛选
- `workspaceId`（可选，string）：按工作空间筛选

### 响应示例（200）

```json
{
  "totalCount": 128,
  "limit": 25,
  "cursor": "eyJ1cGRhdGVkQXQiOiIyMDI2LTA1LTA3VDEwOjE5OjEyLjAwMFoiLCJpZCI6IjEyMzQ1In0",
  "items": [
    {
      "id": "project-id-1",
      "name": "项目A",
      "description": "示例项目",
      "visibility": "private",
      "workspaceId": "ws-1",
      "role": "stream:owner",
      "createdAt": "2026-04-01T09:00:00.000Z",
      "updatedAt": "2026-05-07T10:19:12.000Z"
    }
  ]
}
```

### 可能错误码

- `401`：未登录或鉴权失败

---

## 2) 上传模型（REST）

- 方法：`POST`
- 路径：`/api/v1/projects/:projectId/models/upload/:fileType/:modelName?`

### 路径参数

- `projectId`（必填，string）：项目 ID
- `fileType`（必填，string）：文件类型，如 `ifc`
- `modelName`（可选，string）：模型名（分支名），不传默认 `main`

### 请求体

- `multipart/form-data`
- 文件字段沿用现有文件上传能力（与旧接口 `/api/file/:fileType/:streamId/:branchName?` 一致）

### 响应示例（201）

```json
{
  "uploadResults": [
    {
      "blobId": "b6f8f7f3...",
      "fileName": "building.ifc",
      "fileSize": 102400
    }
  ]
}
```

### 说明

- 该接口复用了现有文件导入流程。
- 同时保留旧上传接口，确保兼容性。

### 可能错误码

- `400`：请求体格式不合法
- `401`：未登录或鉴权失败
- `403`：无项目写权限
- `404`：`modelName` 对应模型（分支）不存在
- `500`：服务端处理失败

---

## 3) 查询项目模型列表

- 方法：`GET`
- 路径：`/api/v1/projects/:projectId/models`

### 路径参数

- `projectId`（必填，string）：项目 ID

### Query 参数

- `limit`（可选，number）：每页数量，默认 `25`，最大 `100`
- `cursor`（可选，string）：上一页返回的游标（ISO 时间字符串）
- `search`（可选，string）：按模型名称模糊筛选
- `contributors`（可选，string/string[]）：贡献者用户 ID；支持逗号分隔或重复参数
- `sourceApps`（可选，string/string[]）：来源应用；支持逗号分隔或重复参数
- `onlyWithVersions`（可选，boolean）：是否仅返回有版本记录的模型

### 请求示例

```bash
curl -G "http://localhost:3000/api/v1/projects/project-id-1/models" \
  --data-urlencode "limit=20" \
  --data-urlencode "search=main" \
  --data-urlencode "contributors=user-1,user-2" \
  --data-urlencode "sourceApps=revit,rhino" \
  --data-urlencode "onlyWithVersions=true"
```

### 响应示例（200）

```json
{
  "totalCount": 36,
  "limit": 20,
  "cursor": "2026-05-07T09:21:10.121Z",
  "items": [
    {
      "id": "model-id-1",
      "projectId": "project-id-1",
      "name": "main",
      "description": "主模型",
      "authorId": "user-1",
      "createdAt": "2026-03-01T12:00:00.000Z",
      "updatedAt": "2026-05-07T09:21:10.121Z"
    }
  ]
}
```

## 4) 导出模型列表

- 方法：`GET`
- 路径：`/api/v1/modelList`

### Query 参数

- `limit`（可选，number）：每页数量，默认 `25`，最大 `100`
- `cursor`（可选，string）：上一页返回的游标（ISO 时间字符串）
- `search`（可选，string）：按模型名称模糊筛选
- `contributors`（可选，string/string[]）：贡献者用户 ID；支持逗号分隔或重复参数
- `sourceApps`（可选，string/string[]）：来源应用；支持逗号分隔或重复参数
- `onlyWithVersions`（可选，boolean）：是否仅返回有版本记录的模型

### 请求示例

```bash
curl -G "http://localhost:3000/api/v1/modelList" \
  --data-urlencode "limit=20" \
  --data-urlencode "search=main" \
  --data-urlencode "contributors=user-1,user-2" \
  --data-urlencode "sourceApps=revit,rhino" \
  --data-urlencode "onlyWithVersions=true"
```

### 响应示例（200）

```json
{
  "totalCount": 36,
  "limit": 20,
  "cursor": "2026-05-07T09:21:10.121Z",
  "items": [
    {
      "id": "model-id-1",
      "projectId": "project-id-1",
      "name": "main",
      "description": "主模型",
      "authorId": "user-1",
      "createdAt": "2026-03-01T12:00:00.000Z",
      "updatedAt": "2026-05-07T09:21:10.121Z"
    }
  ]
}
```

### 可能错误码

- `401`：未登录或鉴权失败
- `403`：无项目读权限
- `404`：项目不存在
