import {
  ApprovalFlowActionType,
  ApprovalFlowInstanceStatus,
  ApprovalFlowStepStatus,
  createApprovalFlowInstanceStepFormSnapshotFactory,
  createApprovalFlowDefinitionFactory,
  createApprovalFlowDefinitionStepFactory,
  createApprovalFlowInstanceFactory,
  createApprovalFlowInstanceStepFactory,
  getActiveApprovalFlowDefinitionFactory,
  getApprovalFlowCurrentStepFactory,
  getApprovalFlowDefinitionByIdFactory,
  getApprovalFlowDefinitionStepsFactory,
  getApprovalFlowTimedOutStepsFactory,
  getApprovalFlowInstanceByIdFactory,
  getApprovalFlowInstanceStepsFactory,
  getQualityAcceptanceFormByIdFactory,
  getLatestApprovalFlowDefinitionVersionFactory,
  getOpenApprovalFlowInstanceForResourceFactory,
  insertApprovalFlowActionFactory,
  generateApprovalFlowId,
  setApprovalFlowDefinitionActiveStateFactory,
  updateApprovalFlowInstanceStepFactory,
  updateApprovalFlowInstanceStatusFactory,
  getActiveApprovalFlowByCategoryFactory
} from '@/modules/flow/repositories/approvalFlows'
import { updateBranchFactory } from '@/modules/core/repositories/branches'
import {
  buildApprovalBindingSubjectKey,
  getApprovalFlowBindingBySubjectKeyFactory,
  createApprovalFlowBindingFactory,
  updateApprovalFlowBindingFactory
} from '@/modules/flow/repositories/approvalBindings'
import { updateQualityAcceptanceFormFactory } from '@/modules/quality-acceptance-form/repositories/qualityAcceptanceForms'
import {
  getMonthlyMeasurementItemsFactory,
  updateMonthlyMeasurementFactory,
  updateQualityAcceptanceApproveStatusByIdsFactory
} from '@/modules/quality-acceptance-form/repositories/monthlyMeasurements'
import { recalculateProjectCostSummaryFactory } from '@/modules/project-statistics/services/projectCostSummaries'
import { BadRequestError } from '@/modules/shared/errors'
import type { Knex } from 'knex'

const QUALITY_ACCEPTANCE_FORM_TABLE = 'quality_acceptance_forms'
const MONTHLY_MEASUREMENT_TABLE = 'monthly_measurements'
const MONTHLY_MEASUREMENT_TEMPLATE_ID = 'm_measure'
const FORM_SNAPSHOT_ENTER = 'ENTER_STEP'
const FORM_SNAPSHOT_LEAVE = 'LEAVE_STEP'
const FLOW_ID_MAX_LENGTH = 10
const START_STEP_INDEX = 0
const START_STEP_NAME = '开始'
const START_APPROVE_STATUS = 'START'
const FORCED_MONTHLY_MEASUREMENT_HOOKS = {
  onInstancePending: [
    {
      type: 'updateResourceFields',
      fields: {
        approveStatus: '$STATUS'
      }
    }
  ],
  onInstanceApproved: [
    {
      type: 'updateResourceFields',
      fields: {
        approveStatus: '$STATUS'
      }
    }
  ],
  onInstanceRejected: [
    {
      type: 'updateResourceFields',
      fields: {
        approveStatus: '$STATUS'
      }
    }
  ],
  onInstanceCanceled: [
    {
      type: 'updateResourceFields',
      fields: {
        approveStatus: '$STATUS'
      }
    }
  ]
} as const

type FlowStepSnapshot = {
  definitionStepId: string | null
  name: string
  stepIndex: number
  approverIds: string[]
  requiredApprovals: number
  timeoutHours?: number | null
  hooks?: Record<string, unknown> | null
}

type FlowSnapshot = {
  templateId: string
  definitionId: string
  version: number
  name: string
  resourceType: string
  effectConfig: Record<string, unknown> | null
  formSchema: Array<Record<string, unknown>>
  steps: FlowStepSnapshot[]
}

type FlowHookEvent =
  | 'onInstancePending'
  | 'onInstanceApproved'
  | 'onInstanceRejected'
  | 'onInstanceCanceled'
  | 'onStepEnter'
  | 'onStepLeave'

type FlowHookAction = {
  type: 'updateResourceFields'
  resourceType?: string
  fields?: Record<string, unknown>
}

const getStepDueAt = (startedAt: Date, timeoutHours?: number | null) => {
  if (!timeoutHours) return null
  return new Date(startedAt.getTime() + timeoutHours * 60 * 60 * 1000)
}

const shouldAllowParallelInstancesForSameResource = (
  effectConfig: Record<string, unknown> | null
) => Boolean(effectConfig?.allowParallelInstancesForSameResource)

const mapFlowStatusToQualityAcceptanceApproveStatus = (
  status: string,
  currentStep?: number | null
) => {
  if (
    status === ApprovalFlowInstanceStatus.Pending &&
    currentStep === START_STEP_INDEX
  ) {
    return START_APPROVE_STATUS
  }
  if (status === ApprovalFlowInstanceStatus.Pending) return 'PENDING'
  if (status === ApprovalFlowInstanceStatus.Approved) return 'APPROVED'
  if (status === ApprovalFlowInstanceStatus.Rejected) return 'REJECTED'
  if (status === ApprovalFlowInstanceStatus.Canceled) return 'CANCELED'
  return 'PENDING'
}

const mapFlowStatusToMonthlyMeasurementApproveStatus = (
  status: string,
  currentStep?: number | null
) => {
  if (
    status === ApprovalFlowInstanceStatus.Pending &&
    currentStep === START_STEP_INDEX
  ) {
    return START_APPROVE_STATUS
  }
  if (status === ApprovalFlowInstanceStatus.Pending) return 'PENDING'
  if (status === ApprovalFlowInstanceStatus.Approved) return 'APPROVED'
  if (status === ApprovalFlowInstanceStatus.Rejected) return 'REJECTED'
  if (status === ApprovalFlowInstanceStatus.Canceled) return 'CANCELED'
  return 'PENDING'
}

