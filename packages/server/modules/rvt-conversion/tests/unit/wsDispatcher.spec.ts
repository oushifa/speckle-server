import { expect } from 'chai'
import cryptoRandomString from 'crypto-random-string'
import { dispatchRvtConversionJob } from '@/modules/rvt-conversion/services/wsDispatcher'
import {
  registerRvtWorker,
  unregisterRvtWorker,
  listRvtWorkers
} from '@/modules/rvt-conversion/services/workerRegistry'
import { clearTrackedRvtConversionTasks } from '@/modules/rvt-conversion/services/taskRegistry'
import type { RvtConversionJob } from '@/modules/rvt-conversion/repositories/jobs'

/**
 * Unit test for the RVT conversion dispatch.
 *
 * Proves that when an RVT file upload is dispatched for conversion, the server
 * sends a `start_rvt_conversion` message over the worker websocket carrying the
 * uploaded file id/name and the pre-signed source file url.
 */

const buildFakeJob = (overrides: Partial<RvtConversionJob> = {}): RvtConversionJob => ({
  id: cryptoRandomString({ length: 10 }),
  projectId: cryptoRandomString({ length: 10 }),
  modelId: cryptoRandomString({ length: 10 }),
  sourceFileId: cryptoRandomString({ length: 10 }),
  sourceFileName: 'test-model.rvt',
  sourceObjectKey: `assets/${cryptoRandomString({ length: 10 })}/${cryptoRandomString({
    length: 10
  })}`,
  sourceFileSize: 8,
  versionMessage: null,
  sourceApplication: 'External RVT Converter',
  status: 'pending',
  externalTaskId: null,
  versionId: null,
  errorMessage: null,
  dispatchedAt: null,
  acknowledgedAt: null,
  finishedAt: null,
  creator: cryptoRandomString({ length: 10 }),
  updater: cryptoRandomString({ length: 10 }),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

const createFakeSocket = () => {
  const sent: string[] = []
  return {
    readyState: 1, // WebSocket.OPEN
    sent,
    send: (data: string, callback?: (error?: Error | null) => void) => {
      sent.push(data)
      callback?.(null)
    },
    close: () => undefined
  }
}

describe('RVT upload dispatch unit @rvt-conversion', () => {
  const originalSpeckleServerUrl = process.env['RVT_CONVERSION_SPECKLE_SERVER_URL']

  afterEach(() => {
    for (const worker of listRvtWorkers()) {
      unregisterRvtWorker({ workerId: worker.workerId, socket: worker.socket })
    }
    clearTrackedRvtConversionTasks()
  })

  after(() => {
    if (originalSpeckleServerUrl === undefined) {
      delete process.env['RVT_CONVERSION_SPECKLE_SERVER_URL']
    } else {
      process.env['RVT_CONVERSION_SPECKLE_SERVER_URL'] = originalSpeckleServerUrl
    }
  })

  it('sends start_rvt_conversion over the worker websocket when an RVT file is dispatched', async () => {
    process.env['RVT_CONVERSION_SPECKLE_SERVER_URL'] = 'http://speckle-server.local'

    const socket = createFakeSocket()
    registerRvtWorker({
      workerId: 'unit-test-rvt-worker',
      socket: socket as unknown as Parameters<typeof registerRvtWorker>[0]['socket'],
      capabilities: ['rvt']
    })

    const job = buildFakeJob({ sourceFileName: 'test-model.rvt' })
    const sourceFileUrl = 'http://minio.local/assets/project/test-model.rvt'

    await dispatchRvtConversionJob({
      job,
      sourceFileUrl,
      speckleToken: 'speckle-token-value',
      speckleTokenId: 'speckle-token-id',
      branchName: 'main'
    })

    expect(socket.sent).to.have.lengthOf(1)

    const payload = JSON.parse(socket.sent[0]) as Record<string, unknown>
    expect(payload.type).to.equal('start_rvt_conversion')
    expect(payload.workerId).to.equal('unit-test-rvt-worker')
    expect(payload.taskId).to.equal(job.id)
    expect(payload.projectId).to.equal(job.projectId)
    expect(payload.modelId).to.equal(job.modelId)
    expect(payload.fileId).to.equal(job.sourceFileId)
    expect(payload.fileName).to.equal(job.sourceFileName)
    expect(payload.sourceFileUrl).to.equal(sourceFileUrl)
    expect(payload.speckleServerUrl).to.equal('http://speckle-server.local')
    expect(payload.speckleToken).to.equal('speckle-token-value')
    expect(payload.speckleTokenId).to.equal('speckle-token-id')
    expect(payload.branchName).to.equal('main')
    expect(payload.sourceApplication).to.equal('External RVT Converter')
  })

  it('throws when no RVT worker is connected (no start_rvt_conversion is sent)', async () => {
    const job = buildFakeJob()
    const sourceFileUrl = 'http://minio.local/assets/project/test-model.rvt'

    let thrown: unknown
    try {
      await dispatchRvtConversionJob({
        job,
        sourceFileUrl,
        speckleToken: 't',
        speckleTokenId: 'ti'
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).to.be.instanceOf(Error)
    expect((thrown as Error).message).to.contain('No connected RVT worker')
  })
})
