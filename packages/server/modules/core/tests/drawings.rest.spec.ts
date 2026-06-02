/* istanbul ignore file */
import { expect } from 'chai'
import request from 'supertest'
import type Express from 'express'
import { beforeEachContext } from '@/test/hooks'
import { createTestUser, type BasicTestUser } from '@/test/authHelper'
import { Scopes } from '@speckle/shared'
import { db } from '@/db/knex'
import { createPersonalAccessTokenFactory } from '@/modules/core/services/tokens'
import {
  storeApiTokenFactory,
  storePersonalApiTokenFactory,
  storeTokenResourceAccessDefinitionsFactory,
  storeTokenScopesFactory
} from '@/modules/core/repositories/tokens'
import { DRAWINGS_PROJECT } from '@/modules/core/drawings/constants'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { upsertBlobFactory } from '@/modules/blobstorage/repositories'
import { BlobUploadStatus } from '@speckle/shared/blobs'
import { storeSingleObjectIfNotFoundFactory } from '@/modules/core/repositories/objects'
import {
  createCommitFactory,
  insertBranchCommitsFactory,
  insertStreamCommitsFactory
} from '@/modules/core/repositories/commits'

const createPersonalAccessToken = createPersonalAccessTokenFactory({
  storeApiToken: storeApiTokenFactory({ db }),
  storeTokenScopes: storeTokenScopesFactory({ db }),
  storeTokenResourceAccessDefinitions: storeTokenResourceAccessDefinitionsFactory({
    db
  }),
  storePersonalApiToken: storePersonalApiTokenFactory({ db })
})