const parseFormResourceId = (resourceId: string) => {
  const idx = resourceId.indexOf(':')
  if (idx === -1) {
    return { formTable: QUALITY_ACCEPTANCE_FORM_TABLE, formId: resourceId }
  }
  const formTable = resourceId.slice(0, idx)
  const formId = resourceId.slice(idx + 1)
  if (!formTable || !formId) return null
  return { formTable, formId }
}

const resolveHookValue = (
  raw: unknown,
  ctx: { status: string; actorId: string }
): unknown => {
  if (raw === '$STATUS') return ctx.status
  if (raw === '$ACTOR_ID') return ctx.actorId
  if (raw === '$NOW') return Date.now()
  return raw
}

const toHookActions = (value: unknown): FlowHookAction[] => {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is FlowHookAction =>
      !!item &&
      typeof item === 'object' &&
      (item as { type?: string }).type === 'updateResourceFields'
  )
}

const resolveDefinitionEffectConfig = (params: {
  effectConfig: Record<string, unknown> | null
  templateId?: string | null
}) => {
  if (params.templateId !== MONTHLY_MEASUREMENT_TEMPLATE_ID) {
    return params.effectConfig
  }
  const next = { ...(params.effectConfig || {}) } as Record<string, unknown>
  const existingHooks =
    next.hooks && typeof next.hooks === 'object'
      ? (next.hooks as Record<string, unknown>)
      : {}
  const mergedHooks = { ...existingHooks } as Record<string, unknown>
  for (const [event, actions] of Object.entries(FORCED_MONTHLY_MEASUREMENT_HOOKS)) {
    mergedHooks[event] = toHookActions(mergedHooks[event]).length
      ? mergedHooks[event]
      : actions
  }
  next.hooks = mergedHooks
  return next
}

const recalculateProjectCostSummaryIfNeeded = async (params: {
  trx: Knex
  projectId?: string | null
}) => {
  if (!params.projectId) return
  await recalculateProjectCostSummaryFactory({ db: params.trx })({
    projectId: params.projectId
  })
}

const updateResourceByHookAction = async (params: {
  trx: Knex
  instance: {
    resourceType: string
    resourceId?: string | null
    projectId?: string | null
    currentStep?: number | null
  }
  action: FlowHookAction
  status: string
  actorId: string
}) => {
  if (!params.instance.resourceId) return
  const targetResourceType = params.action.resourceType || params.instance.resourceType
  if (targetResourceType !== params.instance.resourceType) return
  const sourceFields = params.action.fields || {}
  if (targetResourceType === 'MODEL') {
    const payload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(sourceFields)) {
      payload[key] = resolveHookValue(value, {
        status: params.status,
        actorId: params.actorId
      })
    }
    if (!Object.keys(payload).length) return
    await updateBranchFactory({ db: params.trx })(params.instance.resourceId, payload)
    return
  }
  if (targetResourceType === 'FORMS') {
    const parsed = parseFormResourceId(params.instance.resourceId)
    if (!parsed) return
    const payload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(sourceFields)) {
      payload[key] = resolveHookValue(value, {
        status: params.status,
        actorId: params.actorId
      })
    }
    if (!Object.keys(payload).length) return
    if (parsed.formTable === QUALITY_ACCEPTANCE_FORM_TABLE) {
      const formPayload: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(payload)) {
        formPayload[key] =
          key === 'approveStatus' && typeof value === 'string'
            ? mapFlowStatusToQualityAcceptanceApproveStatus(
                value,
                params.instance.currentStep
              )
            : value
      }
      await updateQualityAcceptanceFormFactory({ db: params.trx })(
        parsed.formId,
        formPayload
      )
      await recalculateProjectCostSummaryIfNeeded({
        trx: params.trx,
        projectId: params.instance.projectId
      })
      return
    }
    if (parsed.formTable === MONTHLY_MEASUREMENT_TABLE) {
      const monthlyPayload: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(payload)) {
        monthlyPayload[key] =
          key === 'approveStatus' && typeof value === 'string'
            ? mapFlowStatusToMonthlyMeasurementApproveStatus(
                value,
                params.instance.currentStep
              )
            : value
      }
      await updateMonthlyMeasurementFactory({ db: params.trx })(
        parsed.formId,
        monthlyPayload
      )

      const nextApproveStatus = monthlyPayload.approveStatus
      if (typeof nextApproveStatus !== 'string') return
      const measurementItems = await getMonthlyMeasurementItemsFactory({
        db: params.trx
      })(parsed.formId)
      const qualityAcceptanceIds = Array.from(
        new Set(
          measurementItems.flatMap((item) =>
            Array.isArray(item.sourceAcceptanceIds) ? item.sourceAcceptanceIds : []
          )
        )
      )
      if (!qualityAcceptanceIds.length) return
      await updateQualityAcceptanceApproveStatusByIdsFactory({ db: params.trx })({
        ids: qualityAcceptanceIds,
        approveStatus: nextApproveStatus
      })
      await recalculateProjectCostSummaryIfNeeded({
        trx: params.trx,
        projectId: params.instance.projectId
      })
    }
  }
}

const executeDefinitionHooks = async (params: {
  trx: Knex
  effectConfig: Record<string, unknown> | null
  templateId?: string | null
  event: FlowHookEvent
  instance: {
    resourceType: string
    resourceId?: string | null
    projectId?: string | null
    currentStep?: number | null
  }
  status: string
  actorId: string
}) => {
  const effectiveConfig = resolveDefinitionEffectConfig({
    effectConfig: params.effectConfig,
    templateId: params.templateId || null
  })
  const hooksObject = (effectiveConfig?.hooks || null) as Record<string, unknown> | null
  if (!hooksObject) return
  const actions = toHookActions(hooksObject[params.event])
  for (const action of actions) {
    await updateResourceByHookAction({
      trx: params.trx,
      instance: params.instance,
      action,
      status: params.status,
      actorId: params.actorId
    })
  }
}

const executeStepHooks = async (params: {
  trx: Knex
  stepSnapshot: Record<string, unknown> | null
  event: 'onStepEnter' | 'onStepLeave'
  instance: {
    resourceType: string
    resourceId?: string | null
    projectId?: string | null
    currentStep?: number | null
  }
  status: string
  actorId: string
}) => {
  const hooks = (params.stepSnapshot?.hooks || null) as Record<string, unknown> | null
  if (!hooks) return
  const actions = toHookActions(hooks[params.event])
  for (const action of actions) {
    await updateResourceByHookAction({
      trx: params.trx,
      instance: params.instance,
      action,
      status: params.status,
      actorId: params.actorId
    })
  }
}

