import { getRvtConversionSpeckleServerOrigin } from '@/modules/shared/helpers/envHelper'
import type { RvtConversionJob } from '@/modules/rvt-conversion/repositories/jobs'
import {
  buildRvtJobLogContext,
  createRvtConvertLogger
} from '@/modules/rvt-conversion/services/logging'
import { getAvailableRvtWorker } from '@/modules/rvt-conversion/services/workerRegistry'
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

export const dispatchRvtConversionJob = async (
  params: DispatchRvtConversionJobPayload
) => {
  const worker = getAvailableRvtWorker()
  if (!worker) {
    rvtDispatcherLogger.warn(
      {
        ...buildRvtJobLogContext(params.job)
      },
      'RVT_CONVERT worker unavailable for dispatch'
    )
    throw new Error('No connected RVT worker is available.')
  }

  const speckleServerUrl = getRvtConversionSpeckleServerOrigin()
  const payload = {
    type: 'start_rvt_conversion',
    taskId: params.job.id,
    workerId: worker.workerId,
    projectId: params.job.projectId,
    modelId: params.job.modelId,
    ...(params.branchName ? { branchName: params.branchName } : {}),
    fileId: params.job.sourceFileId,
    fileName: params.job.sourceFileName,
    sourceFileUrl: params.sourceFileUrl,
    speckleServerUrl,
    speckleToken: params.speckleToken,
    speckleTokenId: params.speckleTokenId,
    versionMessage: params.job.versionMessage,
    sourceApplication: params.job.sourceApplication
  }

  rvtDispatcherLogger.info(
    {
      ...buildRvtJobLogContext(params.job),
      workerId: worker.workerId,
      sourceFileUrlOrigin: new URL(params.sourceFileUrl).origin,
      speckleServerUrl,
      speckleTokenId: params.speckleTokenId,
      branchName: params.branchName || null,
      sourceApplication: params.job.sourceApplication,
      hasVersionMessage: !!params.job.versionMessage
    },
    'RVT_CONVERT start_rvt_conversion dispatch started'
  )

  trackRvtConversionTask({
    taskId: params.job.id,
    projectId: params.job.projectId,
    modelId: params.job.modelId,
    sourceFileId: params.job.sourceFileId,
    workerId: worker.workerId
  })

  await new Promise<void>((resolve, reject) => {
    try {
      worker.socket.send(JSON.stringify(payload), (error) => {
        if (error) {
          untrackRvtConversionTask(params.job.id)
          rvtDispatcherLogger.error(
            {
              ...buildRvtJobLogContext(params.job),
              workerId: worker.workerId,
              err: error
            },
            'RVT_CONVERT start_rvt_conversion dispatch failed'
          )
          return reject(
            error instanceof Error
              ? error
              : new Error('Failed to dispatch RVT conversion job over WebSocket.')
          )
        }

        rvtDispatcherLogger.info(
          {
            ...buildRvtJobLogContext(params.job),
            workerId: worker.workerId
          },
          'RVT_CONVERT start_rvt_conversion dispatch completed'
        )

        resolve()
      })
    } catch (error) {
      untrackRvtConversionTask(params.job.id)
      rvtDispatcherLogger.error(
        {
          ...buildRvtJobLogContext(params.job),
          workerId: worker.workerId,
          err: error
        },
        'RVT_CONVERT start_rvt_conversion dispatch threw before send'
      )
      reject(
        error instanceof Error
          ? error
          : new Error('Failed to dispatch RVT conversion job over WebSocket.')
      )
    }
  })
}
