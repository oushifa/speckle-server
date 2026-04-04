import {
  ApprovalFlowActionType,
  ApprovalFlowInstanceStatus,
  ApprovalFlowStepStatus,
  createApprovalFlowDefinitionFactory,
  createApprovalFlowDefinitionStepFactory,
  createApprovalFlowInstanceFactory,
  createApprovalFlowInstanceStepFactory,
  getApprovalFlowCurrentStepFactory,
  getApprovalFlowDefinitionByIdFactory,
  getApprovalFlowDefinitionStepsFactory,
  getApprovalFlowTimedOutStepsFactory,
  getApprovalFlowInstanceByIdFactory,
  getApprovalFlowInstanceStepsFactory,
  getLatestApprovalFlowDefinitionVersionFactory,
  getOpenApprovalFlowInstanceForResourceFactory,
  insertApprovalFlowActionFactory,
  setApprovalFlowDefinitionActiveStateFactory,
  updateApprovalFlowInstanceStepFactory,
  updateApprovalFlowInstanceStatusFactory
} from '@/modules/core/repositories/approvalFlows'
import { updateBranchFactory } from '@/modules/core/repositories/branches'
import { BadRequestError } from '@/modules/shared/errors'
import type { Knex } from 'knex'

const getStepDueAt = (startedAt: Date, timeoutHours?: number | null) => {
  if (!timeoutHours) return null
  return new Date(startedAt.getTime() + timeoutHours * 60 * 60 * 1000)
}

const shouldSyncModelApproveStatus = (effectConfig: Record<string, unknown> | null) =>
  Boolean(effectConfig?.syncModelApproveStatus)

const syncModelApproveStatus = async (params: {
  trx: Knex
  definitionEffectConfig: Record<string, unknown> | null
  resourceType: string
  resourceId?: string | null
  approveStatus: string
}) => {
  if (!shouldSyncModelApproveStatus(params.definitionEffectConfig)) return
  if (params.resourceType !== 'MODEL') return
  if (!params.resourceId) return
  await updateBranchFactory({ db: params.trx })(params.resourceId, {
    approveStatus: params.approveStatus
  })
}

export const createApprovalFlowDefinitionWithStepsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    name: string
    isActive?: boolean
    previousVersionId?: string | null
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
      const getLatestVersion = getLatestApprovalFlowDefinitionVersionFactory({
        db: trx
      })

      const nextVersion =
        (await getLatestVersion({
          resourceType: 'MODEL'
        })) + 1

      const definition = await createApprovalFlowDefinitionFactory({ db: trx })({
        name: params.name,
        resourceType: 'MODEL',
        isActive: params.isActive ?? true,
        version: nextVersion,
        previousVersionId: params.previousVersionId || null,
        triggerConfig: null,
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

      if (params.previousVersionId && params.isActive === false) {
        await setApprovalFlowDefinitionActiveStateFactory({ db: trx })({
          definitionId: params.previousVersionId,
          isActive: false
        })
      }

      return definition
    })
  }

