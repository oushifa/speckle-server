import { db } from '@/db/knex'
import { getFileImporterQueuePostgresUrl } from '@/modules/shared/helpers/envHelper'
import { configureClient } from '@/knexfile'
import type { ProjectModelSyncTaskRecord } from '@/modules/model-sync/repositories/tasks'

export const QUEUE_SUPPORTED_FILE_TYPES = new Set(['ifc', 'dxf', 'skp'])

export const getQueueDb = () => {
  const connectionUri = getFileImporterQueuePostgresUrl()
  return connectionUri ? configureClient({ postgres: { connectionUri } }).public : db
}

export type QueuePositionInfo = {
  queuePosition: number | null
  status: 'queued' | 'processing' | 'other'
}

/**
 * 批量获取给定的 blobIds (fileUploadIds) 在 background_jobs 中的排位与状态
 * 采用窗口函数 ROW_NUMBER() OVER (PARTITION BY lower(payload ->> 'fileType') ORDER BY "createdAt" ASC)
 * 计算每个同格式任务在等待队列中的位次（纯等待位次，选项 A：下一个轮到它处理为第 1 位）
 */
export const getQueuePositionsByBlobIds = async (
  blobIds: string[]
): Promise<Map<string, QueuePositionInfo>> => {
  const result = new Map<string, QueuePositionInfo>()
  const validBlobIds = [...new Set(blobIds.filter(Boolean))]
  if (!validBlobIds.length) return result

  const queueKnex = getQueueDb()

  try {
    // 1. 查询处于 queued 状态的任务及其在同格式队列中的排位
    const queuedRows = await queueKnex.raw(
      `
      WITH ranked_jobs AS (
        SELECT
          payload ->> 'blobId' as "blobId",
          lower(payload ->> 'fileType') as "fileType",
          status,
          ROW_NUMBER() OVER (
            PARTITION BY lower(payload ->> 'fileType')
            ORDER BY "createdAt" ASC
          ) as "queuePosition"
        FROM background_jobs
        WHERE lower("jobType") = 'fileimport'
          AND status = 'queued'
          AND "attempt" < "maxAttempt"
          AND ("remainingComputeBudgetSeconds"::int > 0 OR "remainingComputeBudgetSeconds" IS NULL)
      )
      SELECT "blobId", "fileType", "queuePosition"::int as "queuePosition"
      FROM ranked_jobs
      WHERE "blobId" = ANY(?)
      `,
      [validBlobIds]
    )

    const rows = queuedRows?.rows || []
    for (const row of rows) {
      if (row.blobId && QUEUE_SUPPORTED_FILE_TYPES.has(row.fileType)) {
        result.set(row.blobId, {
          queuePosition: row.queuePosition,
          status: 'queued'
        })
      }
    }

    // 2. 对尚未匹配到的 blobIds，检查是否处于 processing 状态
    const remainingBlobIds = validBlobIds.filter((id) => !result.has(id))
    if (remainingBlobIds.length) {
      const processingRows = await queueKnex('background_jobs')
        .select(
          queueKnex.raw('payload ->> \'blobId\' as "blobId"'),
          queueKnex.raw('lower(payload ->> \'fileType\') as "fileType"')
        )
        .whereRaw('lower("jobType") = ?', ['fileimport'])
        .where('status', 'processing')
        .whereRaw("payload ->> 'blobId' = ANY(?)", [remainingBlobIds])

      for (const row of processingRows) {
        if (row.blobId && QUEUE_SUPPORTED_FILE_TYPES.has(row.fileType)) {
          result.set(row.blobId, {
            queuePosition: null,
            status: 'processing'
          })
        }
      }
    }
  } catch (err) {
    // 降级处理，不影响主流程
    console.error('Failed to getQueuePositionsByBlobIds:', err)
  }

  return result
}

export type TaskWithQueuePosition = ProjectModelSyncTaskRecord & {
  queuePosition?: number | null
}

/**
 * 为任务列表批量注入队列位置和排队进度说明
 */
export const enrichTasksWithQueuePosition = async (
  tasks: ProjectModelSyncTaskRecord[]
): Promise<TaskWithQueuePosition[]> => {
  if (!tasks.length) return []

  const targetBlobIds: string[] = []
  for (const task of tasks) {
    const fileType = task.fileType?.toLowerCase() || ''
    const blobId = task.fileUploadId || task.fileId
    if (
      task.status === 'speckle_converting' &&
      QUEUE_SUPPORTED_FILE_TYPES.has(fileType) &&
      blobId
    ) {
      targetBlobIds.push(blobId)
    }
  }

  if (!targetBlobIds.length) {
    return tasks.map((t) => ({ ...t, queuePosition: null }))
  }

  const queueMap = await getQueuePositionsByBlobIds(targetBlobIds)

  return tasks.map((task) => {
    const blobId = task.fileUploadId || task.fileId
    const fileType = task.fileType?.toLowerCase() || ''
    if (
      task.status === 'speckle_converting' &&
      QUEUE_SUPPORTED_FILE_TYPES.has(fileType) &&
      blobId &&
      queueMap.has(blobId)
    ) {
      const info = queueMap.get(blobId)!
      if (info.status === 'queued' && typeof info.queuePosition === 'number') {
        return {
          ...task,
          queuePosition: info.queuePosition,
          progressMessage: `排队中，当前处于队列第 ${info.queuePosition} 位`
        }
      }
      if (info.status === 'processing') {
        return {
          ...task,
          queuePosition: null,
          progressMessage:
            !task.progressMessage ||
            task.progressMessage.startsWith('排队中') ||
            task.progressMessage === '等待模型转换'
              ? '正在转换模型'
              : task.progressMessage
        }
      }
    }

    return {
      ...task,
      queuePosition: null
    }
  })
}
