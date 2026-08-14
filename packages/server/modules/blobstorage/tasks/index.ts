import { db } from '@/db/knex'
import type { ScheduleExecution } from '@/modules/core/domain/scheduledTasks/operations'
import { getRegisteredDbClients } from '@/modules/multiregion/utils/dbSelector'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import { getFileUploadUrlExpiryMinutes } from '@/modules/shared/helpers/envHelper'
import { TIME } from '@speckle/shared'
import type { ExpirePendingUploads } from '@/modules/blobstorage/domain/operations'
import { expirePendingUploadsFactory } from '@/modules/blobstorage/repositories'
import { abortMultipartUploadFactory } from '@/modules/blobstorage/clients/objectStorage'

export const scheduleBlobPendingUploadExpiry = async ({
  scheduleExecution
}: {
  scheduleExecution: ScheduleExecution
}) => {
  const blobPendingUploadExpiryHandlers: ExpirePendingUploads[] = []
  const regionClients = await getRegisteredDbClients()
  for (const projectDb of [db, ...regionClients]) {
    blobPendingUploadExpiryHandlers.push(expirePendingUploadsFactory({ db: projectDb }))
  }

  const cronExpression = '*/6 * * * *' // every 6 minutes
  return scheduleExecution(
    cronExpression,
    'BlobPendingUploadExpiry',
    async (_, options) => {
      const { logger } = options
      logger.debug('Running BlobPendingUploadExpiry task')
      const items = (
        await Promise.all(
          blobPendingUploadExpiryHandlers.map((handler) =>
            handler({
              timeoutThresholdSeconds:
                (getFileUploadUrlExpiryMinutes() + 1) * TIME.minute, // additional buffer of 1 minute
              errMessage:
                '[EXPIRED_PENDING_UPLOAD] Upload did not complete within the expected time frame.'
            })
          )
        )
      ).flat()

      // Abort any in-progress S3 multipart uploads for expired blobs so that
      // partially uploaded parts do not linger in object storage.
      await Promise.all(
        items
          .filter((item) => item.multipartUploadId && item.objectKey)
          .map(async (item) => {
            try {
              const storage = await getProjectObjectStorage({
                projectId: item.streamId
              })
              await abortMultipartUploadFactory({ objectStorage: storage.private })({
                objectKey: item.objectKey!,
                uploadId: item.multipartUploadId!
              })
            } catch (err) {
              logger.warn(
                { err, blobId: item.id, projectId: item.streamId },
                'Failed to abort expired multipart upload'
              )
            }
          })
      )

      logger.info(
        `BlobPendingUploadExpiry task completed. Processed ${items.length} items.`
      )
    }
  )
}
