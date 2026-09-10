import { getRvtConversionSpeckleServerOrigin } from '@/modules/shared/helpers/envHelper'
import type WebSocket from 'ws'
import type { RvtConversionJob } from '@/modules/rvt-conversion/repositories/jobs'
import {
  buildRvtJobLogContext,
  createRvtConvertLogger
} from '@/modules/rvt-conversion/services/logging'
import { listOpenRvtWorkers } from '@/modules/rvt-conversion/services/workerRegistry'
import {
  getTrackedRvtConversionTask,
  trackRvtConversionTask,
  untrackRvtConversionTask
} from '@/modules/rvt-conversion/services/taskRegistry'
import {
  listClusterWorkers,
  trackClusterTask,
  untrackClusterTask
} from '@/modules/rvt-conversion/services/clusterRegistry'
import { broadcastJobToCluster } from '@/modules/rvt-conversion/services/clusterDispatcher'

const rvtDispatcherLogger = createRvtConvertLogger('ws-dispatcher')

/** 停止（删除）转换任务时下发给 Worker 的消息类型 */
const RVT_WORKER_DELETE_MESSAGE_TYPE = 'delete'

export type DispatchRvtConversionJobPayload = {
  job: RvtConversionJob
  sourceFileUrl: string
  speckleToken: string
  speckleTokenId: string
  branchName?: string | null
  fileType?: string | null
}

const resolveTargetFileType = (params: {
  fileType?: string | null
  job: RvtConversionJob
}) => {
  if (params.fileType && params.fileType.trim()) {
    return params.fileType.trim().toLowerCase().replace(/^\./, '')
  }
  if (params.job.sourceFileName) {
    const ext = params.job.sourceFileName.split('.').pop()
    if (ext && ext !== params.job.sourceFileName) {
      return ext.trim().toLowerCase()
    }
  }
  return 'rvt'
}

const buildWorkerDispatchLogContext = (params: {
  job: RvtConversionJob
  workerId: string
  branchName?: string | null
  fileType?: string | null
}) => ({
  ...buildRvtJobLogContext(params.job),
  workerId: params.workerId,
  branchName: params.branchName || null,
  fileType: params.fileType || null,
  sourceApplication: params.job.sourceApplication,
  hasVersionMessage: !!params.job.versionMessage
})

const buildStartConversionPayload = (params: {
  job: RvtConversionJob
  workerId: string
  sourceFileUrl: string
  speckleServerUrl: string
  speckleToken: string
  speckleTokenId: string
  branchName?: string | null
  fileType: string
}) => ({
  type: 'start_rvt_conversion',
  taskId: params.job.id,
  workerId: params.workerId,
  projectId: params.job.projectId,
  modelId: params.job.modelId,
  fileType: params.fileType,
  ...(params.branchName ? { branchName: params.branchName } : {}),
  fileId: params.job.sourceFileId,
  fileName: params.job.sourceFileName,
  sourceFileUrl: params.sourceFileUrl,
  speckleServerUrl: params.speckleServerUrl,
  speckleToken: params.speckleToken,
  speckleTokenId: params.speckleTokenId,
  versionMessage: params.job.versionMessage,
  sourceApplication: params.job.sourceApplication
})

/**
 * 向 Worker 发送删除（停止转换）指令。
 * Worker 侧收到 {"type":"delete","taskId":"xxx"} 后会终止该任务的转换进程并清理临时文件。
 */
const sendDeleteTaskToWorker = (params: {
  workerId: string
  socket: WebSocket
  taskId: string
}) =>
  new Promise<void>((resolve, reject) => {
    try {
      params.socket.send(
        JSON.stringify({
          type: RVT_WORKER_DELETE_MESSAGE_TYPE,
          taskId: params.taskId
        }),
        (error) => {
          if (error) return reject(error)
          resolve()
        }
      )
    } catch (error) {
      reject(
        error instanceof Error
          ? error
          : new Error('Failed to send delete message to RVT worker.')
      )
    }
  })

const sendStartConversionToWorker = (params: {
  job: RvtConversionJob
  workerId: string
  socket: WebSocket
  sourceFileUrl: string
  speckleServerUrl: string
  speckleToken: string
  speckleTokenId: string
  branchName?: string | null
  fileType: string
}) =>
  new Promise<void>((resolve, reject) => {
    const payload = buildStartConversionPayload({
      job: params.job,
      workerId: params.workerId,
      sourceFileUrl: params.sourceFileUrl,
      speckleServerUrl: params.speckleServerUrl,
      speckleToken: params.speckleToken,
      speckleTokenId: params.speckleTokenId,
      fileType: params.fileType,
      ...(params.branchName ? { branchName: params.branchName } : {})
    })

    try {
      params.socket.send(JSON.stringify(payload), (error) => {
        if (error) return reject(error)
        resolve()
      })
    } catch (error) {
      reject(
        error instanceof Error
          ? error
          : new Error('Failed to dispatch RVT conversion job over WebSocket.')
      )
    }
  })

