import { Router, type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  getBranchLatestCommitsFactory,
  getProjectModelByIdFactory
} from '@/modules/core/repositories/branches'
import {
  createViewerObjectCustomAttributeFactory,
  deleteViewerObjectCustomAttributeFactory,
  getViewerObjectCustomAttributesFactory,
  updateViewerObjectCustomAttributeFactory
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
  if (applicationId === undefined) {
    return undefined
  }

  if (typeof applicationId !== 'string' || !applicationId.trim()) {
    throw new Error('applicationId must be a non-empty string')
  }

  return applicationId
}

type CustomLabelPayload = {
  model: {
    id: string
    name: string
    timestamp: string
  }
  elements: Array<{
    id: string
    parameters: Record<string, string>
  }>
}

type CustomLabelPayloadResponse = {
  fileName: string
  versionId: string
  treeJson: string
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

  router.patch(
    `${route}/:attributeId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId
        const modelId = getModelIdFromRequest(req)
        const attributeId = req.params.attributeId
        const { name, value } = req.body as {
          name?: string
          value?: string
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
        const updateViewerObjectCustomAttribute = updateViewerObjectCustomAttributeFactory({
          db: projectDb
        })

        const attribute = await updateViewerObjectCustomAttribute({
          id: attributeId,
          projectId,
          modelId,
          name: name.trim(),
          value: value.trim()
        })

        if (!attribute) {
          return res.status(404).json({ error: 'Attribute not found' })
        }

        res.json({ data: attribute })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    `${route}/custom-label-payload`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId
        const modelId = getModelIdFromRequest(req)
        if (!req.context.userId) {
          return res.status(401).json({ error: 'User not authenticated' })
        }

        const authz = await buildAuthPolicies({ authContext: req.context })
        const authResults = await Promise.all([
          authz.project.canRead({ userId: req.context.userId, projectId })
        ])
        authResults.forEach(throwIfAuthNotOk)

        const projectDb = await getProjectDbClient({ projectId })
        const getProjectModelById = getProjectModelByIdFactory({ db: projectDb })
        const getBranchLatestCommits = getBranchLatestCommitsFactory({ db: projectDb })
        const getViewerObjectCustomAttributes = getViewerObjectCustomAttributesFactory({
          db: projectDb
        })

        const [model, latestVersion, attributes] = await Promise.all([
          getProjectModelById({ projectId, modelId }),
          getBranchLatestCommits([modelId], projectId, { limit: 1 }).then(
            (versions) => versions[0]
          ),
          getViewerObjectCustomAttributes({
            projectId,
            modelId
          })
        ])

        if (!model) {
          return res.status(404).json({ error: 'Model not found' })
        }
        if (!latestVersion?.id) {
          return res.status(404).json({ error: 'Latest version not found' })
        }

        const groupedAttributes = new Map<string, Record<string, string>>()
        for (const attribute of attributes) {
          const applicationId = attribute.applicationId?.trim()
          const name = attribute.name?.trim()
          if (!applicationId || !name) continue

          const current = groupedAttributes.get(applicationId) || {}
          current[name] = attribute.value ?? ''
          groupedAttributes.set(applicationId, current)
        }

        const payload: CustomLabelPayload = {
          model: {
            id: latestVersion.seedId?.trim() || modelId,
            name: model.name || modelId,
            timestamp: latestVersion.createdAt.toISOString()
          },
          elements: [...groupedAttributes.entries()].map(([applicationId, parameters]) => ({
            id: applicationId,
            parameters
          }))
        }
        const response: CustomLabelPayloadResponse = {
          fileName: `model-${modelId}-custom-labels.json`,
          versionId: latestVersion.id,
          treeJson: JSON.stringify(payload)
        }

        res.json({ data: response })
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
