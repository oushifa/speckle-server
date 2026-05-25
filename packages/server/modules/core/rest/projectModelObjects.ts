import type { NextFunction, Request, Response, Router } from 'express'
import { corsMiddlewareFactory } from '@/modules/core/configs/cors'
import { ensureError } from '@speckle/shared'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import { streamReadPermissionsPipelineFactory } from '@/modules/shared/authz'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { db } from '@/db/knex'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  getBranchLatestCommitsFactory,
  getProjectModelByIdFactory
} from '@/modules/core/repositories/branches'
import {
  getFormattedObjectFactory,
  getObjectChildrenFactory,
  getObjectChildrenQueryFactory,
  getObjectFactory
} from '@/modules/core/repositories/objects'

const route = '/api/v1/projects/:projectId/models/:modelId/objects'

type ObjectChildrenQueryParams = Parameters<
  ReturnType<typeof getObjectChildrenQueryFactory>
>[0]

const projectModelObjectsErrHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!err) return next()
  const error = ensureError(err)
  const status = resolveStatusCode(error)
  res.status(status).json({ error: error.message })
}

const clampLimit = (value: unknown) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 25
  return Math.min(Math.max(Math.floor(num), 1), 100)
}

const parseDepth = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error('depth must be a positive number')
  }
  return Math.floor(num)
}

const getQueryString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
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

const parseJsonQueryParam = <T>(value: unknown, label: string): T | undefined => {
  const raw = getQueryString(value)
  if (!raw) return undefined

  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`${label} must be a valid JSON string`)
  }
}

const getObjectClosure = (data: unknown): Record<string, unknown> => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  const closure = (data as Record<string, unknown>).__closure
  if (!closure || typeof closure !== 'object' || Array.isArray(closure)) return {}
  return closure as Record<string, unknown>
}

const isObjectInModelTree = (rootObjectId: string, rootObjectData: unknown, objectId: string) =>
  objectId === rootObjectId ||
  Object.prototype.hasOwnProperty.call(getObjectClosure(rootObjectData), objectId)

const formatObjectResponse = (object: {
  id: string
  speckleType?: string | null
  createdAt?: Date | null
  totalChildrenCount?: number | null
  data?: unknown
}) => ({
  id: object.id,
  speckleType: object.speckleType || null,
  createdAt: object.createdAt || null,
  totalChildrenCount: object.totalChildrenCount || 0,
  data: object.data || null
})

const assertValidObjectQuery = (
  query: ObjectChildrenQueryParams['query']
): ObjectChildrenQueryParams['query'] => {
  if (!query) return undefined
  if (!Array.isArray(query)) {
    throw new Error('query must be a JSON array')
  }

  query.forEach((statement) => {
    if (
      !statement ||
      typeof statement !== 'object' ||
      typeof statement.field !== 'string' ||
      typeof statement.operator !== 'string'
    ) {
      throw new Error(
        'query items must include field, operator and value. Example: [{"field":"category","operator":"=","value":"Door"}]'
      )
    }
  })

  return query
}

const assertValidOrderBy = (
  orderBy: ObjectChildrenQueryParams['orderBy']
): ObjectChildrenQueryParams['orderBy'] => {
  if (!orderBy) return undefined
  if (
    typeof orderBy !== 'object' ||
    Array.isArray(orderBy) ||
    typeof orderBy.field !== 'string'
  ) {
    throw new Error(
      'orderBy must be a JSON object. Example: {"field":"createdAt","direction":"desc"}'
    )
  }

  if (orderBy.direction !== 'asc' && orderBy.direction !== 'desc') {
    throw new Error('orderBy.direction must be either "asc" or "desc"')
  }

  return orderBy
}

const getModelLatestVersionContext = async ({
  projectId,
  modelId
}: {
  projectId: string
  modelId: string
}) => {
  const projectDb = await getProjectDbClient({ projectId })
  const getProjectModelById = getProjectModelByIdFactory({ db: projectDb })
  const getBranchLatestCommits = getBranchLatestCommitsFactory({ db: projectDb })
  const getObject = getObjectFactory({ db: projectDb })

  const [model, latestVersion] = await Promise.all([
    getProjectModelById({ projectId, modelId }),
    getBranchLatestCommits([modelId], undefined, { limit: 1 }).then((items) => items[0])
  ])

  if (!model) {
    return {
      projectDb,
      model: null,
      latestVersion: null,
      rootObject: null
    }
  }

  if (!latestVersion?.referencedObject) {
    return {
      projectDb,
      model,
      latestVersion: null,
      rootObject: null
    }
  }

  const rootObject = await getObject(latestVersion.referencedObject, projectId)
  if (!rootObject) {
    throw new Error('Latest version referenced root object not found')
  }

  return {
    projectDb,
    model,
    latestVersion,
    rootObject
  }
}

