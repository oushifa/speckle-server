import { expect } from 'chai'
import type { Server } from 'http'
import type { Express } from 'express'
import request from 'supertest'
import axios from 'axios'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { beforeEachContext, initializeTestServer } from '@/test/hooks'
import { createTestUser, createAuthTokenForUser, type BasicTestUser } from '@/test/authHelper'

describe('File conversion REST @file-conversion', () => {
  let server: Server
  let app: Express
  let user: BasicTestUser
  let userToken: string
  let existingServiceToken: string | undefined
  const serviceToken = 'file-conversion-fixed-token'
  const robotsTxtPath = fileURLToPath(
    new URL('../../../../../frontend-2/public/robots.txt', import.meta.url)
  )

  before(async () => {
    const ctx = await beforeEachContext()
    server = ctx.server
    app = ctx.app
    await initializeTestServer(ctx)

    existingServiceToken = process.env['FILE_CONVERSION_SERVICE_TOKEN']
    process.env['FILE_CONVERSION_SERVICE_TOKEN'] = serviceToken

    user = await createTestUser({
      name: 'File Conversion User',
      email: 'file-conversion-user@example.org'
    })
    userToken = await createAuthTokenForUser(user.id)
  })

  after(async () => {
    process.env['FILE_CONVERSION_SERVICE_TOKEN'] = existingServiceToken
    await server?.close()
  })

  it('runs the full upload and callback flow', async () => {
    const sourceFile = readFileSync(robotsTxtPath)

    const createResponse = await request(app)
      .post('/api/v1/file-conversions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        fileName: 'robots.txt',
        fileSize: sourceFile.length
      })

    expect(createResponse.status).to.equal(201)
    expect(createResponse.body.id).to.be.a('string')
    expect(createResponse.body.uploadUrl).to.be.a('string')
    expect(createResponse.body.status).to.equal('uploaded')

    const sourceUploadResponse = await axios.put(createResponse.body.uploadUrl, sourceFile, {
      headers: {
        'Content-Type': 'text/plain'
      }
    })

    expect(sourceUploadResponse.status).to.equal(200)
    expect(sourceUploadResponse.headers['etag']).to.exist

    const uploadCompleteResponse = await request(app)
      .post(`/api/v1/file-conversions/${createResponse.body.id}/upload-complete`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        etag: sourceUploadResponse.headers['etag']
      })

    expect(uploadCompleteResponse.status).to.equal(200)
    expect(uploadCompleteResponse.body.status).to.equal('pending')

    const pendingResponse = await request(app)
      .get('/api/v1/file-conversions/pending')
      .set('X-File-Conversion-Token', serviceToken)

    expect(pendingResponse.status).to.equal(200)
    expect(pendingResponse.body.items).to.have.lengthOf(1)
    expect(pendingResponse.body.items[0].id).to.equal(createResponse.body.id)
    expect(pendingResponse.body.items[0].sourceFileUrl).to.be.a('string')

    const paramsResponse = await request(app)
      .get(`/api/v1/file-conversions/${createResponse.body.id}/params`)
      .set('X-File-Conversion-Token', serviceToken)

    expect(paramsResponse.status).to.equal(200)
    expect(paramsResponse.body.id).to.equal(createResponse.body.id)
    expect(paramsResponse.body.streamId).to.be.a('string')
    expect(paramsResponse.body.sourceFileUrl).to.be.a('string')

    const startResponse = await request(app)
      .post(`/api/v1/file-conversions/${createResponse.body.id}/start`)
      .set('X-File-Conversion-Token', serviceToken)
      .send({
        operator: 'converter-service'
      })

    expect(startResponse.status).to.equal(200)
    expect(startResponse.body.eventId).to.be.a('string')
    expect(startResponse.body.status).to.equal('queued')

    const repeatedStartResponse = await request(app)
      .post(`/api/v1/file-conversions/${createResponse.body.id}/start`)
      .set('X-File-Conversion-Token', serviceToken)
      .send({
        operator: 'converter-service'
      })

    expect(repeatedStartResponse.status).to.equal(200)
    expect(repeatedStartResponse.body.eventId).to.equal(startResponse.body.eventId)
    expect(repeatedStartResponse.body.status).to.equal('queued')

    const processingResponse = await request(app)
      .post(`/api/v1/file-conversions/${createResponse.body.id}/processing`)
      .set('X-File-Conversion-Token', serviceToken)
      .send({
        eventId: startResponse.body.eventId,
        operator: 'converter-service'
      })

    expect(processingResponse.status).to.equal(200)
    expect(processingResponse.body.status).to.equal('processing')

    const repeatedProcessingResponse = await request(app)
      .post(`/api/v1/file-conversions/${createResponse.body.id}/processing`)
      .set('X-File-Conversion-Token', serviceToken)
      .send({
        eventId: startResponse.body.eventId,
        operator: 'converter-service'
      })

    expect(repeatedProcessingResponse.status).to.equal(200)
    expect(repeatedProcessingResponse.body.status).to.equal('processing')

    const resultUploadUrlResponse = await request(app)
      .post(`/api/v1/file-conversions/${createResponse.body.id}/result-upload-url`)
      .set('X-File-Conversion-Token', serviceToken)
      .send({
        fileName: 'robots-converted.txt',
        fileSize: sourceFile.length,
        contentType: 'text/plain'
      })

    expect(resultUploadUrlResponse.status).to.equal(200)
    expect(resultUploadUrlResponse.body.uploadUrl).to.be.a('string')
    expect(resultUploadUrlResponse.body.resultObjectKey).to.be.a('string')

    const resultUploadResponse = await axios.put(
      resultUploadUrlResponse.body.uploadUrl,
      sourceFile,
      {
        headers: {
          'Content-Type': 'text/plain'
        }
      }
    )

    expect(resultUploadResponse.status).to.equal(200)

    const callbackResponse = await request(app)
      .post(`/api/v1/file-conversions/${createResponse.body.id}/callback`)
      .set('X-File-Conversion-Token', serviceToken)
      .send({
        eventId: startResponse.body.eventId,
        status: 'success',
        resultObjectKey: resultUploadUrlResponse.body.resultObjectKey,
        resultFileUrl: resultUploadUrlResponse.body.resultFileUrl
      })

    expect(callbackResponse.status).to.equal(200)
    expect(callbackResponse.body.status).to.equal('success')

    const listResponse = await request(app)
      .get('/api/v1/file-conversions')
      .set('Authorization', `Bearer ${userToken}`)

    expect(listResponse.status).to.equal(200)
    expect(listResponse.body.items).to.have.lengthOf(1)
    expect(listResponse.body.items[0].id).to.equal(createResponse.body.id)
    expect(listResponse.body.items[0].status).to.equal('success')
    expect(listResponse.body.items[0].isConverted).to.equal(true)
    expect(listResponse.body.items[0].resultFileUrl).to.be.a('string')
  })

  it('rejects third-party routes without the fixed token header', async () => {
    const response = await request(app).get('/api/v1/file-conversions/pending')

    expect(response.status).to.equal(401)
    expect(response.body.error).to.contain('x-file-conversion-token')
  })

  it('marks conversion as failed from callback', async () => {
    const sourceFile = readFileSync(robotsTxtPath)

    const createResponse = await request(app)
      .post('/api/v1/file-conversions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        fileName: 'robots-failed.txt',
        fileSize: sourceFile.length
      })

    const sourceUploadResponse = await axios.put(createResponse.body.uploadUrl, sourceFile, {
      headers: {
        'Content-Type': 'text/plain'
      }
    })

    await request(app)
      .post(`/api/v1/file-conversions/${createResponse.body.id}/upload-complete`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        etag: sourceUploadResponse.headers['etag']
      })

    const startResponse = await request(app)
      .post(`/api/v1/file-conversions/${createResponse.body.id}/start`)
      .set('X-File-Conversion-Token', serviceToken)
      .send({
        operator: 'converter-service'
      })

    const failedCallbackResponse = await request(app)
      .post(`/api/v1/file-conversions/${createResponse.body.id}/callback`)
      .set('X-File-Conversion-Token', serviceToken)
      .send({
        eventId: startResponse.body.eventId,
        status: 'failed',
        message: 'convert failed'
      })

    expect(failedCallbackResponse.status).to.equal(200)
    expect(failedCallbackResponse.body.status).to.equal('failed')

    const listResponse = await request(app)
      .get('/api/v1/file-conversions')
      .set('Authorization', `Bearer ${userToken}`)

    const failedItem = listResponse.body.items.find(
      (item: { id: string }) => item.id === createResponse.body.id
    )

    expect(failedItem).to.exist
    expect(failedItem.status).to.equal('failed')
    expect(failedItem.errorMessage).to.equal('convert failed')
  })
})
