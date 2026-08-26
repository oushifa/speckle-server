import type { Nullable } from '@speckle/shared'

export enum FileUploadConvertedStatus {
  Queued = 0,
  Converting = 1,
  Completed = 2,
  Error = 3
}

export type FileUploadRecordMetadata = {
  description?: string
}

type FileUploadPerformanceData = {
  durationSeconds: number
  downloadDurationSeconds: number
  parseDurationSeconds: number
}

type FileUploadProgressData = {
  progressPercent: Nullable<number>
  progressPhase: Nullable<string>
  progressMessage: Nullable<string>
}

export type FileUploadRecord = {
  id: string
  streamId: string
  branchName: string
  modelId: Nullable<string>
  userId: string
  fileName: string
  fileType: string
  fileSize: Nullable<number>
  uploadComplete: boolean
  uploadDate: Date
  convertedStatus: number | FileUploadConvertedStatus
  convertedLastUpdate: Date
  convertedMessage: Nullable<string>
  convertedCommitId: Nullable<string>
  metadata: Nullable<FileUploadRecordMetadata>
  performanceData: Nullable<FileUploadPerformanceData>
} & FileUploadProgressData

export type FileUploadRecordV2 = {
  id: string
  projectId: string
  modelId: Nullable<string>
  userId: string
  fileName: string
  fileType: string
  fileSize: Nullable<number>
  uploadComplete: boolean
  uploadDate: Date
  convertedStatus: number | FileUploadConvertedStatus
  convertedLastUpdate: Date
  convertedMessage: Nullable<string>
  convertedCommitId: Nullable<string>
  metadata: Nullable<FileUploadRecordMetadata>
  performanceData: Nullable<FileUploadPerformanceData>
} & FileUploadProgressData

export type FileUploadGraphQLReturn = FileUploadRecord | FileUploadRecordV2

export const EXTERNAL_CONVERTIBLE_FILE_TYPES = ['rvt', 'skp', 'nwd', 'nwc'] as const
export type ExternalConvertibleFileType = (typeof EXTERNAL_CONVERTIBLE_FILE_TYPES)[number]

export const isExternalConvertibleFileType = (
  fileType: string | null | undefined
): fileType is ExternalConvertibleFileType => {
  if (!fileType) return false
  return (EXTERNAL_CONVERTIBLE_FILE_TYPES as readonly string[]).includes(
    fileType.toLowerCase()
  )
}
