import type { Knex } from 'knex'
import cryptoRandomString from 'crypto-random-string'
import dayjs from 'dayjs'
import { BoqItems } from '@/modules/core/dbSchema'
import type { BoqItemRecord } from '@/modules/bop-item/repositories/boq'
import {
  BOQ_REVIEW_RECORDS_TABLE,
  BOQ_REVIEW_ROWS_TABLE,
  calcReviewRow,
  editQtyField,
  parseOptionalNumber,
  roundTo,
  type BoqReviewKind,
  type BoqReviewRowInput,
  type BoqReviewRowSource,
  type BoqReviewSnapshot,
  type BoqReviewStage
} from '@/modules/bop-item/services/boqReviewApply'
import { NotFoundError } from '@/modules/shared/errors'

export type BoqReviewAttachment = {
  id?: string
  name: string
  size?: string | number
  url?: string
  blobId?: string
  uploadedAt?: string
  uploadedBy?: string
}

export type BoqReviewHistoryEntry = {
  at: string
  by: string
  action: string
  reason?: string
  createdCount?: number
  updatedCount?: number
}

export type BoqReviewRowDto = {
  id: string
  recordId: string
  projectId: string
  sortIndex: number
  source: BoqReviewRowSource
  boqItemId: string | null
  sourceCode: string | null
  parentCode: string | null
  code: string
  name: string
  unit: string
  baseChangeQty: number
  reviewQty?: number
  reviewQtySupervisor?: number
  reviewQtyContract?: number
  changeQty?: number
  changeQtySupervisor?: number
  changeQtyContract?: number
  reviewUnitPrice: number
  beforeSnapshot: BoqReviewSnapshot | null
  afterSnapshot: BoqReviewSnapshot | null
}

export type BoqReviewStepChainItem = {
  id: string
  stepIndex: number
  name: string
  status: string
  approverIds: string[]
  approverNames: string[]
  approverUsers: Array<{ id: string; name: string }>
  approvedByIds: string[]
  approvedByNames: string[]
  approvedByUsers: Array<{ id: string; name: string }>
  requiredApprovals: number
  startedAt: string | null
  completedAt: string | null
}

export type BoqReviewActionItem = {
  id: string
  instanceId: string
  stepId: string | null
  stepName: string | null
  action: string
  actorId: string
  actorName: string
  fromStatus: string | null
  toStatus: string | null
  comment: string | null
  createdAt: string
}

export type BoqReviewRecordSummaryDto = {
  id: string
  projectId: string
  kind: BoqReviewKind
  code: string
  reason: string
  applicant: string
  applicantId: string | null
  applyDate: string
  approveStatus: string
  flowInstanceId: string | null
  bindingId: string | null
  effectiveAt: string | null
  attachments: BoqReviewAttachment[]
  history: BoqReviewHistoryEntry[]
  itemCount: number
  reviewTotalAmount: number
  changeTotalAmount: number
  totalAmount: number
  currentStep: number | null
  currentStepName: string
  currentStepApprovers: string[]
  currentStage: BoqReviewStage
  approvalChain: BoqReviewStepChainItem[]
  rows: BoqReviewRowDto[]
  createdAt: string
  updatedAt: string
}

export type BoqReviewRecordDetailDto = BoqReviewRecordSummaryDto & {
  binding: Record<string, unknown> | null
  flowInstance: Record<string, unknown> | null
  steps: BoqReviewStepChainItem[]
  actions: BoqReviewActionItem[]
}

export type BoqItemTraceSummaryItem = {
  totalCount: number
  approvedCount: number
  pendingCount: number
  returnedCount: number
  draftCount: number
  latestRecordId: string
  latestCode: string
  latestKind: BoqReviewKind
  latestStatus: string
  createdByReview: boolean
  createdByRecordCode: string | null
  createdByKind: BoqReviewKind | null
}

const parseJsonArray = <T>(raw: unknown): T[] => {
  if (Array.isArray(raw)) return raw as T[]
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }
  return []
}

const parseJsonObject = <T>(raw: unknown): T | null => {
  if (!raw) return null
  if (typeof raw === 'object') return raw as T
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? (parsed as T) : null
    } catch {
      return null
    }
  }
  return null
}

const toIsoStringOrNull = (val: unknown): string | null => {
  if (!val) return null
  if (val instanceof Date) return val.toISOString()
  return String(val)
}

export const resolveStageFromStepName = (
  approveStatus: string,
  stepName?: string | null,
  stepIndex?: number | null
): BoqReviewStage => {
  const normStatus = String(approveStatus || 'START')
    .trim()
    .toUpperCase()
  if (normStatus === 'START' || normStatus === 'DRAFT' || normStatus === 'RETURNED') {
    return 'contractor'
  }
  if (normStatus === 'APPROVED') {
    return 'contract'
  }
  const name = String(stepName || '').trim()
  if (
    name.includes('合约') ||
    name.includes('计划合同') ||
    name.includes('造价') ||
    name.includes('审定') ||
    name.includes('终审')
  ) {
    return 'contract'
  }
  if (
    name.includes('监理') ||
    name.includes('财务') ||
    name.includes('投资') ||
    name.includes('指挥') ||
    name.includes('工管')
  ) {
    return 'supervisor'
  }
  if (name.includes('施工') || name.includes('发起') || name.includes('提交')) {
    return 'contractor'
  }
  if (stepIndex === 1) return 'supervisor'
  if (stepIndex && stepIndex >= 2) return 'contract'
  return 'contractor'
}

