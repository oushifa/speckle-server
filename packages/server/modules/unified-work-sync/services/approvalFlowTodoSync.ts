import axios from 'axios'
import { db } from '@/db/knex'
import {
  ApprovalFlowActions,
  ApprovalFlowInstances,
  ApprovalFlowInstanceSteps,
  Streams,
  Users
} from '@/modules/core/dbSchema'
import { ApprovalFlowActionType } from '@/modules/flow/repositories/approvalFlows'
import {
  getUnifiedWorkSyncAccount,
  getUnifiedWorkSyncHost,
  getUnifiedWorkSyncPassword,
  getUnifiedWorkSyncRouterId,
  getUnifiedWorkSyncSystemCode,
  getUnifiedWorkSyncToken,
  getUnifiedWorkSyncUsername
} from '@/modules/shared/helpers/envHelper'
import { moduleLogger } from '@/observability/logging'

const unifiedWorkSyncLogger = moduleLogger.child({
  module: 'unified-work-sync'
})

const SYNC_DEBOUNCE_MS = 500
const SYNC_RETRY_DELAY_MS = 2000
const TOKEN_CACHE_MS = 20 * 60 * 1000
const REQUEST_TIMEOUT_MS = 60 * 1000
const START_STEP_INDEX = 0

const pendingSyncTimers = new Map<string, ReturnType<typeof setTimeout>>()

let cachedAuthToken: {
  value: string
  expiresAt: number
} | null = null

type ApprovalFlowInstanceRow = {
  id: string
  projectId: string | null
  resourceType: string
  resourceId: string | null
  formData: Record<string, unknown> | null
  flowSnapshot: Record<string, unknown> | null
  status: string
  currentStep: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

type ApprovalFlowInstanceStepRow = {
  id: string
  name: string
  stepIndex: number
  status: string
  approverIds: string[]
  approvedByIds: string[]
  startedAt: Date | null
  dueAt: Date | null
  completedAt: Date | null
}

type UserRow = {
  id: string
  name: string | null
  email: string | null
}

type InstanceSnapshot = {
  instance: ApprovalFlowInstanceRow
  steps: ApprovalFlowInstanceStepRow[]
  projectName: string | null
  userMap: Map<string, UserRow>
  flowName: string | null
  templateId: string | null
  /**
   * Task ids for approvers that were once assigned to a step but got replaced by
   * an admin transfer. They must still be removed from the unified work platform.
   */
  historicalApproverTaskIds: string[]
}

type UnifiedWorkReviewer = {
  user: string
  status: string
}

type UnifiedWorkPushPayload = {
  systemCode: string
  taskId: string
  title: string
  creator: string
  assignee: string
  reviewer: UnifiedWorkReviewer[]
  createTime: string
  reviewTime: string
  route: string
  extraData: Record<string, unknown>
}

const isUnifiedWorkSyncEnabled = () => Boolean(getUnifiedWorkSyncHost())

const getSyncConfig = () => ({
  host: getUnifiedWorkSyncHost(),
  systemCode: getUnifiedWorkSyncSystemCode(),
  token: getUnifiedWorkSyncToken(),
  username: getUnifiedWorkSyncUsername(),
  password: getUnifiedWorkSyncPassword(),
  routerId: getUnifiedWorkSyncRouterId(),
  account: getUnifiedWorkSyncAccount()
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const toIsoString = (date: Date | null | undefined) => {
  if (!date) return ''
  return date.toISOString()
}

const extractToken = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (!isRecord(value)) return ''

  const directKeys = ['token', 'accessToken', 'access_token']
  for (const key of directKeys) {
    const token = value[key]
    if (typeof token === 'string' && token.trim()) return token.trim()
    // The platform nests the token as { token: { accessToken, ... } }
    if (isRecord(token)) {
      const nestedToken = extractToken(token)
      if (nestedToken) return nestedToken
    }
  }

  const nestedKeys = ['data', 'result', 'payload']
  for (const key of nestedKeys) {
    const token = extractToken(value[key])
    if (token) return token
  }

  return ''
}

const formatErrorDetails = (err: unknown) => {
  if (axios.isAxiosError(err)) {
    return {
      message: err.message,
      code: err.code,
      url: err.config?.url,
      method: err.config?.method?.toUpperCase(),
      status: err.response?.status,
      statusText: err.response?.statusText,
      responseBody: err.response?.data
    }
  }
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: err.stack
    }
  }
  return { message: String(err) }
}

