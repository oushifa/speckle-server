import cryptoRandomString from 'crypto-random-string'
import dayjs from 'dayjs'
import type { Knex } from 'knex'
import {
  BoqItems,
  MonthlyMeasurementItems,
  MonthlyMeasurements,
  SafetyMeasureDetails,
  SafetyMeasureItems,
  SafetyMeasures
} from '@/modules/core/dbSchema'
import type { BoqItemRecord } from '@/modules/bop-item/repositories/boq'
import type {
  MonthlyMeasurementItemRecord,
  MonthlyMeasurementRecord,
  SafetyMeasureDetailRecord,
  SafetyMeasureItemRecord,
  SafetyMeasureRecord
} from '@/modules/core/helpers/types'
import { preciseMul } from '@/modules/shared/helpers/preciseMath'

/**
 * 0 期【月度验工】并入【安全文明措施费】的写回逻辑。
 *
 * 背景：
 *  - 0 期没有可关联的安全文明措施费单据，用户在月度验工明细页手写措施费数据；
 *  - 月度验工审批通过后，这笔数据必须进入安全文明措施费的"累计完成数"；
 *  - 而"累计完成数"只统计本项目下 approveStatus = 'APPROVED' 的 safety_measures
 *    的 safety_measure_items（见 rest/router.ts 的 GET /safety-measures/:id/items）。
 *
 * 因此这里不新增任何累计统计逻辑，只做一件事：把月度验工里属于安全文明措施费的
 * 清单项"材料化"成一条隐藏的 safety_measures 记录（approveStatus = 'APPROVED'），
 * 后续单据的累计统计即可零改动地纳入它。
 *
 * 累计口径（已确认）：月度验工的 investmentQty（投资监理）→ 安全文明措施费的
 * engineeringQty（工程管理部）。
 */

/** 由月度验工自动生成的安全文明措施费统一占用 000 序号，保证同月排序永远最靠前 */
export const AUTO_SAFETY_MEASURE_SEQUENCE = '000'

export const buildAutoSafetyMeasureCode = (baseDate: number | string): string =>
  `AQWM-${dayjs(Number(baseDate)).format('YYYYMM')}-${AUTO_SAFETY_MEASURE_SEQUENCE}`

/**
 * 把月度验工的 baseDate 归一化为"当月月初"，与手工安全文明措施费的存储口径对齐。
 *
 * ⚠️ 必须归一化，否则 0 期数据在同月的手工单据里完全看不到：
 *  - 月度验工存的是 `endOf('month')`，即 **月末 23:59:59.999**
 *  - 手工安全文明措施费存的是 **月初 00:00:00**
 *  - 累加只比较 `baseDate`（相等时才比较 `code`），同月时月末恒大于月初，
 *    导致隐藏记录被判为"比本单更晚"而排除，只有更晚月份的单据才看得到。
 *  - 归一化到月初后，同月走 `code` 比较，而自动生成的 `000` 序号恒小于手工单据。
 */
export const normalizeSafetyMeasureBaseDate = (
  monthlyMeasurementBaseDate: number | string
): string =>
  String(dayjs(Number(monthlyMeasurementBaseDate)).startOf('month').valueOf())

export type BoqItemLike = {
  id: string
  parentId: string | null
  type: string | null
}

/**
 * 把"选中的分部工程"解析成"命中的 BOQ 节点 id 集合"。
 *
 * 必须与手工新建安全文明措施费时的算法完全一致（见 rest/router.ts 新建接口）：
 *   1. 命中 = 选中分部工程本身 + 其全部后代
 *   2. 再补齐祖先，补到 CATEGORY 为止（含 CATEGORY）
 *
 * 抽成共享函数，避免"月度验工并入"与"手工新建安全文明措施费"两侧口径漂移。
 */
export const resolveSafetyMeasureBoqItemIds = (params: {
  boqItems: BoqItemLike[]
  sectionIds: string[]
}): Set<string> => {
  const { boqItems, sectionIds } = params
  const hit = new Set<string>()
  if (!sectionIds.length) return hit

  const selected = new Set(sectionIds)
  const itemMap = new Map(boqItems.map((item) => [item.id, item]))

  const isDescendantOfSelected = (item: BoqItemLike) => {
    if (selected.has(item.id)) return true
    let parentId = item.parentId
    while (parentId) {
      if (selected.has(parentId)) return true
      parentId = itemMap.get(parentId)?.parentId ?? null
    }
    return false
  }

  for (const item of boqItems) {
    if (isDescendantOfSelected(item)) hit.add(item.id)
  }

  // 补齐祖先，保持与手工新建一致的树形快照
  for (const id of Array.from(hit)) {
    let current: BoqItemLike | undefined = itemMap.get(id)
    while (current?.parentId) {
      const parent: BoqItemLike | undefined = itemMap.get(current.parentId)
      if (!parent) break
      hit.add(parent.id)
      if (parent.type === 'CATEGORY') break
      current = parent
    }
  }

  return hit
}