describe('Drawings Library Routes @api-rest', () => {
  let app: Express.Express
  let user: BasicTestUser
  let token: string
  let cookieAuthHeader: string

  before(async () => {
    ;({ app } = await beforeEachContext())

    user = await createTestUser({
      name: 'drawings-user',
      email: 'drawings.user@speckle.systems',
      password: 'wowwow8charsplease'
    })

    token = `Bearer ${await createPersonalAccessToken(user.id, 'drawings test token', [
      Scopes.Streams.Read,
      Scopes.Streams.Write,
      Scopes.Users.Read,
      Scopes.Users.Email,
      Scopes.Tokens.Write,
      Scopes.Tokens.Read,
      Scopes.Profile.Read,
      Scopes.Profile.Email
    ])}`

    cookieAuthHeader = `authn=${encodeURIComponent(token)}`
  })

  it('should ensure the drawings project exists', async () => {
    const res = await request(app).get('/api/v1/drawings/project')
    expect(res).to.have.status(200)
    expect(res.body?.data?.id).to.equal(DRAWINGS_PROJECT.id)
    expect(res.body?.data?.type).to.equal(DRAWINGS_PROJECT.type)
  })

  it('should allow auth headers', async () => {
    const res = await request(app).get('/api/v1/drawings/project').set('Authorization', token)
    expect(res).to.have.status(200)
  })

  it('should allow model CRUD for any authenticated user via cookie auth', async () => {
    const createRes = await request(app)
      .post('/api/v1/drawings/models')
      .set('Cookie', [cookieAuthHeader])
      .send({ name: 'test-model', description: 'desc' })

    expect(createRes).to.have.status(201)
    expect(createRes.body?.data?.id).to.be.a('string')
    const modelId = createRes.body.data.id as string

    const listRes = await request(app).get('/api/v1/drawings/models')
    expect(listRes).to.have.status(200)
    expect(listRes.body?.data?.some((m: any) => m.id === modelId)).to.equal(true)

    const updateRes = await request(app)
      .patch(`/api/v1/drawings/models/${modelId}`)
      .set('Cookie', [cookieAuthHeader])
      .send({ description: 'desc2' })
    expect(updateRes).to.have.status(200)
    expect(updateRes.body?.data?.description).to.equal('desc2')

    const deleteRes = await request(app)
      .delete(`/api/v1/drawings/models/${modelId}`)
      .set('Cookie', [cookieAuthHeader])
    expect(deleteRes).to.have.status(200)
    expect(deleteRes.body?.data).to.equal(true)
  })

  it('should create model & first version from uploaded file, and allow uploading new version', async () => {
    const createRes = await request(app)
      .post('/api/v1/drawings/models/upload')
      .set('Cookie', [cookieAuthHeader])
      .field('name', `upload-model-${Date.now()}`)
      .attach('file', Buffer.from('hello'), 'test.dwg')

    expect(createRes).to.have.status(201)
    expect(createRes.body?.data?.model?.id).to.be.a('string')
    expect(createRes.body?.data?.version?.id).to.be.a('string')

    const modelId = createRes.body.data.model.id as string
    const versionId = createRes.body.data.version.id as string

    const fileMetaRes = await request(app).get(`/api/v1/drawings/versions/${versionId}/file`)
    expect(fileMetaRes).to.have.status(200)
    expect(fileMetaRes.body?.data?.blobId).to.be.a('string')
    expect(fileMetaRes.body?.data?.fileName).to.equal('test.dwg')
    expect(fileMetaRes.body?.data?.fileType).to.equal('dwg')

    const uploadV2Res = await request(app)
      .post(`/api/v1/drawings/models/${modelId}/versions`)
      .set('Cookie', [cookieAuthHeader])
      .attach('file', Buffer.from('world'), 'test2.dwg')

    expect(uploadV2Res).to.have.status(201)
    expect(uploadV2Res.body?.data?.id).to.be.a('string')

    const v2Id = uploadV2Res.body.data.id as string
    const fileMetaV2Res = await request(app).get(`/api/v1/drawings/versions/${v2Id}/file`)
    expect(fileMetaV2Res).to.have.status(200)
    expect(fileMetaV2Res.body?.data?.fileName).to.equal('test2.dwg')
    expect(fileMetaV2Res.body?.data?.fileType).to.equal('dwg')
  })

  it('should prefer an existing explicit blobId over fallback object ids when resolving version files', async () => {
    const createModelRes = await request(app)
      .post('/api/v1/drawings/models')
      .set('Cookie', [cookieAuthHeader])
      .send({ name: `version-file-model-${Date.now()}` })
    expect(createModelRes).to.have.status(201)
    const modelId = createModelRes.body.data.id as string

    const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })
    const upsertBlob = upsertBlobFactory({ db: projectDb })
    const storeSingleObjectIfNotFound = storeSingleObjectIfNotFoundFactory({ db: projectDb })
    const createCommit = createCommitFactory({ db: projectDb })
    const insertBranchCommits = insertBranchCommitsFactory({ db: projectDb })
    const insertStreamCommits = insertStreamCommitsFactory({ db: projectDb })

    const validBlobId = `blob-${Date.now()}`
    await upsertBlob({
      id: validBlobId,
      streamId: DRAWINGS_PROJECT.id,
      userId: user.id,
      objectKey: `drawings/${validBlobId}`,
      fileName: 'valid.dwg',
      fileType: 'dwg',
      fileSize: 123,
      uploadStatus: BlobUploadStatus.Completed,
      uploadError: null
    })

    const objectId = `test-version-file-${Date.now()}`
    await storeSingleObjectIfNotFound({
      id: objectId,
      streamId: DRAWINGS_PROJECT.id,
      speckleType: 'Base',
      totalChildrenCount: 2,
      data: JSON.stringify({
        id: objectId,
        speckle_type: 'Base',
        files: [
          {
            id: 'not-a-real-blob',
            fileName: 'fallback.dwg',
            fileType: 'dwg',
            fileSize: 456
          },
          {
            blobId: validBlobId,
            fileName: 'valid.dwg',
            fileType: 'dwg',
            fileSize: 123
          }
        ]
      })
    })

    const commit = await createCommit({
      referencedObject: objectId,
      author: user.id,
      message: 'version-file',
      sourceApplication: 'web',
      totalChildrenCount: 2
    } as any)

    await Promise.all([
      insertBranchCommits([{ branchId: modelId, commitId: commit.id }]),
      insertStreamCommits([{ streamId: DRAWINGS_PROJECT.id, commitId: commit.id }])
    ])

    const fileMetaRes = await request(app).get(`/api/v1/drawings/versions/${commit.id}/file`)
    expect(fileMetaRes).to.have.status(200)
    expect(fileMetaRes.body?.data?.blobId).to.equal(validBlobId)
    expect(fileMetaRes.body?.data?.fileName).to.equal('valid.dwg')
  })

  it('should update & delete versions via REST (hard delete)', async () => {
    const createModelRes = await request(app)
      .post('/api/v1/drawings/models')
      .set('Cookie', [cookieAuthHeader])
      .send({ name: `version-test-model-${Date.now()}` })
    expect(createModelRes).to.have.status(201)
    const modelId = createModelRes.body.data.id as string

    const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })
    const storeSingleObjectIfNotFound = storeSingleObjectIfNotFoundFactory({ db: projectDb })
    const createCommit = createCommitFactory({ db: projectDb })
    const insertBranchCommits = insertBranchCommitsFactory({ db: projectDb })
    const insertStreamCommits = insertStreamCommitsFactory({ db: projectDb })

    const objectId = `test-object-${Date.now()}`
    await storeSingleObjectIfNotFound({
      id: objectId,
      streamId: DRAWINGS_PROJECT.id,
      speckleType: 'Base',
      totalChildrenCount: 1,
      data: JSON.stringify({ id: objectId, speckle_type: 'Base' })
    })

    const commit = await createCommit({
      referencedObject: objectId,
      author: user.id,
      message: 'v1',
      sourceApplication: 'web',
      totalChildrenCount: 1
    } as any)

    await Promise.all([
      insertBranchCommits([{ branchId: modelId, commitId: commit.id }]),
      insertStreamCommits([{ streamId: DRAWINGS_PROJECT.id, commitId: commit.id }])
    ])

    const updateRes = await request(app)
      .patch(`/api/v1/drawings/versions/${commit.id}`)
      .set('Cookie', [cookieAuthHeader])
      .send({ message: 'v2' })
    expect(updateRes).to.have.status(200)
    expect(updateRes.body?.data?.message).to.equal('v2')

    const deleteRes = await request(app)
      .delete(`/api/v1/drawings/versions/${commit.id}`)
      .set('Cookie', [cookieAuthHeader])
    expect(deleteRes).to.have.status(200)
    expect(deleteRes.body?.data).to.equal(true)
  })

  it('should paginate versions list', async () => {
    const createModelRes = await request(app)
      .post('/api/v1/drawings/models')
      .set('Cookie', [cookieAuthHeader])
      .send({ name: `version-page-model-${Date.now()}` })
    expect(createModelRes).to.have.status(201)
    const modelId = createModelRes.body.data.id as string

    const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })
    const storeSingleObjectIfNotFound = storeSingleObjectIfNotFoundFactory({ db: projectDb })
    const createCommit = createCommitFactory({ db: projectDb })
    const insertBranchCommits = insertBranchCommitsFactory({ db: projectDb })
    const insertStreamCommits = insertStreamCommitsFactory({ db: projectDb })

    const objectId = `test-object-page-${Date.now()}`
    await storeSingleObjectIfNotFound({
      id: objectId,
      streamId: DRAWINGS_PROJECT.id,
      speckleType: 'Base',
      totalChildrenCount: 1,
      data: JSON.stringify({ id: objectId, speckle_type: 'Base' })
    })

    const commits = await Promise.all([
      createCommit({
        referencedObject: objectId,
        author: user.id,
        message: 'p1',
        sourceApplication: 'web',
        totalChildrenCount: 1
      } as any),
      createCommit({
        referencedObject: objectId,
        author: user.id,
        message: 'p2',
        sourceApplication: 'web',
        totalChildrenCount: 1
      } as any),
      createCommit({
        referencedObject: objectId,
        author: user.id,
        message: 'p3',
        sourceApplication: 'web',
        totalChildrenCount: 1
      } as any)
    ])

    await Promise.all([
      insertBranchCommits(commits.map((c) => ({ branchId: modelId, commitId: c.id }))),
      insertStreamCommits(commits.map((c) => ({ streamId: DRAWINGS_PROJECT.id, commitId: c.id })))
    ])

    const page1 = await request(app).get(
      `/api/v1/drawings/models/${modelId}/versions?limit=2`
    )
    expect(page1).to.have.status(200)
    expect(page1.body?.data?.length).to.equal(2)
    expect(page1.body?.cursor?.id).to.be.a('string')
    expect(page1.body?.cursor?.createdAt).to.be.ok

    const page2 = await request(app).get(
      `/api/v1/drawings/models/${modelId}/versions?limit=2&cursorId=${encodeURIComponent(
        page1.body.cursor.id
      )}&cursorCreatedAt=${encodeURIComponent(page1.body.cursor.createdAt)}`
    )
    expect(page2).to.have.status(200)
    expect(page2.body?.data?.length).to.equal(1)
    expect(page2.body?.cursor).to.equal(null)
  })
})