const getAuthToken = async () => {
  const config = getSyncConfig()

  if (config.token) {
    unifiedWorkSyncLogger.debug('[WORK_SYNC] Using static token from configuration')
    return config.token
  }

  if (cachedAuthToken && cachedAuthToken.expiresAt > Date.now()) {
    unifiedWorkSyncLogger.debug('[WORK_SYNC] Using cached auth token')
    return cachedAuthToken.value
  }

  if (!config.username || !config.password) {
    unifiedWorkSyncLogger.warn(
      {
        hasUsername: Boolean(config.username),
        hasPassword: Boolean(config.password)
      },
      '[WORK_SYNC] Skip unified work sync because auth credentials (username/password) are incomplete'
    )
    return ''
  }

  try {
    unifiedWorkSyncLogger.info(
      {
        host: config.host,
        username: config.username,
        routerId: config.routerId
      },
      '[WORK_SYNC] Requesting login to unified work platform'
    )

    const response = await axios.post(
      `${config.host}/api/v1/auth/login2`,
      {
        username: config.username,
        password: config.password,
        routerId: config.routerId
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: REQUEST_TIMEOUT_MS
      }
    )

    const token = extractToken(response.data)
    if (!token) {
      unifiedWorkSyncLogger.error(
        {
          responseData: response.data
        },
        '[WORK_SYNC] Unified work login succeeded but token was not found in response'
      )
      return ''
    }

    cachedAuthToken = {
      value: token,
      expiresAt: Date.now() + TOKEN_CACHE_MS
    }

    unifiedWorkSyncLogger.info(
      '[WORK_SYNC] Unified work auth token obtained successfully'
    )

    return token
  } catch (err) {
    const errorDetails = formatErrorDetails(err)
    unifiedWorkSyncLogger.error(
      {
        error: errorDetails,
        host: config.host,
        username: config.username
      },
      `[WORK_SYNC] Failed to log in to unified work platform: ${errorDetails.message}`
    )
    return ''
  }
}

const buildTaskId = (instanceId: string, stepIndex: number, assigneeId: string) =>
  `SPK-${instanceId}-S${stepIndex}-${assigneeId}`

/**
 * Maps a local user onto the unified work platform account name.
 *
 * The platform account name lives in the local `email` column (the column keeps
 * its legacy name, but the value is the account name, not an email address), so
 * the value is used as-is without splitting on `@`.
 */
const resolveExternalUserCode = (user: UserRow | undefined | null) => {
  if (!user) return ''

  const account = user.email?.trim()
  if (account) return account

  const name = user.name?.trim()
  if (name) return name

  return ''
}

const getFormResource = (resourceId: string | null | undefined) => {
  if (!resourceId) return null
  const separatorIndex = resourceId.indexOf(':')
  if (separatorIndex === -1) return null

  const formTable = resourceId.slice(0, separatorIndex)
  const formId = resourceId.slice(separatorIndex + 1)

  if (!formTable || !formId) return null

  return {
    formTable,
    formId
  }
}

const buildRoute = (snapshot: InstanceSnapshot) => {
  const { instance } = snapshot
  const formResource = getFormResource(instance.resourceId)

  if (instance.projectId && formResource?.formTable === 'monthly_measurements') {
    return `/projects/${instance.projectId}/work-valuation/monthly-measurement/${formResource.formId}/acceptance?mode=edit`
  }

  if (instance.projectId && formResource?.formTable === 'safety_measures') {
    return `/projects/${instance.projectId}/work-valuation/safety-measure/${formResource.formId}?mode=edit`
  }

  return '/flow'
}

