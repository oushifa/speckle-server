import type { Knex } from 'knex'
import { getApprovalSubjectHandler } from '@/modules/flow/services/subjectHandlers'
import {
  createApprovalFlowBindingFactory,
  buildApprovalBindingSubjectKey,
  getApprovalFlowBindingByIdFactory as getApprovalFlowBindingRecordByIdFactory,
  getApprovalFlowBindingBySubjectKeyFactory,
  listApprovalFlowInstancesByBindingIdFactory as listApprovalFlowInstanceRecordsByBindingIdFactory,
  updateApprovalFlowBindingFactory
} from '@/modules/flow/repositories/approvalBindings'
import {
  ApprovalFlowActionType,
  ApprovalFlowInstanceStatus,
  ApprovalFlowStepStatus,
  createApprovalFlowInstanceFactory,
  createApprovalFlowInstanceStepFactory,
  getApprovalFlowActionsFactory,
  getApprovalFlowCurrentStepFactory,
  getApprovalFlowDefinitionByIdFactory,
  getApprovalFlowDefinitionStepsFactory,
  getApprovalFlowInstanceByIdFactory,
  updateApprovalFlowInstanceStatusFactory,
  getApprovalFlowInstanceStepsFactory,
  insertApprovalFlowActionFactory,
  updateApprovalFlowInstanceStepFactory
} from '@/modules/flow/repositories/approvalFlows'
import { updateApprovalFlowStatusFactory } from '@/modules/flow/services/approvalFlows'
import { scheduleApprovalFlowTodoSync } from '@/modules/unified-work-sync/services/approvalFlowTodoSync'
import { BadRequestError, NotFoundError } from '@/modules/shared/errors'
import type {
  ApprovalFlowBindingRecord,
  ApprovalFlowDefinitionStepRecord,
  ApprovalFlowInstanceRecord
} from '@/modules/core/helpers/types'

export const approvalBindingSubjectTypes = ['MODEL_VERSION', 'FORM_RECORD'] as const
export type ApprovalBindingSubjectType = (typeof approvalBindingSubjectTypes)[number]

export const approvalBindingStatuses = [
  'DRAFT',
  'IN_REVIEW',
  'RETURNED',
  'APPROVED',
  'REJECTED',
  'CANCELED'
] as const
export type ApprovalBindingStatus = (typeof approvalBindingStatuses)[number]

export type ApprovalBindingSummary = {
  id: string
  projectId: string
  subjectType: ApprovalBindingSubjectType
  subjectId: string
  subjectTable: string | null
  subjectKey: string
  definitionId: string
  templateId: string
  currentInstanceId: string | null
  currentRoundNo: number
  status: ApprovalBindingStatus
  metadata: Record<string, unknown> | null
  createdAt: Date | string
  updatedAt: Date | string
}

export type ApprovalInstanceSummary = {
  id: string
  bindingId: string
  roundNo: number
  status: string
  currentStep: number | null
  createdAt: Date | string
  updatedAt: Date | string
}

export type ApprovalBindingSubjectInput = {
  projectId: string
  subjectType: ApprovalBindingSubjectType
  subjectId: string
  subjectTable?: string | null
}

export type SubmitApprovalBindingParams = ApprovalBindingSubjectInput & {
  definitionId: string
  formData?: Record<string, unknown> | null
  comment?: string | null
  actorUserId: string
}

export type ResubmitApprovalBindingParams = {
  bindingId: string
  formData?: Record<string, unknown> | null
  comment?: string | null
  actorUserId: string
}

export type ApproveApprovalInstanceParams = {
  instanceId: string
  comment?: string | null
  actorUserId: string
}

export type ReturnApprovalInstanceToStartParams = {
  instanceId: string
  comment: string
  actorUserId: string
}

export type ReturnApprovalInstanceToStepParams = {
  instanceId: string
  targetStep: number
  comment: string
  actorUserId: string
}

export type RejectApprovalInstanceParams = {
  instanceId: string
  comment: string
  actorUserId: string
}

