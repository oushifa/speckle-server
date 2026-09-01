import request from 'supertest'
import { expect } from 'chai'
import { beforeEachContext, getMainTestRegionKeyIfMultiRegion } from '@/test/hooks'
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
import * as XLSX from 'xlsx'
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

// Parser for supertest to read binary Excel response as Buffer
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

const createBoqExcelBuffer = (rows: Array<Array<string | number>>) => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'BOQ')

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx'
  })
}

describe('BOQ Excel Import and Export REST API @boq-rest', () => {
  let app: Express.Application
  let token: string
  let user: BasicTestUser
  let projectId: string
  const workspace = {
    name: 'BOQ Workspace',
    ownerId: '',
    id: '',
    slug: ''
  }

  before(async () => {
    ;({ app } = await beforeEachContext())
    user = await createRandomUser()
    await waitForRegionUser(user.id)
    await createTestWorkspace(workspace, user, {
      regionKey: getMainTestRegionKeyIfMultiRegion()
    })

    // Create token
    ;({ token } = await createToken({
      userId: user.id,
      name: 'boq test token',
      scopes: [Scopes.Streams.Write, Scopes.Streams.Read]
    }))

    // Create stream
    const stream: any = {
      name: 'BOQ Test Stream',
      isPublic: false,
      workspaceId: workspace.id
    }
    await createTestStream(stream, user)
    projectId = stream.id!
  })

  it('Imports standard BOQ Excel successfully', async () => {
    const excelPath =
      '/Users/yujian/work/speckle-server/packages/frontend-2/public/1-南北通道浦西段和越江段新建工程2标-市出-整理后.xlsx'

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/boq/import-excel`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', excelPath)

    expect(response.status).to.equal(200)
    expect(response.body.success).to.be.true
    expect(response.body.createdCount).to.be.greaterThan(0)
  })

  it('Imports BOQ Excel when amount header uses 合同价（元）', async () => {
    const excelBuffer = createBoqExcelBuffer([
      [
        '清单编码',
        '清单名称',
        '类型',
        '上级编码',
        '计量单位',
        '工程量',
        '综合单价（元）',
        '合同价（元）'
      ],
      ['C99', '测试单位工程', '单位工程', '', '', '', '', ''],
      ['C9901', '测试分类工程', '分类工程', 'C99', '', '', '', 2468.5]
    ])

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/boq/import-excel`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', excelBuffer, 'boq-contract-amount.xlsx')

    expect(response.status).to.equal(200)
    expect(response.body.success).to.be.true

    const projectDb = await getProjectDbClient({ projectId })
    const importedItem = await projectDb('boq_items')
      .where({ projectId, code: 'C9901' })
      .first()

    expect(importedItem).to.exist
    expect(Number(importedItem.amount)).to.equal(2468.5)
  })

  it('Exports BOQ Excel successfully', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/boq/export-excel`)
      .set('Authorization', `Bearer ${token}`)
      .parse(binaryParser)
      .buffer(true)

    expect(response.status).to.equal(200)
    expect(response.headers['content-type']).to.include('sheet')
    expect(response.body).to.be.instanceOf(Buffer)
    expect(response.body.length).to.be.greaterThan(0)
  })

  it('Exports BOQ Excel template successfully', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/boq/export-excel`)
      .query({ template: 'true' })
      .set('Authorization', `Bearer ${token}`)
      .parse(binaryParser)
      .buffer(true)

    expect(response.status).to.equal(200)
    expect(response.headers['content-type']).to.include('sheet')
    expect(response.body).to.be.instanceOf(Buffer)
    expect(response.body.length).to.be.greaterThan(0)
  })

  it('Updates BOQ item review quantities and calculates total and amount via REST PATCH', async () => {
    const projectDb = await getProjectDbClient({ projectId })
    const item = await projectDb('boq_items').where({ projectId, type: 'ITEM' }).first()
    expect(item).to.exist

    const patchRes = await request(app)
      .patch(`/api/v1/projects/${projectId}/boq/items/${item.id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        reviewQuantity: 100,
        changeQuantity: 20,
        reviewPrice: 50
      })

    expect(patchRes.status).to.equal(200)
    expect(patchRes.body.success).to.be.true
    expect(patchRes.body.item).to.exist
    expect(patchRes.body.item.reviewQuantity).to.equal(100)
    expect(patchRes.body.item.changeQuantity).to.equal(20)
    expect(patchRes.body.item.totalQuantityWithChanges).to.equal(120)
    expect(patchRes.body.item.reviewPrice).to.equal(50)
    expect(patchRes.body.item.reviewAmount).to.equal(6000)

    const reloaded = await projectDb('boq_items').where({ id: item.id }).first()
    expect(Number(reloaded.reviewQuantity)).to.equal(100)
    expect(Number(reloaded.changeQuantity)).to.equal(20)
    expect(Number(reloaded.reviewPrice)).to.equal(50)
    expect(Number(reloaded.reviewAmount)).to.equal(6000)
  })

  it('Blocks requests without valid authorization token', async () => {
    const response = await request(app).get(
      `/api/v1/projects/${projectId}/boq/export-excel`
    )

    expect([401, 403]).to.include(response.status)
  })
})
