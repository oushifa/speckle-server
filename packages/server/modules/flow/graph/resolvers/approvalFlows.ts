import { db } from '@/db/knex'
import type { Resolvers } from '@/modules/core/graph/generated/graphql'
import {
  ApprovalFlowInstanceStatus,
  ApprovalFlowStepStatus,
  countApprovalFlowInstancesFactory,
  getApprovalFlowActionsFactory,
  getApprovalFlowCurrentStepFactory,
  getApprovalFlowDefinitionByIdFactory,
  getApprovalFlowDefinitionsFactory,
  getApprovalFlowDefinitionStepsFactory,
  getApprovalFlowInstanceByIdFactory,
  getApprovalFlowInstancesFactory,
  getApprovalFlowInstanceStepsFactory,
  getApprovalFlowStatsFactory,
  setApprovalFlowDefinitionActiveStateFactory
} from '@/modules/flow/repositories/approvalFlows'
import {
  createApprovalFlowDefinitionWithStepsFactory,
  processApprovalFlowTimeoutsFactory,
  startApprovalFlowFactory,
  updateApprovalFlowStatusFactory
} from '@/modules/flow/services/approvalFlows'
import { BadRequestError } from '@/modules/shared/errors'
import type { GraphQLContext } from '@/modules/shared/helpers/typeHelper'
import {
  ApprovalFlowSubscriptions,
  filteredSubscribe,
  publish
} from '@/modules/shared/utils/subscriptions'

const ensureUserId = (ctx: GraphQLContext) => {
  if (!ctx.userId) throw new BadRequestError('Authentication required')
  return ctx.userId
}

const publishApprovalFlowTodoCountUpdated = async () => {
  await publish(ApprovalFlowSubscriptions.ApprovalFlowTodoCountUpdated, {
    approvalFlowTodoCountUpdated: {
      pendingForMeCount: 0
    }
  })
}

