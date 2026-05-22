import { buildTableHelper } from '@/modules/core/dbSchema'

export const RvtConversionJobs = buildTableHelper('rvt_conversion_jobs', [
  'id',
  'projectId',
  'modelId',
  'sourceFileId',
  'sourceFileName',
  'sourceObjectKey',
  'sourceFileSize',
  'versionMessage',
  'sourceApplication',
  'status',
  'externalTaskId',
  'versionId',
  'errorMessage',
  'dispatchedAt',
  'acknowledgedAt',
  'finishedAt',
  'creator',
  'updater',
  'createdAt',
  'updatedAt'
])
