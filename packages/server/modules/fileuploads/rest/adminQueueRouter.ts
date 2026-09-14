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
  startedAt?: string | null
  attempt: number
  maxAttempt: number
  queuePosition?: number | null
  progressPhase?: string | null
  progressPercent?: number | null
  progressMessage?: string | null
}

export type FailedConversionJobItem = {
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
  failedAt: string
  attempt: number
  maxAttempt: number
  failedPhase?: string | null
  failedPercent?: number | null
  failedProgressMessage?: string | null
  errorMessage?: string | null
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
   * 获取指定类型（或全部类型）的模型转换队列状态及失败历史
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

        // 1. 查询活跃、排队和暂停中的任务
        let query = queueKnex('background_jobs')
          .select('*')
          .whereRaw('lower("jobType") = ?', ['fileimport'])
          .whereIn('status', ['processing', 'queued', 'paused'])

        if (fileType) {
          query = query.whereRaw("lower(payload ->> 'fileType') = ?", [fileType])
        }

        const rows: BackgroundJobRecord[] = await query.orderBy('createdAt', 'asc')

        // 解析失败列表的分页参数（默认第 1 页，每页 10 条）
        const failedPage = Math.max(
          1,
          parseInt(
            typeof req.query.failedPage === 'string' ? req.query.failedPage : '1',
            10
          ) || 1
        )
        const failedPageSize = Math.max(
          1,
          Math.min(
            100,
            parseInt(
              typeof req.query.failedPageSize === 'string'
                ? req.query.failedPageSize
                : '10',
              10
            ) || 10
          )
        )

        // 2. 查询失败的任务总数与分页数据
        let failedBaseQuery = queueKnex('background_jobs')
          .whereRaw('lower("jobType") = ?', ['fileimport'])
          .where('status', 'failed')

        if (fileType) {
          failedBaseQuery = failedBaseQuery.whereRaw(
            "lower(payload ->> 'fileType') = ?",
            [fileType]
          )
        }

        const countRow = await failedBaseQuery
          .clone()
          .count<{ count: string | number }>('* as count')
          .first()
        const failedTotal = Number(countRow?.count || 0)

        const failedOffset = (failedPage - 1) * failedPageSize
        const failedRows: BackgroundJobRecord[] = await failedBaseQuery
          .clone()
          .select('*')
          .orderBy('updatedAt', 'desc')
          .offset(failedOffset)
          .limit(failedPageSize)

        // 收集所有的 projectId 和 modelId 进行批量补充名称信息
        const projectIds = new Set<string>()
        const modelIds = new Set<string>()

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

        const allRows = [...rows, ...failedRows]
        for (const row of allRows) {
          const payload = parsePayload(row.payload)
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

        // 收集全部关联的 fileUploadId (blobId)
        const fileUploadIds = allRows
          .map((r: BackgroundJobRecord) => {
            const p = parsePayload(r.payload)
            return p.blobId || null
          })
          .filter((id): id is string => Boolean(id))

        // 3. 联合优先查询 file_uploads 表（Worker 真实写入进度的源头表）
        const fileUploadProgressMap = new Map<
          string,
          {
            percent: number | null
            phase: string | null
            message: string | null
            status: number | null
            errorMessage: string | null
            lastUpdate: string | null
          }
        >()

        if (fileUploadIds.length > 0) {
          const uploads = await db('file_uploads')
            .select(
              'id',
              'convertedStatus',
              'convertedMessage',
              'convertedLastUpdate',
              'progressPercent',
              'progressPhase',
              'progressMessage'
            )
            .whereIn('id', fileUploadIds)

          for (const u of uploads) {
            fileUploadProgressMap.set(u.id, {
              percent: u.progressPercent,
              phase: u.progressPhase,
              message: u.progressMessage,
              status: u.convertedStatus,
              errorMessage: u.convertedMessage,
              lastUpdate: u.convertedLastUpdate
                ? new Date(u.convertedLastUpdate).toISOString()
                : null
            })
          }
        }

        // 备用：查询 project_model_sync_tasks 进度
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
          const uploadInfo = blobId ? fileUploadProgressMap.get(blobId) : null
          const syncTaskInfo = blobId ? taskProgressMap.get(blobId) : null

          const percent = uploadInfo?.percent ?? syncTaskInfo?.percent ?? null
          const phase = uploadInfo?.phase ?? null
          const message = uploadInfo?.message ?? syncTaskInfo?.message ?? null

          // 核心修正：对于处于 processing 状态的任务，开始/重试时间取 row.updatedAt，真实反映 Worker 开始执行的时间
          const startedAt =
            row.status === 'processing'
              ? row.updatedAt
                ? new Date(row.updatedAt).toISOString()
                : new Date(row.createdAt).toISOString()
              : null

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
            startedAt,
            attempt: row.attempt,
            maxAttempt: row.maxAttempt,
            queuePosition: queuePos ?? null,
            progressPhase: phase,
            progressPercent: percent,
            progressMessage: message
          }
        }

        const formatFailedJob = (row: BackgroundJobRecord): FailedConversionJobItem => {
          const payload = parsePayload(row.payload)
          const pId = payload.projectId || ''
          const mId = payload.modelId || ''
          const blobId = payload.blobId || ''
          const uploadInfo = blobId ? fileUploadProgressMap.get(blobId) : null
          const syncTaskInfo = blobId ? taskProgressMap.get(blobId) : null

          const percent = uploadInfo?.percent ?? syncTaskInfo?.percent ?? null
          const phase = uploadInfo?.phase ?? null
          const message = uploadInfo?.message ?? syncTaskInfo?.message ?? null
          const errorMsg =
            uploadInfo?.errorMessage ||
            (typeof (row as Record<string, unknown>).error === 'string'
              ? ((row as Record<string, unknown>).error as string)
              : null) ||
            '模型转换异常终止'

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
            failedAt: row.updatedAt
              ? new Date(row.updatedAt).toISOString()
              : new Date(row.createdAt).toISOString(),
            attempt: row.attempt,
            maxAttempt: row.maxAttempt,
            failedPhase: phase,
            failedPercent: percent,
            failedProgressMessage: message,
            errorMessage: errorMsg
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
              queuedJobs.push(formatJob(row, queueIdx++))
            }
          } else if (row.status === 'queued') {
            queuedJobs.push(formatJob(row, queueIdx++))
          } else if (row.status === 'paused') {
            pausedJobs.push(formatJob(row))
          }
        }

        const failedJobs: FailedConversionJobItem[] = failedRows.map(formatFailedJob)

        return res.json({
          fileType,
          activeJob,
          queuedJobs,
          pausedJobs,
          failedJobs,
          failedPagination: {
            page: failedPage,
            pageSize: failedPageSize,
            total: failedTotal,
            totalPages: Math.ceil(failedTotal / failedPageSize) || 1
          }
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

  /**
   * 重试失败的模型转换（重置后排入等待队列首位）
   * POST /api/v1/admin/file-import-queues/:jobId/retry
   */
  router.post(
    '/api/v1/admin/file-import-queues/:jobId/retry',
    requireServerAdmin,
    async (req: Request, res: Response) => {
      const { jobId } = req.params
      const queueKnex = getQueueDb()

      try {
        const job = await queueKnex('background_jobs').where({ id: jobId }).first()
        if (!job) {
          return res.status(404).json({ error: '未找到指定的转换任务' })
        }

        const payload =
          typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload || {}
        const fileType = (payload.fileType || '').toLowerCase()

        // 核心：重试进入等待队列首位，排在最早排队任务之前
        const minQueued = await queueKnex('background_jobs')
          .min('createdAt as minCreatedAt')
          .whereRaw('lower("jobType") = ?', ['fileimport'])
          .where('status', 'queued')
          .whereRaw("lower(payload ->> 'fileType') = ?", [fileType])
          .first()

        let targetCreatedAt: Date
        if (minQueued?.minCreatedAt) {
          targetCreatedAt = new Date(new Date(minQueued.minCreatedAt).getTime() - 1000)
        } else {
          targetCreatedAt = new Date()
        }

        // 重置任务状态为 queued，attempt 计数置 0，更新时间为现在
        await queueKnex('background_jobs').where({ id: jobId }).update({
          status: 'queued',
          attempt: 0,
          createdAt: targetCreatedAt,
          updatedAt: queueKnex.fn.now()
        })

        if (payload.blobId) {
          // 清空底层 file_uploads 的失败标记与错误信息，重置进度
          await db('file_uploads')
            .where({ id: payload.blobId })
            .update({
              convertedStatus: 0,
              convertedMessage: null,
              progressPercent: 0,
              progressPhase: null,
              progressMessage: '等待转换 (已重试)',
              convertedLastUpdate: db.fn.now()
            })
            .catch(() => {})

          // 同步重置 project_model_sync_tasks
          await db('project_model_sync_tasks')
            .where({ fileUploadId: payload.blobId })
            .update({
              status: 'speckle_converting',
              progressPercent: 0,
              progressMessage: '排队中，当前处于队列第 1 位',
              updatedAt: db.fn.now()
            })
            .catch(() => {})
        }

        logger.info({ jobId, fileType }, '管理员重试了失败的模型转换任务')
        return res.json({
          success: true,
          message: '模型转换任务已重置，已排入等待队列首位'
        })
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        logger.error({ err, jobId }, '重试模型转换任务失败')
        return res.status(500).json({ error: '重试模型转换任务失败: ' + errorMsg })
      }
    }
  )

  return router
}
