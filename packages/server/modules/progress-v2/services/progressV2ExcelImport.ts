/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */
import {
  createProgressV2ActualRecordFactory,
  getProgressV2ActualRecordByIdFactory,
  updateProgressV2ActualRecordFactory
} from '@/modules/progress-v2/repositories/progressV2ActualRecords'
import type { Knex } from 'knex'
import * as XLSXNamespace from 'xlsx'
import type { WorkBook } from 'xlsx'

const XLSX = ((XLSXNamespace as unknown as { default?: typeof XLSXNamespace })
  .default || XLSXNamespace) as typeof XLSXNamespace

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

const normalizeCell = (value: unknown) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const normalizeNullableCell = (value: unknown) => {
  const normalized = normalizeCell(value)
  return normalized || null
}

const formatDateParts = (year: number, month: number, day: number) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day
  ).padStart(2, '0')}`

const parseExcelDate = (raw: unknown, rowNumber: number): string => {
  if (typeof raw === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(raw)
    if (!excelDate) throw new Error(`第 ${rowNumber} 行日期格式不正确`)
    return formatDateParts(excelDate.y, excelDate.m, excelDate.d)
  }

  const normalized = normalizeCell(raw)
  if (!normalized) throw new Error(`第 ${rowNumber} 行缺少日期`)

  const match = normalized.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
  if (match) {
    return formatDateParts(Number(match[1]), Number(match[2]), Number(match[3]))
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`第 ${rowNumber} 行日期格式不正确`)
  }

  return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate())
}

const findHeaderIndex = (headerRow: string[], keys: string[]) =>
  headerRow.findIndex((cell) => keys.includes(cell))

const splitCodes = (value: string) =>
  value
    .split(/[,，;；、\n\r\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

// ---------------------------------------------------------------------------
// BIM 构造编码 → {modelId, applicationIds} 反查映射
// 参考前端 Viewer 规则：优先直接读取构件编码，否则拼接
// 分类对象代码 + 空间代码 + 分部分项代码 + 序号码
// ---------------------------------------------------------------------------

const getPropertyValue = (raw: any, aliases: string[]): string | null => {
  if (!raw || typeof raw !== 'object') return null

  const clean = (val: string) =>
    val.toLowerCase().replace(/[\s_.:/\\()[\]{}（）-]/g, '')
  const normalizedAliases = aliases.map(clean)

  const entries: Array<{ key: string; path: string; value: any }> = []
  const visited = new Set()

  const flatten = (obj: any, currentPath = '') => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || visited.has(obj))
      return
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
        const parameterName =
          typeof param.name === 'string' && param.name.length ? param.name : key
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

const isProjectInfoNode = (raw: any): boolean => {
  if (!raw) return false

  const ifcType = raw.ifcType
  if (
    typeof ifcType === 'string' &&
    (ifcType === 'IfcSite' || ifcType === 'IfcBuilding' || ifcType === 'IfcProject')
  ) {
    return true
  }

  const category = raw.category
  if (
    typeof category === 'string' &&
    (category === '项目信息' ||
      category.toLowerCase() === 'project information' ||
      category.toLowerCase() === 'project info')
  ) {
    return true
  }

  const name = raw.name
  if (
    typeof name === 'string' &&
    (name === '项目信息' ||
      name.toLowerCase() === 'project information' ||
      name.toLowerCase() === 'project info')
  ) {
    return true
  }

  const type = raw.type || raw.speckle_type
  if (
    typeof type === 'string' &&
    (type.includes('ProjectInformation') ||
      type.includes('ProjectInfo') ||
      type.includes('项目信息'))
  ) {
    return true
  }

  return false
}

type BimNode = { modelId: string; applicationId: string }

const buildComponentCodeToBimNodesMap = async (
  projectDb: any,
  projectId: string
): Promise<Map<string, BimNode[]>> => {
  const codeMap = new Map<string, BimNode[]>()
  try {
    // 1. 项目下的所有模型版本 (commits)
    const commits = await projectDb('commits')
      .join('stream_commits', 'commits.id', 'stream_commits.commitId')
      .where('stream_commits.streamId', projectId)
      .select('commits.id as commitId', 'commits.referencedObject')

    if (!commits.length) return codeMap

    const commitIds = commits.map((c: any) => c.commitId)
    const branchCommits = await projectDb('branch_commits')
      .whereIn('commitId', commitIds)
      .select('branchId', 'commitId')
    const commitToBranchMap = new Map<string, string>()
    for (const bc of branchCommits) {
      commitToBranchMap.set(bc.commitId, bc.branchId)
    }

    const commitIdMap = new Map<string, string>() // referencedObject -> commitId
    for (const c of commits) {
      commitIdMap.set(c.referencedObject, c.commitId)
    }

    // 2. 根部对象的 __closure 建立 objectId -> commitIds 归属（决定 modelId）
    const rootObjectIds = commits.map((c: any) => c.referencedObject)
    const rootObjects = await projectDb('objects')
      .whereIn('id', rootObjectIds)
      .select('id', 'data')

    const objectToModelsMap = new Map<string, Set<string>>()
    for (const rootObj of rootObjects) {
      const commitId = commitIdMap.get(rootObj.id)
      if (!commitId) continue

      const data =
        typeof rootObj.data === 'string' ? JSON.parse(rootObj.data) : rootObj.data
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

    // 3. 拉取项目所有构件对象
    const objects = await projectDb('objects')
      .where('streamId', projectId)
      .select('id', 'data')

    // 每个模型缺省空间代码（模型信息节点）
    const defaultSpaceCode = new Map<string, string>()
    for (const obj of objects) {
      const data = typeof obj.data === 'string' ? JSON.parse(obj.data) : obj.data
      if (!isProjectInfoNode(data)) continue
      const sc = getPropertyValue(data, ['空间代码', 'spacecode'])
      if (sc) {
        const belongsToCommits = objectToModelsMap.get(obj.id)
        if (belongsToCommits) {
          for (const cid of belongsToCommits) {
            defaultSpaceCode.set(cid, sc)
          }
        }
      }
    }

    // 4. 计算每个构件的构造编码并建立反查映射
    for (const obj of objects) {
      const data = typeof obj.data === 'string' ? JSON.parse(obj.data) : obj.data
      if (isProjectInfoNode(data)) continue

      const directCode = getPropertyValue(data, [
        '构件编码',
        'componentcode',
        'bimcode'
      ])
      const classCode =
        getPropertyValue(data, ['分类对象代码', 'classificationobjectcode']) || ''
      const sectionCode =
        getPropertyValue(data, ['分部分项代码', 'sectionitemcode']) || ''
      const serialNum = getPropertyValue(data, ['序号码', '序号', 'serialnumber']) || ''
      const spaceCode = getPropertyValue(data, ['空间代码', 'spacecode']) || ''

      const belongsToCommits = objectToModelsMap.get(obj.id)
      if (!belongsToCommits || !belongsToCommits.size) continue

      const applicationId =
        data.applicationId ||
        data.properties?.Attributes?.GlobalId ||
        data.GlobalId ||
        obj.id

      for (const cid of belongsToCommits) {
        const effectiveSpaceCode = spaceCode || defaultSpaceCode.get(cid) || ''
        const fullCode =
          directCode ||
          (classCode && (serialNum || sectionCode)
            ? `${classCode}${effectiveSpaceCode}${sectionCode}${serialNum}`
            : '')
        if (!fullCode) continue

        if (!codeMap.has(fullCode)) codeMap.set(fullCode, [])
        codeMap.get(fullCode)!.push({
          modelId: commitToBranchMap.get(cid) || cid,
          applicationId
        })
      }
    }
  } catch (err) {
    // 容错日志，不影响导入主流程
    console.error('Failed to build component code BIM map in backend:', err)
  }

  return codeMap
}

// ---------------------------------------------------------------------------
// 导入行解析
// ---------------------------------------------------------------------------

type ImportActualRecordRow = {
  rowNumber: number
  id: string | null
  taskName: string
  reportDate: string
  planStartDate: string | null
  planEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  progressPercent: number | null
  componentCode: string | null
  reporter: string | null
  remark: string | null
}

const parseImportRows = (workbook: WorkBook): ImportActualRecordRow[] => {
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('Excel 中未找到工作表')

  const sheet = workbook.Sheets[firstSheetName]
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    defval: ''
  })

  if (matrix.length < 2) throw new Error('Excel 中没有可导入的数据')

  const headerRow = matrix[0].map((cell: string | number | null) => normalizeCell(cell))
  const idIndex = findHeaderIndex(headerRow, ['数据id', '数据ID', 'id', 'ID'])
  const taskNameIndex = findHeaderIndex(headerRow, ['任务名称', '施工任务名称', '任务'])
  const componentCodeIndex = findHeaderIndex(headerRow, ['构件编码', '构件编号'])
  const reportDateIndex = findHeaderIndex(headerRow, ['填报日期', '日期'])
  const planStartIndex = findHeaderIndex(headerRow, ['计划开始时间', '计划开始日期'])
  const planEndIndex = findHeaderIndex(headerRow, ['计划结束时间', '计划结束日期'])
  const actualStartIndex = findHeaderIndex(headerRow, ['实际开始时间', '实际开始日期'])
  const actualEndIndex = findHeaderIndex(headerRow, ['实际结束时间', '实际结束日期'])
  const progressPercentIndex = findHeaderIndex(headerRow, [
    '进度百分比',
    '完成百分比',
    '进度'
  ])
  const reporterIndex = findHeaderIndex(headerRow, ['填报人', '上传人', '记录人'])
  const remarkIndex = findHeaderIndex(headerRow, ['备注', '备注说明'])

  if (taskNameIndex < 0) throw new Error('模板缺少必要列：任务名称')
  if (reportDateIndex < 0) throw new Error('模板缺少必要列：填报日期')

  const rows: ImportActualRecordRow[] = []
  matrix.slice(1).forEach((row: Array<string | number | null>, index: number) => {
    const rowNumber = index + 2
    const readCell = (cellIndex: number) => {
      if (cellIndex < 0) return ''
      return row[cellIndex] ?? ''
    }

    const rowValues = row.map((cell: string | number | null) => normalizeCell(cell))
    if (!rowValues.some(Boolean)) return

    const readonlyDateText = normalizeCell(readCell(reportDateIndex))
    const reportDate = readonlyDateText
      ? parseExcelDate(readonlyDateText, rowNumber)
      : ''
    if (!reportDate) throw new Error(`第 ${rowNumber} 行缺少填报日期`)

    const progressRaw = normalizeCell(readCell(progressPercentIndex))
    let progressPercent: number | null = null
    if (progressRaw) {
      const parsed = Number.parseFloat(progressRaw)
      if (Number.isNaN(parsed)) {
        throw new Error(`第 ${rowNumber} 行进度百分比不是有效数字`)
      }
      progressPercent = Math.min(Math.max(Math.round(parsed), 0), 100)
    }

    const idRaw = normalizeCell(readCell(idIndex))
    rows.push({
      rowNumber,
      id: idRaw || null,
      taskName: normalizeCell(readCell(taskNameIndex)) || `进度导入-${reportDate}`,
      reportDate,
      planStartDate: normalizeNullableCell(readCell(planStartIndex)),
      planEndDate: normalizeNullableCell(readCell(planEndIndex)),
      actualStartDate: normalizeNullableCell(readCell(actualStartIndex)),
      actualEndDate: normalizeNullableCell(readCell(actualEndIndex)),
      progressPercent,
      componentCode: normalizeNullableCell(readCell(componentCodeIndex)),
      reporter: normalizeNullableCell(readCell(reporterIndex)),
      remark: normalizeNullableCell(readCell(remarkIndex))
    })
  })

  if (!rows.length) throw new Error('Excel 中没有可导入的数据')

  return rows
}

// ---------------------------------------------------------------------------
// 导入主入口
// ---------------------------------------------------------------------------

export type ProgressV2ActualRecordImportResult = {
  totalCount: number
  createdCount: number
  updatedCount: number
  failedRows: Array<{ rowNumber: number; error: string }>
}

const resolveBimFromCodes = (
  codes: string[],
  bimMap: Map<string, BimNode[]>
): Array<{ modelId: string; applicationIds: string[]; componentCodes: string[] }> => {
  const byModel = new Map<
    string,
    { modelId: string; applicationIds: string[]; codes: string[] }
  >()
  for (const code of codes) {
    const nodes = bimMap.get(code) || []
    if (!nodes.length) continue
    for (const node of nodes) {
      if (!byModel.has(node.modelId)) {
        byModel.set(node.modelId, {
          modelId: node.modelId,
          applicationIds: [],
          codes: []
        })
      }
      const entry = byModel.get(node.modelId)!
      entry.applicationIds.push(node.applicationId)
      entry.codes.push(code)
    }
  }
  return Array.from(byModel.values()).map((e) => ({
    modelId: e.modelId,
    applicationIds: Array.from(new Set(e.applicationIds)),
    componentCodes: Array.from(new Set(e.codes))
  }))
}

export const importProgressV2ActualRecordsFromBuffer = async (params: {
  db: Knex
  projectId: string
  buffer: Buffer
  actorId: string
}): Promise<ProgressV2ActualRecordImportResult> => {
  const workbook = XLSX.read(params.buffer, { type: 'buffer', cellDates: false })
  const rows = parseImportRows(workbook)

  const bimMap = await buildComponentCodeToBimNodesMap(params.db, params.projectId)

  const result: ProgressV2ActualRecordImportResult = {
    totalCount: rows.length,
    createdCount: 0,
    updatedCount: 0,
    failedRows: []
  }

  await params.db.transaction(async (trx) => {
    const createRecord = createProgressV2ActualRecordFactory({ db: trx })
    const updateRecord = updateProgressV2ActualRecordFactory({ db: trx })
    const getRecord = getProgressV2ActualRecordByIdFactory({ db: trx })

    for (const row of rows) {
      try {
        const codes = row.componentCode ? splitCodes(row.componentCode) : []
        const BIM = codes.length ? resolveBimFromCodes(codes, bimMap) : null
        const componentCodeValue =
          codes.length > 0 ? codes.join(', ') : row.componentCode

        const planStartDate = row.planStartDate ? new Date(row.planStartDate) : null
        const planEndDate = row.planEndDate ? new Date(row.planEndDate) : null
        const actualStartDate = row.actualStartDate
          ? new Date(row.actualStartDate)
          : null
        const actualEndDate = row.actualEndDate ? new Date(row.actualEndDate) : null

        // 已有 id 则尝试更新，否则新增
        const existing =
          row.id && (await getRecord({ id: row.id, projectId: params.projectId }))

        if (existing) {
          await updateRecord({
            id: existing.id,
            projectId: params.projectId,
            taskName: row.taskName,
            reportDate: row.reportDate,
            planStartDate,
            planEndDate,
            actualStartDate,
            actualEndDate,
            progressPercent: row.progressPercent ?? undefined,
            componentCode: componentCodeValue,
            reporter: row.reporter,
            remark: row.remark,
            BIM,
            updater: params.actorId
          })
          result.updatedCount += 1
        } else {
          await createRecord({
            projectId: params.projectId,
            taskName: row.taskName,
            reportDate: row.reportDate,
            planStartDate,
            planEndDate,
            actualStartDate,
            actualEndDate,
            progressPercent: row.progressPercent ?? 0,
            componentCode: componentCodeValue,
            reporter: row.reporter,
            remark: row.remark,
            BIM,
            creator: params.actorId,
            updater: params.actorId
          })
          result.createdCount += 1
        }
      } catch (err) {
        result.failedRows.push({
          rowNumber: row.rowNumber,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
  })

  return result
}

// ---------------------------------------------------------------------------
// 导出
// ---------------------------------------------------------------------------

export const buildProgressV2ActualRecordsExportBuffer = async (
  records: Array<Record<string, unknown>>
): Promise<Buffer> => {
  const headers = [
    '数据ID',
    '任务名称',
    '构件编码',
    '填报日期',
    '计划开始时间',
    '计划结束时间',
    '实际开始时间',
    '实际结束时间',
    '进度百分比',
    '填报人',
    '备注'
  ]

  const formatDate = (value: unknown) => {
    if (!value) return ''
    const d = value instanceof Date ? value : new Date(value as string)
    if (Number.isNaN(d.getTime())) return ''
    return formatDateParts(d.getFullYear(), d.getMonth() + 1, d.getDate())
  }

  const rows = records.map((r) => [
    (r.id as string) || '',
    (r.taskName as string) || '',
    (r.componentCode as string) || '',
    (r.reportDate as string) || '',
    formatDate(r.planStartDate),
    formatDate(r.planEndDate),
    formatDate(r.actualStartDate),
    formatDate(r.actualEndDate),
    r.progressPercent ?? '',
    (r.reporter as string) || '',
    (r.remark as string) || ''
  ])

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '进度填报')

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}
