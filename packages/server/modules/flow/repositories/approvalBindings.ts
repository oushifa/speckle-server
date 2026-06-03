import { ApprovalFlowBindings, ApprovalFlowInstances } from '@/modules/core/dbSchema'
import type {
  ApprovalFlowBindingRecord,
  ApprovalFlowInstanceRecord
} from '@/modules/core/helpers/types'
import { generateApprovalFlowId } from '@/modules/flow/repositories/approvalFlows'
import type { Knex } from 'knex'

const tables = {
  bindings: (db: Knex) => db<ApprovalFlowBindingRecord>(ApprovalFlowBindings.name),
  instances: (db: Knex) => db<ApprovalFlowInstanceRecord>(ApprovalFlowInstances.name)
}

const jsonValue = (db: Knex, value: unknown) =>
  value === null || value === undefined
    ? null
    : db.raw('?::json', [JSON.stringify(value)])

export const buildApprovalBindingSubjectKey = (params: {
  subjectType: string
  subjectId: string
  subjectTable?: string | null
}) => {
  if (params.subjectType === 'MODEL_VERSION') {
    return `model_version:${params.subjectId}`
  }

  if (params.subjectType === 'FORM_RECORD') {
    if (!params.subjectTable) {
      throw new Error('subjectTable is required for FORM_RECORD')
    }
    return `${params.subjectTable}:${params.subjectId}`
  }

  return `${params.subjectType.toLowerCase()}:${params.subjectId}`
}

export const createApprovalFlowBindingFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    subjectType: string
    subjectId: string
    subjectTable?: string | null
    subjectKey: string
    definitionId: string
    templateId: string
    currentInstanceId?: string | null
    currentRoundNo?: number
    status: string
    lastSubmittedAt?: Date | null
    lastSubmittedBy?: string | null
    lastReturnedAt?: Date | null
    lastReturnedBy?: string | null
    finishedAt?: Date | null
    metadata?: Record<string, unknown> | null
    creator: string
    updater: string
  }) => {
    const now = new Date()
    const [res] = await tables
      .bindings(deps.db)
      .insert({
        id: generateApprovalFlowId(),
        projectId: params.projectId,
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        subjectTable: params.subjectTable || null,
        subjectKey: params.subjectKey,
        definitionId: params.definitionId,
        templateId: params.templateId,
        currentInstanceId: params.currentInstanceId || null,
        currentRoundNo: params.currentRoundNo || 0,
        status: params.status,
        lastSubmittedAt: params.lastSubmittedAt || null,
        lastSubmittedBy: params.lastSubmittedBy || null,
        lastReturnedAt: params.lastReturnedAt || null,
        lastReturnedBy: params.lastReturnedBy || null,
        finishedAt: params.finishedAt || null,
        metadata: jsonValue(deps.db, params.metadata || null),
        createdAt: now,
        updatedAt: now,
        creator: params.creator,
        updater: params.updater
      })
      .returning('*')
    return res
  }

export const updateApprovalFlowBindingFactory =
  (deps: { db: Knex }) =>
  async (params: {
    bindingId: string
    definitionId?: string
    templateId?: string
    currentInstanceId?: string | null
    currentRoundNo?: number
    status?: string
    lastSubmittedAt?: Date | null
    lastSubmittedBy?: string | null
    lastReturnedAt?: Date | null
    lastReturnedBy?: string | null
    finishedAt?: Date | null
    metadata?: Record<string, unknown> | null
    updater: string
  }) => {
    const payload: Partial<ApprovalFlowBindingRecord> = {
      updatedAt: new Date(),
      updater: params.updater
    }
    if (params.definitionId !== undefined) payload.definitionId = params.definitionId
    if (params.templateId !== undefined) payload.templateId = params.templateId
    if (params.currentInstanceId !== undefined) {
      payload.currentInstanceId = params.currentInstanceId
    }
    if (params.currentRoundNo !== undefined) payload.currentRoundNo = params.currentRoundNo
    if (params.status !== undefined) payload.status = params.status
    if (params.lastSubmittedAt !== undefined) payload.lastSubmittedAt = params.lastSubmittedAt
    if (params.lastSubmittedBy !== undefined) payload.lastSubmittedBy = params.lastSubmittedBy
    if (params.lastReturnedAt !== undefined) payload.lastReturnedAt = params.lastReturnedAt
    if (params.lastReturnedBy !== undefined) payload.lastReturnedBy = params.lastReturnedBy
    if (params.finishedAt !== undefined) payload.finishedAt = params.finishedAt
    if (params.metadata !== undefined) payload.metadata = params.metadata

    const [res] = await tables
      .bindings(deps.db)
      .where(ApprovalFlowBindings.col.id, params.bindingId)
      .update(payload)
      .returning('*')

    return res
  }

export const getApprovalFlowBindingByIdFactory =
  (deps: { db: Knex }) => async (bindingId: string) => {
    return await tables
      .bindings(deps.db)
      .where(ApprovalFlowBindings.col.id, bindingId)
      .first()
  }

export const getApprovalFlowBindingBySubjectKeyFactory =
  (deps: { db: Knex }) => async (subjectKey: string) => {
    return await tables
      .bindings(deps.db)
      .where(ApprovalFlowBindings.col.subjectKey, subjectKey)
      .first()
  }

export const listApprovalFlowInstancesByBindingIdFactory =
  (deps: { db: Knex }) => async (bindingId: string) => {
    return await tables
      .instances(deps.db)
      .where(ApprovalFlowInstances.col.bindingId, bindingId)
      .orderBy(ApprovalFlowInstances.col.roundNo, 'desc')
      .orderBy(ApprovalFlowInstances.col.createdAt, 'desc')
  }
