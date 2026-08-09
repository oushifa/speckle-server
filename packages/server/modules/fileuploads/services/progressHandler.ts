import type { Logger } from '@/observability/logging'
import type {
  GetFileInfoV2,
  UpdateFileUpload
} from '@/modules/fileuploads/domain/operations'
import { FileImportJobNotFoundError } from '@/modules/fileuploads/helpers/errors'
import { FileUploadConvertedStatus } from '@/modules/fileuploads/helpers/types'
import type { EventBusEmit } from '@/modules/shared/services/eventBus'
import { FileuploadEvents } from '@/modules/fileuploads/domain/events'

type OnFileImportProgressDeps = {
  getFileInfo: GetFileInfoV2
  updateFileUpload: UpdateFileUpload
  eventEmit: EventBusEmit
  logger: Logger
}

type FileImportProgressPayload = {
  blobId: string
  progressPercent: number | null
  progressPhase: string | null
  progressMessage: string | null
}

const clampProgressPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return null
  return Math.max(0, Math.min(100, Math.round(value)))
}

export const onFileImportProgressFactory =
  (deps: OnFileImportProgressDeps) =>
  async (params: FileImportProgressPayload) => {
    const fileInfo = await deps.getFileInfo({ fileId: params.blobId })
    if (!fileInfo) {
      throw new FileImportJobNotFoundError(
        `File upload with ID ${params.blobId} not found`
      )
    }

    const progressPercent = clampProgressPercent(params.progressPercent)
    const updatedFile = await deps.updateFileUpload({
      id: params.blobId,
      upload: {
        convertedStatus: FileUploadConvertedStatus.Converting,
        convertedLastUpdate: new Date(),
        progressPercent,
        progressPhase: params.progressPhase,
        progressMessage: params.progressMessage
      }
    })

    await deps.eventEmit({
      eventName: FileuploadEvents.Updated,
      payload: {
        upload: {
          ...updatedFile,
          projectId: fileInfo.projectId
        },
        isNewModel: false
      }
    })

    deps.logger.info(
      {
        blobId: params.blobId,
        progressPercent,
        progressPhase: params.progressPhase
      },
      'File import progress updated'
    )
  }