export default (app: Router) => {
  const readProjectPermission = authMiddlewareCreator(
    streamReadPermissionsPipelineFactory({
      getStream: getStreamFactory({ db })
    })
  )

  app.options(route, corsMiddlewareFactory())
  app.options(`${route}/:objectId`, corsMiddlewareFactory())

  app.get(route, corsMiddlewareFactory(), readProjectPermission, async (req, res, next) => {
    try {
      const { projectId, modelId } = req.params
      const limit = clampLimit(req.query.limit)
      const cursor = getQueryString(req.query.cursor)
      const depth = parseDepth(req.query.depth)
      const select = parseStringArrayQuery(req.query.select)
      const query = assertValidObjectQuery(
        parseJsonQueryParam<ObjectChildrenQueryParams['query']>(req.query.query, 'query')
      )
      const orderBy = assertValidOrderBy(
        parseJsonQueryParam<ObjectChildrenQueryParams['orderBy']>(
          req.query.orderBy,
          'orderBy'
        )
      )

      const { projectDb, model, latestVersion, rootObject } =
        await getModelLatestVersionContext({
          projectId,
          modelId
        })

      if (!model) {
        return res.status(404).json({ error: 'Model not found' })
      }

      if (!latestVersion || !rootObject) {
        return res.json({
          projectId,
          modelId,
          modelName: model.name,
          versionId: null,
          rootObjectId: null,
          totalCount: 0,
          limit,
          cursor: null,
          items: []
        })
      }

      const getObjectChildren = getObjectChildrenFactory({ db: projectDb })
      const getObjectChildrenQuery = getObjectChildrenQueryFactory({ db: projectDb })

      const useComplexQuery = !!query?.length || !!orderBy

      if (useComplexQuery) {
        const result = await getObjectChildrenQuery({
          streamId: projectId,
          objectId: rootObject.id,
          limit,
          depth,
          cursor,
          select,
          query,
          orderBy
        })

        return res.json({
          projectId,
          modelId,
          modelName: model.name,
          versionId: latestVersion.id,
          rootObjectId: rootObject.id,
          totalCount: result.totalCount,
          limit,
          cursor: result.cursor,
          items: result.objects.map(formatObjectResponse)
        })
      }

      const result = await getObjectChildren({
        streamId: projectId,
        objectId: rootObject.id,
        limit,
        depth,
        cursor,
        select
      })

      return res.json({
        projectId,
        modelId,
        modelName: model.name,
        versionId: latestVersion.id,
        rootObjectId: rootObject.id,
        totalCount: rootObject.totalChildrenCount || 0,
        limit,
        cursor: result.cursor,
        items: result.objects.map(formatObjectResponse)
      })
    } catch (err) {
      next(err)
    }
  })

  app.get(
    `${route}/:objectId`,
    corsMiddlewareFactory(),
    readProjectPermission,
    async (req, res, next) => {
      try {
        const { projectId, modelId, objectId } = req.params
        const { projectDb, model, latestVersion, rootObject } =
          await getModelLatestVersionContext({
            projectId,
            modelId
          })

        if (!model) {
          return res.status(404).json({ error: 'Model not found' })
        }

        if (!latestVersion || !rootObject) {
          return res.status(404).json({ error: 'Model has no published version yet' })
        }

        if (!isObjectInModelTree(rootObject.id, rootObject.data, objectId)) {
          return res.status(404).json({ error: 'Object not found in model latest version' })
        }

        const getFormattedObject = getFormattedObjectFactory({ db: projectDb })
        const object = await getFormattedObject({
          streamId: projectId,
          objectId
        })

        if (!object) {
          return res.status(404).json({ error: 'Object not found' })
        }

        return res.json({
          projectId,
          modelId,
          modelName: model.name,
          versionId: latestVersion.id,
          rootObjectId: rootObject.id,
          item: formatObjectResponse(object)
        })
      } catch (err) {
        next(err)
      }
    }
  )

  app.use(route, projectModelObjectsErrHandler)
}
