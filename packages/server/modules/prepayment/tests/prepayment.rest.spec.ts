import request from 'supertest'
import { expect } from 'chai'
import { beforeEachContext } from '@/test/hooks'
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
import { createTestUser, type BasicTestUser } from '@/test/authHelper'
import cryptoRandomString from 'crypto-random-string'

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

describe('Prepayment Items REST API @prepayment-rest', () => {
  let app: Express.Application
  let token: string
  let user: BasicTestUser
  let projectId: string

  before(async () => {
    ;({ app } = await beforeEachContext())
    user = await createRandomUser()
    await waitForRegionUser(user.id)
    
    ;({ token } = await createToken({
      userId: user.id,
      name: 'prepayment test token',
      scopes: [Scopes.Streams.Write, Scopes.Streams.Read]
    }))

    const stream: any = {
      name: 'Prepayment Test Project',
      isPublic: false
    }
    await createTestStream(stream, user)
    projectId = stream.id!
  })

  it('Creates a prepayment item successfully', async () => {
    const payload = {
      name: '施工中期支付预留-15%',
      type: '预留数',
      percentage: 15,
      category: '中期支付预留'
    }

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/prepayment-items`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    expect(response.status).to.equal(201)
    expect(response.body.data).to.have.property('id')
    expect(response.body.data.name).to.equal(payload.name)
    expect(response.body.data.type).to.equal(payload.type)
    expect(response.body.data.percentage).to.equal(payload.percentage)
    expect(response.body.data.category).to.equal(payload.category)
  })

  it('Creates a prepayment item with null percentage', async () => {
    const payload = {
      name: '税费调整后合计',
      type: '预付数',
      percentage: null,
      category: '税费调整后合计'
    }

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/prepayment-items`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    expect(response.status).to.equal(201)
    expect(response.body.data.percentage).to.be.null
  })

  it('Rejects invalid input (type / category)', async () => {
    const payload = {
      name: '无效项',
      type: '未知类型',
      percentage: 10,
      category: '无效类别'
    }

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/prepayment-items`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    expect(response.status).to.equal(400)
  })

  it('Gets prepayment items page with search', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/prepayment-items`)
      .query({ search: '施工中期', page: 1, limit: 10 })
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).to.equal(200)
    expect(response.body.data).to.be.an('array')
    expect(response.body.data.length).to.equal(1)
    expect(response.body.meta.total).to.equal(1)
    expect(response.body.data[0].name).to.equal('施工中期支付预留-15%')
  })

  it('Updates an existing prepayment item', async () => {
    // 首先建一个要被更新的条目
    const responseCreate = await request(app)
      .post(`/api/v1/projects/${projectId}/prepayment-items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '材料中期支付预留-5%',
        type: '预留数',
        percentage: 5,
        category: '中期支付预留'
      })

    const itemId = responseCreate.body.data.id

    const updatePayload = {
      name: '材料中期支付预留-6% (已修改)',
      type: '预留数',
      percentage: 6,
      category: '中期支付预留'
    }

    const responseUpdate = await request(app)
      .put(`/api/v1/projects/${projectId}/prepayment-items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatePayload)

    expect(responseUpdate.status).to.equal(200)
    expect(responseUpdate.body.data.name).to.equal(updatePayload.name)
    expect(responseUpdate.body.data.percentage).to.equal(updatePayload.percentage)
  })

  it('Deletes a prepayment item', async () => {
    const responseCreate = await request(app)
      .post(`/api/v1/projects/${projectId}/prepayment-items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '待删除项目',
        type: '预付数',
        percentage: 10,
        category: '预付款'
      })

    const itemId = responseCreate.body.data.id

    const responseDelete = await request(app)
      .delete(`/api/v1/projects/${projectId}/prepayment-items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(responseDelete.status).to.equal(200)
    expect(responseDelete.body.data.id).to.equal(itemId)

    // 重新获取该条目应返回 404
    const responseGet = await request(app)
      .get(`/api/v1/projects/${projectId}/prepayment-items`)
      .set('Authorization', `Bearer ${token}`)

    const found = responseGet.body.data.find((item: any) => item.id === itemId)
    expect(found).to.be.undefined
  })

  it('Blocks unauthenticated access', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/prepayment-items`)

    expect([401, 403]).to.include(response.status)
  })
})
