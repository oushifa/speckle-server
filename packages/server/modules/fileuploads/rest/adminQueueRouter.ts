import { Router, type RequestHandler, type Request, type Response } from 'express'
import { db } from '@/db/knex'
import { Roles } from '@speckle/shared'
import { configureClient } from '@/knexfile'
import { getFileImporterQueuePostgresUrl } from '@/modules/shared/helpers/envHelper'
import { moduleLogger } from '@/observability/logging'

const logger = moduleLogger.child({ module: 'adminQueueRouter' })

const getQueueDb = () => {
  const connectionUri = getFileImporterQueuePostgresUrl()
  return connectionUri ? configureClient({ postgres: { connectionUri } }).public : db
}

const requireServerAdmin: RequestHandler = (req, res, next) => {
  if (!req.context.auth || !req.context.userId) {
    return res.status(401).json({ error: '请先登录' })
  }
  if (req.context.role !== Roles.Server.Admin) {
    return res.status(403).json({ error: '仅超级管理员有权限访问此接口' })
  }
  return next()
}

export type ConversionJobItem = {
  id: string
  jobType: string
  fileType: string
  fileName: string
  projectId: string
  projectName: string
  modelId: string
  modelName: string
  blobId: string
  status: string
  createdAt: string
  updatedAt: string
  attempt: number
  maxAttempt: number
  queuePosition?: number | null
  progressPercent?: number | null
  progressMessage?: string | null
}

type BackgroundJobRecord = {
  id: string
  jobType: string
  payload: unknown
  status: string
  createdAt: Date | string
  updatedAt: Date | string
  attempt: number
  maxAttempt: number
}