const ensureFlowIdLength = (value: string, fieldName: string) => {
  if (value.length > FLOW_ID_MAX_LENGTH) {
    throw new BadRequestError(
      `${fieldName} is too long, max length is ${FLOW_ID_MAX_LENGTH}`
    )
  }
}

const toFlowSnapshot = (params: {
  templateId: string
  definitionId: string
  version: number
  name: string
  resourceType: string
  effectConfig: Record<string, unknown> | null
  formSchema: Array<Record<string, unknown>>
  steps: Array<{
    id: string
    name: string
    stepIndex: number
    approverIds: string[]
    requiredApprovals: number
    timeoutHours?: number | null
  }>
}): FlowSnapshot => ({
  templateId: params.templateId,
  definitionId: params.definitionId,
  version: params.version,
  name: params.name,
  resourceType: params.resourceType,
  effectConfig: params.effectConfig,
  formSchema: params.formSchema,
  steps: params.steps.map((step) => ({
    definitionStepId: step.id,
    name: step.name,
    stepIndex: step.stepIndex,
    approverIds: step.approverIds || [],
    requiredApprovals: step.requiredApprovals || 1,
    timeoutHours: step.timeoutHours || null,
    hooks: {
      onEnter: [],
      onLeave: []
    }
  }))
})

const fromFlowSnapshot = (raw: Record<string, unknown> | null): FlowSnapshot | null => {
  if (!raw || typeof raw !== 'object') return null
  const stepsRaw = Array.isArray(raw.steps) ? raw.steps : []
  const steps: FlowStepSnapshot[] = stepsRaw
    .map((step, idx): FlowStepSnapshot | null => {
      if (!step || typeof step !== 'object') return null
      const s = step as Record<string, unknown>
      return {
        definitionStepId: s.definitionStepId ? String(s.definitionStepId) : null,
        name: String(s.name || ''),
        stepIndex: Number(s.stepIndex || idx + 1),
        approverIds: Array.isArray(s.approverIds)
          ? s.approverIds.map((id) => String(id))
          : [],
        requiredApprovals: Number(s.requiredApprovals || 1),
        timeoutHours:
          s.timeoutHours === null || s.timeoutHours === undefined
            ? null
            : Number(s.timeoutHours),
        hooks:
          s.hooks && typeof s.hooks === 'object'
            ? (s.hooks as Record<string, unknown>)
            : null
      }
    })
    .filter((v): v is FlowStepSnapshot => Boolean(v))
  return {
    templateId: String(raw.templateId || ''),
    definitionId: String(raw.definitionId || ''),
    version: Number(raw.version || 0),
    name: String(raw.name || ''),
    resourceType: String(raw.resourceType || ''),
    effectConfig:
      raw.effectConfig && typeof raw.effectConfig === 'object'
        ? (raw.effectConfig as Record<string, unknown>)
        : null,
    formSchema: Array.isArray(raw.formSchema)
      ? (raw.formSchema as Array<Record<string, unknown>>)
      : [],
    steps
  }
}

const captureFormSnapshotIfNeeded = async (params: {
  trx: Knex
  instance: {
    id: string
    resourceType: string
    resourceId?: string | null
  }
  step: {
    id: string
    stepIndex: number
  }
  snapshotType: string
  actorId: string
  actionId?: string | null
}) => {
  if (params.instance.resourceType !== 'FORMS') return
  if (!params.instance.resourceId) return
  const parsed = parseFormResourceId(params.instance.resourceId)
  if (!parsed || parsed.formTable !== QUALITY_ACCEPTANCE_FORM_TABLE) return
  const form = await getQualityAcceptanceFormByIdFactory({ db: params.trx })(
    parsed.formId
  )
  if (!form) return
  await createApprovalFlowInstanceStepFormSnapshotFactory({ db: params.trx })({
    instanceId: params.instance.id,
    stepId: params.step.id,
    stepIndex: params.step.stepIndex,
    snapshotType: params.snapshotType,
    sourceType: params.instance.resourceType,
    sourceId: params.instance.resourceId,
    triggeredBy: params.actorId,
    actionId: params.actionId || null,
    formSnapshot: form as Record<string, unknown>
  })
}

export const createApprovalFlowDefinitionWithStepsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    id?: string | null
    templateId?: string | null
    projectId?: string | null
    name: string
    resourceType?: string | null
    isActive?: boolean
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
    steps: Array<{
      name: string
      approverIds?: string[]
      requiredApprovals?: number
      timeoutHours?: number | null
    }>
    createdBy: string
  }) => {
    return await deps.db.transaction(async (trx) => {
      const getDefinitionById = getApprovalFlowDefinitionByIdFactory({ db: trx })
      const getLatestVersion = getLatestApprovalFlowDefinitionVersionFactory({
        db: trx
      })
      let templateId = params.templateId?.trim() || null
      if (!templateId && params.previousVersionId) {
        const prev = await getDefinitionById(params.previousVersionId)
        if (!prev) throw new BadRequestError('Previous version not found')
        templateId = prev.templateId
      }
      if (!templateId && params.id) {
        templateId = params.id.trim()
      }
      if (!templateId) {
        templateId = generateApprovalFlowId()
      }
      ensureFlowIdLength(templateId, 'templateId')
      if (params.id?.trim()) {
        ensureFlowIdLength(params.id.trim(), 'id')
      }

      const nextVersion =
        (await getLatestVersion({
          templateId
        })) + 1

      if (params.isActive ?? true) {
        const active = await getActiveApprovalFlowDefinitionFactory({ db: trx })({
          templateId
        })
        if (active) {
          await setApprovalFlowDefinitionActiveStateFactory({ db: trx })({
            definitionId: active.id,
            isActive: false
          })
        }
      }

      const definition = await createApprovalFlowDefinitionFactory({ db: trx })({
        id: params.id || undefined,
        templateId,
        projectId: params.projectId || null,
        name: params.name,
        resourceType: params.resourceType || 'MODEL',
        isActive: params.isActive ?? true,
        version: nextVersion,
        previousVersionId: params.previousVersionId || null,
        triggerConfig: params.triggerConfig || null,
        effectConfig: params.effectConfig || null,
        formSchema: params.formSchema || null,
        createdBy: params.createdBy
      })

      const createStep = createApprovalFlowDefinitionStepFactory({ db: trx })
      const steps = params.steps.length
        ? params.steps
        : [
            {
              name: '默认审批',
              approverIds: [],
              requiredApprovals: 1,
              timeoutHours: null
            }
          ]
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        await createStep({
          definitionId: definition.id,
          name: step.name,
          stepIndex: i + 1,
          approverIds: step.approverIds || [],
          requiredApprovals: step.requiredApprovals || 1,
          timeoutHours: step.timeoutHours || null
        })
      }

      return definition
    })
  }