const buildTaskTitle = (snapshot: InstanceSnapshot) => {
  const { instance, projectName, flowName } = snapshot
  const formDataTitle =
    instance.formData && typeof instance.formData.title === 'string'
      ? instance.formData.title.trim()
      : ''

  const titleCore = formDataTitle || flowName || '流程审批'
  return projectName ? `${projectName} - ${titleCore}` : titleCore
}

const loadInstanceSnapshot = async (
  instanceId: string
): Promise<InstanceSnapshot | null> => {
  const instance =
    (await db<ApprovalFlowInstanceRow>(ApprovalFlowInstances.name)
      .select<ApprovalFlowInstanceRow[]>([
        'id',
        'projectId',
        'resourceType',
        'resourceId',
        'formData',
        'flowSnapshot',
        'status',
        'currentStep',
        'createdBy',
        'createdAt',
        'updatedAt'
      ])
      .where('id', instanceId)
      .first()) || null

  if (!instance) return null

  const steps = await db<ApprovalFlowInstanceStepRow>(ApprovalFlowInstanceSteps.name)
    .select<ApprovalFlowInstanceStepRow[]>([
      'id',
      'name',
      'stepIndex',
      'status',
      'approverIds',
      'approvedByIds',
      'startedAt',
      'dueAt',
      'completedAt'
    ])
    .where('instanceId', instanceId)
    .orderBy('stepIndex', 'asc')

  const project = instance.projectId
    ? await db(Streams.name)
        .select<{ id: string; name: string | null }[]>('id', 'name')
        .where('id', instance.projectId)
        .first()
    : null

  const userIds = Array.from(
    new Set(
      [
        instance.createdBy,
        ...steps.flatMap((step) => [
          ...(step.approverIds || []),
          ...(step.approvedByIds || [])
        ])
      ].filter((id): id is string => Boolean(id))
    )
  )

  const users = userIds.length
    ? await db<UserRow>(Users.name)
        .select<UserRow[]>(['id', 'name', 'email'])
        .whereIn('id', userIds)
    : []

  const flowSnapshot = isRecord(instance.flowSnapshot) ? instance.flowSnapshot : null
  const flowName =
    flowSnapshot && typeof flowSnapshot.name === 'string'
      ? flowSnapshot.name.trim()
      : null
  const templateId =
    flowSnapshot && typeof flowSnapshot.templateId === 'string'
      ? flowSnapshot.templateId.trim()
      : null

  // Admin transfers replace a step's approverIds, so the previous approver's task
  // id is no longer derivable from the step rows. Recover them from the action log.
  const transferActions = await db<{
    stepId: string | null
    metadata: Record<string, unknown> | null
  }>(ApprovalFlowActions.name)
    .select('stepId', 'metadata')
    .where('instanceId', instanceId)
    .where('action', ApprovalFlowActionType.TransferredAssignee)

  const stepIndexById = new Map(steps.map((step) => [step.id, step.stepIndex]))
  const historicalApproverTaskIds = Array.from(
    new Set(
      transferActions.flatMap((action) => {
        const stepIndex = action.stepId ? stepIndexById.get(action.stepId) : undefined
        if (stepIndex === undefined) return []

        const metadata = isRecord(action.metadata) ? action.metadata : null
        const fromApproverIds = Array.isArray(metadata?.fromApproverIds)
          ? metadata.fromApproverIds
          : []

        return fromApproverIds
          .filter((approverId): approverId is string => typeof approverId === 'string')
          .map((approverId) => buildTaskId(instanceId, stepIndex, approverId))
      })
    )
  )

  return {
    instance,
    steps,
    projectName: project?.name || null,
    userMap: new Map(users.map((user) => [user.id, user])),
    flowName: flowName || null,
    templateId: templateId || null,
    historicalApproverTaskIds
  }
}

