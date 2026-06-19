import { Router } from 'express'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import { corsMiddlewareFactory } from '@/modules/core/configs/cors'
import {
  streamReadPermissionsPipelineFactory,
  streamWritePermissionsPipelineFactory
} from '@/modules/shared/authz'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { db } from '@/db/knex'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  getPaginatedProjectModelsItemsFactory,
  getPaginatedProjectModelsTotalCountFactory
} from '@/modules/core/repositories/branches'
import {
  getUserStreamsCountFactory,
  getUserStreamsPageFactory
} from '@/modules/core/repositories/streams'
import {
  ApprovalFlowActions,
  ApprovalFlowDefinitions,
  ApprovalFlowInstances,
  ApprovalFlowInstanceSteps,
  BranchCommits,
  Branches,
  Commits,
  Users
} from '@/modules/core/dbSchema'
import { buildApprovalBindingSubjectKey } from '@/modules/flow/repositories/approvalBindings'
import {
  getOrRecalculateProjectCostSummaryFactory,
  recalculateProjectCostSummaryFactory
} from '@/modules/project-statistics/services/projectCostSummaries'
import { moduleAuthLoaders } from '@/modules/index'
import type {
  ApprovalFlowActionRecord,
  ApprovalFlowDefinitionRecord,
  ApprovalFlowInstanceRecord,
  ApprovalFlowInstanceStepRecord,
  BranchRecord,
  CommitRecord
} from '@/modules/core/helpers/types'
import { Authz } from '@speckle/shared'
import type { Knex } from 'knex'

const toNumber = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const toCount = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const clampLimit = (value: unknown) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 25
  return Math.min(Math.max(Math.floor(num), 1), 100)
}

const getQueryString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const parseBooleanQuery = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return undefined

  const lowered = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'y'].includes(lowered)) return true
  if (['0', 'false', 'no', 'n'].includes(lowered)) return false
  return undefined
}

const parseStringArrayQuery = (value: unknown): string[] | undefined => {
  if (!value) return undefined
  const rawItems = Array.isArray(value) ? value : [value]
  const items = rawItems
    .flatMap((item) =>
      typeof item === 'string' ? item.split(',').map((sub) => sub.trim()) : []
    )
    .filter((item) => !!item)
  return items.length ? items : undefined
}

type ProjectListCursor = {
  updatedAt: string
  id: string
}

const encodeCursor = (cursor: ProjectListCursor) =>
  Buffer.from(JSON.stringify(cursor)).toString('base64url')

const decodeCursor = (value: unknown): ProjectListCursor | null => {
  if (!value || typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      updatedAt?: unknown
      id?: unknown
    }
    if (typeof parsed.updatedAt !== 'string' || typeof parsed.id !== 'string')
      return null
    return {
      updatedAt: parsed.updatedAt,
      id: parsed.id
    }
  } catch {
    return null
  }
}

const toResponse = (
  projectId: string,
  projectName: string | null,
  summary: {
    totalContractAmount: number | string
    completedAmount: number | string
    currentMonthCompletedAmount: number | string
    lastRecalculatedAt: Date
    updatedAt: Date
  }
) => {
  const totalContractAmount = toNumber(summary.totalContractAmount)
  const completedAmount = toNumber(summary.completedAmount)
  const currentMonthCompletedAmount = toNumber(summary.currentMonthCompletedAmount)
  const completionRate =
    totalContractAmount > 0 ? completedAmount / totalContractAmount : 0

  return {
    projectId,
    projectName,
    totalContractAmount,
    completedAmount,
    currentMonthCompletedAmount,
    completionRate,
    lastRecalculatedAt: summary.lastRecalculatedAt,
    updatedAt: summary.updatedAt
  }
}

type CostSummaryStatsResponse = {
  projectCount: number
  totalContractAmount: number
  completedAmount: number
  currentMonthCompletedAmount: number
  pendingAmount: number
}

type WorkbenchTodoUser = {
  id: string
  name: string
  avatar: string | null
}

type WorkbenchTodoAction = {
  id: string
  stepId: string | null
  action: string
  fromStatus: string | null
  toStatus: string | null
  comment: string | null
  metadata: Record<string, unknown> | null
  actorId: string
  createdAt: Date
  actor: WorkbenchTodoUser | null
}

