import type { CompleteMultipartUploadOperation } from '@/modules/blobstorage/domain/operations'
import type { GetBranchesByIds } from '@/modules/core/domain/branches/operations'
import type {
  GetFileInfoV2,
  InsertNewUploadAndNotify,
  InsertNewUploadAndNotifyV2,
  RegisterMultipartUploadCompleteAndStartFileImport
} from '@/modules/fileuploads/domain/operations'
import { fileUploadsLogger as logger } from '@/observability/logging'
import { startFileImportAfterBlobCompletedFactory } from '@/modules/fileuploads/services/presigned'

export const registerMultipartUploadCompleteAndStartFileImportFactory = (deps: {
  completeMultipartUpload: CompleteMultipartUploadOperation
  insertNewUploadAndNotify: InsertNewUploadAndNotifyV2 | InsertNewUploadAndNotify
  getModelsByIds: GetBranchesByIds
  getFileInfo: GetFileInfoV2
}): RegisterMultipartUploadCompleteAndStartFileImport => {
  const { completeMultipartUpload } = deps
  const startFileImport = startFileImportAfterBlobCompletedFactory(deps)
  return async (params) => {
    const { projectId, modelId, fileId, userId, uploadId, parts, maximumFileSize } =
      params
    const storedBlob = await completeMultipartUpload({
      projectId,
      blobId: fileId,
      uploadId,
      parts,
      maximumFileSize
    })

    logger.info(
      {
        fileUploadId: storedBlob.id,
        projectId: storedBlob.streamId,
        modelId,
        fileName: storedBlob.fileName,
        fileType: storedBlob.fileType,
        fileSize: storedBlob.fileSize,
        uploadId,
        partCount: parts.length,
        userId
      },
      'Multipart model upload completed and file import scheduled'
    )

    return await startFileImport({
      projectId,
      modelId,
      userId,
      storedBlob
    })
  }
}
