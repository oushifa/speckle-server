import { Router } from 'express'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import {
  streamReadPermissionsPipelineFactory,
  streamWritePermissionsPipelineFactory
} from '@/modules/shared/authz'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { db } from '@/db/knex'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  getOrRecalculateProjectCostSummaryFactory,
  recalculateProjectCostSummaryFactory
} from '@/modules/project-cost-summary/services/projectCostSummaries'
import { moduleAuthLoaders } from '@/modules/index'
import { Authz } from '@speckle/shared'

const toNumber = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const clampLimit = (value: unknown) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 25
  return Math.min(Math.max(Math.floor(num), 1), 100)
}

type ProjectListCursor = {
  updatedAt: string
  id: string
}

const encodeCursor = (cursor: ProjectListCursor) =>
  Buffer.from(JSON.stringify(cursor)).toString('base64url')

const decodeCursor = (value: unknown): ProjectListCursor | null => {
  if (!value || typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      updatedAt?: unknown
      id?: unknown
    }
    if (typeof parsed.updatedAt !== 'string' || typeof parsed.id !== 'string')
      return null
    return {
      updatedAt: parsed.updatedAt,
      id: parsed.id
    }
  } catch {
    return null
  }
}

const toResponse = (
  projectId: string,
  projectName: string | null,
  summary: {
    totalContractAmount: number | string
    completedAmount: number | string
    currentMonthCompletedAmount: number | string
    lastRecalculatedAt: Date
    updatedAt: Date
  }
) => {
  const totalContractAmount = toNumber(summary.totalContractAmount)
  const completedAmount = toNumber(summary.completedAmount)
  const currentMonthCompletedAmount = toNumber(summary.currentMonthCompletedAmount)
  const completionRate =
    totalContractAmount > 0 ? completedAmount / totalContractAmount : 0

  return {
    projectId,
    projectName,
    totalContractAmount,
    completedAmount,
    currentMonthCompletedAmount,
    completionRate,
    lastRecalculatedAt: summary.lastRecalculatedAt,
    updatedAt: summary.updatedAt
  }
}

export const projectCostSummaryRouterFactory = (): Router => {
  const app = Router()

  app.get('/api/stream/cost-summary', async (req, res) => {
    if (!req.context.auth || !req.context.userId) {
      return res.status(401).send({
        error: 'You must be authenticated to list project cost summaries.'
      })
    }

    const limit = clampLimit(req.query.limit)
    const cursor = decodeCursor(req.query.cursor)

    const authLoaders = await moduleAuthLoaders({ dataLoaders: undefined })
    const policies = Authz.authPoliciesFactory(authLoaders.loaders)
    const items: ReturnType<typeof toResponse>[] = []
    let nextCursor: string | null = null
    let pageCursor = cursor

    // Scan streams in batches, then filter by canRead to keep pagination stable after auth filter.
    while (items.length < limit) {
      const remaining = limit - items.length
      const batchSize = Math.min(Math.max(remaining * 3, 30), 200)

      const query = db('streams')
        .select<{ id: string; name: string | null; updatedAt: Date }[]>(
          'id',
          'name',
          'updatedAt'
        )
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
        .limit(batchSize)

      if (pageCursor) {
        query.andWhereRaw('(??, ??) < (?, ?)', [
          'updatedAt',
          'id',
          pageCursor.updatedAt,
          pageCursor.id
        ])
      }

      const projectRows = await query
      if (!projectRows.length) {
        nextCursor = null
        break
      }

      for (const row of projectRows) {
        const canRead = await policies.project.canRead({
          userId: req.context.userId,
          projectId: row.id
        })
        if (canRead.isErr) continue
        const projectDb = await getProjectDbClient({ projectId: row.id })
        const summary = await getOrRecalculateProjectCostSummaryFactory({
          db: projectDb
        })({
          projectId: row.id
        })
        items.push(toResponse(row.id, row.name, summary))
        if (items.length >= limit) {
          nextCursor = encodeCursor({
            updatedAt: row.updatedAt.toISOString(),
            id: row.id
          })
          break
        }
      }

      if (items.length >= limit) break

      const lastRow = projectRows[projectRows.length - 1]
      pageCursor = {
        updatedAt: lastRow.updatedAt.toISOString(),
        id: lastRow.id
      }
      nextCursor = encodeCursor(pageCursor)

      if (projectRows.length < batchSize) {
        // Source exhausted
        nextCursor = null
        break
      }
    }

    return res.status(200).send({
      items,
      limit,
      cursor: nextCursor
    })
  })

  app.get(
    '/api/stream/:streamId/cost-summary',
    authMiddlewareCreator(
      streamReadPermissionsPipelineFactory({
        getStream: getStreamFactory({ db })
      })
    ),
    async (req, res) => {
      const projectId = req.params.streamId
      const projectDb = await getProjectDbClient({ projectId })
      const summary = await getOrRecalculateProjectCostSummaryFactory({
        db: projectDb
      })({
        projectId
      })
      return res.status(200).send(toResponse(projectId, null, summary))
    }
  )

  app.post(
    '/api/stream/:streamId/cost-summary/recalculate',
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream: getStreamFactory({ db })
      })
    ),
    async (req, res) => {
      const projectId = req.params.streamId
      const projectDb = await getProjectDbClient({ projectId })
      const summary = await recalculateProjectCostSummaryFactory({ db: projectDb })({
        projectId
      })
      return res.status(200).send(toResponse(projectId, null, summary))
    }
  )

  return app
}