type WorkbenchTodoStep = {
  id: string
  name: string
  stepIndex: number
  status: string
  requiredApprovals: number
  approverIds: string[]
  approvers: WorkbenchTodoUser[]
  approvedByIds: string[]
  approvedBy: WorkbenchTodoUser[]
  startedAt: Date | null
  dueAt: Date | null
  completedAt: Date | null
}

type WorkbenchTodoItem = {
  id: string
  projectId: string | null
  project: {
    id: string
    name: string | null
  } | null
  resourceType: string
  resourceId: string | null
  model: {
    id: string
    name: string
  } | null
  formData: Record<string, unknown> | null
  status: string
  currentStep: number
  createdBy: string
  createdByUser: WorkbenchTodoUser | null
  createdAt: Date
  updatedAt: Date
  definition: {
    id: string
    name: string
    resourceType: string
    isActive: boolean
    templateId: string
  } | null
  actions: WorkbenchTodoAction[]
  steps: WorkbenchTodoStep[]
}

type WorkbenchReviewUpdate = {
  id: string
  resourceId: string
  modelId: string
  projectId: string
  projectName: string
  title: string
  version: string
  description: string
  initiator: string
  time: string
  updatedAt: number
  approveStatus: string | null
}

type ProjectWorkbenchResponse = {
  stats: {
    projectCount: number
    modelCount: number
    boqCount: number
    qualityAcceptanceCount: number
    workValuationCount: number
  }
  todos: {
    totalCount: number
    items: WorkbenchTodoItem[]
  }
  reviewUpdates: {
    totalCount: number
    items: WorkbenchReviewUpdate[]
  }
}

const getProjectStats = async (projectId: string) => {
  const projectDb = await getProjectDbClient({ projectId })
  const getProjectModelsTotalCount = getPaginatedProjectModelsTotalCountFactory({
    db: projectDb
  })

  const [modelCount, boqRow, qualityRow, valuationRow] = await Promise.all([
    getProjectModelsTotalCount(projectId, {}),
    projectDb('boq_items')
      .where('projectId', projectId)
      .count<{ count: string }>('* as count')
      .first(),
    projectDb('quality_acceptance_forms')
      .where('project_id', projectId)
      .count<{ count: string }>('* as count')
      .first(),
    projectDb('monthly_measurements')
      .where('project_id', projectId)
      .count<{ count: string }>('* as count')
      .first()
  ])

  return {
    modelCount,
    boqCount: toCount(boqRow?.count),
    qualityAcceptanceCount: toCount(qualityRow?.count),
    workValuationCount: toCount(valuationRow?.count)
  }
}

const normalizeApproveStatus = (status?: string | null) => {
  if (typeof status !== 'string') return null
  const normalized = status.trim().toLowerCase()
  return normalized || null
}

const canStartFlowForModel = (status?: string | null) => {
  const normalizedStatus = normalizeApproveStatus(status)
  return (
    !normalizedStatus ||
    normalizedStatus === 'undefine' ||
    normalizedStatus === 'undefined' ||
    normalizedStatus === 'null'
  )
}

const formatWorkbenchTime = (dateString?: string | Date | null) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

const toModelDisplayName = (name: string) => {
  const segments = name.split('/')
  return segments[segments.length - 1] || name
}

const getScopeFilter = <TRecord extends {}, TResult>(
  query: Knex.QueryBuilder<TRecord, TResult>,
  userId: string,
  scope: 'TODO' | 'INITIATED' | 'HANDLED'
): Knex.QueryBuilder<TRecord, TResult> => {
  if (scope === 'INITIATED') {
    return query.where(ApprovalFlowInstances.col.createdBy, userId)
  }
  if (scope === 'HANDLED') {
    return query.whereExists(
      db(ApprovalFlowActions.name)
        .select(db.raw('1'))
        .whereRaw('?? = ??', [
          ApprovalFlowActions.col.instanceId,
          ApprovalFlowInstances.col.id
        ])
        .andWhere(ApprovalFlowActions.col.actorId, userId)
        .andWhere(ApprovalFlowActions.col.action, '!=', 'STARTED')
    )
  }
  // TODO
  return query
    .where(ApprovalFlowInstances.col.status, 'PENDING')
    .whereExists(
      db(ApprovalFlowInstanceSteps.name)
        .select(db.raw('1'))
        .whereRaw('?? = ??', [
          ApprovalFlowInstanceSteps.col.instanceId,
          ApprovalFlowInstances.col.id
        ])
        .andWhere(ApprovalFlowInstanceSteps.col.status, 'PENDING')
        .andWhereRaw('(COALESCE(cardinality(??), 0) = 0 OR ? = ANY(??))', [
          ApprovalFlowInstanceSteps.short.col.approverIds,
          userId,
          ApprovalFlowInstanceSteps.short.col.approverIds
        ])
        .andWhereRaw('NOT (? = ANY(??))', [
          userId,
          ApprovalFlowInstanceSteps.short.col.approvedByIds
        ])
    )
}

