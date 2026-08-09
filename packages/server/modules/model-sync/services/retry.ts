import type {
  ModelSyncTaskStatus,
  ProjectModelSyncTaskRecord
} from '@/modules/model-sync/repositories/tasks'
import type { ModelSyncTaskErrorCode } from '@/modules/model-sync/services/errors'

export type ModelSyncRetryEntryPoint = 'speckle' | 'sync' | 'transform'

const TRANSFORM_ERROR_CODES = new Set<ModelSyncTaskErrorCode>([
  'DTP_TRANSFORM_TRIGGER_FAILED',
  'DTP_TRANSFORM_STATUS_FAILED',
  'DTP_TRANSFORM_FAILED',
  'DTP_TRANSFORM_TIMEOUT'
])

const SYNC_ERROR_CODES = new Set<ModelSyncTaskErrorCode>([
  'DTP_USER_CONTACT_NOT_FOUND',
  'DTP_AUTH_FAILED',
  'DTP_UPLOAD_CONFIG_FAILED',
  'DTP_UPLOAD_REQUEST_FAILED',
  'DTP_UPLOAD_FAILED',
  'DTP_UPLOAD_RESULT_INVALID'
])

export const getRetryStatusForEntryPoint = (
  entryPoint: ModelSyncRetryEntryPoint
): ModelSyncTaskStatus => {
  switch (entryPoint) {
    case 'transform':
      return 'triggering_model_transform'
    case 'sync':
      return 'syncing_dtp_model'
    case 'speckle':
    default:
      return 'speckle_converting'
  }
}

export const resolveRetryEntryPoint = (
  task: Pick<
    ProjectModelSyncTaskRecord,
    'status' | 'errorCode' | 'assetId' | 'assetName' | 'transformTaskId'
  >
): ModelSyncRetryEntryPoint | null => {
  switch (task.status) {
    case 'speckle_converting':
      return 'speckle'
    case 'syncing_dtp_model':
    case 'syncing_external_ids':
      return 'sync'
    case 'triggering_model_transform':
    case 'polling_model_transform':
      return 'transform'
    case 'failed': {
      const errorCode = (task.errorCode || null) as ModelSyncTaskErrorCode | null
      if (errorCode && TRANSFORM_ERROR_CODES.has(errorCode)) {
        return 'transform'
      }
      if (task.transformTaskId || (task.assetId && task.assetName)) {
        return 'transform'
      }
      if (errorCode && SYNC_ERROR_CODES.has(errorCode)) {
        return 'sync'
      }
      if (task.assetId || task.assetName) {
        return 'sync'
      }
      return 'speckle'
    }
    default:
      return null
  }
}
