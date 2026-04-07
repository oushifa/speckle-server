import {
  ApprovalFlowActions,
  ApprovalFlowDefinitionSteps,
  ApprovalFlowDefinitions,
  ApprovalFlowInstanceSteps,
  ApprovalFlowInstances
} from '@/modules/core/dbSchema'
import type {
  ApprovalFlowActionRecord,
  ApprovalFlowDefinitionStepRecord,
  ApprovalFlowDefinitionRecord,
  ApprovalFlowInstanceStepRecord,
  ApprovalFlowInstanceRecord
} from '@/modules/core/helpers/types'
import crs from 'crypto-random-string'
import type { Knex } from 'knex'
import { clamp } from 'lodash-es'

const tables = {
  definitions: (db: Knex) =>
    db<ApprovalFlowDefinitionRecord>(ApprovalFlowDefinitions.name),
  definitionSteps: (db: Knex) =>
    db<ApprovalFlowDefinitionStepRecord>(ApprovalFlowDefinitionSteps.name),
  instances: (db: Knex) => db<ApprovalFlowInstanceRecord>(ApprovalFlowInstances.name),
  instanceSteps: (db: Knex) =>
    db<ApprovalFlowInstanceStepRecord>(ApprovalFlowInstanceSteps.name),
  actions: (db: Knex) => db<ApprovalFlowActionRecord>(ApprovalFlowActions.name)
}

const jsonValue = (db: Knex, value: unknown) =>
  value === null || value === undefined
    ? null
    : db.raw('?::json', [JSON.stringify(value)])

export const ApprovalFlowInstanceStatus = {
  Pending: 'PENDING',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
  Canceled: 'CANCELED'
} as const

export const ApprovalFlowActionType = {
  Started: 'STARTED',
  StepApproved: 'STEP_APPROVED',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
  Canceled: 'CANCELED',
  TimeoutRejected: 'TIMEOUT_REJECTED'
} as const

export const ApprovalFlowStepStatus = {
  Waiting: 'WAITING',
  Pending: 'PENDING',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
  Canceled: 'CANCELED'
} as const

export const generateApprovalFlowId = () => crs({ length: 10 })

export const createApprovalFlowDefinitionFactory =
  (deps: { db: Knex }) =>
  async (params: {
    id?: string
    name: string
    resourceType: string
    isActive?: boolean
    version?: number
    previousVersionId?: string | null
    triggerConfig?: Record<string, unknown> | null
    effectConfig?: Record<string, unknown> | null
    formSchema?: Array<{
      key: string
      name: string
      type: string
      required?: boolean
      placeholder?: string | null
      options?: Array<{ label: string; value: string }>
    }> | null
    createdBy: string
  }) => {
    const now = new Date()
    const [res] = await tables
      .definitions(deps.db)
      .insert({
        id: params.id || generateApprovalFlowId(),
        projectId: null,
        name: params.name,
        resourceType: params.resourceType,
        isActive: params.isActive ?? true,
        version: params.version || 1,
        previousVersionId: params.previousVersionId || null,
        triggerConfig: jsonValue(deps.db, params.triggerConfig || null),
        effectConfig: jsonValue(deps.db, params.effectConfig || null),
        formSchema: jsonValue(deps.db, params.formSchema || null),
        createdBy: params.createdBy,
        createdAt: now,
        updatedAt: now
      })
      .returning('*')
    return res
  }

export const getActiveApprovalFlowDefinitionFactory =
  (deps: { db: Knex }) => async (params: { resourceType: string }) => {
    return await tables
      .definitions(deps.db)
      .where(ApprovalFlowDefinitions.col.resourceType, params.resourceType)
      .andWhere(ApprovalFlowDefinitions.col.isActive, true)
      .orderBy(ApprovalFlowDefinitions.col.version, 'desc')
      .orderBy(ApprovalFlowDefinitions.col.updatedAt, 'desc')
      .first()
  }

