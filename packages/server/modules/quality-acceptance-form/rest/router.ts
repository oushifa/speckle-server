import { Router, type RequestHandler } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { validateRequest } from 'zod-express'
import Busboy from 'busboy'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import { db } from '@/db/knex'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { recalculateProjectCostSummaryFactory } from '@/modules/project-statistics/services/projectCostSummaries'
import { importQualityAcceptanceFormsFactory } from '@/modules/quality-acceptance-form/services/qualityAcceptanceForms'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import {
  streamWritePermissionsPipelineFactory,
  streamReadPermissionsPipelineFactory
} from '@/modules/shared/authz'
import { createBusboy } from '@/modules/blobstorage/rest/busboy'
import { BadRequestError, UnauthorizedError } from '@/modules/shared/errors'
import { ensureError } from '@speckle/shared'

const thirdPartyTokenHeader = 'x-file-conversion-token'
const serviceCreator = 'quality-acceptance-import-service'

const routeParamsSchema = z.object({
  projectId: z.string().trim().min(1)
})

const importItemSchema = z.object({
  rowNumber: z.coerce.number().int().min(1).optional(),
  boqItemId: z.string().trim().min(1).max(10),
  name: z.string().trim().max(255).optional(),
  code: z.string().trim().max(255).optional(),
  inspectionLotNumber: z.string().trim().min(1).max(255),
  acceptancePart: z.string().trim().min(1).max(1024),
  acceptanceContent: z.string().trim().max(4096).optional(),
  actualStartDate: z.coerce.number().int().nullable().optional(),
  actualFinishDate: z.coerce.number().int(),
  inspector: z.string().trim().max(64).optional(),
  workVolume: z.coerce.number().finite(),
  unit: z.string().trim().max(64).optional(),
  timeZone: z.string().trim().max(128).optional(),
  approveStatus: z.string().trim().max(64).nullable().optional()
})

const importBodySchema = z.object({
  items: z.array(importItemSchema).min(1).max(500)
})

const requireServiceToken: RequestHandler = (req, res, next) => {
  const configuredToken = process.env['FILE_CONVERSION_SERVICE_TOKEN']
  if (!configuredToken) {
    return res
      .status(500)
      .send({ error: 'FILE_CONVERSION_SERVICE_TOKEN is not configured.' })
  }

  const token = req.headers[thirdPartyTokenHeader]
  if (!token || typeof token !== 'string') {
    return res.status(401).send({
      error: `Missing ${thirdPartyTokenHeader} request header.`
    })
  }

  if (token !== configuredToken) {
    return res.status(403).send({ error: 'Invalid service token.' })
  }

  return next()
}

