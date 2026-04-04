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
} from '@/modules/core/repositories/approvalFlows'
import {
  createApprovalFlowDefinitionWithStepsFactory,
  processApprovalFlowTimeoutsFactory,
  startApprovalFlowFactory,
  updateApprovalFlowStatusFactory
} from '@/modules/core/services/approvalFlows'
import { BadRequestError } from '@/modules/shared/errors'
import type { GraphQLContext } from '@/modules/shared/helpers/typeHelper'

const ensureUserId = (ctx: GraphQLContext) => {
  if (!ctx.userId) throw new BadRequestError('Authentication required')
  return ctx.userId
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
          status: args.status || null
        }),
        getApprovalFlowInstancesFactory({ db })({
          status: args.status || null,
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
    async approvalFlowStats(_parent: unknown, args: { rangeDays?: number | null }) {
      return await getApprovalFlowStatsFactory({ db })({
        rangeDays: args.rangeDays || 30
      })
    }
  },
  ApprovalFlowInstance: {
    async definition(parent: { definitionId: string }) {
      return await getApprovalFlowDefinitionByIdFactory({ db })(parent.definitionId)
    },
    async actions(parent: { id: string }) {
      return await getApprovalFlowActionsFactory({ db })(parent.id)
    },
    async steps(parent: { id: string }) {
      return await getApprovalFlowInstanceStepsFactory({ db })(parent.id)
    }
  },
  ApprovalFlowDefinition: {
    async steps(parent: { id: string }) {
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
  Mutation: {
    approvalMutations: () => ({})
  },
  ApprovalMutations: {
    async createDefinition(
      _parent: unknown,
      args: {
        input: {
          name: string
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
        name: args.input.name.trim(),
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
          definitionId: string
          resourceId?: string | null
          formData?: Record<string, unknown> | null
        }
      },
      ctx: GraphQLContext
    ) {
      const userId = ensureUserId(ctx)
      return await startApprovalFlowFactory({ db })({
        definitionId: args.input.definitionId,
        resourceId: args.input.resourceId || null,
        formData: args.input.formData || null,
        userId
      })
    },
    async approve(
      _parent: unknown,
      args: { input: { instanceId: string; comment?: string | null } },
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
      return await updateApprovalFlowStatusFactory({ db })({
        instanceId: args.input.instanceId,
        userId,
        targetStatus: ApprovalFlowInstanceStatus.Approved,
        comment: args.input.comment
      })
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
      return await updateApprovalFlowStatusFactory({ db })({
        instanceId: args.input.instanceId,
        userId,
        targetStatus: ApprovalFlowInstanceStatus.Rejected,
        comment: args.input.comment,
        rollbackToStep: args.input.rollbackToStep || null
      })
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
      return await updateApprovalFlowStatusFactory({ db })({
        instanceId: args.input.instanceId,
        userId,
        targetStatus: ApprovalFlowInstanceStatus.Canceled,
        comment: args.input.comment
      })
    },
    async processTimeouts(_parent: unknown, _args: unknown, ctx: GraphQLContext) {
      ensureUserId(ctx)
      return await processApprovalFlowTimeoutsFactory({ db })()
    }
  }
} as unknown as Resolvers
