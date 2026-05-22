import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { validateRequest } from 'zod-express'
import { db } from '@/db/knex'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { recalculateProjectCostSummaryFactory } from '@/modules/project-statistics/services/projectCostSummaries'
import { importQualityAcceptanceFormsFactory } from '@/modules/quality-acceptance-form/services/qualityAcceptanceForms'

const thirdPartyTokenHeader = 'x-file-conversion-token'
const serviceCreator = 'quality-acceptance-import-service'

const routeParamsSchema = z.object({
  projectId: z.string().trim().min(1)
})

const importItemSchema = z.object({
  rowNumber: z.coerce.number().int().min(1).optional(),
  boqItemId: z.string().trim().min(1).max(10),
  name: z.string().trim().max(255).optional(),
  code: z.string().trim().max(255).optional(),
  inspectionLotNumber: z.string().trim().min(1).max(255),
  acceptancePart: z.string().trim().min(1).max(1024),
  acceptanceContent: z.string().trim().max(4096).optional(),
  actualStartDate: z.coerce.number().int().nullable().optional(),
  actualFinishDate: z.coerce.number().int(),
  inspector: z.string().trim().max(64).optional(),
  workVolume: z.coerce.number().finite(),
  unit: z.string().trim().max(64).optional(),
  timeZone: z.string().trim().max(128).optional(),
  approveStatus: z.string().trim().max(64).nullable().optional()
})

const importBodySchema = z.object({
  items: z.array(importItemSchema).min(1).max(500)
})

const requireServiceToken: RequestHandler = (req, res, next) => {
  const configuredToken = process.env['FILE_CONVERSION_SERVICE_TOKEN']
  if (!configuredToken) {
    return res
      .status(500)
      .send({ error: 'FILE_CONVERSION_SERVICE_TOKEN is not configured.' })
  }

  const token = req.headers[thirdPartyTokenHeader]
  if (!token || typeof token !== 'string') {
    return res.status(401).send({
      error: `Missing ${thirdPartyTokenHeader} request header.`
    })
  }

  if (token !== configuredToken) {
    return res.status(403).send({ error: 'Invalid service token.' })
  }

  return next()
}

export const qualityAcceptanceRouterFactory = (): Router => {
  const app = Router()
  const getStream = getStreamFactory({ db })

  app.post(
    '/api/v1/internal/projects/:projectId/quality-acceptance/forms/import',
    requireServiceToken,
    validateRequest({
      params: routeParamsSchema,
      body: importBodySchema
    }),
    async (req, res) => {
      const { projectId } = req.params
      const project = await getStream({ streamId: projectId })
      if (!project) {
        return res.status(404).send({ error: 'Project not found.' })
      }

      const projectDb = await getProjectDbClient({ projectId })
      const result = await importQualityAcceptanceFormsFactory({
        db,
        projectDb
      })({
        projectId,
        creator: serviceCreator,
        items: req.body.items.map((item, index) => ({
          ...item,
          rowNumber: item.rowNumber ?? index + 1
        }))
      })

      if (result.createdCount > 0) {
        await recalculateProjectCostSummaryFactory({ db: projectDb })({
          projectId
        })
      }

      return res.status(200).send({
        projectId,
        createdCount: result.createdCount,
        failedCount: result.failedCount,
        createdItems: result.createdItems,
        failedRows: result.failedRows
      })
    }
  )

  return app
}
