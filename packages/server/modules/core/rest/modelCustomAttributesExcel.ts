import type { Router, NextFunction, Request, Response } from 'express'
import cors from 'cors'
import contentDisposition from 'content-disposition'
import * as XLSX from 'xlsx'
import { ensureError } from '@speckle/shared'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { getProjectModelByIdFactory } from '@/modules/core/repositories/branches'
import { getViewerObjectCustomAttributesFactory } from '@/modules/viewer/repositories/viewerObjectCustomAttributes'

const route = '/api/v1/projects/:projectId/models/:modelId/custom-attributes-excel'

const modelCustomAttributesExcelErrHandler = (
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

const sanitizeFileName = (value: string) =>
  value.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'model'

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
        const getViewerObjectCustomAttributes = getViewerObjectCustomAttributesFactory({
          db: projectDb
        })

        const [model, attributes] = await Promise.all([
          getProjectModelById({ projectId, modelId }),
          getViewerObjectCustomAttributes({
            projectId,
            modelId
          })
        ])

        if (!model) {
          return res.status(404).json({ error: 'Model not found' })
        }

        const rows = [
          ['构件ID', '属性名', '属性值'],
          ...attributes.map((attribute) => [
            attribute.applicationId || '',
            attribute.name || '',
            attribute.value || ''
          ])
        ]

        const workbook = XLSX.utils.book_new()
        const worksheet = XLSX.utils.aoa_to_sheet(rows)
        worksheet['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 40 }]
        XLSX.utils.book_append_sheet(workbook, worksheet, '自定义属性')

        const buffer = XLSX.write(workbook, {
          type: 'buffer',
          bookType: 'xlsx'
        }) as Buffer

        const fileName = `${sanitizeFileName(model.name || modelId)}-自定义属性.xlsx`
        res.writeHead(200, {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': contentDisposition(fileName),
          'Content-Length': buffer.byteLength
        })
        res.end(buffer)
      } catch (err) {
        next(err)
      }
    }
  )

  app.use(route, modelCustomAttributesExcelErrHandler)
}