const buildDesiredTasks = (snapshot: InstanceSnapshot) => {
  const candidateTaskIds = Array.from(
    new Set([
      // Step 0 is the synthetic "start" step (already approved on creation), it is
      // never pushed as a todo, so it is not a removal candidate either.
      ...snapshot.steps
        .filter((step) => step.stepIndex !== START_STEP_INDEX)
        .flatMap((step) =>
          (step.approverIds || []).map((approverId) =>
            buildTaskId(snapshot.instance.id, step.stepIndex, approverId)
          )
        ),
      ...snapshot.historicalApproverTaskIds
    ])
  )

  const config = getSyncConfig()
  // Todos are assigned per local user: `reviewer[].user` is the current approver
  // and `creator` is the flow initiator. `account` is only a fallback for the
  // creator when the initiator has no mappable unified work account.
  const account = config.account || config.username

  const currentStep =
    snapshot.steps.find((step) => step.status === 'PENDING') ||
    snapshot.steps.find((step) => step.stepIndex === snapshot.instance.currentStep) ||
    null

  if (!currentStep || snapshot.instance.status !== 'PENDING') {
    return {
      desiredItems: [] as UnifiedWorkPushPayload[],
      candidateTaskIds
    }
  }

  if (!currentStep.approverIds.length) {
    unifiedWorkSyncLogger.warn(
      {
        instanceId: snapshot.instance.id,
        currentStep: currentStep.stepIndex
      },
      '[WORK_SYNC] Skip unified work push because the current step has no explicit approverIds'
    )
  }

  const pendingAssigneeIds = Array.from(
    new Set(
      (currentStep.approverIds || []).filter(
        (approverId) => !(currentStep.approvedByIds || []).includes(approverId)
      )
    )
  )

  const title = buildTaskTitle(snapshot)
  const route = buildRoute(snapshot)
  const creatorUser = snapshot.userMap.get(snapshot.instance.createdBy)
  // Whoever initiated the flow owns the todo's creator field. `config.account`
  // (UNIFIED_WORK_SYNC_ACCOUNT) is a last-resort fallback so a push still goes out.
  const mappedCreatorAccount = resolveExternalUserCode(creatorUser)
  const creatorAccount = mappedCreatorAccount || account
  if (!mappedCreatorAccount) {
    unifiedWorkSyncLogger.warn(
      {
        instanceId: snapshot.instance.id,
        createdBy: snapshot.instance.createdBy,
        fallbackAccount: account || null
      },
      '[WORK_SYNC] Flow initiator has no unified work account mapping, falling back to the configured account'
    )
  }
  const pendingSince = currentStep.startedAt || snapshot.instance.createdAt
  const createTime = toIsoString(pendingSince)
  const reviewTime = createTime
  const desiredItems: UnifiedWorkPushPayload[] = []

  for (const assigneeId of pendingAssigneeIds) {
    const assigneeUser = snapshot.userMap.get(assigneeId)
    // The todo must be assigned to the actual approver of the current step.
    const mappedApproverAccount = resolveExternalUserCode(assigneeUser)
    const approverAccount = mappedApproverAccount || account
    if (!mappedApproverAccount) {
      unifiedWorkSyncLogger.warn(
        {
          instanceId: snapshot.instance.id,
          currentStep: currentStep.stepIndex,
          approverId: assigneeId,
          fallbackAccount: account || null
        },
        '[WORK_SYNC] Approver has no unified work account mapping, falling back to the configured account'
      )
    }
    if (!approverAccount) {
      unifiedWorkSyncLogger.warn(
        {
          instanceId: snapshot.instance.id,
          currentStep: currentStep.stepIndex,
          approverId: assigneeId
        },
        '[WORK_SYNC] Skip unified work item because no approver account could be resolved at all'
      )
      continue
    }

    desiredItems.push({
      systemCode: config.systemCode,
      taskId: buildTaskId(snapshot.instance.id, currentStep.stepIndex, assigneeId),
      title,
      creator: creatorAccount,
      assignee: approverAccount,
      reviewer: [{ user: approverAccount, status: 'pending' }],
      createTime,
      reviewTime,
      route,
      extraData: {
        projectId: snapshot.instance.projectId,
        projectName: snapshot.projectName,
        resourceType: snapshot.instance.resourceType,
        resourceId: snapshot.instance.resourceId,
        flowName: snapshot.flowName,
        templateId: snapshot.templateId,
        instanceId: snapshot.instance.id,
        currentStep: currentStep.stepIndex,
        dueAt: currentStep.dueAt ? currentStep.dueAt.getTime() : null,
        status: snapshot.instance.status,
        creatorId: snapshot.instance.createdBy,
        creatorAccount,
        approverId: assigneeId,
        approverName: assigneeUser?.name || null,
        approverAccount
      }
    })
  }

  return {
    desiredItems,
    candidateTaskIds
  }
}

