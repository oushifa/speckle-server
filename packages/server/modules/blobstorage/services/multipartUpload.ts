import { getObjectKey } from '@/modules/blobstorage/helpers/blobs'
import { BlobUploadStatus } from '@speckle/shared/blobs'
import {
  AlreadyRegisteredBlobError,
  StoredBlobAccessError
} from '@/modules/blobstorage/errors'
import { UserInputError } from '@/modules/core/errors/userinput'
import { MisconfiguredEnvironmentError } from '@/modules/shared/errors'
import { ensureError, type Optional } from '@speckle/shared'
import type {
  AbortMultipartUploadOperation,
  CompleteMultipartUploadOperation,
  CreateMultipartUploadOperation,
  GetBlob,
  GetBlobMetadataFromStorage,
  GetMultipartUploadPartUrl,
  ListMultipartUploadPartsOperation,
  UpdateBlob,
  UpsertBlob
} from '@/modules/blobstorage/domain/operations'
import type {
  AbortMultipartUpload,
  CompleteMultipartUpload,
  CreateMultipartUpload,
  GetMultipartUploadPartSignedUrl,
  ListMultipartUploadParts
} from '@/modules/blobstorage/domain/storageOperations'
import type { Logger } from '@/observability/logging'

export const createBlobMultipartUploadFactory =
  (deps: {
    getBlob: GetBlob
    createMultipartUpload: CreateMultipartUpload
    upsertBlob: UpsertBlob
    updateBlob: UpdateBlob
    abortMultipartUpload: AbortMultipartUpload
  }): CreateMultipartUploadOperation =>
  async (params) => {
    const { projectId, userId, blobId, fileName } = params
    const fileType = fileName.split('.').pop()
    if (!fileType || fileType === fileName) {
      throw new UserInputError('File name must have a valid extension')
    }

    const existing = await deps.getBlob({ streamId: projectId, blobId })
    if (
      existing &&
      existing.uploadStatus === BlobUploadStatus.Pending &&
      existing.multipartUploadId
    ) {
      // Idempotent re-create: reuse the in-progress multipart upload
      return { uploadId: existing.multipartUploadId }
    }

    const objectKey = getObjectKey(projectId, blobId)
    const { uploadId } = await deps.createMultipartUpload({ objectKey })

    try {
      await deps.upsertBlob({
        id: blobId,
        streamId: projectId,
        userId,
        objectKey,
        fileName,
        fileType,
        uploadStatus: BlobUploadStatus.Pending,
        multipartUploadId: uploadId
      })
    } catch (e) {
      // Avoid leaving an orphaned multipart upload in S3
      await deps.abortMultipartUpload({ objectKey, uploadId }).catch(() => undefined)
      throw e
    }

    // upsertBlob uses ON CONFLICT DO NOTHING, so if the row already existed the
    // multipartUploadId may not have been persisted. Ensure it is.
    await deps.updateBlob({
      id: blobId,
      item: { multipartUploadId: uploadId },
      filter: { streamId: projectId }
    })

    return { uploadId }
  }

export const getBlobMultipartPartUploadUrlFactory =
  (deps: {
    getBlob: GetBlob
    getMultipartUploadPartSignedUrl: GetMultipartUploadPartSignedUrl
  }): GetMultipartUploadPartUrl =>
  async (params) => {
    const { projectId, blobId, uploadId, partNumber, urlExpiryDurationSeconds } = params

    const blob = await deps.getBlob({ streamId: projectId, blobId })
    if (!blob) {
      throw new UserInputError(
        'Please create a multipart upload before requesting part upload urls'
      )
    }
    if (blob.uploadStatus !== BlobUploadStatus.Pending) {
      throw new AlreadyRegisteredBlobError(
        'The blob is not in a pending state and can no longer accept parts'
      )
    }
    if (blob.multipartUploadId !== uploadId) {
      throw new UserInputError('Multipart upload id does not match the stored blob')
    }

    const objectKey = getObjectKey(projectId, blobId)
    return await deps.getMultipartUploadPartSignedUrl({
      objectKey,
      uploadId,
      partNumber,
      urlExpiryDurationSeconds
    })
  }