export const mapBoqReviewRowRecord = (row: Record<string, any>): BoqReviewRowDto => {
  const reviewQty = parseOptionalNumber(row.reviewQty)
  const reviewQtySupervisor = parseOptionalNumber(row.reviewQtySupervisor)
  const reviewQtyContract = parseOptionalNumber(row.reviewQtyContract)
  const changeQty = parseOptionalNumber(row.changeQty)
  const changeQtySupervisor = parseOptionalNumber(row.changeQtySupervisor)
  const changeQtyContract = parseOptionalNumber(row.changeQtyContract)
  const baseChangeQty = parseOptionalNumber(row.baseChangeQty) ?? 0
  const reviewUnitPrice = parseOptionalNumber(row.reviewUnitPrice) ?? 0

  const dto: BoqReviewRowDto = {
    id: String(row.id),
    recordId: String(row.recordId),
    projectId: String(row.projectId),
    sortIndex: Number(row.sortIndex ?? 0),
    source: (row.source === 'create' || row.source === 'file'
      ? row.source
      : 'import') as BoqReviewRowSource,
    boqItemId: row.boqItemId ? String(row.boqItemId) : null,
    sourceCode: row.sourceCode ? String(row.sourceCode) : null,
    parentCode: row.parentCode ? String(row.parentCode) : null,
    code: String(row.code || ''),
    name: String(row.name || ''),
    unit: String(row.unit || ''),
    baseChangeQty,
    reviewUnitPrice,
    beforeSnapshot: parseJsonObject<BoqReviewSnapshot>(row.beforeSnapshot),
    afterSnapshot: parseJsonObject<BoqReviewSnapshot>(row.afterSnapshot)
  }

  if (reviewQty !== undefined) dto.reviewQty = reviewQty
  if (reviewQtySupervisor !== undefined) dto.reviewQtySupervisor = reviewQtySupervisor
  if (reviewQtyContract !== undefined) dto.reviewQtyContract = reviewQtyContract
  if (changeQty !== undefined) dto.changeQty = changeQty
  if (changeQtySupervisor !== undefined) dto.changeQtySupervisor = changeQtySupervisor
  if (changeQtyContract !== undefined) dto.changeQtyContract = changeQtyContract

  return dto
}

/**
 * 自动生成下一个复核单/签证单编号：`FH-2026-001` 或 `QZ-2026-001`
 */
export const generateNextBoqReviewCodeFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; kind: BoqReviewKind; year?: string }) => {
    const prefix = params.kind === 'change' ? 'QZ' : 'FH'
    const yearStr = params.year || dayjs().format('YYYY')
    const fullPrefix = `${prefix}-${yearStr}-`

    const existing = await deps
      .db(BOQ_REVIEW_RECORDS_TABLE)
      .where('projectId', params.projectId)
      .andWhere('kind', params.kind)
      .select('code')

    let maxSeq = 0
    for (const item of existing) {
      const code = String(item.code || '').trim()
      if (code.startsWith(fullPrefix)) {
        const tail = code.slice(fullPrefix.length)
        const num = Number.parseInt(tail, 10)
        if (!Number.isNaN(num) && num > maxSeq) {
          maxSeq = num
        }
      }
    }

    return `${fullPrefix}${String(maxSeq + 1).padStart(3, '0')}`
  }

/**
 * 批量加载主库中的审批流绑定、实例、步骤、动作与用户信息
 */
async function loadWorkflowContextForRecordIds(params: {
  mainDb: Knex
  recordIds: string[]
  fallbackFlowInstanceIds?: string[]
  includeActions?: boolean
}) {
  const {
    mainDb,
    recordIds,
    fallbackFlowInstanceIds = [],
    includeActions = false
  } = params
  const bindingByRecordId = new Map<string, Record<string, any>>()
  const instanceById = new Map<string, Record<string, any>>()
  const stepsByInstanceId = new Map<string, Array<Record<string, any>>>()
  const actionsByInstanceId = new Map<string, Array<Record<string, any>>>()
  const userById = new Map<string, { id: string; name: string }>()

  if (recordIds.length === 0) {
    return {
      bindingByRecordId,
      instanceById,
      stepsByInstanceId,
      actionsByInstanceId,
      userById
    }
  }

  try {
    const subjectKeys = recordIds.map((id) => `${BOQ_REVIEW_RECORDS_TABLE}:${id}`)
    const bindings = await mainDb('approval_flow_bindings').whereIn(
      'subjectKey',
      subjectKeys
    )

    const instanceIds = new Set<string>()
    for (const b of bindings) {
      const recId = String(b.subjectId || '').trim()
      if (recId) {
        bindingByRecordId.set(recId, b)
      }
      if (b.currentInstanceId) {
        instanceIds.add(String(b.currentInstanceId))
      }
    }
    for (const fid of fallbackFlowInstanceIds) {
      if (fid) instanceIds.add(String(fid))
    }

    const instanceIdList = Array.from(instanceIds)
    if (instanceIdList.length > 0) {
      const [instances, steps, actions] = await Promise.all([
        mainDb('approval_flow_instances').whereIn('id', instanceIdList),
        mainDb('approval_flow_instance_steps')
          .whereIn('instanceId', instanceIdList)
          .orderBy('stepIndex', 'asc'),
        includeActions
          ? mainDb('approval_flow_actions')
              .whereIn('instanceId', instanceIdList)
              .orderBy('createdAt', 'asc')
          : Promise.resolve([])
      ])

      for (const inst of instances) {
        instanceById.set(String(inst.id), inst)
      }

      const userIds = new Set<string>()
      for (const inst of instances) {
        if (inst.createdBy) userIds.add(String(inst.createdBy))
      }

      for (const step of steps) {
        const iid = String(step.instanceId)
        const list = stepsByInstanceId.get(iid) || []
        list.push(step)
        stepsByInstanceId.set(iid, list)

        if (Array.isArray(step.approverIds)) {
          step.approverIds.forEach((uid: string) => {
            if (uid) userIds.add(String(uid))
          })
        }
        if (Array.isArray(step.approvedByIds)) {
          step.approvedByIds.forEach((uid: string) => {
            if (uid) userIds.add(String(uid))
          })
        }
      }

      for (const act of actions) {
        const iid = String(act.instanceId)
        const list = actionsByInstanceId.get(iid) || []
        list.push(act)
        actionsByInstanceId.set(iid, list)
        if (act.actorId) userIds.add(String(act.actorId))
      }

      const userIdList = Array.from(userIds)
      if (userIdList.length > 0) {
        const users = await mainDb('users')
          .whereIn('id', userIdList)
          .select('id', 'name')
        for (const u of users) {
          userById.set(String(u.id), {
            id: String(u.id),
            name: String(u.name || u.id)
          })
        }
      }
    }
  } catch {
    // 容错：若在轻量单测环境无工作流表，忽略工作流附加查询
  }

  return {
    bindingByRecordId,
    instanceById,
    stepsByInstanceId,
    actionsByInstanceId,
    userById
  }
}

