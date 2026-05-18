# Convert Files

## 目标

沉淀文件转换功能的前后端协作方案，后续按本文档在 `convert_files` 路由下完成页面与接口开发。

- 前端路由：`/convert_files`
- 前端目录：`packages/frontend-2/pages/convert_files`
- 后端模块建议：`packages/server/modules/file-conversion`
- 接口明细文档：`packages/frontend-2/pages/convert_files/API.md`

## 页面职责

`convert_files` 页面负责以下能力：

1. 上传原始文件
2. 展示文件转换列表
3. 展示转换状态
4. 下载转换结果文件
5. 展示失败原因
6. 支持按状态筛选和手动刷新

页面首期不负责第三方服务操作，仅面向业务用户提供上传、查看和下载能力。

## 角色划分

- 前端：创建上传任务、直传源文件到 MinIO、确认上传完成、展示列表和下载结果
- 后端：生成 MinIO 上传地址、生成签名下载地址、维护文件记录、维护转换事件、提供查询接口、接收第三方回调
- 第三方服务：查询待转换任务、声明开始转换、申请结果文件上传地址、上传转换结果到 MinIO、回调转换结果

## 完整流程

1. 前端调用创建上传任务接口，服务端创建文件记录，返回 `fileId` 和源文件 `uploadUrl`
2. 前端使用 `uploadUrl` 将源文件直接上传到 MinIO
3. 前端调用上传完成确认接口，服务端校验源文件存在，将记录状态更新为 `pending`
4. 第三方服务通过待转换查询接口或按 `id` 获取参数接口，拿到签名 `sourceFileUrl` 和 `streamId`
5. 第三方服务调用开始转换接口，服务端校验状态和源文件存在，创建事件记录并将状态更新为 `queued`
6. 第三方服务开始执行转换，必要时可将状态更新为 `processing`
7. 第三方服务调用结果文件上传地址接口，获取结果文件 `uploadUrl`
8. 第三方服务将转换后的结果文件直接上传到 MinIO
9. 第三方服务调用转换结果回调接口，服务端写回结果文件对象信息、转换状态，并结束对应事件
10. 前端通过列表接口查看是否已转换，并使用签名下载地址下载结果文件

说明：

- `uploadUrl` 为 MinIO 预签名上传地址
- `sourceFileUrl` / `resultFileUrl` 为短时效签名下载地址，不假设 MinIO 公共可读
- 数据库存储以 `objectKey` 为准，请求时动态生成下载地址

## 状态机

建议统一使用以下状态：

- `uploaded`：文件记录已创建，前端已拿到源文件上传地址
- `pending`：源文件已上传完成，等待第三方领取
- `queued`：第三方已调用开始转换，服务端已创建转换事件
- `processing`：第三方已开始实际转换
- `success`：转换成功，结果文件已上传并已回调
- `failed`：转换失败

前端页面展示建议：

- `uploaded`：上传中
- `pending`：待转换
- `queued`：已排队
- `processing`：转换中
- `success`：已完成
- `failed`：转换失败

## 前端页面结构建议

建议页面拆成以下区域：

### 1. 上传区

- 文件选择
- 上传按钮
- 上传进度
- 上传后刷新列表

### 2. 筛选区

- 文件名关键字
- 状态筛选
- 上传时间筛选
- 刷新按钮

### 3. 列表区

列表字段：

- 文件名
- 文件大小
- 上传时间
- 上传人
- 转换状态
- 是否已转化
- 转化后的文件
- 失败原因
- 操作列

操作列建议：

- 下载原文件
- 下载转换结果
- 查看失败原因

## 列表字段定义

前端表格建议直接消费以下字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `fileName` | 文件名 |
| `fileSize` | 文件大小，前端展示时转为 KB/MB |
| `uploadedAt` | 上传完成时间 |
| `creator` | 上传人 |
| `status` | 转换状态 |
| `isConverted` | 是否已转化 |
| `resultFileUrl` | 转换结果文件签名下载地址 |
| `errorMessage` | 失败原因 |

## REST 接口约定

### 1. 创建上传任务

- `POST /api/v1/file-conversions`

请求：

