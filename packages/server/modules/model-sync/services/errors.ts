export const MODEL_SYNC_AUTO_RETRY_LIMIT = 5
export const MODEL_SYNC_AUTO_RETRY_INTERVAL_MS = 30 * 1000

export type ModelSyncTaskErrorCode =
  | 'MISSING_FILE_UPLOAD_ID'
  | 'FILE_UPLOAD_NOT_FOUND'
  | 'FILE_CONVERSION_FAILED'
  | 'FILE_CONVERSION_TIMEOUT'
  | 'DTP_USER_CONTACT_NOT_FOUND'
  | 'DTP_AUTH_FAILED'
  | 'DTP_UPLOAD_CONFIG_FAILED'
  | 'DTP_UPLOAD_REQUEST_FAILED'
  | 'DTP_UPLOAD_FAILED'
  | 'DTP_UPLOAD_RESULT_INVALID'
  | 'VERSION_METADATA_UPDATE_FAILED'
  | 'DTP_TRANSFORM_TRIGGER_FAILED'
  | 'DTP_TRANSFORM_STATUS_FAILED'
  | 'DTP_TRANSFORM_FAILED'
  | 'DTP_TRANSFORM_TIMEOUT'
  | 'UPSTREAM_TEMPORARY_ERROR'
  | 'UNKNOWN'

export class ModelSyncTaskError extends Error {
  public readonly code: ModelSyncTaskErrorCode
  public readonly retriable: boolean

  public constructor(
    code: ModelSyncTaskErrorCode,
    message: string,
    retriable: boolean,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'ModelSyncTaskError'
    this.code = code
    this.retriable = retriable
  }
}

const isTemporaryUpstreamFailure = (message: string) =>
  /timeout|timed out|etimedout|econnreset|econnrefused|enotfound|network|fetch failed/i.test(
    message
  )

export const normalizeModelSyncTaskError = (error: unknown) => {
  if (error instanceof ModelSyncTaskError) {
    return {
      message: error.message,
      errorCode: error.code,
      retriable: error.retriable
    }
  }

  const message = error instanceof Error ? error.message : '模型同步失败'
  if (isTemporaryUpstreamFailure(message)) {
    return {
      message,
      errorCode: 'UPSTREAM_TEMPORARY_ERROR' as const,
      retriable: true
    }
  }

  return {
    message,
    errorCode: 'UNKNOWN' as const,
    retriable: false
  }
}
