import { Router } from 'express'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import { corsMiddlewareFactory } from '@/modules/core/configs/cors'
import {
  streamReadPermissionsPipelineFactory,
  streamWritePermissionsPipelineFactory
} from '@/modules/shared/authz'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { db } from '@/db/knex'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  getPaginatedProjectModelsItemsFactory,
  getPaginatedProjectModelsTotalCountFactory
} from '@/modules/core/repositories/branches'
import {
  getUserStreamsCountFactory,
  getUserStreamsPageFactory
} from '@/modules/core/repositories/streams'
import {
  getOrRecalculateProjectCostSummaryFactory,
  recalculateProjectCostSummaryFactory
} from '@/modules/project-statistics/services/projectCostSummaries'
import { moduleAuthLoaders } from '@/modules/index'
import { Authz } from '@speckle/shared'

const toNumber = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const toCount = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const clampLimit = (value: unknown) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 25
  return Math.min(Math.max(Math.floor(num), 1), 100)
}

const getQueryString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const parseBooleanQuery = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return undefined

  const lowered = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'y'].includes(lowered)) return true
  if (['0', 'false', 'no', 'n'].includes(lowered)) return false
  return undefined
}

const parseStringArrayQuery = (value: unknown): string[] | undefined => {
  if (!value) return undefined
  const rawItems = Array.isArray(value) ? value : [value]
  const items = rawItems
    .flatMap((item) =>
      typeof item === 'string' ? item.split(',').map((sub) => sub.trim()) : []
    )
    .filter((item) => !!item)
  return items.length ? items : undefined
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

type CostSummaryStatsResponse = {
  projectCount: number
  totalContractAmount: number
  completedAmount: number
  currentMonthCompletedAmount: number
  pendingAmount: number
}

export const projectCostSummaryRouterFactory = (): Router => {
  const app = Router()
  const getUserStreams = getUserStreamsPageFactory({ db })
  const getUserStreamsCount = getUserStreamsCountFactory({ db })

  app.options('/api/v1/projects', corsMiddlewareFactory())
  app.get('/api/v1/projects', corsMiddlewareFactory(), async (req, res) => {
    if (!req.context.auth || !req.context.userId) {
      return res.status(401).send({
        error: 'You must be authenticated to list projects.'
      })
    }

    const limit = clampLimit(req.query.limit)
    const cursor = getQueryString(req.query.cursor) || undefined
    const search = getQueryString(req.query.search) || undefined
    const workspaceId = getQueryString(req.query.workspaceId) || undefined
    const userId = req.context.userId

    const [totalCount, page] = await Promise.all([
      getUserStreamsCount({
        userId,
        forOtherUser: false,
        searchQuery: search,
        workspaceId,
        onlyWithActiveSsoSession: true
      }),
      getUserStreams({
        userId,
        forOtherUser: false,
        searchQuery: search,
        workspaceId,
        onlyWithActiveSsoSession: true,
        limit,
        cursor
      })
    ])

    return res.status(200).send({
      totalCount,
      limit,
      cursor: page.cursor,
      items: page.streams.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        visibility: project.visibility,
        workspaceId: project.workspaceId,
        role: project.role || null,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }))
    })
  })

  app.options('/api/v1/projects/:projectId/models', corsMiddlewareFactory())
  app.get(
    '/api/v1/projects/:projectId/models',
    corsMiddlewareFactory(),
    authMiddlewareCreator(
      streamReadPermissionsPipelineFactory({
        getStream: getStreamFactory({ db })
      })
    ),
    async (req, res) => {
      const projectId = req.params.projectId
      const projectDb = await getProjectDbClient({ projectId })
      const getPaginatedProjectModelsItems = getPaginatedProjectModelsItemsFactory({
        db: projectDb
      })
      const getPaginatedProjectModelsTotalCount = getPaginatedProjectModelsTotalCountFactory(
        { db: projectDb }
      )

      const limit = clampLimit(req.query.limit)
      const cursor = getQueryString(req.query.cursor) || undefined
      const search = getQueryString(req.query.search)
      const contributors = parseStringArrayQuery(req.query.contributors)
      const sourceApps = parseStringArrayQuery(req.query.sourceApps)
      const onlyWithVersions = parseBooleanQuery(req.query.onlyWithVersions)

      const filter = {
        ...(search ? { search } : {}),
        ...(contributors?.length ? { contributors } : {}),
        ...(sourceApps?.length ? { sourceApps } : {}),
        ...(onlyWithVersions !== undefined ? { onlyWithVersions } : {})
      }

      const [itemsResult, totalCount] = await Promise.all([
        getPaginatedProjectModelsItems(projectId, {
          limit,
          cursor,
          filter
        }),
        getPaginatedProjectModelsTotalCount(projectId, {
          filter
        })
      ])

      return res.status(200).send({
        totalCount,
        limit,
        cursor: itemsResult.cursor,
        items: itemsResult.items.map((model) => ({
          id: model.id,
          projectId: model.streamId,
          name: model.name,
          description: model.description,
          authorId: model.authorId,
          createdAt: model.createdAt,
          updatedAt: model.updatedAt
        }))
      })
    }
  )

  app.options('/api/stream/cost-summary', corsMiddlewareFactory())
  app.get('/api/stream/cost-summary', corsMiddlewareFactory(), async (req, res) => {
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

  app.options('/api/stream/cost-summary/stats', corsMiddlewareFactory())
  app.get(
    '/api/stream/cost-summary/stats',
    corsMiddlewareFactory(),
    async (req, res) => {
      if (!req.context.auth || !req.context.userId) {
        return res.status(401).send({
          error: 'You must be authenticated to list project cost summaries.'
        })
      }

      const projectIdQuery = req.query.projectId
      const projectId =
        typeof projectIdQuery === 'string' && projectIdQuery.trim()
          ? projectIdQuery.trim()
          : null

      const authLoaders = await moduleAuthLoaders({ dataLoaders: undefined })
      const policies = Authz.authPoliciesFactory(authLoaders.loaders)

      const projectIds: string[] = []
      if (projectId) {
        const canRead = await policies.project.canRead({
          userId: req.context.userId,
          projectId
        })
        if (canRead.isErr) {
          return res.status(403).send({
            error: 'You are not allowed to read this project.'
          })
        }
        projectIds.push(projectId)
      } else {
        const streamRows = await db('streams').select<{ id: string }[]>('id')
        for (const row of streamRows) {
          const canRead = await policies.project.canRead({
            userId: req.context.userId,
            projectId: row.id
          })
          if (canRead.isErr) continue
          projectIds.push(row.id)
        }
      }

      const totals: CostSummaryStatsResponse = {
        projectCount: projectIds.length,
        totalContractAmount: 0,
        completedAmount: 0,
        currentMonthCompletedAmount: 0,
        pendingAmount: 0
      }

      for (const id of projectIds) {
        const projectDb = await getProjectDbClient({ projectId: id })
        const summary = await getOrRecalculateProjectCostSummaryFactory({
          db: projectDb
        })({
          projectId: id
        })
        const totalContractAmount = toNumber(summary.totalContractAmount)
        const completedAmount = toNumber(summary.completedAmount)
        const currentMonthCompletedAmount = toNumber(
          summary.currentMonthCompletedAmount
        )
        totals.totalContractAmount += totalContractAmount
        totals.completedAmount += completedAmount
        totals.currentMonthCompletedAmount += currentMonthCompletedAmount
        totals.pendingAmount += Math.max(totalContractAmount - completedAmount, 0)
      }

      return res.status(200).send(totals)
    }
  )

  app.options('/api/stream/:streamId/cost-summary', corsMiddlewareFactory())
  app.get(
    '/api/stream/:streamId/cost-summary',
    corsMiddlewareFactory(),
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

  app.options('/api/stream/:streamId/cost-summary/recalculate', corsMiddlewareFactory())
  app.post(
    '/api/stream/:streamId/cost-summary/recalculate',
    corsMiddlewareFactory(),
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

  app.options('/api/dashboard', corsMiddlewareFactory())
  app.get('/api/dashboard', corsMiddlewareFactory(), async (req, res) => {
    if (!req.context.auth || !req.context.userId) {
      return res.status(401).send({
        error: 'You must be authenticated to view dashboard statistics.'
      })
    }

    const projectIdQuery = req.query.projectId
    const projectId =
      typeof projectIdQuery === 'string' && projectIdQuery.trim()
        ? projectIdQuery.trim()
        : null

    const authLoaders = await moduleAuthLoaders({ dataLoaders: undefined })
    const policies = Authz.authPoliciesFactory(authLoaders.loaders)

    let projectIds: string[] = []
    if (projectId) {
      const canRead = await policies.project.canRead({
        userId: req.context.userId,
        projectId
      })
      if (canRead.isErr) {
        return res.status(403).send({
          error: 'You are not allowed to read this project.'
        })
      }
      projectIds = [projectId]
    } else {
      const streamRows = await db('streams').select<{ id: string }[]>('id')
      for (const row of streamRows) {
        const canRead = await policies.project.canRead({
          userId: req.context.userId,
          projectId: row.id
        })
        if (canRead.isErr) continue
        projectIds.push(row.id)
      }
    }

    let modelCount = 0
    let boqCount = 0
    let qualityAcceptanceCount = 0
    let workValuationCount = 0

    for (const id of projectIds) {
      const projectDb = await getProjectDbClient({ projectId: id })
      const [modelRow, boqRow, qualityRow, valuationRow] = await Promise.all([
        projectDb('branches').count<{ count: string }>('* as count').first(),
        projectDb('boq_items').count<{ count: string }>('* as count').first(),
        projectDb('quality_acceptance_forms')
          .count<{ count: string }>('* as count')
          .first(),
        projectDb('monthly_measurements').count<{ count: string }>('* as count').first()
      ])

      modelCount += toCount(modelRow?.count)
      boqCount += toCount(boqRow?.count)
      qualityAcceptanceCount += toCount(qualityRow?.count)
      workValuationCount += toCount(valuationRow?.count)
    }

    return res.status(200).send({
      projectCount: projectIds.length,
      modelCount,
      boqCount,
      qualityAcceptanceCount,
      workValuationCount
    })
  })
  return app
}
