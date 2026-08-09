import type { Knex } from 'knex'
import { logger } from '@/observability/logging'
import {
  failExpiredActiveRvtConversionJobsFactory,
  type RvtConversionJob
} from '@/modules/rvt-conversion/repositories/jobs'
import {
  getFileInfoFactory,
  updateFileUploadFactory
} from '@/modules/fileuploads/repositories/fileUploads'
import { FileUploadConvertedStatus } from '@/modules/fileuploads/helpers/types'
import { notifyChangeInFileStatus } from '@/modules/fileuploads/services/management'
import { getEventBus } from '@/modules/shared/services/eventBus'
import { RVT_CONVERT_LOG_TAG } from '@/modules/rvt-conversion/services/logging'

const serviceUpdater = 'rvt-conversion-service'
const timeoutErrorMessage = 'RVT convert job timed out'

export const expireOldRvtConversionJobsFactory =
  (deps: { db: Knex }) => async (params: { timeoutThresholdSeconds: number }) => {
    const failExpiredActiveRvtConversionJobs =
      failExpiredActiveRvtConversionJobsFactory({
        db: deps.db
      })
    const getFileInfo = getFileInfoFactory({ db: deps.db })
    const updateFileUpload = updateFileUploadFactory({ db: deps.db })
    const emitFileStatusChange = notifyChangeInFileStatus({
      eventEmit: getEventBus().emit
    })

    const updatedJobs = await failExpiredActiveRvtConversionJobs({
      timeoutThresholdSeconds: params.timeoutThresholdSeconds,
      errorMessage: timeoutErrorMessage,
      updater: serviceUpdater
    })

    await Promise.all(
      updatedJobs.map(async (job: RvtConversionJob) => {
        const fileUpload = await getFileInfo({ fileId: job.sourceFileId })
        if (!fileUpload) {
          logger.warn(
            {
              module: 'rvt-conversion',
              component: 'expiry',
              tag: RVT_CONVERT_LOG_TAG,
              projectId: job.projectId,
              modelId: job.modelId,
              jobId: job.id,
              sourceFileId: job.sourceFileId
            },
            'RVT_CONVERT timed out job source file was not found during expiry sync'
          )
          return
        }

        const updatedFile = await updateFileUpload({
          id: fileUpload.id,
          upload: {
            convertedStatus: FileUploadConvertedStatus.Error,
            convertedMessage: timeoutErrorMessage,
            convertedCommitId: fileUpload.convertedCommitId || null,
            convertedLastUpdate: new Date()
          }
        })

        await emitFileStatusChange({ file: updatedFile })
      })
    )

    return updatedJobs
  }
