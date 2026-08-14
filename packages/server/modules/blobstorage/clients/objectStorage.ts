import {
  getS3AccessKey,
  getS3BucketName,
  getS3FrontendOriginEndpointOverrides,
  getS3Endpoint,
  getS3PublicEndpoint,
  getS3Region,
  getS3SecretKey
} from '@/modules/shared/helpers/envHelper'
import type { S3ClientConfig } from '@aws-sdk/client-s3'
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from '@aws-sdk/client-s3'
import type { ListPartsCommandOutput } from '@aws-sdk/client-s3'
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Optional } from '@speckle/shared'
import { BadRequestError } from '@/modules/shared/errors'
import type {
  GetBlobMetadataFromStorage,
  GetSignedUrl
} from '@/modules/blobstorage/domain/operations'
import type {
  AbortMultipartUpload,
  CompleteMultipartUpload,
  CreateMultipartUpload,
  GetMultipartUploadPartSignedUrl,
  ListMultipartUploadParts
} from '@/modules/blobstorage/domain/storageOperations'

export type GetProjectObjectStorage = (args: {
  projectId: string
}) => Promise<ObjectStorage>

export type GetObjectStorageParams = {
  credentials: {
    accessKeyId: string
    secretAccessKey: string
  }
  endpoint: string
  region: string
  bucket: string
}

export type ObjectStorage = {
  client: S3Client
  bucket: string
  params: GetObjectStorageParams
}

/**
 * Get object storage client
 */
export const getObjectStorage = (params: GetObjectStorageParams): ObjectStorage => {
  const { bucket, credentials, endpoint, region } = params

  const config: S3ClientConfig = {
    credentials,
    endpoint,
    region,
    forcePathStyle: true
  }
  const client = new S3Client(config)
  return { client, bucket, params }
}

let mainObjectStorage: Optional<ObjectStorage> = undefined
let publicMainObjectStorage: Optional<ObjectStorage> = undefined

/**
 * Get main object storage client
 *
 * This is used for connecting the server to the S3 host. Where the S3 host is
 * on the same private network as the server (e.g. in a Docker network),
 * the S3_ENDPOINT can use the private IP or DNS name of the S3 host.
 *
 * S3_PUBLIC_ENDPOINT can be used to connect to the S3 host via the
 * public internet (or localhost network if running locally or testing).
 */
export const getMainObjectStorage = (): ObjectStorage => {
  if (mainObjectStorage) return mainObjectStorage

  const mainParams: GetObjectStorageParams = {
    credentials: {
      accessKeyId: getS3AccessKey(),
      secretAccessKey: getS3SecretKey()
    },
    endpoint: getS3Endpoint(),
    region: getS3Region(),
    bucket: getS3BucketName()
  }

  mainObjectStorage = getObjectStorage(mainParams)
  return mainObjectStorage
}

/**
 * (Optional) Used to connect to the S3 host via the public endpoint.
 * This is useful for clients that need to access the S3 bucket directly, e.g
 * during testing or when the S3 host is not on the same private network as the server.
 *
 * If `S3_PUBLIC_ENDPOINT` is not set, it will return the same object storage
 * as `getMainObjectStorage`.
 */
export const getPublicMainObjectStorage = (): ObjectStorage => {
  if (publicMainObjectStorage) return publicMainObjectStorage

  const endpoint = getS3PublicEndpoint()
  if (!endpoint) {
    // If no public endpoint is set, return the main object storage
    return getMainObjectStorage()
  }

  const mainParams: GetObjectStorageParams = {
    credentials: {
      accessKeyId: getS3AccessKey(),
      secretAccessKey: getS3SecretKey()
    },
    endpoint,
    region: getS3Region(),
    bucket: getS3BucketName()
  }

  publicMainObjectStorage = getObjectStorage(mainParams)
  return publicMainObjectStorage
}

export const getDynamicPublicObjectStorage = (params: {
  objectStorage: ObjectStorage
  frontendOrigin?: string
}): ObjectStorage => {
  const { objectStorage, frontendOrigin } = params
  if (!frontendOrigin) return objectStorage

  try {
    const configuredEndpoint = new URL(objectStorage.params.endpoint)
    const resolvedFrontendOrigin = new URL(frontendOrigin)
    const overrideEndpoint = getS3FrontendOriginEndpointOverrides().find((override) =>
      override.frontendOrigins.includes(resolvedFrontendOrigin.origin)
    )?.endpoint

    if (overrideEndpoint) {
      if (overrideEndpoint === configuredEndpoint.origin) {
        return objectStorage
      }

      return getObjectStorage({
        ...objectStorage.params,
        endpoint: overrideEndpoint
      })
    }

    if (configuredEndpoint.hostname === resolvedFrontendOrigin.hostname) {
      return objectStorage
    }

    configuredEndpoint.hostname = resolvedFrontendOrigin.hostname

    return getObjectStorage({
      ...objectStorage.params,
      endpoint: configuredEndpoint.toString()
    })
  } catch {
    return objectStorage
  }
}

