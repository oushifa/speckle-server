import { getRvtConversionSpeckleServerOrigin } from '@/modules/shared/helpers/envHelper'
import type { RvtConversionJob } from '@/modules/rvt-conversion/repositories/jobs'
import { getAvailableRvtWorker } from '@/modules/rvt-conversion/services/workerRegistry'

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
    throw new Error('No connected RVT worker is available.')
  }

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
    speckleServerUrl: getRvtConversionSpeckleServerOrigin(),
    speckleToken: params.speckleToken,
    speckleTokenId: params.speckleTokenId,
    versionMessage: params.job.versionMessage,
    sourceApplication: params.job.sourceApplication
  }

  await new Promise<void>((resolve, reject) => {
    try {
      worker.socket.send(JSON.stringify(payload), (error) => {
        if (error)
          return reject(
            error instanceof Error
              ? error
              : new Error('Failed to dispatch RVT conversion job over WebSocket.')
          )

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
}