export type SafetyMeasureSyncAction =
  | 'skipped' // 未开启并入，无需同步
  | 'created' // 首次生成隐藏记录
  | 'refreshed' // 已存在，覆盖刷新
  | 'canceled' // 月度验工被驳回/撤销，隐藏记录一并作废
  | 'noop' // 无需变更

export type SafetyMeasureSyncResult = {
  action: SafetyMeasureSyncAction
  safetyMeasureId?: string
  itemCount?: number
  message?: string
}

/** 兼容 jsonb 读出为数组、或历史遗留的 JSON 字符串两种形态 */
export const normalizeSectionIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

/**
 * 把命中集合内的月度验工明细材料化成一条隐藏的安全文明措施费单据。
 *
 * 幂等：以 safety_measures.sourceMeasurementId 为唯一键，已存在则"删明细 + 重建"。
 * 只允许一张月度验工生成一条记录（DB 层有部分唯一索引兜底）。
 */
export const materializeSafetyMeasureFromMeasurement = async (params: {
  db: Knex
  measurementId: string
  /** 命中"安全文明措施费"的 BOQ 节点 id 集合 */
  safetyBoqItemIds: Set<string>
  /** 选中的分部工程 id，仅用于留痕到 boqSectionIds */
  sectionIds: string[]
}): Promise<SafetyMeasureSyncResult> => {
  const { db, measurementId, safetyBoqItemIds, sectionIds } = params

  const measurement = await db<MonthlyMeasurementRecord>(MonthlyMeasurements.name)
    .where('id', measurementId)
    .first()
  if (!measurement) {
    throw new Error(`月度验工不存在：${measurementId}`)
  }
  const projectId = measurement.project_id

  const boqItemIds = Array.from(safetyBoqItemIds)
  if (!boqItemIds.length) {
    throw new Error(
      `月度验工 ${measurementId} 未命中任何清单项，请检查所选分部工程是否正确`
    )
  }

  const [boqItems, measurementItems] = await Promise.all([
    db<BoqItemRecord>(BoqItems.name)
      .where('projectId', projectId)
      .whereIn('id', boqItemIds)
      .select('id', 'quantity', 'price', 'amount'),
    db<MonthlyMeasurementItemRecord>(MonthlyMeasurementItems.name)
      .where('measurementId', measurementId)
      .whereIn('boqItemId', boqItemIds)
      .orderBy('sortIndex', 'asc')
  ])

  if (!measurementItems.length) {
    throw new Error(
      `月度验工 ${measurementId} 的明细中找不到属于安全文明措施费的清单项，无法生成累计数据`
    )
  }

  const boqById = new Map(boqItems.map((item) => [item.id, item]))
  const now = new Date()

  return await db.transaction(async (trx) => {
    const existing = await trx<SafetyMeasureRecord>(SafetyMeasures.name)
      .where('sourceMeasurementId', measurementId)
      .first()

    const measureId: string = existing?.id ?? cryptoRandomString({ length: 10 })

    // 同月同 code 只能有一条：000 序号被本机制独占，手工单据从 001 起，不会冲突。
    const code = buildAutoSafetyMeasureCode(measurement.baseDate)
    const codeOwner = await trx<SafetyMeasureRecord>(SafetyMeasures.name)
      .where({ project_id: projectId, code })
      .where(function () {
        // 注意：手工单据的 sourceMeasurementId 为 NULL，不能用 whereNot 直接比较
        // （SQL 里 NULL != x 结果为 NULL，行会被过滤掉）
        this.whereNot('sourceMeasurementId', measurementId).orWhereNull(
          'sourceMeasurementId'
        )
      })
      .first()
    if (codeOwner) {
      throw new Error(
        `编号 ${code} 已被单据 ${codeOwner.id} 占用。同一期只能有一张并入的月度验工，请先确认是否存在重复并入。`
      )
    }

    const measurePayload = {
      project_id: projectId,
      unit: measurement.unit ?? null,
      code,
      // 归一化到当月月初，与手工安全文明措施费的存储口径对齐（详见函数注释）
      baseDate: normalizeSafetyMeasureBaseDate(measurement.baseDate),
      roundName: measurement.roundName ?? '0',
      startDate: measurement.startDate ?? null,
      endDate: measurement.endDate ?? null,
      boqSectionIds: JSON.stringify(sectionIds),
      approveStatus: 'APPROVED',
      flowInstanceId: null,
      creator: measurement.creator ?? null,
      sourceMeasurementId: measurementId,
      updatedAt: now
    }

    const nextItems: SafetyMeasureItemRecord[] = measurementItems.map((row) => {
      const boq = boqById.get(row.boqItemId)
      const isSummaryRow = Boolean(row.isSummaryRow)

      const price = isSummaryRow ? 0 : Number(boq?.price ?? row.price ?? 0)
      const contractQty = isSummaryRow ? 0 : Number(boq?.quantity ?? 0)
      const contractAmount = isSummaryRow
        ? 0
        : boq?.amount !== null && boq?.amount !== undefined
        ? Number(boq.amount)
        : preciseMul(contractQty, price)

      // 累计口径：月度验工「投资监理」→ 安全文明措施费「工程管理部」
      const engineeringQty = isSummaryRow ? 0 : Number(row.investmentQty ?? 0)

      // 其余角色列必须保持 0：累计取值是"按优先级取第一个非 0 值"
      // （contractDeptQty || engineeringQty || headquartersQty || supervisionQty || contractorQty），
      // 一旦写入低优先级角色的量，当投资监理量为 0 时累计会串位取到它们的值。
      return {
        id: cryptoRandomString({ length: 10 }),
        safetyMeasureId: measureId,
        boqItemId: row.boqItemId,
        boqCode: row.boqCode ?? null,
        boqName: row.boqName ?? null,
        boqParentId: row.boqParentId ?? null,
        boqDepth: row.boqDepth,
        isSummaryRow,
        sortIndex: row.sortIndex,
        uom: row.uom ?? null,
        price,

        contractQty,
        contractAmount,

        contractorQty: 0,
        contractorAmount: 0,
        supervisionQty: 0,
        supervisionAmount: 0,
        headquartersQty: 0,
        headquartersAmount: 0,

        engineeringQty,
        engineeringAmount: preciseMul(engineeringQty, price),

        contractDeptQty: 0,
        contractDeptAmount: 0,

        createdAt: now,
        updatedAt: now
      }
    })

    if (existing) {
      await trx(SafetyMeasures.name).where('id', measureId).update(measurePayload)
      await trx(SafetyMeasureItems.name).where('safetyMeasureId', measureId).delete()
    } else {
      await trx(SafetyMeasures.name).insert({
        id: measureId,
        ...measurePayload,
        createdAt: now
      })
      const hasDetails = await trx<SafetyMeasureDetailRecord>(SafetyMeasureDetails.name)
        .where('safetyMeasureId', measureId)
        .first()
      if (!hasDetails) {
        await trx(SafetyMeasureDetails.name).insert({
          id: cryptoRandomString({ length: 10 }),
          safetyMeasureId: measureId,
          attachments: JSON.stringify([]),
          createdAt: now,
          updatedAt: now
        })
      }
    }

    await trx(SafetyMeasureItems.name).insert(nextItems)

    return {
      action: existing ? 'refreshed' : 'created',
      safetyMeasureId: measureId,
      itemCount: nextItems.length
    } satisfies SafetyMeasureSyncResult
  })
}

