import type { Knex } from 'knex'
import cryptoRandomString from 'crypto-random-string'
import dayjs from 'dayjs'
import { BoqItems } from '@/modules/core/dbSchema'
import type { BoqItemRecord, BoqItemType } from '@/modules/bop-item/repositories/boq'
import { recalculateProjectCostSummaryFactory } from '@/modules/project-statistics/services/projectCostSummaries'
import { BadRequestError, NotFoundError } from '@/modules/shared/errors'

export type BoqReviewKind = 'review' | 'change'
export type BoqReviewRowSource = 'create' | 'import' | 'file'
export type BoqReviewStage = 'contractor' | 'supervisor' | 'contract'

export type BoqReviewSnapshot = {
  reviewQuantity: number | null
  changeQuantity: number | null
  reviewPrice: number | null
  reviewAmount: number | null
}

export type BoqReviewRowInput = {
  id?: string
  recordId?: string
  projectId?: string
  sortIndex?: number
  source?: BoqReviewRowSource | string
  boqItemId?: string | null
  sourceCode?: string | null
  parentCode?: string | null
  code?: string
  name?: string
  unit?: string
  baseChangeQty?: number | string | null
  reviewQty?: number | string | null
  reviewQtySupervisor?: number | string | null
  reviewQtyContract?: number | string | null
  changeQty?: number | string | null
  changeQtySupervisor?: number | string | null
  changeQtyContract?: number | string | null
  reviewUnitPrice?: number | string | null
  beforeSnapshot?: BoqReviewSnapshot | null
  afterSnapshot?: BoqReviewSnapshot | null
}

export type BoqReviewValidationIssue = {
  rowIndex: number
  rowCode?: string
  message: string
}

export const BOQ_REVIEW_RECORDS_TABLE = 'boq_review_records'
export const BOQ_REVIEW_ROWS_TABLE = 'boq_review_rows'

/**
 * 把用户/文件给的"看起来是数"的内容归一成纯数字串；认不出返回空串 `""`。
 * 支持全角数字、全角小数点、全角负号、千分位、零宽字符、前后空白。
 */
export function normalizeNumberText(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  const s = String(raw)
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\uFF0E/g, '.')
    .replace(/\uFF0C/g, ',')
    .replace(/[\uFF0D\u2013\u2014\u2212]/g, '-')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/,/g, '')
    .replace(/[\s\u00A0\u3000]/g, '')
  if (s === '') return ''
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return ''
  return s
}

/**
 * 解析可选数值：无法解析或为空时返回 `undefined`
 */
export function parseOptionalNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : undefined
  }
  const normalized = normalizeNumberText(v)
  if (!normalized) return undefined
  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? n : undefined
}

/**
 * 四舍五入保留指定位数小数（默认 2 位）
 */
export function roundTo(n: number, digits = 2): number {
  if (!Number.isFinite(n)) return 0
  const factor = Math.pow(10, digits)
  return Math.round((n + Number.EPSILON) * factor) / factor
}

const toNumberOrZero = (v: unknown): number => parseOptionalNumber(v) ?? 0

/**
 * 编辑三方量中的某一阶段列，并维护"默认跟随"关系：
 * - 施工单位修改时（stage === 'contractor'），若财务监理/合约部列等于旧施工单位值或为空，则自动跟随新值；
 * - 财务监理修改时（stage === 'supervisor'），若合约部列等于旧财务监理值或为空，则自动跟随新值；
 * - 合约部修改时（stage === 'contract'），仅修改合约部列。
 */
