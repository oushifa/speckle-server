import type { NextFunction, Request, Response, Router } from 'express'
import cors from 'cors'
import { ensureError, Roles } from '@speckle/shared'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import db from '@/db/knex'
import { throwForNotHavingServerRole } from '@/modules/shared/authz'
import { ensureModelLibraryProjectFactory } from '@/modules/core/services/streams/modelLibrary'

const modelLibraryProjectErrHandler = (
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
  const route = '/api/internal/model-library-project'
  const ensureModelLibraryProject = ensureModelLibraryProjectFactory({ db })

  app.options(route, cors(), allowCrossOriginResourceAccessMiddelware())

  app.get(
    route,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await throwForNotHavingServerRole(req.context, Roles.Server.User)
        const project = await ensureModelLibraryProject()
        res.json({ data: project })
      } catch (err) {
        next(err)
      }
    }
  )

  app.post(
    `${route}/ensure`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await throwForNotHavingServerRole(req.context, Roles.Server.User)
        const project = await ensureModelLibraryProject()
        res.json({ data: project })
      } catch (err) {
        next(err)
      }
    }
  )

  app.use(route, modelLibraryProjectErrHandler)
}
