import type { ObjectStorage } from '@/modules/blobstorage/clients/objectStorage'
import { getBlobMetadataFactory } from '@/modules/blobstorage/repositories'
import { getObjectStreamFactory } from '@/modules/blobstorage/repositories/blobs'
import { getFileStreamFactory } from '@/modules/blobstorage/services/management'
import {
  createProgressActualRecordsFactory,
  type ProgressActualRecord,
  type UpsertProgressActualRecordInput
} from '@/modules/progress/repositories/progressActualRecords'
import { syncImportedActualRecordsDerivedDataFactory } from '@/modules/progress/services/snapshotSync'
import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Knex } from 'knex'
import * as XLSXNamespace from 'xlsx'
import type { WorkBook } from 'xlsx'

const XLSX = ((XLSXNamespace as unknown as { default?: typeof XLSXNamespace })
  .default || XLSXNamespace) as typeof XLSXNamespace

type ImportActualRecordRow = UpsertProgressActualRecordInput & {
  rowNumber: number
}

const sanitizeFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'actual-progress.xlsx'

const createTempExcelFile = async (params: {
  db: Knex
  storage: ObjectStorage
  projectId: string
  blobId: string
  fileName: string
}) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'speckle-progress-actual-'))
  const safeFileName = sanitizeFileName(params.fileName)
  const extension = extname(safeFileName).toLowerCase()
  const fileName =
    extension === '.xlsx' || extension === '.xls'
      ? safeFileName
      : `${safeFileName}.xlsx`
  const tempFilePath = join(tempDir, fileName)

  const getBlobMetadata = getBlobMetadataFactory({ db: params.db })
  const getFileStream = getFileStreamFactory({ getBlobMetadata })
  const getObjectStream = getObjectStreamFactory({ storage: params.storage })
  const fileStream = await getFileStream({
    getObjectStream,
    streamId: params.projectId,
    blobId: params.blobId
  })

  await pipeline(fileStream, createWriteStream(tempFilePath))
  return { tempDir, tempFilePath }
}

const normalizeCell = (value: unknown) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const normalizeNullableCell = (value: unknown) => {
  const normalized = normalizeCell(value)
  return normalized || null
}

const buildConstructionLog = (params: {
  constructionRecord?: string | null
  qualityRecord?: string | null
  safetyRecord?: string | null
}) =>
  [params.constructionRecord, params.qualityRecord, params.safetyRecord]
    .map((value) => normalizeCell(value))
    .filter(Boolean)
    .join('\n')