const getUserMap = async (userIds: string[]) => {
  if (!userIds.length) return new Map<string, WorkbenchTodoUser>()
  const rows = await db(Users.name)
    .select<{ id: string; name: string; avatar: string | null }[]>('id', 'name', 'avatar')
    .whereIn('id', userIds)
  return new Map(
    rows.map((user) => [
      user.id,
      {
        id: user.id,
        name: user.name,
        avatar: user.avatar || null
      }
    ])
  )
}

const buildProjectWorkbenchTodos = async (params: {
  projectId: string
  projectName: string | null
  userId: string
  scope: 'TODO' | 'INITIATED' | 'HANDLED'
}): Promise<{ totalCount: number; items: WorkbenchTodoItem[] }> => {
  const totalCountQuery = db(ApprovalFlowInstances.name)
    .where(ApprovalFlowInstances.col.projectId, params.projectId)
    .countDistinct<{ count: string }[]>(`${ApprovalFlowInstances.col.id} as count`)
    .first()

  getScopeFilter(totalCountQuery, params.userId, params.scope)

  const instanceRows = await getScopeFilter(
    db<ApprovalFlowInstanceRecord>(ApprovalFlowInstances.name)
      .where(ApprovalFlowInstances.col.projectId, params.projectId)
      .orderBy(ApprovalFlowInstances.col.updatedAt, 'desc')
      .orderBy(ApprovalFlowInstances.col.id, 'desc')
      .limit(5),
    params.userId,
    params.scope
  )

  const totalCountRow = await totalCountQuery
  const totalCount = parseInt(totalCountRow?.count || '0')

  if (!instanceRows.length) {
    return {
      totalCount,
      items: []
    }
  }

  const definitionIds = Array.from(
    new Set(instanceRows.map((item) => item.definitionId).filter((id): id is string => !!id))
  )
  const instanceIds = instanceRows.map((item) => item.id)
  const modelResourceIds = Array.from(
    new Set(
      instanceRows
        .filter((item) => item.resourceType === 'MODEL' && item.resourceId)
        .map((item) => item.resourceId as string)
    )
  )

  const [definitions, actions, steps, projectDb] = await Promise.all([
    definitionIds.length
      ? db<ApprovalFlowDefinitionRecord>(ApprovalFlowDefinitions.name).whereIn(
          ApprovalFlowDefinitions.col.id,
          definitionIds
        )
      : Promise.resolve<ApprovalFlowDefinitionRecord[]>([]),
    db<ApprovalFlowActionRecord>(ApprovalFlowActions.name)
      .whereIn(ApprovalFlowActions.col.instanceId, instanceIds)
      .orderBy(ApprovalFlowActions.col.createdAt, 'desc'),
    db<ApprovalFlowInstanceStepRecord>(ApprovalFlowInstanceSteps.name)
      .whereIn(ApprovalFlowInstanceSteps.col.instanceId, instanceIds)
      .orderBy(ApprovalFlowInstanceSteps.col.stepIndex, 'asc'),
    getProjectDbClient({ projectId: params.projectId })
  ])

  const [modelRows, versionModelRows] = await Promise.all([
    modelResourceIds.length
      ? projectDb<BranchRecord>(Branches.name)
          .select<BranchRecord[]>(Branches.cols)
          .whereIn(Branches.col.id, modelResourceIds)
      : Promise.resolve<BranchRecord[]>([]),
    modelResourceIds.length
      ? projectDb(Commits.name)
          .distinctOn(Commits.col.id)
          .select<Array<{ resourceId: string; modelId: string; modelName: string }>>([
            `${Commits.col.id} as resourceId`,
            `${Branches.col.id} as modelId`,
            `${Branches.col.name} as modelName`
          ])
          .innerJoin(BranchCommits.name, BranchCommits.col.commitId, Commits.col.id)
          .innerJoin(Branches.name, Branches.col.id, BranchCommits.col.branchId)
          .whereIn(Commits.col.id, modelResourceIds)
          .orderBy([
            { column: Commits.col.id, order: 'desc' },
            { column: Commits.col.createdAt, order: 'desc' }
          ])
      : Promise.resolve<Array<{ resourceId: string; modelId: string; modelName: string }>>([])
  ])

  const directModelMap = new Map(
    modelRows.map((model) => [
      model.id,
      {
        id: model.id,
        name: toModelDisplayName(model.name)
      }
    ])
  )
  const versionModelMap = new Map(
    versionModelRows.map((item) => [
      item.resourceId,
      {
        id: item.modelId,
        name: toModelDisplayName(item.modelName)
      }
    ])
  )
  const definitionMap = new Map(definitions.map((item) => [item.id, item]))
  const actionsByInstanceId = new Map<string, ApprovalFlowActionRecord[]>()
  const stepsByInstanceId = new Map<string, ApprovalFlowInstanceStepRecord[]>()

  for (const action of actions) {
    const collection = actionsByInstanceId.get(action.instanceId) || []
    collection.push(action)
    actionsByInstanceId.set(action.instanceId, collection)
  }

  for (const step of steps) {
    const collection = stepsByInstanceId.get(step.instanceId) || []
    collection.push(step)
    stepsByInstanceId.set(step.instanceId, collection)
  }

  const userIds = Array.from(
    new Set(
      [
        ...instanceRows.map((item) => item.createdBy),
        ...actions.map((item) => item.actorId),
        ...steps.flatMap((item) => [...(item.approverIds || []), ...(item.approvedByIds || [])])
      ].filter((id): id is string => !!id && id !== 'system')
    )
  )
  const userMap = await getUserMap(userIds)

  const items = instanceRows.map<WorkbenchTodoItem>((instance) => {
    const definition = instance.definitionId ? definitionMap.get(instance.definitionId) : null
    const model =
      (instance.resourceId && directModelMap.get(instance.resourceId)) ||
      (instance.resourceId && versionModelMap.get(instance.resourceId)) ||
      null

    const snapshot = (instance as any).flowSnapshot
    const snapshotName = (snapshot && typeof snapshot === 'object') ? snapshot.name : null

    return {
      id: instance.id,
      projectId: instance.projectId || null,
      project: instance.projectId
        ? {
            id: instance.projectId,
            name: params.projectName || ''
          }
        : null,
      resourceType: instance.resourceType,
      resourceId: instance.resourceId || null,
      model,
      formData: (instance.formData as Record<string, unknown> | null) || null,
      status: instance.status,
      currentStep: instance.currentStep,
      createdBy: instance.createdBy,
      createdByUser: userMap.get(instance.createdBy) || null,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
      definition: (definition || snapshotName)
        ? {
            id: definition?.id || snapshot?.definitionId || '',
            name: definition?.name || snapshotName || '',
            resourceType: definition?.resourceType || snapshot?.resourceType || '',
            isActive: definition?.isActive ?? true,
            templateId: definition?.templateId || snapshot?.templateId || ''
          }
        : null,
      actions: (actionsByInstanceId.get(instance.id) || []).map((action) => ({
        id: action.id,
        stepId: action.stepId || null,
        action: action.action,
        fromStatus: action.fromStatus || null,
        toStatus: action.toStatus || null,
        comment: action.comment || null,
        metadata: (action.metadata as Record<string, unknown> | null) || null,
        actorId: action.actorId,
        createdAt: action.createdAt,
        actor: userMap.get(action.actorId) || null
      })),
      steps: (stepsByInstanceId.get(instance.id) || []).map((step) => ({
        id: step.id,
        name: step.name,
        stepIndex: step.stepIndex,
        status: step.status,
        requiredApprovals: step.requiredApprovals,
        approverIds: step.approverIds || [],
        approvers: (step.approverIds || [])
          .map((id) => userMap.get(id))
          .filter((user): user is WorkbenchTodoUser => !!user),
        approvedByIds: step.approvedByIds || [],
        approvedBy: (step.approvedByIds || [])
          .map((id) => userMap.get(id))
          .filter((user): user is WorkbenchTodoUser => !!user),
        startedAt: step.startedAt || null,
        dueAt: step.dueAt || null,
        completedAt: step.completedAt || null
      }))
    }
  })

  return {
    totalCount,
    items
  }
}

