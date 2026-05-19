import type { Router, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import {
  knex,
  Branches,
  Streams,
  BranchCommits,
  Commits
} from '@/modules/core/dbSchema'
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
  latestSourceApp: string | null
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

        const { search, member, source, page, pageSize } = req.query
        const userId = req.context.userId

        // 分页参数解析
        const currentPage = Math.max(1, parseInt(page as string) || 1)
        const currentPageSize = Math.min(
          100,
          Math.max(1, parseInt(pageSize as string) || 10)
        )

        const latestCommitIdQuery = knex(BranchCommits.name)
          .select(BranchCommits.col.commitId)
          .innerJoin(Commits.name, Commits.col.id, BranchCommits.col.commitId)
          .where(BranchCommits.col.branchId, knex.ref(`${Branches.name}.id`))
          .orderBy(Commits.col.createdAt, 'desc')
          .limit(1)

        const latestSourceAppQuery = knex(BranchCommits.name)
          .select(Commits.col.sourceApplication)
          .innerJoin(Commits.name, Commits.col.id, BranchCommits.col.commitId)
          .where(BranchCommits.col.branchId, knex.ref(`${Branches.name}.id`))
          .orderBy(Commits.col.createdAt, 'desc')
          .limit(1)

        // 获取总数（用于分页）
        const countQuery = knex(Branches.name)
          .count(`${Branches.name}.id as count`)
          .leftJoin(Streams.name, Streams.col.id, Branches.col.streamId)
          .whereNot(`${Branches.name}.name`, 'globals')

        // 应用相同的筛选条件到 countQuery（不包括 source，因为它需要子查询结果）
        if (search && typeof search === 'string') {
          countQuery.whereILike(`${Branches.name}.name`, `%${search}%`)
        }
        if (member === 'mine' && userId) {
          countQuery.where(`${Branches.name}.authorId`, userId)
        }

        const countResult = await countQuery
        const totalRecords = parseInt(countResult[0].count as string)

        // 获取所有数据（不包括分页，因为 source 筛选需要全部数据）
        const q = knex(Branches.name)
          .select<ModelRow[]>([
            `${Branches.name}.id`,
            `${Branches.name}.name as title`,
            `${Branches.name}.streamId`,
            `${Streams.name}.name as streamName`,
            `${Branches.name}.updatedAt`,
            knex.raw(`(${latestCommitIdQuery.toQuery()}) as "latestCommitId"`),
            knex.raw(`(${latestSourceAppQuery.toQuery()}) as "latestSourceApp"`)
          ])
          .select([`${Branches.name}.createdAt`])
          .select(knex.raw('count(??) as versions', [Commits.col.id]))
          .leftJoin(Streams.name, Streams.col.id, Branches.col.streamId)
          .leftJoin(BranchCommits.name, BranchCommits.col.branchId, Branches.col.id)
          .leftJoin(Commits.name, Commits.col.id, BranchCommits.col.commitId)
          .whereNot(`${Branches.name}.name`, 'globals')
          .groupBy(
            `${Branches.name}.id`,
            `${Streams.name}.name`,
            `${Branches.name}.streamId`
          )
          .orderBy(`${Branches.name}.updatedAt`, 'desc')

        if (search && typeof search === 'string') {
          q.whereILike(`${Branches.name}.name`, `%${search}%`)
        }

        // member 筛选：mine = 当前用户创建的模型
        if (member === 'mine' && userId) {
          q.where(`${Branches.name}.authorId`, userId)
        }

        const models = await q

        // source 筛选：基于最新 commit 的 sourceApplication 进行内存过滤
        // local: 本地上传（web/rest/null/empty）
        // plugin: 插件同步（revit/rhino/autocad/dynamo 等）
        const localSourceApps = new Set(['web', 'rest', 'manual', ''])
        let filteredRows = models
        if (source === 'local') {
          filteredRows = models.filter((m) => {
            const app = (m.latestSourceApp || '').toLowerCase()
            return !app || localSourceApps.has(app)
          })
        } else if (source === 'plugin') {
          filteredRows = models.filter((m) => {
            const app = (m.latestSourceApp || '').toLowerCase()
            return app && !localSourceApps.has(app)
          })
        }

        // 在内存中进行分页（因为 source 筛选后数据量可能变化）
        const offset = (currentPage - 1) * currentPageSize
        const paginatedRows = filteredRows.slice(offset, offset + currentPageSize)
        const filteredTotal = filteredRows.length

        // Map to match the frontend expectations
        const formattedModels = paginatedRows.map((m) => ({
          id: m.id,
          title: m.title,
          projectId: m.streamId,
          streamName: m.streamName,
          updateTime: m.updatedAt,
          versions: parseInt(m.versions as string),
          comments: 0,
          hasModel: Boolean(m.latestCommitId),
          previewUrl: m.latestCommitId
            ? new URL(
                `/preview/${m.streamId}/commits/${m.latestCommitId}`,
                getServerOrigin()
              ).toString()
            : null,
          status: null,
          sourceApplication: m.latestSourceApp || null
        }))

        res.json({
          data: formattedModels,
          total: source ? filteredTotal : totalRecords,
          page: currentPage,
          pageSize: currentPageSize
        })
      } catch (err) {
        next(err)
      }
    }
  )

  app.use(route, modelsErrHandler)
}
