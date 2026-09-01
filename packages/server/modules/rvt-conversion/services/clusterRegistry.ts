import { randomUUID } from 'crypto'
import { getGenericRedis } from '@/modules/shared/redis/redis'
import { createRvtConvertLogger } from '@/modules/rvt-conversion/services/logging'
import type { TrackedRvtConversionTask } from '@/modules/rvt-conversion/services/taskRegistry'

const logger = createRvtConvertLogger('cluster-registry')

export const CLUSTER_INSTANCE_ID = randomUUID()
const WORKERS_HASH_KEY = 'speckle:rvt:cluster_workers'
const TASK_KEY_PREFIX = 'speckle:rvt:task:'
const WORKER_STALE_TIMEOUT_MS = 300 * 1000 // 5 minutes
const TASK_TTL_SECONDS = 24 * 60 * 60 // 24 hours

export type ClusterRvtWorkerInfo = {
  workerId: string
  capabilities: string[]
  version: string | null
  connectedAt: string
  lastSeenAt: string
  instanceId: string
}

// 内存兜底镜像（当 Redis 不可用或离线测试时使用）
const inMemoryWorkers = new Map<string, ClusterRvtWorkerInfo>()
const inMemoryTasks = new Map<string, TrackedRvtConversionTask>()

const safeParseWorker = (raw: string): ClusterRvtWorkerInfo | null => {
  try {
    const data = JSON.parse(raw) as Partial<ClusterRvtWorkerInfo>
    if (!data.workerId || !Array.isArray(data.capabilities)) return null
    return {
      workerId: data.workerId,
      capabilities: data.capabilities,
      version: data.version ?? null,
      connectedAt: data.connectedAt || new Date().toISOString(),
      lastSeenAt: data.lastSeenAt || new Date().toISOString(),
      instanceId: data.instanceId || 'unknown'
    }
  } catch {
    return null
  }
}

export const syncWorkerToCluster = async (params: {
  workerId: string
  capabilities: string[]
  version?: string | null
}) => {
  const now = new Date().toISOString()
  const info: ClusterRvtWorkerInfo = {
    workerId: params.workerId,
    capabilities: params.capabilities,
    version: params.version ?? null,
    connectedAt: now,
    lastSeenAt: now,
    instanceId: CLUSTER_INSTANCE_ID
  }
  inMemoryWorkers.set(params.workerId, info)

  try {
    const redis = getGenericRedis()
    await redis.hset(WORKERS_HASH_KEY, params.workerId, JSON.stringify(info))
    logger.debug(
      { workerId: params.workerId, instanceId: CLUSTER_INSTANCE_ID },
      'RVT_CONVERT worker synced to Redis cluster registry'
    )
  } catch (error) {
    logger.debug(
      { err: error, workerId: params.workerId },
      'Redis sync skipped, using in-memory registry'
    )
  }
}

export const touchWorkerInCluster = async (params: {
  workerId: string
  capabilities?: string[]
  version?: string | null
}) => {
  const now = new Date().toISOString()
  const existingLocal = inMemoryWorkers.get(params.workerId)
  const info: ClusterRvtWorkerInfo = {
    workerId: params.workerId,
    capabilities: params.capabilities || existingLocal?.capabilities || ['rvt'],
    version:
      params.version !== undefined ? params.version : existingLocal?.version ?? null,
    connectedAt: existingLocal?.connectedAt || now,
    lastSeenAt: now,
    instanceId: CLUSTER_INSTANCE_ID
  }
  inMemoryWorkers.set(params.workerId, info)

  try {
    const redis = getGenericRedis()
    await redis.hset(WORKERS_HASH_KEY, params.workerId, JSON.stringify(info))
  } catch (error) {
    logger.debug(
      { err: error, workerId: params.workerId },
      'Redis touch skipped, using in-memory registry'
    )
  }
}