const buildProjectWorkbenchReviewUpdates = async (params: {
  projectId: string
  projectName: string | null
}): Promise<{ totalCount: number; items: WorkbenchReviewUpdate[] }> => {
  const projectDb = await getProjectDbClient({ projectId: params.projectId })
  const versionRows = await projectDb(Commits.name)
    .select<
      Array<
        CommitRecord & {
          streamId: string
          modelId: string
          modelName: string
          versionCount: string
          versionOrder: string
        }
      >
    >([
      ...Commits.cols,
      `${Branches.col.streamId} as streamId`,
      `${Branches.col.id} as modelId`,
      `${Branches.col.name} as modelName`,
      projectDb.raw('count(*) over (partition by ??) as "versionCount"', [Branches.col.id]),
      projectDb.raw(
        'row_number() over (partition by ?? order by ?? desc, ?? desc) as "versionOrder"',
        [Branches.col.id, Commits.col.createdAt, Commits.col.id]
      )
    ])
    .innerJoin(BranchCommits.name, BranchCommits.col.commitId, Commits.col.id)
    .innerJoin(Branches.name, Branches.col.id, BranchCommits.col.branchId)
    .where(Branches.col.streamId, params.projectId)
    .andWhereNot(Branches.col.name, 'globals')
    .orderBy(Commits.col.createdAt, 'desc')
    .orderBy(Commits.col.id, 'desc')

  if (!versionRows.length) {
    return {
      totalCount: 0,
      items: []
    }
  }

  const subjectKeyEntries = versionRows.map((row) => ({
    versionId: row.id,
    subjectKey: buildApprovalBindingSubjectKey({
      subjectType: 'MODEL_VERSION',
      subjectId: row.id
    })
  }))

  const [bindings, userMap] = await Promise.all([
    db('approval_flow_bindings')
      .select<{ subjectKey: string; status: string | null }[]>('subjectKey', 'status')
      .whereIn(
        'subjectKey',
        subjectKeyEntries.map((entry) => entry.subjectKey)
      ),
    getUserMap(
      Array.from(
        new Set(versionRows.map((item) => item.author).filter((id): id is string => !!id))
      )
    )
  ])

  const bindingStatusMap = new Map(bindings.map((item) => [item.subjectKey, item.status]))
  const items = versionRows
    .map<WorkbenchReviewUpdate | null>((row) => {
      const bindingStatus = bindingStatusMap.get(
        buildApprovalBindingSubjectKey({
          subjectType: 'MODEL_VERSION',
          subjectId: row.id
        })
      )
      if (!canStartFlowForModel(bindingStatus)) return null

      const versionCount = Number(row.versionCount) || 0
      const versionOrder = Number(row.versionOrder) || 1
      return {
        id: `${params.projectId}-${row.modelId}-${row.id}`,
        resourceId: row.id,
        modelId: row.modelId,
        projectId: params.projectId,
        projectName: params.projectName || '',
        title: toModelDisplayName(row.modelName),
        version: `v${Math.max(versionCount - versionOrder + 1, 1)}`,
        description: row.message?.trim() || `来自项目 ${params.projectName || '-'}`,
        initiator: (row.author && userMap.get(row.author)?.name) || '系统',
        time: formatWorkbenchTime(row.createdAt),
        updatedAt: new Date(row.createdAt).getTime() || 0,
        approveStatus: bindingStatus || null
      }
    })
    .filter((item): item is WorkbenchReviewUpdate => !!item)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return {
    totalCount: items.length,
    items: items.slice(0, 5)
  }
}

