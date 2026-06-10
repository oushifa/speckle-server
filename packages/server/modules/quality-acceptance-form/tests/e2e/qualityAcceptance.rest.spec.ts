import request from 'supertest'
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as XLSX from 'xlsx'
import { beforeEachContext, getMainTestRegionKeyIfMultiRegion } from '@/test/hooks'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import { Scopes } from '@/modules/core/helpers/mainConstants'
import { db } from '@/db/knex'
import { createTokenFactory } from '@/modules/core/services/tokens'
import {
  storeApiTokenFactory,
  storeTokenScopesFactory,
  storeTokenResourceAccessDefinitionsFactory
} from '@/modules/core/repositories/tokens'
import { createTestStream } from '@/test/speckle-helpers/streamHelper'
import { waitForRegionUser } from '@/test/speckle-helpers/regions'
import { createTestWorkspace } from '@/modules/workspaces/tests/helpers/creation'
import { createTestUser, type BasicTestUser } from '@/test/authHelper'
import cryptoRandomString from 'crypto-random-string'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'

const createRandomUser = async (): Promise<BasicTestUser> => {
  const userDetails = {
    name: cryptoRandomString({ length: 10 }),
    email: `${cryptoRandomString({ length: 10, type: 'url-safe' })}@example.org`,
    password: cryptoRandomString({ length: 12 })
  }
  return createTestUser(userDetails)
}

const createToken = createTokenFactory({
  storeApiToken: storeApiTokenFactory({ db }),
  storeTokenScopes: storeTokenScopesFactory({ db }),
  storeTokenResourceAccessDefinitions: storeTokenResourceAccessDefinitionsFactory({
    db
  })
})

const binaryParser = (res: any, callback: any) => {
  res.setEncoding('binary')
  let data = ''
  res.on('data', (chunk: string) => {
    data += chunk
  })
  res.on('end', () => {
    callback(null, Buffer.from(data, 'binary'))
  })
}

