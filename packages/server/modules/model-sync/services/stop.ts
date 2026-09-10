import type { Knex } from 'knex'
import { ensureError } from '@speckle/shared'
import { db } from '@/db/knex'
import { BackgroundJobStatus } from '@/modules/backgroundjobs/domain/types'
import { FileUploads } from '@/modules/core/dbSchema'
import { getUserFactory } from '@/modules/core/repositories/users'
import { FileUploadConvertedStatus } from '@/modules/fileuploads/helpers/types'
import {
  getActiveProjectModelSyncTaskFactory,
  listProjectModelSyncTasksFactory,
  updateProjectModelSyncTaskFactory,
  type ModelSyncTaskStatus,
  type ProjectModelSyncTaskRecord
} from '@/modules/model-sync/repositories/tasks'
import { deleteDtpModelAssetFactory } from '@/modules/model-sync/services/dtp'
import {
  MODEL_SYNC_CANCELLED_ERROR_CODE,
  MODEL_SYNC_CANCELLED_MESSAGE
} from '@/modules/model-sync/services/errors'
import { emitModelSyncTaskUpdated } from '@/modules/model-sync/services/events'
import { getQueueDb } from '@/modules/model-sync/services/queuePosition'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  ActiveRvtConversionJobStatuses,
  listRvtConversionJobsFactory,
  updateRvtConversionJobFactory
} from '@/modules/rvt-conversion/repositories/jobs'
import { dispatchRvtConversionCancellation } from '@/modules/rvt-conversion/services/wsDispatcher'
import { logger } from '@/observability/logging'

/**
 * 模型上传后的阶段：
 * upload(上传) -> conversion(转换) -> sync(同步)
 * 上传阶段由前端自行中断（本地分片上传 + abort-upload），这里只处理转换与同步阶段。
 */
export type ModelSyncStopStage = 'upload' | 'conversion' | 'sync' | null

export type StopModelSyncTaskResult = {
  /** 当前所处阶段 */
  stage: ModelSyncStopStage
  /** 是否确实停止了后台任务 */
  stopped: boolean
  /** 本次停止的编排任务 id */
  taskId: string | null
  /** 被取消的 ifc/dxf/skp 后台导入任务 id */
  cancelledQueueJobs: string[]
  /** 被取消的 rvt/nwd/nwc 转换任务 id（已通过 WebSocket 通知对应 Worker） */
  cancelledRvtJobs: string[]
  /** 被删除的中海 DTP 资产 id */
  deletedDtpAssetId: string | null
  /** 停止过程中的非致命错误信息 */
  errors: string[]
}

const CONVERTING_TASK_STATUSES: ModelSyncTaskStatus[] = ['speckle_converting']

const SYNCING_TASK_STATUSES: ModelSyncTaskStatus[] = [
  'syncing_dtp_model',
  'syncing_external_ids',
  'triggering_model_transform',
  'polling_model_transform'
]

const QUEUE_JOB_ACTIVE_STATUSES = ['queued', 'processing', 'paused']

const resolveStopStage = (
  task: ProjectModelSyncTaskRecord | null | undefined
): ModelSyncStopStage => {
  if (!task) return null
  if (task.status === 'waiting_upload') return 'upload'
  if (CONVERTING_TASK_STATUSES.includes(task.status)) return 'conversion'
  if (SYNCING_TASK_STATUSES.includes(task.status)) return 'sync'
  return null
}

const parseJobPayload = (rawPayload: unknown): { blobId?: string } => {
  if (!rawPayload) return {}
  if (typeof rawPayload === 'string') {
    try {
      return JSON.parse(rawPayload) as { blobId?: string }
    } catch {
      return {}
    }
  }
  if (typeof rawPayload === 'object') return rawPayload as { blobId?: string }
  return {}
}

const resolveFileTypeFromName = (fileName: string | null | undefined) => {
  if (!fileName) return null
  const parts = fileName.split('.')
  const extension = parts.length > 1 ? parts[parts.length - 1] : ''
  return extension ? extension.toLowerCase() : null
}

