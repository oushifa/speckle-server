import type {
  MonthlyMeasurementItemRecord,
  MonthlyMeasurementRecord,
  QualityAcceptanceFormRecord
} from '@/modules/core/helpers/types'
import type { BoqItemRecord } from '@/modules/bop-item/repositories/boq'
import { BadRequestError } from '@/modules/shared/errors'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'
import dayjs from 'dayjs'

type MonthlyMeasurementPreviewItem = {
  boqItemId: string
  boqCode: string
  boqName: string
  boqParentId: string | null
  boqDepth: number
  uom: string | null
  price: number | null
  pendingTotalQty: number
  approvedCumulativeQty: number
  measuredQtyDefault: number
  sourceAcceptanceIds: string[]
  sourceAcceptances: QualityAcceptanceFormRecord[]
  isSummaryRow: boolean
  sortIndex: number
}

const prepareMonthlyMeasurementSnapshotRows = (
  rows: MonthlyMeasurementPreviewItem[],
  measuredItems: Array<{ boqItemId: string }> | undefined
) => {
  if (!rows.length) return rows
  if (!measuredItems?.length) return rows

  const selectedLeafIds = new Set(
    measuredItems.map((item) => item.boqItemId).filter(Boolean)
  )
  const rowById = new Map(rows.map((row) => [row.boqItemId, row]))
  const selectedIds = new Set<string>()

  for (const row of rows) {
    if (row.isSummaryRow || !selectedLeafIds.has(row.boqItemId)) continue
    let cursor: string | null = row.boqItemId
    while (cursor) {
      if (selectedIds.has(cursor)) break
      selectedIds.add(cursor)
      cursor = rowById.get(cursor)?.boqParentId || null
    }
  }

  const selectedRows = rows
    .filter((row) => selectedIds.has(row.boqItemId))
    .map((row) => ({ ...row }))
  if (!selectedRows.length) return []

  const selectedRowById = new Map(selectedRows.map((row) => [row.boqItemId, row]))
  const childrenMap = new Map<string | null, MonthlyMeasurementPreviewItem[]>()
  for (const row of selectedRows) {
    const parentId = row.boqParentId || null
    const list = childrenMap.get(parentId) || []
    list.push(row)
    childrenMap.set(parentId, list)
  }

  const ordered = selectedRows.sort((a, b) => a.sortIndex - b.sortIndex)
  for (const row of ordered) {
    if (!row.isSummaryRow) continue
    row.pendingTotalQty = 0
    row.approvedCumulativeQty = 0
    row.measuredQtyDefault = 0
    row.sourceAcceptanceIds = []
    row.sourceAcceptances = []
  }
  for (const row of [...ordered].sort((a, b) => b.sortIndex - a.sortIndex)) {
    if (!row.isSummaryRow) continue
    const children = childrenMap.get(row.boqItemId) || []
    for (const child of children) {
      const current = selectedRowById.get(row.boqItemId)
      if (!current) continue
      current.pendingTotalQty += Math.max(child.pendingTotalQty, 0)
      current.approvedCumulativeQty += child.approvedCumulativeQty
    }
  }

  return ordered
}

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

const toNullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isNaN(value) ? null : value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const isApprovedStatus = (status: unknown) => {
  if (typeof status !== 'string') return false
  return status.trim().toUpperCase() === 'APPROVED'
}

const isPendingStatus = (status: unknown) => {
  return (
    status === null ||
    status === undefined ||
    (typeof status === 'string' && status.trim() === '')
  )
}

const mapQualityApproveStatusFromFlowStatus = (status: string) => {
  if (status === 'pending') return 'PENDING'
  if (status === 'approved') return 'APPROVED'
  if (status === 'rejected') return 'REJECTED'
  if (status === 'canceled') return 'CANCELED'
  return ''
}

type BuildPreviewDeps = {
  getQualityAcceptanceFormsBeforeBaseDate: (params: {
    projectId: string
    baseDate: number
    startDate?: number | null
    endDate?: number | null
    currentMeasurementId?: string | null
  }) => Promise<QualityAcceptanceFormRecord[]>
  getProjectBoqItems: (params: { projectId: string }) => Promise<BoqItemRecord[]>
  getQualityAcceptanceFormsByIds: (params: { ids: string[] }) => Promise<QualityAcceptanceFormRecord[]>
}