export const getApprovalFlowDefinitionsFactory =
  (deps: { db: Knex }) => async (params: { resourceType?: string }) => {
    const q = tables
      .definitions(deps.db)
      .orderBy(ApprovalFlowDefinitions.col.updatedAt, 'desc')
    if (params.resourceType) {
      q.where(ApprovalFlowDefinitions.col.resourceType, params.resourceType)
    }
    return await q
  }

export const getApprovalFlowDefinitionByIdFactory =
  (deps: { db: Knex }) => async (id: string) => {
    return await tables
      .definitions(deps.db)
      .where(ApprovalFlowDefinitions.col.id, id)
      .first()
  }

export const getLatestApprovalFlowDefinitionVersionFactory =
  (deps: { db: Knex }) => async (params: { resourceType: string }) => {
    const res = await tables
      .definitions(deps.db)
      .where(ApprovalFlowDefinitions.col.resourceType, params.resourceType)
      .max<{ max: string }[]>(`${ApprovalFlowDefinitions.col.version} as max`)
      .first()
    return parseInt(res?.max || '0')
  }

export const setApprovalFlowDefinitionActiveStateFactory =
  (deps: { db: Knex }) =>
  async (params: { definitionId: string; isActive: boolean }) => {
    const [res] = await tables
      .definitions(deps.db)
      .where(ApprovalFlowDefinitions.col.id, params.definitionId)
      .update({
        isActive: params.isActive,
        updatedAt: new Date()
      })
      .returning('*')
    return res
  }

export const createApprovalFlowDefinitionStepFactory =
  (deps: { db: Knex }) =>
  async (params: {
    definitionId: string
    name: string
    stepIndex: number
    approverIds?: string[]
    requiredApprovals?: number
    timeoutHours?: number | null
  }) => {
    const [res] = await tables
      .definitionSteps(deps.db)
      .insert({
        id: generateApprovalFlowId(),
        definitionId: params.definitionId,
        name: params.name,
        stepIndex: params.stepIndex,
        approverIds: params.approverIds || [],
        requiredApprovals: params.requiredApprovals || 1,
        timeoutHours: params.timeoutHours || null,
        createdAt: new Date()
      })
      .returning('*')
    return res
  }

export const getApprovalFlowDefinitionStepsFactory =
  (deps: { db: Knex }) => async (definitionId: string) => {
    return await tables
      .definitionSteps(deps.db)
      .where(ApprovalFlowDefinitionSteps.col.definitionId, definitionId)
      .orderBy(ApprovalFlowDefinitionSteps.col.stepIndex, 'asc')
  }

export const createApprovalFlowInstanceFactory =
  (deps: { db: Knex }) =>
  async (params: {
    definitionId: string
    resourceType: string
    resourceId?: string | null
    formData?: Record<string, unknown> | null
    status: string
    currentStep: number
    createdBy: string
  }) => {
    const now = new Date()
    const [res] = await tables
      .instances(deps.db)
      .insert({
        id: generateApprovalFlowId(),
        definitionId: params.definitionId,
        projectId: null,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        formData: jsonValue(deps.db, params.formData || null),
        status: params.status,
        currentStep: params.currentStep,
        createdBy: params.createdBy,
        createdAt: now,
        updatedAt: now
      })
      .returning('*')
    return res
  }

export const createApprovalFlowInstanceStepFactory =
  (deps: { db: Knex }) =>
  async (params: {
    instanceId: string
    definitionStepId?: string | null
    name: string
    stepIndex: number
    status: string
    approverIds?: string[]
    requiredApprovals?: number
    approvedByIds?: string[]
    startedAt?: Date | null
    dueAt?: Date | null
    completedAt?: Date | null
  }) => {
    const [res] = await tables
      .instanceSteps(deps.db)
      .insert({
        id: generateApprovalFlowId(),
        instanceId: params.instanceId,
        definitionStepId: params.definitionStepId || null,
        name: params.name,
        stepIndex: params.stepIndex,
        status: params.status,
        approverIds: params.approverIds || [],
        requiredApprovals: params.requiredApprovals || 1,
        approvedByIds: params.approvedByIds || [],
        startedAt: params.startedAt || null,
        dueAt: params.dueAt || null,
        completedAt: params.completedAt || null,
        createdAt: new Date()
      })
      .returning('*')
    return res
  }