const removeUnifiedWorkItem = async (params: { token: string; taskId: string }) => {
  const config = getSyncConfig()
  const response = await axios.post(
    `${config.host}/api/v1/unifiedWork/removeWorkItem`,
    {
      systemCode: config.systemCode,
      taskId: params.taskId
    },
    {
      headers: {
        Authorization: `Bearer ${params.token}`,
        'Content-Type': 'application/json'
      },
      timeout: REQUEST_TIMEOUT_MS
    }
  )
  return response.data
}

/**
 * The platform answers `{ payload: { success: boolean } }`: HTTP 200 with
 * `success: false` means the task was not there in the first place.
 */
const isRemoveSuccess = (data: unknown) =>
  isRecord(data) && isRecord(data.payload) && data.payload.success === true

const pushUnifiedWorkItem = async (params: {
  token: string
  payload: UnifiedWorkPushPayload
}) => {
  const config = getSyncConfig()
  const response = await axios.post(
    `${config.host}/api/v1/unifiedWork/work-item/push`,
    params.payload,
    {
      headers: {
        Authorization: `Bearer ${params.token}`,
        'Content-Type': 'application/json'
      },
      timeout: REQUEST_TIMEOUT_MS
    }
  )
  return response.data
}

export const syncApprovalFlowTodoToUnifiedWork = async (params: {
  instanceId: string
  reason: string
}) => {
  if (!isUnifiedWorkSyncEnabled()) {
    unifiedWorkSyncLogger.debug(
      {
        instanceId: params.instanceId,
        reason: params.reason
      },
      '[WORK_SYNC] Unified work sync is disabled (UNIFIED_WORK_SYNC_HOST not set)'
    )
    return
  }

  unifiedWorkSyncLogger.info(
    {
      instanceId: params.instanceId,
      reason: params.reason
    },
    '[WORK_SYNC] Starting approval flow todo sync'
  )

  const snapshot = await loadInstanceSnapshot(params.instanceId)
  if (!snapshot) {
    unifiedWorkSyncLogger.warn(
      {
        instanceId: params.instanceId,
        reason: params.reason
      },
      '[WORK_SYNC] Skip unified work sync because approval flow instance was not found'
    )
    return
  }

  const { desiredItems, candidateTaskIds } = buildDesiredTasks(snapshot)
  const desiredTaskIds = new Set(desiredItems.map((item) => item.taskId))
  const removableTaskIds = candidateTaskIds.filter(
    (taskId) => !desiredTaskIds.has(taskId)
  )

  if (!desiredItems.length && !removableTaskIds.length) {
    unifiedWorkSyncLogger.info(
      {
        instanceId: params.instanceId,
        reason: params.reason,
        instanceStatus: snapshot.instance.status,
        currentStep: snapshot.instance.currentStep
      },
      '[WORK_SYNC] Skip unified work sync because there are no push or remove actions needed'
    )
    return
  }

  const token = await getAuthToken()
  if (!token) {
    unifiedWorkSyncLogger.warn(
      {
        instanceId: params.instanceId,
        reason: params.reason
      },
      '[WORK_SYNC] Skip unified work sync because auth token is unavailable'
    )
    return
  }

  let removedCount = 0
  for (const taskId of removableTaskIds) {
    try {
      const res = await removeUnifiedWorkItem({
        token,
        taskId
      })
      if (isRemoveSuccess(res)) {
        removedCount += 1
        unifiedWorkSyncLogger.info(
          {
            instanceId: params.instanceId,
            reason: params.reason,
            taskId,
            responseData: res
          },
          '[WORK_SYNC] Successfully removed unified work item'
        )
      } else {
        unifiedWorkSyncLogger.debug(
          {
            instanceId: params.instanceId,
            reason: params.reason,
            taskId,
            responseData: res
          },
          '[WORK_SYNC] Unified work item was already absent, nothing to remove'
        )
      }
    } catch (err) {
      const errorDetails = formatErrorDetails(err)
      unifiedWorkSyncLogger.error(
        {
          error: errorDetails,
          instanceId: params.instanceId,
          reason: params.reason,
          taskId
        },
        `[WORK_SYNC] Failed to remove unified work item (${taskId}): ${errorDetails.message}`
      )
    }
  }

  for (const payload of desiredItems) {
    try {
      const res = await pushUnifiedWorkItem({
        token,
        payload
      })
      unifiedWorkSyncLogger.info(
        {
          instanceId: params.instanceId,
          reason: params.reason,
          taskId: payload.taskId,
          assignee: payload.assignee,
          title: payload.title,
          route: payload.route,
          responseData: res
        },
        '[WORK_SYNC] Successfully pushed unified work item'
      )
    } catch (err) {
      const errorDetails = formatErrorDetails(err)
      unifiedWorkSyncLogger.error(
        {
          error: errorDetails,
          instanceId: params.instanceId,
          reason: params.reason,
          taskId: payload.taskId,
          assignee: payload.assignee,
          payload
        },
        `[WORK_SYNC] Failed to push unified work item (${payload.taskId}): ${errorDetails.message}`
      )
    }
  }

  unifiedWorkSyncLogger.info(
    {
      instanceId: params.instanceId,
      reason: params.reason,
      pushCount: desiredItems.length,
      removeCount: removedCount,
      attemptedRemoveCount: removableTaskIds.length,
      pushedTaskIds: desiredItems.map((item) => item.taskId),
      removedTaskIds: removableTaskIds
    },
    '[WORK_SYNC] Completed unified work sync for approval flow instance'
  )
}