export default {
  Query: {
    async approvalFlowDefinitions(
      _parent: unknown,
      args: { resourceType?: string | null }
    ) {
      return await getApprovalFlowDefinitionsFactory({ db })({
        resourceType: args.resourceType || undefined
      })
    },
    async approvalFlowInstance(_parent: unknown, args: { id: string }) {
      return await getApprovalFlowInstanceByIdFactory({ db })({ id: args.id })
    },
    async approvalFlowInstances(
      _parent: unknown,
      args: { status?: string | null; cursor?: string | null; limit?: number | null }
    ) {
      const [totalCount, page] = await Promise.all([
        countApprovalFlowInstancesFactory({ db })({
          status: args.status || null,
          resourceType: null,
          resourceId: null
        }),
        getApprovalFlowInstancesFactory({ db })({
          status: args.status || null,
          resourceType: null,
          resourceId: null,
          cursor: args.cursor || null,
          limit: args.limit || null
        })
      ])
      return {
        totalCount,
        cursor: page.cursor,
        items: page.items
      }
    },
    async approvalFlowInstancesByResource(
      _parent: unknown,
      args: {
        resourceType: string
        resourceId: string
        status?: string | null
        cursor?: string | null
        limit?: number | null
      }
    ) {
      const [totalCount, page] = await Promise.all([
        countApprovalFlowInstancesFactory({ db })({
          status: args.status || null,
          resourceType: args.resourceType,
          resourceId: args.resourceId
        }),
        getApprovalFlowInstancesFactory({ db })({
          status: args.status || null,
          resourceType: args.resourceType,
          resourceId: args.resourceId,
          cursor: args.cursor || null,
          limit: args.limit || null
        })
      ])
      return {
        totalCount,
        cursor: page.cursor,
        items: page.items
      }
    },
    async approvalFlowStats(
      _parent: unknown,
      args: { rangeDays?: number | null },
      ctx: GraphQLContext
    ) {
      return await getApprovalFlowStatsFactory({ db })({
        rangeDays: args.rangeDays || 30,
        userId: ctx.userId || null
      })
    }
  },
  ApprovalFlowInstance: {
    async definition(parent: {
      definitionId?: string | null
      flowSnapshot?: Record<string, unknown> | null
    }) {
      if (parent.definitionId) {
        return await getApprovalFlowDefinitionByIdFactory({ db })(parent.definitionId)
      }
      const snapshot = parent.flowSnapshot
      if (!snapshot || typeof snapshot !== 'object') return null
      return {
        id: String(snapshot.definitionId || ''),
        templateId: String(snapshot.templateId || ''),
        name: String(snapshot.name || ''),
        resourceType: String(snapshot.resourceType || 'MODEL'),
        isActive: false,
        version: Number(snapshot.version || 1),
        previousVersionId: null,
        effectConfig:
          snapshot.effectConfig && typeof snapshot.effectConfig === 'object'
            ? snapshot.effectConfig
            : null,
        formSchema: Array.isArray(snapshot.formSchema) ? snapshot.formSchema : [],
        createdBy: 'system',
        createdAt: new Date(0),
        updatedAt: new Date(0),
        steps: Array.isArray(snapshot.steps) ? snapshot.steps : []
      }
    },
    async actions(parent: { id: string }) {
      return await getApprovalFlowActionsFactory({ db })(parent.id)
    },
    async steps(parent: { id: string }) {
      return await getApprovalFlowInstanceStepsFactory({ db })(parent.id)
    }
  },
  ApprovalFlowDefinition: {
    async steps(parent: { id: string; steps?: unknown[] }) {
      if (Array.isArray(parent.steps)) return parent.steps
      return await getApprovalFlowDefinitionStepsFactory({ db })(parent.id)
    },
    formSchema: (parent: {
      formSchema?: Array<{
        key: string
        name: string
        type: string
        required?: boolean
        placeholder?: string | null
        options?: Array<{ label: string; value: string }>
      }>
    }) =>
      (parent.formSchema || []).map((field) => ({
        ...field,
        required: Boolean(field.required),
        placeholder: field.placeholder || null,
        options: field.options || []
      }))
  },
  ApprovalFlowInstanceStep: {
    approvedByIds: (parent: { approvedByIds?: string[] }) => parent.approvedByIds || [],
    approverIds: (parent: { approverIds?: string[] }) => parent.approverIds || []
  },
  ApprovalFlowDefinitionStep: {
    approverIds: (parent: { approverIds?: string[] }) => parent.approverIds || []
  },
  ApprovalFlowAction: {
    async actor(parent: { actorId: string }, _args: unknown, ctx: GraphQLContext) {
      if (parent.actorId === 'system') return null
      return await ctx.loaders.users.getUser.load(parent.actorId)
    }
  },
  Subscription: {
    approvalFlowTodoCountUpdated: {
      subscribe: filteredSubscribe(
        ApprovalFlowSubscriptions.ApprovalFlowTodoCountUpdated,
        (_payload, _args, ctx) => !!ctx.userId
      )
    }
  },
  Mutation: {
    approvalMutations: () => ({})
  },
  ApprovalMutations: {
    async createDefinition(
      _parent: unknown,
      args: {
        input: {
          id?: string | null
          templateId?: string | null
          name: string
          resourceType?: string | null
          isActive?: boolean | null
          previousVersionId?: string | null
          effectConfig?: Record<string, unknown> | null
          formSchema?: Array<{
            key: string
            name: string
            type: string
            required?: boolean | null
            placeholder?: string | null
            options?: Array<{ label: string; value: string }> | null
          }> | null
          steps?: Array<{
            name: string
            approverIds?: string[] | null
            requiredApprovals?: number | null
            timeoutHours?: number | null
          }> | null
        }
      },
      ctx: GraphQLContext
    ) {
      const userId = ensureUserId(ctx)
      return await createApprovalFlowDefinitionWithStepsFactory({ db })({
        id: args.input.id?.trim() || null,
        templateId: args.input.templateId?.trim() || null,
        name: args.input.name.trim(),
        resourceType: args.input.resourceType || 'MODEL',
        isActive: args.input.isActive ?? true,
        previousVersionId: args.input.previousVersionId || null,
        effectConfig: args.input.effectConfig || null,
        formSchema:
          args.input.formSchema?.map((field) => ({
            key: field.key.trim(),
            name: field.name.trim(),
            type: field.type.trim(),
            required: Boolean(field.required),
            placeholder: field.placeholder?.trim() || null,
            options:
              field.options?.map((option) => ({
                label: option.label.trim(),
                value: option.value.trim()
              })) || []
          })) || [],
        steps:
          args.input.steps?.map((s) => ({
            name: s.name.trim(),
            approverIds: s.approverIds || [],
            requiredApprovals: s.requiredApprovals || 1,
            timeoutHours: s.timeoutHours || null
          })) || [],
        createdBy: userId
      })
    },
    async setDefinitionActive(
      _parent: unknown,
      args: { definitionId: string; isActive: boolean },
      ctx: GraphQLContext
    ) {
      ensureUserId(ctx)
      const definition = await setApprovalFlowDefinitionActiveStateFactory({ db })({
        definitionId: args.definitionId,
        isActive: args.isActive
      })
      if (!definition) throw new BadRequestError('Approval definition not found')
      return definition
    },
    async start(
      _parent: unknown,
      args: {
        input: {
          templateId?: string | null
          definitionId?: string | null
          projectId?: string | null
          resourceId?: string | null
          formData?: Record<string, unknown> | null
        }
      },
      ctx: GraphQLContext
    ) {
      const userId = ensureUserId(ctx)
      const instance = await startApprovalFlowFactory({ db })({
        templateId: args.input.templateId || null,
        definitionId: args.input.definitionId || null,
        projectId: args.input.projectId || null,
        resourceId: args.input.resourceId || null,
        formData: args.input.formData || null,
        userId
      })
      await publishApprovalFlowTodoCountUpdated()
      return instance
    },
    async approve(
      _parent: unknown,
      args: {
        input: {
          instanceId: string
          comment?: string | null
          nextStepApproverIds?: string[] | null
        }
      },
      ctx: GraphQLContext
    ) {
      const userId = ensureUserId(ctx)
      const currentStep = await getApprovalFlowCurrentStepFactory({ db })(
        args.input.instanceId
      )
      if (
        currentStep?.approverIds?.length &&
        !currentStep.approverIds.includes(userId)
      ) {
        throw new BadRequestError('Current user is not assigned to this step')
      }
      const instance = await updateApprovalFlowStatusFactory({ db })({
        instanceId: args.input.instanceId,
        userId,
        targetStatus: ApprovalFlowInstanceStatus.Approved,
        comment: args.input.comment,
        nextStepApproverIds: args.input.nextStepApproverIds || null
      })
      await publishApprovalFlowTodoCountUpdated()
      return instance
    },
    async reject(
      _parent: unknown,
      args: {
        input: {
          instanceId: string
          comment: string
          rollbackToStep?: number | null
        }
      },
      ctx: GraphQLContext
    ) {
      const userId = ensureUserId(ctx)
      const currentStep = await getApprovalFlowCurrentStepFactory({ db })(
        args.input.instanceId
      )
      if (
        currentStep?.approverIds?.length &&
        !currentStep.approverIds.includes(userId)
      ) {
        throw new BadRequestError('Current user is not assigned to this step')
      }
      const instance = await updateApprovalFlowStatusFactory({ db })({
        instanceId: args.input.instanceId,
        userId,
        targetStatus: ApprovalFlowInstanceStatus.Rejected,
        comment: args.input.comment,
        rollbackToStep: args.input.rollbackToStep || null
      })
      await publishApprovalFlowTodoCountUpdated()
      return instance
    },
    async cancel(
      _parent: unknown,
      args: { input: { instanceId: string; comment?: string | null } },
      ctx: GraphQLContext
    ) {
      const userId = ensureUserId(ctx)
      const currentStep = await getApprovalFlowCurrentStepFactory({ db })(
        args.input.instanceId
      )
      if (currentStep && currentStep.status !== ApprovalFlowStepStatus.Pending) {
        throw new BadRequestError('No active step to cancel')
      }
      const instance = await updateApprovalFlowStatusFactory({ db })({
        instanceId: args.input.instanceId,
        userId,
        targetStatus: ApprovalFlowInstanceStatus.Canceled,
        comment: args.input.comment
      })
      await publishApprovalFlowTodoCountUpdated()
      return instance
    },
    async processTimeouts(_parent: unknown, _args: unknown, ctx: GraphQLContext) {
      ensureUserId(ctx)
      const count = await processApprovalFlowTimeoutsFactory({ db })()
      if (count > 0) await publishApprovalFlowTodoCountUpdated()
      return count
    }
  }
} as unknown as Resolvers