export const getApprovalFlowInstanceStepsFactory =
  (deps: { db: Knex }) => async (instanceId: string) => {
    return await tables
      .instanceSteps(deps.db)
      .where(ApprovalFlowInstanceSteps.col.instanceId, instanceId)
      .orderBy(ApprovalFlowInstanceSteps.col.stepIndex, 'asc')
  }

export const getApprovalFlowCurrentStepFactory =
  (deps: { db: Knex }) => async (instanceId: string) => {
    return await tables
      .instanceSteps(deps.db)
      .where(ApprovalFlowInstanceSteps.col.instanceId, instanceId)
      .andWhere(ApprovalFlowInstanceSteps.col.status, ApprovalFlowStepStatus.Pending)
      .orderBy(ApprovalFlowInstanceSteps.col.stepIndex, 'asc')
      .first()
  }

export const getApprovalFlowTimedOutStepsFactory = (deps: { db: Knex }) => async () => {
  const rows = await tables
    .instanceSteps(deps.db)
    .select(`${ApprovalFlowInstanceSteps.name}.*`)
    .innerJoin(
      ApprovalFlowInstances.name,
      ApprovalFlowInstances.col.id,
      ApprovalFlowInstanceSteps.col.instanceId
    )
    .where(ApprovalFlowInstances.col.status, ApprovalFlowInstanceStatus.Pending)
    .andWhere(ApprovalFlowInstanceSteps.col.status, ApprovalFlowStepStatus.Pending)
    .whereNotNull(ApprovalFlowInstanceSteps.col.dueAt)
    .andWhere(ApprovalFlowInstanceSteps.col.dueAt, '<', new Date())
  return rows as ApprovalFlowInstanceStepRecord[]
}

export const updateApprovalFlowInstanceStepFactory =
  (deps: { db: Knex }) =>
  async (params: {
    stepId: string
    status?: string
    approverIds?: string[]
    requiredApprovals?: number
    approvedByIds?: string[]
    startedAt?: Date | null
    dueAt?: Date | null
    completedAt?: Date | null
  }) => {
    const payload: Partial<ApprovalFlowInstanceStepRecord> = {}
    if (params.status) payload.status = params.status
    if (params.approverIds !== undefined) payload.approverIds = params.approverIds
    if (params.requiredApprovals !== undefined) {
      payload.requiredApprovals = params.requiredApprovals
    }
    if (params.approvedByIds) payload.approvedByIds = params.approvedByIds
    if (params.startedAt !== undefined) payload.startedAt = params.startedAt
    if (params.dueAt !== undefined) payload.dueAt = params.dueAt
    if (params.completedAt !== undefined) payload.completedAt = params.completedAt
    const [res] = await tables
      .instanceSteps(deps.db)
      .where(ApprovalFlowInstanceSteps.col.id, params.stepId)
      .update(payload)
      .returning('*')
    return res
  }

export const getApprovalFlowInstanceByIdFactory =
  (deps: { db: Knex }) => async (params: { id: string }) => {
    return await tables
      .instances(deps.db)
      .where(ApprovalFlowInstances.col.id, params.id)
      .first()
  }

export const getOpenApprovalFlowInstanceForResourceFactory =
  (deps: { db: Knex }) =>
  async (params: { resourceType: string; resourceId?: string | null }) => {
    const q = tables
      .instances(deps.db)
      .where(ApprovalFlowInstances.col.resourceType, params.resourceType)
      .whereIn(ApprovalFlowInstances.col.status, [ApprovalFlowInstanceStatus.Pending])
      .orderBy(ApprovalFlowInstances.col.updatedAt, 'desc')
    if (params.resourceId) {
      q.andWhere(ApprovalFlowInstances.col.resourceId, params.resourceId)
    } else {
      q.whereNull(ApprovalFlowInstances.col.resourceId)
    }
    return await q.first()
  }

