import type { Router, NextFunction, Request, Response } from 'express'
import cors from 'cors'
import { ensureError } from '@speckle/shared'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import {
  getProjectModelByIdFactory,
  getBranchLatestCommitsFactory
} from '@/modules/core/repositories/branches'
import {
  getFormattedObjectFactory,
  getObjectChildrenStreamFactory
} from '@/modules/core/repositories/objects'
import {
  buildModelCustomLabelPayload,
  indexObjectsFromStream,
  mergeRootAndChildrenStream
} from '@/modules/core/services/modelCustomLabelExport'

const route = '/api/v1/projects/:projectId/models/:modelId/bim-custom-label'

const modelCustomLabelErrHandler = (
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

export default (app: Router) => {
  app.options(route, cors(), allowCrossOriginResourceAccessMiddelware())

  app.get(
    route,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, modelId } = req.params
        if (!req.context.auth && !req.context.userId) {
          return res.status(401).json({ error: 'User not authenticated' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const getProjectModelById = getProjectModelByIdFactory({ db: projectDb })
        const getBranchLatestCommits = getBranchLatestCommitsFactory({ db: projectDb })
        const getFormattedObject = getFormattedObjectFactory({ db: projectDb })
        const getObjectChildrenStream = getObjectChildrenStreamFactory({ db: projectDb })

        const [model, latestVersion] = await Promise.all([
          getProjectModelById({ projectId, modelId }),
          getBranchLatestCommits([modelId], undefined, { limit: 1 }).then((items) => items[0])
        ])

        if (!model) {
          return res.status(404).json({ error: 'Model not found' })
        }

        if (!latestVersion?.referencedObject) {
          return res.status(404).json({ error: 'Latest version referencedObject not found' })
        }

        if (!latestVersion.seedId?.trim()) {
          return res.status(400).json({
            error: 'Latest version seedId missing. Please sync the model file to DTP first.'
          })
        }

        const rootObject = await getFormattedObject({
          streamId: projectId,
          objectId: latestVersion.referencedObject
        })
        if (!rootObject?.data) {
          return res.status(404).json({ error: 'Referenced root object not found' })
        }

        const childObjectStream = await getObjectChildrenStream({
          streamId: projectId,
          objectId: latestVersion.referencedObject
        })

        const objectMap = await indexObjectsFromStream(
          mergeRootAndChildrenStream({
            rootObject,
            childObjectStream
          })
        )

        const payload = buildModelCustomLabelPayload({
          modelSeedId: latestVersion.seedId,
          modelName: model.name,
          versionCreatedAt: latestVersion.createdAt.toISOString(),
          rootId: latestVersion.referencedObject,
          objectMap
        })

        res.json({
          fileName: `model-${modelId}-custom-labels.json`,
          versionId: latestVersion.id,
          payload
        })
      } catch (err) {
        next(err)
      }
    }
  )

  app.use(route, modelCustomLabelErrHandler)
}
