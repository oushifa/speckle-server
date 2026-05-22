import type { Resolvers } from '@/modules/core/graph/generated/graphql'
import { db } from '@/db/knex'
import { getBlobsFactory } from '@/modules/blobstorage/repositories'
import {
  countQualityAcceptanceFormsFactory,
  deleteQualityAcceptanceFormFactory,
  getQualityAcceptanceFormsFactory,
  updateQualityAcceptanceFormFactory
} from '@/modules/quality-acceptance-form/repositories/qualityAcceptanceForms'
import { BadRequestError } from '@/modules/shared/errors'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { throwIfAuthNotOk } from '@/modules/shared/helpers/errorHelper'
import type { GraphQLContext } from '@/modules/shared/helpers/typeHelper'
import type { BimElements } from '@/modules/quality-acceptance-form/helpers/types'
import { adminOverrideEnabled } from '@/modules/shared/helpers/envHelper'
import { isNonNullable } from '@speckle/shared'
import { Roles } from '@speckle/shared'
import { keyBy } from 'lodash-es'
import { recalculateProjectCostSummaryFactory } from '@/modules/project-statistics/services/projectCostSummaries'
import {
  createQualityAcceptanceFormEntryFactory,
  importQualityAcceptanceFormsFactory,
  normalizeApproveStatus,
  normalizeBimElements
} from '@/modules/quality-acceptance-form/services/qualityAcceptanceForms'

const hasServerAdminOverride = (ctx: GraphQLContext) =>
  adminOverrideEnabled() && ctx.role === Roles.Server.Admin

type CreateQualityAcceptanceFormArgs = {
  projectId: string
  flowId?: string | null
  name?: string | null
  boqItemId?: string | null
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
  bimElements?: BimElements | null
  BIMelement?: string[] | null
  timeZone?: string | null
  approveStatus?: string | null
}

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
    bimElements: (parent: {
      bimElements?: BimElements | null
      BIMelement?: string[] | null
    }) => normalizeBimElements(parent.bimElements, parent.BIMelement),
    BIMelement: (parent: {
      bimElements?: BimElements | null
      BIMelement?: string[] | null
    }) => normalizeBimElements(parent.bimElements, parent.BIMelement)?.bimIds || null,
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
      if (!hasServerAdminOverride(ctx)) {
        const canRead = await ctx.authPolicies.project.canRead({
          projectId: parent.id,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canRead)
      }

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
      args: { input: CreateQualityAcceptanceFormArgs },
      ctx: GraphQLContext
    ) => {
      if (!hasServerAdminOverride(ctx)) {
        const canUpdate = await ctx.authPolicies.project.canRead({
          projectId: args.input.projectId,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canUpdate)
      }

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      if (!ctx.userId) throw new BadRequestError('Authentication required')
      const created = await createQualityAcceptanceFormEntryFactory({
        db,
        projectDb
      })({
        input: args.input,
        actorUserId: ctx.userId
      })
      await recalculateProjectCostSummaryFactory({ db: projectDb })({
        projectId: args.input.projectId
      })
      return created
    },
    importForms: async (
      _parent: unknown,
      args: {
        input: {
          projectId: string
          items: Array<
            Omit<CreateQualityAcceptanceFormArgs, 'projectId'> & { rowNumber: number }
          >
        }
      },
      ctx: GraphQLContext
    ) => {
      if (!hasServerAdminOverride(ctx)) {
        const canUpdate = await ctx.authPolicies.project.canRead({
          projectId: args.input.projectId,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canUpdate)
      }
      if (!ctx.userId) throw new BadRequestError('Authentication required')

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const result = await importQualityAcceptanceFormsFactory({
        db,
        projectDb
      })({
        projectId: args.input.projectId,
        items: args.input.items,
        actorUserId: ctx.userId
      })

      await recalculateProjectCostSummaryFactory({ db: projectDb })({
        projectId: args.input.projectId
      })

      return {
        createdCount: result.createdCount,
        failedCount: result.failedCount,
        failedRows: result.failedRows.map(
          (row) => `第 ${row.rowNumber} 行：${row.error}`
        )
      }
    },
    updateForm: async (
      _parent: unknown,
      args: {
        input: {
          projectId: string
          id: string
          name?: string | null
          boqItemId?: string | null
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
          bimElements?: BimElements | null
          BIMelement?: string[] | null
          timeZone?: string | null
          approveStatus?: string | null
        }
      },
      ctx: GraphQLContext
    ) => {
      if (!hasServerAdminOverride(ctx)) {
        const canUpdate = await ctx.authPolicies.project.canRead({
          projectId: args.input.projectId,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canUpdate)
      }

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const updated = await updateQualityAcceptanceFormFactory({ db: projectDb })(
        args.input.id,
        {
          name: args.input.name ?? null,
          boqItemId: args.input.boqItemId ?? null,
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
          bimElements: normalizeBimElements(
            args.input.bimElements ?? null,
            args.input.BIMelement ?? null
          ),
          timeZone: args.input.timeZone ?? null,
          approveStatus: normalizeApproveStatus(args.input.approveStatus)
        }
      )
      if (!updated) throw new BadRequestError('Quality acceptance form not found')
      await recalculateProjectCostSummaryFactory({ db: projectDb })({
        projectId: args.input.projectId
      })
      return updated
    },
    deleteForm: async (
      _parent: unknown,
      args: { input: { projectId: string; id: string } },
      ctx: GraphQLContext
    ) => {
      if (!hasServerAdminOverride(ctx)) {
        const canUpdate = await ctx.authPolicies.project.canRead({
          projectId: args.input.projectId,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canUpdate)
      }

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const deleted = await deleteQualityAcceptanceFormFactory({ db: projectDb })(
        args.input.id
      )
      await recalculateProjectCostSummaryFactory({ db: projectDb })({
        projectId: args.input.projectId
      })
      return deleted
    }
  }
} as unknown as Resolvers

export default resolvers