export const buildMonthlyMeasurementPreviewFactory =
  (deps: BuildPreviewDeps) =>
  async (params: {
    projectId: string
    baseDate: number
    startDate?: number | null
    endDate?: number | null
    excludedAcceptanceIds?: string[]
    pinnedAcceptanceIds?: string[]
    currentMeasurementId?: string | null
  }) => {
    const [allAcceptanceForms, pinnedForms, boqItems] = await Promise.all([
      deps.getQualityAcceptanceFormsBeforeBaseDate({
        projectId: params.projectId,
        baseDate: params.baseDate,
        startDate: params.startDate,
        endDate: params.endDate,
        currentMeasurementId: params.currentMeasurementId
      }),
      params.pinnedAcceptanceIds?.length
        ? deps.getQualityAcceptanceFormsByIds({ ids: params.pinnedAcceptanceIds })
        : Promise.resolve([] as QualityAcceptanceFormRecord[]),
      deps.getProjectBoqItems({ projectId: params.projectId })
    ])

    const excludedIds = new Set(params.excludedAcceptanceIds || [])
    const seenIds = new Set<string>()
    const acceptanceForms: QualityAcceptanceFormRecord[] = []
    const isInMeasurementWindow = (form: QualityAcceptanceFormRecord) => {
      const actualFinishDate = toNullableNumber(form.actualFinishDate)
      if (actualFinishDate === null) return false
      if (params.startDate && actualFinishDate < params.startDate) return false
      if (params.endDate && actualFinishDate > params.endDate) return false
      return true
    }
    // Merge: pinned first (so they keep their approveStatus as-is for qty calc),
    // then new unreviewed ones from the date range
    for (const f of [...pinnedForms, ...allAcceptanceForms]) {
      if (excludedIds.has(f.id) || seenIds.has(f.id)) continue
      if ((params.startDate || params.endDate) && !isInMeasurementWindow(f)) continue
      seenIds.add(f.id)
      // Treat pinned forms (PENDING status) as if they are still unreviewed for qty calc
      acceptanceForms.push(
        params.pinnedAcceptanceIds?.includes(f.id) && f.approveStatus === 'PENDING'
          ? { ...f, approveStatus: null }
          : f
      )
    }

    const boqById = new Map(boqItems.map((item) => [item.id, item]))
    const boqIdByCode = new Map(
      boqItems
        .map((item) => [item.code?.trim(), item.id] as const)
        .filter((pair): pair is [string, string] => Boolean(pair[0]))
    )

    const grouped = new Map<
      string,
      {
        pendingMeasuredQty: number
        approvedCumulativeQty: number
        sourceAcceptanceIds: string[]
        sourceAcceptances: QualityAcceptanceFormRecord[]
      }
    >()
    const pendingBoqIds = new Set<string>()

    for (const form of acceptanceForms) {
      const resolvedBoqItemId =
        form.boqItemId && boqById.has(form.boqItemId)
          ? form.boqItemId
          : boqIdByCode.get(form.code?.trim() || '')
      if (!resolvedBoqItemId) continue

      const current = grouped.get(resolvedBoqItemId) || {
        pendingMeasuredQty: 0,
        approvedCumulativeQty: 0,
        sourceAcceptanceIds: [],
        sourceAcceptances: []
      }
      const workVolume = toNumber(form.workVolume)
      if (isPendingStatus(form.approveStatus)) {
        current.pendingMeasuredQty += workVolume
        current.sourceAcceptanceIds.push(form.id)
        current.sourceAcceptances.push(form)
        pendingBoqIds.add(resolvedBoqItemId)
      }
      if (isApprovedStatus(form.approveStatus)) {
        current.approvedCumulativeQty += workVolume
      }
      grouped.set(resolvedBoqItemId, current)
    }

    const parentIds = new Set<string>()
    for (const item of boqItems) {
      if (item.parentId) {
        parentIds.add(item.parentId)
      }
    }

    const includedItems = boqItems
    const childrenMap = new Map<string | null, BoqItemRecord[]>()
    for (const item of includedItems) {
      const list = childrenMap.get(item.parentId || null) || []
      list.push(item)
      childrenMap.set(item.parentId || null, list)
    }
    for (const entries of childrenMap.values()) {
      entries.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return a.id.localeCompare(b.id)
      })
    }

    const previewById = new Map<string, MonthlyMeasurementPreviewItem>()
    for (const item of includedItems) {
      const groupedItem = grouped.get(item.id)
      previewById.set(item.id, {
        boqItemId: item.id,
        boqCode: item.code,
        boqName: item.name,
        boqParentId: item.parentId,
        boqDepth: item.depth,
        uom: item.unit,
        price: item.price === null ? null : Number(item.price),
        pendingTotalQty: toNullableNumber(item.quantity) ?? -1,
        approvedCumulativeQty: groupedItem?.approvedCumulativeQty || 0,
        measuredQtyDefault: groupedItem?.pendingMeasuredQty || 0,
        sourceAcceptanceIds: groupedItem?.sourceAcceptanceIds || [],
        sourceAcceptances: groupedItem?.sourceAcceptances || [],
        isSummaryRow: parentIds.has(item.id),
        sortIndex: 0
      })
    }

    const dfsAggregate = (boqItemId: string) => {
      const children = childrenMap.get(boqItemId) || []
      for (const child of children) {
        dfsAggregate(child.id)
      }
      const current = previewById.get(boqItemId)
      if (!current) return
      if (!children.length) return
      
      current.pendingTotalQty = 0
      current.approvedCumulativeQty = 0
      
      for (const child of children) {
        const childPreview = previewById.get(child.id)
        if (!childPreview) continue
        current.pendingTotalQty += Math.max(childPreview.pendingTotalQty, 0)
        current.approvedCumulativeQty += childPreview.approvedCumulativeQty
      }
      if (current.isSummaryRow) {
        current.measuredQtyDefault = 0
      }
    }

    const roots = childrenMap.get(null) || []
    for (const root of roots) {
      dfsAggregate(root.id)
    }

    const ordered: MonthlyMeasurementPreviewItem[] = []
    const dfsOrdered = (boqItemId: string) => {
      const node = previewById.get(boqItemId)
      if (!node) return
      ordered.push(node)
      for (const child of childrenMap.get(boqItemId) || []) {
        dfsOrdered(child.id)
      }
    }
    for (const root of roots) {
      dfsOrdered(root.id)
    }
    for (const [index, item] of ordered.entries()) {
      item.sortIndex = index
    }

    return {
      baseDate: params.baseDate,
      items: ordered
    }
  }

