import * as XLSX from 'xlsx'
import {
  normalizeNumberText,
  toNum,
  withQtyDefaults,
  type BoqReviewRow,
  type BoqTreeItem,
  type ReviewKind
} from './boqReviewTypes'

const ALIASES: Record<string, string[]> = {
  code: ['清单编码', '编码', '项目编码', 'code'],
  name: ['清单名称', '名称', '项目名称', 'name'],
  unit: ['计量单位', '单位', 'unit'],
  reviewQty: ['复核量', '复核工程量', 'reviewQty'],
  reviewUnitPrice: [
    '复核单价（元）',
    '复核单价(元)',
    '复核单价',
    '单价',
    'reviewUnitPrice'
  ],
  changeQty: ['本次签证变更量', '签证变更量', '本次变更量', '变更量', 'changeQty'],
  baseChangeQty: ['原变更签证量', '原变更/签证量', '原签证变更量', 'baseChangeQty']
}

const EXPORT_HEADERS: Record<ReviewKind, readonly string[]> = {
  review: ['清单编码', '清单名称', '计量单位', '复核量', '复核单价（元）'],
  change: [
    '清单编码',
    '清单名称',
    '计量单位',
    '原变更签证量',
    '本次签证变更量',
    '复核单价（元）'
  ]
}

export interface ParseOutcome {
  successRows: BoqReviewRow[]
  failedRows: Array<{
    rowNumber: number
    code?: string
    reason: string
  }>
  skippedCount: number
}

/**
 * 导出清单项到 Excel
 */
export function exportReviewTemplateXlsx(
  kind: ReviewKind,
  selectedNodes: BoqTreeItem[],
  projectName = '项目'
) {
  const isChange = kind === 'change'
  const headers = EXPORT_HEADERS[kind]

  const data = selectedNodes.map((node) => {
    const isLeaf = !node.children || node.children.length === 0 || node.type === 'ITEM'
    const code = node.code || ''
    const name = node.name || ''
    const unit = isLeaf ? node.unit || '' : ''
    const price = isLeaf ? toNum(node.reviewPrice ?? node.price) : ''
    const baseChg = isLeaf ? toNum(node.changeQuantity) : ''
    const revQty = isLeaf ? toNum(node.reviewQuantity ?? node.quantity) : ''

    if (isChange) {
      return {
        清单编码: code,
        清单名称: name,
        计量单位: unit,
        原变更签证量: isLeaf ? baseChg : '',
        本次签证变更量: isLeaf ? 0 : '',
        '复核单价（元）': price
      }
    }

    return {
      清单编码: code,
      清单名称: name,
      计量单位: unit,
      复核量: isLeaf ? revQty : '',
      '复核单价（元）': price
    }
  })

  const ws = XLSX.utils.json_to_sheet(data, { header: [...headers] })
  ws['!cols'] = headers.map((h) =>
    h.includes('编码') ? { wch: 20 } : h.includes('名称') ? { wch: 36 } : { wch: 16 }
  )

  const wb = XLSX.utils.book_new()
  const sheetName = isChange ? '签证变更清单' : '复核清单'
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const fileName = `${projectName}-${isChange ? '签证变更量' : '复核工程量'}模板.xlsx`
  XLSX.writeFile(wb, fileName)
}

/**
 * 解析上传的 Excel
 */