export function editQtyField<T extends BoqReviewRowInput>(
  row: T,
  stage: BoqReviewStage,
  value: number | undefined,
  kind?: BoqReviewKind
): T {
  const next = { ...row }
  const resolvedKind: BoqReviewKind =
    kind ??
    (row.changeQty !== undefined &&
    row.reviewQty === undefined &&
    row.reviewQtySupervisor === undefined &&
    row.reviewQtyContract === undefined
      ? 'change'
      : 'review')

  const applyForKind = (k: BoqReviewKind) => {
    const keys =
      k === 'review'
        ? ({
            contractor: 'reviewQty',
            supervisor: 'reviewQtySupervisor',
            contract: 'reviewQtyContract'
          } as const)
        : ({
            contractor: 'changeQty',
            supervisor: 'changeQtySupervisor',
            contract: 'changeQtyContract'
          } as const)

    const oldContractor = parseOptionalNumber(row[keys.contractor])
    const oldSupervisor = parseOptionalNumber(row[keys.supervisor])

    if (stage === 'contractor') {
      ;(next as Record<string, unknown>)[keys.contractor] = value
      const curSup = parseOptionalNumber(row[keys.supervisor])
      if (curSup === undefined || curSup === oldContractor) {
        ;(next as Record<string, unknown>)[keys.supervisor] = value
      }
      const curCon = parseOptionalNumber(row[keys.contract])
      if (curCon === undefined || curCon === oldContractor) {
        ;(next as Record<string, unknown>)[keys.contract] = value
      }
    } else if (stage === 'supervisor') {
      ;(next as Record<string, unknown>)[keys.supervisor] = value
      const curCon = parseOptionalNumber(row[keys.contract])
      if (curCon === undefined || curCon === oldSupervisor) {
        ;(next as Record<string, unknown>)[keys.contract] = value
      }
    } else if (stage === 'contract') {
      ;(next as Record<string, unknown>)[keys.contract] = value
    }
  }

  // 如果显式指定了 kind，只更新对应 kind 的字段；
  // 如果未指定 kind，检测行上已有哪些字段或同时维护激活的量字段
  if (kind) {
    applyForKind(kind)
  } else {
    const hasReviewFields =
      row.reviewQty !== undefined ||
      row.reviewQtySupervisor !== undefined ||
      row.reviewQtyContract !== undefined
    const hasChangeFields =
      row.changeQty !== undefined ||
      row.changeQtySupervisor !== undefined ||
      row.changeQtyContract !== undefined

    if (hasReviewFields && !hasChangeFields) {
      applyForKind('review')
    } else if (hasChangeFields && !hasReviewFields) {
      applyForKind('change')
    } else {
      applyForKind(resolvedKind)
    }
  }

  return next
}

/**
 * 获取某行在特定阶段下的有效复核量
 */
export function resolveEffectiveReviewQty(
  row: BoqReviewRowInput,
  stage?: BoqReviewStage
): number {
  const c = parseOptionalNumber(row.reviewQty)
  const s = parseOptionalNumber(row.reviewQtySupervisor)
  const k = parseOptionalNumber(row.reviewQtyContract)
  if (stage === 'contractor') return c ?? 0
  if (stage === 'supervisor') return s ?? c ?? 0
  return k ?? s ?? c ?? 0
}

/**
 * 获取某行在特定阶段下的有效签证变更量（本次增量）
 */
export function resolveEffectiveChangeQty(
  row: BoqReviewRowInput,
  stage?: BoqReviewStage
): number {
  const c = parseOptionalNumber(row.changeQty)
  const s = parseOptionalNumber(row.changeQtySupervisor)
  const k = parseOptionalNumber(row.changeQtyContract)
  if (stage === 'contractor') return c ?? 0
  if (stage === 'supervisor') return s ?? c ?? 0
  return k ?? s ?? c ?? 0
}

/**
 * 计算单行派生指标：
 * - `effectiveQty`：当前主有效量（review 单为有效复核量，change 单为有效本次变更量）
 * - `effectiveReviewQty`：有效复核量
 * - `effectiveChangeQty`：有效本次变更量
 * - `changeQtyTotal`：累计变更/签证量 = baseChangeQty + effectiveChangeQty
 * - `totalQtyWithChange`（别名 `finAuditQty`）：工程量（含变更）= effectiveReviewQty + baseChangeQty + effectiveChangeQty
 * - `reviewTotalPrice`（别名 `reviewTotal`）：复核总价 = roundTo(totalQtyWithChange * unitPrice, 2)
 * - `changeAmount`：本次签证变更金额 = roundTo(effectiveChangeQty * unitPrice, 2)
 */
