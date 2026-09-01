import { Router, json } from 'express'
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
  updateBoqItemFactory as updateBoqItemEntryFactory,
  updateBoqItemReviewFactory
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
          '综合单价（元）',
          '合价',
          '复核量',
          '变更/签证量',
          '工程量（含签证变更）',
          '复核单价',
          '复核总价'
        ]

        const idToCodeMap = new Map(items.map((i) => [i.id, i.code]))
        const rows = items.map((item) => {
          const parentCode = item.parentId ? idToCodeMap.get(item.parentId) || '' : ''
          const labelType = childTypeLabelMap[item.type as BoqItemType] || item.type

          const quantityVal =
            item.quantity === null || item.quantity === undefined
              ? ''
              : Number.parseFloat(item.quantity)

          const priceVal =
            item.price === null || item.price === undefined
              ? ''
              : Number.parseFloat(item.price)

          const amountVal =
            item.amount === null || item.amount === undefined
              ? ''
              : Number.parseFloat(item.amount)

          const reviewQuantityVal =
            item.reviewQuantity === null || item.reviewQuantity === undefined
              ? ''
              : Number.parseFloat(item.reviewQuantity)

          const changeQuantityVal =
            item.changeQuantity === null || item.changeQuantity === undefined
              ? ''
              : Number.parseFloat(item.changeQuantity)

          const totalQtyVal =
            item.reviewQuantity !== null || item.changeQuantity !== null
              ? (Number.isNaN(reviewQuantityVal as number)
                  ? 0
                  : (reviewQuantityVal as number)) +
                (Number.isNaN(changeQuantityVal as number)
                  ? 0
                  : (changeQuantityVal as number))
              : ''

          const reviewPriceVal =
            item.reviewPrice === null || item.reviewPrice === undefined
              ? ''
              : Number.parseFloat(item.reviewPrice)

          const reviewAmountVal =
            item.reviewAmount === null || item.reviewAmount === undefined
              ? ''
              : Number.parseFloat(item.reviewAmount)

          return [
            item.code,
            item.name,
            labelType,
            parentCode,
            item.unit || '',
            Number.isNaN(quantityVal) ? '' : quantityVal,
            Number.isNaN(priceVal) ? '' : priceVal,
            Number.isNaN(amountVal) ? '' : amountVal,
            Number.isNaN(reviewQuantityVal as number) ? '' : reviewQuantityVal,
            Number.isNaN(changeQuantityVal as number) ? '' : changeQuantityVal,
            totalQtyVal === '' || Number.isNaN(totalQtyVal as number)
              ? ''
              : totalQtyVal,
            Number.isNaN(reviewPriceVal as number) ? '' : reviewPriceVal,
            Number.isNaN(reviewAmountVal as number) ? '' : reviewAmountVal
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
                getSiblingMaxSortOrder: getSiblingMaxSortOrderFactory({
                  db: projectDb
                }),
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

  // 3. 更新清单复核量/变更量/复核单价接口
  app.patch(
    '/api/v1/projects/:projectId/boq/items/:itemId/review',
    json(),
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId, itemId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      const project = await getStream({ streamId: projectId })
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' })
      }

      const { reviewQuantity, changeQuantity, reviewPrice } = req.body || {}

      const parseField = (val: unknown) => {
        if (val === undefined) return undefined
        if (val === null || val === '') return null
        const num = Number(val)
        return Number.isNaN(num) ? null : num
      }

      const projectDb = await getProjectDbClient({ projectId })
      const updateBoqItemReview = updateBoqItemReviewFactory({
        getBoqItem: getBoqItemFactory({ db: projectDb }),
        updateBoqItem: updateBoqItemFactory({ db: projectDb })
      })

      const updated = await updateBoqItemReview({
        projectId,
        itemId,
        reviewQuantity: parseField(reviewQuantity),
        changeQuantity: parseField(changeQuantity),
        reviewPrice: parseField(reviewPrice)
      })

      return res.status(200).json({
        success: true,
        item: updated
      })
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
  const amountIndex = findHeaderIndex(['合价', '合价（元）', '合同价', '合同价（元）'])
  const reviewQuantityIndex = findHeaderIndex(['复核量'])
  const changeQuantityIndex = findHeaderIndex([
    '变更/签证量',
    '变更签证量',
    '变更量',
    '签证量'
  ])
  const reviewPriceIndex = findHeaderIndex(['复核单价', '复核单价（元）'])
  const reviewAmountIndex = findHeaderIndex(['复核总价', '复核总价（元）'])

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
    const amountValue = readValue(amountIndex)
    const reviewQuantityValue = readValue(reviewQuantityIndex)
    const changeQuantityValue = readValue(changeQuantityIndex)
    const reviewPriceValue = readValue(reviewPriceIndex)
    const reviewAmountValue = readValue(reviewAmountIndex)

    if (
      !code &&
      !name &&
      !rawType &&
      !parentCode &&
      !unit &&
      !quantityValue &&
      !priceValue &&
      !amountValue &&
      !reviewQuantityValue &&
      !changeQuantityValue &&
      !reviewPriceValue &&
      !reviewAmountValue
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
    const amount = parseOptionalNumber(amountValue)
    const reviewQuantity = parseOptionalNumber(reviewQuantityValue)
    const changeQuantity = parseOptionalNumber(changeQuantityValue)
    const reviewPrice = parseOptionalNumber(reviewPriceValue)
    const reviewAmount = parseOptionalNumber(reviewAmountValue)

    if (
      (quantityValue && Number.isNaN(quantity)) ||
      (priceValue && Number.isNaN(price)) ||
      (amountValue && Number.isNaN(amount)) ||
      (reviewQuantityValue && Number.isNaN(reviewQuantity)) ||
      (changeQuantityValue && Number.isNaN(changeQuantity)) ||
      (reviewPriceValue && Number.isNaN(reviewPrice)) ||
      (reviewAmountValue && Number.isNaN(reviewAmount))
    ) {
      throw new Error(`第 ${rowNumber} 行工程量、综合单价、复核量或单价不是有效数字`)
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
      price: type === 'ITEM' ? price : null,
      amount: amount ?? null,
      reviewQuantity: type === 'ITEM' ? reviewQuantity : null,
      changeQuantity: type === 'ITEM' ? changeQuantity : null,
      reviewPrice: type === 'ITEM' ? reviewPrice : null,
      reviewAmount: reviewAmount ?? null
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
