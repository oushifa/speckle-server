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
  setApprovalFlowDefinitionActiveStateFactory,
  updateApprovalFlowInstanceStepFactory
} from '@/modules/flow/repositories/approvalFlows'
import {
  createApprovalFlowDefinitionWithStepsFactory,
  reactivateApprovalFlowFactory,
  resetApprovalFlowToUnsubmittedFactory,
  processApprovalFlowTimeoutsFactory,
  startApprovalFlowFactory,
  updateApprovalFlowStatusFactory
} from '@/modules/flow/services/approvalFlows'
import { syncBindingStatusFromInstanceFactory } from '@/modules/flow/services/approvalBindings'
import { BadRequestError } from '@/modules/shared/errors'
import type { GraphQLContext } from '@/modules/shared/helpers/typeHelper'
import { throwForNotHavingServerRole } from '@/modules/shared/authz'
import { Roles } from '@speckle/shared'
import {
  ApprovalFlowSubscriptions,
  filteredSubscribe,
  publish
} from '@/modules/shared/utils/subscriptions'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'

const normalizeApprovalFlowResourceType = (resourceType?: string | null) => {
  if (resourceType === 'MODEL') return 'MODEL'
  // Legacy values (e.g. QUALITY_ACCEPTANCE_FORM) are treated as FORMS
  return 'FORMS'
}

const ensureUserId = (ctx: GraphQLContext) => {
  if (!ctx.userId) throw new BadRequestError('Authentication required')
  return ctx.userId
}