/**
 * 取消 ifc/dxf/skp 的后台导入任务。
 *
 * 这三种格式的转换由外部导入服务消费 background_jobs 队列：
 * - 状态置为 cancelled 后不会再被拾取；
 * - 同时把 attempt 提到 maxAttempt、算力预算清零，避免导入服务处理完成后回写状态导致任务“复活”。
 */
const cancelQueueConversionJobs = async (params: {
  projectId: string
  modelId: string
  projectDb: Knex
}): Promise<string[]> => {
  const queueKnex = getQueueDb()
  const rows = await queueKnex('background_jobs')
    .select('id', 'payload')
    .whereRaw('lower("jobType") = ?', ['fileimport'])
    .whereRaw("payload ->> 'modelId' = ?", [params.modelId])
    .whereIn('status', QUEUE_JOB_ACTIVE_STATUSES)

  if (!rows.length) return []

  const jobIds: string[] = rows.map((row: { id: string }) => row.id)

  await queueKnex('background_jobs')
    .whereIn('id', jobIds)
    .update({
      status: BackgroundJobStatus.Cancelled,
      attempt: queueKnex.raw('"maxAttempt"'),
      remainingComputeBudgetSeconds: 0,
      updatedAt: queueKnex.fn.now()
    })

  const blobIds: string[] = rows
    .map((row: { payload: unknown }) => parseJobPayload(row.payload).blobId)
    .filter((blobId: string | undefined): blobId is string => !!blobId)

  if (blobIds.length) {
    await params
      .projectDb(FileUploads.name)
      .whereIn(FileUploads.col.id, blobIds)
      .whereIn(FileUploads.col.convertedStatus, [
        FileUploadConvertedStatus.Queued,
        FileUploadConvertedStatus.Converting
      ])
      .update({
        [FileUploads.withoutTablePrefix.col.convertedStatus]:
          FileUploadConvertedStatus.Error,
        [FileUploads.withoutTablePrefix.col.convertedMessage]:
          MODEL_SYNC_CANCELLED_MESSAGE,
        [FileUploads.withoutTablePrefix.col.convertedLastUpdate]:
          params.projectDb.fn.now()
      })
  }

  logger.info(
    { projectId: params.projectId, modelId: params.modelId, jobIds, blobIds },
    '模型已删除，已取消该模型的 ifc/dxf/skp 后台转换任务'
  )

  return jobIds
}

/**
 * 取消 rvt/nwd/nwc 的外部转换任务：
 * 通过 WebSocket 向对应的 Worker 下发 {"type":"delete","taskId":"..."}。
 */
const cancelRvtConversionJobs = async (params: {
  projectId: string
  modelId: string
  userId: string
}): Promise<string[]> => {
  const projectDb = await getProjectDbClient({ projectId: params.projectId })
  const jobs = await listRvtConversionJobsFactory({ db: projectDb })({
    projectId: params.projectId,
    modelId: params.modelId,
    statuses: ActiveRvtConversionJobStatuses
  })

  if (!jobs.length) return []

  const updateJob = updateRvtConversionJobFactory({ db: projectDb })
  const cancelledJobIds: string[] = []

  for (const job of jobs) {
    await dispatchRvtConversionCancellation({
      taskId: job.id,
      fileType: resolveFileTypeFromName(job.sourceFileName)
    }).catch((error) => {
      logger.warn(
        { err: error, taskId: job.id, modelId: params.modelId },
        '通知 Worker 停止转换失败'
      )
    })

    await updateJob({
      id: job.id,
      item: {
        status: 'failed',
        errorMessage: MODEL_SYNC_CANCELLED_MESSAGE,
        finishedAt: new Date(),
        updater: params.userId
      }
    })

    cancelledJobIds.push(job.id)
  }

  logger.info(
    { modelId: params.modelId, cancelledJobIds },
    '模型已删除，已通知 Worker 停止 rvt/nwd/nwc 转换任务'
  )

  return cancelledJobIds
}

const deleteDtpAsset = async (params: {
  userId: string
  assetId: string
}): Promise<string> => {
  const user = await getUserFactory({ db })(params.userId)
  if (!user?.email) {
    throw new Error('未找到用户手机号，无法登录 DTP 删除模型资产')
  }

  await deleteDtpModelAssetFactory()({
    mobile: user.email,
    assetId: params.assetId
  })

  return params.assetId
}