export type CancelApprovalInstanceParams = {
  instanceId: string
  comment?: string | null
  actorUserId: string
}

const START_STEP_INDEX = 0
const START_STEP_NAME = '开始'

const mapBindingRecord = (
  record: ApprovalFlowBindingRecord | null
): ApprovalBindingSummary | null => {
  if (!record) return null
  return {
    id: record.id,
    projectId: record.projectId,
    subjectType: record.subjectType as ApprovalBindingSubjectType,
    subjectId: record.subjectId,
    subjectTable: record.subjectTable || null,
    subjectKey: record.subjectKey,
    definitionId: record.definitionId,
    templateId: record.templateId,
    currentInstanceId: record.currentInstanceId || null,
    currentRoundNo: record.currentRoundNo,
    status: record.status as ApprovalBindingStatus,
    metadata: (record.metadata as Record<string, unknown> | null) || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
}

const mapInstanceRecord = (
  record: ApprovalFlowInstanceRecord
): ApprovalInstanceSummary => ({
  id: record.id,
  bindingId: record.bindingId || '',
  roundNo: record.roundNo,
  status: record.status,
  currentStep: record.currentStep ?? null,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt
})

const getDefinitionResourceTypeForSubject = (
  subjectType: ApprovalBindingSubjectType
) => {
  if (subjectType === 'MODEL_VERSION') return 'MODEL'
  return 'FORMS'
}

const buildGenericSubjectSnapshot = (params: {
  subjectType: ApprovalBindingSubjectType
  subjectId: string
  subjectTable?: string | null
  projectId: string
}) => ({
  subjectType: params.subjectType,
  subjectId: params.subjectId,
  subjectTable: params.subjectTable || null,
  projectId: params.projectId
})

const getStepDueAt = (startedAt: Date, timeoutHours?: number | null) => {
  if (!timeoutHours || timeoutHours <= 0) return null
  return new Date(startedAt.getTime() + timeoutHours * 60 * 60 * 1000)
}

const toFlowSnapshot = (params: {
  templateId: string
  definitionId: string
  version: number
  name: string
  resourceType: string
  effectConfig: Record<string, unknown> | null
  formSchema: Array<Record<string, unknown>>
  steps: ApprovalFlowDefinitionStepRecord[]
}) => ({
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

const createApprovalInstanceWithSteps = async (params: {
  trx: Knex
  bindingId: string
  roundNo: number
  definition: {
    id: string
    templateId: string
    version: number
    name: string
    resourceType: string
    effectConfig?: Record<string, unknown> | null
    formSchema?: Array<Record<string, unknown>> | null
  }
  definitionSteps: ApprovalFlowDefinitionStepRecord[]
  projectId: string
  subjectKey: string
  subjectSnapshot: Record<string, unknown>
  formData?: Record<string, unknown> | null
  comment?: string | null
  actorUserId: string
}) => {
  const createInstance = createApprovalFlowInstanceFactory({ db: params.trx })
  const createInstanceStep = createApprovalFlowInstanceStepFactory({ db: params.trx })
  const insertAction = insertApprovalFlowActionFactory({ db: params.trx })

  const flowSnapshot = toFlowSnapshot({
    templateId: params.definition.templateId,
    definitionId: params.definition.id,
    version: params.definition.version,
    name: params.definition.name,
    resourceType: params.definition.resourceType,
    effectConfig:
      (params.definition.effectConfig as Record<string, unknown> | null) || null,
    formSchema:
      (params.definition.formSchema as Array<Record<string, unknown>> | null) || [],
    steps: params.definitionSteps
  })

  const instance = await createInstance({
    bindingId: params.bindingId,
    roundNo: params.roundNo,
    definitionId: null,
    templateId: params.definition.templateId,
    definitionVersion: params.definition.version,
    projectId: params.projectId,
    resourceType: params.definition.resourceType,
    resourceId: params.subjectKey,
    formData: params.formData || null,
    subjectSnapshot: params.subjectSnapshot,
    flowSnapshot,
    status: ApprovalFlowInstanceStatus.Pending,
    currentStep: 1,
    createdBy: params.actorUserId
  })

  const now = new Date()
  await createInstanceStep({
    instanceId: instance.id,
    definitionStepId: null,
    name: START_STEP_NAME,
    stepIndex: START_STEP_INDEX,
    status: ApprovalFlowStepStatus.Approved,
    approverIds: [params.actorUserId],
    requiredApprovals: 1,
    approvedByIds: [params.actorUserId],
    stepSnapshot: {
      definitionStepId: null,
      name: START_STEP_NAME,
      stepIndex: START_STEP_INDEX,
      approverIds: [params.actorUserId],
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

  for (let i = 0; i < params.definitionSteps.length; i++) {
    const step = params.definitionSteps[i]
    const isFirst = i === 0
    await createInstanceStep({
      instanceId: instance.id,
      definitionStepId: step.id,
      name: step.name,
      stepIndex: step.stepIndex,
      status: isFirst ? ApprovalFlowStepStatus.Pending : ApprovalFlowStepStatus.Waiting,
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

  await insertAction({
    instanceId: instance.id,
    action: ApprovalFlowActionType.Started,
    actorId: params.actorUserId,
    toStatus: ApprovalFlowInstanceStatus.Pending,
    comment: params.comment || null,
    metadata: {
      definitionVersion: params.definition.version,
      roundNo: params.roundNo,
      bindingId: params.bindingId
    }
  })

  return instance
}

const syncBindingStatusFromInstance = async (params: {
  trx: Knex
  instanceId: string
  updater: string
}) => {
  const getInstanceById = getApprovalFlowInstanceByIdFactory({ db: params.trx })
  const getBindingById = getApprovalFlowBindingRecordByIdFactory({ db: params.trx })
  const updateBinding = updateApprovalFlowBindingFactory({ db: params.trx })

  const instance = await getInstanceById({ id: params.instanceId })
  if (!instance) throw new NotFoundError('Approval instance not found')
  if (!instance.bindingId) return instance

  const binding = await getBindingById(instance.bindingId)
  if (!binding) throw new NotFoundError('Approval binding not found')

  const nextStatus =
    instance.status === ApprovalFlowInstanceStatus.Returned ||
    (instance.status === ApprovalFlowInstanceStatus.Pending &&
      instance.currentStep === START_STEP_INDEX)
      ? 'RETURNED'
      : instance.status === ApprovalFlowInstanceStatus.Approved
      ? 'APPROVED'
      : instance.status === ApprovalFlowInstanceStatus.Rejected
      ? 'REJECTED'
      : instance.status === ApprovalFlowInstanceStatus.Canceled
      ? 'CANCELED'
      : 'IN_REVIEW'

  await updateBinding({
    bindingId: binding.id,
    currentInstanceId: instance.id,
    currentRoundNo: instance.roundNo,
    status: nextStatus,
    lastReturnedAt:
      nextStatus === 'RETURNED' ? new Date() : binding.lastReturnedAt || null,
    lastReturnedBy:
      nextStatus === 'RETURNED' ? params.updater : binding.lastReturnedBy || null,
    finishedAt: nextStatus === 'IN_REVIEW' ? null : new Date(),
    updater: params.updater
  })

  return instance
}

export const syncBindingStatusFromInstanceFactory =
  (deps: { db: Knex }) =>
  async (params: { instanceId: string; updater: string }) => {
    return await syncBindingStatusFromInstance({
      trx: deps.db,
      instanceId: params.instanceId,
      updater: params.updater
    })
  }

export const getApprovalBindingBySubjectFactory =
  (deps: { db: Knex }) =>
  async (
    params: ApprovalBindingSubjectInput
  ): Promise<ApprovalBindingSummary | null> => {
    const getBindingBySubjectKey = getApprovalFlowBindingBySubjectKeyFactory({
      db: deps.db
    })
    const subjectKey = buildApprovalBindingSubjectKey({
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      subjectTable: params.subjectTable || null
    })
    const binding = await getBindingBySubjectKey(subjectKey)
    if (!binding || binding.projectId !== params.projectId) return null
    return mapBindingRecord(binding)
  }

export const getApprovalBindingByIdFactory =
  (deps: { db: Knex }) =>
  async (bindingId: string): Promise<ApprovalBindingSummary | null> => {
    const getBindingById = getApprovalFlowBindingRecordByIdFactory({ db: deps.db })
    return mapBindingRecord((await getBindingById(bindingId)) || null)
  }

export const listApprovalInstancesByBindingIdFactory =
  (deps: { db: Knex }) =>
  async (bindingId: string): Promise<ApprovalInstanceSummary[]> => {
    const listInstances = listApprovalFlowInstanceRecordsByBindingIdFactory({
      db: deps.db
    })
    const records = await listInstances(bindingId)
    return records.map(mapInstanceRecord)
  }

export const getApprovalInstanceDetailsFactory =
  (deps: { db: Knex }) =>
  async (instanceId: string): Promise<Record<string, unknown> | null> => {
    const getInstanceById = getApprovalFlowInstanceByIdFactory({ db: deps.db })
    const getSteps = getApprovalFlowInstanceStepsFactory({ db: deps.db })
    const getActions = getApprovalFlowActionsFactory({ db: deps.db })
    const getBindingById = getApprovalFlowBindingRecordByIdFactory({ db: deps.db })

    const instance = await getInstanceById({ id: instanceId })
    if (!instance) return null

    const [steps, actions, binding] = await Promise.all([
      getSteps(instanceId),
      getActions(instanceId),
      instance.bindingId ? getBindingById(instance.bindingId) : Promise.resolve(null)
    ])

    return {
      instance,
      binding,
      steps,
      actions
    }
  }

export const submitApprovalBindingFactory =
  (deps: { db: Knex }) =>
  async (params: SubmitApprovalBindingParams): Promise<ApprovalBindingSummary> => {
    let createdInstanceId: string | null = null
    const result = await deps.db.transaction(async (trx) => {
      const getBindingBySubjectKey = getApprovalFlowBindingBySubjectKeyFactory({
        db: trx
      })
      const createBinding = createApprovalFlowBindingFactory({ db: trx })
      const updateBinding = updateApprovalFlowBindingFactory({ db: trx })
      const getDefinitionById = getApprovalFlowDefinitionByIdFactory({ db: trx })
      const getDefinitionSteps = getApprovalFlowDefinitionStepsFactory({ db: trx })
      const subjectHandler = getApprovalSubjectHandler({
        subjectType: params.subjectType,
        subjectTable: params.subjectTable || null
      })

      const subjectKey = buildApprovalBindingSubjectKey({
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        subjectTable: params.subjectTable || null
      })
      const existingBinding = await getBindingBySubjectKey(subjectKey)
      if (existingBinding && existingBinding.status === 'IN_REVIEW') {
        throw new BadRequestError('There is already an active approval binding')
      }
      if (existingBinding) {
        throw new BadRequestError(
          'Approval binding already exists for subject, use resubmit for returned bindings'
        )
      }

      const definition = await getDefinitionById(params.definitionId)
      if (!definition) throw new NotFoundError('Approval flow definition not found')
      if (!definition.isActive) {
        throw new BadRequestError('Approval flow definition must be active')
      }

      const expectedResourceType = getDefinitionResourceTypeForSubject(
        params.subjectType
      )
      if (definition.resourceType !== expectedResourceType) {
        throw new BadRequestError(
          `Definition resourceType mismatch, expected ${expectedResourceType}`
        )
      }
      await subjectHandler.canSubmit({
        projectId: params.projectId,
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        subjectTable: params.subjectTable || null
      })

      const definitionSteps = await getDefinitionSteps(definition.id)
      if (!definitionSteps.length) {
        throw new BadRequestError('Approval flow definition has no steps')
      }

      const binding = await createBinding({
        projectId: params.projectId,
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        subjectTable: params.subjectTable || null,
        subjectKey,
        definitionId: definition.id,
        templateId: definition.templateId,
        currentInstanceId: null,
        currentRoundNo: 1,
        status: 'DRAFT',
        metadata: null,
        creator: params.actorUserId,
        updater: params.actorUserId
      })

      const subjectSnapshot =
        (await subjectHandler.getSubjectSnapshot({
          projectId: params.projectId,
          subjectType: params.subjectType,
          subjectId: params.subjectId,
          subjectTable: params.subjectTable || null
        })) ||
        buildGenericSubjectSnapshot({
          subjectType: params.subjectType,
          subjectId: params.subjectId,
          subjectTable: params.subjectTable || null,
          projectId: params.projectId
        })

      const instance = await createApprovalInstanceWithSteps({
        trx,
        bindingId: binding.id,
        roundNo: 1,
        definition: {
          id: definition.id,
          templateId: definition.templateId,
          version: definition.version,
          name: definition.name,
          resourceType: definition.resourceType,
          effectConfig:
            (definition.effectConfig as Record<string, unknown> | null) || null,
          formSchema:
            (definition.formSchema as Array<Record<string, unknown>> | null) || []
        },
        definitionSteps,
        projectId: params.projectId,
        subjectKey,
        subjectSnapshot,
        formData: params.formData || null,
        comment: params.comment || null,
        actorUserId: params.actorUserId
      })

      createdInstanceId = instance.id

      const updatedBinding = await updateBinding({
        bindingId: binding.id,
        currentInstanceId: instance.id,
        currentRoundNo: 1,
        status: 'IN_REVIEW',
        lastSubmittedAt: new Date(),
        lastSubmittedBy: params.actorUserId,
        updater: params.actorUserId
      })

      if (!updatedBinding) {
        throw new BadRequestError('Failed to update approval binding')
      }

      return mapBindingRecord(updatedBinding) as ApprovalBindingSummary
    })

    if (createdInstanceId) {
      scheduleApprovalFlowTodoSync({
        instanceId: createdInstanceId,
        reason: 'approval-flow-started'
      })
    }

    return result
  }

export const resubmitApprovalBindingFactory =
  (deps: { db: Knex }) =>
  async (params: ResubmitApprovalBindingParams): Promise<ApprovalBindingSummary> => {
    let createdInstanceId: string | null = null
    const result = await deps.db.transaction(async (trx) => {
      const getBindingById = getApprovalFlowBindingRecordByIdFactory({ db: trx })
      const updateBinding = updateApprovalFlowBindingFactory({ db: trx })
      const getDefinitionById = getApprovalFlowDefinitionByIdFactory({ db: trx })
      const getDefinitionSteps = getApprovalFlowDefinitionStepsFactory({ db: trx })

      const binding = await getBindingById(params.bindingId)
      if (!binding) throw new NotFoundError('Approval binding not found')
      if (binding.status !== 'RETURNED') {
        throw new BadRequestError('Only returned approval bindings can be resubmitted')
      }
      if (binding.lastSubmittedBy && binding.lastSubmittedBy !== params.actorUserId) {
        throw new BadRequestError('Only the last submitter can resubmit this binding')
      }
      const subjectHandler = getApprovalSubjectHandler({
        subjectType: binding.subjectType as ApprovalBindingSubjectType,
        subjectTable: binding.subjectTable || null
      })

      const definition = await getDefinitionById(binding.definitionId)
      if (!definition) throw new NotFoundError('Approval flow definition not found')
      if (!definition.isActive) {
        throw new BadRequestError('Approval flow definition must be active')
      }
      await subjectHandler.canResubmit({
        projectId: binding.projectId,
        subjectType: binding.subjectType as ApprovalBindingSubjectType,
        subjectId: binding.subjectId,
        subjectTable: binding.subjectTable || null
      })

      const definitionSteps = await getDefinitionSteps(definition.id)
      if (!definitionSteps.length) {
        throw new BadRequestError('Approval flow definition has no steps')
      }

      const roundNo = binding.currentRoundNo + 1
      const subjectSnapshot =
        (await subjectHandler.getSubjectSnapshot({
          projectId: binding.projectId,
          subjectType: binding.subjectType as ApprovalBindingSubjectType,
          subjectId: binding.subjectId,
          subjectTable: binding.subjectTable || null
        })) ||
        buildGenericSubjectSnapshot({
          subjectType: binding.subjectType as ApprovalBindingSubjectType,
          subjectId: binding.subjectId,
          subjectTable: binding.subjectTable || null,
          projectId: binding.projectId
        })

      const instance = await createApprovalInstanceWithSteps({
        trx,
        bindingId: binding.id,
        roundNo,
        definition: {
          id: definition.id,
          templateId: definition.templateId,
          version: definition.version,
          name: definition.name,
          resourceType: definition.resourceType,
          effectConfig:
            (definition.effectConfig as Record<string, unknown> | null) || null,
          formSchema:
            (definition.formSchema as Array<Record<string, unknown>> | null) || []
        },
        definitionSteps,
        projectId: binding.projectId,
        subjectKey: binding.subjectKey,
        subjectSnapshot,
        formData: params.formData || null,
        comment: params.comment || null,
        actorUserId: params.actorUserId
      })

      createdInstanceId = instance.id

      const updatedBinding = await updateBinding({
        bindingId: binding.id,
        currentInstanceId: instance.id,
        currentRoundNo: roundNo,
        status: 'IN_REVIEW',
        lastSubmittedAt: new Date(),
        lastSubmittedBy: params.actorUserId,
        updater: params.actorUserId
      })

      if (!updatedBinding) {
        throw new BadRequestError('Failed to update approval binding')
      }

      return mapBindingRecord(updatedBinding) as ApprovalBindingSummary
    })

    if (createdInstanceId) {
      scheduleApprovalFlowTodoSync({
        instanceId: createdInstanceId,
        reason: 'approval-flow-resubmitted'
      })
    }

    return result
  }

export const approveApprovalInstanceFactory =
  (deps: { db: Knex }) =>
  async (params: ApproveApprovalInstanceParams): Promise<Record<string, unknown>> => {
    return await deps.db.transaction(async (trx) => {
      const updateApprovalFlowStatus = updateApprovalFlowStatusFactory({ db: trx })
      await updateApprovalFlowStatus({
        instanceId: params.instanceId,
        userId: params.actorUserId,
        targetStatus: ApprovalFlowInstanceStatus.Approved,
        comment: params.comment || null
      })
      return await syncBindingStatusFromInstance({
        trx,
        instanceId: params.instanceId,
        updater: params.actorUserId
      })
    })
  }

export const returnApprovalInstanceToStartFactory =
  (deps: { db: Knex }) =>
  async (
    params: ReturnApprovalInstanceToStartParams
  ): Promise<Record<string, unknown>> => {
    const result = await deps.db.transaction(async (trx) => {
      const getInstanceById = getApprovalFlowInstanceByIdFactory({ db: trx })
      const getCurrentStep = getApprovalFlowCurrentStepFactory({ db: trx })
      const getSteps = getApprovalFlowInstanceStepsFactory({ db: trx })
      const updateStep = updateApprovalFlowInstanceStepFactory({ db: trx })
      const updateInstanceStatus = updateApprovalFlowInstanceStatusFactory({ db: trx })
      const insertAction = insertApprovalFlowActionFactory({ db: trx })

      const instance = await getInstanceById({ id: params.instanceId })
      if (!instance) throw new NotFoundError('Approval instance not found')
      if (instance.status !== ApprovalFlowInstanceStatus.Pending) {
        throw new BadRequestError('Only pending approval instances can return to start')
      }

      const currentStep = await getCurrentStep(params.instanceId)
      if (!currentStep) {
        throw new BadRequestError('Current approval step not found')
      }

      const steps = await getSteps(params.instanceId)
      const now = new Date()

      for (const step of steps) {
        if (step.stepIndex < currentStep.stepIndex) continue
        if (step.id === currentStep.id) {
          await updateStep({
            stepId: step.id,
            status: ApprovalFlowStepStatus.Rejected,
            completedAt: now
          })
          continue
        }

        if (
          step.status === ApprovalFlowStepStatus.Waiting ||
          step.status === ApprovalFlowStepStatus.Pending
        ) {
          await updateStep({
            stepId: step.id,
            status: ApprovalFlowStepStatus.Canceled,
            completedAt: now
          })
        }
      }

      const updatedInstance = await updateInstanceStatus({
        instanceId: params.instanceId,
        status: ApprovalFlowInstanceStatus.Returned,
        currentStep: START_STEP_INDEX
      })
      if (!updatedInstance) throw new BadRequestError('Approval instance not found')

      await insertAction({
        instanceId: params.instanceId,
        stepId: currentStep.id,
        action: ApprovalFlowActionType.ReturnedToStart,
        actorId: params.actorUserId,
        fromStatus: instance.status,
        toStatus: ApprovalFlowInstanceStatus.Returned,
        comment: params.comment,
        metadata: {
          targetStep: START_STEP_INDEX,
          targetType: 'START'
        }
      })

      const result = await syncBindingStatusFromInstance({
        trx,
        instanceId: params.instanceId,
        updater: params.actorUserId
      })

      return result
    })

    scheduleApprovalFlowTodoSync({
      instanceId: params.instanceId,
      reason: 'approval-flow-returned-to-start'
    })

    return result
  }

export const returnApprovalInstanceToStepFactory =
  (deps: { db: Knex }) =>
  async (
    params: ReturnApprovalInstanceToStepParams
  ): Promise<Record<string, unknown>> => {
    return await deps.db.transaction(async (trx) => {
      const updateApprovalFlowStatus = updateApprovalFlowStatusFactory({ db: trx })
      await updateApprovalFlowStatus({
        instanceId: params.instanceId,
        userId: params.actorUserId,
        targetStatus: ApprovalFlowInstanceStatus.Rejected,
        comment: params.comment,
        rollbackToStep: params.targetStep
      })
      const insertAction = insertApprovalFlowActionFactory({ db: trx })
      await insertAction({
        instanceId: params.instanceId,
        action: ApprovalFlowActionType.ReturnedToStep,
        actorId: params.actorUserId,
        fromStatus: ApprovalFlowInstanceStatus.Pending,
        toStatus: ApprovalFlowInstanceStatus.Pending,
        comment: params.comment,
        metadata: {
          targetStep: params.targetStep,
          targetType: 'STEP'
        }
      })
      return await syncBindingStatusFromInstance({
        trx,
        instanceId: params.instanceId,
        updater: params.actorUserId
      })
    })
  }

export const rejectApprovalInstanceFactory =
  (deps: { db: Knex }) =>
  async (params: RejectApprovalInstanceParams): Promise<Record<string, unknown>> => {
    return await deps.db.transaction(async (trx) => {
      const updateApprovalFlowStatus = updateApprovalFlowStatusFactory({ db: trx })
      await updateApprovalFlowStatus({
        instanceId: params.instanceId,
        userId: params.actorUserId,
        targetStatus: ApprovalFlowInstanceStatus.Rejected,
        comment: params.comment
      })
      return await syncBindingStatusFromInstance({
        trx,
        instanceId: params.instanceId,
        updater: params.actorUserId
      })
    })
  }

export const cancelApprovalInstanceFactory =
  (deps: { db: Knex }) =>
  async (params: CancelApprovalInstanceParams): Promise<Record<string, unknown>> => {
    return await deps.db.transaction(async (trx) => {
      const updateApprovalFlowStatus = updateApprovalFlowStatusFactory({ db: trx })
      await updateApprovalFlowStatus({
        instanceId: params.instanceId,
        userId: params.actorUserId,
        targetStatus: ApprovalFlowInstanceStatus.Canceled,
        comment: params.comment || null
      })
      return await syncBindingStatusFromInstance({
        trx,
        instanceId: params.instanceId,
        updater: params.actorUserId
      })
    })
  }