const isServerAdmin = (ctx: GraphQLContext) => ctx.role === Roles.Server.Admin

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
      const definitions = await getApprovalFlowDefinitionsFactory({ db })({
        resourceType: args.resourceType || undefined
      })
      return definitions.map((definition) => ({
        ...definition,
        resourceType: normalizeApprovalFlowResourceType(definition.resourceType)
      }))
    },
    async approvalFlowInstance(_parent: unknown, args: { id: string }) {
      return await getApprovalFlowInstanceByIdFactory({ db })({ id: args.id })
    },
    async approvalFlowInstances(
      _parent: unknown,
      args: {
        status?: string | null
        cursor?: string | null
        limit?: number | null
        scope?: 'ALL' | 'TODO' | 'INITIATED' | 'HANDLED' | null
      },
      ctx: GraphQLContext
    ) {
      const [totalCount, page] = await Promise.all([
        countApprovalFlowInstancesFactory({ db })({
          status: args.status || null,
          resourceType: null,
          resourceId: null,
          scope: args.scope || 'ALL',
          userId: ctx.userId || null
        }),
        getApprovalFlowInstancesFactory({ db })({
          status: args.status || null,
          resourceType: null,
          resourceId: null,
          cursor: args.cursor || null,
          limit: args.limit || null,
          scope: args.scope || 'ALL',
          userId: ctx.userId || null
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
    async project(
      parent: { projectId?: string | null },
      _args: unknown,
      ctx: GraphQLContext
    ) {
      if (!parent.projectId) return null
      return await ctx.loaders.streams.getStream.load(parent.projectId)
    },
    async model(
      parent: {
        projectId?: string | null
        resourceType?: string | null
        resourceId?: string | null
      },
      _args: unknown,
      ctx: GraphQLContext
    ) {
      if (!parent.projectId) return null
      if (parent.resourceType !== 'MODEL' || !parent.resourceId) return null

      const projectDB = await getProjectDbClient({ projectId: parent.projectId })
      let branch = await ctx.loaders
        .forRegion({ db: projectDB })
        .branches.getById.load(parent.resourceId)
      if (!branch) {
        branch = await ctx.loaders
          .forRegion({ db: projectDB })
          .commits.getCommitBranch.load(parent.resourceId)
      }
      return branch
    },
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
        resourceType: normalizeApprovalFlowResourceType(
          String(snapshot.resourceType || 'MODEL')
        ),
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
    async createdByUser(
      parent: { createdBy?: string | null },
      _args: unknown,
      ctx: GraphQLContext
    ) {
      if (!parent.createdBy || parent.createdBy === 'system') return null
      return await ctx.loaders.users.getUser.load(parent.createdBy)
    },
    async actions(parent: { id: string }) {
      return await getApprovalFlowActionsFactory({ db })(parent.id)
    },
    async steps(parent: { id: string }) {
      return await getApprovalFlowInstanceStepsFactory({ db })(parent.id)
    }
  },
  ApprovalFlowDefinition: {
    resourceType: (parent: { resourceType?: string | null }) =>
      normalizeApprovalFlowResourceType(parent.resourceType),
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
    approverIds: (parent: { approverIds?: string[] }) => parent.approverIds || [],
    async approvers(
      parent: { approverIds?: string[] },
      _args: unknown,
      ctx: GraphQLContext
    ) {
      const approverIds = parent.approverIds || []
      if (!approverIds.length) return []
      return await Promise.all(
        approverIds.map((id) => ctx.loaders.users.getUser.load(id))
      )
    },
    async approvedBy(
      parent: { approvedByIds?: string[] },
      _args: unknown,
      ctx: GraphQLContext
    ) {
      const approvedByIds = parent.approvedByIds || []
      if (!approvedByIds.length) return []
      return await Promise.all(
        approvedByIds.map((id) => ctx.loaders.users.getUser.load(id))
      )
    }
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
          comment?: string | null
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
        comment: args.input.comment?.trim() || null,
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
          forceByAdmin?: boolean | null
        }
      },
      ctx: GraphQLContext
    ) {
      const userId = ensureUserId(ctx)
      const forceByAdmin = Boolean(args.input.forceByAdmin)
      if (forceByAdmin && !isServerAdmin(ctx)) {
        throw new BadRequestError('Only server admin can force operation')
      }
      if (forceByAdmin && !args.input.comment?.trim()) {
        throw new BadRequestError('Forced operation requires a comment')
      }
      const currentStep = await getApprovalFlowCurrentStepFactory({ db })(
        args.input.instanceId
      )
      if (
        currentStep?.approverIds?.length &&
        !currentStep.approverIds.includes(userId) &&
        !forceByAdmin
      ) {
        throw new BadRequestError('Current user is not assigned to this step')
      }
      const instance = await updateApprovalFlowStatusFactory({ db })({
        instanceId: args.input.instanceId,
        userId,
        targetStatus: ApprovalFlowInstanceStatus.Approved,
        comment: args.input.comment,
        nextStepApproverIds: args.input.nextStepApproverIds || null,
        forceByAdmin
      })
      await syncBindingStatusFromInstanceFactory({ db })({
        instanceId: args.input.instanceId,
        updater: userId
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
          forceByAdmin?: boolean | null
        }
      },
      ctx: GraphQLContext
    ) {
      const userId = ensureUserId(ctx)
      const forceByAdmin = Boolean(args.input.forceByAdmin)
      if (forceByAdmin && !isServerAdmin(ctx)) {
        throw new BadRequestError('Only server admin can force operation')
      }
      if (forceByAdmin && !args.input.comment?.trim()) {
        throw new BadRequestError('Forced operation requires a comment')
      }
      const currentStep = await getApprovalFlowCurrentStepFactory({ db })(
        args.input.instanceId
      )
      if (
        currentStep?.approverIds?.length &&
        !currentStep.approverIds.includes(userId) &&
        !forceByAdmin
      ) {
        throw new BadRequestError('Current user is not assigned to this step')
      }
      const instance = await updateApprovalFlowStatusFactory({ db })({
        instanceId: args.input.instanceId,
        userId,
        targetStatus: ApprovalFlowInstanceStatus.Rejected,
        comment: args.input.comment,
        rollbackToStep: args.input.rollbackToStep ?? null,
        forceByAdmin
      })
      await syncBindingStatusFromInstanceFactory({ db })({
        instanceId: args.input.instanceId,
        updater: userId
      })
      await publishApprovalFlowTodoCountUpdated()
      return instance
    },
    async cancel(
      _parent: unknown,
      args: {
        input: {
          instanceId: string
          comment?: string | null
          forceByAdmin?: boolean | null
        }
      },
      ctx: GraphQLContext
    ) {
      const userId = ensureUserId(ctx)
      const forceByAdmin = Boolean(args.input.forceByAdmin)
      if (forceByAdmin && !isServerAdmin(ctx)) {
        throw new BadRequestError('Only server admin can force operation')
      }
      if (forceByAdmin && !args.input.comment?.trim()) {
        throw new BadRequestError('Forced operation requires a comment')
      }
      const currentStep = await getApprovalFlowCurrentStepFactory({ db })(
        args.input.instanceId
      )
      if (
        currentStep &&
        currentStep.status !== ApprovalFlowStepStatus.Pending &&
        !forceByAdmin
      ) {
        throw new BadRequestError('No active step to cancel')
      }
      const instance = await updateApprovalFlowStatusFactory({ db })({
        instanceId: args.input.instanceId,
        userId,
        targetStatus: ApprovalFlowInstanceStatus.Canceled,
        comment: args.input.comment,
        forceByAdmin
      })
      await syncBindingStatusFromInstanceFactory({ db })({
        instanceId: args.input.instanceId,
        updater: userId
      })
      await publishApprovalFlowTodoCountUpdated()
      return instance
    },
    async reactivate(
      _parent: unknown,
      args: {
        input: { instanceId: string; targetStep: number; comment: string }
      },
      ctx: GraphQLContext
    ) {
      const userId = ensureUserId(ctx)
      await throwForNotHavingServerRole(ctx, Roles.Server.Admin)
      const instance = await reactivateApprovalFlowFactory({ db })({
        instanceId: args.input.instanceId,
        targetStep: args.input.targetStep,
        userId,
        comment: args.input.comment.trim()
      })
      await publishApprovalFlowTodoCountUpdated()
      return instance
    },
    async resetToUnsubmitted(
      _parent: unknown,
      args: { input: { instanceId: string; comment: string } },
      ctx: GraphQLContext
    ) {
      const userId = ensureUserId(ctx)
      await throwForNotHavingServerRole(ctx, Roles.Server.Admin)
      const instance = await resetApprovalFlowToUnsubmittedFactory({ db })({
        instanceId: args.input.instanceId,
        userId,
        comment: args.input.comment.trim()
      })
      await publishApprovalFlowTodoCountUpdated()
      return instance
    },
    async processTimeouts(_parent: unknown, _args: unknown, ctx: GraphQLContext) {
      ensureUserId(ctx)
      const count = await processApprovalFlowTimeoutsFactory({ db })()
      if (count > 0) await publishApprovalFlowTodoCountUpdated()
      return count
    },
    async transferAssignee(
      _parent: unknown,
      args: {
        input: {
          instanceIds: string[]
          assigneeId: string
          comment?: string | null
        }
      },
      ctx: GraphQLContext
    ) {
      ensureUserId(ctx)
      await throwForNotHavingServerRole(ctx, Roles.Server.Admin)

      const uniqueInstanceIds = Array.from(
        new Set((args.input.instanceIds || []).filter((id) => !!id))
      )
      if (!uniqueInstanceIds.length) return 0

      let transferredCount = 0
      for (const instanceId of uniqueInstanceIds) {
        const instance = await getApprovalFlowInstanceByIdFactory({ db })({
          id: instanceId
        })
        if (!instance || instance.status !== ApprovalFlowInstanceStatus.Pending)
          continue

        const currentStep = await getApprovalFlowCurrentStepFactory({ db })(instanceId)
        if (!currentStep || currentStep.status !== ApprovalFlowStepStatus.Pending)
          continue

        await updateApprovalFlowInstanceStepFactory({ db })({
          stepId: currentStep.id,
          approverIds: [args.input.assigneeId]
        })
        transferredCount++
      }

      if (transferredCount > 0) await publishApprovalFlowTodoCountUpdated()
      return transferredCount
    }
  }
} as unknown as Resolvers