describe('Quality Acceptance Excel Import and Export REST API @quality-acceptance-rest', () => {
  let app: Express.Application
  let token: string
  let user: BasicTestUser
  let projectId: string
  const workspace = {
    name: 'QA Workspace',
    ownerId: '',
    id: '',
    slug: ''
  }
  
  const excelPath = path.join(__dirname, 'test-quality-acceptance.xlsx')

  const generateTestExcel = () => {
    const headers = [
      '验收单名称',
      '编码',
      '检验批编号',
      '区域部位',
      '检验批内容',
      '验收日期',
      '工程量',
      '单位',
      '月度验工',
      '关联构件ID'
    ]
    const rows = [
      [
        '测试验收单1',
        'QA-001',
        'LOT-2026-001',
        '1层主体',
        '混凝土浇筑质量验收',
        '2026-06-09',
        150.5,
        'm³',
        '正在查验',
        'CLASS001SPACE001SEC001001' // 待自动补全关联构件编码 (匹配 object-1)
      ],
      [
        '测试验收单2',
        'QA-002',
        'LOT-2026-002',
        '2层结构',
        '钢筋绑扎质量验收',
        '2026-06-10',
        80.0,
        't',
        '已查验',
        'CLASS002SPACE001SEC002002' // 待自动补全关联构件编码 (匹配 object-2)
      ],
      [
        '测试验收单3',
        'QA-003',
        'LOT-2026-003',
        '3层结构',
        '模板安装质量验收',
        '2026-06-11',
        50.0,
        'm²',
        '未查验',
        'NON_EXISTENT_CODE' // 测试无法匹配时的兜底策略
      ]
    ]
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '质量验收')
    XLSX.writeFile(workbook, excelPath)
  }

  before(async () => {
    ;({ app } = await beforeEachContext())
    user = await createRandomUser()
    await waitForRegionUser(user.id)
    await createTestWorkspace(workspace, user, {
      regionKey: getMainTestRegionKeyIfMultiRegion()
    })
    
    ;({ token } = await createToken({
      userId: user.id,
      name: 'quality acceptance test token',
      scopes: [Scopes.Streams.Write, Scopes.Streams.Read]
    }))

    const stream: any = {
      name: 'Quality Test Stream',
      isPublic: false,
      workspaceId: workspace.id
    }
    await createTestStream(stream, user)
    projectId = stream.id!
    
    // 注入模拟的 3D 模型版本及 Speckle Objects 对象
    const projectDb = await getProjectDbClient({ projectId })
    
    // 1. 插入 Commit (代表一个模型版本)
    await projectDb('commits').insert({
      id: 'tst_commit',
      referencedObject: 'tst_rt_obj',
      createdAt: new Date(),
      parents: null
    })

    // 2. 关联 streamId
    await projectDb('stream_commits').insert({
      streamId: projectId,
      commitId: 'tst_commit'
    })

    // 3. 插入 objects (包含 closure 闭包、空间代码和构件对象)
    await projectDb('objects').insert([
      {
        id: 'tst_rt_obj',
        speckleType: 'Base',
        totalChildrenCount: 3,
        totalChildrenCountByDepth: null,
        createdAt: new Date(),
        streamId: projectId,
        data: JSON.stringify({
          __closure: {
            'tst_obj_1': 1,
            'tst_obj_2': 1,
            'tst_prj_inf': 1
          }
        })
      },
      {
        id: 'tst_prj_inf',
        speckleType: 'ProjectInformation',
        totalChildrenCount: 0,
        totalChildrenCountByDepth: null,
        createdAt: new Date(),
        streamId: projectId,
        data: JSON.stringify({
          category: '项目信息',
          spacecode: 'SPACE001'
        })
      },
      {
        id: 'tst_obj_1',
        speckleType: 'Element',
        totalChildrenCount: 0,
        totalChildrenCountByDepth: null,
        createdAt: new Date(),
        streamId: projectId,
        data: JSON.stringify({
          classificationobjectcode: 'CLASS001',
          sectionitemcode: 'SEC001',
          serialnumber: '001'
        })
      },
      {
        id: 'tst_obj_2',
        speckleType: 'Element',
        totalChildrenCount: 0,
        totalChildrenCountByDepth: null,
        createdAt: new Date(),
        streamId: projectId,
        data: JSON.stringify({
          classificationobjectcode: 'CLASS002',
          sectionitemcode: 'SEC002',
          serialnumber: '002'
        })
      }
    ])

    // Create excel directory if not exists
    const dir = path.dirname(excelPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    generateTestExcel()
  })

  after(() => {
    if (fs.existsSync(excelPath)) {
      fs.unlinkSync(excelPath)
    }
  })

  it('Imports standard Quality Acceptance Excel and resolves bimIds into GQL structure', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/quality-acceptance/forms/import-excel`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', excelPath)

    expect(response.status).to.equal(200)
    expect(response.body.success).to.be.true
    expect(response.body.createdCount).to.equal(3)

    // Verify database entry
    const projectDb = await getProjectDbClient({ projectId })
    const records = await projectDb('quality_acceptance_forms')
      .where('project_id', projectId)
      .orderBy('code', 'asc')

    expect(records.length).to.equal(3)
    
    // 校验测试验收单1 (成功匹配构件1)
    expect(records[0].name).to.equal('测试验收单1')
    expect(records[0].inspectionLotNumber).to.equal('LOT-2026-001')
    expect(records[0].approveStatus).to.equal('PENDING') // '正在查验' mapping

    const bim1 = typeof records[0].BIM === 'string' ? JSON.parse(records[0].BIM) : records[0].BIM
    expect(bim1).to.be.an('array')
    expect(bim1.length).to.equal(1)
    expect(bim1[0].modelId).to.equal('tst_commit')
    expect(bim1[0].applicationIds).to.deep.equal(['tst_obj_1'])
    expect(bim1[0].bimIds).to.deep.equal(['CLASS001SPACE001SEC001001'])

    // 校验测试验收单3 (没找到任何匹配时的兜底策略)
    expect(records[2].name).to.equal('测试验收单3')
    const bim3 = typeof records[2].BIM === 'string' ? JSON.parse(records[2].BIM) : records[2].BIM
    expect(bim3).to.be.an('array')
    expect(bim3.length).to.equal(1)
    expect(bim3[0].modelId).to.equal('')
    expect(bim3[0].applicationIds).to.deep.equal(['NON_EXISTENT_CODE'])
    expect(bim3[0].bimIds).to.deep.equal(['NON_EXISTENT_CODE'])
  })

  it('Exports Quality Acceptance Excel successfully with unique codes matching the database', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/quality-acceptance/forms/export-excel`)
      .set('Authorization', `Bearer ${token}`)
      .parse(binaryParser)
      .buffer(true)

    expect(response.status).to.equal(200)
    expect(response.headers['content-type']).to.include('sheet')
    expect(response.body).to.be.instanceOf(Buffer)

    // Parse the output buffer to verify the data
    const workbook = XLSX.read(response.body, { type: 'buffer' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 })
    
    // Expect header row + 3 data rows
    expect(rows.length).to.equal(4)
    const headerRow = rows[0]
    expect(headerRow).to.include('关联构件ID')
    
    const bimColIndex = headerRow.indexOf('关联构件ID')
    
    // 由于是按 updatedAt desc 排序，最后插入的第3个单子排第一行
    expect(rows[1][bimColIndex]).to.equal('NON_EXISTENT_CODE')
    expect(rows[2][bimColIndex]).to.equal('CLASS002SPACE001SEC002002')
    expect(rows[3][bimColIndex]).to.equal('CLASS001SPACE001SEC001001')
  })

  it('Exports empty template correctly', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/quality-acceptance/forms/export-excel`)
      .query({ template: 'true' })
      .set('Authorization', `Bearer ${token}`)
      .parse(binaryParser)
      .buffer(true)

    expect(response.status).to.equal(200)
    const workbook = XLSX.read(response.body, { type: 'buffer' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 })
    
    // Only header row should present
    expect(rows.length).to.equal(1)
  })

  it('Blocks unauthenticated access', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/quality-acceptance/forms/export-excel`)

    expect([401, 403]).to.include(response.status)
  })
})