const formatDateParts = (year: number, month: number, day: number) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day
  ).padStart(2, '0')}`

const parseExcelDate = (raw: unknown, rowNumber: number) => {
  if (typeof raw === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(raw)
    if (!excelDate) {
      throw new Error(`第 ${rowNumber} 行日期格式不正确`)
    }

    return formatDateParts(excelDate.y, excelDate.m, excelDate.d)
  }

  const normalized = normalizeCell(raw)
  if (!normalized) {
    throw new Error(`第 ${rowNumber} 行缺少日期`)
  }

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

const parseImportRows = (workbook: WorkBook): ImportActualRecordRow[] => {
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('Excel 中未找到工作表')
  }

  const sheet = workbook.Sheets[firstSheetName]
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    defval: ''
  })

  if (matrix.length < 2) {
    throw new Error('Excel 中没有可导入的数据')
  }

  const headerRow = matrix[0].map((cell: string | number | null) => normalizeCell(cell))
  const dateIndex = findHeaderIndex(headerRow, ['日期'])
  const remarkIndex = findHeaderIndex(headerRow, ['备注'])
  const highTemperatureIndex = findHeaderIndex(headerRow, ['最高气温（℃）', '最高气温'])
  const lowTemperatureIndex = findHeaderIndex(headerRow, ['最低气温（℃）', '最低气温'])
  const morningWeatherIndex = findHeaderIndex(headerRow, ['上午气候'])
  const afternoonWeatherIndex = findHeaderIndex(headerRow, ['下午气候'])
  const nightConditionIndex = findHeaderIndex(headerRow, ['夜间', '夜间情况'])
  const constructionRecordIndex = findHeaderIndex(headerRow, ['施工情况记录'])
  const qualityRecordIndex = findHeaderIndex(headerRow, ['质量情况'])
  const safetyRecordIndex = findHeaderIndex(headerRow, ['安全情况'])
  const mortarConcreteSampleRecordIndex = findHeaderIndex(headerRow, [
    '砂浆、砼试块',
    '砂浆、砼试块情况'
  ])
  const materialEquipmentRecordIndex = findHeaderIndex(headerRow, [
    '设备、材料、构件、机具等进场',
    '设备、材料、构件、机具进场情况'
  ])
  const siteAppearanceRecordIndex = findHeaderIndex(headerRow, [
    '场容场貌',
    '场容场貌情况'
  ])
  const overtimeRecordIndex = findHeaderIndex(headerRow, ['加班情况'])
  const otherRecordIndex = findHeaderIndex(headerRow, ['其他', '其他情况'])
  const siteLeaderIndex = findHeaderIndex(headerRow, ['现场负责人'])
  const reporterIndex = findHeaderIndex(headerRow, ['记录人'])
  const taskNameIndex = findHeaderIndex(headerRow, ['计划任务', '任务名称', '任务'])

  if (dateIndex < 0) {
    throw new Error('模板缺少必要列：日期')
  }

  const rows: ImportActualRecordRow[] = []
  matrix.slice(1).forEach((row: Array<string | number | null>, index: number) => {
    const rowNumber = index + 2
    const readCell = (cellIndex: number) => {
      if (cellIndex < 0) return ''
      return row[cellIndex] ?? ''
    }

    const rowValues = row.map((cell: string | number | null) => normalizeCell(cell))
    if (!rowValues.some(Boolean)) return

    const reportDate = parseExcelDate(readCell(dateIndex), rowNumber)
    const remark = normalizeNullableCell(readCell(remarkIndex))
    const taskName =
      normalizeCell(readCell(taskNameIndex)) || remark || `实际进度导入-${reportDate}`
    const constructionRecord = normalizeNullableCell(readCell(constructionRecordIndex))
    const qualityRecord = normalizeNullableCell(readCell(qualityRecordIndex))
    const safetyRecord = normalizeNullableCell(readCell(safetyRecordIndex))

    rows.push({
      rowNumber,
      taskName,
      reportDate,
      remark,
      highTemperature: normalizeNullableCell(readCell(highTemperatureIndex)),
      lowTemperature: normalizeNullableCell(readCell(lowTemperatureIndex)),
      morningWeather: normalizeNullableCell(readCell(morningWeatherIndex)),
      afternoonWeather: normalizeNullableCell(readCell(afternoonWeatherIndex)),
      nightCondition: normalizeNullableCell(readCell(nightConditionIndex)),
      constructionRecord,
      qualityRecord,
      safetyRecord,
      mortarConcreteSampleRecord: normalizeNullableCell(
        readCell(mortarConcreteSampleRecordIndex)
      ),
      materialEquipmentRecord: normalizeNullableCell(
        readCell(materialEquipmentRecordIndex)
      ),
      siteAppearanceRecord: normalizeNullableCell(readCell(siteAppearanceRecordIndex)),
      overtimeRecord: normalizeNullableCell(readCell(overtimeRecordIndex)),
      otherRecord: normalizeNullableCell(readCell(otherRecordIndex)),
      siteLeader: normalizeNullableCell(readCell(siteLeaderIndex)),
      reporter: normalizeNullableCell(readCell(reporterIndex)),
      constructionLog: buildConstructionLog({
        constructionRecord,
        qualityRecord,
        safetyRecord
      })
    })
  })

  if (!rows.length) {
    throw new Error('Excel 中没有可导入的数据')
  }

  return rows
}

export const importProgressActualRecordsFromBlobFactory =
  (deps: { db: Knex; storage: ObjectStorage }) =>
  async (params: {
    projectId: string
    blobId: string
    fileName: string
    actorId: string
  }): Promise<ProgressActualRecord[]> => {
    const { tempDir, tempFilePath } = await createTempExcelFile({
      db: deps.db,
      storage: deps.storage,
      projectId: params.projectId,
      blobId: params.blobId,
      fileName: params.fileName
    })

    try {
      const workbook = XLSX.readFile(tempFilePath, { cellDates: false })
      const rows = parseImportRows(workbook)

      return await deps.db.transaction(async (trx) => {
        const records = await createProgressActualRecordsFactory({ db: trx })({
          projectId: params.projectId,
          actorId: params.actorId,
          inputs: rows.map((row) => {
            const { rowNumber, ...input } = row
            void rowNumber
            return input
          })
        })

        await syncImportedActualRecordsDerivedDataFactory({ db: trx })({
          projectId: params.projectId,
          records,
          actorId: params.actorId
        })

        return records
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