export const startApprovalFlowFactory =
  (deps: { db: Knex }) =>
  async (params: {
    templateId?: string | null
    definitionId?: string | null
    projectId?: string | null
    category?: string | null
    resourceId?: string | null
    formData?: Record<string, unknown> | null
    comment?: string | null
    userId: string
  }) => {
    return await deps.db.transaction(async (trx) => {
      const getOpenInstanceForResource = getOpenApprovalFlowInstanceForResourceFactory({
        db: trx
      })
      const getActiveDefinition = getActiveApprovalFlowDefinitionFactory({ db: trx })
      const getDefinitionById = getApprovalFlowDefinitionByIdFactory({ db: trx })
      const getActiveByCategory = getActiveApprovalFlowByCategoryFactory({ db: trx })
      const createInstance = createApprovalFlowInstanceFactory({ db: trx })
      const getDefinitionSteps = getApprovalFlowDefinitionStepsFactory({ db: trx })
      const createInstanceStep = createApprovalFlowInstanceStepFactory({ db: trx })
      const insertAction = insertApprovalFlowActionFactory({ db: trx })

      let definition = null
      if (params.definitionId) {
        definition = await getDefinitionById(params.definitionId)
      } else if (params.category && params.projectId) {
        definition = await getActiveByCategory({
          projectId: params.projectId,
          category: params.category
        })
      } else {
        const templateId = params.templateId || null
        if (templateId) {
          definition = await getActiveDefinition({ templateId })
        }
      }

      if (!definition) {
        throw new BadRequestError('No active flow version found')
      }
      const canRunInParallel = shouldAllowParallelInstancesForSameResource(
        (definition.effectConfig as Record<string, unknown> | null) || null
      )
      if (!canRunInParallel) {
        const existingInstance = await getOpenInstanceForResource({
          templateId: definition.templateId,
          resourceType: definition.resourceType,
          resourceId: params.resourceId || null
        })
        if (existingInstance) {
          throw new BadRequestError('There is already an open approval instance')
        }
      }

      const definitionSteps = await getDefinitionSteps(definition.id)
      if (!definitionSteps.length) {
        throw new BadRequestError('Approval flow definition has no steps')
      }
      const flowSnapshot = toFlowSnapshot({
        templateId: definition.templateId,
        definitionId: definition.id,
        version: definition.version,
        name: definition.name,
        resourceType: definition.resourceType,
        effectConfig:
          (definition.effectConfig as Record<string, unknown> | null) || null,
        formSchema: (definition.formSchema as Array<Record<string, unknown>>) || [],
        steps: definitionSteps
      })

      let bindingId: string | null = null
      if (definition.resourceType === 'MODEL' && params.resourceId && params.projectId) {
        const subjectKey = buildApprovalBindingSubjectKey({
          subjectType: 'MODEL_VERSION',
          subjectId: params.resourceId
        })
        const getBinding = getApprovalFlowBindingBySubjectKeyFactory({ db: trx })
        const existingBinding = await getBinding(subjectKey)
        if (existingBinding) {
          const updateBinding = updateApprovalFlowBindingFactory({ db: trx })
          const updated = await updateBinding({
            bindingId: existingBinding.id,
            definitionId: definition.id,
            templateId: definition.templateId,
            currentInstanceId: null,
            currentRoundNo: (existingBinding.currentRoundNo || 0) + 1,
            status: 'IN_REVIEW',
            lastSubmittedAt: new Date(),
            lastSubmittedBy: params.userId,
            updater: params.userId
          })
          bindingId = updated.id
        } else {
          const createBinding = createApprovalFlowBindingFactory({ db: trx })
          const created = await createBinding({
            projectId: params.projectId,
            subjectType: 'MODEL_VERSION',
            subjectId: params.resourceId,
            subjectKey,
            definitionId: definition.id,
            templateId: definition.templateId,
            currentInstanceId: null,
            currentRoundNo: 1,
            status: 'IN_REVIEW',
            lastSubmittedAt: new Date(),
            lastSubmittedBy: params.userId,
            creator: params.userId,
            updater: params.userId
          })
          bindingId = created.id
        }
      }

      const instance = await createInstance({
        definitionId: null,
        templateId: definition.templateId,
        definitionVersion: definition.version,
        projectId: params.projectId || null,
        resourceType: definition.resourceType,
        resourceId: params.resourceId || null,
        bindingId,
        formData: params.formData || null,
        flowSnapshot: flowSnapshot as Record<string, unknown>,
        status: ApprovalFlowInstanceStatus.Pending,
        currentStep: 1,
        createdBy: params.userId
      })

      if (bindingId) {
        const updateBinding = updateApprovalFlowBindingFactory({ db: trx })
        await updateBinding({
          bindingId,
          currentInstanceId: instance.id,
          updater: params.userId
        })
      }

      const now = new Date()
      await createInstanceStep({
        instanceId: instance.id,
        definitionStepId: null,
        name: START_STEP_NAME,
        stepIndex: START_STEP_INDEX,
        status: ApprovalFlowStepStatus.Approved,
        approverIds: [params.userId],
        requiredApprovals: 1,
        approvedByIds: [params.userId],
        stepSnapshot: {
          definitionStepId: null,
          name: START_STEP_NAME,
          stepIndex: START_STEP_INDEX,
          approverIds: [params.userId],
          requiredApprovals: 1,
          timeoutHours: null,
          hooks: {
            onEnter: [],
            onLeave: []
          }
        },
        startedAt: now,
        dueAt: null,
        completedAt: now
      })
      for (let i = 0; i < definitionSteps.length; i++) {
        const step = definitionSteps[i]
        const isFirst = i === 0
        await createInstanceStep({
          instanceId: instance.id,
          definitionStepId: step.id,
          name: step.name,
          stepIndex: step.stepIndex,
          status: isFirst
            ? ApprovalFlowStepStatus.Pending
            : ApprovalFlowStepStatus.Waiting,
          approverIds: step.approverIds || [],
          requiredApprovals: step.requiredApprovals || 1,
          approvedByIds: [],
          stepSnapshot: {
            ...flowSnapshot.steps[i]
          },
          startedAt: isFirst ? now : null,
          dueAt: isFirst ? getStepDueAt(now, step.timeoutHours) : null
        })
      }

      const startAction = await insertAction({
        instanceId: instance.id,
        action: ApprovalFlowActionType.Started,
        actorId: params.userId,
        toStatus: ApprovalFlowInstanceStatus.Pending,
        comment: params.comment || null,
        metadata: {
          definitionVersion: definition.version
        }
      })

      const firstStep = await getApprovalFlowCurrentStepFactory({ db: trx })(
        instance.id
      )
      if (firstStep) {
        await captureFormSnapshotIfNeeded({
          trx,
          instance,
          step: {
            id: firstStep.id,
            stepIndex: firstStep.stepIndex
          },
          snapshotType: FORM_SNAPSHOT_ENTER,
          actorId: params.userId,
          actionId: startAction.id
        })
        await executeStepHooks({
          trx,
          stepSnapshot:
            (firstStep.stepSnapshot as Record<string, unknown> | null) || null,
          event: 'onStepEnter',
          instance,
          status: ApprovalFlowInstanceStatus.Pending,
          actorId: params.userId
        })
      }

      await executeDefinitionHooks({
        trx,
        effectConfig:
          (definition.effectConfig as Record<string, unknown> | null) || null,
        templateId: definition.templateId,
        event: 'onInstancePending',
        instance,
        status: ApprovalFlowInstanceStatus.Pending,
        actorId: params.userId
      })

      return instance
    })
  }

