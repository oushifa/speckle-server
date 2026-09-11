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

  describe('Progress V2 Data Endpoints', () => {
    const manualCodeRecordId = 'v2act_man1'
    const resolvedCodeRecordId = 'v2act_res1'
    const milestoneRecordId = 'v2ms_ok1'
    const nonMilestoneRecordId = 'v2ms_no1'
    const linkedApplicationId = 'progress_v2_app_id_1'
    const linkedBimCode = '14-94.04.01.00.00.1NB01010101CB1-77'

    before(async () => {
      process.env.EXTERNAL_API_TOKEN = testToken

      // 1. 进度填报记录：一条已存构件编码，一条仅关联构件 ID（需服务端反查完整编码）
      await db('project_progress_v2_actual_records').insert([
        {
          id: manualCodeRecordId,
          projectId,
          taskName: '地下一层顶板钢筋绑扎',
          reportDate: '2026-09-02',
          planStartDate: new Date('2026-09-01T00:00:00.000Z'),
          planEndDate: new Date('2026-09-10T00:00:00.000Z'),
          actualStartDate: new Date('2026-09-02T00:00:00.000Z'),
          actualEndDate: new Date('2026-09-12T00:00:00.000Z'),
          progressPercent: 60,
          componentCode: 'CB1-99',
          reporter: '李工',
          remark: '受降雨影响顺延一天',
          BIM: JSON.stringify([
            {
              modelId: 'test_model_v2_1',
              applicationIds: ['progress_v2_app_id_manual'],
              componentCodes: ['CB1-99']
            }
          ]),
          creator: user.id,
          updater: user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: resolvedCodeRecordId,
          projectId,
          taskName: '地下一层顶板混凝土浇筑',
          reportDate: '2026-09-05',
          planStartDate: new Date('2026-09-04T00:00:00.000Z'),
          planEndDate: new Date('2026-09-08T00:00:00.000Z'),
          actualStartDate: null,
          actualEndDate: null,
          progressPercent: 0,
          componentCode: null,
          reporter: '李工',
          remark: null,
          BIM: JSON.stringify([
            {
              modelId: 'test_model_v2_1',
              applicationIds: [linkedApplicationId]
            }
          ]),
          creator: user.id,
          updater: user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      // 2. 关联构件对象（用于反查第三方完整构件编码）
      await db('objects').insert({
        id: 'progress_v2_object_1',
        streamId: projectId,
        speckleType: 'Objects.Data.DataObject',
        data: JSON.stringify({
          id: 'progress_v2_object_1',
          applicationId: linkedApplicationId,
          properties: {
            'Property Sets': {
              文字: {
                构件编码: linkedBimCode
              }
            }
          }
        })
      })

      // 3. 里程碑：一条带 milestone 标签，一条仅带 key 标签（应被过滤）
      await db('project_progress_v2_milestones').insert([
        {
          id: milestoneRecordId,
          projectId,
          taskName: '主体结构封顶',
          plannedStart: new Date('2026-10-01T00:00:00.000Z'),
          plannedEnd: new Date('2026-10-31T00:00:00.000Z'),
          actualStart: new Date('2026-10-03T00:00:00.000Z'),
          actualEnd: null,
          status: '进行中',
          milestoneType: 'phase',
          responsible: '张工',
          remark: '受材料到场时间影响',
          tags: JSON.stringify(['milestone']),
          creator: user.id,
          updater: user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: nonMilestoneRecordId,
          projectId,
          taskName: '关键节点（非里程碑标签）',
          plannedStart: new Date('2026-11-01T00:00:00.000Z'),
          plannedEnd: new Date('2026-11-10T00:00:00.000Z'),
          actualStart: null,
          actualEnd: null,
          status: '未开始',
          milestoneType: 'phase',
          responsible: '张工',
          remark: null,
          tags: JSON.stringify(['key']),
          creator: user.id,
          updater: user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])
    })

    after(async () => {
      delete process.env.EXTERNAL_API_TOKEN

      await db('project_progress_v2_actual_records')
        .whereIn('id', [manualCodeRecordId, resolvedCodeRecordId])
        .del()
      await db('project_progress_v2_milestones')
        .whereIn('id', [milestoneRecordId, nonMilestoneRecordId])
        .del()
      await db('objects').where('id', 'progress_v2_object_1').del()
    })

    it('gets project progress records with the required progress info fields', async () => {
      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}/progress-v2/actual-records`)
        .set('x-external-token', testToken)

      expect(response.status).to.equal(200)
      expect(response.body.projectId).to.equal(projectId)
      expect(response.body.progressRecords).to.be.an('array')
      expect(response.body.totalCount).to.equal(response.body.progressRecords.length)

      const record = response.body.progressRecords.find(
        (item: any) => item.id === manualCodeRecordId
      )
      expect(record).to.exist
      expect(record.taskName).to.equal('地下一层顶板钢筋绑扎')
      expect(record.componentCode).to.equal('CB1-99')
      expect(record.componentCodes).to.deep.equal(['CB1-99'])
      expect(record.planStartDate).to.equal('2026-09-01T00:00:00.000Z')
      expect(record.planEndDate).to.equal('2026-09-10T00:00:00.000Z')
      expect(record.actualStartDate).to.equal('2026-09-02T00:00:00.000Z')
      expect(record.actualEndDate).to.equal('2026-09-12T00:00:00.000Z')
      expect(record.remark).to.equal('受降雨影响顺延一天')
    })

    it('resolves component codes of linked BIM elements for progress records', async () => {
      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}/progress-v2/actual-records`)
        .set('x-external-token', testToken)
        .query({ search: '混凝土浇筑' })

      expect(response.status).to.equal(200)
      expect(response.body.progressRecords).to.have.lengthOf(1)

      const record = response.body.progressRecords[0]
      expect(record.id).to.equal(resolvedCodeRecordId)
      expect(record.componentCode).to.equal(null)
      expect(record.componentCodes).to.deep.equal([linkedBimCode])
      expect(record.planStartDate).to.equal('2026-09-04T00:00:00.000Z')
      expect(record.actualStartDate).to.equal(null)
      expect(record.actualEndDate).to.equal(null)
    })

    it('returns only milestones tagged with milestone', async () => {
      const response = await request(app)
        .get(`/api/v1/external/projects/${projectId}/progress-v2/milestones`)
        .set('x-external-token', testToken)

      expect(response.status).to.equal(200)
      expect(response.body.projectId).to.equal(projectId)
      expect(response.body.milestones).to.be.an('array')
      expect(response.body.totalCount).to.equal(response.body.milestones.length)

      const ids = response.body.milestones.map((item: { id: string }) => item.id)
      expect(ids).to.include(milestoneRecordId)
      expect(ids).to.not.include(nonMilestoneRecordId)

      const milestone = response.body.milestones.find(
        (item: any) => item.id === milestoneRecordId
      )
      expect(milestone.taskName).to.equal('主体结构封顶')
      expect(milestone.plannedStart).to.equal('2026-10-01T00:00:00.000Z')
      expect(milestone.plannedEnd).to.equal('2026-10-31T00:00:00.000Z')
      expect(milestone.actualStart).to.equal('2026-10-03T00:00:00.000Z')
      expect(milestone.actualEnd).to.equal(null)
      expect(milestone.status).to.equal('进行中')
      expect(milestone.remark).to.equal('受材料到场时间影响')
      expect(milestone.tags).to.include('milestone')
    })

    it('returns 401 for progress v2 endpoints without a valid token', async () => {
      const progressResponse = await request(app).get(
        `/api/v1/external/projects/${projectId}/progress-v2/actual-records`
      )
      expect(progressResponse.status).to.equal(401)

      const milestoneResponse = await request(app).get(
        `/api/v1/external/projects/${projectId}/progress-v2/milestones`
      )
      expect(milestoneResponse.status).to.equal(401)
    })

    it('returns 404 for progress v2 endpoints when the project does not exist', async () => {
      const response = await request(app)
        .get(`/api/v1/external/projects/not_existing_project/progress-v2/milestones`)
        .set('x-external-token', testToken)

      expect(response.status).to.equal(404)
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
