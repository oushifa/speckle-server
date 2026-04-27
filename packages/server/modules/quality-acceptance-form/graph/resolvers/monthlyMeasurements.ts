import type { Resolvers } from '@/modules/core/graph/generated/graphql'
import { db } from '@/db/knex'
import {
  countMonthlyMeasurementsFactory,
  createMonthlyMeasurementFactory,
  deleteMonthlyMeasurementByIdFactory,
  deleteMonthlyMeasurementItemsByMeasurementIdFactory,
  getMonthlyMeasurementItemsFactory,
  getMonthlyMeasurementByIdForProjectFactory,
  getMonthlyMeasurementByProjectCodeFactory,
  getMonthlyMeasurementsFactory,
  getProjectBoqItemsFactory,
  getQualityAcceptanceFormsBeforeBaseDateFactory,
  insertMonthlyMeasurementItemsFactory,
  updateMonthlyMeasurementFactory
} from '@/modules/quality-acceptance-form/repositories/monthlyMeasurements'
import {
  buildMonthlyMeasurementPreviewFactory,
  createMonthlyMeasurementFromPreviewFactory,
  prepareMonthlyMeasurementSnapshotRows
} from '@/modules/quality-acceptance-form/services/monthlyMeasurements'
import { startApprovalFlowFactory } from '@/modules/flow/services/approvalFlows'
import { BadRequestError } from '@/modules/shared/errors'
import { throwIfAuthNotOk } from '@/modules/shared/helpers/errorHelper'
import type { GraphQLContext } from '@/modules/shared/helpers/typeHelper'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { adminOverrideEnabled } from '@/modules/shared/helpers/envHelper'
import { Roles } from '@speckle/shared'
import cryptoRandomString from 'crypto-random-string'
import type { MonthlyMeasurementItemRecord } from '@/modules/core/helpers/types'

const MONTHLY_MEASUREMENT_TABLE = 'monthly_measurements'
const MONTHLY_MEASUREMENT_CODE_UNIQUE = 'monthly_measurements_project_code_unique'
const MONTHLY_MEASUREMENT_SUBMIT_TEMPLATE = 'm_measure'
const hasServerAdminOverride = (ctx: GraphQLContext) =>
  adminOverrideEnabled() && ctx.role === Roles.Server.Admin

const isMonthlyMeasurementCodeUniqueViolation = (err: unknown) => {
  if (!err || typeof err !== 'object') return false
  const dbErr = err as { code?: string; constraint?: string; message?: string }
  if (dbErr.code === '23505' && dbErr.constraint === MONTHLY_MEASUREMENT_CODE_UNIQUE) {
    return true
  }
  return (
    (dbErr.message || '').includes('duplicate key value violates unique constraint') &&
    (dbErr.message || '').includes(MONTHLY_MEASUREMENT_CODE_UNIQUE)
  )
}

const isMeasurementSubmitted = (measurement: {
  flowInstanceId?: string | null
  approveStatus?: string | null
}) => {
  return Boolean(measurement.flowInstanceId || measurement.approveStatus)
}

