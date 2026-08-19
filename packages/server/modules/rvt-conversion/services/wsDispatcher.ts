import { getRvtConversionSpeckleServerOrigin } from '@/modules/shared/helpers/envHelper'
import type WebSocket from 'ws'
import type { RvtConversionJob } from '@/modules/rvt-conversion/repositories/jobs'
import {
  buildRvtJobLogContext,
  createRvtConvertLogger
} from '@/modules/rvt-conversion/services/logging'
import { listOpenRvtWorkers } from '@/modules/rvt-conversion/services/workerRegistry'
import {
  trackRvtConversionTask,
  untrackRvtConversionTask
} from '@/modules/rvt-conversion/services/taskRegistry'

const rvtDispatcherLogger = createRvtConvertLogger('ws-dispatcher')

export type DispatchRvtConversionJobPayload = {
  job: RvtConversionJob
  sourceFileUrl: string
  speckleToken: string
  speckleTokenId: string
  branchName?: string | null
}

const buildWorkerDispatchLogContext = (params: {
  job: RvtConversionJob
  workerId: string
  branchName?: string | null
}) => ({
  ...buildRvtJobLogContext(params.job),
  workerId: params.workerId,
  branchName: params.branchName || null,
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
}) => ({
  type: 'start_rvt_conversion',
  taskId: params.job.id,
  workerId: params.workerId,
  projectId: params.job.projectId,
  modelId: params.job.modelId,
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

const sendStartConversionToWorker = (params: {
  job: RvtConversionJob
  workerId: string
  socket: WebSocket
  sourceFileUrl: string
  speckleServerUrl: string
  speckleToken: string
  speckleTokenId: string
  branchName?: string | null
}) =>
  new Promise<void>((resolve, reject) => {
    const payload = buildStartConversionPayload({
      job: params.job,
      workerId: params.workerId,
      sourceFileUrl: params.sourceFileUrl,
      speckleServerUrl: params.speckleServerUrl,
      speckleToken: params.speckleToken,
      speckleTokenId: params.speckleTokenId,
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
  const workers = listOpenRvtWorkers()
  if (!workers.length) {
    rvtDispatcherLogger.warn(
      {
        ...buildRvtJobLogContext(params.job)
      },
      'RVT_CONVERT worker unavailable for dispatch'
    )
    throw new Error('No connected RVT worker is available.')
  }

  const speckleServerUrl = getRvtConversionSpeckleServerOrigin()
  const targetedWorkerIds = workers.map((worker) => worker.workerId)

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

  const results = await Promise.allSettled(
    workers.map(async (worker) => {
      rvtDispatcherLogger.info(
        buildWorkerDispatchLogContext({
          job: params.job,
          workerId: worker.workerId,
          branchName: params.branchName
        }),
        'RVT_CONVERT sending start_rvt_conversion to worker'
      )

      await sendStartConversionToWorker({
        job: params.job,
        workerId: worker.workerId,
        socket: worker.socket,
        sourceFileUrl: params.sourceFileUrl,
        speckleServerUrl,
        speckleToken: params.speckleToken,
        speckleTokenId: params.speckleTokenId,
        ...(params.branchName ? { branchName: params.branchName } : {})
      })

      rvtDispatcherLogger.info(
        buildWorkerDispatchLogContext({
          job: params.job,
          workerId: worker.workerId,
          branchName: params.branchName
        }),
        'RVT_CONVERT sent start_rvt_conversion to worker successfully'
      )
    })
  )

  const succeededWorkerIds: string[] = []
  const failedWorkerIds: string[] = []
  results.forEach((result, index) => {
    const worker = workers[index]
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
      'RVT_CONVERT start_rvt_conversion dispatch failed for worker'
    )
  })

  if (!succeededWorkerIds.length) {
    untrackRvtConversionTask(params.job.id)
    rvtDispatcherLogger.error(
      {
        ...buildRvtJobLogContext(params.job),
        failedWorkerIds
      },
      'RVT_CONVERT start_rvt_conversion broadcast failed for all workers'
    )
    throw new Error('Failed to dispatch RVT conversion job over WebSocket.')
  }

  rvtDispatcherLogger.info(
    {
      ...buildRvtJobLogContext(params.job),
      targetedWorkerIds,
      succeededWorkerIds,
      failedWorkerIds,
      succeededWorkerCount: succeededWorkerIds.length,
      failedWorkerCount: failedWorkerIds.length
    },
    'RVT_CONVERT start_rvt_conversion broadcast completed'
  )
}