export const adminQueueRouterFactory = (): Router => {
  const router = Router()

  /**
   * 获取指定类型（或全部类型）的模型转换队列状态
   * GET /api/v1/admin/file-import-queues?fileType=ifc
   */
  router.get(
    '/api/v1/admin/file-import-queues',
    requireServerAdmin,
    async (req: Request, res: Response) => {
      try {
        const fileType =
          typeof req.query.fileType === 'string'
            ? req.query.fileType.toLowerCase().trim()
            : null

        const queueKnex = getQueueDb()

        let query = queueKnex('background_jobs')
          .select('*')
          .whereRaw('lower("jobType") = ?', ['fileimport'])
          .whereIn('status', ['processing', 'queued', 'paused'])

        if (fileType) {
          query = query.whereRaw("lower(payload ->> 'fileType') = ?", [fileType])
        }

        const rows = await query.orderBy('createdAt', 'asc')

        if (!rows.length) {
          return res.json({
            fileType,
            activeJob: null,
            queuedJobs: [],
            pausedJobs: []
          })
        }

        // 收集所有的 projectId 和 modelId 进行批量补充名称信息
        const projectIds = new Set<string>()
        const modelIds = new Set<string>()

        for (const row of rows) {
          const payload =
            typeof row.payload === 'string'
              ? JSON.parse(row.payload)
              : row.payload || {}
          if (payload.projectId) projectIds.add(payload.projectId)
          if (payload.modelId) modelIds.add(payload.modelId)
        }

        const projectMap = new Map<string, string>()
        const modelMap = new Map<string, string>()

        if (projectIds.size > 0) {
          const projects = await db('streams')
            .select('id', 'name')
            .whereIn('id', Array.from(projectIds))
          for (const p of projects) {
            projectMap.set(p.id, p.name)
          }
        }

        if (modelIds.size > 0) {
          const models = await db('branches')
            .select('id', 'name')
            .whereIn('id', Array.from(modelIds))
          for (const m of models) {
            modelMap.set(m.id, m.name)
          }
        }

        const parsePayload = (
          rawPayload: unknown
        ): {
          projectId?: string
          modelId?: string
          blobId?: string
          fileType?: string
          fileName?: string
        } => {
          if (!rawPayload) return {}
          if (typeof rawPayload === 'string') {
            try {
              return JSON.parse(rawPayload) as {
                projectId?: string
                modelId?: string
                blobId?: string
                fileType?: string
                fileName?: string
              }
            } catch {
              return {}
            }
          }
          if (typeof rawPayload === 'object' && rawPayload !== null) {
            return rawPayload as Record<string, string>
          }
          return {}
        }

        // 查询最新的 project_model_sync_tasks 进度以展示更精细的 progressMessage
        const fileUploadIds = rows
          .map((r: BackgroundJobRecord) => {
            const p = parsePayload(r.payload)
            return p.blobId || null
          })
          .filter((id): id is string => Boolean(id))

        const taskProgressMap = new Map<
          string,
          { percent: number | null; message: string | null }
        >()
        if (fileUploadIds.length > 0) {
          const tasks = await db('project_model_sync_tasks')
            .select('fileUploadId', 'progressPercent', 'progressMessage')
            .whereIn('fileUploadId', fileUploadIds)
          for (const t of tasks) {
            if (t.fileUploadId) {
              taskProgressMap.set(t.fileUploadId, {
                percent: t.progressPercent,
                message: t.progressMessage
              })
            }
          }
        }

        const formatJob = (
          row: BackgroundJobRecord,
          queuePos?: number
        ): ConversionJobItem => {
          const payload = parsePayload(row.payload)
          const pId = payload.projectId || ''
          const mId = payload.modelId || ''
          const blobId = payload.blobId || ''
          const progressInfo = blobId ? taskProgressMap.get(blobId) : null

          return {
            id: row.id,
            jobType: row.jobType,
            fileType: (payload.fileType || '').toLowerCase(),
            fileName: payload.fileName || '',
            projectId: pId,
            projectName: projectMap.get(pId) || pId || '未知项目',
            modelId: mId,
            modelName: modelMap.get(mId) || payload.fileName || mId || '未知模型',
            blobId,
            status: row.status,
            createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
            updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : '',
            attempt: row.attempt,
            maxAttempt: row.maxAttempt,
            queuePosition: queuePos ?? null,
            progressPercent: progressInfo?.percent ?? null,
            progressMessage: progressInfo?.message ?? null
          }
        }

        let activeJob: ConversionJobItem | null = null
        const queuedJobs: ConversionJobItem[] = []
        const pausedJobs: ConversionJobItem[] = []

        let queueIdx = 1
        for (const row of rows) {
          if (row.status === 'processing') {
            if (!activeJob) {
              activeJob = formatJob(row)
            } else {
              // 容错处理：若有多条 processing，优先放入 queued 或列表
              queuedJobs.push(formatJob(row, queueIdx++))
            }
          } else if (row.status === 'queued') {
            queuedJobs.push(formatJob(row, queueIdx++))
          } else if (row.status === 'paused') {
            pausedJobs.push(formatJob(row))
          }
        }

        return res.json({
          fileType,
          activeJob,
          queuedJobs,
          pausedJobs
        })
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        logger.error({ err }, '获取模型转换队列失败')
        return res.status(500).json({ error: '获取模型转换队列失败: ' + errorMsg })
      }
    }
  )

  /**
   * 暂停正在转换的模型
   * POST /api/v1/admin/file-import-queues/:jobId/pause
   */
  router.post(
    '/api/v1/admin/file-import-queues/:jobId/pause',
    requireServerAdmin,
    async (req: Request, res: Response) => {
      const { jobId } = req.params
      const queueKnex = getQueueDb()

      try {
        const job = await queueKnex('background_jobs').where({ id: jobId }).first()
        if (!job) {
          return res.status(404).json({ error: '未找到指定的转换任务' })
        }

        if (job.status === 'paused') {
          return res.json({ success: true, message: '任务已经是暂停状态' })
        }

        await queueKnex('background_jobs').where({ id: jobId }).update({
          status: 'paused',
          updatedAt: queueKnex.fn.now()
        })

        // 若有关联的 model_sync 任务，同步提示已暂停
        const payload =
          typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload || {}
        if (payload.blobId) {
          await db('project_model_sync_tasks')
            .where({ fileUploadId: payload.blobId })
            .update({
              progressMessage: '模型转换已暂停',
              updatedAt: db.fn.now()
            })
            .catch(() => {})
        }

        logger.info({ jobId }, '管理员暂停了模型转换任务')
        return res.json({
          success: true,
          message: '模型转换已暂停，将立即调度下一个排队模型'
        })
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        logger.error({ err, jobId }, '暂停模型转换任务失败')
        return res.status(500).json({ error: '暂停模型转换任务失败: ' + errorMsg })
      }
    }
  )

  /**
   * 恢复暂停的模型转换（恢复后进入排队首位）
   * POST /api/v1/admin/file-import-queues/:jobId/resume
   */
  router.post(
    '/api/v1/admin/file-import-queues/:jobId/resume',
    requireServerAdmin,
    async (req: Request, res: Response) => {
      const { jobId } = req.params
      const queueKnex = getQueueDb()

      try {
        const job = await queueKnex('background_jobs').where({ id: jobId }).first()
        if (!job) {
          return res.status(404).json({ error: '未找到指定的转换任务' })
        }

        if (job.status === 'queued' || job.status === 'processing') {
          return res.json({ success: true, message: '任务已经在排队或转换中' })
        }

        const payload =
          typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload || {}
        const fileType = (payload.fileType || '').toLowerCase()

        // 核心规则：恢复后进入第一个队列（即当前该格式排队中的第一位）
        // 获取当前该格式处于 queued 状态的最早 createdAt
        const minQueued = await queueKnex('background_jobs')
          .min('createdAt as minCreatedAt')
          .whereRaw('lower("jobType") = ?', ['fileimport'])
          .where('status', 'queued')
          .whereRaw("lower(payload ->> 'fileType') = ?", [fileType])
          .first()

        let targetCreatedAt: Date
        if (minQueued?.minCreatedAt) {
          // 比最早的还要早 1 秒，确保排在最前面
          targetCreatedAt = new Date(new Date(minQueued.minCreatedAt).getTime() - 1000)
        } else {
          targetCreatedAt = new Date()
        }

        await queueKnex('background_jobs').where({ id: jobId }).update({
          status: 'queued',
          createdAt: targetCreatedAt,
          updatedAt: queueKnex.fn.now()
        })

        if (payload.blobId) {
          await db('project_model_sync_tasks')
            .where({ fileUploadId: payload.blobId })
            .update({
              status: 'speckle_converting',
              progressMessage: '排队中，当前处于队列第 1 位',
              updatedAt: db.fn.now()
            })
            .catch(() => {})
        }

        logger.info({ jobId, fileType }, '管理员恢复了模型转换任务至队列首位')
        return res.json({
          success: true,
          message: '模型已恢复并成功进入排队队列首位'
        })
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        logger.error({ err, jobId }, '恢复模型转换任务失败')
        return res.status(500).json({ error: '恢复模型转换任务失败: ' + errorMsg })
      }
    }
  )

  /**
   * 调整等待转换的队列顺序
   * PUT /api/v1/admin/file-import-queues/:fileType/reorder
   * Body: { jobIds: string[] }
   */
  router.put(
    '/api/v1/admin/file-import-queues/:fileType/reorder',
    requireServerAdmin,
    async (req: Request, res: Response) => {
      const fileType = req.params.fileType.toLowerCase().trim()
      const { jobIds } = req.body

      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        return res.status(400).json({ error: 'jobIds 必须是非空数组' })
      }

      const queueKnex = getQueueDb()

      try {
        const jobs = await queueKnex('background_jobs')
          .select('id', 'createdAt')
          .whereIn('id', jobIds)
          .where('status', 'queued')
          .whereRaw("lower(payload ->> 'fileType') = ?", [fileType])

        if (jobs.length !== jobIds.length) {
          return res.status(400).json({
            error: '部分任务不存在、不属于当前格式或不是排队状态，请刷新后重试'
          })
        }

        // 找到这批任务中最早的时间戳作为 baseTime
        const timestamps = jobs.map((j) => new Date(j.createdAt).getTime())
        const baseTime = Math.min(...timestamps)

        // 事务内依次更新时间戳：第 0 项是 baseTime，第 1 项是 baseTime + 1000ms，以此类推
        await queueKnex.transaction(async (trx) => {
          for (let i = 0; i < jobIds.length; i++) {
            const nextCreatedAt = new Date(baseTime + i * 1000)
            await trx('background_jobs').where({ id: jobIds[i] }).update({
              createdAt: nextCreatedAt,
              updatedAt: trx.fn.now()
            })
          }
        })

        logger.info(
          { fileType, jobIdsCount: jobIds.length },
          '管理员调整了转换等待队列顺序'
        )
        return res.json({
          success: true,
          message: '队列顺序更新成功'
        })
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        logger.error({ err, fileType }, '调整转换队列顺序失败')
        return res.status(500).json({ error: '调整转换队列顺序失败: ' + errorMsg })
      }
    }
  )

  return router
}
