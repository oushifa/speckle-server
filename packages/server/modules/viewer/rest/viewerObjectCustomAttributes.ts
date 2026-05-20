import { Router, type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  createViewerObjectCustomAttributeFactory,
  deleteViewerObjectCustomAttributeFactory,
  getViewerObjectCustomAttributesFactory
} from '@/modules/viewer/repositories/viewerObjectCustomAttributes'
import { buildAuthPolicies } from '@/modules'
import { throwIfAuthNotOk } from '@/modules/shared/helpers/errorHelper'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { ensureError } from '@speckle/shared'

const viewerObjectCustomAttributesErrHandler = (
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

const getModelIdFromRequest = (req: Request) => {
  const modelId = req.query.modelId
  if (typeof modelId !== 'string' || !modelId.trim()) {
    throw new Error('modelId is required')
  }

  return modelId
}

const getApplicationIdFromRequest = (req: Request) => {
  const applicationId = req.query.applicationId
  if (typeof applicationId !== 'string' || !applicationId.trim()) {
    throw new Error('applicationId is required')
  }

  return applicationId
}

const buildViewerObjectCustomAttributesRoute = (router: Router) => {
  const route = '/api/projects/:projectId/viewer-object-custom-attributes'

  router.options(route, cors(), allowCrossOriginResourceAccessMiddelware())

  router.get(
    route,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId
        const modelId = getModelIdFromRequest(req)
        const applicationId = getApplicationIdFromRequest(req)

        const authz = await buildAuthPolicies({ authContext: req.context })
        const authResults = await Promise.all([
          authz.project.canRead({ userId: req.context.userId, projectId })
        ])
        authResults.forEach(throwIfAuthNotOk)

        const projectDb = await getProjectDbClient({ projectId })
        const getViewerObjectCustomAttributes = getViewerObjectCustomAttributesFactory({
          db: projectDb
        })

        const attributes = await getViewerObjectCustomAttributes({
          projectId,
          modelId,
          applicationId
        })

        res.json({ data: attributes })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    route,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId
        const modelId = getModelIdFromRequest(req)
        const { applicationId, name, value } = req.body as {
          applicationId?: string
          name?: string
          value?: string
        }

        if (!applicationId?.trim()) {
          throw new Error('applicationId is required')
        }
        if (!name?.trim()) {
          throw new Error('Attribute name is required')
        }
        if (typeof value !== 'string' || !value.trim()) {
          throw new Error('Attribute value is required')
        }

        const authz = await buildAuthPolicies({ authContext: req.context })
        const authResults = await Promise.all([
          authz.project.canRead({ userId: req.context.userId, projectId })
        ])
        authResults.forEach(throwIfAuthNotOk)

        const projectDb = await getProjectDbClient({ projectId })
        const createViewerObjectCustomAttribute = createViewerObjectCustomAttributeFactory({
          db: projectDb
        })

        const attribute = await createViewerObjectCustomAttribute({
          projectId,
          modelId,
          applicationId: applicationId.trim(),
          authorId: req.context.userId || null,
          name: name.trim(),
          value: value.trim()
        })

        res.status(201).json({ data: attribute })
      } catch (err) {
        next(err)
      }
    }
  )

  router.delete(
    `${route}/:attributeId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId
        const modelId = getModelIdFromRequest(req)
        const attributeId = req.params.attributeId

        const authz = await buildAuthPolicies({ authContext: req.context })
        const authResults = await Promise.all([
          authz.project.canRead({ userId: req.context.userId, projectId })
        ])
        authResults.forEach(throwIfAuthNotOk)

        const projectDb = await getProjectDbClient({ projectId })
        const deleteViewerObjectCustomAttribute =
          deleteViewerObjectCustomAttributeFactory({
            db: projectDb
          })

        const success = await deleteViewerObjectCustomAttribute({
          id: attributeId,
          projectId,
          modelId
        })

        if (!success) {
          return res.status(404).json({ error: 'Attribute not found' })
        }

        res.status(204).send()
      } catch (err) {
        next(err)
      }
    }
  )

  router.use(route, viewerObjectCustomAttributesErrHandler)
}

export const getViewerObjectCustomAttributesRouter = (): Router => {
  const router = Router()
  buildViewerObjectCustomAttributesRoute(router)
  return router
}
