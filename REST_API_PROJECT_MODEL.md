# 前端接入文档

本文档只保留前端需要关注的 4 个能力：

1. 模型列表查询
2. 模型构件列表查询
3. 根据 ID 查询构件
4. IFC 文件上传链路

## 通用说明

- Base URL：`/`
- 鉴权：沿用当前前端登录态；如果你是手动发请求，带上 Cookie 或 `Authorization`
- 读接口：需要当前用户对项目有读权限
- 写接口：需要当前用户对项目有写权限
- 分页默认 `limit=25`

## 1) 模型列表查询

### 使用场景

- 模型页初始化列表
- 搜索模型
- 加载更多模型
- 按来源应用或是否有版本做筛选

### 接口

- 方法：`GET`
- 路径：`/api/v1/projects/:projectId/models`

### 路径参数

- `projectId`：项目 ID

### Query 参数

- `limit`：每页数量，建议前端固定 `20` 或 `50`
- `cursor`：上一页返回的游标
- `search`：模型名称搜索关键词
- `contributors`：贡献者用户 ID，支持逗号分隔
- `sourceApps`：来源应用，支持逗号分隔
- `onlyWithVersions`：是否仅看有版本的模型

### 前端请求示例

```ts
const params = new URLSearchParams({
  limit: '20',
  search: 'main',
  onlyWithVersions: 'true'
})

const res = await fetch(`/api/v1/projects/${projectId}/models?${params.toString()}`, {
  credentials: 'include'
})

const data = await res.json()
```

### 响应示例

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

### 前端处理建议

- 首屏渲染使用 `items`
- `cursor` 不为空时显示“加载更多”
- 搜索条件变化时清空旧列表并重置 `cursor`
- `totalCount` 可用于列表标题或统计信息

## 2) 模型构件列表查询

### 使用场景

- 模型详情页加载构件列表
- 构件面板分页
- 按构件属性筛选
- 只取前端展示需要的字段，减少返回体积

### 接口

- 方法：`GET`
- 路径：`/api/v1/projects/:projectId/models/:modelId/objects`

### 路径参数

- `projectId`：项目 ID
- `modelId`：模型 ID

### Query 参数

- `limit`：每页数量
- `cursor`：分页游标
- `depth`：构件树查询深度
- `select`：仅返回指定字段，支持逗号分隔
- `query`：复杂筛选条件，传 JSON 字符串
- `orderBy`：排序条件，传 JSON 字符串

### 前端请求示例

```ts
const params = new URLSearchParams({
  limit: '50',
  select: 'applicationId,category,name',
  query: JSON.stringify([
    {
      field: 'category',
      operator: '=',
      value: 'Door'
    }
  ]),
  orderBy: JSON.stringify({
    field: 'createdAt',
    direction: 'desc'
  })
})

const res = await fetch(
  `/api/v1/projects/${projectId}/models/${modelId}/objects?${params.toString()}`,
  {
    credentials: 'include'
  }
)

const data = await res.json()
```

### 响应示例

```json
{
  "projectId": "project-id-1",
  "modelId": "model-id-1",
  "modelName": "main",
  "versionId": "version-id-1",
  "rootObjectId": "root-object-id-1",
  "totalCount": 2,
  "limit": 50,
  "cursor": null,
  "items": [
    {
      "id": "child-object-id-1",
      "speckleType": "Objects.BuiltElements.Door",
      "createdAt": "2026-05-22T02:12:01.000Z",
      "totalChildrenCount": 0,
      "data": {
        "applicationId": "door-001",
        "category": "Door",
        "name": "Main Door"
      }
    }
  ]
}
```

### 前端处理建议

- `items` 直接作为构件表格或列表数据源
- `data` 是动态字段，前端取值时按可选链处理
- `select` 建议只传当前页面需要的字段
- `cursor` 不为空时继续请求下一页
- 如果返回空数组，前端展示“当前模型暂无构件”或“当前筛选条件下无结果”

## 3) 根据 ID 查询构件

### 使用场景

- 点击构件行后加载详情
- 从 viewer 选中构件后查询右侧详情面板
- 根据 `applicationId/objectId` 联动详情

