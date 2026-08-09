import { expect } from 'chai'
import { resolveRetryEntryPoint } from '@/modules/model-sync/services/retry'
import type { ProjectModelSyncTaskRecord } from '@/modules/model-sync/repositories/tasks'

const buildTask = (
  overrides: Partial<
    Pick<
      ProjectModelSyncTaskRecord,
      'status' | 'errorCode' | 'assetId' | 'assetName' | 'transformTaskId'
    >
  >
) =>
  ({
    status: 'failed',
    errorCode: null,
    assetId: null,
    assetName: null,
    transformTaskId: null,
    ...overrides
  }) as Pick<
    ProjectModelSyncTaskRecord,
    'status' | 'errorCode' | 'assetId' | 'assetName' | 'transformTaskId'
  >

describe('Model sync retry routing @model-sync', () => {
  it('restarts transform failures from start_convert', async () => {
    const entryPoint = resolveRetryEntryPoint(
      buildTask({
        status: 'failed',
        errorCode: 'DTP_TRANSFORM_TIMEOUT',
        assetId: 'asset-1',
        assetName: 'demo-model'
      })
    )

    expect(entryPoint).to.equal('transform')
  })

  it('restarts sync failures from config', async () => {
    const entryPoint = resolveRetryEntryPoint(
      buildTask({
        status: 'failed',
        errorCode: 'DTP_UPLOAD_FAILED'
      })
    )

    expect(entryPoint).to.equal('sync')
  })

  it('keeps syncing status on sync entry point before transform', async () => {
    const entryPoint = resolveRetryEntryPoint(
      buildTask({
        status: 'syncing_external_ids'
      })
    )

    expect(entryPoint).to.equal('sync')
  })
})
