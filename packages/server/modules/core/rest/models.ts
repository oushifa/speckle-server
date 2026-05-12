import type { Router, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { knex, Branches, Streams, BranchCommits, Commits } from '@/modules/core/dbSchema'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { getServerOrigin } from '@/modules/shared/helpers/envHelper'
import { ensureError } from '@speckle/shared'

type ModelRow = {
  id: string
  title: string
  streamId: string
  streamName: string | null
  updatedAt: string
  versions: string | number
  latestCommitId: string | null
}

const modelsErrHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!err) return next()
  const error = ensureError(err)
  const status = resolveStatusCode(error)
  res.status(status).json({ error: error.message })
}

export default (app: Router) => {
  const route = '/api/v1/models'

  app.options(route, cors(), allowCrossOriginResourceAccessMiddelware())

  /**
   * GET /api/v1/models
   * Returns all models (branches) across all streams.
   * Permission: Authenticated users only.
   */
  app.get(
    route,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Permission check: check if user is logged in
        if (!req.context.auth && !req.context.userId) {
          return res.status(401).json({ error: 'User not authenticated' })
        }

        const { search } = req.query
        const latestCommitIdQuery = knex(BranchCommits.name)
          .select(BranchCommits.col.commitId)
          .innerJoin(Commits.name, Commits.col.id, BranchCommits.col.commitId)
          .where(BranchCommits.col.branchId, knex.ref(`${Branches.name}.id`))
          .orderBy(Commits.col.createdAt, 'desc')
          .limit(1)

        const q = knex(Branches.name)
          .select<ModelRow[]>([
            `${Branches.name}.id`,
            `${Branches.name}.name as title`,
            `${Branches.name}.streamId`,
            `${Streams.name}.name as streamName`,
            `${Branches.name}.updatedAt`,
            knex.raw(`(${latestCommitIdQuery.toQuery()}) as "latestCommitId"`)
          ])
          .select([
            `${Branches.name}.createdAt`
          ])
          .select(knex.raw('count(??) as versions', [Commits.col.id]))
          .leftJoin(Streams.name, Streams.col.id, Branches.col.streamId)
          .leftJoin(BranchCommits.name, BranchCommits.col.branchId, Branches.col.id)
          .leftJoin(Commits.name, Commits.col.id, BranchCommits.col.commitId)
          .whereNot(`${Branches.name}.name`, 'globals')
          .groupBy(`${Branches.name}.id`, `${Streams.name}.name`, `${Branches.name}.streamId`)
          .orderBy(`${Branches.name}.updatedAt`, 'desc')

        if (search && typeof search === 'string') {
          q.whereILike(`${Branches.name}.name`, `%${search}%`)
        }

        const models = await q

        // Map to match the frontend expectations
        const formattedModels = models.map((m) => ({
          id: m.id,
          title: m.title,
          projectId: m.streamId,
          streamName: m.streamName,
          updateTime: m.updatedAt,
          versions: parseInt(m.versions),
          comments: 0,
          hasModel: Boolean(m.latestCommitId),
          previewUrl: m.latestCommitId
            ? new URL(`/preview/${m.streamId}/commits/${m.latestCommitId}`, getServerOrigin()).toString()
            : null,
          status: null
        }))

        res.json({ data: formattedModels })
      } catch (err) {
        next(err)
      }
    }
  )

  app.use(route, modelsErrHandler)
}
