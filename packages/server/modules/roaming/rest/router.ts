import { Router, type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import crypto from 'crypto'
import { ensureError } from '@speckle/shared'
import { buildAuthPolicies } from '@/modules'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { throwIfAuthNotOk } from '@/modules/shared/helpers/errorHelper'
import {
  listRoamingRoutesFactory,
  getRoamingRouteFactory,
  createRoamingRouteFactory,
  updateRoamingRouteFactory,
  deleteRoamingRouteFactory,
  type RoamingRouteRecord
} from '@/modules/roaming/repositories/routes'

const routeBase = '/api/v1/projects/:projectId/roaming/routes'

const roamingErrHandler = (
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

const requireProjectRead = async (req: Request, projectId: string) => {
  const authz = await buildAuthPolicies({ authContext: req.context })
  throwIfAuthNotOk(
    await authz.project.canRead({
      userId: req.context.userId,
      projectId
    })
  )
}

const requireProjectUpdate = async (req: Request, projectId: string) => {
  const authz = await buildAuthPolicies({ authContext: req.context })
  throwIfAuthNotOk(
    await authz.project.canUpdate({
      userId: req.context.userId,
      projectId
    })
  )
}

const serializeRoute = (record: RoamingRouteRecord) => ({
  id: record.id,
  projectId: record.projectId,
  name: record.name,
  mode: record.mode,
  points:
    typeof record.points === 'string' ? JSON.parse(record.points) : record.points || [],
  loop: !!record.loop,
  speed: Number(record.speed) || 1.0,
  eyeHeight: record.eyeHeight === null ? null : Number(record.eyeHeight),
  creator: record.creator,
  updater: record.updater,
  createdAt:
    record.createdAt instanceof Date
      ? record.createdAt.toISOString()
      : record.createdAt,
  updatedAt:
    record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt
})

export const roamingRouterFactory = () => {
  const router = Router()

  router.options(routeBase, cors(), allowCrossOriginResourceAccessMiddelware())
  router.options(
    `${routeBase}/:routeId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware()
  )

  // 1. 获取漫游路线列表
  router.get(
    routeBase,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId as string
        await requireProjectRead(req, projectId)

        const db = await getProjectDbClient({ projectId })
        const listRoutes = listRoamingRoutesFactory({ db })
        const routes = await listRoutes({ projectId })

        res.json({
          data: routes.map(serializeRoute)
        })
      } catch (err) {
        next(err)
      }
    }
  )

  // 2. 获取单条漫游路线详情
  router.get(
    `${routeBase}/:routeId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId as string
        const routeId = req.params.routeId as string
        await requireProjectRead(req, projectId)

        const db = await getProjectDbClient({ projectId })
        const getRoute = getRoamingRouteFactory({ db })
        const route = await getRoute({ projectId, routeId })

        if (!route) {
          res.status(404).json({ error: 'Roaming route not found' })
          return
        }

        res.json({
          data: serializeRoute(route)
        })
      } catch (err) {
        next(err)
      }
    }
  )

  // 3. 创建漫游路线
  router.post(
    routeBase,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId as string
        await requireProjectUpdate(req, projectId)

        const body = req.body || {}
        if (!body.name || !body.name.trim()) {
          res.status(400).json({ error: 'Route name is required' })
          return
        }

        const id =
          body.id || `roam_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
        const db = await getProjectDbClient({ projectId })
        const createRoute = createRoamingRouteFactory({ db })

        const created = await createRoute({
          id,
          projectId,
          name: body.name.trim(),
          mode: body.mode || 'point',
          points: body.points || [],
          loop: !!body.loop,
          speed: body.speed ?? 1.0,
          eyeHeight: body.eyeHeight ?? 1.6,
          creator: req.context.userId || null,
          updater: req.context.userId || null
        })

        res.status(201).json({
          data: serializeRoute(created)
        })
      } catch (err) {
        next(err)
      }
    }
  )

  // 4. 更新漫游路线
  router.put(
    `${routeBase}/:routeId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId as string
        const routeId = req.params.routeId as string
        await requireProjectUpdate(req, projectId)

        const body = req.body || {}
        const db = await getProjectDbClient({ projectId })
        const updateRoute = updateRoamingRouteFactory({ db })

        const updated = await updateRoute({
          projectId,
          routeId,
          updates: {
            name: body.name !== undefined ? body.name.trim() : undefined,
            mode: body.mode,
            points: body.points,
            loop: body.loop,
            speed: body.speed,
            eyeHeight: body.eyeHeight,
            updater: req.context.userId || null
          }
        })

        if (!updated) {
          res.status(404).json({ error: 'Roaming route not found' })
          return
        }

        res.json({
          data: serializeRoute(updated)
        })
      } catch (err) {
        next(err)
      }
    }
  )

  // 5. 删除漫游路线
  router.delete(
    `${routeBase}/:routeId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId as string
        const routeId = req.params.routeId as string
        await requireProjectUpdate(req, projectId)

        const db = await getProjectDbClient({ projectId })
        const deleteRoute = deleteRoamingRouteFactory({ db })
        const success = await deleteRoute({ projectId, routeId })

        if (!success) {
          res.status(404).json({ error: 'Roaming route not found' })
          return
        }

        res.status(204).send()
      } catch (err) {
        next(err)
      }
    }
  )

  router.use(roamingErrHandler)

  return router
}