export const startApprovalFlowFactory =
  (deps: { db: Knex }) =>
  async (params: {
    definitionId: string
    resourceId?: string | null
    formData?: Record<string, unknown> | null
    userId: string
  }) => {
    return await deps.db.transaction(async (trx) => {
      const getOpenInstanceForResource = getOpenApprovalFlowInstanceForResourceFactory({
        db: trx
      })
      const getDefinitionById = getApprovalFlowDefinitionByIdFactory({ db: trx })
      const createInstance = createApprovalFlowInstanceFactory({ db: trx })
      const getDefinitionSteps = getApprovalFlowDefinitionStepsFactory({ db: trx })
      const createInstanceStep = createApprovalFlowInstanceStepFactory({ db: trx })
      const insertAction = insertApprovalFlowActionFactory({ db: trx })

      const definition = await getDefinitionById(params.definitionId)

      if (!definition) {
        throw new BadRequestError('Approval flow definition not found')
      }
      if (!definition.isActive) {
        throw new BadRequestError('Approval flow definition is inactive')
      }
      const existingInstance = await getOpenInstanceForResource({
        resourceType: definition.resourceType,
        resourceId: params.resourceId || null
      })
      if (existingInstance) {
        throw new BadRequestError('There is already an open approval instance')
      }

      const definitionSteps = await getDefinitionSteps(definition.id)
      if (!definitionSteps.length) {
        throw new BadRequestError('Approval flow definition has no steps')
      }

      const instance = await createInstance({
        definitionId: definition.id,
        resourceType: definition.resourceType,
        resourceId: params.resourceId || null,
        formData: params.formData || null,
        status: ApprovalFlowInstanceStatus.Pending,
        currentStep: 1,
        createdBy: params.userId
      })

      const now = new Date()
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
          startedAt: isFirst ? now : null,
          dueAt: isFirst ? getStepDueAt(now, step.timeoutHours) : null
        })
      }

      await insertAction({
        instanceId: instance.id,
        action: ApprovalFlowActionType.Started,
        actorId: params.userId,
        toStatus: ApprovalFlowInstanceStatus.Pending,
        metadata: {
          definitionVersion: definition.version
        }
      })

      await syncModelApproveStatus({
        trx,
        definitionEffectConfig:
          (definition.effectConfig as Record<string, unknown> | null) || null,
        resourceType: instance.resourceType,
        resourceId: instance.resourceId,
        approveStatus: ApprovalFlowInstanceStatus.Pending
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
  }) => {
    return await deps.db.transaction(async (trx) => {
      const getInstanceById = getApprovalFlowInstanceByIdFactory({ db: trx })
      const getCurrentStep = getApprovalFlowCurrentStepFactory({ db: trx })
      const getSteps = getApprovalFlowInstanceStepsFactory({ db: trx })
      const updateStatus = updateApprovalFlowInstanceStatusFactory({ db: trx })
      const updateStep = updateApprovalFlowInstanceStepFactory({ db: trx })
      const getDefinitionById = getApprovalFlowDefinitionByIdFactory({ db: trx })
      const insertAction = insertApprovalFlowActionFactory({ db: trx })

      const instance = await getInstanceById({
        id: params.instanceId
      })
      if (!instance) throw new BadRequestError('Approval instance not found')
      const definition = await getDefinitionById(instance.definitionId)
      if (!definition) throw new BadRequestError('Approval definition not found')
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
        !currentStep.approverIds.includes(params.userId)
      ) {
        throw new BadRequestError('Current user is not assigned to this approval step')
      }

      const nextApprovedBy = Array.from(
        new Set([...(currentStep.approvedByIds || []), params.userId])
      )
      if (params.targetStatus === ApprovalFlowInstanceStatus.Approved) {
        if (nextApprovedBy.length >= currentStep.requiredApprovals) {
          await updateStep({
            stepId: currentStep.id,
            status: ApprovalFlowStepStatus.Approved,
            approvedByIds: nextApprovedBy,
            completedAt: new Date()
          })
          const allSteps = await getSteps(params.instanceId)
          const nextStep = allSteps.find(
            (s) => s.stepIndex === currentStep.stepIndex + 1
          )
          if (nextStep) {
            const now = new Date()
            await updateStep({
              stepId: nextStep.id,
              status: ApprovalFlowStepStatus.Pending,
              startedAt: now,
              dueAt: getStepDueAt(now, null)
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
          params.rollbackToStep &&
          params.rollbackToStep > 0
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
            params.rollbackToStep &&
            params.rollbackToStep > 0
          ? ApprovalFlowInstanceStatus.Pending
          : params.targetStatus

      const updatedInstance = await updateStatus({
        instanceId: params.instanceId,
        status: finalStatus,
        currentStep:
          refreshedSteps.find((s) => s.status === ApprovalFlowStepStatus.Pending)
            ?.stepIndex || instance.currentStep
      })
      if (!updatedInstance) throw new BadRequestError('Approval instance not found')

      await insertAction({
        instanceId: params.instanceId,
        stepId: currentStep.id,
        action:
          finalStatus === ApprovalFlowInstanceStatus.Approved
            ? ApprovalFlowActionType.Approved
            : finalStatus === ApprovalFlowInstanceStatus.Rejected
            ? ApprovalFlowActionType.Rejected
            : ApprovalFlowActionType.Canceled,
        actorId: params.userId,
        fromStatus: instance.status,
        toStatus: finalStatus,
        comment: params.comment || null
      })

      if (finalStatus === ApprovalFlowInstanceStatus.Pending) {
        await syncModelApproveStatus({
          trx,
          definitionEffectConfig:
            (definition.effectConfig as Record<string, unknown> | null) || null,
          resourceType: instance.resourceType,
          resourceId: instance.resourceId,
          approveStatus: ApprovalFlowInstanceStatus.Pending
        })
      } else if (finalStatus === ApprovalFlowInstanceStatus.Approved) {
        await syncModelApproveStatus({
          trx,
          definitionEffectConfig:
            (definition.effectConfig as Record<string, unknown> | null) || null,
          resourceType: instance.resourceType,
          resourceId: instance.resourceId,
          approveStatus: ApprovalFlowInstanceStatus.Approved
        })
      } else if (finalStatus === ApprovalFlowInstanceStatus.Rejected) {
        await syncModelApproveStatus({
          trx,
          definitionEffectConfig:
            (definition.effectConfig as Record<string, unknown> | null) || null,
          resourceType: instance.resourceType,
          resourceId: instance.resourceId,
          approveStatus: ApprovalFlowInstanceStatus.Rejected
        })
      }

      return updatedInstance
    })
  }

export const processApprovalFlowTimeoutsFactory = (deps: { db: Knex }) => async () => {
  return await deps.db.transaction(async (trx) => {
    const getTimedOutSteps = getApprovalFlowTimedOutStepsFactory({ db: trx })
    const getInstanceById = getApprovalFlowInstanceByIdFactory({ db: trx })
    const getDefinitionById = getApprovalFlowDefinitionByIdFactory({ db: trx })
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
      const definition = await getDefinitionById(instance.definitionId)
      if (!definition) continue

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
      await syncModelApproveStatus({
        trx,
        definitionEffectConfig:
          (definition.effectConfig as Record<string, unknown> | null) || null,
        resourceType: instance.resourceType,
        resourceId: instance.resourceId,
        approveStatus: ApprovalFlowInstanceStatus.Rejected
      })
      affectedCount += 1
    }
    return affectedCount
  })
}