export const updateApprovalFlowStatusFactory =
  (deps: { db: Knex }) =>
  async (params: {
    instanceId: string
    userId: string
    targetStatus: string
    comment?: string | null
    rollbackToStep?: number | null
    nextStepApproverIds?: string[] | null
    forceByAdmin?: boolean
  }) => {
    return await deps.db.transaction(async (trx) => {
      const getInstanceById = getApprovalFlowInstanceByIdFactory({ db: trx })
      const getCurrentStep = getApprovalFlowCurrentStepFactory({ db: trx })
      const getSteps = getApprovalFlowInstanceStepsFactory({ db: trx })
      const updateStatus = updateApprovalFlowInstanceStatusFactory({ db: trx })
      const updateStep = updateApprovalFlowInstanceStepFactory({ db: trx })
      const insertAction = insertApprovalFlowActionFactory({ db: trx })

      const instance = await getInstanceById({
        id: params.instanceId
      })
      if (!instance) throw new BadRequestError('Approval instance not found')
      const flowSnapshot = fromFlowSnapshot(
        (instance.flowSnapshot as Record<string, unknown> | null) || null
      )
      if (!flowSnapshot) throw new BadRequestError('Approval flow snapshot not found')
      if (instance.status !== ApprovalFlowInstanceStatus.Pending) {
        throw new BadRequestError('Only pending instances can be updated')
      }
      if (
        params.targetStatus === ApprovalFlowInstanceStatus.Rejected &&
        !params.comment
      ) {
        throw new BadRequestError('Rejection requires a comment')
      }

      const currentStep = await getCurrentStep(params.instanceId)
      if (!currentStep) {
        throw new BadRequestError('No active approval step found')
      }
      if (
        currentStep.approverIds?.length &&
        !currentStep.approverIds.includes(params.userId) &&
        !params.forceByAdmin
      ) {
        throw new BadRequestError('Current user is not assigned to this approval step')
      }

      const nextApprovedBy = Array.from(
        new Set([...(currentStep.approvedByIds || []), params.userId])
      )
      // 标记是否已在分支内插入了 action，避免末尾再次插入导致重复
      let didInsertStepAction = false
      if (params.targetStatus === ApprovalFlowInstanceStatus.Approved) {
        if (nextApprovedBy.length >= currentStep.requiredApprovals) {
          const now = new Date()
          await updateStep({
            stepId: currentStep.id,
            status: ApprovalFlowStepStatus.Approved,
            approvedByIds: nextApprovedBy,
            completedAt: now
          })
          const allSteps = await getSteps(params.instanceId)
          const nextStep = allSteps.find(
            (s) => s.stepIndex === currentStep.stepIndex + 1
          )
          const currentLeaveAction = await insertAction({
            instanceId: params.instanceId,
            stepId: currentStep.id,
            action: ApprovalFlowActionType.StepApproved,
            actorId: params.userId,
            fromStatus: instance.status,
            toStatus: instance.status,
            comment: params.comment || null,
            metadata: {
              approvals: nextApprovedBy.length,
              requiredApprovals: currentStep.requiredApprovals
            }
          })
          // 只有存在下一步时（中间步骤）才标记已插入，避免末尾再次重复
          // 最后一步通过时 didInsertStepAction 保持 false，末尾仍需插入 Approved action
          if (nextStep) didInsertStepAction = true
          await captureFormSnapshotIfNeeded({
            trx,
            instance,
            step: {
              id: currentStep.id,
              stepIndex: currentStep.stepIndex
            },
            snapshotType: FORM_SNAPSHOT_LEAVE,
            actorId: params.userId,
            actionId: currentLeaveAction.id
          })
          await executeStepHooks({
            trx,
            stepSnapshot:
              (currentStep.stepSnapshot as Record<string, unknown> | null) || null,
            event: 'onStepLeave',
            instance,
            status: ApprovalFlowInstanceStatus.Pending,
            actorId: params.userId
          })
          if (nextStep) {
            const hasNextStepApproverOverride =
              params.nextStepApproverIds !== undefined &&
              params.nextStepApproverIds !== null
            const nextStepApproverIds = hasNextStepApproverOverride
              ? Array.from(new Set(params.nextStepApproverIds))
              : null
            const nextStepRequiredApprovals =
              nextStepApproverIds && nextStepApproverIds.length > 0
                ? Math.max(
                    1,
                    Math.min(nextStep.requiredApprovals, nextStepApproverIds.length)
                  )
                : nextStep.requiredApprovals
            const nextStepSnapshot = flowSnapshot.steps.find(
              (s) => s.stepIndex === nextStep.stepIndex
            )
            const timeoutHours =
              nextStepSnapshot?.timeoutHours === null ||
              nextStepSnapshot?.timeoutHours === undefined
                ? null
                : Number(nextStepSnapshot.timeoutHours)
            await updateStep({
              stepId: nextStep.id,
              status: ApprovalFlowStepStatus.Pending,
              approverIds: hasNextStepApproverOverride
                ? nextStepApproverIds || []
                : undefined,
              requiredApprovals: nextStepRequiredApprovals,
              startedAt: now,
              dueAt: getStepDueAt(now, timeoutHours)
            })
            await captureFormSnapshotIfNeeded({
              trx,
              instance,
              step: {
                id: nextStep.id,
                stepIndex: nextStep.stepIndex
              },
              snapshotType: FORM_SNAPSHOT_ENTER,
              actorId: params.userId,
              actionId: currentLeaveAction.id
            })
            await executeStepHooks({
              trx,
              stepSnapshot:
                (nextStep.stepSnapshot as Record<string, unknown> | null) || null,
              event: 'onStepEnter',
              instance,
              status: ApprovalFlowInstanceStatus.Pending,
              actorId: params.userId
            })
          }
        } else {
          await updateStep({
            stepId: currentStep.id,
            approvedByIds: nextApprovedBy
          })
          await insertAction({
            instanceId: params.instanceId,
            stepId: currentStep.id,
            action: ApprovalFlowActionType.StepApproved,
            actorId: params.userId,
            fromStatus: instance.status,
            toStatus: instance.status,
            comment: params.comment || null,
            metadata: {
              approvals: nextApprovedBy.length,
              requiredApprovals: currentStep.requiredApprovals
            }
          })
          return instance
        }
      } else {
        if (
          params.targetStatus === ApprovalFlowInstanceStatus.Rejected &&
          params.rollbackToStep !== null &&
          params.rollbackToStep !== undefined &&
          params.rollbackToStep >= START_STEP_INDEX
        ) {
          const allSteps = await getSteps(params.instanceId)
          const rollbackStep = allSteps.find(
            (s) => s.stepIndex === params.rollbackToStep
          )
          if (!rollbackStep) {
            throw new BadRequestError('Rollback step not found')
          }
          for (const step of allSteps) {
            if (step.stepIndex < params.rollbackToStep) {
              continue
            }
            await updateStep({
              stepId: step.id,
              status:
                step.stepIndex === params.rollbackToStep
                  ? ApprovalFlowStepStatus.Pending
                  : ApprovalFlowStepStatus.Waiting,
              approvedByIds: [],
              startedAt: step.stepIndex === params.rollbackToStep ? new Date() : null,
              dueAt: null,
              completedAt: null
            })
          }
          await captureFormSnapshotIfNeeded({
            trx,
            instance,
            step: {
              id: currentStep.id,
              stepIndex: currentStep.stepIndex
            },
            snapshotType: FORM_SNAPSHOT_LEAVE,
            actorId: params.userId,
            actionId: null
          })
          await executeStepHooks({
            trx,
            stepSnapshot:
              (currentStep.stepSnapshot as Record<string, unknown> | null) || null,
            event: 'onStepLeave',
            instance,
            status: ApprovalFlowInstanceStatus.Rejected,
            actorId: params.userId
          })
          if (rollbackStep) {
            await captureFormSnapshotIfNeeded({
              trx,
              instance,
              step: {
                id: rollbackStep.id,
                stepIndex: rollbackStep.stepIndex
              },
              snapshotType: FORM_SNAPSHOT_ENTER,
              actorId: params.userId,
              actionId: null
            })
            await executeStepHooks({
              trx,
              stepSnapshot:
                (rollbackStep.stepSnapshot as Record<string, unknown> | null) || null,
              event: 'onStepEnter',
              instance,
              status: ApprovalFlowInstanceStatus.Pending,
              actorId: params.userId
            })
          }
        } else {
          await updateStep({
            stepId: currentStep.id,
            status:
              params.targetStatus === ApprovalFlowInstanceStatus.Canceled
                ? ApprovalFlowStepStatus.Canceled
                : ApprovalFlowStepStatus.Rejected,
            approvedByIds: nextApprovedBy,
            completedAt: new Date()
          })
          await captureFormSnapshotIfNeeded({
            trx,
            instance,
            step: {
              id: currentStep.id,
              stepIndex: currentStep.stepIndex
            },
            snapshotType: FORM_SNAPSHOT_LEAVE,
            actorId: params.userId,
            actionId: null
          })
          await executeStepHooks({
            trx,
            stepSnapshot:
              (currentStep.stepSnapshot as Record<string, unknown> | null) || null,
            event: 'onStepLeave',
            instance,
            status: params.targetStatus,
            actorId: params.userId
          })
        }
      }

      const refreshedSteps = await getSteps(params.instanceId)
      const hasPending = refreshedSteps.some(
        (s) =>
          s.status === ApprovalFlowStepStatus.Pending ||
          s.status === ApprovalFlowStepStatus.Waiting
      )
      const finalStatus =
        params.targetStatus === ApprovalFlowInstanceStatus.Approved
          ? hasPending
            ? ApprovalFlowInstanceStatus.Pending
            : ApprovalFlowInstanceStatus.Approved
          : params.targetStatus === ApprovalFlowInstanceStatus.Rejected &&
            params.rollbackToStep !== null &&
            params.rollbackToStep !== undefined &&
            params.rollbackToStep >= START_STEP_INDEX
          ? ApprovalFlowInstanceStatus.Pending
          : params.targetStatus

      const updatedInstance = await updateStatus({
        instanceId: params.instanceId,
        status: finalStatus,
        currentStep:
          refreshedSteps.find((s) => s.status === ApprovalFlowStepStatus.Pending)
            ?.stepIndex ?? instance.currentStep
      })
      if (!updatedInstance) throw new BadRequestError('Approval instance not found')

      // 仅在当前分支尚未插入 action 时才插入（避免步骤通过时重复插入）
      if (!didInsertStepAction) {
        await insertAction({
          instanceId: params.instanceId,
          stepId: currentStep.id,
          action:
            params.targetStatus === ApprovalFlowInstanceStatus.Approved &&
            finalStatus === ApprovalFlowInstanceStatus.Pending
              ? ApprovalFlowActionType.StepApproved
              : params.targetStatus === ApprovalFlowInstanceStatus.Rejected
              ? ApprovalFlowActionType.Rejected
              : finalStatus === ApprovalFlowInstanceStatus.Approved
              ? ApprovalFlowActionType.Approved
              : ApprovalFlowActionType.Canceled,
          actorId: params.userId,
          fromStatus: instance.status,
          toStatus: finalStatus,
          comment: params.comment || null,
          metadata: params.forceByAdmin
            ? {
                forced: true
              }
            : null
        })
      }

      if (finalStatus === ApprovalFlowInstanceStatus.Pending) {
        await executeDefinitionHooks({
          trx,
          effectConfig: flowSnapshot.effectConfig || null,
          templateId: flowSnapshot.templateId,
          event: 'onInstancePending',
          instance: updatedInstance,
          status: ApprovalFlowInstanceStatus.Pending,
          actorId: params.userId
        })
      } else if (finalStatus === ApprovalFlowInstanceStatus.Approved) {
        await executeDefinitionHooks({
          trx,
          effectConfig: flowSnapshot.effectConfig || null,
          templateId: flowSnapshot.templateId,
          event: 'onInstanceApproved',
          instance: updatedInstance,
          status: ApprovalFlowInstanceStatus.Approved,
          actorId: params.userId
        })
      } else if (finalStatus === ApprovalFlowInstanceStatus.Rejected) {
        await executeDefinitionHooks({
          trx,
          effectConfig: flowSnapshot.effectConfig || null,
          templateId: flowSnapshot.templateId,
          event: 'onInstanceRejected',
          instance: updatedInstance,
          status: ApprovalFlowInstanceStatus.Rejected,
          actorId: params.userId
        })
      } else if (finalStatus === ApprovalFlowInstanceStatus.Canceled) {
        await executeDefinitionHooks({
          trx,
          effectConfig: flowSnapshot.effectConfig || null,
          templateId: flowSnapshot.templateId,
          event: 'onInstanceCanceled',
          instance: updatedInstance,
          status: ApprovalFlowInstanceStatus.Canceled,
          actorId: params.userId
        })
      }

      return updatedInstance
    })
  }

