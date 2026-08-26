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
 * sends a `start_rvt_conversion` message over every connected worker websocket
 * carrying the uploaded file id/name and the pre-signed source file url.
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

const createFakeSocket = (options: { failSend?: boolean } = {}) => {
  const sent: string[] = []
  return {
    readyState: 1, // WebSocket.OPEN
    sent,
    send: (data: string, callback?: (error?: Error | null) => void) => {
      if (options.failSend) {
        callback?.(new Error('socket send failed'))
        return
      }
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

  it('sends start_rvt_conversion to every connected worker websocket', async () => {
    process.env['RVT_CONVERSION_SPECKLE_SERVER_URL'] = 'http://speckle-server.local'

    const firstSocket = createFakeSocket()
    const secondSocket = createFakeSocket()
    registerRvtWorker({
      workerId: 'unit-test-rvt-worker-1',
      socket: firstSocket as unknown as Parameters<typeof registerRvtWorker>[0]['socket'],
      capabilities: ['rvt']
    })
    registerRvtWorker({
      workerId: 'unit-test-rvt-worker-2',
      socket: secondSocket as unknown as Parameters<typeof registerRvtWorker>[0]['socket'],
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

    expect(firstSocket.sent).to.have.lengthOf(1)
    expect(secondSocket.sent).to.have.lengthOf(1)

    const firstPayload = JSON.parse(firstSocket.sent[0]) as Record<string, unknown>
    const secondPayload = JSON.parse(secondSocket.sent[0]) as Record<string, unknown>

    for (const payload of [firstPayload, secondPayload]) {
      expect(payload.type).to.equal('start_rvt_conversion')
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
    }

    expect(firstPayload.workerId).to.equal('unit-test-rvt-worker-1')
    expect(secondPayload.workerId).to.equal('unit-test-rvt-worker-2')
  })

  it('succeeds when at least one worker accepts the message despite partial send failures', async () => {
    process.env['RVT_CONVERSION_SPECKLE_SERVER_URL'] = 'http://speckle-server.local'

    const okSocket = createFakeSocket()
    const failingSocket = createFakeSocket({ failSend: true })
    registerRvtWorker({
      workerId: 'unit-test-rvt-worker-ok',
      socket: okSocket as unknown as Parameters<typeof registerRvtWorker>[0]['socket'],
      capabilities: ['rvt']
    })
    registerRvtWorker({
      workerId: 'unit-test-rvt-worker-failing',
      socket: failingSocket as unknown as Parameters<typeof registerRvtWorker>[0]['socket'],
      capabilities: ['rvt']
    })

    const job = buildFakeJob()

    let resolved = false
    try {
      await dispatchRvtConversionJob({
        job,
        sourceFileUrl: 'http://minio.local/assets/project/test-model.rvt',
        speckleToken: 't',
        speckleTokenId: 'ti'
      })
      resolved = true
    } catch (error) {
      expect.fail(`dispatch should not throw when at least one worker accepts: ${error}`)
    }

    expect(resolved).to.equal(true)
    expect(okSocket.sent).to.have.lengthOf(1)
    expect(failingSocket.sent).to.have.lengthOf(0)
  })

  it('throws when no matching worker is connected (no start_rvt_conversion is sent)', async () => {
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
    expect((thrown as Error).message).to.contain('No connected worker is available for file type: rvt')
  })

  it('routes conversion job to worker matching file capability (skp and navisworks)', async () => {
    const rvtSocket = createFakeSocket()
    const skpSocket = createFakeSocket()
    const navisworksSocket = createFakeSocket()

    registerRvtWorker({
      workerId: 'worker-rvt-only',
      socket: rvtSocket as unknown as Parameters<typeof registerRvtWorker>[0]['socket'],
      capabilities: ['rvt']
    })
    registerRvtWorker({
      workerId: 'worker-skp-only',
      socket: skpSocket as unknown as Parameters<typeof registerRvtWorker>[0]['socket'],
      capabilities: ['skp']
    })
    registerRvtWorker({
      workerId: 'worker-navisworks-only',
      socket: navisworksSocket as unknown as Parameters<typeof registerRvtWorker>[0]['socket'],
      capabilities: ['nwd', 'nwc']
    })

    const skpJob = buildFakeJob({
      sourceFileName: 'house.skp',
      sourceApplication: 'External SketchUp Converter'
    })

    await dispatchRvtConversionJob({
      job: skpJob,
      sourceFileUrl: 'http://minio.local/assets/project/house.skp',
      speckleToken: 'token-skp',
      speckleTokenId: 'token-id-skp',
      fileType: 'skp'
    })

    expect(rvtSocket.sent).to.have.lengthOf(0)
    expect(navisworksSocket.sent).to.have.lengthOf(0)
    expect(skpSocket.sent).to.have.lengthOf(1)

    const skpPayload = JSON.parse(skpSocket.sent[0]) as Record<string, unknown>
    expect(skpPayload.fileType).to.equal('skp')
    expect(skpPayload.fileName).to.equal('house.skp')
    expect(skpPayload.workerId).to.equal('worker-skp-only')

    const nwdJob = buildFakeJob({
      sourceFileName: 'federated.nwd',
      sourceApplication: 'External Navisworks Converter'
    })

    await dispatchRvtConversionJob({
      job: nwdJob,
      sourceFileUrl: 'http://minio.local/assets/project/federated.nwd',
      speckleToken: 'token-nwd',
      speckleTokenId: 'token-id-nwd',
      fileType: 'nwd'
    })

    expect(navisworksSocket.sent).to.have.lengthOf(1)
    const nwdPayload = JSON.parse(navisworksSocket.sent[0]) as Record<string, unknown>
    expect(nwdPayload.fileType).to.equal('nwd')
    expect(nwdPayload.workerId).to.equal('worker-navisworks-only')
  })

  it('throws when every connected worker fails to accept the message', async () => {
    const failingSocketOne = createFakeSocket({ failSend: true })
    const failingSocketTwo = createFakeSocket({ failSend: true })
    registerRvtWorker({
      workerId: 'unit-test-rvt-worker-failing-1',
      socket: failingSocketOne as unknown as Parameters<typeof registerRvtWorker>[0]['socket'],
      capabilities: ['rvt']
    })
    registerRvtWorker({
      workerId: 'unit-test-rvt-worker-failing-2',
      socket: failingSocketTwo as unknown as Parameters<typeof registerRvtWorker>[0]['socket'],
      capabilities: ['rvt']
    })

    const job = buildFakeJob()

    let thrown: unknown
    try {
      await dispatchRvtConversionJob({
        job,
        sourceFileUrl: 'http://minio.local/assets/project/test-model.rvt',
        speckleToken: 't',
        speckleTokenId: 'ti'
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).to.be.instanceOf(Error)
    expect((thrown as Error).message).to.contain('Failed to dispatch RVT conversion job')
    expect(failingSocketOne.sent).to.have.lengthOf(0)
    expect(failingSocketTwo.sent).to.have.lengthOf(0)
  })
})