export const mapFlowStatusToMonthlyMeasurementApproveStatus = (status: string) => {
  if (status === 'pending') return 'PENDING'
  if (status === 'approved') return 'APPROVED'
  if (status === 'rejected') return 'REJECTED'
  if (status === 'canceled') return 'CANCELED'
  return ''
}

type CreateMeasurementDeps = {
  db: any
  buildPreview: (params: {
    projectId: string
    baseDate: number
    startDate?: number | null
    endDate?: number | null
    excludedAcceptanceIds?: string[]
    currentMeasurementId?: string | null
  }) => Promise<{ baseDate: number; items: MonthlyMeasurementPreviewItem[] }>
  createMeasurement: (
    payload: MonthlyMeasurementRecord
  ) => Promise<MonthlyMeasurementRecord>
  insertMeasurementItems: (items: MonthlyMeasurementItemRecord[]) => Promise<void>
}

export const createMonthlyMeasurementFromPreviewFactory =
  (deps: CreateMeasurementDeps) =>
  async (params: {
    projectId: string
    unit?: string | null
    code: string
    baseDate: number
    startDate?: number | null
    endDate?: number | null
    creator: string
    measuredItems?: Array<{
      boqItemId: string
      measuredQty?: number | null
      remark?: string
    }>
    excludedAcceptanceIds?: string[]
    safetyMeasureId?: string | null
  }) => {
    const preview = await deps.buildPreview({
      projectId: params.projectId,
      baseDate: params.baseDate,
      startDate: params.startDate,
      endDate: params.endDate,
      excludedAcceptanceIds: params.excludedAcceptanceIds
    })
    const rows = preview.items
    if (!rows.length) {
      throw new BadRequestError('未找到可生成验工明细的清单项')
    }

    const currentYear = dayjs(params.baseDate).year()

    // 1. 获取所有的历史已通过的明细记录（投资监理审定量）
    const approvedItems = await deps.db('monthly_measurement_items')
      .join(
        'monthly_measurements',
        'monthly_measurement_items.measurementId',
        'monthly_measurements.id'
      )
      .where('monthly_measurements.project_id', params.projectId)
      .andWhere('monthly_measurements.approveStatus', 'APPROVED')
      .select(
        'monthly_measurement_items.boqItemId',
        'monthly_measurement_items.investmentQty',
        'monthly_measurement_items.leaderPayAmt',
        'monthly_measurement_items.investmentPayAmt',
        'monthly_measurements.baseDate'
      )

    // 汇总成 Map
    const historyMap = new Map<string, number>()
    const yearlyMap = new Map<string, number>()
    const payMap = new Map<string, number>()

    for (const row of approvedItems) {
      const qty = Number(row.investmentQty || 0)
      const pay = Number(row.leaderPayAmt || 0)
      const rowYear = dayjs(Number(row.baseDate)).year()

      historyMap.set(row.boqItemId, (historyMap.get(row.boqItemId) || 0) + qty)
      payMap.set(row.boqItemId, (payMap.get(row.boqItemId) || 0) + pay)
      if (rowYear === currentYear) {
        yearlyMap.set(row.boqItemId, (yearlyMap.get(row.boqItemId) || 0) + qty)
      }
    }

    const customValues = new Map(
      (params.measuredItems || []).map((item) => [item.boqItemId, item])
    )

    // 2. 获取安全文明措施费明细项，用于工程量覆盖
    const safetyMap = new Map<string, { contractorQty: number; supervisionQty: number; headquartersQty: number; investmentQty: number }>()
    if (params.safetyMeasureId) {
      const safetyItems = await deps.db('safety_measure_items')
        .where('safetyMeasureId', params.safetyMeasureId)
        .andWhere('isSummaryRow', false)
        .select('boqItemId', 'contractorQty', 'supervisionQty', 'headquartersQty', 'engineeringQty')
      for (const s of safetyItems) {
        safetyMap.set(s.boqItemId, {
          contractorQty: Number(s.contractorQty) || 0,
          supervisionQty: Number(s.supervisionQty) || 0,
          headquartersQty: Number(s.headquartersQty) || 0,
          investmentQty: Number(s.engineeringQty) || 0
        })
      }
    }

    const now = new Date()
    const measurement = await deps.createMeasurement({
      id: cryptoRandomString({ length: 10 }),
      project_id: params.projectId,
      unit: params.unit?.trim() || null,
      code: params.code.trim(),
      baseDate: String(params.baseDate),
      approveStatus: null,
      flowInstanceId: null,
      creator: params.creator,
      createdAt: now,
      updatedAt: now
    })

    const items: MonthlyMeasurementItemRecord[] = rows.map((row) => {
      const custom = customValues.get(row.boqItemId)
      const measuredQty =
        row.isSummaryRow ||
        custom?.measuredQty === null ||
        custom?.measuredQty === undefined
          ? row.measuredQtyDefault
          : Number(custom.measuredQty)
      const finalQty = Number.isNaN(measuredQty) ? row.measuredQtyDefault : measuredQty

      // 如果属于安全文明措施费包含的清单项，则各角色本月完成数使用安全文明措施的对应字段
      const safetyVals = !row.isSummaryRow ? safetyMap.get(row.boqItemId) : null

      return {
        id: cryptoRandomString({ length: 10 }),
        measurementId: measurement.id,
        boqItemId: row.boqItemId,
        boqCode: row.boqCode,
        boqName: row.boqName,
        boqParentId: row.boqParentId,
        boqDepth: row.boqDepth,
        isSummaryRow: row.isSummaryRow,
        sortIndex: row.sortIndex,
        uom: row.uom,
        price: row.price,
        pendingTotalQty: row.pendingTotalQty,
        approvedCumulativeQty: row.approvedCumulativeQty,
        measuredQty: finalQty, // 辅助验工量依然使用质量验收工程量
        contractorQty: safetyVals ? safetyVals.contractorQty : finalQty,
        supervisionQty: safetyVals ? safetyVals.supervisionQty : finalQty,
        headquartersQty: safetyVals ? safetyVals.headquartersQty : finalQty,
        investmentQty: safetyVals ? safetyVals.investmentQty : finalQty,
        contractorPayAmt: 0,
        investmentPayAmt: 0,
        contractPayAmt: 0,
        leaderPayAmt: 0,
        lastCumulativeQty: historyMap.get(row.boqItemId) || 0,
        yearlyCumulativeQty: yearlyMap.get(row.boqItemId) || 0,
        lastCumulativePay: payMap.get(row.boqItemId) || 0,
        remark: row.isSummaryRow ? null : custom?.remark?.trim() || null,
        sourceAcceptanceIds: row.sourceAcceptanceIds,
        createdAt: now,
        updatedAt: now
      }
    })

    await deps.insertMeasurementItems(items)

    // 3. 占用质量验收单
    const allSourceAcceptanceIds = Array.from(
      new Set(items.flatMap((it) => it.sourceAcceptanceIds || []).filter(Boolean))
    )
    if (allSourceAcceptanceIds.length > 0) {
      await deps.db('quality_acceptance_forms')
        .whereIn('id', allSourceAcceptanceIds)
        .update({
          occupiedMeasurementId: measurement.id,
          updatedAt: new Date()
        })
    }

    return {
      measurement,
      items
    }
  }

export const mapFlowStatusToQualityAcceptanceApproveStatus =
  mapQualityApproveStatusFromFlowStatus

export { prepareMonthlyMeasurementSnapshotRows }
