import { expect } from 'chai'
import request from 'supertest'
import type { Express } from 'express'
import { beforeEachContext } from '@/test/hooks'
import { createTestUser } from '@/test/authHelper'
import { createTestStream, type BasicTestStream } from '@/test/speckle-helpers/streamHelper'
import { createTestBranch } from '@/test/speckle-helpers/branchHelper'
import {
  createTestCommit,
  createTestObject,
  type BasicTestCommit
} from '@/test/speckle-helpers/commitHelper'
import { createPersonalAccessTokenFactory } from '@/modules/core/services/tokens'
import {
  storeApiTokenFactory,
  storePersonalApiTokenFactory,
  storeTokenResourceAccessDefinitionsFactory,
  storeTokenScopesFactory
} from '@/modules/core/repositories/tokens'
import { db } from '@/db/knex'
import { Scopes } from '@speckle/shared'

const createPersonalAccessToken = createPersonalAccessTokenFactory({
  storeApiToken: storeApiTokenFactory({ db }),
  storeTokenScopes: storeTokenScopesFactory({ db }),
  storeTokenResourceAccessDefinitions: storeTokenResourceAccessDefinitionsFactory({
    db
  }),
  storePersonalApiToken: storePersonalApiTokenFactory({ db })
})

describe('Project Model Objects REST @core', () => {
  let app: Express
  let project: BasicTestStream
  let authHeader: string
  let modelId: string
  let rootObjectId: string
  let childObjectIdA: string
  let childObjectIdB: string
  let outsiderObjectId: string

  before(async () => {
    ;({ app } = await beforeEachContext())

    const user = await createTestUser({
      name: 'model objects rest user',
      email: 'model-objects-rest-user@speckle.systems',
      password: 'wowwow8charsplease'
    })

    authHeader = `Bearer ${await createPersonalAccessToken(
      user.id,
      'project model objects rest token',
      [
        Scopes.Streams.Read,
        Scopes.Streams.Write,
        Scopes.Users.Read,
        Scopes.Users.Email,
        Scopes.Tokens.Write,
        Scopes.Tokens.Read,
        Scopes.Profile.Read,
        Scopes.Profile.Email
      ]
    )}`

    project = await createTestStream(
      {
        id: '',
        ownerId: user.id,
        name: 'Project Model Objects REST',
        description: 'Test project',
        isPublic: false
      },
      user
    )

    const model = await createTestBranch({
      branch: {
        id: '',
        name: 'ifc-model',
        description: 'IFC model branch',
        streamId: '',
        authorId: ''
      },
      stream: project,
      owner: user
    })
    modelId = model.id

    childObjectIdA = await createTestObject({
      projectId: project.id,
      object: {
        speckleType: 'Objects.BuiltElements.Wall',
        applicationId: 'wall-001',
        category: 'Wall',
        name: 'External Wall'
      }
    })

    childObjectIdB = await createTestObject({
      projectId: project.id,
      object: {
        speckleType: 'Objects.BuiltElements.Door',
        applicationId: 'door-001',
        category: 'Door',
        name: 'Main Door'
      }
    })

    outsiderObjectId = await createTestObject({
      projectId: project.id,
      object: {
        speckleType: 'Objects.BuiltElements.Window',
        applicationId: 'window-999',
        category: 'Window',
        name: 'Unrelated Window'
      }
    })

    rootObjectId = await createTestObject({
      projectId: project.id,
      object: {
        speckleType: 'Speckle.Core.Models.Collection',
        collectionType: 'ifc model',
        totalChildrenCount: 2,
        __closure: {
          [childObjectIdA]: 1,
          [childObjectIdB]: 1
        }
      }
    })

    await createTestCommit(
      {
        id: '',
        objectId: rootObjectId,
        streamId: project.id,
        authorId: user.id,
        branchId: modelId,
        seedId: 'seed-ifc-model'
      } as BasicTestCommit,
      {
        owner: user,
        stream: project
      }
    )
  })

  it('lists objects from the latest model version', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/models/${modelId}/objects`)
      .set('Authorization', authHeader)

    expect(res).to.have.status(200)
    expect(res.body.projectId).to.equal(project.id)
    expect(res.body.modelId).to.equal(modelId)
    expect(res.body.rootObjectId).to.equal(rootObjectId)
    expect(res.body.totalCount).to.equal(2)
    expect(res.body.items).to.have.length(2)

    const returnedIds = res.body.items.map((item: { id: string }) => item.id)
    expect(returnedIds).to.deep.equalInAnyOrder([childObjectIdA, childObjectIdB])
  })

  it('gets a single object by id when it belongs to the model latest version', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/models/${modelId}/objects/${childObjectIdA}`)
      .set('Authorization', authHeader)

    expect(res).to.have.status(200)
    expect(res.body.rootObjectId).to.equal(rootObjectId)
    expect(res.body.item.id).to.equal(childObjectIdA)
    expect(res.body.item.data.applicationId).to.equal('wall-001')
    expect(res.body.item.data.category).to.equal('Wall')
  })

  it('returns 404 when the object does not belong to the model latest version', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/models/${modelId}/objects/${outsiderObjectId}`)
      .set('Authorization', authHeader)

    expect(res).to.have.status(404)
    expect(res.body.error).to.equal('Object not found in model latest version')
  })
})