function buildStepChainAndActions(params: {
  instanceId: string | null
  stepsByInstanceId: Map<string, Array<Record<string, any>>>
  actionsByInstanceId: Map<string, Array<Record<string, any>>>
  userById: Map<string, { id: string; name: string }>
}) {
  const { instanceId, stepsByInstanceId, actionsByInstanceId, userById } = params
  if (!instanceId) {
    return {
      steps: [] as BoqReviewStepChainItem[],
      actions: [] as BoqReviewActionItem[],
      currentStep: null as number | null,
      currentStepName: '',
      currentStepApprovers: [] as string[]
    }
  }

  const rawSteps = stepsByInstanceId.get(instanceId) || []
  const stepNameById = new Map<string, string>()

  const steps: BoqReviewStepChainItem[] = rawSteps.map((s) => {
    const sid = String(s.id)
    const sname = String(s.name || '')
    stepNameById.set(sid, sname)

    const approverIds: string[] = Array.isArray(s.approverIds)
      ? s.approverIds.map(String)
      : []
    const approvedByIds: string[] = Array.isArray(s.approvedByIds)
      ? s.approvedByIds.map(String)
      : []

    const approverUsers = approverIds.map(
      (uid) => userById.get(uid) || { id: uid, name: uid }
    )
    const approvedByUsers = approvedByIds.map(
      (uid) => userById.get(uid) || { id: uid, name: uid }
    )

    return {
      id: sid,
      stepIndex: Number(s.stepIndex ?? 0),
      name: sname,
      status: String(s.status || 'WAITING'),
      approverIds,
      approverNames: approverUsers.map((u) => u.name),
      approverUsers,
      approvedByIds,
      approvedByNames: approvedByUsers.map((u) => u.name),
      approvedByUsers,
      requiredApprovals: Number(s.requiredApprovals ?? 1),
      startedAt: toIsoStringOrNull(s.startedAt),
      completedAt: toIsoStringOrNull(s.completedAt)
    }
  })

  const pendingStep = steps.find((s) => s.status === 'PENDING')
  const currentStep = pendingStep ? pendingStep.stepIndex : null
  const currentStepName = pendingStep ? pendingStep.name : ''
  const currentStepApprovers = pendingStep ? pendingStep.approverNames : []

  const rawActions = actionsByInstanceId.get(instanceId) || []
  const actions: BoqReviewActionItem[] = rawActions.map((a) => {
    const actorId = String(a.actorId || '')
    const actor = userById.get(actorId)
    const stepId = a.stepId ? String(a.stepId) : null
    return {
      id: String(a.id),
      instanceId: String(a.instanceId),
      stepId,
      stepName: stepId ? stepNameById.get(stepId) || null : null,
      action: String(a.action || ''),
      actorId,
      actorName: actor ? actor.name : actorId,
      fromStatus: a.fromStatus ? String(a.fromStatus) : null,
      toStatus: a.toStatus ? String(a.toStatus) : null,
      comment: a.comment ? String(a.comment) : null,
      createdAt: toIsoStringOrNull(a.createdAt) || ''
    }
  })

  return {
    steps,
    actions,
    currentStep,
    currentStepName,
    currentStepApprovers
  }
}

function mapEffectiveApproveStatus(
  recordStatus: string | null | undefined,
  bindingStatus: string | null | undefined
): string {
  if (recordStatus === 'APPROVED') return 'APPROVED'
  if (!bindingStatus) return recordStatus || 'START'
  if (bindingStatus === 'IN_REVIEW') return 'PENDING'
  if (bindingStatus === 'DRAFT') return 'START'
  return bindingStatus
}

/**
 * 查询复核单/签证单列表
 */
