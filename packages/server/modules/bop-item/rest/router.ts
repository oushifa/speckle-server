import { Router } from 'express'
import type { Request, Response } from 'express'
import Busboy from 'busboy'
import * as XLSX from 'xlsx'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import {
  streamWritePermissionsPipelineFactory,
  streamReadPermissionsPipelineFactory
} from '@/modules/shared/authz'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { db } from '@/db/knex'
import { createBusboy } from '@/modules/blobstorage/rest/busboy'
import { BadRequestError, UnauthorizedError } from '@/modules/shared/errors'
import { ensureError } from '@speckle/shared'
import type { BoqItemType } from '@/modules/bop-item/repositories/boq'
import {
  getBoqItemsFactory,
  getBoqItemFactory,
  getSiblingMaxSortOrderFactory,
  insertBoqItemFactory,
  updateBoqItemFactory
} from '@/modules/bop-item/repositories/boq'
import {
  createBoqItemFactory,
  importBoqItemsFactory,
  updateBoqItemFactory as updateBoqItemEntryFactory
} from '@/modules/bop-item/services/boq'
import { recalculateProjectCostSummaryFactory } from '@/modules/project-statistics/services/projectCostSummaries'

const boqTypeByLabel: Record<string, BoqItemType> = {
  PROJECT: 'PROJECT',
  SUBPROJECT: 'SUBPROJECT',
  CATEGORY: 'CATEGORY',
  SECTION: 'SECTION',
  SUBSECTION: 'SUBSECTION',
  ITEM: 'ITEM',
  单位工程: 'PROJECT',
  子单位工程: 'SUBPROJECT',
  分类工程: 'CATEGORY',
  分部工程: 'SECTION',
  分项工程: 'SUBSECTION',
  清单项: 'ITEM'
}

const childTypeLabelMap: Record<BoqItemType, string> = {
  PROJECT: '单位工程',
  SUBPROJECT: '子单位工程',
  CATEGORY: '分类工程',
  SECTION: '分部工程',
  SUBSECTION: '分项工程',
  ITEM: '清单项'
}

const parseType = (value: string): BoqItemType | null => {
  const normalized = value.trim()
  if (!normalized.length) return null
  const upperValue = normalized.toUpperCase()
  return boqTypeByLabel[upperValue] || boqTypeByLabel[normalized] || null
}

const parseOptionalNumber = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed.length) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isNaN(parsed) ? Number.NaN : parsed
}