export const reactivateApprovalFlowFactory =
  (deps: { db: Knex }) =>
  async (params: {
    instanceId: string
    targetStep: number
    userId: string
    comment: string
  }) => {
    return await deps.db.transaction(async (trx) => {
      const getInstanceById = getApprovalFlowInstanceByIdFactory({ db: trx })
      const getSteps = getApprovalFlowInstanceStepsFactory({ db: trx })
      const updateStep = updateApprovalFlowInstanceStepFactory({ db: trx })
      const updateStatus = updateApprovalFlowInstanceStatusFactory({ db: trx })
      const insertAction = insertApprovalFlowActionFactory({ db: trx })

      const instance = await getInstanceById({ id: params.instanceId })
      if (!instance) throw new BadRequestError('Approval instance not found')
      if (
        !(
          [
            ApprovalFlowInstanceStatus.Approved,
            ApprovalFlowInstanceStatus.Rejected,
            ApprovalFlowInstanceStatus.Canceled
          ] as string[]
        ).includes(instance.status)
      ) {
        throw new BadRequestError(
          'Only approved/rejected/canceled instances can reactivate'
        )
      }

      const flowSnapshot = fromFlowSnapshot(
        (instance.flowSnapshot as Record<string, unknown> | null) || null
      )
      if (!flowSnapshot) throw new BadRequestError('Approval flow snapshot not found')
      const steps = await getSteps(params.instanceId)
      if (!steps.length) throw new BadRequestError('Approval steps not found')

      const targetStep = steps.find((step) => step.stepIndex === params.targetStep)
      if (!targetStep) throw new BadRequestError('Target step not found')

      const now = new Date()
      for (const step of steps) {
        if (step.stepIndex < params.targetStep) {
          await updateStep({
            stepId: step.id,
            status: ApprovalFlowStepStatus.Approved,
            completedAt: step.completedAt || now
          })
          continue
        }
        if (step.stepIndex === params.targetStep) {
          const targetSnapshot = flowSnapshot.steps.find(
            (snapshot) => snapshot.stepIndex === step.stepIndex
          )
          const timeoutHours =
            targetSnapshot?.timeoutHours === null ||
            targetSnapshot?.timeoutHours === undefined
              ? null
              : Number(targetSnapshot.timeoutHours)
          await updateStep({
            stepId: step.id,
            status: ApprovalFlowStepStatus.Pending,
            approvedByIds: [],
            startedAt: now,
            dueAt: getStepDueAt(now, timeoutHours),
            completedAt: null
          })
          continue
        }
        await updateStep({
          stepId: step.id,
          status: ApprovalFlowStepStatus.Waiting,
          approvedByIds: [],
          startedAt: null,
          dueAt: null,
          completedAt: null
        })
      }

      const updated = await updateStatus({
        instanceId: params.instanceId,
        status: ApprovalFlowInstanceStatus.Pending,
        currentStep: params.targetStep
      })
      if (!updated) throw new BadRequestError('Approval instance not found')

      const action = await insertAction({
        instanceId: params.instanceId,
        stepId: targetStep.id,
        action: ApprovalFlowActionType.Reactivated,
        actorId: params.userId,
        fromStatus: instance.status,
        toStatus: ApprovalFlowInstanceStatus.Pending,
        comment: params.comment || null,
        metadata: {
          targetStep: params.targetStep
        }
      })

      await captureFormSnapshotIfNeeded({
        trx,
        instance,
        step: {
          id: targetStep.id,
          stepIndex: targetStep.stepIndex
        },
        snapshotType: FORM_SNAPSHOT_ENTER,
        actorId: params.userId,
        actionId: action.id
      })
      await executeStepHooks({
        trx,
        stepSnapshot:
          (targetStep.stepSnapshot as Record<string, unknown> | null) || null,
        event: 'onStepEnter',
        instance,
        status: ApprovalFlowInstanceStatus.Pending,
        actorId: params.userId
      })
      await executeDefinitionHooks({
        trx,
        effectConfig: flowSnapshot.effectConfig || null,
        templateId: flowSnapshot.templateId,
        event: 'onInstancePending',
        instance: updated,
        status: ApprovalFlowInstanceStatus.Pending,
        actorId: params.userId
      })

      return updated
    })
  }