export const dispatchRvtConversionJob = async (
  params: DispatchRvtConversionJobPayload
) => {
  const targetFileType = resolveTargetFileType(params)
  const localOpenWorkers = listOpenRvtWorkers()
  const clusterWorkers = await listClusterWorkers().catch(() => [])

  const combinedWorkersMap = new Map<
    string,
    { workerId: string; capabilities: string[]; isLocal: boolean }
  >()

  for (const cw of clusterWorkers) {
    combinedWorkersMap.set(cw.workerId, {
      workerId: cw.workerId,
      capabilities: cw.capabilities,
      isLocal: false
    })
  }

  for (const lw of localOpenWorkers) {
    combinedWorkersMap.set(lw.workerId, {
      workerId: lw.workerId,
      capabilities: lw.capabilities,
      isLocal: true
    })
  }

  const allAvailableWorkers = Array.from(combinedWorkersMap.values())
  const matchingWorkers = allAvailableWorkers.filter((worker) => {
    const caps = worker.capabilities.map((c) => c.toLowerCase())
    return caps.includes(targetFileType) || caps.includes('*') || caps.includes('all')
  })

  if (!matchingWorkers.length) {
    rvtDispatcherLogger.warn(
      {
        ...buildRvtJobLogContext(params.job),
        targetFileType,
        availableWorkerCapabilities: allAvailableWorkers.map((w) => ({
          workerId: w.workerId,
          capabilities: w.capabilities,
          isLocal: w.isLocal
        }))
      },
      `RVT_CONVERT worker unavailable for file type: ${targetFileType}`
    )
    throw new Error(`No connected worker is available for file type: ${targetFileType}`)
  }

  const speckleServerUrl = getRvtConversionSpeckleServerOrigin()
  const targetedWorkerIds = matchingWorkers.map((worker) => worker.workerId)

  rvtDispatcherLogger.info(
    {
      ...buildRvtJobLogContext(params.job),
      targetedWorkerIds,
      sourceFileUrlOrigin: new URL(params.sourceFileUrl).origin,
      speckleServerUrl,
      speckleTokenId: params.speckleTokenId,
      branchName: params.branchName || null,
      sourceApplication: params.job.sourceApplication,
      hasVersionMessage: !!params.job.versionMessage
    },
    'RVT_CONVERT start_rvt_conversion broadcast started'
  )

  trackRvtConversionTask({
    taskId: params.job.id,
    projectId: params.job.projectId,
    modelId: params.job.modelId,
    sourceFileId: params.job.sourceFileId,
    workerIds: targetedWorkerIds
  })
  void trackClusterTask({
    taskId: params.job.id,
    projectId: params.job.projectId,
    modelId: params.job.modelId,
    sourceFileId: params.job.sourceFileId,
    workerIds: targetedWorkerIds
  }).catch(() => undefined)

  // 1. 尝试匹配本地连接的 Worker
  const localMatchingWorkers = localOpenWorkers.filter((worker) => {
    const caps = worker.capabilities.map((c) => c.toLowerCase())
    return caps.includes(targetFileType) || caps.includes('*') || caps.includes('all')
  })

  if (localMatchingWorkers.length > 0) {
    const results = await Promise.allSettled(
      localMatchingWorkers.map(async (worker) => {
        rvtDispatcherLogger.info(
          buildWorkerDispatchLogContext({
            job: params.job,
            workerId: worker.workerId,
            branchName: params.branchName,
            fileType: targetFileType
          }),
          'RVT_CONVERT sending start_rvt_conversion to local worker'
        )

        await sendStartConversionToWorker({
          job: params.job,
          workerId: worker.workerId,
          socket: worker.socket,
          sourceFileUrl: params.sourceFileUrl,
          speckleServerUrl,
          speckleToken: params.speckleToken,
          speckleTokenId: params.speckleTokenId,
          fileType: targetFileType,
          ...(params.branchName ? { branchName: params.branchName } : {})
        })

        rvtDispatcherLogger.info(
          buildWorkerDispatchLogContext({
            job: params.job,
            workerId: worker.workerId,
            branchName: params.branchName,
            fileType: targetFileType
          }),
          'RVT_CONVERT sent start_rvt_conversion to local worker successfully'
        )
      })
    )

    const succeededWorkerIds: string[] = []
    const failedWorkerIds: string[] = []
    results.forEach((result, index) => {
      const worker = localMatchingWorkers[index]
      if (result.status === 'fulfilled') {
        succeededWorkerIds.push(worker.workerId)
        return
      }

      failedWorkerIds.push(worker.workerId)
      rvtDispatcherLogger.error(
        {
          ...buildWorkerDispatchLogContext({
            job: params.job,
            workerId: worker.workerId,
            branchName: params.branchName
          }),
          err: result.reason
        },
        'RVT_CONVERT start_rvt_conversion dispatch failed for local worker'
      )
    })

    if (succeededWorkerIds.length > 0) {
      rvtDispatcherLogger.info(
        {
          ...buildRvtJobLogContext(params.job),
          targetedWorkerIds,
          succeededWorkerIds,
          failedWorkerIds,
          succeededWorkerCount: succeededWorkerIds.length,
          failedWorkerCount: failedWorkerIds.length
        },
        'RVT_CONVERT start_rvt_conversion local dispatch completed'
      )
      return
    }

    untrackRvtConversionTask(params.job.id)
    void untrackClusterTask(params.job.id).catch(() => undefined)
    rvtDispatcherLogger.error(
      {
        ...buildRvtJobLogContext(params.job),
        failedWorkerIds
      },
      'RVT_CONVERT start_rvt_conversion broadcast failed for all workers'
    )
    throw new Error('Failed to dispatch RVT conversion job over WebSocket.')
  }

  // 2. 若本地无可用连接或本地派发均失败，跨 Pod 通过 Redis 广播调度
  rvtDispatcherLogger.info(
    {
      ...buildRvtJobLogContext(params.job),
      targetedWorkerIds,
      targetFileType
    },
    'RVT_CONVERT dispatching via Redis cluster broadcast to remote workers'
  )

  try {
    const basePayload = buildStartConversionPayload({
      job: params.job,
      workerId: targetedWorkerIds[0] || 'worker',
      sourceFileUrl: params.sourceFileUrl,
      speckleServerUrl,
      speckleToken: params.speckleToken,
      speckleTokenId: params.speckleTokenId,
      fileType: targetFileType,
      ...(params.branchName ? { branchName: params.branchName } : {})
    })

    const confirmedWorkerIds = await broadcastJobToCluster({
      targetWorkerIds: targetedWorkerIds,
      targetFileType,
      payload: basePayload
    })

    rvtDispatcherLogger.info(
      {
        ...buildRvtJobLogContext(params.job),
        targetedWorkerIds,
        confirmedWorkerIds
      },
      'RVT_CONVERT cluster broadcast dispatch confirmed successfully'
    )
  } catch (error) {
    untrackRvtConversionTask(params.job.id)
    void untrackClusterTask(params.job.id).catch(() => undefined)
    rvtDispatcherLogger.error(
      {
        ...buildRvtJobLogContext(params.job),
        err: error,
        targetedWorkerIds
      },
      'RVT_CONVERT cluster broadcast dispatch failed'
    )
    throw error instanceof Error
      ? error
      : new Error('Failed to dispatch RVT conversion job over cluster broadcast.')
  }
}