export const updateApprovalFlowInstanceStatusFactory =
  (deps: { db: Knex }) =>
  async (params: { instanceId: string; status: string; currentStep?: number }) => {
    const payload: Partial<ApprovalFlowInstanceRecord> = {
      status: params.status,
      updatedAt: new Date()
    }
    if (typeof params.currentStep === 'number') payload.currentStep = params.currentStep
    const [res] = await tables
      .instances(deps.db)
      .where(ApprovalFlowInstances.col.id, params.instanceId)
      .update(payload)
      .returning('*')
    return res
  }

export const insertApprovalFlowActionFactory =
  (deps: { db: Knex }) =>
  async (params: {
    instanceId: string
    stepId?: string | null
    action: string
    actorId: string
    fromStatus?: string | null
    toStatus?: string | null
    comment?: string | null
    metadata?: Record<string, unknown> | null
  }) => {
    const [res] = await tables
      .actions(deps.db)
      .insert({
        id: generateApprovalFlowId(),
        instanceId: params.instanceId,
        stepId: params.stepId || null,
        action: params.action,
        actorId: params.actorId,
        fromStatus: params.fromStatus || null,
        toStatus: params.toStatus || null,
        comment: params.comment || null,
        metadata: jsonValue(deps.db, params.metadata || null),
        createdAt: new Date()
      })
      .returning('*')
    return res
  }

export const getApprovalFlowActionsFactory =
  (deps: { db: Knex }) => async (instanceId: string) => {
    return await tables
      .actions(deps.db)
      .where(ApprovalFlowActions.col.instanceId, instanceId)
      .orderBy(ApprovalFlowActions.col.createdAt, 'desc')
  }

export const countApprovalFlowInstancesFactory =
  (deps: { db: Knex }) => async (params: { status?: string | null }) => {
    const q = tables
      .instances(deps.db)
      .count<{ count: string }[]>(`${ApprovalFlowInstances.col.id} as count`)
      .first()
    if (params.status) {
      q.andWhere(ApprovalFlowInstances.col.status, params.status)
    }
    const res = await q
    return parseInt(res?.count || '0')
  }

export const getApprovalFlowInstancesFactory =
  (deps: { db: Knex }) =>
  async (params: {
    status?: string | null
    cursor?: string | null
    limit?: number | null
  }) => {
    const limit = clamp(params.limit || 25, 1, 100)
    const q = tables
      .instances(deps.db)
      .orderBy(ApprovalFlowInstances.col.updatedAt, 'desc')
      .orderBy(ApprovalFlowInstances.col.id, 'desc')
      .limit(limit + 1)

    if (params.status) {
      q.andWhere(ApprovalFlowInstances.col.status, params.status)
    }

    if (params.cursor) {
      const [cursorDateRaw, cursorId] = params.cursor.split('|')
      if (cursorDateRaw && cursorId) {
        const cursorDate = new Date(cursorDateRaw)
        q.andWhere((w) => {
          w.where(ApprovalFlowInstances.col.updatedAt, '<', cursorDate).orWhere(
            (w2) => {
              w2.where(ApprovalFlowInstances.col.updatedAt, '=', cursorDate).andWhere(
                ApprovalFlowInstances.col.id,
                '<',
                cursorId
              )
            }
          )
        })
      }
    }

    const rows = await q
    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const last = items.at(-1)
    return {
      items,
      cursor: hasMore && last ? `${last.updatedAt.toISOString()}|${last.id}` : null
    }
  }

