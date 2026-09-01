import { expect } from 'chai'
import cryptoRandomString from 'crypto-random-string'
import { dispatchRvtConversionJob } from '@/modules/rvt-conversion/services/wsDispatcher'
import {
  registerRvtWorker,
  unregisterRvtWorker,
  listRvtWorkers
} from '@/modules/rvt-conversion/services/workerRegistry'
import {
  syncWorkerToCluster,
  removeWorkerFromCluster,
  listClusterWorkers,
  trackClusterTask,
  getClusterTask
} from '@/modules/rvt-conversion/services/clusterRegistry'
import {
  initClusterDispatcher,
  shutdownClusterDispatcher
} from '@/modules/rvt-conversion/services/clusterDispatcher'
import { clearTrackedRvtConversionTasks } from '@/modules/rvt-conversion/services/taskRegistry'
import type { RvtConversionJob } from '@/modules/rvt-conversion/repositories/jobs'

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

describe('RVT cluster dispatch and registry unit @rvt-conversion', () => {
  const originalSpeckleServerUrl = process.env['RVT_CONVERSION_SPECKLE_SERVER_URL']

  before(() => {
    process.env['RVT_CONVERSION_SPECKLE_SERVER_URL'] = 'http://speckle-server.local'
    initClusterDispatcher()
  })

  after(async () => {
    await shutdownClusterDispatcher()
    if (originalSpeckleServerUrl === undefined) {
      delete process.env['RVT_CONVERSION_SPECKLE_SERVER_URL']
    } else {
      process.env['RVT_CONVERSION_SPECKLE_SERVER_URL'] = originalSpeckleServerUrl
    }
  })

  afterEach(async () => {
    for (const worker of listRvtWorkers()) {
      unregisterRvtWorker({ workerId: worker.workerId, socket: worker.socket })
      await removeWorkerFromCluster({ workerId: worker.workerId })
    }
    clearTrackedRvtConversionTasks()
  })

  it('syncs, lists and removes workers from Redis cluster registry', async () => {
    const testWorkerId = `cluster-test-worker-${cryptoRandomString({ length: 6 })}`
    await syncWorkerToCluster({
      workerId: testWorkerId,
      capabilities: ['rvt', 'nwd'],
      version: '2.0.0'
    })

    const workers = await listClusterWorkers()
    const found = workers.find((w) => w.workerId === testWorkerId)
    expect(found).to.not.be.undefined
    expect(found?.capabilities).to.deep.equal(['rvt', 'nwd'])
    expect(found?.version).to.equal('2.0.0')

    await removeWorkerFromCluster({ workerId: testWorkerId })
    const workersAfter = await listClusterWorkers()
    expect(workersAfter.find((w) => w.workerId === testWorkerId)).to.be.undefined
  })

  it('tracks and retrieves task metadata in Redis cluster registry', async () => {
    const taskId = `task-${cryptoRandomString({ length: 6 })}`
    await trackClusterTask({
      taskId,
      projectId: 'project-123',
      modelId: 'model-456',
      sourceFileId: 'file-789',
      workerIds: ['worker-1']
    })

    const retrieved = await getClusterTask(taskId)
    expect(retrieved).to.not.be.null
    expect(retrieved?.projectId).to.equal('project-123')
    expect(retrieved?.modelId).to.equal('model-456')
  })

  it('dispatches task to local worker when locally present', async () => {
    const localWorkerId = `worker-local-${cryptoRandomString({ length: 6 })}`
    const localSocket = createFakeSocket()

    registerRvtWorker({
      workerId: localWorkerId,
      socket: localSocket as unknown as Parameters<
        typeof registerRvtWorker
      >[0]['socket'],
      capabilities: ['rvt']
    })

    const job = buildFakeJob({ sourceFileName: 'cluster-local.rvt' })
    await dispatchRvtConversionJob({
      job,
      sourceFileUrl: 'http://minio.local/assets/project/cluster-local.rvt',
      speckleToken: 'cluster-token',
      speckleTokenId: 'cluster-token-id',
      fileType: 'rvt'
    })

    expect(localSocket.sent).to.have.lengthOf(1)
    const payload = JSON.parse(localSocket.sent[0]) as Record<string, unknown>
    expect(payload.type).to.equal('start_rvt_conversion')
    expect(payload.taskId).to.equal(job.id)
    expect(payload.workerId).to.equal(localWorkerId)
  })

  it('dispatches task when worker capability is in cluster and matches file type', async () => {
    const workerId = `worker-cluster-match-${cryptoRandomString({ length: 6 })}`
    const socket = createFakeSocket()

    registerRvtWorker({
      workerId,
      socket: socket as unknown as Parameters<typeof registerRvtWorker>[0]['socket'],
      capabilities: ['rvt', 'skp']
    })

    const job = buildFakeJob({ sourceFileName: 'model.skp' })
    await dispatchRvtConversionJob({
      job,
      sourceFileUrl: 'http://minio.local/assets/project/model.skp',
      speckleToken: 'token-skp',
      speckleTokenId: 'token-id-skp',
      fileType: 'skp'
    })

    expect(socket.sent).to.have.lengthOf(1)
    const payload = JSON.parse(socket.sent[0]) as Record<string, unknown>
    expect(payload.fileType).to.equal('skp')
  })
})