export const completeBlobMultipartUploadFactory =
  (deps: {
    getBlob: GetBlob
    completeMultipartUpload: CompleteMultipartUpload
    getBlobMetadataFromStorage: GetBlobMetadataFromStorage
    updateBlob: UpdateBlob
    logger: Logger
  }): CompleteMultipartUploadOperation =>
  async (params) => {
    const { projectId, blobId, uploadId, parts, maximumFileSize } = params

    if (!parts || parts.length === 0) {
      throw new UserInputError('Parts are required to complete a multipart upload')
    }
    if (maximumFileSize <= 0) {
      throw new MisconfiguredEnvironmentError(
        'Maximum file size must be greater than 0'
      )
    }

    const existingBlob = await deps.getBlob({ streamId: projectId, blobId })
    if (!existingBlob) {
      throw new UserInputError(
        'Please create a multipart upload before completing it'
      )
    }

    switch (existingBlob.uploadStatus) {
      case BlobUploadStatus.Completed:
        throw new AlreadyRegisteredBlobError('Blob already registered and completed')
      case BlobUploadStatus.Error:
        throw new AlreadyRegisteredBlobError(
          existingBlob.uploadError || 'Blob already registered with an error'
        )
      case BlobUploadStatus.Pending:
        break
    }

    if (existingBlob.multipartUploadId !== uploadId) {
      throw new UserInputError('Multipart upload id does not match the stored blob')
    }

    const objectKey = getObjectKey(projectId, blobId)

    const { eTag } = await deps.completeMultipartUpload({ objectKey, uploadId, parts })

    let contentLength: Optional<number>
    try {
      const metadata = await deps.getBlobMetadataFromStorage({ objectKey })
      contentLength = metadata.contentLength
    } catch (e) {
      throw new StoredBlobAccessError(
        `Failed to get blob metadata for blob ${blobId} in project ${projectId}`,
        { cause: ensureError(e, 'Failed to get blob metadata from storage') }
      )
    }

    if (!contentLength || contentLength > maximumFileSize) {
      await deps.updateBlob({
        id: blobId,
        item: {
          uploadStatus: BlobUploadStatus.Error,
          uploadError:
            '[FILE_SIZE_EXCEEDED] File size exceeds maximum allowed size for the project at the time of upload',
          fileSize: contentLength,
          fileHash: eTag,
          multipartUploadId: null
        },
        filter: { streamId: projectId }
      })
      throw new UserInputError(
        `File size exceeds maximum allowed size of ${maximumFileSize} bytes. Actual size: ${contentLength} bytes`
      )
    }

    const updatedBlob = await deps.updateBlob({
      id: blobId,
      item: {
        uploadStatus: BlobUploadStatus.Completed,
        fileSize: contentLength,
        fileHash: eTag,
        multipartUploadId: null
      },
      filter: { streamId: projectId }
    })
    return updatedBlob
  }

export const abortBlobMultipartUploadFactory =
  (deps: {
    getBlob: GetBlob
    abortMultipartUpload: AbortMultipartUpload
    updateBlob: UpdateBlob
  }): AbortMultipartUploadOperation =>
  async (params) => {
    const { projectId, blobId, uploadId } = params

    const blob = await deps.getBlob({ streamId: projectId, blobId })
    if (!blob || !blob.multipartUploadId) return
    if (blob.multipartUploadId !== uploadId) return

    const objectKey = getObjectKey(projectId, blobId)
    await deps.abortMultipartUpload({ objectKey, uploadId })
    await deps.updateBlob({
      id: blobId,
      item: { multipartUploadId: null },
      filter: { streamId: projectId }
    })
  }

export const listBlobMultipartUploadPartsFactory =
  (deps: {
    getBlob: GetBlob
    listMultipartUploadParts: ListMultipartUploadParts
  }): ListMultipartUploadPartsOperation =>
  async (params) => {
    const { projectId, blobId, uploadId } = params

    const blob = await deps.getBlob({ streamId: projectId, blobId })
    if (!blob) {
      throw new UserInputError(
        'Please create a multipart upload before listing its parts'
      )
    }
    if (blob.multipartUploadId !== uploadId) {
      throw new UserInputError('Multipart upload id does not match the stored blob')
    }

    const objectKey = getObjectKey(projectId, blobId)
    return await deps.listMultipartUploadParts({ objectKey, uploadId })
  }
