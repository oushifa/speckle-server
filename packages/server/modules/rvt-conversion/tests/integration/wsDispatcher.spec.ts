import { expect } from 'chai'
import type { Server } from 'http'
import type { Express } from 'express'
import request from 'supertest'
import axios from 'axios'
import WebSocket from 'ws'
import { once } from 'events'
import { retry } from '@speckle/shared'
import { beforeEachContext, initializeTestServer } from '@/test/hooks'
import { createTestUser, createAuthTokenForUser, type BasicTestUser } from '@/test/authHelper'
import { createProject } from '@/test/projectHelper'
import { createTestBranch } from '@/test/speckle-helpers/branchHelper'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { getRvtConversionJobByIdFactory } from '@/modules/rvt-conversion/repositories/jobs'
import { getFileInfoFactoryV2 } from '@/modules/fileuploads/repositories/fileUploads'
import { FileUploadConvertedStatus } from '@/modules/fileuploads/helpers/types'

describe('RVT conversion WS dispatch @rvt-conversion', () => {
  let server: Server
  let app: Express
  let wsAddress: string
  let user: BasicTestUser
  let userToken: string
  let workerSocket: WebSocket | null = null

  const serviceToken = 'rvt-conversion-fixed-token'
  const internalS3Endpoint = 'http://192.168.0.25:9000'
  let existingServiceToken: string | undefined
  let existingInternalS3Endpoint: string | undefined

  before(async () => {
    const ctx = await beforeEachContext()
    server = ctx.server
    app = ctx.app

    existingServiceToken = process.env['FILE_CONVERSION_SERVICE_TOKEN']
    existingInternalS3Endpoint = process.env['RVT_CONVERSION_INTERNAL_S3_ENDPOINT']
    process.env['FILE_CONVERSION_SERVICE_TOKEN'] = serviceToken
    process.env['RVT_CONVERSION_INTERNAL_S3_ENDPOINT'] = internalS3Endpoint

    const initialized = await initializeTestServer(ctx)
    wsAddress = initialized.wsAddress

    user = await createTestUser({
      name: 'RVT Conversion User',
      email: 'rvt-conversion-user@example.org'
    })
    userToken = await createAuthTokenForUser(user.id)
  })

  after(async () => {
    if (workerSocket) {
      workerSocket.close()
      workerSocket = null
    }

    if (existingServiceToken === undefined) delete process.env['FILE_CONVERSION_SERVICE_TOKEN']
    else process.env['FILE_CONVERSION_SERVICE_TOKEN'] = existingServiceToken

    if (existingInternalS3Endpoint === undefined)
      delete process.env['RVT_CONVERSION_INTERNAL_S3_ENDPOINT']
    else
      process.env['RVT_CONVERSION_INTERNAL_S3_ENDPOINT'] = existingInternalS3Endpoint

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) return reject(error)
          resolve()
        })
      })
    }
  })

  it('sends start_rvt_conversion with sourceFileUrl signed from RVT_CONVERSION_INTERNAL_S3_ENDPOINT', async () => {
    if (workerSocket) {
      workerSocket.close()
      workerSocket = null
    }

    const project = await createProject({
      name: 'RVT Conversion Project',
      ownerId: user.id,
      isPublic: false
    })
    const model = await createTestBranch({
      branch: {
        id: '',
        name: 'RVT Model',
        streamId: '',
        authorId: ''
      },
      stream: {
        ...project,
        ownerId: user.id
      },
      owner: user
    })

    workerSocket = new WebSocket(`${wsAddress}/api/ws/rvt-conversion?token=${serviceToken}`)
    await once(workerSocket, 'open')

    workerSocket.send(
      JSON.stringify({
        type: 'worker_register',
        workerId: 'test-rvt-worker'
      })
    )

    const uploadUrlResponse = await request(app)
      .post(`/api/v1/projects/${project.id}/models/${model.id}/rvt/upload-url`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        fileName: 'test-model.rvt',
        fileSize: 8
      })

    expect(uploadUrlResponse.status).to.equal(200)
    expect(uploadUrlResponse.body.fileId).to.be.a('string')
    expect(uploadUrlResponse.body.uploadUrl).to.be.a('string')

    const uploadResponse = await axios.put(
      uploadUrlResponse.body.uploadUrl,
      Buffer.from('fake-rvt'),
      {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      }
    )

    expect(uploadResponse.status).to.equal(200)

    const messagePromise = once(workerSocket, 'message')
    const createJobResponse = await request(app)
      .post(`/api/v1/projects/${project.id}/models/${model.id}/rvt/jobs`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        fileId: uploadUrlResponse.body.fileId,
        fileName: 'test-model.rvt',
        etag: uploadResponse.headers['etag']
      })

    expect(createJobResponse.status).to.equal(201)

    const [rawMessage] = (await messagePromise) as [WebSocket.RawData]
    const payload = JSON.parse(rawMessage.toString()) as {
      type: string
      sourceFileUrl: string
      fileId: string
    }

    expect(payload.type).to.equal('start_rvt_conversion')
    expect(payload.fileId).to.equal(uploadUrlResponse.body.fileId)
    expect(payload.sourceFileUrl).to.be.a('string')
    expect(new URL(payload.sourceFileUrl).origin).to.equal(internalS3Endpoint)
  })

  it('processes ack, progress and result messages over websocket', async () => {
    if (workerSocket) {
      workerSocket.close()
      workerSocket = null
    }

    const project = await createProject({
      name: 'RVT Conversion Progress Project',
      ownerId: user.id,
      isPublic: false
    })
    const model = await createTestBranch({
      branch: {
        id: '',
        name: 'RVT Progress Model',
        streamId: '',
        authorId: ''
      },
      stream: {
        ...project,
        ownerId: user.id
      },
      owner: user
    })

    workerSocket = new WebSocket(`${wsAddress}/api/ws/rvt-conversion?token=${serviceToken}`)
    await once(workerSocket, 'open')

    workerSocket.send(
      JSON.stringify({
        type: 'worker_register',
        workerId: 'test-rvt-worker-progress'
      })
    )

    const uploadUrlResponse = await request(app)
      .post(`/api/v1/projects/${project.id}/models/${model.id}/rvt/upload-url`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        fileName: 'test-progress-model.rvt',
        fileSize: 8
      })

    expect(uploadUrlResponse.status).to.equal(200)

    const uploadResponse = await axios.put(
      uploadUrlResponse.body.uploadUrl,
      Buffer.from('fake-rvt-progress'),
      {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      }
    )

    expect(uploadResponse.status).to.equal(200)

    const messagePromise = once(workerSocket, 'message')
    const createJobResponse = await request(app)
      .post(`/api/v1/projects/${project.id}/models/${model.id}/rvt/jobs`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        fileId: uploadUrlResponse.body.fileId,
        fileName: 'test-progress-model.rvt',
        etag: uploadResponse.headers['etag']
      })

    expect(createJobResponse.status).to.equal(201)

    const [rawMessage] = (await messagePromise) as [WebSocket.RawData]
    const payload = JSON.parse(rawMessage.toString()) as {
      type: string
      taskId: string
      fileId: string
    }

    expect(payload.type).to.equal('start_rvt_conversion')

    workerSocket.send(
      JSON.stringify({
        type: 'rvt_conversion_ack',
        taskId: payload.taskId,
        externalTaskId: 'ext-progress-1'
      })
    )

    workerSocket.send(
      JSON.stringify({
        type: 'rvt_conversion_progress',
        taskId: payload.taskId,
        externalTaskId: 'ext-progress-1',
        phase: 'converting',
        progress: 42,
        message: '正在转换模型',
        current: 42,
        total: 100
      })
    )

    const projectDb = await getProjectDbClient({ projectId: project.id })
    const getJob = getRvtConversionJobByIdFactory({ db: projectDb })
    const getFileInfo = getFileInfoFactoryV2({ db: projectDb })

    await retry(async () => {
      const job = await getJob({ id: payload.taskId })
      expect(job).to.not.be.null
      expect(job?.status).to.equal('acknowledged')
      expect(job?.externalTaskId).to.equal('ext-progress-1')

      const file = await getFileInfo({
        fileId: uploadUrlResponse.body.fileId,
        projectId: project.id
      })
      expect(file).to.not.be.undefined
      expect(file?.convertedStatus).to.equal(FileUploadConvertedStatus.Converting)
      expect(file?.convertedMessage).to.equal('正在转换模型 (42%, 42/100)')
    }, 10, 200)

    workerSocket.send(
      JSON.stringify({
        type: 'rvt_conversion_result',
        taskId: payload.taskId,
        externalTaskId: 'ext-progress-1',
        status: 'success',
        versionId: 'version-progress-1'
      })
    )

    await retry(async () => {
      const job = await getJob({ id: payload.taskId })
      expect(job).to.not.be.null
      expect(job?.status).to.equal('succeeded')
      expect(job?.versionId).to.equal('version-progress-1')

      const file = await getFileInfo({
        fileId: uploadUrlResponse.body.fileId,
        projectId: project.id
      })
      expect(file).to.not.be.undefined
      expect(file?.convertedStatus).to.equal(FileUploadConvertedStatus.Completed)
      expect(file?.convertedCommitId).to.equal('version-progress-1')
      expect(file?.convertedMessage).to.equal(null)
    }, 10, 200)
  })
})