export const qualityAcceptanceRouterFactory = (): Router => {
  const app = Router()
  const getStream = getStreamFactory({ db })

  // 1. 第三方导入接口 (服务间通信鉴权)
  app.post(
    '/api/v1/internal/projects/:projectId/quality-acceptance/forms/import',
    requireServiceToken,
    validateRequest({
      params: routeParamsSchema,
      body: importBodySchema
    }),
    async (req, res) => {
      const { projectId } = req.params
      const project = await getStream({ streamId: projectId })
      if (!project) {
        return res.status(404).send({ error: 'Project not found.' })
      }

      const projectDb = await getProjectDbClient({ projectId })
      const result = await importQualityAcceptanceFormsFactory({
        db,
        projectDb
      })({
        projectId,
        creator: serviceCreator,
        items: req.body.items.map((item, index) => ({
          ...item,
          rowNumber: item.rowNumber ?? index + 1
        }))
      })

      if (result.createdCount > 0) {
        await recalculateProjectCostSummaryFactory({ db: projectDb })({
          projectId
        })
      }

      return res.status(200).send({
        projectId,
        createdCount: result.createdCount,
        failedCount: result.failedCount,
        createdItems: result.createdItems,
        failedRows: result.failedRows
      })
    }
  )

  // 2. 导出 Excel 接口 (普通用户 Session 鉴权)
  app.get(
    '/api/v1/projects/:projectId/quality-acceptance/forms/export-excel',
    authMiddlewareCreator(
      streamReadPermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const isTemplate = req.query.template === 'true'

        const headers = [
          '验收单名称',
          '编码',
          '检验批编号',
          '区域部位',
          '检验批内容',
          '验收日期',
          '工程量',
          '单位',
          '月度验工',
          '关联构件ID'
        ]

        let rows: any[] = []

        if (!isTemplate) {
          const q = projectDb('quality_acceptance_forms')
            .where('project_id', projectId)
            .orderBy('updatedAt', 'desc')

          const approveStatus = req.query.approveStatus as string | undefined
          if (approveStatus) {
            if (approveStatus === '__NULL__') {
              q.andWhere(function() {
                this.whereNull('approveStatus').orWhere('approveStatus', '')
              })
            } else {
              q.andWhere('approveStatus', approveStatus)
            }
          }

          const search = req.query.search as string | undefined
          if (search && search.trim()) {
            const searchPattern = `%${search.trim()}%`
            q.andWhere(function() {
              this.whereILike('name', searchPattern)
                .orWhereILike('code', searchPattern)
                .orWhereILike('inspectionLotNumber', searchPattern)
                .orWhereILike('acceptancePart', searchPattern)
                .orWhereILike('acceptanceContent', searchPattern)
            })
          }

          const items = await q

          rows = items.map((item) => {
            const name = item.name || ''
            const code = item.code || ''
            const inspectionLotNumber = item.inspectionLotNumber || ''
            const acceptancePart = item.acceptancePart || ''
            const acceptanceContent = item.acceptanceContent || ''
            const actualFinishDate = formatExportDate(item.actualFinishDate)
            const workVolumeVal = item.workVolume === null || item.workVolume === undefined 
              ? '' 
              : Number.parseFloat(item.workVolume)
            const unit = item.unit || ''
            const approveStatusVal = getStatusText(item.approveStatus)
            const bimIdsStr = getBimIdsString(item.BIM)

            return [
              name,
              code,
              inspectionLotNumber,
              acceptancePart,
              acceptanceContent,
              actualFinishDate,
              Number.isNaN(workVolumeVal) ? '' : workVolumeVal,
              unit,
              approveStatusVal,
              bimIdsStr
            ]
          })
        }

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, '质量验收')

        const fileContent = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
        const safeProjectName = project.name.replace(/[\\/:*?"<>|]/g, '_')
        const encodedFileName = encodeURIComponent(`${safeProjectName}-质量验收.xlsx`)

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        res.setHeader(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodedFileName}`
        )
        return res.send(fileContent)
      } catch (e) {
        req.log.error(ensureError(e), 'Quality acceptance export error')
        return res.status(500).json({ error: getErrorMessage(e) })
      }
    }
  )

  // 3. 导入 Excel 接口 (普通用户 Session 鉴权)
  app.post(
    '/api/v1/projects/:projectId/quality-acceptance/forms/import-excel',
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      const project = await getStream({ streamId: projectId })
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' })
      }

      let busboy: Busboy.Busboy
      try {
        busboy = createBusboy(req)
      } catch (err) {
        return res.status(400).json({ error: getErrorMessage(err) })
      }

      let isFinished = false
      let fileProcessed = false

      busboy.on('file', (name, file, info) => {
        if (fileProcessed) {
          file.resume()
          return
        }
        fileProcessed = true

        const chunks: Buffer[] = []
        file.on('data', (chunk) => {
          chunks.push(chunk)
        })

        file.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks)
            if (buffer.length === 0) {
              throw new Error('上传的 Excel 文件为空')
            }

            const workbook = XLSX.read(buffer, { type: 'buffer' })
            const firstSheetName = workbook.SheetNames[0]
            if (!firstSheetName) {
              throw new Error('Excel 中未找到工作表')
            }

            const sheet = workbook.Sheets[firstSheetName]
            
            // 构建项目下的构件唯一编码映射表，以便补全完整的 BIM
            const projectDb = await getProjectDbClient({ projectId })
            const bimMap = await buildBimNodesMap(projectDb, projectId)
            const importRows = parseImportRows(sheet, bimMap)

            const result = await importQualityAcceptanceFormsFactory({
              db,
              projectDb
            })({
              projectId,
              actorUserId: userId,
              items: importRows
            })

            if (result.createdCount > 0) {
              await recalculateProjectCostSummaryFactory({ db: projectDb })({
                projectId
              })
            }

            isFinished = true
            return res.status(200).json({
              success: true,
              createdCount: result.createdCount,
              failedCount: result.failedCount,
              failedRows: result.failedRows?.map((fr) => `第 ${fr.rowNumber} 行: ${fr.error}`) || []
            })
          } catch (e) {
            req.log.error(ensureError(e), 'Quality acceptance import error')
            isFinished = true
            return res.status(400).json({ error: getErrorMessage(e) })
          }
        })
      })

      busboy.on('error', (err: unknown) => {
        if (!isFinished) {
          isFinished = true
          return res.status(400).json({ error: getErrorMessage(err) })
        }
      })

      busboy.on('finish', () => {
        if (!fileProcessed && !isFinished) {
          isFinished = true
          return res.status(400).json({ error: '没有上传文件' })
        }
      })

      req.pipe(busboy)
    }
  )

  return app
}

const formatExportDate = (date: any) => {
  if (date === null || date === undefined || date === '') return ''
  const numeric = Number(date)
  if (!Number.isNaN(numeric) && numeric > 0) {
    return dayjs(numeric).format('YYYY-MM-DD')
  }
  const parsed = dayjs(String(date))
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
}

const getStatusText = (status: string | null | undefined) => {
  switch (status) {
    case 'START':
      return '待查验'
    case 'PENDING':
      return '正在查验'
    case 'APPROVED':
      return '已查验'
    case 'REJECTED':
      return '已拒绝'
    case 'CANCELED':
      return '已取消'
    case null:
    case '':
      return '未查验'
    default:
      return status || '-'
  }
}

const getBimIdsString = (bim: any) => {
  if (!bim) return ''
  let bimArr = bim
  if (typeof bim === 'string') {
    try {
      bimArr = JSON.parse(bim)
    } catch {
      return ''
    }
  }
  if (!Array.isArray(bimArr)) return ''
  const ids = bimArr.flatMap((entry: any) => entry.bimIds || [])
  return ids.filter((id: any) => typeof id === 'string' && !!id.trim()).join(', ')
}

const parseExcelDate = (raw: any): number | null => {
  if (typeof raw === 'number') {
    if (raw > 100000000000) return raw
    const excelDate = XLSX.SSF.parse_date_code(raw)
    if (!excelDate) return null
    return new Date(
      excelDate.y,
      excelDate.m - 1,
      excelDate.d,
      excelDate.H,
      excelDate.M,
      excelDate.S
    ).getTime()
  }
  const parsed = dayjs(String(raw).trim())
  return parsed.isValid() ? parsed.valueOf() : null
}

const parseApproveStatus = (value: string): string | null | undefined => {
  const normalized = value.trim().toUpperCase()
  if (!normalized) return null
  if (
    normalized === '-' ||
    normalized === 'NULL' ||
    normalized === 'NONE' ||
    normalized === 'N/A' ||
    value.trim() === '未查验' ||
    value.trim() === '未验工'
  ) {
    return null
  }
  const statusMap: Record<string, string> = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELED: 'CANCELED',
    正在查验: 'PENDING',
    已查验: 'APPROVED',
    已拒绝: 'REJECTED',
    已取消: 'CANCELED'
  }
  return statusMap[normalized] || statusMap[value.trim()]
}

const parseImportRows = (sheet: XLSX.WorkSheet, bimMap: Map<string, Array<{ modelId: string, applicationId: string }>>) => {
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    defval: ''
  })
  if (matrix.length < 2) {
    throw new Error('Excel 中没有可导入的数据')
  }

  const headerRow = matrix[0].map((cell: any) => String(cell ?? '').trim())
  const findHeaderIndex = (keys: string[]) => {
    return headerRow.findIndex((cell: string) => keys.includes(cell))
  }

  const nameIndex = findHeaderIndex(['验收单名称', '名称'])
  const codeIndex = findHeaderIndex(['编码', '验收编码'])
  const inspectionLotNumberIndex = findHeaderIndex(['检验批编号'])
  const acceptancePartIndex = findHeaderIndex(['区域部位'])
  const acceptanceContentIndex = findHeaderIndex(['检验批内容', '验收内容'])
  const actualFinishDateIndex = findHeaderIndex(['验收日期'])
  const workVolumeIndex = findHeaderIndex(['工程量'])
  const unitIndex = findHeaderIndex(['单位'])
  const approveStatusIndex = findHeaderIndex(['月度验工', '验工状态', 'approveStatus'])
  const bimIdsIndex = findHeaderIndex(['关联构件ID', '关联构件', '构件ID', 'bimNodes'])

  if (
    inspectionLotNumberIndex < 0 ||
    acceptancePartIndex < 0 ||
    acceptanceContentIndex < 0
  ) {
    throw new Error('模板缺少必要列：检验批编号、区域部位、检验批内容')
  }

  const importRows = []

  for (let index = 0; index < matrix.length - 1; index++) {
    const row = matrix[index + 1]
    const rowNumber = index + 2

    const readValue = (cellIndex: number) => {
      if (cellIndex < 0) return ''
      return String(row[cellIndex] ?? '').trim()
    }

    const readRawValue = (cellIndex: number) => {
      if (cellIndex < 0) return ''
      return row[cellIndex]
    }

    const name = readValue(nameIndex)
    const code = readValue(codeIndex)
    const inspectionLotNumber = readValue(inspectionLotNumberIndex)
    const acceptancePart = readValue(acceptancePartIndex)
    const acceptanceContent = readValue(acceptanceContentIndex)
    const actualFinishDateRaw = readRawValue(actualFinishDateIndex)
    const workVolumeRaw = readValue(workVolumeIndex)
    const unit = readValue(unitIndex)
    const approveStatusRaw = readValue(approveStatusIndex)
    const bimIdsRaw = readValue(bimIdsIndex)

    if (
      !name &&
      !code &&
      !inspectionLotNumber &&
      !acceptancePart &&
      !acceptanceContent &&
      !String(actualFinishDateRaw ?? '').trim() &&
      !workVolumeRaw &&
      !unit &&
      !approveStatusRaw &&
      !bimIdsRaw
    ) {
      continue
    }

    if (!inspectionLotNumber || !acceptancePart || !acceptanceContent) {
      throw new Error(`第 ${rowNumber} 行缺少必要字段（检验批编号/区域部位/检验批内容）`)
    }

    let actualFinishDate: number | null = null
    if (String(actualFinishDateRaw ?? '').trim()) {
      actualFinishDate = parseExcelDate(actualFinishDateRaw)
      if (!actualFinishDate) {
        throw new Error(`第 ${rowNumber} 行验收日期格式不正确`)
      }
    }

    let workVolume: number | null = null
    if (workVolumeRaw) {
      const parsed = Number.parseFloat(workVolumeRaw)
      if (Number.isNaN(parsed)) {
        throw new Error(`第 ${rowNumber} 行工程量不是有效数字`)
      }
      workVolume = parsed
    }

    const approveStatus = approveStatusRaw ? parseApproveStatus(approveStatusRaw) : null
    if (approveStatusRaw && approveStatus === undefined) {
      throw new Error(`第 ${rowNumber} 行月度验工状态不正确：${approveStatusRaw}`)
    }

    // 根据唯一构件编码 (bimIds) 解析补全 BIM 对象属性 (modelId, applicationId)
    let BIM = null
    if (bimIdsRaw) {
      const bimIds = bimIdsRaw
        .split(/[,，;；]/)
        .map((s: string) => s.trim())
        .filter(Boolean)
      if (bimIds.length > 0) {
        const bimEntryMap = new Map<string, { modelId: string, applicationIds: string[], bimIds: string[] }>()
        for (const bimId of bimIds) {
          const matches = bimMap.get(bimId) || []
          if (matches.length > 0) {
            for (const match of matches) {
              if (!bimEntryMap.has(match.modelId)) {
                bimEntryMap.set(match.modelId, {
                  modelId: match.modelId,
                  applicationIds: [],
                  bimIds: []
                })
              }
              const entry = bimEntryMap.get(match.modelId)!
              entry.applicationIds.push(match.applicationId)
              entry.bimIds.push(bimId)
            }
          } else {
            // 兜底逻辑：若无法匹配项目下任何模型构件，则视作 modelId = ''，保留输入
            const defaultModelId = ''
            if (!bimEntryMap.has(defaultModelId)) {
              bimEntryMap.set(defaultModelId, {
                modelId: defaultModelId,
                applicationIds: [],
                bimIds: []
              })
            }
            const entry = bimEntryMap.get(defaultModelId)!
            entry.applicationIds.push(bimId)
            entry.bimIds.push(bimId)
          }
        }
        BIM = Array.from(bimEntryMap.values())
      }
    }

    importRows.push({
      rowNumber,
      flowId: null,
      name: name || acceptancePart,
      code: code || null,
      inspectionLotNumber,
      acceptancePart,
      acceptanceContent,
      actualStartDate: actualFinishDate,
      actualFinishDate,
      inspector: null,
      attachments: [],
      workVolume,
      unit: unit || null,
      BIM,
      approveStatus
    })
  }

  return importRows
}

const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message
  return String(e)
}

// 在后端内存中构建 bimId 到 modelId / applicationId 的映射关系表 (等价于前端 WorldTree.ts 机制)
const buildBimNodesMap = async (projectDb: any, projectId: string) => {
  const bimIdMap = new Map<string, Array<{ modelId: string, applicationId: string }>>()
  try {
    // 1. 获取项目下所有的模型版本
    const commits = await projectDb('commits')
      .join('stream_commits', 'commits.id', 'stream_commits.commitId')
      .where('stream_commits.streamId', projectId)
      .select('commits.id as commitId', 'commits.referencedObject')

    if (!commits.length) return bimIdMap

    const commitIdMap = new Map<string, string>() // referencedObject.id -> commitId
    for (const c of commits) {
      commitIdMap.set(c.referencedObject, c.commitId)
    }

    // 2. 获取对应的所有顶层三维根对象，提取闭包映射，用以做版本归属判定
    const rootObjectIds = commits.map((c: any) => c.referencedObject)
    const rootObjects = await projectDb('objects')
      .whereIn('id', rootObjectIds)
      .select('id', 'data')

    const objectToModelsMap = new Map<string, Set<string>>() // objectId -> Set of commitIds
    for (const rootObj of rootObjects) {
      const commitId = commitIdMap.get(rootObj.id)
      if (!commitId) continue

      const data = typeof rootObj.data === 'string' ? JSON.parse(rootObj.data) : rootObj.data
      const closure = data?.__closure || {}
      for (const childId of Object.keys(closure)) {
        if (!objectToModelsMap.has(childId)) {
          objectToModelsMap.set(childId, new Set())
        }
        objectToModelsMap.get(childId)!.add(commitId)
      }
      
      if (!objectToModelsMap.has(rootObj.id)) {
        objectToModelsMap.set(rootObj.id, new Set())
      }
      objectToModelsMap.get(rootObj.id)!.add(commitId)
    }

    // 3. 拉取项目下所有的构件数据并在内存中装配
    const objects = await projectDb('objects')
      .where('streamId', projectId)
      .select('id', 'data')

    const modelDefaultSpaceCode = new Map<string, string>() // commitId -> spaceCode
    for (const obj of objects) {
      const data = typeof obj.data === 'string' ? JSON.parse(obj.data) : obj.data
      if (isProjectInfoNode(data)) {
        const sc = getPropertyValue(data, ['空间代码', 'spacecode'])
        if (sc) {
          const belongsToCommits = objectToModelsMap.get(obj.id)
          if (belongsToCommits) {
            for (const cid of belongsToCommits) {
              modelDefaultSpaceCode.set(cid, sc)
            }
          }
        }
      }
    }

    for (const obj of objects) {
      const data = typeof obj.data === 'string' ? JSON.parse(obj.data) : obj.data
      if (isProjectInfoNode(data)) continue

      const classCode = getPropertyValue(data, ['分类对象代码', 'classificationobjectcode']) || ''
      const sectionCode = getPropertyValue(data, ['分部分项代码', 'sectionitemcode']) || ''
      const serialNum = getPropertyValue(data, ['序号码', '序号', 'serialnumber']) || ''

      if (!classCode || !sectionCode || !serialNum) continue

      const belongsToCommits = objectToModelsMap.get(obj.id)
      if (!belongsToCommits) continue

      for (const cid of belongsToCommits) {
        const spaceCode = getPropertyValue(data, ['空间代码', 'spacecode']) || modelDefaultSpaceCode.get(cid) || ''
        if (spaceCode) {
          const bimId = classCode + spaceCode + sectionCode + serialNum
          if (bimId.trim()) {
            if (!bimIdMap.has(bimId)) {
              bimIdMap.set(bimId, [])
            }
            bimIdMap.get(bimId)!.push({
              modelId: cid,
              applicationId: obj.id
            })
          }
        }
      }
    }
  } catch (err) {
    // 容错日志，但不影响主导入流程运行
    console.error('Failed to build bimNodesMap in backend:', err)
  }

  return bimIdMap
}

const isProjectInfoNode = (raw: any): boolean => {
  if (!raw) return false

  const category = raw.category
  if (typeof category === 'string' && (category === '项目信息' || category.toLowerCase() === 'project information' || category.toLowerCase() === 'project info')) {
    return true
  }

  const name = raw.name
  if (typeof name === 'string' && (name === '项目信息' || name.toLowerCase() === 'project information' || name.toLowerCase() === 'project info')) {
    return true
  }

  const type = raw.type || raw.speckle_type
  if (typeof type === 'string' && (type.includes('ProjectInformation') || type.includes('ProjectInfo') || type.includes('项目信息'))) {
    return true
  }

  return false
}

const getPropertyValue = (raw: any, aliases: string[]): string | null => {
  if (!raw || typeof raw !== 'object') return null

  const clean = (val: string) => val.toLowerCase().replace(/[\s_.:/\\()[\]{}（）-]/g, '')
  const normalizedAliases = aliases.map(clean)

  const entries: Array<{ key: string; path: string; value: any }> = []
  const visited = new Set()

  const flatten = (obj: any, currentPath = '') => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || visited.has(obj)) return
    visited.add(obj)

    const ignoredKeys = [
      '__closure',
      'displayMesh',
      'displayValue',
      'totalChildrenCount',
      '__importedUrl',
      '__parents',
      'bbox'
    ]

    for (const [key, rawValue] of Object.entries(obj)) {
      if (ignoredKeys.includes(key)) continue

      const newPath = currentPath ? `${currentPath}.${key}` : key

      if (
        rawValue &&
        typeof rawValue === 'object' &&
        !Array.isArray(rawValue) &&
        'name' in rawValue &&
        'value' in rawValue
      ) {
        const param = rawValue as { name?: any; value?: any }
        const parameterName = typeof param.name === 'string' && param.name.length ? param.name : key
        entries.push({
          key: parameterName,
          path: newPath,
          value: param.value
        })
        continue
      }

      if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
        flatten(rawValue, newPath)
        continue
      }

      entries.push({
        key,
        path: newPath,
        value: rawValue
      })
    }
  }

  flatten(raw)

  const formatVal = (value: any): string | null => {
    if (value === null || value === undefined || value === '') return null
    if (Array.isArray(value)) return value.length ? value.join(', ') : null
    if (typeof value === 'object') return null
    return String(value)
  }

  const exactMatch = entries.find((entry) => {
    const keyNorm = clean(entry.key)
    const pathNorm = clean(entry.path)
    return normalizedAliases.some((alias) => keyNorm === alias || pathNorm === alias)
  })
  if (exactMatch) return formatVal(exactMatch.value)

  const fuzzyMatch = entries.find((entry) => {
    const keyNorm = clean(entry.key)
    const pathNorm = clean(entry.path)
    return normalizedAliases.some(
      (alias) => keyNorm.includes(alias) || pathNorm.includes(alias)
    )
  })
  if (fuzzyMatch) return formatVal(fuzzyMatch.value)

  return null
}

