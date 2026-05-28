# ODA DWG to DXF 服务联调说明

## 背景

ODA 是一个用于将 `DWG` 文件转换为 `DXF` 的服务。

本仓库已经补充了一个联调脚本，用于：

- 验证 `local` 与 `url` 两种转换方式
- 覆盖常见异常返回
- 自动下载转换结果
- 将完整测试报告落盘，便于后续前后端对接时参考

相关脚本：

- `packages/server/scripts/convertDwgToDxf.ts`

联调产物：

- 仓库根目录测试报告：`oda-convert-report.json`
- 本地文件转换成功产物：`oda-local-output.dxf`

## 服务接口

### 1. 直接上传文件

```bash
curl -X POST http://speckle-server-dwg2dxf-1:8080/convert/local \
  -F "file=@test.dwg"
```

### 2. 传远程文件 URL

```bash
curl -X POST http://speckle-server-dwg2dxf-1:8080/convert/url \
  --form 'url="https://example.com/test.dwg"'
```

### 3. 典型返回

```json
{
  "path": "c592b99ff8c3e464418be7bfcf143466/output/60008f1831e89665e24d686013d14ea9.dxf",
  "url": "http://192.168.3.4:8089/download/c592b99ff8c3e464418be7bfcf143466/output/60008f1831e89665e24d686013d14ea9.dxf"
}
```

说明：

- `path` 是服务内部产物路径
- `url` 是可直接下载 DXF 的地址
- 实际对接时不能只看接口是否返回 `200`，还要校验 `url` 对应文件是否真的可下载

## 本地运行方式

在仓库根目录执行：

```bash
yarn workspace @speckle/server exec tsx --import ./esmLoader.js ./scripts/convertDwgToDxf.ts
```

可选参数：

```bash
yarn workspace @speckle/server exec tsx --import ./esmLoader.js ./scripts/convertDwgToDxf.ts \
  --base-url=http://127.0.0.1:8089 \
  --file="/absolute/path/to/file.dwg" \
  --source-url="https://example.com/file.dwg" \
  --output-dir="/absolute/output/dir" \
  --timeout-ms=120000
```

默认值：

- `baseUrl`: `http://127.0.0.1:8089`
- `file`: `packages/frontend-2/public/RAC_basic_sample_project - 图纸 - A102 - Plans-楼层平面 - Level 1.dwg`
- `outputDir`: 仓库根目录

## 脚本行为说明

脚本会顺序执行以下测试用例：

1. `local-success`
2. `url-success`
3. `local-missing-file`
4. `local-invalid-file`
5. `url-missing-url`
6. `url-invalid-url`

每个用例会记录：

- 请求地址
- 请求参数摘要
- HTTP 状态码
- 响应头
- 原始响应体
- JSON 解析结果
- 下载是否成功
- 下载重试次数

下载策略：

- 对成功返回的 `url/path` 会自动尝试下载 DXF
- 下载阶段会最多重试 `5` 次
- 每次重试间隔 `2s`

## 本次真实联调结果

联调环境：

- 服务地址：`http://127.0.0.1:8089`
- 本地 DWG 文件：`packages/frontend-2/public/RAC_basic_sample_project - 图纸 - A102 - Plans-楼层平面 - Level 1.dwg`

### 1. local-success

请求：

- `POST /convert/local`
- 上传真实 DWG 文件

结果：

- 返回 `200 OK`
- 返回体包含有效 `path` 和 `url`
- 下载成功
- DXF 已保存到仓库根目录：`oda-local-output.dxf`

结论：

- `convert/local` 在真实 DWG 文件场景下可正常使用

### 2. url-success

请求：

- `POST /convert/url`
- 传入远程 DWG 地址

结果：

- 返回 `200 OK`
- 返回体包含 `path` 和 `url`
- 但脚本连续重试 `5` 次下载仍返回 `404 Not Found`

结论：

- `convert/url` 当前存在“接口返回成功但产物无法下载”的情况
- 不能将 `200 + url/path` 视为真正转换成功

### 3. local-missing-file

请求：

- `POST /convert/local`
- 未传 `file`

结果：

- 返回 `400 Bad Request`
- 返回体：

```text
no file or url provided
```

结论：

- 缺参校验生效

### 4. local-invalid-file

请求：

- `POST /convert/local`
- 传入伪造的 `invalid.dwg`

结果：

- 返回 `200 OK`
- 返回体包含 `path` 和 `url`
- 但下载地址连续重试 `5` 次后仍为 `404 Not Found`

结论：

- 服务没有在上传阶段识别无效 DWG
- 表面返回成功，但实际上没有可下载产物

### 5. url-missing-url

请求：

- `POST /convert/url`
- 未传 `url`

结果：

- 返回 `400 Bad Request`
- 返回体：

```text
no file or url provided
```

结论：

- 缺参校验生效

### 6. url-invalid-url

请求：

- `POST /convert/url`
- 传入非法 URL：`not-a-valid-url`

结果：

- 返回 `400 Bad Request`
- 返回体：

```text
Get "not-a-valid-url": unsupported protocol scheme ""
```

结论：

- 服务对非法 URL 有基础校验

## 对接建议

### 1. 不要只依赖首个 200

当前真实行为表明，下列场景都可能出现“接口返回 `200`，但最终没有 DXF 文件”：

- `convert/url`
- 上传伪造或不可处理的 DWG

因此建议将“转换成功”的判定拆为两步：

1. 调用转换接口，拿到 `path/url`
2. 校验 `url` 对应的 DXF 文件是否可以下载

### 2. 建议统一抽象为三态

后续业务对接建议不要只分“成功/失败”，而是分为：

- `success`: 接口成功，且 DXF 可下载
- `pending_or_inconsistent`: 接口返回成功，但下载地址不可用
- `error`: 接口直接返回 4xx/5xx

这样更符合当前 ODA 服务的真实表现。

### 3. 建议服务侧补强

如果后续可以调整 ODA 服务，建议至少补下面两点：

- 当转换结果文件未真正生成时，接口不要返回 `200`
- 返回更明确的错误码和错误信息，区分“参数错误”“下载源文件失败”“转换失败”“产物写入失败”

## 相关文件

- 联调脚本：`packages/server/scripts/convertDwgToDxf.ts`
- 联调文档：`packages/server/doces/oda-dwg-to-dxf-service.md`
- 测试报告：`oda-convert-report.json`
- 成功转换产物：`oda-local-output.dxf`

## 补充说明

脚本当前会在存在“成功用例失败”时打印错误信息，便于人工联调排查。

截至本次联调结论：

- `convert/local` 可用
- `convert/url` 返回值与真实产物状态不一致
- “无效 DWG 文件”场景下服务也可能返回成功，但下载地址无效