export const removeWorkerFromCluster = async (params: { workerId: string }) => {
  inMemoryWorkers.delete(params.workerId)

  try {
    const redis = getGenericRedis()
    await redis.hdel(WORKERS_HASH_KEY, params.workerId)
    logger.debug(
      { workerId: params.workerId, instanceId: CLUSTER_INSTANCE_ID },
      'RVT_CONVERT worker removed from Redis cluster registry'
    )
  } catch (error) {
    logger.debug(
      { err: error, workerId: params.workerId },
      'Redis removal skipped, using in-memory registry'
    )
  }
}

export const listClusterWorkers = async (): Promise<ClusterRvtWorkerInfo[]> => {
  try {
    const redis = getGenericRedis()
    const all = await redis.hgetall(WORKERS_HASH_KEY)
    if (all && Object.keys(all).length > 0) {
      const now = Date.now()
      const validWorkers: ClusterRvtWorkerInfo[] = []
      const staleKeys: string[] = []

      for (const [workerId, raw] of Object.entries(all)) {
        const parsed = safeParseWorker(raw)
        if (!parsed) {
          staleKeys.push(workerId)
          continue
        }
        const lastSeenTime = new Date(parsed.lastSeenAt).getTime()
        if (now - lastSeenTime > WORKER_STALE_TIMEOUT_MS) {
          staleKeys.push(workerId)
        } else {
          validWorkers.push(parsed)
        }
      }

      if (staleKeys.length > 0) {
        void redis.hdel(WORKERS_HASH_KEY, ...staleKeys).catch(() => undefined)
      }

      return validWorkers
    }
  } catch (error) {
    logger.debug(
      { err: error },
      'Redis listClusterWorkers failed or unavailable, fallback to in-memory'
    )
  }

  // 降级使用本地内存镜像
  const now = Date.now()
  return Array.from(inMemoryWorkers.values()).filter((w) => {
    const lastSeen = new Date(w.lastSeenAt).getTime()
    return now - lastSeen <= WORKER_STALE_TIMEOUT_MS
  })
}

export const trackClusterTask = async (
  task: Omit<TrackedRvtConversionTask, 'trackedAt'>
) => {
  const trackedTask: TrackedRvtConversionTask = {
    ...task,
    trackedAt: new Date()
  }
  inMemoryTasks.set(task.taskId, trackedTask)

  try {
    const redis = getGenericRedis()
    const key = `${TASK_KEY_PREFIX}${task.taskId}`
    const payload = {
      ...task,
      trackedAt: trackedTask.trackedAt.toISOString()
    }
    await redis.set(key, JSON.stringify(payload), 'EX', TASK_TTL_SECONDS)
  } catch (error) {
    logger.debug(
      { err: error, taskId: task.taskId },
      'Redis track task skipped, using in-memory'
    )
  }
}

export const getClusterTask = async (
  taskId: string
): Promise<TrackedRvtConversionTask | null> => {
  try {
    const redis = getGenericRedis()
    const key = `${TASK_KEY_PREFIX}${taskId}`
    const raw = await redis.get(key)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TrackedRvtConversionTask>
      if (parsed.taskId && parsed.projectId) {
        return {
          taskId: parsed.taskId,
          projectId: parsed.projectId,
          modelId: parsed.modelId || '',
          sourceFileId: parsed.sourceFileId || '',
          workerIds: parsed.workerIds || [],
          trackedAt: parsed.trackedAt ? new Date(parsed.trackedAt) : new Date()
        }
      }
    }
  } catch (error) {
    logger.debug(
      { err: error, taskId },
      'Redis get task failed or unavailable, fallback to in-memory'
    )
  }

  return inMemoryTasks.get(taskId) || null
}

export const untrackClusterTask = async (taskId: string) => {
  inMemoryTasks.delete(taskId)

  try {
    const redis = getGenericRedis()
    const key = `${TASK_KEY_PREFIX}${taskId}`
    await redis.del(key)
  } catch (error) {
    logger.debug({ err: error, taskId }, 'Redis untrack task skipped, using in-memory')
  }
}