/**
 * 停止某个模型正在进行中的转换 / 同步任务。
 *
 * 按阶段分流：
 * - conversion：ifc/dxf/skp 取消后台导入队列任务；rvt/nwd/nwc 通过 WebSocket 通知 Worker 删除任务
 * - sync：删除中海 DTP 资产（删除资产会同时中断 DTP 侧的转换）
 *
 * 编排任务本身会被标记为已取消（TASK_CANCELLED，不可重试），
 * 后台 taskRunner 会在下一个检查点退出，不再回写状态或自动重试。
 */
export const stopModelSyncTaskFactory =
  () =>
  async (params: {
    projectId: string
    modelId: string
    userId: string
    reason?: string
  }): Promise<StopModelSyncTaskResult> => {
    const { projectId, modelId, userId } = params
    const projectDb = await getProjectDbClient({ projectId })

    const result: StopModelSyncTaskResult = {
      stage: null,
      stopped: false,
      taskId: null,
      cancelledQueueJobs: [],
      cancelledRvtJobs: [],
      deletedDtpAssetId: null,
      errors: []
    }

    const activeTask = await getActiveProjectModelSyncTaskFactory({ db: projectDb })({
      projectId,
      modelId
    })

    // 失败且仍在等待自动重试的任务同样需要取消
    const retriableTask = activeTask
      ? null
      : (
          await listProjectModelSyncTasksFactory({ db: projectDb })({
            projectId,
            modelId,
            limit: 5
          })
        ).find((task) => task.status === 'failed' && task.retriable) || null

    const cancellableTask = activeTask || retriableTask

    result.stage = resolveStopStage(activeTask)
    result.taskId = activeTask?.id || null

    // 1. 先落库取消状态：后台编排任务会在下一个检查点退出
    if (cancellableTask) {
      const cancelledTask = await updateProjectModelSyncTaskFactory({ db: projectDb })({
        projectId,
        modelId,
        taskId: cancellableTask.id,
        patch: {
          status: 'failed',
          error: params.reason?.trim() || MODEL_SYNC_CANCELLED_MESSAGE,
          errorCode: MODEL_SYNC_CANCELLED_ERROR_CODE,
          retriable: false,
          retryCount: 0,
          progressPercent: null,
          progressPhase: null,
          progressMessage: null,
          updater: userId
        }
      })

      if (cancelledTask) {
        emitModelSyncTaskUpdated(cancelledTask)
        result.stopped = true
      }
    }

    // 2. ifc / dxf / skp：取消后台导入队列任务
    try {
      result.cancelledQueueJobs = await cancelQueueConversionJobs({
        projectId,
        modelId,
        projectDb
      })
    } catch (error) {
      result.errors.push(ensureError(error).message)
      logger.error({ err: error, projectId, modelId }, '取消后台转换队列任务失败')
    }

    // 3. rvt / nwd / nwc：WebSocket 通知对应 Worker 停止转换
    try {
      result.cancelledRvtJobs = await cancelRvtConversionJobs({
        projectId,
        modelId,
        userId
      })
    } catch (error) {
      result.errors.push(ensureError(error).message)
      logger.error({ err: error, projectId, modelId }, '通知 Worker 停止转换任务失败')
    }

    // 4. 同步阶段：删除中海 DTP 资产
    const assetId = (cancellableTask?.assetId || '').trim()
    if (assetId) {
      try {
        result.deletedDtpAssetId = await deleteDtpAsset({ userId, assetId })
      } catch (error) {
        result.errors.push(ensureError(error).message)
        logger.error(
          { err: error, projectId, modelId, assetId },
          '删除中海 DTP 模型资产失败'
        )
      }
    }

    if (
      result.cancelledQueueJobs.length ||
      result.cancelledRvtJobs.length ||
      result.deletedDtpAssetId
    ) {
      result.stopped = true
    }

    logger.info(
      { projectId, modelId, userId, ...result },
      '模型删除前的停止转换/停止同步处理完成'
    )

    return result
  }