export const resetApprovalFlowToUnsubmittedFactory =
  (deps: { db: Knex }) =>
  async (params: { instanceId: string; userId: string; comment: string }) => {
    return await deps.db.transaction(async (trx) => {
      const getInstanceById = getApprovalFlowInstanceByIdFactory({ db: trx })
      const getSteps = getApprovalFlowInstanceStepsFactory({ db: trx })
      const updateStep = updateApprovalFlowInstanceStepFactory({ db: trx })
      const updateStatus = updateApprovalFlowInstanceStatusFactory({ db: trx })
      const insertAction = insertApprovalFlowActionFactory({ db: trx })

      const instance = await getInstanceById({ id: params.instanceId })
      if (!instance) throw new BadRequestError('Approval instance not found')
      const steps = await getSteps(params.instanceId)
      for (const step of steps) {
        if (step.status === ApprovalFlowStepStatus.Approved) continue
        await updateStep({
          stepId: step.id,
          status: ApprovalFlowStepStatus.Canceled,
          approvedByIds: [],
          startedAt: null,
          dueAt: null,
          completedAt: new Date()
        })
      }

      const toStatus = ApprovalFlowInstanceStatus.Canceled
      const updated = await updateStatus({
        instanceId: params.instanceId,
        status: toStatus,
        currentStep: 1
      })
      if (!updated) throw new BadRequestError('Approval instance not found')

      await insertAction({
        instanceId: params.instanceId,
        action: ApprovalFlowActionType.ResetToUnsubmitted,
        actorId: params.userId,
        fromStatus: instance.status,
        toStatus,
        comment: params.comment || null
      })

      if (!instance.resourceId) return updated
      if (instance.resourceType === 'MODEL') {
        await updateBranchFactory({ db: trx })(instance.resourceId, {
          approveStatus: null
        })
        return updated
      }
      if (instance.resourceType !== 'FORMS') return updated

      const parsed = parseFormResourceId(instance.resourceId)
      if (!parsed) return updated
      if (parsed.formTable === QUALITY_ACCEPTANCE_FORM_TABLE) {
        await updateQualityAcceptanceFormFactory({ db: trx })(parsed.formId, {
          approveStatus: null
        })
        await recalculateProjectCostSummaryIfNeeded({
          trx,
          projectId: instance.projectId
        })
        return updated
      }
      if (parsed.formTable !== MONTHLY_MEASUREMENT_TABLE) return updated

      await updateMonthlyMeasurementFactory({ db: trx })(parsed.formId, {
        flowInstanceId: null,
        approveStatus: null
      })
      const measurementItems = await getMonthlyMeasurementItemsFactory({ db: trx })(
        parsed.formId
      )
      const qualityAcceptanceIds = Array.from(
        new Set(
          measurementItems.flatMap((item) =>
            Array.isArray(item.sourceAcceptanceIds) ? item.sourceAcceptanceIds : []
          )
        )
      )
      if (qualityAcceptanceIds.length) {
        await updateQualityAcceptanceApproveStatusByIdsFactory({ db: trx })({
          ids: qualityAcceptanceIds,
          approveStatus: null
        })
      }
      await recalculateProjectCostSummaryIfNeeded({
        trx,
        projectId: instance.projectId
      })

      return updated
    })
  }