/**
 * 审批流回调入口（供 flow/services/approvalFlows.ts 调用）。
 *
 * 幂等地把月度验工状态同步到隐藏的安全文明措施费记录：
 *  - APPROVED            → 生成 / 刷新隐藏记录（APPROVED）
 *  - REJECTED / CANCELED → 隐藏记录置 CANCELED，后续累计自动排除
 *  - 其他（START/PENDING）→ 不动
 */
export const syncSafetyMeasureFromMonthlyMeasurement = async (params: {
  db: Knex
  measurementId: string
  status: string
  /** 回填场景下显式指定分部工程，绕过 includeSafetyMeasure 开关 */
  sectionIdsOverride?: string[]
}): Promise<SafetyMeasureSyncResult> => {
  const { db, measurementId, status, sectionIdsOverride } = params

  const measurement = await db<MonthlyMeasurementRecord>(MonthlyMeasurements.name)
    .where('id', measurementId)
    .first()
  if (!measurement) {
    return { action: 'skipped', message: `月度验工不存在：${measurementId}` }
  }

  const sectionIds = sectionIdsOverride?.length
    ? sectionIdsOverride
    : measurement.includeSafetyMeasure
    ? normalizeSectionIds(measurement.safetySectionIds)
    : []

  if (!sectionIds.length) {
    return { action: 'skipped', message: '未开启安全文明措施费并入' }
  }

  if (status !== 'APPROVED') {
    const canceled = await db<SafetyMeasureRecord>(SafetyMeasures.name)
      .where('sourceMeasurementId', measurementId)
      .update({ approveStatus: 'CANCELED', updatedAt: new Date() })
    return canceled
      ? { action: 'canceled' }
      : { action: 'noop', message: '无隐藏记录需要作废' }
  }

  const boqItems = await db<BoqItemRecord>(BoqItems.name)
    .where('projectId', measurement.project_id)
    .select('id', 'parentId', 'type')

  const safetyBoqItemIds = resolveSafetyMeasureBoqItemIds({ boqItems, sectionIds })

  return await materializeSafetyMeasureFromMeasurement({
    db,
    measurementId,
    safetyBoqItemIds,
    sectionIds
  })
}
