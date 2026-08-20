/* eslint-disable @typescript-eslint/no-explicit-any, camelcase */
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
      let response = await request(app).get(`/api/v1/external/projects/${projectId}`)
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

    it('allows access with correct token in Authorization Bearer header', async () => {
      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}`)
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).to.equal(200)
      expect(response.body.id).to.equal(projectId)
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

    it('returns 400 when componentCodes is missing or not an array', async () => {
      const response = await request(app)
        .post(
          `/api/v1/external/projects/${projectId}/quality-acceptance/by-component-codes`
        )
        .set('x-external-token', testToken)
        .send({})
      expect(response.status).to.equal(400)
      expect(response.body.error).to.include('componentCodes')
    })

    it('returns quality acceptance forms by component codes with projectId in path', async () => {
      const response = await request(app)
        .post(
          `/api/v1/external/projects/${projectId}/quality-acceptance/by-component-codes`
        )
        .set('x-external-token', testToken)
        .send({ componentCodes: ['TEST_COMP_CODE_1', 'TEST_COMP_CODE_2'] })

      expect(response.status).to.equal(200)
      expect(response.body.projectId).to.equal(projectId)
      expect(response.body.results).to.be.an('array')
      expect(response.body.results).to.have.lengthOf(2)
      expect(response.body.results[0].componentCode).to.equal('TEST_COMP_CODE_1')
      expect(response.body.results[0].forms).to.be.an('array')
    })

    it('returns quality acceptance forms by component codes without projectId in path (full traversal)', async () => {
      const response = await request(app)
        .post(`/api/v1/external/quality-acceptance/by-component-codes`)
        .set('x-external-token', testToken)
        .send({ componentCodes: ['TEST_COMP_CODE_1', 'TEST_COMP_CODE_2'] })

      expect(response.status).to.equal(200)
      expect(response.body.projectId).to.be.null
      expect(response.body.results).to.be.an('array')
      expect(response.body.results).to.have.lengthOf(2)
    })

    it('supports model_id filtering in request body', async () => {
      const response = await request(app)
        .post(`/api/v1/external/quality-acceptance/by-component-codes`)
        .set('x-external-token', testToken)
        .send({
          project_id: projectId,
          model_id: 'test_model_id_1',
          componentCodes: ['TEST_COMP_CODE_1']
        })

      expect(response.status).to.equal(200)
      expect(response.body.projectId).to.equal(projectId)
      expect(response.body.modelId).to.equal('test_model_id_1')
      expect(response.body.results).to.be.an('array')
    })

    it('successfully queries quality acceptance forms matching Revit uniqueId and component code', async () => {
      const targetUniqueId = 'revit_unique_id_test_001'
      const targetCompCode = '14-94.04.01.00.00.1NB01010101CB1-99'

      // 1. 插入构件对象（包含 Revit UniqueId 以及分类对象/分部分项/序号码）
      await db('objects').insert({
        id: 'speckle_obj_hash_999',
        streamId: projectId,
        speckleType: 'Objects.Data.DataObject',
        data: JSON.stringify({
          id: 'speckle_obj_hash_999',
          applicationId: targetUniqueId,
          properties: {
            'Property Sets': {
              文字: {
                序号码: 'CB1-99'
              }
            },
            'Element Type Property Sets': {
              文字: {
                分类对象代码: '14-94.04.01.00.00.1',
                分部分项代码: '0101'
              }
            }
          }
        })
      })

      // 2. 插入项目信息节点（包含空间代码）
      await db('objects').insert({
        id: 'speckle_project_info_999',
        streamId: projectId,
        speckleType: 'Objects.Data.DataObject',
        data: JSON.stringify({
          id: 'speckle_project_info_999',
          ifcType: 'IfcSite',
          properties: {
            'Property Sets': {
              其他: { 类别: '项目信息' },
              文字: { 空间代码: 'NB0101' }
            }
          }
        })
      })

      // 3. 插入质量验收表单（applicationIds 存储 Revit UniqueId）
      const formId = 'qa_form_test_revit_001'
      await db('quality_acceptance_forms').insert({
        id: formId,
        project_id: projectId,
        name: 'Revit UniqueId 测试验收单',
        inspectionLotNumber: 'LOT-REVIT-001',
        acceptancePart: '基坑支护',
        workVolume: 50,
        unit: 'm3',
        creator: user.id,
        BIM: JSON.stringify([
          {
            modelId: 'test_model_revit_1',
            applicationIds: [targetUniqueId],
            bimIds: ['CB1-99']
          }
        ]),
        attachments: '[]',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // 4. 调用外部 API 通过构件编码查询
      const response = await request(app)
        .post(`/api/v1/external/quality-acceptance/by-component-codes`)
        .set('x-external-token', testToken)
        .send({
          project_id: projectId,
          componentCodes: [targetCompCode]
        })

      expect(response.status).to.equal(200)
      expect(response.body.results).to.have.lengthOf(1)
      expect(response.body.results[0].componentCode).to.equal(targetCompCode)
      expect(response.body.results[0].forms).to.have.lengthOf(1)
      expect(response.body.results[0].forms[0].id).to.equal(formId)
      expect(response.body.results[0].forms[0].name).to.equal(
        'Revit UniqueId 测试验收单'
      )
      expect(response.body.results[0].forms[0].BIM[0].bimCodes).to.deep.equal([
        targetCompCode
      ])
    })
  })

  describe('Presigned Blob Downloads', () => {
    const testBlobId = 'test_blob_id_999'

    it('fails presigned download if missing signature or expires', async () => {
      const response = await request(app).get(
        `/api/v1/external/projects/${projectId}/blobs/${testBlobId}`
      )

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
