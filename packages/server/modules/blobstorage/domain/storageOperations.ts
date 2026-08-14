import type stream from 'stream'
import type { Readable } from 'stream'

export type GetObjectStream = (params: {
  objectKey: string
}) => Promise<stream.Readable>

export type GetObjectAttributes = (params: { objectKey: string }) => Promise<{
  fileSize: number
}>

type FileStream = string | Blob | Readable | Uint8Array | Buffer

export type StoreFileStream = (args: {
  objectKey: string
  fileStream: FileStream
}) => Promise<{ fileHash: string }>

export type DeleteObject = (params: { objectKey: string }) => Promise<void>

export type EnsureStorageAccess = (params: {
  createBucketIfNotExists: boolean
}) => Promise<void>

export type MultipartUploadPart = {
  partNumber: number
  etag: string
}

export type CreateMultipartUpload = (params: {
  objectKey: string
}) => Promise<{ uploadId: string }>

export type GetMultipartUploadPartSignedUrl = (params: {
  objectKey: string
  uploadId: string
  partNumber: number
  urlExpiryDurationSeconds: number
}) => Promise<string>

export type CompleteMultipartUpload = (params: {
  objectKey: string
  uploadId: string
  parts: MultipartUploadPart[]
}) => Promise<{ eTag: string }>

export type AbortMultipartUpload = (params: {
  objectKey: string
  uploadId: string
}) => Promise<void>

export type ListMultipartUploadParts = (params: {
  objectKey: string
  uploadId: string
}) => Promise<Array<MultipartUploadPart & { size: number }>>