export function calcReviewRow(
  row: BoqReviewRowInput,
  kind: BoqReviewKind = 'review',
  stage?: BoqReviewStage
) {
  const effectiveReviewQty = resolveEffectiveReviewQty(row, stage)
  const effectiveChangeQty = resolveEffectiveChangeQty(row, stage)
  const baseChangeQty = toNumberOrZero(row.baseChangeQty)
  const unitPrice = toNumberOrZero(row.reviewUnitPrice)

  const effectiveQty = kind === 'change' ? effectiveChangeQty : effectiveReviewQty
  const changeQtyTotal = roundTo(baseChangeQty + effectiveChangeQty, 6)
  const totalQtyWithChange = roundTo(effectiveReviewQty + changeQtyTotal, 6)
  const reviewTotalPrice = roundTo(totalQtyWithChange * unitPrice, 2)
  const changeAmount = roundTo(effectiveChangeQty * unitPrice, 2)

  return {
    effectiveQty,
    effectiveReviewQty,
    effectiveChangeQty,
    baseChangeQty,
    unitPrice,
    changeQtyTotal,
    totalQtyWithChange,
    finAuditQty: totalQtyWithChange,
    reviewTotalPrice,
    reviewTotal: reviewTotalPrice,
    changeAmount
  }
}

/**
 * 校验明细行：
 * - 至少有一条明细
 * - 编码非空、本单内编码不重复
 * - `source === 'create'` 与既有清单编码（`existingBoqCodes`）不冲突
 * - 名称与计量单位必填
 * - 工程量与单价合法
 * - 签证变更单（`kind === 'change'`）不能全为 0
 */