export const projectCostSummaryRouterFactory = (): Router => {
  const app = Router()
  const getUserStreams = getUserStreamsPageFactory({ db })
  const getUserStreamsCount = getUserStreamsCountFactory({ db })

  app.options('/api/v1/projects', corsMiddlewareFactory())
  app.get('/api/v1/projects', corsMiddlewareFactory(), async (req, res) => {
    if (!req.context.auth || !req.context.userId) {
      return res.status(401).send({
        error: 'You must be authenticated to list projects.'
      })
    }

    const limit = clampLimit(req.query.limit)
    const cursor = getQueryString(req.query.cursor) || undefined
    const search = getQueryString(req.query.search) || undefined
    const workspaceId = getQueryString(req.query.workspaceId) || undefined
    const userId = req.context.userId

    const [totalCount, page] = await Promise.all([
      getUserStreamsCount({
        userId,
        forOtherUser: false,
        searchQuery: search,
        workspaceId,
        onlyWithActiveSsoSession: true
      }),
      getUserStreams({
        userId,
        forOtherUser: false,
        searchQuery: search,
        workspaceId,
        onlyWithActiveSsoSession: true,
        limit,
        cursor
      })
    ])

    return res.status(200).send({
      totalCount,
      limit,
      cursor: page.cursor,
      items: page.streams.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        visibility: project.visibility,
        workspaceId: project.workspaceId,
        role: project.role || null,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }))
    })
  })

  app.options('/api/v1/projects/:projectId/models', corsMiddlewareFactory())
  app.get(
    '/api/v1/projects/:projectId/models',
    corsMiddlewareFactory(),
    authMiddlewareCreator(
      streamReadPermissionsPipelineFactory({
        getStream: getStreamFactory({ db })
      })
    ),
    async (req, res) => {
      const projectId = req.params.projectId
      const projectDb = await getProjectDbClient({ projectId })
      const getPaginatedProjectModelsItems = getPaginatedProjectModelsItemsFactory({
        db: projectDb
      })
      const getPaginatedProjectModelsTotalCount = getPaginatedProjectModelsTotalCountFactory(
        { db: projectDb }
      )

      const limit = clampLimit(req.query.limit)
      const cursor = getQueryString(req.query.cursor) || undefined
      const search = getQueryString(req.query.search)
      const contributors = parseStringArrayQuery(req.query.contributors)
      const sourceApps = parseStringArrayQuery(req.query.sourceApps)
      const onlyWithVersions = parseBooleanQuery(req.query.onlyWithVersions)

      const filter = {
        ...(search ? { search } : {}),
        ...(contributors?.length ? { contributors } : {}),
        ...(sourceApps?.length ? { sourceApps } : {}),
        ...(onlyWithVersions !== undefined ? { onlyWithVersions } : {})
      }

      const [itemsResult, totalCount] = await Promise.all([
        getPaginatedProjectModelsItems(projectId, {
          limit,
          cursor,
          filter
        }),
        getPaginatedProjectModelsTotalCount(projectId, {
          filter
        })
      ])

      return res.status(200).send({
        totalCount,
        limit,
        cursor: itemsResult.cursor,
        items: itemsResult.items.map((model) => ({
          id: model.id,
          projectId: model.streamId,
          name: model.name,
          description: model.description,
          authorId: model.authorId,
          createdAt: model.createdAt,
          updatedAt: model.updatedAt
        }))
      })
    }
  )

  app.options('/api/stream/cost-summary', corsMiddlewareFactory())
  app.get('/api/stream/cost-summary', corsMiddlewareFactory(), async (req, res) => {
    if (!req.context.auth || !req.context.userId) {
      return res.status(401).send({
        error: 'You must be authenticated to list project cost summaries.'
      })
    }

    const limit = clampLimit(req.query.limit)
    const cursor = decodeCursor(req.query.cursor)

    const authLoaders = await moduleAuthLoaders({ dataLoaders: undefined })
    const policies = Authz.authPoliciesFactory(authLoaders.loaders)
    const items: ReturnType<typeof toResponse>[] = []
    let nextCursor: string | null = null
    let pageCursor = cursor

    // Scan streams in batches, then filter by canRead to keep pagination stable after auth filter.
    while (items.length < limit) {
      const remaining = limit - items.length
      const batchSize = Math.min(Math.max(remaining * 3, 30), 200)

      const query = db('streams')
        .select<{ id: string; name: string | null; updatedAt: Date }[]>(
          'id',
          'name',
          'updatedAt'
        )
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
        .limit(batchSize)

      if (pageCursor) {
        query.andWhereRaw('(??, ??) < (?, ?)', [
          'updatedAt',
          'id',
          pageCursor.updatedAt,
          pageCursor.id
        ])
      }

      const projectRows = await query
      if (!projectRows.length) {
        nextCursor = null
        break
      }

      for (const row of projectRows) {
        const canRead = await policies.project.canRead({
          userId: req.context.userId,
          projectId: row.id
        })
        if (canRead.isErr) continue
        const projectDb = await getProjectDbClient({ projectId: row.id })
        const summary = await getOrRecalculateProjectCostSummaryFactory({
          db: projectDb
        })({
          projectId: row.id
        })
        items.push(toResponse(row.id, row.name, summary))
        if (items.length >= limit) {
          nextCursor = encodeCursor({
            updatedAt: row.updatedAt.toISOString(),
            id: row.id
          })
          break
        }
      }

      if (items.length >= limit) break

      const lastRow = projectRows[projectRows.length - 1]
      pageCursor = {
        updatedAt: lastRow.updatedAt.toISOString(),
        id: lastRow.id
      }
      nextCursor = encodeCursor(pageCursor)

      if (projectRows.length < batchSize) {
        // Source exhausted
        nextCursor = null
        break
      }
    }

    return res.status(200).send({
      items,
      limit,
      cursor: nextCursor
    })
  })

  app.options('/api/stream/cost-summary/stats', corsMiddlewareFactory())
  app.get(
    '/api/stream/cost-summary/stats',
    corsMiddlewareFactory(),
    async (req, res) => {
      if (!req.context.auth || !req.context.userId) {
        return res.status(401).send({
          error: 'You must be authenticated to list project cost summaries.'
        })
      }

      const projectIdQuery = req.query.projectId
      const projectId =
        typeof projectIdQuery === 'string' && projectIdQuery.trim()
          ? projectIdQuery.trim()
          : null

      const authLoaders = await moduleAuthLoaders({ dataLoaders: undefined })
      const policies = Authz.authPoliciesFactory(authLoaders.loaders)

      const projectIds: string[] = []
      if (projectId) {
        const canRead = await policies.project.canRead({
          userId: req.context.userId,
          projectId
        })
        if (canRead.isErr) {
          return res.status(403).send({
            error: 'You are not allowed to read this project.'
          })
        }
        projectIds.push(projectId)
      } else {
        const streamRows = await db('streams').select<{ id: string }[]>('id')
        for (const row of streamRows) {
          const canRead = await policies.project.canRead({
            userId: req.context.userId,
            projectId: row.id
          })
          if (canRead.isErr) continue
          projectIds.push(row.id)
        }
      }

      const totals: CostSummaryStatsResponse = {
        projectCount: projectIds.length,
        totalContractAmount: 0,
        completedAmount: 0,
        currentMonthCompletedAmount: 0,
        pendingAmount: 0
      }

      for (const id of projectIds) {
        const projectDb = await getProjectDbClient({ projectId: id })
        const summary = await getOrRecalculateProjectCostSummaryFactory({
          db: projectDb
        })({
          projectId: id
        })
        const totalContractAmount = toNumber(summary.totalContractAmount)
        const completedAmount = toNumber(summary.completedAmount)
        const currentMonthCompletedAmount = toNumber(
          summary.currentMonthCompletedAmount
        )
        totals.totalContractAmount += totalContractAmount
        totals.completedAmount += completedAmount
        totals.currentMonthCompletedAmount += currentMonthCompletedAmount
        totals.pendingAmount += Math.max(totalContractAmount - completedAmount, 0)
      }

      return res.status(200).send(totals)
    }
  )

  app.options('/api/stream/:streamId/cost-summary', corsMiddlewareFactory())
  app.get(
    '/api/stream/:streamId/cost-summary',
    corsMiddlewareFactory(),
    authMiddlewareCreator(
      streamReadPermissionsPipelineFactory({
        getStream: getStreamFactory({ db })
      })
    ),
    async (req, res) => {
      const projectId = req.params.streamId
      const projectDb = await getProjectDbClient({ projectId })
      const summary = await getOrRecalculateProjectCostSummaryFactory({
        db: projectDb
      })({
        projectId
      })
      return res.status(200).send(toResponse(projectId, null, summary))
    }
  )

  app.options('/api/v1/projects/:projectId/workbench', corsMiddlewareFactory())
  app.get(
    '/api/v1/projects/:projectId/workbench',
    corsMiddlewareFactory(),
    authMiddlewareCreator(
      streamReadPermissionsPipelineFactory({
        getStream: getStreamFactory({ db })
      })
    ),
    async (req, res) => {
      const { projectId } = req.params
      const scope = (req.query.scope as string) || 'TODO'
      const validScopes = ['TODO', 'INITIATED', 'HANDLED']
      const targetScope = validScopes.includes(scope.toUpperCase()) ? scope.toUpperCase() : 'TODO'

      const project = await getStreamFactory({ db })({ streamId: projectId })

      const [stats, todos, reviewUpdates] = await Promise.all([
        getProjectStats(projectId),
        buildProjectWorkbenchTodos({
          projectId,
          projectName: project?.name || null,
          userId: req.context.userId!,
          scope: targetScope as 'TODO' | 'INITIATED' | 'HANDLED'
        }),
        buildProjectWorkbenchReviewUpdates({
          projectId,
          projectName: project?.name || null
        })
      ])

      const response: ProjectWorkbenchResponse = {
        stats: {
          projectCount: 1,
          modelCount: stats.modelCount,
          boqCount: stats.boqCount,
          qualityAcceptanceCount: stats.qualityAcceptanceCount,
          workValuationCount: stats.workValuationCount
        },
        todos,
        reviewUpdates
      }

      return res.status(200).send(response)
    }
  )

  app.options('/api/stream/:streamId/cost-summary/recalculate', corsMiddlewareFactory())
  app.post(
    '/api/stream/:streamId/cost-summary/recalculate',
    corsMiddlewareFactory(),
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream: getStreamFactory({ db })
      })
    ),
    async (req, res) => {
      const projectId = req.params.streamId
      const projectDb = await getProjectDbClient({ projectId })
      const summary = await recalculateProjectCostSummaryFactory({ db: projectDb })({
        projectId
      })
      return res.status(200).send(toResponse(projectId, null, summary))
    }
  )

  app.options('/api/dashboard', corsMiddlewareFactory())
  app.get('/api/dashboard', corsMiddlewareFactory(), async (req, res) => {
    if (!req.context.auth || !req.context.userId) {
      return res.status(401).send({
        error: 'You must be authenticated to view dashboard statistics.'
      })
    }

    const projectIdQuery = req.query.projectId
    const projectId =
      typeof projectIdQuery === 'string' && projectIdQuery.trim()
        ? projectIdQuery.trim()
        : null

    const authLoaders = await moduleAuthLoaders({ dataLoaders: undefined })
    const policies = Authz.authPoliciesFactory(authLoaders.loaders)

    let projectIds: string[] = []
    if (projectId) {
      const canRead = await policies.project.canRead({
        userId: req.context.userId,
        projectId
      })
      if (canRead.isErr) {
        return res.status(403).send({
          error: 'You are not allowed to read this project.'
        })
      }
      projectIds = [projectId]
    } else {
      const streamRows = await db('streams').select<{ id: string }[]>('id')
      for (const row of streamRows) {
        const canRead = await policies.project.canRead({
          userId: req.context.userId,
          projectId: row.id
        })
        if (canRead.isErr) continue
        projectIds.push(row.id)
      }
    }

    let modelCount = 0
    let boqCount = 0
    let qualityAcceptanceCount = 0
    let workValuationCount = 0

    for (const id of projectIds) {
      const stats = await getProjectStats(id)
      modelCount += stats.modelCount
      boqCount += stats.boqCount
      qualityAcceptanceCount += stats.qualityAcceptanceCount
      workValuationCount += stats.workValuationCount
    }

    return res.status(200).send({
      projectCount: projectIds.length,
      modelCount,
      boqCount,
      qualityAcceptanceCount,
      workValuationCount
    })
  })
  return app
}
