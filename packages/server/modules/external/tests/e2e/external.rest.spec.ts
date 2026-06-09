import request from 'supertest'
import { expect } from 'chai'
import { beforeEachContext } from '@/test/hooks'
import { db } from '@/db/knex'
import { createTestStream } from '@/test/speckle-helpers/streamHelper'
import { createTestUser, type BasicTestUser } from '@/test/authHelper'
import { waitForRegionUser } from '@/test/speckle-helpers/regions'
import cryptoRandomString from 'crypto-random-string'
import crypto from 'crypto'
import { getSessionSecret } from '@/modules/shared/helpers/envHelper'

const createRandomUser = async (): Promise<BasicTestUser> => {
  const userDetails = {
    name: cryptoRandomString({ length: 10 }),
    email: `${cryptoRandomString({ length: 10, type: 'url-safe' })}@example.org`,
    password: cryptoRandomString({ length: 12 })
  }
  return createTestUser(userDetails)
}

describe('External API @external', () => {
  let app: Express.Application
  let user: BasicTestUser
  let projectId: string
  const testToken = 'SuperSecureExternalToken123!'

  before(async () => {
    ;({ app } = await beforeEachContext())
    user = await createRandomUser()
    await waitForRegionUser(user.id)

    // 创建测试项目 (Stream)
    const stream: any = {
      name: 'External Test Project',
      isPublic: false
    }
    await createTestStream(stream, user)
    projectId = stream.id!
  })

  describe('Authentication checks', () => {
    beforeEach(() => {
      // 默认设置正确的 token
      process.env.EXTERNAL_API_TOKEN = testToken
    })

    afterEach(() => {
      delete process.env.EXTERNAL_API_TOKEN
    })

    it('returns 500 when EXTERNAL_API_TOKEN is not configured', async () => {
      delete process.env.EXTERNAL_API_TOKEN

      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}`)
        .set('x-external-token', testToken)

      expect(response.status).to.equal(500)
      expect(response.body.error).to.include('not configured')
    })

    it('returns 401 when token is missing or invalid', async () => {
      // 1. 缺失 token
      let response = await request(app)
        .get(`/api/v1/external/projects/${projectId}`)
      expect(response.status).to.equal(401)

      // 2. 错误的 token (通过 header x-external-token)
      response = await request(app)
        .get(`/api/v1/external/projects/${projectId}`)
        .set('x-external-token', 'wrong_token')
      expect(response.status).to.equal(401)

      // 3. 错误的 token (通过 query parameter)
      response = await request(app)
        .get(`/api/v1/external/projects/${projectId}`)
        .query({ token: 'wrong_token' })
      expect(response.status).to.equal(401)
    })

    it('allows access with correct token in header x-external-token', async () => {
      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}`)
        .set('x-external-token', testToken)

      expect(response.status).to.equal(200)
      expect(response.body.id).to.equal(projectId)
      expect(response.body.name).to.equal('External Test Project')
    })

    it('allows access with correct token in query parameter', async () => {
      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}`)
        .query({ token: testToken })

      expect(response.status).to.equal(200)
      expect(response.body.id).to.equal(projectId)
    })
  })

  describe('Data Endpoints', () => {
    before(() => {
      process.env.EXTERNAL_API_TOKEN = testToken
    })

    after(() => {
      delete process.env.EXTERNAL_API_TOKEN
    })

    it('gets project progress plan tasks', async () => {
      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}/progress/plan-tasks`)
        .set('x-external-token', testToken)

      expect(response.status).to.equal(200)
      expect(response.body.projectId).to.equal(projectId)
      expect(response.body.planTasks).to.be.an('array')
    })

    it('gets project progress actual records', async () => {
      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}/progress/actual-records`)
        .set('x-external-token', testToken)

      expect(response.status).to.equal(200)
      expect(response.body.projectId).to.equal(projectId)
      expect(response.body.actualRecords).to.be.an('array')
    })

    it('gets quality acceptance forms', async () => {
      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}/quality-acceptance/forms`)
        .set('x-external-token', testToken)

      expect(response.status).to.equal(200)
      expect(response.body.totalCount).to.be.a('number')
      expect(response.body.items).to.be.an('array')
    })
  })

  describe('Presigned Blob Downloads', () => {
    const testBlobId = 'test_blob_id_999'

    it('fails presigned download if missing signature or expires', async () => {
      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}/blobs/${testBlobId}`)

      expect(response.status).to.equal(400)
      expect(response.body.error).to.include('Missing')
    })

    it('fails presigned download if signature is invalid', async () => {
      const expires = Date.now() + 60000
      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}/blobs/${testBlobId}`)
        .query({ expires, signature: 'invalid_sig' })

      expect(response.status).to.equal(403)
      expect(response.body.error).to.include('Invalid signature')
    })

    it('fails presigned download if link has expired', async () => {
      const expires = Date.now() - 60000 // 已过期
      const secret = getSessionSecret()
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${projectId}:${testBlobId}:${expires}`)
        .digest('hex')

      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}/blobs/${testBlobId}`)
        .query({ expires, signature })

      expect(response.status).to.equal(410)
      expect(response.body.error).to.include('expired')
    })
  })
})