export function validateReviewRows(
  rows: BoqReviewRowInput[],
  kind: BoqReviewKind = 'review',
  existingBoqCodes: Set<string> = new Set(),
  options?: { stage?: BoqReviewStage }
): BoqReviewValidationIssue[] {
  const issues: BoqReviewValidationIssue[] = []
  const shortLabel = kind === 'change' ? '签证变更单' : '复核单'
  const stage = options?.stage

  if (!Array.isArray(rows) || rows.length === 0) {
    issues.push({ rowIndex: -1, message: '至少需要一条清单明细' })
    return issues
  }

  const seen = new Map<string, number>()

  rows.forEach((row, i) => {
    const code = String(row.code ?? '').trim()
    const label = code || `第 ${i + 1} 行`

    if (!code) {
      issues.push({ rowIndex: i, message: `第 ${i + 1} 行：清单编码不能为空` })
    } else {
      const prev = seen.get(code)
      if (prev !== undefined) {
        issues.push({
          rowIndex: i,
          rowCode: code,
          message: `清单编码「${code}」在本${shortLabel}内重复（第 ${
            prev + 1
          } 行已使用）`
        })
      } else {
        seen.set(code, i)
      }

      if ((row.source || 'import') === 'create' && existingBoqCodes.has(code)) {
        issues.push({
          rowIndex: i,
          rowCode: code,
          message: `清单编码「${code}」已存在于正式清单，请修改编码`
        })
      }
    }

    if (!String(row.name ?? '').trim()) {
      issues.push({ rowIndex: i, rowCode: code, message: `${label}：清单名称不能为空` })
    }

    if (!String(row.unit ?? '').trim()) {
      issues.push({ rowIndex: i, rowCode: code, message: `${label}：计量单位不能为空` })
    }

    const isCreate = (row.source || 'import') === 'create'
    const requiredFields: Array<[keyof BoqReviewRowInput, string]> =
      kind === 'change'
        ? isCreate
          ? [
              ['changeQty', '签证变更量（+/−）'],
              ['reviewQty', '复核量'],
              ['reviewUnitPrice', '复核单价']
            ]
          : [['changeQty', '签证变更量（+/−）']]
        : [
            ['reviewQty', '复核量'],
            ['reviewUnitPrice', '复核单价']
          ]

    for (const [field, fieldLabel] of requiredFields) {
      const rawVal = row[field]
      // 在 change 单的 create 行中，若未传 reviewQty 则允许按 0 处理（除非显式传了非法字符）
      if (
        kind === 'change' &&
        isCreate &&
        field === 'reviewQty' &&
        (rawVal === undefined || rawVal === null || rawVal === '')
      ) {
        continue
      }
      const rawStr =
        rawVal === null || rawVal === undefined ? '' : String(rawVal).trim()
      if (rawStr === '') {
        issues.push({
          rowIndex: i,
          rowCode: code,
          message: `${label}：${fieldLabel}不能为空`
        })
      } else if (!normalizeNumberText(rawStr)) {
        issues.push({
          rowIndex: i,
          rowCode: code,
          message: `${label}：${fieldLabel}「${rawStr}」不是合法数值`
        })
      }
    }

    // 复核单若传了 changeQty，也校验其数值合法性
    if (
      kind === 'review' &&
      row.changeQty !== undefined &&
      row.changeQty !== null &&
      String(row.changeQty).trim() !== ''
    ) {
      const rawChange = String(row.changeQty).trim()
      if (!normalizeNumberText(rawChange)) {
        issues.push({
          rowIndex: i,
          rowCode: code,
          message: `${label}：变更/签证量「${rawChange}」不是合法数值`
        })
      }
    }

    // 财务监理 / 合约部审核量校验
    const supervisorField =
      kind === 'change' ? 'changeQtySupervisor' : 'reviewQtySupervisor'
    const contractField = kind === 'change' ? 'changeQtyContract' : 'reviewQtyContract'
    for (const [field, fieldLabel] of [
      [supervisorField, '财务监理审核量'],
      [contractField, '合约部审核量']
    ] as const) {
      const rawVal = row[field]
      const rawStr =
        rawVal === null || rawVal === undefined ? '' : String(rawVal).trim()
      if (rawStr !== '' && !normalizeNumberText(rawStr)) {
        issues.push({
          rowIndex: i,
          rowCode: code,
          message: `${label}：${fieldLabel}「${rawStr}」不是合法数值`
        })
      }
    }
  })

  if (kind === 'change') {
    const anyNonZero = rows.some((r) => resolveEffectiveChangeQty(r, stage) !== 0)
    if (!anyNonZero) {
      issues.push({
        rowIndex: -1,
        message:
          '本单所有明细的签证变更量都是 0，没有需要增加或减少的量，请至少填写一条'
      })
    }
  }

  return issues
}

const toSnapshot = (item: {
  reviewQuantity?: string | number | null
  changeQuantity?: string | number | null
  reviewPrice?: string | number | null
  reviewAmount?: string | number | null
}): BoqReviewSnapshot => ({
  reviewQuantity: parseOptionalNumber(item.reviewQuantity) ?? null,
  changeQuantity: parseOptionalNumber(item.changeQuantity) ?? null,
  reviewPrice: parseOptionalNumber(item.reviewPrice) ?? null,
  reviewAmount: parseOptionalNumber(item.reviewAmount) ?? null
})

/**
 * 终审通过（`APPROVED`）写回 `boq_items` 事务服务
 */