```json
{
  "fileName": "demo.ifc",
  "fileSize": 123456
}
```

响应：

```json
{
  "id": "fc_001",
  "uploadUrl": "https://minio.example/source-upload-url",
  "sourceObjectKey": "file-conversion/source/fc_001/demo.ifc",
  "status": "uploaded"
}
```

### 2. 源文件上传完成确认

- `POST /api/v1/file-conversions/:id/upload-complete`

请求：

```json
{
  "etag": "source-etag"
}
```

响应：

```json
{
  "id": "fc_001",
  "status": "pending"
}
```

### 3. 查询前端列表

- `GET /api/v1/file-conversions`

查询参数建议：

- `keyword`
- `status`
- `page`
- `pageSize`

响应：

```json
{
  "items": [
    {
      "id": "fc_001",
      "fileName": "demo.ifc",
      "fileSize": 123456,
      "uploadedAt": "2026-05-18T10:00:00.000Z",
      "creator": "张三",
      "status": "success",
      "isConverted": true,
      "resultFileUrl": "https://minio.example/result-file-url?X-Amz-Algorithm=...",
      "errorMessage": null
    }
  ],
  "total": 1
}
```

### 4. 查询待转换列表

- `GET /api/v1/file-conversions/pending`

说明：供第三方服务查询可领取的转换任务。

### 5. 按 id 获取转换参数

- `GET /api/v1/file-conversions/:id/params`

响应：

```json
{
  "id": "fc_001",
  "sourceFileUrl": "https://minio.example/source-file-url?X-Amz-Algorithm=...",
  "streamId": "conv_stream_001",
  "status": "pending"
}
```

### 6. 开始转换

- `POST /api/v1/file-conversions/:id/start`

请求：

```json
{
  "operator": "converter-service"
}
```

响应：

```json
{
  "fileId": "fc_001",
  "eventId": "evt_001",
  "streamId": "conv_stream_001",
  "status": "queued"
}
```

说明：

- 该接口需要做幂等处理
- 如果任务已经 `queued` 或 `processing`，重复调用应返回已有事件信息

### 6.5 标记转换中

- `POST /api/v1/file-conversions/:id/processing`

请求：

```json
{
  "eventId": "evt_001",
  "operator": "converter-service"
}
```

响应：

```json
{
  "fileId": "fc_001",
  "eventId": "evt_001",
  "status": "processing"
}
```

说明：

- 该接口供第三方服务在实际启动转换引擎后调用
- 该接口需要做幂等处理

### 7. 获取结果文件上传地址

- `POST /api/v1/file-conversions/:id/result-upload-url`

请求：

```json
{
  "fileName": "demo.glb",
  "fileSize": 456789,
  "contentType": "model/gltf-binary"
}
```

响应：

```json
{
  "fileId": "fc_001",
  "uploadUrl": "https://minio.example/result-upload-url",
  "resultObjectKey": "file-conversion/result/fc_001/demo.glb",
  "resultFileUrl": "https://minio.example/result-file-url?X-Amz-Algorithm=..."
}
```

### 8. 回调转换结果

- `POST /api/v1/file-conversions/:id/callback`

成功请求：

```json
{
  "eventId": "evt_001",
  "status": "success",
  "resultObjectKey": "file-conversion/result/fc_001/demo.glb",
  "resultFileUrl": "https://minio.example/result-file-url"
}
```

失败请求：

```json
{
  "eventId": "evt_001",
  "status": "failed",
  "message": "convert failed"
}
```

## 数据结构建议

### 主表 `conversion_files`

建议字段：

- `id`
- `fileName`
- `fileSize`
- `sourceObjectKey`
- `sourceFileUrl`
- 含义：源文件签名下载地址，后端按 `sourceObjectKey` 动态生成
- `resultObjectKey`
- `resultFileUrl`
- 含义：结果文件签名下载地址，后端按 `resultObjectKey` 动态生成
- `streamId`
- `status`
- `isConverted`
- `uploadedAt`
- `startedAt`
- `convertedAt`
- `errorMessage`
- `createdAt`
- `updatedAt`
- `creator`
- `updater`

### 事件表 `conversion_events`

