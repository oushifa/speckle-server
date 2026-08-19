import type { EventPayload } from '@/modules/shared/services/eventBus'
import { getEventBus } from '@/modules/shared/services/eventBus'
import { FileuploadEvents } from '@/modules/fileuploads/domain/events'
import { fileUploadsLogger as logger } from '@/observability/logging'
import { throwUncoveredError } from '@speckle/shared'
import type { Knex } from 'knex'
import type { ObserveResult } from '@/modules/fileuploads/observability/metrics'

export const fileuploadTrackingFactory =
  ({ observeResult }: { observeResult?: ObserveResult }) =>
  async (params: EventPayload<'fileupload.*'>) => {
    const { eventName } = params

    switch (eventName) {
      case FileuploadEvents.Started: {
        const {
          payload: { upload }
        } = params
        logger.info(
          {
            fileUploadId: upload.id,
            projectId: upload.projectId || upload.streamId,
            modelId: upload.modelId || null,
            fileName: upload.fileName,
            fileType: upload.fileType,
            fileSize: upload.fileSize,
            userId: upload.userId
          },
          'File upload started'
        )
        break
      }
      case FileuploadEvents.Updated:
        break
      case FileuploadEvents.Finished:
        observeResult?.(params.payload)
        break
      default:
        throwUncoveredError(eventName)
    }
  }

export const initializeEventListenersFactory =
  ({ db, observeResult }: { db: Knex; observeResult?: ObserveResult }) =>
  () => {
    const eventBus = getEventBus()
    const quitCbs = [
      eventBus.listen('fileupload.*', async (payload) => {
        await fileuploadTrackingFactory({
          observeResult
        })(payload)
      })
    ]

    return () => quitCbs.forEach((quit) => quit())
  }