export const applyBoqReviewRecordToBoqItemsFactory =
  (deps: {
    db: Knex
    recalculateProjectCostSummary?: (params: { projectId: string }) => Promise<unknown>
  }) =>
  async (params: {
    recordId: string
    projectId?: string | null
    actorId?: string | null
  }) => {
    const runInTx = async (trx: Knex) => {
      const query = trx(BOQ_REVIEW_RECORDS_TABLE).where('id', params.recordId)
      if (params.projectId) {
        query.andWhere('projectId', params.projectId)
      }
      const record = await query.first()
      if (!record) {
        throw new NotFoundError(`BOQ review record not found: ${params.recordId}`)
      }

      const projectId: string = record.projectId || params.projectId
      if (!projectId) {
        throw new BadRequestError('Missing projectId for BOQ review record')
      }

      // 幂等保护：若 effectiveAt 已存在且 approveStatus === 'APPROVED'，则不重复累加/不重复插入
      if (record.effectiveAt && record.approveStatus === 'APPROVED') {
        return {
          recordId: record.id,
          projectId,
          alreadyEffective: true,
          createdCount: 0,
          updatedCount: 0
        }
      }

      const kind: BoqReviewKind = record.kind === 'change' ? 'change' : 'review'

      const allBoqItems: BoqItemRecord[] = await trx<BoqItemRecord>(BoqItems.name)
        .where(BoqItems.col.projectId, projectId)
        .orderBy(BoqItems.col.depth, 'asc')
        .orderBy(BoqItems.col.sortOrder, 'asc')
        .orderBy(BoqItems.col.createdAt, 'asc')

      const byId = new Map<string, BoqItemRecord>(
        allBoqItems.map((item) => [item.id, item])
      )
      const byCode = new Map<string, BoqItemRecord>(
        allBoqItems.map((item) => [item.code, item])
      )

      const rows = await trx(BOQ_REVIEW_ROWS_TABLE)
        .where('recordId', record.id)
        .orderBy('sortIndex', 'asc')
        .orderBy('id', 'asc')

      let createdCount = 0
      let updatedCount = 0
      const now = new Date()

      // 记录同一个 sourceItem 下已连续插入的锚点项，确保同单据对同一来源项连续创建多项时依次排在正下方
      const lastInsertedBySourceCode = new Map<string, BoqItemRecord>()

      for (const r of rows) {
        const effectiveQty =
          kind === 'review'
            ? parseOptionalNumber(r.reviewQtyContract) ??
              parseOptionalNumber(r.reviewQtySupervisor) ??
              parseOptionalNumber(r.reviewQty) ??
              0
            : parseOptionalNumber(r.changeQtyContract) ??
              parseOptionalNumber(r.changeQtySupervisor) ??
              parseOptionalNumber(r.changeQty) ??
              0

        const rawUnitPrice = parseOptionalNumber(r.reviewUnitPrice)
        const unitPrice = rawUnitPrice ?? 0
        const rowCode = String(r.code || '').trim()

        if (r.source === 'create') {
          const existingByCode = byCode.get(rowCode)
          if (existingByCode) {
            // 若已存在同编码项，不重复插入，仅对齐关联
            const snap = toSnapshot(existingByCode)
            await trx(BOQ_REVIEW_ROWS_TABLE)
              .where('id', r.id)
              .update({
                boqItemId: existingByCode.id,
                beforeSnapshot: JSON.stringify(null),
                afterSnapshot: JSON.stringify(snap),
                updatedAt: now
              })
            continue
          }

          // 找到来源项 sourceItem（优先匹配 code === r.sourceCode，兜底匹配 code === r.parentCode）
          const sourceKey = r.sourceCode ? String(r.sourceCode).trim() : ''
          const parentKey = r.parentCode ? String(r.parentCode).trim() : ''
          const anchorItem =
            (sourceKey ? lastInsertedBySourceCode.get(sourceKey) : undefined) ||
            (sourceKey ? byCode.get(sourceKey) : undefined) ||
            (parentKey ? byCode.get(parentKey) : undefined)

          const rawSourceItem =
            (sourceKey ? byCode.get(sourceKey) : undefined) ||
            (parentKey ? byCode.get(parentKey) : undefined)

          let parentId: string | null = null
          let depth = 4
          let targetSortOrder = 0

          if (rawSourceItem) {
            if (rawSourceItem.type === 'ITEM') {
              parentId = rawSourceItem.parentId
              depth = rawSourceItem.depth
            } else {
              parentId = rawSourceItem.id
              depth = clampDepthForItem((rawSourceItem.depth || 0) + 1)
            }
          }

          if (anchorItem && rawSourceItem && rawSourceItem.type === 'ITEM') {
            const baseOrder = Number(anchorItem.sortOrder ?? 0)
            targetSortOrder = baseOrder + 1

            // 将该 parentId 下所有 sortOrder > anchorItem.sortOrder 的兄弟节点 sortOrder 递增 +1
            const siblingUpdateQuery = trx(BoqItems.name)
              .where(BoqItems.col.projectId, projectId)
              .andWhere(BoqItems.col.sortOrder, '>', baseOrder)
            if (parentId === null) {
              siblingUpdateQuery.whereNull(BoqItems.col.parentId)
            } else {
              siblingUpdateQuery.andWhere(BoqItems.col.parentId, parentId)
            }
            await siblingUpdateQuery.increment('sortOrder', 1)

            // 同步更新内存中缓存的兄弟节点 sortOrder
            for (const item of allBoqItems) {
              if (item.parentId === parentId && item.sortOrder > baseOrder) {
                item.sortOrder += 1
              }
            }
          } else {
            // 若来源项是分部分项（非 ITEM）或未找到来源项，则排在该 parentId 末尾或正下方
            let maxOrder = -1
            for (const item of allBoqItems) {
              if (item.parentId === parentId && item.sortOrder > maxOrder) {
                maxOrder = item.sortOrder
              }
            }
            targetSortOrder = maxOrder + 1
          }

          const newReviewQty = kind === 'review' ? roundTo(effectiveQty, 6) : 0
          const newChangeQty = kind === 'change' ? roundTo(effectiveQty, 6) : 0
          const newReviewPrice = roundTo(unitPrice, 2)
          const newReviewAmount = roundTo(effectiveQty * newReviewPrice, 2)

          const newItem: BoqItemRecord = {
            id: cryptoRandomString({ length: 10, type: 'alphanumeric' }),
            projectId,
            parentId,
            type: 'ITEM' as BoqItemType,
            code: rowCode,
            name: String(r.name || ''),
            unit: r.unit ? String(r.unit) : null,
            // 合同基数保持为 0（避免虚增项目合同总价）
            quantity: '0',
            price: '0',
            amount: '0',
            reviewQuantity: String(newReviewQty),
            changeQuantity: String(newChangeQty),
            reviewPrice: String(newReviewPrice),
            reviewAmount: String(newReviewAmount),
            sortOrder: targetSortOrder,
            depth,
            createdAt: now,
            updatedAt: now
          }

          await trx(BoqItems.name).insert(newItem)
          allBoqItems.push(newItem)
          byId.set(newItem.id, newItem)
          byCode.set(newItem.code, newItem)
          if (sourceKey) {
            lastInsertedBySourceCode.set(sourceKey, newItem)
          }

          const afterSnapshot: BoqReviewSnapshot = {
            reviewQuantity: newReviewQty,
            changeQuantity: newChangeQty,
            reviewPrice: newReviewPrice,
            reviewAmount: newReviewAmount
          }

          await trx(BOQ_REVIEW_ROWS_TABLE)
            .where('id', r.id)
            .update({
              boqItemId: newItem.id,
              beforeSnapshot: null,
              afterSnapshot: JSON.stringify(afterSnapshot),
              updatedAt: now
            })

          createdCount += 1
          continue
        }

        // 当 r.source !== 'create'（引入项或文件导入既有项）时
        const target =
          (r.boqItemId ? byId.get(String(r.boqItemId)) : undefined) ||
          (rowCode ? byCode.get(rowCode) : undefined)

        if (!target) {
          continue
        }

        const beforeSnapshot = toSnapshot(target)
        let nextReviewQty: number
        let nextChangeQty: number
        let nextReviewPrice: number
        let nextReviewAmount: number

        if (kind === 'review') {
          nextReviewQty = roundTo(effectiveQty, 6)
          nextChangeQty = roundTo(Number(target.changeQuantity || 0), 6)
          nextReviewPrice = roundTo(unitPrice, 2)
          nextReviewAmount = roundTo(
            (nextReviewQty + nextChangeQty) * nextReviewPrice,
            2
          )
        } else {
          nextReviewQty = roundTo(Number(target.reviewQuantity || 0), 6)
          nextChangeQty = roundTo(Number(target.changeQuantity || 0) + effectiveQty, 6)
          const effectiveReviewPrice =
            rawUnitPrice !== undefined
              ? roundTo(rawUnitPrice, 2)
              : roundTo(
                  parseOptionalNumber(target.reviewPrice) ??
                    parseOptionalNumber(target.price) ??
                    0,
                  2
                )
          nextReviewPrice = effectiveReviewPrice
          nextReviewAmount = roundTo(
            (nextReviewQty + nextChangeQty) * effectiveReviewPrice,
            2
          )
        }

        target.reviewQuantity = String(nextReviewQty)
        target.changeQuantity = String(nextChangeQty)
        target.reviewPrice = String(nextReviewPrice)
        target.reviewAmount = String(nextReviewAmount)
        target.updatedAt = now

        await trx(BoqItems.name)
          .where(BoqItems.col.projectId, projectId)
          .andWhere(BoqItems.col.id, target.id)
          .update({
            reviewQuantity: target.reviewQuantity,
            changeQuantity: target.changeQuantity,
            reviewPrice: target.reviewPrice,
            reviewAmount: target.reviewAmount,
            updatedAt: now
          })

        const afterSnapshot: BoqReviewSnapshot = {
          reviewQuantity: nextReviewQty,
          changeQuantity: nextChangeQty,
          reviewPrice: nextReviewPrice,
          reviewAmount: nextReviewAmount
        }

        await trx(BOQ_REVIEW_ROWS_TABLE)
          .where('id', r.id)
          .update({
            boqItemId: target.id,
            beforeSnapshot: JSON.stringify(beforeSnapshot),
            afterSnapshot: JSON.stringify(afterSnapshot),
            updatedAt: now
          })

        updatedCount += 1
      }

      const effectiveAt = dayjs(now).format('YYYY-MM-DD HH:mm')
      const existingHistory = Array.isArray(record.history)
        ? record.history
        : typeof record.history === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(record.history)
              return Array.isArray(parsed) ? parsed : []
            } catch {
              return []
            }
          })()
        : []
      const nextHistory = [
        ...existingHistory,
        {
          at: effectiveAt,
          by: params.actorId || record.applicant || 'system',
          action: 'APPROVED_EFFECTIVE',
          reason: '审批通过并写回工程量清单',
          createdCount,
          updatedCount
        }
      ]

      await trx(BOQ_REVIEW_RECORDS_TABLE)
        .where('id', record.id)
        .update({
          approveStatus: 'APPROVED',
          effectiveAt,
          history: JSON.stringify(nextHistory),
          updatedAt: now
        })

      if (deps.recalculateProjectCostSummary) {
        await deps.recalculateProjectCostSummary({ projectId })
      } else {
        await recalculateProjectCostSummaryFactory({ db: trx })({ projectId })
      }

      return {
        recordId: record.id,
        projectId,
        alreadyEffective: false,
        effectiveAt,
        createdCount,
        updatedCount
      }
    }

    if (deps.db.isTransaction) {
      return await runInTx(deps.db)
    }
    return await deps.db.transaction(runInTx)
  }

function clampDepthForItem(depth: number): number {
  if (depth < 4) return 4
  if (depth > 5) return 5
  return depth
}