建议字段：

- `id`
- `fileId`
- `streamId`
- `status`
- `startedBy`
- `startedAt`
- `finishedAt`
- `callbackPayload`
- `errorMessage`
- `createdAt`
- `updatedAt`
- `creator`
- `updater`

说明：新增表需包含 `createdAt`、`updatedAt`、`creator`、`updater`。

## 权限与安全

### 用户侧接口

以下接口供前端 `convert_files` 页面使用，继续复用现有登录态和项目权限控制：

- `POST /api/v1/file-conversions`
- `POST /api/v1/file-conversions/:id/upload-complete`
- `GET /api/v1/file-conversions`

前端请求统一使用 `plugins/015-fetchAuth.ts` 提供的 `$fetch` 鉴权链路。

### 第三方服务接口

以下接口供第三方转换服务调用：

- `GET /api/v1/file-conversions/pending`
- `GET /api/v1/file-conversions/:id/params`
- `POST /api/v1/file-conversions/:id/start`
- `POST /api/v1/file-conversions/:id/result-upload-url`
- `POST /api/v1/file-conversions/:id/callback`

由于服务端全局已占用 `Authorization` 头做用户鉴权，临时方案改为使用固定 token 的自定义请求头做服务间鉴权。

请求头格式：

```http
X-File-Conversion-Token: <fixed-token>
```

服务端环境变量建议：

```bash
FILE_CONVERSION_SERVICE_TOKEN=your-fixed-token
```

服务端校验规则：

- 缺少 `X-File-Conversion-Token` 请求头时返回 `401`
- `token` 与服务端配置不匹配时返回 `403`

### 结果文件上传安全约束

- `result-upload-url` 接口只对合法第三方服务开放
- 返回的 MinIO 上传地址应为短时效预签名地址
- 源文件和结果文件下载地址应为短时效签名 URL
- 返回的对象路径只允许写入当前 `fileId` 对应的结果目录
- `callback` 成功回调时应校验结果对象真实存在

### 临时方案边界

- 固定 `token` 可以避免无关人员随意调用第三方接口
- 固定 `token` 无法防止泄漏后的重放调用
- 当前实现不依赖 MinIO 公共读权限

后续可按以下路径升级：

- 固定 `token`
- 固定 `token` + IP 白名单
- `HMAC` 签名

## 前端开发建议

### 请求方式

前端接口请求统一使用 `plugins/015-fetchAuth.ts` 提供的 `$fetch` 鉴权链路。

### 页面拆分建议

- `pages/convert_files/index.vue`：页面入口
- `components/convert-files/ConvertFilesUpload.vue`：上传区域
- `components/convert-files/ConvertFilesFilters.vue`：筛选区域
- `components/convert-files/ConvertFilesTable.vue`：列表区域
- `composables/convert-files/useConvertFiles.ts`：列表、上传、刷新逻辑
- `composables/convert-files/useConvertFileUpload.ts`：直传 MinIO 逻辑

### 页面加载建议

- 首屏加载列表
- 上传成功后自动刷新列表
- 转换中的任务支持手动刷新
- 首期可不做自动轮询，避免额外复杂度

## 后端开发建议

- MinIO 上传能力优先复用现有对象存储预签名上传逻辑
- 回调接口需校验 `eventId`、文件状态和对象是否存在
- `start`、`result-upload-url`、`callback` 三个第三方接口建议增加服务间鉴权
- 库内建议同时保存 `objectKey` 和展示用 `url` 字段，但真实下载应始终以 `objectKey` 动态生成签名地址

## 首期开发范围

建议按以下顺序开发：

1. 后端建表和状态枚举
2. 后端完成 8 个 REST 接口
3. 前端创建 `convert_files` 路由页面骨架
4. 前端完成上传和列表查询
5. 前端补充状态展示和结果下载

## 待确认项

以下问题在正式开发前需要最终确认：

1. `streamId` 是否仅作为外部转换链路标识，还是需要映射现有项目语义
2. 结果文件类型是否固定为单一格式，例如 `glb`
3. 前端页面是否需要限制访问角色
4. 第三方服务鉴权方式使用固定 token 还是签名机制
