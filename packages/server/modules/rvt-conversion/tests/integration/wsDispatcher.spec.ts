import { expect } from 'chai'
import type { Server } from 'http'
import type { Express } from 'express'
import request from 'supertest'
import axios from 'axios'
import WebSocket from 'ws'
import { once } from 'events'
import { beforeEachContext, initializeTestServer } from '@/test/hooks'
import { createTestUser, createAuthTokenForUser, type BasicTestUser } from '@/test/authHelper'
import { createProject } from '@/test/projectHelper'
import { createTestBranch } from '@/test/speckle-helpers/branchHelper'

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

    await server?.close()
  })

  it('sends start_rvt_conversion with sourceFileUrl signed from RVT_CONVERSION_INTERNAL_S3_ENDPOINT', async () => {
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
})
