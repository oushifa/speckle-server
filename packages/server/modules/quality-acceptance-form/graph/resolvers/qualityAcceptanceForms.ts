import type { Resolvers } from '@/modules/core/graph/generated/graphql'
import { db } from '@/db/knex'
import { getBlobsFactory } from '@/modules/blobstorage/repositories'
import { getApprovalFlowDefinitionByIdFactory } from '@/modules/flow/repositories/approvalFlows'
import {
  countQualityAcceptanceFormsFactory,
  createQualityAcceptanceFormFactory,
  deleteQualityAcceptanceFormFactory,
  getQualityAcceptanceFormsFactory,
  updateQualityAcceptanceFormFactory
} from '@/modules/quality-acceptance-form/repositories/qualityAcceptanceForms'
import { startApprovalFlowFactory } from '@/modules/flow/services/approvalFlows'
import { BadRequestError } from '@/modules/shared/errors'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { throwIfAuthNotOk } from '@/modules/shared/helpers/errorHelper'
import type { GraphQLContext } from '@/modules/shared/helpers/typeHelper'
import { isNonNullable } from '@speckle/shared'
import cryptoRandomString from 'crypto-random-string'
import { keyBy } from 'lodash-es'

const QUALITY_ACCEPTANCE_FORM_TABLE = 'quality_acceptance_forms'