export const bopItemRouterFactory = (): Router => {
  const app = Router()
  const getStream = getStreamFactory({ db })

  // 1. 导出 Excel 接口
  app.get(
    '/api/v1/projects/:projectId/boq/export-excel',
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
        let items = []

        const getBoqItems = getBoqItemsFactory({ db: projectDb })
        const allItems = await getBoqItems({ projectId })

        if (isTemplate) {
          items = allItems.filter((i) => i.type === 'PROJECT')
          if (items.length === 0) {
            items.push({
              id: 'PROJECT_ROOT',
              projectId,
              parentId: null,
              type: 'PROJECT',
              code: 'C01',
              name: project.name,
              unit: null,
              quantity: null,
              price: null,
              sortOrder: 0,
              depth: 0,
              createdAt: new Date(),
              updatedAt: new Date()
            } as any)
          }
        } else {
          items = allItems
        }

        const headers = [
          '清单编码',
          '清单名称',
          '类型',
          '上级编码',
          '计量单位',
          '工程量',
          '综合单价（元）'
        ]

        const idToCodeMap = new Map(items.map((i) => [i.id, i.code]))
        const rows = items.map((item) => {
          const parentCode = item.parentId ? idToCodeMap.get(item.parentId) || '' : ''
          const labelType = childTypeLabelMap[item.type as BoqItemType] || item.type
          
          const quantityVal = item.quantity === null || item.quantity === undefined 
            ? '' 
            : Number.parseFloat(item.quantity)
            
          const priceVal = item.price === null || item.price === undefined 
            ? '' 
            : Number.parseFloat(item.price)

          return [
            item.code,
            item.name,
            labelType,
            parentCode,
            item.unit || '',
            Number.isNaN(quantityVal) ? '' : quantityVal,
            Number.isNaN(priceVal) ? '' : priceVal
          ]
        })

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'BOQ')

        const fileContent = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
        const safeProjectName = project.name.replace(/[\\/:*?"<>|]/g, '_')
        const encodedFileName = encodeURIComponent(`${safeProjectName}-清单.xlsx`)

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
        req.log.error(ensureError(e), 'BOQ export error')
        return res.status(500).json({ error: getErrorMessage(e) })
      }
    }
  )

  // 2. 导入 Excel 接口
  app.post(
    '/api/v1/projects/:projectId/boq/import-excel',
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
          // 只处理上传的第一个文件
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
            const importRows = parseImportRows(sheet)

            const projectDb = await getProjectDbClient({ projectId })
            const importBoqItems = importBoqItemsFactory({
              getBoqItems: getBoqItemsFactory({ db: projectDb }),
              createBoqItem: createBoqItemFactory({
                getBoqItem: getBoqItemFactory({ db: projectDb }),
                getSiblingMaxSortOrder: getSiblingMaxSortOrderFactory({ db: projectDb }),
                insertBoqItem: insertBoqItemFactory({ db: projectDb })
              }),
              updateBoqItem: updateBoqItemEntryFactory({
                getBoqItem: getBoqItemFactory({ db: projectDb }),
                updateBoqItem: updateBoqItemFactory({ db: projectDb })
              })
            })

            const result = await importBoqItems({
              projectId,
              items: importRows
            })

            if (result.createdCount > 0 || result.updatedCount > 0) {
              await recalculateProjectCostSummaryFactory({ db: projectDb })({
                projectId
              })
            }

            isFinished = true
            return res.status(200).json({
              success: true,
              createdCount: result.createdCount,
              updatedCount: result.updatedCount
            })
          } catch (e) {
            req.log.error(ensureError(e), 'BOQ import error')
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

const parseImportRows = (sheet: XLSX.WorkSheet) => {
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    defval: ''
  })
  if (matrix.length < 2) {
    throw new Error('Excel 中没有可导入的数据')
  }

  const headerRow = matrix[0].map((cell: string | number | null) =>
    String(cell ?? '').trim()
  )
  const findHeaderIndex = (keys: string[]) => {
    return headerRow.findIndex((cell: string) => keys.includes(cell))
  }

  const codeIndex = findHeaderIndex(['清单编码', '编码'])
  const nameIndex = findHeaderIndex(['清单名称', '名称'])
  const typeIndex = findHeaderIndex(['类型'])
  const parentCodeIndex = findHeaderIndex(['上级编码', '父级编码'])
  const unitIndex = findHeaderIndex(['计量单位', '单位'])
  const quantityIndex = findHeaderIndex(['工程量'])
  const priceIndex = findHeaderIndex(['综合单价（元）', '综合单价', '单价'])

  if (codeIndex < 0 || nameIndex < 0 || typeIndex < 0) {
    throw new Error('模板缺少必要列：清单编码、清单名称、类型')
  }

  const importRows = []
  const codesInFile = new Set<string>()

  for (let index = 0; index < matrix.length - 1; index++) {
    const row = matrix[index + 1]
    const rowNumber = index + 2
    const readValue = (cellIndex: number) => {
      if (cellIndex < 0) return ''
      return String(row[cellIndex] ?? '').trim()
    }

    const code = readValue(codeIndex)
    const name = readValue(nameIndex)
    const rawType = readValue(typeIndex)
    const parentCode = readValue(parentCodeIndex)
    const unit = readValue(unitIndex)
    const quantityValue = readValue(quantityIndex)
    const priceValue = readValue(priceIndex)

    if (
      !code &&
      !name &&
      !rawType &&
      !parentCode &&
      !unit &&
      !quantityValue &&
      !priceValue
    ) {
      continue
    }

    if (!code || !name || !rawType) {
      throw new Error(`第 ${rowNumber} 行缺少必要字段（清单编码/清单名称/类型）`)
    }
    if (codesInFile.has(code)) {
      throw new Error(`第 ${rowNumber} 行清单编码重复：${code}`)
    }
    codesInFile.add(code)

    const type = parseType(rawType)
    if (!type) {
      throw new Error(`第 ${rowNumber} 行类型无法识别：${rawType}`)
    }

    const quantity = parseOptionalNumber(quantityValue)
    const price = parseOptionalNumber(priceValue)

    if (
      (quantityValue && Number.isNaN(quantity)) ||
      (priceValue && Number.isNaN(price))
    ) {
      throw new Error(`第 ${rowNumber} 行工程量或综合单价不是有效数字`)
    }

    if (type === 'ITEM') {
      if (!unit.length || quantity === null || price === null) {
        throw new Error(`第 ${rowNumber} 行清单项需填写计量单位、工程量、综合单价`)
      }
    }

    if (type !== 'PROJECT' && !parentCode.length) {
      throw new Error(`第 ${rowNumber} 行非单位工程必须填写上级编码`)
    }

    if (type === 'PROJECT' && parentCode.length) {
      throw new Error(`第 ${rowNumber} 行单位工程不能填写上级编码`)
    }

    importRows.push({
      rowNumber,
      code,
      name,
      type,
      parentCode: parentCode || null,
      unit: type === 'ITEM' ? unit : null,
      quantity: type === 'ITEM' ? quantity : null,
      price: type === 'ITEM' ? price : null
    })
  }

  if (!importRows.length) {
    throw new Error('Excel 中没有可导入的数据')
  }

  return importRows
}

const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message
  return String(e)
}
