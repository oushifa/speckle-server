import { expect } from 'chai'
import { resolveRetryEntryPoint } from '@/modules/model-sync/services/retry'
import type { ProjectModelSyncTaskRecord } from '@/modules/model-sync/repositories/tasks'

const buildTask = (
  overrides: Partial<
    Pick<
      ProjectModelSyncTaskRecord,
      'status' | 'errorCode' | 'assetId' | 'assetName' | 'transformTaskId' | 'versionId'
    >
  >
) =>
  ({
    status: 'failed',
    errorCode: null,
    assetId: null,
    assetName: null,
    transformTaskId: null,
    versionId: null,
    ...overrides
  }) as Pick<
    ProjectModelSyncTaskRecord,
    'status' | 'errorCode' | 'assetId' | 'assetName' | 'transformTaskId' | 'versionId'
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

  it('restarts from sync when task has versionId even if errorCode is unknown', async () => {
    const entryPoint = resolveRetryEntryPoint(
      buildTask({
        status: 'failed',
        errorCode: null,
        versionId: 'version-123'
      })
    )

    expect(entryPoint).to.equal('sync')
  })

  it('restarts from speckle when no versionId, no assetId and not in transform stage', async () => {
    const entryPoint = resolveRetryEntryPoint(
      buildTask({
        status: 'failed',
        errorCode: 'FILE_CONVERSION_FAILED',
        versionId: null
      })
    )

    expect(entryPoint).to.equal('speckle')
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