export const processApprovalFlowTimeoutsFactory = (deps: { db: Knex }) => async () => {
  return await deps.db.transaction(async (trx) => {
    const getTimedOutSteps = getApprovalFlowTimedOutStepsFactory({ db: trx })
    const getInstanceById = getApprovalFlowInstanceByIdFactory({ db: trx })
    const updateStatus = updateApprovalFlowInstanceStatusFactory({ db: trx })
    const updateStep = updateApprovalFlowInstanceStepFactory({ db: trx })
    const insertAction = insertApprovalFlowActionFactory({ db: trx })

    const timedOutSteps = await getTimedOutSteps()
    let affectedCount = 0
    for (const step of timedOutSteps) {
      const instance = await getInstanceById({
        id: step.instanceId
      })
      if (!instance || instance.status !== ApprovalFlowInstanceStatus.Pending) continue
      const flowSnapshot = fromFlowSnapshot(
        (instance.flowSnapshot as Record<string, unknown> | null) || null
      )
      if (!flowSnapshot) continue

      await updateStep({
        stepId: step.id,
        status: ApprovalFlowStepStatus.Rejected,
        completedAt: new Date()
      })
      await updateStatus({
        instanceId: step.instanceId,
        status: ApprovalFlowInstanceStatus.Rejected
      })
      await insertAction({
        instanceId: step.instanceId,
        stepId: step.id,
        action: ApprovalFlowActionType.TimeoutRejected,
        actorId: 'system',
        fromStatus: ApprovalFlowInstanceStatus.Pending,
        toStatus: ApprovalFlowInstanceStatus.Rejected,
        comment: 'Step timed out'
      })
      await captureFormSnapshotIfNeeded({
        trx,
        instance,
        step: {
          id: step.id,
          stepIndex: step.stepIndex
        },
        snapshotType: FORM_SNAPSHOT_LEAVE,
        actorId: 'system',
        actionId: null
      })
      await executeStepHooks({
        trx,
        stepSnapshot: (step.stepSnapshot as Record<string, unknown> | null) || null,
        event: 'onStepLeave',
        instance,
        status: ApprovalFlowInstanceStatus.Rejected,
        actorId: 'system'
      })
      await executeDefinitionHooks({
        trx,
        effectConfig: flowSnapshot.effectConfig || null,
        templateId: flowSnapshot.templateId,
        event: 'onInstanceRejected',
        instance,
        status: ApprovalFlowInstanceStatus.Rejected,
        actorId: 'system'
      })
      affectedCount += 1
    }
    return affectedCount
  })
}