const resolvers = {
  MonthlyMeasurement: {
    projectId: (parent: { project_id?: string | null }) => parent.project_id || null,
    creator: async (
      parent: { creator?: string | null },
      _args: unknown,
      ctx: GraphQLContext
    ) => {
      if (!parent.creator) return null
      return await ctx.loaders.users.getUser.load(parent.creator)
    },
    creatorId: (parent: { creator?: string | null }) => parent.creator || null,
    items: async (parent: { id: string; _projectDb?: unknown }) => {
      const projectDb = parent._projectDb as Awaited<
        ReturnType<typeof getProjectDbClient>
      >
      if (!projectDb) return []
      return await getMonthlyMeasurementItemsFactory({ db: projectDb })(parent.id)
    }
  },
  Project: {
    monthlyMeasurement: async (
      parent: { id: string },
      args: { id: string },
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
      const found = await getMonthlyMeasurementByIdForProjectFactory({
        db: projectDb
      })({
        measurementId: args.id,
        projectId: parent.id
      })
      if (!found) return null
      return {
        ...found,
        _projectDb: projectDb
      }
    },
    monthlyMeasurements: async (
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
        getMonthlyMeasurementsFactory({ db: projectDb })({
          projectId: parent.id,
          search: args.input?.search ?? null,
          cursor: args.input?.cursor ?? null,
          limit: args.input?.limit ?? 25
        }),
        countMonthlyMeasurementsFactory({ db: projectDb })({
          projectId: parent.id,
          search: args.input?.search ?? null
        })
      ])

      return {
        totalCount,
        cursor: res.cursor,
        items: res.items.map((item) => ({
          ...item,
          _projectDb: projectDb
        }))
      }
    }
  },
  ProjectMutations: {
    monthlyMeasurementMutations: () => ({})
  },
  MonthlyMeasurementMutations: {
    preview: async (
      _parent: unknown,
      args: { input: { projectId: string; baseDate: string } },
      ctx: GraphQLContext
    ) => {
      if (!hasServerAdminOverride(ctx)) {
        const canRead = await ctx.authPolicies.project.canRead({
          projectId: args.input.projectId,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canRead)
      }

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const buildPreview = buildMonthlyMeasurementPreviewFactory({
        getQualityAcceptanceFormsBeforeBaseDate:
          getQualityAcceptanceFormsBeforeBaseDateFactory({ db: projectDb }),
        getProjectBoqItems: getProjectBoqItemsFactory({ db: projectDb })
      })

      return await buildPreview({
        projectId: args.input.projectId,
        baseDate: Number(args.input.baseDate)
      })
    },
    create: async (
      _parent: unknown,
      args: {
        input: {
          projectId: string
          unit?: string | null
          code: string
          baseDate: string
          flowTemplateId?: string | null
          measuredItems?: Array<{
            boqItemId: string
            measuredQty?: number | null
            remark?: string | null
          }> | null
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
      const buildPreview = buildMonthlyMeasurementPreviewFactory({
        getQualityAcceptanceFormsBeforeBaseDate:
          getQualityAcceptanceFormsBeforeBaseDateFactory({ db: projectDb }),
        getProjectBoqItems: getProjectBoqItemsFactory({ db: projectDb })
      })
      const createMonthlyMeasurement = createMonthlyMeasurementFromPreviewFactory({
        buildPreview,
        createMeasurement: createMonthlyMeasurementFactory({ db: projectDb }),
        insertMeasurementItems: insertMonthlyMeasurementItemsFactory({ db: projectDb })
      })
      const trimmedCode = args.input.code.trim()
      const existing = await getMonthlyMeasurementByProjectCodeFactory({
        db: projectDb
      })({
        projectId: args.input.projectId,
        code: trimmedCode
      })
      if (existing) {
        throw new BadRequestError(`验工编号已存在：${trimmedCode}`)
      }

      let measurement: Awaited<
        ReturnType<typeof createMonthlyMeasurement>
      >['measurement']
      try {
        const created = await createMonthlyMeasurement({
          projectId: args.input.projectId,
          unit: args.input.unit ?? null,
          code: trimmedCode,
          baseDate: Number(args.input.baseDate),
          creator: ctx.userId || 'system',
          measuredItems: (args.input.measuredItems || []).map((item) => ({
            boqItemId: item.boqItemId,
            measuredQty: item.measuredQty ?? null,
            remark: item.remark ?? undefined
          }))
        })
        measurement = created.measurement
      } catch (err) {
        if (isMonthlyMeasurementCodeUniqueViolation(err)) {
          throw new BadRequestError(`验工编号已存在：${trimmedCode}`)
        }
        throw err
      }

      const flowTemplateId = args.input.flowTemplateId?.trim()
      if (flowTemplateId && ctx.userId) {
        const instance = await startApprovalFlowFactory({ db })({
          templateId: flowTemplateId,
          projectId: args.input.projectId,
          resourceId: `${MONTHLY_MEASUREMENT_TABLE}:${measurement.id}`,
          formData: {
            formTable: MONTHLY_MEASUREMENT_TABLE,
            formId: measurement.id,
            projectId: args.input.projectId
          },
          userId: ctx.userId
        })

        await updateMonthlyMeasurementFactory({ db: projectDb })(measurement.id, {
          flowInstanceId: instance.id
        })
      }

      return {
        ...measurement,
        _projectDb: projectDb
      }
    },
    update: async (
      _parent: unknown,
      args: {
        input: {
          projectId: string
          id: string
          unit?: string | null
          code: string
          baseDate: string
          measuredItems?: Array<{
            boqItemId: string
            measuredQty?: number | null
            remark?: string | null
          }> | null
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
      const existing = await getMonthlyMeasurementByIdForProjectFactory({
        db: projectDb
      })({
        measurementId: args.input.id,
        projectId: args.input.projectId
      })
      if (!existing) throw new BadRequestError('月度验工不存在')
      if (isMeasurementSubmitted(existing)) {
        throw new BadRequestError('送审后不可编辑')
      }

      const trimmedCode = args.input.code.trim()
      const dup = await getMonthlyMeasurementByProjectCodeFactory({ db: projectDb })({
        projectId: args.input.projectId,
        code: trimmedCode
      })
      if (dup && dup.id !== args.input.id) {
        throw new BadRequestError(`验工编号已存在：${trimmedCode}`)
      }

      const buildPreview = buildMonthlyMeasurementPreviewFactory({
        getQualityAcceptanceFormsBeforeBaseDate:
          getQualityAcceptanceFormsBeforeBaseDateFactory({ db: projectDb }),
        getProjectBoqItems: getProjectBoqItemsFactory({ db: projectDb })
      })
      const preview = await buildPreview({
        projectId: args.input.projectId,
        baseDate: Number(args.input.baseDate)
      })
      const rows = preview.items.filter(
        (item) => item.isSummaryRow || item.sourceAcceptanceIds.length
      )
      const selectedRows = prepareMonthlyMeasurementSnapshotRows(
        rows,
        (args.input.measuredItems || []).map((item) => ({ boqItemId: item.boqItemId }))
      )
      const leafRows = selectedRows.filter((item) => !item.isSummaryRow)
      if (!selectedRows.length || !leafRows.length) {
        throw new BadRequestError('未找到可生成验工明细的质量验收数据')
      }

      const customValues = new Map(
        (args.input.measuredItems || []).map((item) => [item.boqItemId, item])
      )
      const now = new Date()
      const nextItems: MonthlyMeasurementItemRecord[] = selectedRows.map((row) => {
        const custom = customValues.get(row.boqItemId)
        const measuredQty =
          row.isSummaryRow ||
          custom?.measuredQty === null ||
          custom?.measuredQty === undefined
            ? row.measuredQtyDefault
            : Number(custom.measuredQty)

        return {
          id: cryptoRandomString({ length: 10 }),
          measurementId: args.input.id,
          boqItemId: row.boqItemId,
          boqCode: row.boqCode,
          boqName: row.boqName,
          boqParentId: row.boqParentId,
          boqDepth: row.boqDepth,
          isSummaryRow: row.isSummaryRow,
          sortIndex: row.sortIndex,
          uom: row.uom,
          price: row.price,
          pendingTotalQty: row.pendingTotalQty,
          approvedCumulativeQty: row.approvedCumulativeQty,
          measuredQty: Number.isNaN(measuredQty) ? row.measuredQtyDefault : measuredQty,
          remark: row.isSummaryRow ? null : custom?.remark?.trim() || null,
          sourceAcceptanceIds: row.sourceAcceptanceIds,
          createdAt: now,
          updatedAt: now
        }
      })

      const updated = await projectDb.transaction(async (trx) => {
        const updatedMeasurement = await updateMonthlyMeasurementFactory({ db: trx })(
          args.input.id,
          {
            unit: args.input.unit?.trim() || null,
            code: trimmedCode,
            baseDate: String(args.input.baseDate)
          }
        )
        if (!updatedMeasurement) throw new BadRequestError('月度验工不存在')
        await deleteMonthlyMeasurementItemsByMeasurementIdFactory({ db: trx })(
          args.input.id
        )
        await insertMonthlyMeasurementItemsFactory({ db: trx })(nextItems)
        return updatedMeasurement
      })

      return {
        ...updated,
        _projectDb: projectDb
      }
    },
    delete: async (
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
      const existing = await getMonthlyMeasurementByIdForProjectFactory({
        db: projectDb
      })({
        measurementId: args.input.id,
        projectId: args.input.projectId
      })
      if (!existing) throw new BadRequestError('月度验工不存在')
      if (isMeasurementSubmitted(existing)) {
        throw new BadRequestError('送审后不可删除')
      }

      return await projectDb.transaction(async (trx) => {
        await deleteMonthlyMeasurementItemsByMeasurementIdFactory({ db: trx })(
          args.input.id
        )
        return await deleteMonthlyMeasurementByIdFactory({ db: trx })(args.input.id)
      })
    },
    submit: async (
      _parent: unknown,
      args: { input: { projectId: string; id: string; remark?: string | null } },
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
      const existing = await getMonthlyMeasurementByIdForProjectFactory({
        db: projectDb
      })({
        measurementId: args.input.id,
        projectId: args.input.projectId
      })
      if (!existing) throw new BadRequestError('月度验工不存在')
      if (isMeasurementSubmitted(existing)) {
        throw new BadRequestError('已送审，无需重复送审')
      }

      const instance = await startApprovalFlowFactory({ db })({
        templateId: MONTHLY_MEASUREMENT_SUBMIT_TEMPLATE,
        projectId: args.input.projectId,
        resourceId: `${MONTHLY_MEASUREMENT_TABLE}:${args.input.id}`,
        formData: {
          formTable: MONTHLY_MEASUREMENT_TABLE,
          formId: args.input.id,
          projectId: args.input.projectId
        },
        comment: args.input.remark?.trim() || null,
        userId: ctx.userId
      })

      const updated = await updateMonthlyMeasurementFactory({ db: projectDb })(
        args.input.id,
        {
          flowInstanceId: instance.id,
          approveStatus: 'PENDING'
        }
      )
      if (!updated) throw new BadRequestError('月度验工不存在')
      return {
        ...updated,
        _projectDb: projectDb
      }
    }
  }
} as unknown as Resolvers

export default resolvers