export async function parseReviewImportXlsx(
  file: File,
  kind: ReviewKind,
  allBoqItems: BoqTreeItem[] = [],
  existingCodesInSheet: Set<string> = new Set()
): Promise<ParseOutcome> {
  const isChange = kind === 'change'
  let raw: unknown[][] = []

  try {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) {
      return {
        successRows: [],
        failedRows: [{ rowNumber: 0, reason: '文件中没有任何工作表' }],
        skippedCount: 0
      }
    }
    const ws = wb.Sheets[sheetName]
    raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: false,
      defval: ''
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      successRows: [],
      failedRows: [{ rowNumber: 0, reason: `文件无法解析：${message}` }],
      skippedCount: 0
    }
  }

  if (raw.length === 0) {
    return {
      successRows: [],
      failedRows: [{ rowNumber: 0, reason: '文件内容为空' }],
      skippedCount: 0
    }
  }

  // 1. 查找表头
  const headerIdx = raw.findIndex((row) =>
    row.some((cell) => ALIASES.code.includes(String(cell).trim()))
  )

  if (headerIdx < 0) {
    return {
      successRows: [],
      failedRows: [
        {
          rowNumber: 1,
          reason: `未找到「清单编码」列，请使用正确的模板（表头：${EXPORT_HEADERS[
            kind
          ].join(' / ')}）`
        }
      ],
      skippedCount: 0
    }
  }

  const headerRow = raw[headerIdx].map((c) => String(c).trim())
  const colOf: Record<string, number> = {}
  for (const [key, aliases] of Object.entries(ALIASES)) {
    const at = headerRow.findIndex((h) => aliases.includes(h))
    if (at >= 0) colOf[key] = at
  }

  if (isChange && colOf.changeQty === undefined) {
    return {
      successRows: [],
      failedRows: [
        {
          rowNumber: 1,
          reason: '签证变更导入未找到「本次签证变更量」列，请使用签证变更单导出的模板'
        }
      ],
      skippedCount: 0
    }
  }

  const boqItemMap = new Map<string, BoqTreeItem>()
  for (const it of allBoqItems) {
    if (it.code) boqItemMap.set(it.code.trim(), it)
  }

  const successRows: BoqReviewRow[] = []
  const failedRows: Array<{ rowNumber: number; code?: string; reason: string }> = []
  let skippedCount = 0
  const seenInFile = new Set<string>()

  let autoIdCounter = 0
  const generateRowId = () => `imp-${Date.now().toString(36)}-${++autoIdCounter}`

  raw.slice(headerIdx + 1).forEach((r, idx) => {
    const rowNumber = headerIdx + 2 + idx
    const val = (key: string): string => {
      const at = colOf[key]
      if (at === undefined) return ''
      return String(r[at] ?? '').trim()
    }

    const code = val('code')
    const name = val('name')
    const unit = val('unit')
    const revRaw = val('reviewQty')
    const priceRaw = val('reviewUnitPrice')
    const changeRaw = val('changeQty')
    const baseChgRaw = val('baseChangeQty')

    // 整行为空
    if (!code && !name && !revRaw && !priceRaw && !changeRaw && !unit) {
      skippedCount++
      return
    }

    if (!code) {
      failedRows.push({ rowNumber, reason: '清单编码为空' })
      return
    }

    if (seenInFile.has(code)) {
      failedRows.push({ rowNumber, code, reason: `文件内清单编码「${code}」重复` })
      return
    }

    if (existingCodesInSheet.has(code)) {
      failedRows.push({
        rowNumber,
        code,
        reason: `清单编码「${code}」在本单明细中已存在，不可重复引入`
      })
      return
    }

    const existingBoq = boqItemMap.get(code)

    if (isChange) {
      // 签证变更单：必须是已有清单项
      if (!existingBoq) {
        failedRows.push({
          rowNumber,
          code,
          reason: `清单中不存在编码「${code}」；签证变更只能累加既有清单项，如需新增请用「创建清单项」`
        })
        return
      }

      const changeQtyNorm = changeRaw === '' ? '0' : normalizeNumberText(changeRaw)
      if (changeQtyNorm === null) {
        failedRows.push({
          rowNumber,
          code,
          reason: `本次签证变更量「${changeRaw}」不是合法数值（可填 0 或负数）`
        })
        return
      }

      seenInFile.add(code)
      successRows.push(
        withQtyDefaults({
          id: generateRowId(),
          source: 'import',
          boqItemId: existingBoq.id,
          sourceCode: code,
          code,
          name: existingBoq.name || name || code,
          unit: existingBoq.unit || unit || '',
          baseChangeQty: existingBoq.changeQuantity ?? (baseChgRaw || 0),
          reviewQty: existingBoq.reviewQuantity ?? existingBoq.quantity ?? 0,
          changeQty: changeQtyNorm,
          reviewUnitPrice: existingBoq.reviewPrice ?? existingBoq.price ?? 0
        })
      )
      return
    }

    // ── 复核单 ──
    // 如果没有计量单位且没有数量，可能是章节/分类行，跳过
    if (!unit && revRaw === '' && priceRaw === '') {
      skippedCount++
      return
    }

    if (!name) {
      failedRows.push({ rowNumber, code, reason: '清单名称不能为空' })
      return
    }
    if (!unit) {
      failedRows.push({ rowNumber, code, reason: '计量单位不能为空' })
      return
    }

    const revQtyNorm = revRaw === '' ? '0' : normalizeNumberText(revRaw)
    if (revQtyNorm === null) {
      failedRows.push({ rowNumber, code, reason: `复核量「${revRaw}」不是合法数值` })
      return
    }

    const priceNorm = priceRaw === '' ? '0' : normalizeNumberText(priceRaw)
    if (priceNorm === null) {
      failedRows.push({
        rowNumber,
        code,
        reason: `复核单价「${priceRaw}」不是合法数值`
      })
      return
    }

    seenInFile.add(code)

    if (existingBoq) {
      // 既有项 -> 引入
      successRows.push(
        withQtyDefaults({
          id: generateRowId(),
          source: 'import',
          boqItemId: existingBoq.id,
          sourceCode: code,
          code,
          name: existingBoq.name || name,
          unit: existingBoq.unit || unit,
          baseChangeQty: existingBoq.changeQuantity ?? 0,
          reviewQty: revQtyNorm,
          changeQty: 0,
          reviewUnitPrice: priceNorm
        })
      )
    } else {
      // 新项 -> 文件导入
      successRows.push(
        withQtyDefaults({
          id: generateRowId(),
          source: 'file',
          boqItemId: null,
          sourceCode: null,
          code,
          name,
          unit,
          baseChangeQty: 0,
          reviewQty: revQtyNorm,
          changeQty: 0,
          reviewUnitPrice: priceNorm
        })
      )
    }
  })

  return {
    successRows,
    failedRows,
    skippedCount
  }
}