export const listBoqReviewRecordsFactory =
  (deps: { db: Knex; mainDb?: Knex }) =>
  async (params: {
    projectId: string
    kind?: BoqReviewKind | string | null
    search?: string | null
  }): Promise<BoqReviewRecordSummaryDto[]> => {
    const mainDb = deps.mainDb || deps.db
    const query = deps
      .db(BOQ_REVIEW_RECORDS_TABLE)
      .where('projectId', params.projectId)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')

    if (params.kind === 'review' || params.kind === 'change') {
      query.andWhere('kind', params.kind)
    }

    const records = await query
    if (!records.length) return []

    const recordIds = records.map((r: any) => String(r.id))
    const allRows = await deps
      .db(BOQ_REVIEW_ROWS_TABLE)
      .whereIn('recordId', recordIds)
      .orderBy('sortIndex', 'asc')
      .orderBy('id', 'asc')

    const rowsByRecordId = new Map<string, BoqReviewRowDto[]>()
    for (const r of allRows) {
      const dto = mapBoqReviewRowRecord(r)
      const list = rowsByRecordId.get(dto.recordId) || []
      list.push(dto)
      rowsByRecordId.set(dto.recordId, list)
    }

    const searchKw = String(params.search || '')
      .trim()
      .toLowerCase()

    const filteredRecords = searchKw
      ? records.filter((rec: any) => {
          const hitHeader =
            String(rec.code || '')
              .toLowerCase()
              .includes(searchKw) ||
            String(rec.reason || '')
              .toLowerCase()
              .includes(searchKw) ||
            String(rec.applicant || '')
              .toLowerCase()
              .includes(searchKw)
          if (hitHeader) return true
          const rList = rowsByRecordId.get(String(rec.id)) || []
          return rList.some(
            (row) =>
              row.code.toLowerCase().includes(searchKw) ||
              row.name.toLowerCase().includes(searchKw)
          )
        })
      : records

    if (!filteredRecords.length) return []

    const wfCtx = await loadWorkflowContextForRecordIds({
      mainDb,
      recordIds: filteredRecords.map((r: any) => String(r.id)),
      fallbackFlowInstanceIds: filteredRecords
        .map((r: any) => r.flowInstanceId)
        .filter(Boolean),
      includeActions: false
    })

    return filteredRecords.map((rec: any): BoqReviewRecordSummaryDto => {
      const recId = String(rec.id)
      const kind: BoqReviewKind = rec.kind === 'change' ? 'change' : 'review'
      const rows = rowsByRecordId.get(recId) || []

      let reviewTotalAmount = 0
      let changeTotalAmount = 0
      for (const row of rows) {
        const c = calcReviewRow(row, kind)
        reviewTotalAmount = roundTo(reviewTotalAmount + c.reviewTotalPrice, 2)
        changeTotalAmount = roundTo(changeTotalAmount + c.changeAmount, 2)
      }

      const binding = wfCtx.bindingByRecordId.get(recId)
      const flowInstanceId =
        (binding?.currentInstanceId ? String(binding.currentInstanceId) : null) ||
        (rec.flowInstanceId ? String(rec.flowInstanceId) : null)
      const approveStatus = mapEffectiveApproveStatus(
        rec.approveStatus,
        binding?.status
      )

      const { steps, currentStep, currentStepName, currentStepApprovers } =
        buildStepChainAndActions({
          instanceId: flowInstanceId,
          stepsByInstanceId: wfCtx.stepsByInstanceId,
          actionsByInstanceId: wfCtx.actionsByInstanceId,
          userById: wfCtx.userById
        })

      const currentStage = resolveStageFromStepName(
        approveStatus,
        currentStepName,
        currentStep
      )

      return {
        id: recId,
        projectId: String(rec.projectId),
        kind,
        code: String(rec.code || ''),
        reason: String(rec.reason || ''),
        applicant: String(rec.applicant || ''),
        applicantId: rec.applicantId ? String(rec.applicantId) : null,
        applyDate: String(rec.applyDate || ''),
        approveStatus,
        flowInstanceId,
        bindingId: binding?.id ? String(binding.id) : null,
        effectiveAt: rec.effectiveAt ? String(rec.effectiveAt) : null,
        attachments: parseJsonArray<BoqReviewAttachment>(rec.attachments),
        history: parseJsonArray<BoqReviewHistoryEntry>(rec.history),
        itemCount: rows.length,
        reviewTotalAmount,
        changeTotalAmount,
        totalAmount: kind === 'change' ? changeTotalAmount : reviewTotalAmount,
        currentStep,
        currentStepName,
        currentStepApprovers,
        currentStage,
        approvalChain: steps.filter((s) => s.stepIndex > 0),
        rows,
        createdAt: toIsoStringOrNull(rec.createdAt) || '',
        updatedAt: toIsoStringOrNull(rec.updatedAt) || ''
      }
    })
  }

/**
 * 查询单张复核单/签证单完整详情（含明细行与工作流 steps/actions）
 */
