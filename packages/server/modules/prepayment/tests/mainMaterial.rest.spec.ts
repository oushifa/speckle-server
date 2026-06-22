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

const createRandomUser = async (role?: any): Promise<BasicTestUser> => {
  const userDetails = {
    name: cryptoRandomString({ length: 10 }),
    email: `${cryptoRandomString({ length: 10, type: 'url-safe' })}@example.org`,
    password: cryptoRandomString({ length: 12 }),
    role
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

describe('Main Materials REST API @main-materials-rest', () => {
  let app: Express.Application
  let token: string
  let user: BasicTestUser
  let projectId: string

  before(async () => {
    ;({ app } = await beforeEachContext())
    user = await createRandomUser('server:admin')
    await waitForRegionUser(user.id)
    
    ;({ token } = await createToken({
      userId: user.id,
      name: 'main material test token',
      scopes: [Scopes.Streams.Write, Scopes.Streams.Read]
    }))

    const stream: any = {
      name: 'Main Material Test Project',
      isPublic: false
    }
    await createTestStream(stream, user)
    projectId = stream.id!
  })

  it('Creates a main material successfully', async () => {
    const payload = {
      name: '钢筋',
      specification: 'HRB400 φ12',
      unit: 't',
      referencePrice: 4200,
      category: '钢材'
    }

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/main-materials`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    expect(response.status).to.equal(201)
    expect(response.body.data).to.have.property('id')
    expect(response.body.data.name).to.equal(payload.name)
    expect(response.body.data.specification).to.equal(payload.specification)
    expect(response.body.data.unit).to.equal(payload.unit)
    expect(response.body.data.referencePrice).to.equal(payload.referencePrice)
    expect(response.body.data.category).to.equal(payload.category)
  })

  it('Gets main materials page with search by name/spec/category', async () => {
    // 增加不同种类的条目用以搜索测试
    await request(app)
      .post(`/api/v1/projects/${projectId}/main-materials`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '商品混凝土',
        specification: 'C30',
        unit: 'm³',
        referencePrice: 520,
        category: '混凝土'
      })

    // 1. 搜索名称
    const responseName = await request(app)
      .get(`/api/v1/projects/${projectId}/main-materials`)
      .query({ search: '混凝土', page: 1, limit: 10 })
      .set('Authorization', `Bearer ${token}`)

    expect(responseName.status).to.equal(200)
    expect(responseName.body.data.length).to.equal(1)
    expect(responseName.body.data[0].name).to.equal('商品混凝土')

    // 2. 搜索规格
    const responseSpec = await request(app)
      .get(`/api/v1/projects/${projectId}/main-materials`)
      .query({ search: 'φ12', page: 1, limit: 10 })
      .set('Authorization', `Bearer ${token}`)

    expect(responseSpec.status).to.equal(200)
    expect(responseSpec.body.data.length).to.equal(1)
    expect(responseSpec.body.data[0].name).to.equal('钢筋')
  })

  it('Updates a main material', async () => {
    const responseCreate = await request(app)
      .post(`/api/v1/projects/${projectId}/main-materials`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'PVC给水管',
        specification: 'DN100',
        unit: 'm',
        referencePrice: 38,
        category: '管材'
      })

    const itemId = responseCreate.body.data.id

    const updatePayload = {
      name: 'PVC给水管 (已更新)',
      specification: 'DN150',
      unit: 'm',
      referencePrice: 56,
      category: '管材'
    }

    const responseUpdate = await request(app)
      .put(`/api/v1/projects/${projectId}/main-materials/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatePayload)

    expect(responseUpdate.status).to.equal(200)
    expect(responseUpdate.body.data.name).to.equal(updatePayload.name)
    expect(responseUpdate.body.data.specification).to.equal(updatePayload.specification)
    expect(responseUpdate.body.data.referencePrice).to.equal(updatePayload.referencePrice)
  })

  it('Deletes a main material', async () => {
    const responseCreate = await request(app)
      .post(`/api/v1/projects/${projectId}/main-materials`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '碎石',
        specification: '5-20mm',
        unit: 'm³',
        referencePrice: 85,
        category: '骨料'
      })

    const itemId = responseCreate.body.data.id

    const responseDelete = await request(app)
      .delete(`/api/v1/projects/${projectId}/main-materials/${itemId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(responseDelete.status).to.equal(200)

    const responseGet = await request(app)
      .get(`/api/v1/projects/${projectId}/main-materials`)
      .set('Authorization', `Bearer ${token}`)

    const found = responseGet.body.data.find((item: any) => item.id === itemId)
    expect(found).to.be.undefined
  })
})
