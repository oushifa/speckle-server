import type {
  ModelSyncTaskStatus,
  ProjectModelSyncTaskRecord
} from '@/modules/model-sync/repositories/tasks'
import {
  MODEL_SYNC_CANCELLED_ERROR_CODE,
  type ModelSyncTaskErrorCode
} from '@/modules/model-sync/services/errors'

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

/** 任务是否已被主动取消（例如模型在转换/同步过程中被删除） */
export const isModelSyncTaskCancelled = (
  task: Pick<ProjectModelSyncTaskRecord, 'status' | 'errorCode'> | null | undefined
): boolean =>
  !!task &&
  task.status === 'failed' &&
  task.errorCode === MODEL_SYNC_CANCELLED_ERROR_CODE

export const resolveRetryEntryPoint = (
  task: Pick<
    ProjectModelSyncTaskRecord,
    'status' | 'errorCode' | 'assetId' | 'assetName' | 'transformTaskId' | 'versionId'
  >
): ModelSyncRetryEntryPoint | null => {
  // 已取消的任务不再自动重试
  if (isModelSyncTaskCancelled(task)) return null

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
      if (task.assetId || task.assetName || task.versionId) {
        return 'sync'
      }
      return 'speckle'
    }
    default:
      return null
  }
}