const runScheduledSync = async (params: {
  instanceId: string
  reason: string
  attempt: number
}) => {
  try {
    await syncApprovalFlowTodoToUnifiedWork({
      instanceId: params.instanceId,
      reason: params.reason
    })
  } catch (err) {
    const errorDetails = formatErrorDetails(err)
    unifiedWorkSyncLogger.error(
      {
        error: errorDetails,
        instanceId: params.instanceId,
        reason: params.reason,
        attempt: params.attempt
      },
      `[WORK_SYNC] Unified work sync task failed with unhandled exception: ${errorDetails.message}`
    )

    if (params.attempt >= 2) return

    unifiedWorkSyncLogger.info(
      {
        instanceId: params.instanceId,
        nextAttempt: params.attempt + 1,
        delayMs: SYNC_RETRY_DELAY_MS
      },
      `[WORK_SYNC] Retrying unified work sync in ${SYNC_RETRY_DELAY_MS}ms`
    )

    setTimeout(() => {
      void runScheduledSync({
        ...params,
        attempt: params.attempt + 1
      })
    }, SYNC_RETRY_DELAY_MS)
  }
}

export const scheduleApprovalFlowTodoSync = (params: {
  instanceId: string
  reason: string
}) => {
  if (!isUnifiedWorkSyncEnabled()) {
    unifiedWorkSyncLogger.debug(
      {
        instanceId: params.instanceId,
        reason: params.reason
      },
      '[WORK_SYNC] Skip scheduling sync because UNIFIED_WORK_SYNC_HOST is not configured'
    )
    return
  }

  unifiedWorkSyncLogger.info(
    {
      instanceId: params.instanceId,
      reason: params.reason,
      debounceMs: SYNC_DEBOUNCE_MS
    },
    '[WORK_SYNC] Scheduled approval flow todo sync'
  )

  const currentTimer = pendingSyncTimers.get(params.instanceId)
  if (currentTimer) clearTimeout(currentTimer)

  const timer = setTimeout(() => {
    pendingSyncTimers.delete(params.instanceId)
    void runScheduledSync({
      ...params,
      attempt: 1
    })
  }, SYNC_DEBOUNCE_MS)

  pendingSyncTimers.set(params.instanceId, timer)
}
