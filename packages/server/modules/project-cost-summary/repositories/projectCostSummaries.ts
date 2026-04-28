import { BoqItems, Streams } from '@/modules/core/dbSchema'
import type { ProjectCostSummaryRecord } from '@/modules/core/helpers/types'
import { QualityAcceptanceForms } from '@/modules/core/dbSchema'
import type { Knex } from 'knex'

const TABLE_NAME = 'project_cost_summaries'

const tables = {
  projectCostSummaries: (db: Knex) => db<ProjectCostSummaryRecord>(TABLE_NAME)
}

const toAmount = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const normalizeTimeZone = (value?: string | null) => {
  if (!value) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return value
  } catch {
    return 'UTC'
  }
}

type SummaryRow = {
  projectId: string
  totalContractAmount: number | string
  completedAmount: number | string
  currentMonthCompletedAmount: number | string
  lastRecalculatedAt: Date
  createdAt: Date
  updatedAt: Date
}

const normalizeSummaryRow = (row: SummaryRow): ProjectCostSummaryRecord => ({
  projectId: row.projectId,
  totalContractAmount: toAmount(row.totalContractAmount),
  completedAmount: toAmount(row.completedAmount),
  currentMonthCompletedAmount: toAmount(row.currentMonthCompletedAmount),
  lastRecalculatedAt: row.lastRecalculatedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
})

export const getProjectCostSummaryFactory =
  (deps: { db: Knex }) => async (params: { projectId: string }) => {
    const row = (await tables
      .projectCostSummaries(deps.db)
      .where('projectId', params.projectId)
      .first()) as SummaryRow | undefined
    if (!row) return null
    return normalizeSummaryRow(row)
  }

export const listProjectCostSummariesFactory =
  (deps: { db: Knex }) => async (params?: { limit?: number; offset?: number }) => {
    const limit = Math.min(Math.max(params?.limit ?? 100, 1), 500)
    const offset = Math.max(params?.offset ?? 0, 0)
    const rows = (await tables
      .projectCostSummaries(deps.db)
      .orderBy('updatedAt', 'desc')
      .orderBy('projectId', 'desc')
      .limit(limit)
      .offset(offset)) as SummaryRow[]

    return rows.map(normalizeSummaryRow)
  }

export const upsertProjectCostSummaryFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    totalContractAmount: number
    completedAmount: number
    currentMonthCompletedAmount: number
  }) => {
    const now = new Date()
    const payload: ProjectCostSummaryRecord = {
      projectId: params.projectId,
      totalContractAmount: params.totalContractAmount,
      completedAmount: params.completedAmount,
      currentMonthCompletedAmount: params.currentMonthCompletedAmount,
      lastRecalculatedAt: now,
      createdAt: now,
      updatedAt: now
    }

    await tables
      .projectCostSummaries(deps.db)
      .insert(payload)
      .onConflict('projectId')
      .merge({
        totalContractAmount: params.totalContractAmount,
        completedAmount: params.completedAmount,
        currentMonthCompletedAmount: params.currentMonthCompletedAmount,
        lastRecalculatedAt: now,
        updatedAt: now
      })

    const saved = await getProjectCostSummaryFactory({ db: deps.db })({
      projectId: params.projectId
    })
    if (!saved) {
      throw new Error('Failed to load project cost summary after upsert')
    }
    return saved
  }

export const calculateProjectCostSummaryFactory =
  (deps: { db: Knex }) => async (params: { projectId: string }) => {
    const project = await deps
      .db(Streams.name)
      .select<{ timeZone: string | null }[]>(Streams.col.timeZone)
      .where(Streams.col.id, params.projectId)
      .first()
    const projectTimeZone = normalizeTimeZone(project?.timeZone)

    const [contractResult, completedResult, currentMonthCompletedResult] =
      await Promise.all([
        deps
          .db(BoqItems.name)
          .where(BoqItems.col.projectId, params.projectId)
          .andWhere(BoqItems.col.type, 'ITEM')
          .sum({
            totalContractAmount: deps.db.raw(
              `COALESCE(CAST(?? AS numeric), 0) * COALESCE(CAST(?? AS numeric), 0)`,
              [BoqItems.col.quantity, BoqItems.col.price]
            )
          })
          .first(),
        deps
          .db(QualityAcceptanceForms.name)
          .where(QualityAcceptanceForms.col.project_id, params.projectId)
          .andWhere(QualityAcceptanceForms.col.approveStatus, 'APPROVED')
          .leftJoin(BoqItems.name, (join) => {
            join
              .on(BoqItems.col.id, '=', QualityAcceptanceForms.col.boqItemId)
              .andOn(BoqItems.col.projectId, '=', QualityAcceptanceForms.col.project_id)
          })
          .sum({
            completedAmount: deps.db.raw(
              `COALESCE(CAST(?? AS numeric), 0) * COALESCE(CAST(?? AS numeric), 0)`,
              [QualityAcceptanceForms.col.workVolume, BoqItems.col.price]
            )
          })
          .first(),
        deps
          .db(QualityAcceptanceForms.name)
          .where(QualityAcceptanceForms.col.project_id, params.projectId)
          .andWhere(QualityAcceptanceForms.col.approveStatus, 'APPROVED')
          .andWhereRaw(
            `(?? AT TIME ZONE ?) >= date_trunc('month', now() AT TIME ZONE ?)`,
            [QualityAcceptanceForms.col.updatedAt, projectTimeZone, projectTimeZone]
          )
          .andWhereRaw(
            `(?? AT TIME ZONE ?) < (date_trunc('month', now() AT TIME ZONE ?) + interval '1 month')`,
            [QualityAcceptanceForms.col.updatedAt, projectTimeZone, projectTimeZone]
          )
          .leftJoin(BoqItems.name, (join) => {
            join
              .on(BoqItems.col.id, '=', QualityAcceptanceForms.col.boqItemId)
              .andOn(BoqItems.col.projectId, '=', QualityAcceptanceForms.col.project_id)
          })
          .sum({
            currentMonthCompletedAmount: deps.db.raw(
              `COALESCE(CAST(?? AS numeric), 0) * COALESCE(CAST(?? AS numeric), 0)`,
              [QualityAcceptanceForms.col.workVolume, BoqItems.col.price]
            )
          })
          .first()
      ])

    return {
      totalContractAmount: toAmount(contractResult?.totalContractAmount),
      completedAmount: toAmount(completedResult?.completedAmount),
      currentMonthCompletedAmount: toAmount(
        currentMonthCompletedResult?.currentMonthCompletedAmount
      )
    }
  }
