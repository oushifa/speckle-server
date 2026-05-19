import { Router, type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  createViewerCatalogFactory,
  getViewerCatalogsByProjectFactory,
  updateViewerCatalogFactory,
  deleteViewerCatalogFactory
} from '@/modules/viewer/repositories/viewerCatalogs'
import type { ViewerCatalogNode } from '@/modules/viewer/domain/types/viewerCatalogs'
import { buildAuthPolicies } from '@/modules'
import { throwIfAuthNotOk } from '@/modules/shared/helpers/errorHelper'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { ensureError } from '@speckle/shared'

const catalogErrHandler = (
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

const buildCatalogsRoute = (router: Router) => {
  const route = '/api/projects/:projectId/viewer-catalogs'

  router.options(route, cors(), allowCrossOriginResourceAccessMiddelware())

  // GET: Fetch all catalogs for a project
  router.get(
    route,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId
        const modelId = getModelIdFromRequest(req)

        const authz = await buildAuthPolicies({ authContext: req.context })
        const authResults = await Promise.all([
          authz.project.canRead({ userId: req.context.userId, projectId })
        ])
        authResults.forEach(throwIfAuthNotOk)

        const projectDb = await getProjectDbClient({ projectId })
        const getViewerCatalogsByProject = getViewerCatalogsByProjectFactory({
          db: projectDb
        })
        const catalogs = await getViewerCatalogsByProject(projectId, modelId)

        res.json({ data: catalogs })
      } catch (err) {
        next(err)
      }
    }
  )

  // POST: Create a new catalog
  router.post(
    route,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId
        const modelId = getModelIdFromRequest(req)
        const { title, treeData } = req.body as {
          title?: string
          treeData?: ViewerCatalogNode[]
        }

        if (!title) {
          throw new Error('Catalog title is required')
        }

        const authz = await buildAuthPolicies({ authContext: req.context })
        const authResults = await Promise.all([
          authz.project.canRead({ userId: req.context.userId, projectId })
        ])
        authResults.forEach(throwIfAuthNotOk)

        const projectDb = await getProjectDbClient({ projectId })
        const createViewerCatalog = createViewerCatalogFactory({ db: projectDb })

        const newCatalog = await createViewerCatalog({
          projectId,
          modelId,
          authorId: req.context.userId || null,
          title,
          treeData: JSON.stringify(treeData || [])
        })

        res.status(201).json({ data: newCatalog })
      } catch (err) {
        next(err)
      }
    }
  )

  // PUT: Update a catalog
  router.put(
    `${route}/:catalogId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId
        const modelId = getModelIdFromRequest(req)
        const catalogId = req.params.catalogId
        const { title, treeData } = req.body as {
          title?: string
          treeData?: ViewerCatalogNode[]
        }

        const authz = await buildAuthPolicies({ authContext: req.context })
        const authResults = await Promise.all([
          authz.project.canRead({ userId: req.context.userId, projectId })
        ])
        authResults.forEach(throwIfAuthNotOk)

        const projectDb = await getProjectDbClient({ projectId })
        const updateViewerCatalog = updateViewerCatalogFactory({ db: projectDb })

        const updatePayload: { title?: string; treeData?: string } = {}
        if (title !== undefined) updatePayload.title = title
        if (treeData !== undefined) updatePayload.treeData = JSON.stringify(treeData)

        const updatedCatalog = await updateViewerCatalog({
          id: catalogId,
          projectId,
          modelId,
          update: updatePayload
        })

        if (!updatedCatalog) {
          return res.status(404).json({ error: 'Catalog not found' })
        }

        res.json({ data: updatedCatalog })
      } catch (err) {
        next(err)
      }
    }
  )

  // DELETE: Delete a catalog
  router.delete(
    `${route}/:catalogId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectId = req.params.projectId
        const modelId = getModelIdFromRequest(req)
        const catalogId = req.params.catalogId

        const authz = await buildAuthPolicies({ authContext: req.context })
        const authResults = await Promise.all([
          authz.project.canRead({ userId: req.context.userId, projectId })
        ])
        authResults.forEach(throwIfAuthNotOk)

        const projectDb = await getProjectDbClient({ projectId })
        const deleteViewerCatalog = deleteViewerCatalogFactory({ db: projectDb })

        const success = await deleteViewerCatalog(catalogId, projectId, modelId)

        if (!success) {
          return res.status(404).json({ error: 'Catalog not found' })
        }

        res.status(204).send()
      } catch (err) {
        next(err)
      }
    }
  )

  router.use(route, catalogErrHandler)
}

export const getViewerCatalogsRouter = (): Router => {
  const router = Router()
  buildCatalogsRoute(router)
  return router
}
