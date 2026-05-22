# 质量验收第三方导入接口

## 概述

- 接口名称：质量验收批量导入
- 请求方式：`POST`
- 接口路径：`/api/v1/internal/projects/:projectId/quality-acceptance/forms/import`
- 鉴权请求头：`x-file-conversion-token`
- Token 来源：服务端环境变量 `FILE_CONVERSION_SERVICE_TOKEN`

## 请求头

- `Content-Type: application/json`
- `x-file-conversion-token: <your-token>`

## 路径参数

- `projectId`：必填，目标项目 ID

## 请求体

- 根字段：`items`
- 类型：数组
- 数量限制：`1-500`

```json
{
  "items": [
    {
      "rowNumber": 1,
      "boqItemId": "abc1234567",
      "inspectionLotNumber": "JY-20260522-001",
      "acceptancePart": "3#楼二层梁板",
      "acceptanceContent": "钢筋绑扎验收",
      "actualStartDate": 1779302400000,
      "actualFinishDate": 1779388800000,
      "inspector": "user123",
      "workVolume": 128.5,
      "unit": "m3",
      "timeZone": "Asia/Shanghai",
      "approveStatus": null
    }
  ]
}
```

## 字段说明

- `rowNumber`：可选，行号，用于返回错误定位；不传时由服务端自动补齐
- `boqItemId`：必填，当前项目内的 BOQ 清单项 ID
- `name`：可选，不传时自动使用 BOQ 项名称
- `code`：可选，不传时自动使用 BOQ 项编码
- `inspectionLotNumber`：必填，检验批号
- `acceptancePart`：必填，验收部位
- `acceptanceContent`：可选，验收内容
- `actualStartDate`：可选，毫秒时间戳
- `actualFinishDate`：必填，毫秒时间戳
- `inspector`：可选，检查人用户 ID
- `workVolume`：必填，支持数字或可转成数字的字符串
- `unit`：可选，不传时自动使用 BOQ 项单位
- `timeZone`：可选，时区字符串
- `approveStatus`：可选，通常传 `null`

## 暂不支持

- 不支持附件导入
- 不支持 BIM/构件关联导入
- 不支持幂等更新，当前行为是纯创建

## 成功响应

```json
{
  "projectId": "project123",
  "createdCount": 2,
  "failedCount": 1,
  "createdItems": [
    {
      "rowNumber": 1,
      "id": "formid001",
      "boqItemId": "abc1234567",
      "code": "BOQ-001",
      "inspectionLotNumber": "JY-20260522-001"
    },
    {
      "rowNumber": 2,
      "id": "formid002",
      "boqItemId": "abc1234568",
      "code": "BOQ-002",
      "inspectionLotNumber": "JY-20260522-002"
    }
  ],
  "failedRows": [
    {
      "rowNumber": 3,
        "error": "BOQ item abc0000000 not found in project."
    }
  ]
}
```

## 错误码

- `200`：请求成功，但返回中仍可能包含部分行失败
- `401`：缺少 `x-file-conversion-token`
- `403`：Token 无效
- `404`：项目不存在
- `500`：服务端未配置 `FILE_CONVERSION_SERVICE_TOKEN`

## curl 示例

```bash
curl -X POST "https://your-domain.com/api/v1/internal/projects/project123/quality-acceptance/forms/import" \
  -H "Content-Type: application/json" \
  -H "x-file-conversion-token: your-service-token" \
  -d '{
    "items": [
      {
        "rowNumber": 1,
        "boqItemId": "abc1234567",
        "inspectionLotNumber": "JY-20260522-001",
        "acceptancePart": "3#楼二层梁板",
        "acceptanceContent": "钢筋绑扎验收",
        "actualFinishDate": 1779388800000,
        "workVolume": "128.5",
        "unit": "m3"
      }
    ]
  }'
```

## 联调说明

- 调用前先把 `boqItemId` 和你们项目内的 BOQ 数据映射好
- `actualFinishDate` 必须传毫秒时间戳，月度验工后续会依赖这个字段做聚合
- 如果上游可能重复推送同一业务单据，建议在调用前先自行去重
- 如果后续需要支持 upsert，建议先补充 `externalId` 设计