### 接口

- 方法：`GET`
- 路径：`/api/v1/projects/:projectId/models/:modelId/objects/:objectId`

### 路径参数

- `projectId`：项目 ID
- `modelId`：模型 ID
- `objectId`：构件对象 ID

### 前端请求示例

```ts
const res = await fetch(
  `/api/v1/projects/${projectId}/models/${modelId}/objects/${objectId}`,
  {
    credentials: 'include'
  }
)

const data = await res.json()
```

### 响应示例

```json
{
  "projectId": "project-id-1",
  "modelId": "model-id-1",
  "modelName": "main",
  "versionId": "version-id-1",
  "rootObjectId": "root-object-id-1",
  "item": {
    "id": "object-id-1",
    "speckleType": "Objects.BuiltElements.Wall",
    "createdAt": "2026-05-22T02:12:01.000Z",
    "totalChildrenCount": 0,
    "data": {
      "applicationId": "wall-001",
      "category": "Wall",
      "name": "External Wall"
    }
  }
}
```

### 前端处理建议

- 成功后用 `item` 填充详情面板
- 如果返回 `404`，前端提示“当前模型下未找到该构件”
- 如果列表页已拿到部分字段，详情页可只在需要补充更多字段时再请求一次

## 4) IFC 文件上传链路

### 前端目标

- 让用户选择 `.ifc` 文件
- 上传文件
- 触发导入
- 展示上传中、处理中、成功、失败等状态

### 推荐链路

前端推荐使用“预签名上传 + 确认导入”的两段式流程。

### 前端时序

1. 用户选择 IFC 文件
2. 前端调用 `generateUploadUrl`
3. 前端拿到 `url` 和 `fileId`
4. 前端通过 `PUT` 直接上传文件到对象存储
5. 前端从上传响应头里读取 `ETag`
6. 前端调用 `startFileImport`
7. 前端进入轮询 / 刷新列表 / 等待状态更新
8. 前端展示成功或失败结果

### 兼容型 REST 上传入口

- 方法：`POST`
- 路径：`/api/v1/projects/:projectId/models/upload/:fileType/:modelName?`
- `fileType` 传 `ifc`
- 请求体：`multipart/form-data`

### REST 上传示例

```ts
const formData = new FormData()
formData.append('file', file)

const res = await fetch(
  `/api/v1/projects/${projectId}/models/upload/ifc/${encodeURIComponent(modelName)}`,
  {
    method: 'POST',
    body: formData,
    credentials: 'include'
  }
)

const data = await res.json()
```

### REST 上传响应示例

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

### 推荐链路示例

#### 第一步：申请上传地址

```ts
const generateRes = await apolloClient.mutate({
  mutation: GenerateUploadUrlDocument,
  variables: {
    input: {
      projectId,
      fileName: file.name
    }
  }
})

const { url, fileId } = generateRes.data.fileUploadMutations.generateUploadUrl
```

#### 第二步：直传文件

```ts
const uploadRes = await fetch(url, {
  method: 'PUT',
  body: file
})

const etag = uploadRes.headers.get('etag')
```

#### 第三步：确认开始导入

```ts
await apolloClient.mutate({
  mutation: StartFileImportDocument,
  variables: {
    input: {
      projectId,
      fileId,
      modelId,
      etag
    }
  }
})
```

### 前端状态建议

- `idle`：还没选择文件
- `uploading`：正在上传到对象存储
- `starting-import`：正在确认导入
- `processing`：文件已接收，等待转换完成
- `success`：导入成功
- `error`：上传或导入失败

### 前端异常处理建议

- `400`：提示用户文件参数不合法或上传校验失败
- `401`：提示重新登录
- `403`：提示当前用户没有模型写权限
- `404`：提示模型不存在或已被删除
- `500`：提示“服务繁忙，请稍后重试”

### 前端落地建议

- 新页面优先走推荐链路，不建议只保留旧 REST 上传方式
- 上传大文件时要显示进度和中间状态
- 成功后刷新模型列表或上传记录
- 如果同一页面有模型创建能力，建议先确保 `modelId` 可用，再开始上传