/**
 * 通知 Worker 停止（删除）指定的转换任务：{"type":"delete","taskId":"..."}
 *
 * - 优先下发给派发时记录的目标 Worker：本机连接的直接走 WebSocket，其他节点的通过 Redis 集群广播；
 * - 没有派发记录时退化为广播给所有本机在线 Worker。
 */
export const dispatchRvtConversionCancellation = async (params: {
  taskId: string
  fileType?: string | null
}): Promise<{ localWorkerIds: string[]; clusterWorkerIds: string[] }> => {
  const trackedTask = getTrackedRvtConversionTask(params.taskId)
  const targetWorkerIds = trackedTask?.workerIds?.length ? trackedTask.workerIds : []
  const localOpenWorkers = listOpenRvtWorkers()

  const localTargets = targetWorkerIds.length
    ? localOpenWorkers.filter((worker) => targetWorkerIds.includes(worker.workerId))
    : localOpenWorkers

  const localWorkerIds: string[] = []
  await Promise.allSettled(
    localTargets.map(async (worker) => {
      try {
        await sendDeleteTaskToWorker({
          workerId: worker.workerId,
          socket: worker.socket,
          taskId: params.taskId
        })
        localWorkerIds.push(worker.workerId)

        rvtDispatcherLogger.info(
          { taskId: params.taskId, workerId: worker.workerId },
          'RVT_CONVERT delete message sent to local worker'
        )
      } catch (error) {
        rvtDispatcherLogger.error(
          { err: error, taskId: params.taskId, workerId: worker.workerId },
          'RVT_CONVERT failed to send delete message to local worker'
        )
      }
    })
  )

  const clusterWorkers = await listClusterWorkers().catch(() => [])
  const remoteTargetIds = (
    targetWorkerIds.length
      ? targetWorkerIds
      : clusterWorkers.map((worker) => worker.workerId)
  ).filter(
    (workerId) => !localOpenWorkers.some((worker) => worker.workerId === workerId)
  )

  let clusterWorkerIds: string[] = []
  if (remoteTargetIds.length) {
    try {
      clusterWorkerIds = await broadcastJobToCluster({
        targetWorkerIds: remoteTargetIds,
        targetFileType: params.fileType || 'all',
        payload: {
          type: RVT_WORKER_DELETE_MESSAGE_TYPE,
          taskId: params.taskId
        }
      })

      rvtDispatcherLogger.info(
        { taskId: params.taskId, remoteTargetIds, clusterWorkerIds },
        'RVT_CONVERT delete message broadcast to cluster workers'
      )
    } catch (error) {
      rvtDispatcherLogger.warn(
        { err: error, taskId: params.taskId, remoteTargetIds },
        'RVT_CONVERT delete message cluster broadcast failed'
      )
    }
  }

  untrackRvtConversionTask(params.taskId)
  void untrackClusterTask(params.taskId).catch(() => undefined)

  return { localWorkerIds, clusterWorkerIds }
}