export const getApprovalFlowStatsFactory =
  (deps: { db: Knex }) =>
  async (params: { rangeDays?: number | null; userId?: string | null }) => {
    type AggregatedStatsRow = {
      totalCount: number
      pendingCount: number
      approvedCount: number
      rejectedCount: number
      canceledCount: number
      averageResolutionHours: number
    }

    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - (params.rangeDays || 30))

    const aggregated = (await tables
      .instances(deps.db)
      .select(
        deps.db.raw('COUNT(*)::int as "totalCount"'),
        deps.db.raw('COUNT(*) FILTER (WHERE ?? = ?)::int as "pendingCount"', [
          ApprovalFlowInstances.col.status,
          ApprovalFlowInstanceStatus.Pending
        ]),
        deps.db.raw('COUNT(*) FILTER (WHERE ?? = ?)::int as "approvedCount"', [
          ApprovalFlowInstances.col.status,
          ApprovalFlowInstanceStatus.Approved
        ]),
        deps.db.raw('COUNT(*) FILTER (WHERE ?? = ?)::int as "rejectedCount"', [
          ApprovalFlowInstances.col.status,
          ApprovalFlowInstanceStatus.Rejected
        ]),
        deps.db.raw('COUNT(*) FILTER (WHERE ?? = ?)::int as "canceledCount"', [
          ApprovalFlowInstances.col.status,
          ApprovalFlowInstanceStatus.Canceled
        ]),
        deps.db.raw(
          'COALESCE(AVG(CASE WHEN ?? <> ? THEN EXTRACT(EPOCH FROM (?? - ??)) / 3600 END), 0)::float as "averageResolutionHours"',
          [
            ApprovalFlowInstances.col.status,
            ApprovalFlowInstanceStatus.Pending,
            ApprovalFlowInstances.col.updatedAt,
            ApprovalFlowInstances.col.createdAt
          ]
        )
      )
      .where(ApprovalFlowInstances.col.createdAt, '>=', fromDate)
      .first()) as AggregatedStatsRow | undefined

    const stats = {
      totalCount: Number(aggregated?.totalCount || 0),
      pendingCount: Number(aggregated?.pendingCount || 0),
      approvedCount: Number(aggregated?.approvedCount || 0),
      rejectedCount: Number(aggregated?.rejectedCount || 0),
      canceledCount: Number(aggregated?.canceledCount || 0),
      initiatedCount: 0,
      handledCount: 0,
      pendingForMeCount: 0,
      averageResolutionHours: Number(aggregated?.averageResolutionHours || 0)
    }

    if (!params.userId) return stats

    const initiated = await tables
      .instances(deps.db)
      .count<{ count: string }[]>(`${ApprovalFlowInstances.col.id} as count`)
      .where(ApprovalFlowInstances.col.createdAt, '>=', fromDate)
      .andWhere(ApprovalFlowInstances.col.createdBy, params.userId)
      .first()

    const handled = await tables
      .actions(deps.db)
      .countDistinct<{ count: string }[]>(
        `${ApprovalFlowActions.col.instanceId} as count`
      )
      .where(ApprovalFlowActions.col.createdAt, '>=', fromDate)
      .andWhere(ApprovalFlowActions.col.actorId, params.userId)
      .andWhere(ApprovalFlowActions.col.action, '!=', ApprovalFlowActionType.Started)
      .first()

    const pendingForMe = await tables
      .instanceSteps(deps.db)
      .countDistinct<{ count: string }[]>(
        `${ApprovalFlowInstanceSteps.col.instanceId} as count`
      )
      .innerJoin(
        ApprovalFlowInstances.name,
        ApprovalFlowInstanceSteps.col.instanceId,
        ApprovalFlowInstances.col.id
      )
      .where(ApprovalFlowInstances.col.createdAt, '>=', fromDate)
      .andWhere(ApprovalFlowInstances.col.status, ApprovalFlowInstanceStatus.Pending)
      .andWhere(ApprovalFlowInstanceSteps.col.status, ApprovalFlowStepStatus.Pending)
      .andWhereRaw('(COALESCE(cardinality(??), 0) = 0 OR ? = ANY(??))', [
        ApprovalFlowInstanceSteps.short.col.approverIds,
        params.userId,
        ApprovalFlowInstanceSteps.short.col.approverIds
      ])
      .andWhereRaw('NOT (? = ANY(??))', [
        params.userId,
        ApprovalFlowInstanceSteps.short.col.approvedByIds
      ])
      .first()

    stats.initiatedCount = parseInt(initiated?.count || '0')
    stats.handledCount = parseInt(handled?.count || '0')
    stats.pendingForMeCount = parseInt(pendingForMe?.count || '0')
    return stats
  }