export const getSignedUrlFactory = (deps: {
  objectStorage: ObjectStorage
}): GetSignedUrl => {
  const { objectStorage } = deps
  const { client, bucket } = objectStorage
  return async (params) => {
    const { objectKey, urlExpiryDurationSeconds } = params
    const command = new PutObjectCommand({ Bucket: bucket, Key: objectKey })
    return s3GetSignedUrl(client, command, { expiresIn: urlExpiryDurationSeconds })
  }
}

export const getSignedDownloadUrlFactory = (deps: {
  objectStorage: ObjectStorage
}): GetSignedUrl => {
  const { objectStorage } = deps
  const { client, bucket } = objectStorage
  return async (params) => {
    const { objectKey, urlExpiryDurationSeconds } = params
    const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey })
    return s3GetSignedUrl(client, command, { expiresIn: urlExpiryDurationSeconds })
  }
}

export const getBlobMetadataFromStorage = (deps: {
  objectStorage: ObjectStorage
}): GetBlobMetadataFromStorage => {
  const { objectStorage } = deps
  const { client, bucket } = objectStorage

  return async (params) => {
    const { objectKey } = params

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/HeadObjectCommand/
    const headObjectCommand = new HeadObjectCommand({ Bucket: bucket, Key: objectKey })
    const metadata = await client.send(headObjectCommand)
    return {
      contentLength: metadata.ContentLength,
      eTag: metadata.ETag
    }
  }
}

export const createMultipartUploadFactory = (deps: {
  objectStorage: ObjectStorage
}): CreateMultipartUpload => {
  const { objectStorage } = deps
  const { client, bucket } = objectStorage

  return async ({ objectKey }) => {
    const command = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: objectKey
    })
    const res = await client.send(command)
    if (!res.UploadId) {
      throw new BadRequestError('No upload id returned when creating multipart upload')
    }
    return { uploadId: res.UploadId }
  }
}

export const getMultipartUploadPartSignedUrlFactory = (deps: {
  objectStorage: ObjectStorage
}): GetMultipartUploadPartSignedUrl => {
  const { objectStorage } = deps
  const { client, bucket } = objectStorage

  return async ({ objectKey, uploadId, partNumber, urlExpiryDurationSeconds }) => {
    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: objectKey,
      UploadId: uploadId,
      PartNumber: partNumber
    })
    return await s3GetSignedUrl(client, command, {
      expiresIn: urlExpiryDurationSeconds
    })
  }
}

export const completeMultipartUploadFactory = (deps: {
  objectStorage: ObjectStorage
}): CompleteMultipartUpload => {
  const { objectStorage } = deps
  const { client, bucket } = objectStorage

  return async ({ objectKey, uploadId, parts }) => {
    // S3 requires parts to be sorted in ascending order and provided in the exact order they were uploaded
    const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber)
    const command = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: objectKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts.map((part) => ({
          PartNumber: part.partNumber,
          ETag: part.etag
        }))
      }
    })
    const res = await client.send(command)
    if (!res.ETag) {
      throw new BadRequestError('No ETag returned when completing multipart upload')
    }
    return { eTag: res.ETag }
  }
}

export const abortMultipartUploadFactory = (deps: {
  objectStorage: ObjectStorage
}): AbortMultipartUpload => {
  const { objectStorage } = deps
  const { client, bucket } = objectStorage

  return async ({ objectKey, uploadId }) => {
    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: uploadId
      })
    )
  }
}

export const listMultipartUploadPartsFactory = (deps: {
  objectStorage: ObjectStorage
}): ListMultipartUploadParts => {
  const { objectStorage } = deps
  const { client, bucket } = objectStorage

  return async ({ objectKey, uploadId }) => {
    const parts: Array<{ partNumber: number; etag: string; size: number }> = []
    let partNumberMarker: string | undefined = undefined

    do {
      const res: ListPartsCommandOutput = await client.send(
        new ListPartsCommand({
          Bucket: bucket,
          Key: objectKey,
          UploadId: uploadId,
          PartNumberMarker: partNumberMarker
        })
      )

      for (const part of res.Parts || []) {
        if (part.PartNumber === undefined || !part.ETag) continue
        parts.push({
          partNumber: part.PartNumber,
          etag: part.ETag,
          size: part.Size || 0
        })
      }

      partNumberMarker =
        res.IsTruncated && res.NextPartNumberMarker
          ? res.NextPartNumberMarker
          : undefined
    } while (partNumberMarker)

    return parts
  }
}