export const getBoqReviewRecordDetailFactory =
  (deps: { db: Knex; mainDb?: Knex }) =>
  async (params: {
    projectId: string
    recordId: string
  }): Promise<BoqReviewRecordDetailDto | null> => {
    const mainDb = deps.mainDb || deps.db
    const rec = await deps
      .db(BOQ_REVIEW_RECORDS_TABLE)
      .where('id', params.recordId)
      .andWhere('projectId', params.projectId)
      .first()

    if (!rec) return null

    const recId = String(rec.id)
    const kind: BoqReviewKind = rec.kind === 'change' ? 'change' : 'review'

    const rawRows = await deps
      .db(BOQ_REVIEW_ROWS_TABLE)
      .where('recordId', recId)
      .orderBy('sortIndex', 'asc')
      .orderBy('id', 'asc')

    const rows = rawRows.map(mapBoqReviewRowRecord)

    let reviewTotalAmount = 0
    let changeTotalAmount = 0
    for (const row of rows) {
      const c = calcReviewRow(row, kind)
      reviewTotalAmount = roundTo(reviewTotalAmount + c.reviewTotalPrice, 2)
      changeTotalAmount = roundTo(changeTotalAmount + c.changeAmount, 2)
    }

    const wfCtx = await loadWorkflowContextForRecordIds({
      mainDb,
      recordIds: [recId],
      fallbackFlowInstanceIds: rec.flowInstanceId ? [String(rec.flowInstanceId)] : [],
      includeActions: true
    })

    const binding = wfCtx.bindingByRecordId.get(recId) || null
    const flowInstanceId =
      (binding?.currentInstanceId ? String(binding.currentInstanceId) : null) ||
      (rec.flowInstanceId ? String(rec.flowInstanceId) : null)
    const flowInstance = flowInstanceId
      ? wfCtx.instanceById.get(flowInstanceId) || null
      : null
    const approveStatus = mapEffectiveApproveStatus(rec.approveStatus, binding?.status)

    const { steps, actions, currentStep, currentStepName, currentStepApprovers } =
      buildStepChainAndActions({
        instanceId: flowInstanceId,
        stepsByInstanceId: wfCtx.stepsByInstanceId,
        actionsByInstanceId: wfCtx.actionsByInstanceId,
        userById: wfCtx.userById
      })

    const currentStage = resolveStageFromStepName(
      approveStatus,
      currentStepName,
      currentStep
    )

    return {
      id: recId,
      projectId: String(rec.projectId),
      kind,
      code: String(rec.code || ''),
      reason: String(rec.reason || ''),
      applicant: String(rec.applicant || ''),
      applicantId: rec.applicantId ? String(rec.applicantId) : null,
      applyDate: String(rec.applyDate || ''),
      approveStatus,
      flowInstanceId,
      bindingId: binding?.id ? String(binding.id) : null,
      effectiveAt: rec.effectiveAt ? String(rec.effectiveAt) : null,
      attachments: parseJsonArray<BoqReviewAttachment>(rec.attachments),
      history: parseJsonArray<BoqReviewHistoryEntry>(rec.history),
      itemCount: rows.length,
      reviewTotalAmount,
      changeTotalAmount,
      totalAmount: kind === 'change' ? changeTotalAmount : reviewTotalAmount,
      currentStep,
      currentStepName,
      currentStepApprovers,
      currentStage,
      approvalChain: steps.filter((s) => s.stepIndex > 0),
      rows,
      binding,
      flowInstance,
      steps,
      actions,
      createdAt: toIsoStringOrNull(rec.createdAt) || '',
      updatedAt: toIsoStringOrNull(rec.updatedAt) || ''
    }
  }

