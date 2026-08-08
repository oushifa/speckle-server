import { getRvtConversionSpeckleServerOrigin } from '@/modules/shared/helpers/envHelper'
import type { RvtConversionJob } from '@/modules/rvt-conversion/repositories/jobs'
import { getAvailableRvtWorker } from '@/modules/rvt-conversion/services/workerRegistry'
import {
  trackRvtConversionTask,
  untrackRvtConversionTask
} from '@/modules/rvt-conversion/services/taskRegistry'
import { moduleLogger } from '@/observability/logging'

const rvtDispatcherLogger = moduleLogger.child({
  module: 'rvt-conversion',
  component: 'ws-dispatcher'
})

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
        projectId: params.job.projectId,
        modelId: params.job.modelId,
        jobId: params.job.id,
        sourceFileId: params.job.sourceFileId
      },
      'RVT CONVERT worker unavailable for dispatch'
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
      projectId: params.job.projectId,
      modelId: params.job.modelId,
      jobId: params.job.id,
      workerId: worker.workerId,
      sourceFileId: params.job.sourceFileId,
      sourceFileUrlOrigin: new URL(params.sourceFileUrl).origin,
      speckleServerUrl,
      speckleTokenId: params.speckleTokenId,
      branchName: params.branchName || null
    },
    'RVT CONVERT start_rvt_conversion dispatch started'
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
              projectId: params.job.projectId,
              modelId: params.job.modelId,
              jobId: params.job.id,
              workerId: worker.workerId,
              sourceFileId: params.job.sourceFileId,
              err: error
            },
            'RVT CONVERT start_rvt_conversion dispatch failed'
          )
          return reject(
            error instanceof Error
              ? error
              : new Error('Failed to dispatch RVT conversion job over WebSocket.')
          )
        }

        rvtDispatcherLogger.info(
          {
            projectId: params.job.projectId,
            modelId: params.job.modelId,
            jobId: params.job.id,
            workerId: worker.workerId,
            sourceFileId: params.job.sourceFileId
          },
          'RVT CONVERT start_rvt_conversion dispatch completed'
        )

        resolve()
      })
    } catch (error) {
      untrackRvtConversionTask(params.job.id)
      rvtDispatcherLogger.error(
        {
          projectId: params.job.projectId,
          modelId: params.job.modelId,
          jobId: params.job.id,
          workerId: worker.workerId,
          sourceFileId: params.job.sourceFileId,
          err: error
        },
        'RVT CONVERT start_rvt_conversion dispatch threw before send'
      )
      reject(
        error instanceof Error
          ? error
          : new Error('Failed to dispatch RVT conversion job over WebSocket.')
      )
    }
  })
}