const resolvers = {
  QualityAcceptanceForm: {
    inspector: async (
      parent: { inspector?: string | null },
      _args: unknown,
      ctx: GraphQLContext
    ) => {
      if (!parent.inspector) return null
      return await ctx.loaders.users.getUser.load(parent.inspector)
    },
    inspectorId: (parent: { inspector?: string | null }) => parent.inspector || null,
    creator: async (
      parent: { creator?: string | null },
      _args: unknown,
      ctx: GraphQLContext
    ) => {
      if (!parent.creator) return null
      return await ctx.loaders.users.getUser.load(parent.creator)
    },
    creatorId: (parent: { creator?: string | null }) => parent.creator || null,
    projectId: (parent: { project_id?: string | null }) => parent.project_id || null,
    attachments: async (parent: {
      attachments?: string[] | null
      project_id?: string | null
    }) => {
      const blobIds = parent.attachments || []
      const projectId = parent.project_id
      if (!blobIds.length || !projectId) return []

      const projectDb = await getProjectDbClient({ projectId })
      const blobs = await getBlobsFactory({ db: projectDb })({
        blobIds,
        streamId: projectId
      })
      const blobsById = keyBy(blobs, (blob) => blob.id)
      return blobIds.map((blobId) => blobsById[blobId] || null).filter(isNonNullable)
    }
  },
  Project: {
    qualityAcceptanceForms: async (
      parent: { id: string },
      args: {
        input?: { search?: string | null; cursor?: string | null; limit?: number }
      },
      ctx: GraphQLContext
    ) => {
      const canRead = await ctx.authPolicies.project.canRead({
        projectId: parent.id,
        userId: ctx.userId
      })
      throwIfAuthNotOk(canRead)

      const projectDb = await getProjectDbClient({ projectId: parent.id })
      const [res, totalCount] = await Promise.all([
        getQualityAcceptanceFormsFactory({ db: projectDb })({
          projectId: parent.id,
          search: args.input?.search ?? null,
          cursor: args.input?.cursor ?? null,
          limit: args.input?.limit ?? 25
        }),
        countQualityAcceptanceFormsFactory({ db: projectDb })({
          projectId: parent.id,
          search: args.input?.search ?? null
        })
      ])

      return {
        totalCount,
        cursor: res.cursor,
        items: res.items
      }
    }
  },
  ProjectMutations: {
    qualityAcceptanceMutations: () => ({})
  },
  QualityAcceptanceMutations: {
    createForm: async (
      _parent: unknown,
      args: {
        input: {
          projectId: string
          flowId?: string | null
          name?: string | null
          code?: string | null
          inspectionLotNumber?: string | null
          acceptancePart?: string | null
          acceptanceContent?: string | null
          actualStartDate?: string | null
          actualFinishDate?: string | null
          inspector?: string | null
          attachments?: string[] | null
          workVolume?: number | null
          unit?: string | null
          BIMelement?: string[] | null
          timeZone?: string | null
          approveStatus?: number | null
        }
      },
      ctx: GraphQLContext
    ) => {
      const canUpdate = await ctx.authPolicies.project.canUpdate({
        projectId: args.input.projectId,
        userId: ctx.userId
      })
      throwIfAuthNotOk(canUpdate)
      if (!ctx.userId) throw new BadRequestError('Authentication required')
      const flowId = args.input.flowId?.trim()

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const now = new Date()
      const created = await createQualityAcceptanceFormFactory({ db: projectDb })({
        id: cryptoRandomString({ length: 10 }),
        name: args.input.name ?? null,
        code: args.input.code ?? null,
        inspectionLotNumber: args.input.inspectionLotNumber ?? null,
        acceptancePart: args.input.acceptancePart ?? null,
        acceptanceContent: args.input.acceptanceContent ?? null,
        actualStartDate: args.input.actualStartDate ?? null,
        actualFinishDate: args.input.actualFinishDate ?? null,
        inspector: args.input.inspector ?? null,
        attachments: args.input.attachments ?? null,
        creator: ctx.userId,
        ['project_id']: args.input.projectId,
        workVolume: args.input.workVolume ?? null,
        unit: args.input.unit ?? null,
        BIMelement: args.input.BIMelement ?? null,
        timeZone: args.input.timeZone ?? null,
        approveStatus: args.input.approveStatus ?? 0,
        createdAt: now,
        updatedAt: now
      })
      if (flowId) {
        const definition = await getApprovalFlowDefinitionByIdFactory({ db })(flowId)
        if (
          !definition ||
          !definition.isActive ||
          definition.resourceType !== 'FORMS'
        ) {
          throw new BadRequestError(
            'No active FORMS flow definition found for this form'
          )
        }
        try {
          await startApprovalFlowFactory({ db })({
            definitionId: flowId,
            resourceId: `${QUALITY_ACCEPTANCE_FORM_TABLE}:${created.id}`,
            formData: {
              formTable: QUALITY_ACCEPTANCE_FORM_TABLE,
              formId: created.id,
              projectId: args.input.projectId
            },
            userId: ctx.userId
          })
        } catch (e) {
          await deleteQualityAcceptanceFormFactory({ db: projectDb })(created.id)
          throw e
        }
      }
      return created
    },
    updateForm: async (
      _parent: unknown,
      args: {
        input: {
          projectId: string
          id: string
          name?: string | null
          code?: string | null
          inspectionLotNumber?: string | null
          acceptancePart?: string | null
          acceptanceContent?: string | null
          actualStartDate?: string | null
          actualFinishDate?: string | null
          inspector?: string | null
          attachments?: string[] | null
          workVolume?: number | null
          unit?: string | null
          BIMelement?: string[] | null
          timeZone?: string | null
          approveStatus?: number | null
        }
      },
      ctx: GraphQLContext
    ) => {
      const canUpdate = await ctx.authPolicies.project.canUpdate({
        projectId: args.input.projectId,
        userId: ctx.userId
      })
      throwIfAuthNotOk(canUpdate)

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const updated = await updateQualityAcceptanceFormFactory({ db: projectDb })(
        args.input.id,
        {
          name: args.input.name ?? null,
          code: args.input.code ?? null,
          inspectionLotNumber: args.input.inspectionLotNumber ?? null,
          acceptancePart: args.input.acceptancePart ?? null,
          acceptanceContent: args.input.acceptanceContent ?? null,
          actualStartDate: args.input.actualStartDate ?? null,
          actualFinishDate: args.input.actualFinishDate ?? null,
          inspector: args.input.inspector ?? null,
          attachments: args.input.attachments ?? null,
          ['project_id']: args.input.projectId,
          workVolume: args.input.workVolume ?? null,
          unit: args.input.unit ?? null,
          BIMelement: args.input.BIMelement ?? null,
          timeZone: args.input.timeZone ?? null,
          approveStatus: args.input.approveStatus ?? null
        }
      )
      if (!updated) throw new BadRequestError('Quality acceptance form not found')
      return updated
    },
    deleteForm: async (
      _parent: unknown,
      args: { input: { projectId: string; id: string } },
      ctx: GraphQLContext
    ) => {
      const canUpdate = await ctx.authPolicies.project.canUpdate({
        projectId: args.input.projectId,
        userId: ctx.userId
      })
      throwIfAuthNotOk(canUpdate)

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      return await deleteQualityAcceptanceFormFactory({ db: projectDb })(args.input.id)
    }
  }
} as unknown as Resolvers

export default resolvers