function prepareRowForInsert(params: {
  row: BoqReviewRowInput
  recordId: string
  projectId: string
  sortIndex: number
  kind: BoqReviewKind
  now: Date
}) {
  const { row, recordId, projectId, sortIndex, kind, now } = params
  // 若施工单位列有值，而监理/合约部列未传，则使用 editQtyField 自动初始化默认跟随值
  let normalizedRow: BoqReviewRowInput = { ...row }
  if (kind === 'review') {
    const c = parseOptionalNumber(normalizedRow.reviewQty)
    if (
      c !== undefined &&
      parseOptionalNumber(normalizedRow.reviewQtySupervisor) === undefined &&
      parseOptionalNumber(normalizedRow.reviewQtyContract) === undefined
    ) {
      normalizedRow = editQtyField(normalizedRow, 'contractor', c, 'review')
    }
  } else {
    const c = parseOptionalNumber(normalizedRow.changeQty)
    if (
      c !== undefined &&
      parseOptionalNumber(normalizedRow.changeQtySupervisor) === undefined &&
      parseOptionalNumber(normalizedRow.changeQtyContract) === undefined
    ) {
      normalizedRow = editQtyField(normalizedRow, 'contractor', c, 'change')
    }
  }

  const toDecimalOrNull = (val: unknown, digits = 6) => {
    const n = parseOptionalNumber(val)
    return n === undefined ? null : roundTo(n, digits)
  }

  return {
    id:
      row.id && String(row.id).trim().length <= 32
        ? String(row.id).trim()
        : cryptoRandomString({ length: 16, type: 'alphanumeric' }),
    recordId,
    projectId,
    sortIndex,
    source: row.source === 'create' || row.source === 'file' ? row.source : 'import',
    boqItemId: row.boqItemId ? String(row.boqItemId) : null,
    sourceCode: row.sourceCode ? String(row.sourceCode) : null,
    parentCode: row.parentCode ? String(row.parentCode) : null,
    code: String(row.code ?? '').trim(),
    name: String(row.name ?? '').trim(),
    unit: String(row.unit ?? '').trim(),
    baseChangeQty: toDecimalOrNull(normalizedRow.baseChangeQty, 6) ?? 0,
    reviewQty: toDecimalOrNull(normalizedRow.reviewQty, 6),
    reviewQtySupervisor: toDecimalOrNull(normalizedRow.reviewQtySupervisor, 6),
    reviewQtyContract: toDecimalOrNull(normalizedRow.reviewQtyContract, 6),
    changeQty: toDecimalOrNull(normalizedRow.changeQty, 6),
    changeQtySupervisor: toDecimalOrNull(normalizedRow.changeQtySupervisor, 6),
    changeQtyContract: toDecimalOrNull(normalizedRow.changeQtyContract, 6),
    reviewUnitPrice: toDecimalOrNull(normalizedRow.reviewUnitPrice, 2) ?? 0,
    beforeSnapshot: normalizedRow.beforeSnapshot
      ? JSON.stringify(normalizedRow.beforeSnapshot)
      : null,
    afterSnapshot: normalizedRow.afterSnapshot
      ? JSON.stringify(normalizedRow.afterSnapshot)
      : null,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * 新建复核单/签证单草稿（支持同时写入初始明细行）
 */
export const createBoqReviewRecordFactory =
  (deps: { db: Knex; mainDb?: Knex }) =>
  async (params: {
    projectId: string
    kind: BoqReviewKind
    code?: string | null
    reason?: string | null
    applicant?: string | null
    applicantId?: string | null
    applyDate?: string | null
    attachments?: BoqReviewAttachment[] | null
    history?: BoqReviewHistoryEntry[] | null
    rows?: BoqReviewRowInput[] | null
  }): Promise<BoqReviewRecordDetailDto> => {
    const kind: BoqReviewKind = params.kind === 'change' ? 'change' : 'review'
    const recordId = cryptoRandomString({ length: 12, type: 'alphanumeric' })
    const now = new Date()
    const applyDate =
      (params.applyDate && String(params.applyDate).trim()) ||
      dayjs(now).format('YYYY-MM-DD HH:mm')
    const applicant =
      (params.applicant && String(params.applicant).trim()) || '施工单位'

    const code =
      (params.code && String(params.code).trim()) ||
      (await generateNextBoqReviewCodeFactory({ db: deps.db })({
        projectId: params.projectId,
        kind
      }))

    const initialHistory: BoqReviewHistoryEntry[] =
      Array.isArray(params.history) && params.history.length > 0
        ? params.history
        : [
            {
              at: applyDate,
              by: applicant,
              action: '创建草稿'
            }
          ]

    const runInTx = async (trx: Knex) => {
      await trx(BOQ_REVIEW_RECORDS_TABLE).insert({
        id: recordId,
        projectId: params.projectId,
        kind,
        code,
        reason: String(params.reason ?? '').trim(),
        applicant,
        applicantId: params.applicantId || null,
        applyDate,
        approveStatus: 'START',
        flowInstanceId: null,
        effectiveAt: null,
        attachments: JSON.stringify(params.attachments || []),
        history: JSON.stringify(initialHistory),
        createdAt: now,
        updatedAt: now
      })

      if (Array.isArray(params.rows) && params.rows.length > 0) {
        const rowsToInsert = params.rows.map((row, idx) =>
          prepareRowForInsert({
            row,
            recordId,
            projectId: params.projectId,
            sortIndex: idx,
            kind,
            now
          })
        )
        await trx(BOQ_REVIEW_ROWS_TABLE).insert(rowsToInsert)
      }
    }

    if (deps.db.isTransaction) {
      await runInTx(deps.db)
    } else {
      await deps.db.transaction(runInTx)
    }

    const detail = await getBoqReviewRecordDetailFactory(deps)({
      projectId: params.projectId,
      recordId
    })
    if (!detail) {
      throw new NotFoundError('Failed to load created BOQ review record')
    }
    return detail
  }

/**
 * 保存/更新复核单或签证单主表与明细行
 */
export const saveBoqReviewRecordFactory =
  (deps: { db: Knex; mainDb?: Knex }) =>
  async (params: {
    projectId: string
    recordId: string
    reason?: string
    applicant?: string
    applyDate?: string
    attachments?: BoqReviewAttachment[]
    history?: BoqReviewHistoryEntry[]
    appendHistoryAction?: { by: string; action: string; reason?: string }
    rows?: BoqReviewRowInput[]
  }): Promise<BoqReviewRecordDetailDto> => {
    const existing = await deps
      .db(BOQ_REVIEW_RECORDS_TABLE)
      .where('id', params.recordId)
      .andWhere('projectId', params.projectId)
      .first()

    if (!existing) {
      throw new NotFoundError('清单审核单据不存在')
    }

    const kind: BoqReviewKind = existing.kind === 'change' ? 'change' : 'review'
    const now = new Date()

    const runInTx = async (trx: Knex) => {
      const patch: Record<string, any> = {
        updatedAt: now
      }
      if (params.reason !== undefined) {
        patch.reason = String(params.reason).trim()
      }
      if (params.applicant !== undefined) {
        patch.applicant = String(params.applicant).trim()
      }
      if (params.applyDate !== undefined) {
        patch.applyDate = String(params.applyDate).trim()
      }
      if (params.attachments !== undefined) {
        patch.attachments = JSON.stringify(params.attachments || [])
      }
      if (params.history !== undefined) {
        patch.history = JSON.stringify(params.history || [])
      } else if (params.appendHistoryAction) {
        const currentHist = parseJsonArray<BoqReviewHistoryEntry>(existing.history)
        currentHist.push({
          at: dayjs(now).format('YYYY-MM-DD HH:mm'),
          by: params.appendHistoryAction.by,
          action: params.appendHistoryAction.action,
          ...(params.appendHistoryAction.reason
            ? { reason: params.appendHistoryAction.reason }
            : {})
        })
        patch.history = JSON.stringify(currentHist)
      }

      await trx(BOQ_REVIEW_RECORDS_TABLE)
        .where('id', params.recordId)
        .andWhere('projectId', params.projectId)
        .update(patch)

      if (Array.isArray(params.rows)) {
        await trx(BOQ_REVIEW_ROWS_TABLE).where('recordId', params.recordId).delete()
        if (params.rows.length > 0) {
          const rowsToInsert = params.rows.map((row, idx) =>
            prepareRowForInsert({
              row,
              recordId: params.recordId,
              projectId: params.projectId,
              sortIndex: idx,
              kind,
              now
            })
          )
          await trx(BOQ_REVIEW_ROWS_TABLE).insert(rowsToInsert)
        }
      }
    }

    if (deps.db.isTransaction) {
      await runInTx(deps.db)
    } else {
      await deps.db.transaction(runInTx)
    }

    const detail = await getBoqReviewRecordDetailFactory(deps)({
      projectId: params.projectId,
      recordId: params.recordId
    })
    if (!detail) {
      throw new NotFoundError('清单审核单据不存在')
    }
    return detail
  }

/**
 * 删除复核单/签证单
 */
export const deleteBoqReviewRecordFactory =
  (deps: { db: Knex }) => async (params: { projectId: string; recordId: string }) => {
    const runInTx = async (trx: Knex) => {
      await trx(BOQ_REVIEW_ROWS_TABLE)
        .where('recordId', params.recordId)
        .andWhere('projectId', params.projectId)
        .delete()
      await trx(BOQ_REVIEW_RECORDS_TABLE)
        .where('id', params.recordId)
        .andWhere('projectId', params.projectId)
        .delete()
    }
    if (deps.db.isTransaction) {
      await runInTx(deps.db)
    } else {
      await deps.db.transaction(runInTx)
    }
  }

/**
 * 清单项审核流程追溯查询：
 * 查询某条 `boq_items` 关联的所有复核单与签证变更单明细、变更前后快照及完整审批节点/意见轨迹
 */
export const getBoqItemAuditTraceFactory =
  (deps: { db: Knex; mainDb?: Knex }) =>
  async (params: { projectId: string; itemId: string }) => {
    const mainDb = deps.mainDb || deps.db
    const boqItem = await deps
      .db<BoqItemRecord>(BoqItems.name)
      .where('projectId', params.projectId)
      .andWhere('id', params.itemId)
      .first()

    if (!boqItem) {
      throw new NotFoundError('清单项不存在')
    }

    const projectRows = await deps
      .db(BOQ_REVIEW_ROWS_TABLE)
      .where('projectId', params.projectId)
      .orderBy('sortIndex', 'asc')
      .orderBy('id', 'asc')

    const matchedRows = projectRows.filter(
      (r: any) =>
        String(r.boqItemId || '') === String(boqItem.id) ||
        (boqItem.code && String(r.code || '').trim() === String(boqItem.code).trim())
    )

    if (!matchedRows.length) {
      return {
        item: {
          id: boqItem.id,
          projectId: boqItem.projectId,
          code: boqItem.code,
          name: boqItem.name,
          unit: boqItem.unit,
          type: boqItem.type,
          quantity: parseOptionalNumber(boqItem.quantity) ?? 0,
          price: parseOptionalNumber(boqItem.price) ?? 0,
          amount: parseOptionalNumber(boqItem.amount) ?? 0,
          reviewQuantity: parseOptionalNumber(boqItem.reviewQuantity) ?? null,
          changeQuantity: parseOptionalNumber(boqItem.changeQuantity) ?? null,
          reviewPrice: parseOptionalNumber(boqItem.reviewPrice) ?? null,
          reviewAmount: parseOptionalNumber(boqItem.reviewAmount) ?? null
        },
        records: []
      }
    }

    const recordIds = Array.from(
      new Set(matchedRows.map((r: any) => String(r.recordId)))
    )
    const records = await deps
      .db(BOQ_REVIEW_RECORDS_TABLE)
      .where('projectId', params.projectId)
      .whereIn('id', recordIds)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')

    const recordById = new Map<string, any>(
      records.map((rec: any) => [String(rec.id), rec])
    )

    const wfCtx = await loadWorkflowContextForRecordIds({
      mainDb,
      recordIds,
      fallbackFlowInstanceIds: records
        .map((r: any) => r.flowInstanceId)
        .filter(Boolean),
      includeActions: true
    })

    // 按单据创建时间倒序组装追溯条目
    const traceRecords = []
    for (const rec of records) {
      const recId = String(rec.id)
      const rowRaw = matchedRows.find((r: any) => String(r.recordId) === recId)
      if (!rowRaw || !recordById.has(recId)) continue

      const rowDto = mapBoqReviewRowRecord(rowRaw)
      const kind: BoqReviewKind = rec.kind === 'change' ? 'change' : 'review'
      const calc = calcReviewRow(rowDto, kind)

      const binding = wfCtx.bindingByRecordId.get(recId) || null
      const flowInstanceId =
        (binding?.currentInstanceId ? String(binding.currentInstanceId) : null) ||
        (rec.flowInstanceId ? String(rec.flowInstanceId) : null)
      const approveStatus = mapEffectiveApproveStatus(
        rec.approveStatus,
        binding?.status
      )

      const { steps, actions, currentStep, currentStepName, currentStepApprovers } =
        buildStepChainAndActions({
          instanceId: flowInstanceId,
          stepsByInstanceId: wfCtx.stepsByInstanceId,
          actionsByInstanceId: wfCtx.actionsByInstanceId,
          userById: wfCtx.userById
        })

      traceRecords.push({
        recordId: recId,
        code: String(rec.code || ''),
        kind,
        reason: String(rec.reason || ''),
        applicant: String(rec.applicant || ''),
        applicantId: rec.applicantId ? String(rec.applicantId) : null,
        applyDate: String(rec.applyDate || ''),
        approveStatus,
        effectiveAt: rec.effectiveAt ? String(rec.effectiveAt) : null,
        attachments: parseJsonArray<BoqReviewAttachment>(rec.attachments),
        history: parseJsonArray<BoqReviewHistoryEntry>(rec.history),
        flowInstanceId,
        bindingId: binding?.id ? String(binding.id) : null,
        currentStep,
        currentStepName,
        currentStepApprovers,
        row: rowDto,
        source: rowDto.source,
        sourceCode: rowDto.sourceCode,
        baseChangeQty: rowDto.baseChangeQty,
        reviewQty: rowDto.reviewQty,
        reviewQtySupervisor: rowDto.reviewQtySupervisor,
        reviewQtyContract: rowDto.reviewQtyContract,
        changeQty: rowDto.changeQty,
        changeQtySupervisor: rowDto.changeQtySupervisor,
        changeQtyContract: rowDto.changeQtyContract,
        reviewUnitPrice: rowDto.reviewUnitPrice,
        beforeSnapshot: rowDto.beforeSnapshot,
        afterSnapshot: rowDto.afterSnapshot,
        calc,
        steps,
        actions,
        createdAt: toIsoStringOrNull(rec.createdAt) || '',
        updatedAt: toIsoStringOrNull(rec.updatedAt) || ''
      })
    }

    return {
      item: {
        id: boqItem.id,
        projectId: boqItem.projectId,
        code: boqItem.code,
        name: boqItem.name,
        unit: boqItem.unit,
        type: boqItem.type,
        quantity: parseOptionalNumber(boqItem.quantity) ?? 0,
        price: parseOptionalNumber(boqItem.price) ?? 0,
        amount: parseOptionalNumber(boqItem.amount) ?? 0,
        reviewQuantity: parseOptionalNumber(boqItem.reviewQuantity) ?? null,
        changeQuantity: parseOptionalNumber(boqItem.changeQuantity) ?? null,
        reviewPrice: parseOptionalNumber(boqItem.reviewPrice) ?? null,
        reviewAmount: parseOptionalNumber(boqItem.reviewAmount) ?? null
      },
      records: traceRecords
    }
  }

/**
 * 批量获取项目内所有清单项的追溯计数摘要
 */
export const getBoqItemsTraceSummaryFactory =
  (deps: { db: Knex; mainDb?: Knex }) => async (params: { projectId: string }) => {
    const mainDb = deps.mainDb || deps.db
    const records = await deps
      .db(BOQ_REVIEW_RECORDS_TABLE)
      .where('projectId', params.projectId)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')

    const summaryByItemId: Record<string, BoqItemTraceSummaryItem> = {}
    const summaryByCode: Record<string, BoqItemTraceSummaryItem> = {}

    if (!records.length) {
      return { summaryByItemId, summaryByCode }
    }

    const recordIds = records.map((r: any) => String(r.id))
    const rows = await deps
      .db(BOQ_REVIEW_ROWS_TABLE)
      .where('projectId', params.projectId)
      .whereIn('recordId', recordIds)

    const wfCtx = await loadWorkflowContextForRecordIds({
      mainDb,
      recordIds,
      fallbackFlowInstanceIds: records
        .map((r: any) => r.flowInstanceId)
        .filter(Boolean),
      includeActions: false
    })

    const recordMetaById = new Map<
      string,
      {
        id: string
        code: string
        kind: BoqReviewKind
        status: string
        orderIndex: number
      }
    >()

    records.forEach((rec: any, index: number) => {
      const recId = String(rec.id)
      const binding = wfCtx.bindingByRecordId.get(recId)
      const status = mapEffectiveApproveStatus(rec.approveStatus, binding?.status)
      recordMetaById.set(recId, {
        id: recId,
        code: String(rec.code || ''),
        kind: rec.kind === 'change' ? 'change' : 'review',
        status,
        orderIndex: index
      })
    })

    // 按单据时间从新到旧排序明细行，使第一条命中的记录即为 latest
    const sortedRows = [...rows].sort((a: any, b: any) => {
      const ma = recordMetaById.get(String(a.recordId))?.orderIndex ?? 999999
      const mb = recordMetaById.get(String(b.recordId))?.orderIndex ?? 999999
      return ma - mb
    })

    const accumulate = (
      targetMap: Record<string, BoqItemTraceSummaryItem>,
      key: string,
      row: any,
      meta: {
        id: string
        code: string
        kind: BoqReviewKind
        status: string
      }
    ) => {
      if (!key) return
      let item = targetMap[key]
      if (!item) {
        item = {
          totalCount: 0,
          approvedCount: 0,
          pendingCount: 0,
          returnedCount: 0,
          draftCount: 0,
          latestRecordId: meta.id,
          latestCode: meta.code,
          latestKind: meta.kind,
          latestStatus: meta.status,
          createdByReview: false,
          createdByRecordCode: null,
          createdByKind: null
        }
        targetMap[key] = item
      }
      item.totalCount += 1
      if (meta.status === 'APPROVED') {
        item.approvedCount += 1
      } else if (meta.status === 'PENDING' || meta.status === 'IN_REVIEW') {
        item.pendingCount += 1
      } else if (meta.status === 'RETURNED' || meta.status === 'REJECTED') {
        item.returnedCount += 1
      } else {
        item.draftCount += 1
      }
      if (row.source === 'create') {
        item.createdByReview = true
        item.createdByRecordCode = meta.code
        item.createdByKind = meta.kind
      }
    }

    for (const row of sortedRows) {
      const meta = recordMetaById.get(String(row.recordId))
      if (!meta) continue
      const itemId = row.boqItemId ? String(row.boqItemId).trim() : ''
      const rowCode = row.code ? String(row.code).trim() : ''
      if (itemId) accumulate(summaryByItemId, itemId, row, meta)
      if (rowCode) accumulate(summaryByCode, rowCode, row, meta)
    }

    return {
      summaryByItemId,
      summaryByCode
    }
  }
