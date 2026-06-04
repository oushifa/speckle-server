import { expect } from 'chai'
import { beforeEachContext, initializeTestServer } from '@/test/hooks'
import type { Server } from 'http'
import type { Express } from 'express'
import request from 'supertest'
import { Scopes } from '@/modules/core/helpers/mainConstants'
import cryptoRandomString from 'crypto-random-string'
import { noErrors } from '@/test/helpers'
import { TIME_MS } from '@speckle/shared'
import { initUploadTestEnvironment } from '@/modules/fileuploads/tests/helpers/init'
import { fileURLToPath } from 'url'
import type { BasicTestUser } from '@/test/authHelper'
import { createTestUser } from '@/test/authHelper'
import { createTestStream } from '@/test/speckle-helpers/streamHelper'
import { buildBasicTestProject } from '@/modules/core/tests/helpers/creation'
import { db } from '@/db/knex'
import { getStreamBranchByNameFactory } from '@/modules/core/repositories/branches'
import {
  createCommitFactory,
  insertStreamCommitsFactory,
  insertBranchCommitsFactory
} from '@/modules/core/repositories/commits'
import { getBranchByIdFactory, markCommitBranchUpdatedFactory } from '@/modules/core/repositories/branches'
import { getObjectFactory, storeSingleObjectIfNotFoundFactory } from '@/modules/core/repositories/objects'
import { createCommitByBranchIdFactory } from '@/modules/core/services/commit/management'
import { createObjectFactory } from '@/modules/core/services/objects/management'
import { getEventBus } from '@/modules/shared/services/eventBus'

const { createToken } = initUploadTestEnvironment()
const gqlQueryToListFileUploads = `query ($streamId: String!) {
  stream(id: $streamId) {
    id
    fileUploads {
      id
      fileName
      convertedStatus
    }
  }
}`

describe('FileUploads @fileuploads integration', () => {
  let server: Server
  let app: Express

  let userOne: BasicTestUser
  let userOneToken: string
  let createdStreamId: string
  let existingCanonicalUrl: string
  let existingPort: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sendRequest: (token: string, query: string | object) => Promise<any>
  let serverAddress: string
  let serverPort: string

  before(async () => {
    const ctx = await beforeEachContext()
    server = ctx.server
    app = ctx.app
    ;({ serverAddress, serverPort, sendRequest } = await initializeTestServer(ctx))

    //TODO does mocha have a nicer way of temporarily swapping an environment variable, like vitest?
    existingCanonicalUrl = process.env['CANONICAL_URL'] || ''
    existingPort = process.env['PORT'] || ''
    process.env['CANONICAL_URL'] = serverAddress
    process.env['PORT'] = serverPort

    userOne = await createTestUser({
      name: 'User',
      email: 'user@example.org',
      password: 'jdsadjsadasfdsa'
    })
  })
  beforeEach(async () => {
    ;({ id: createdStreamId } = await createTestStream(
      buildBasicTestProject(),
      userOne
    ))
    ;({ token: userOneToken } = await createToken({
      userId: userOne.id,
      name: 'test token',
      scopes: [Scopes.Streams.Write, Scopes.Streams.Read]
    }))
  })

  afterEach(async () => {
    createdStreamId = ''
  })

  after(async () => {
    process.env['CANONICAL_URL'] = existingCanonicalUrl
    process.env['PORT'] = existingPort
    await server?.close()
  })

  describe('Uploads files', () => {
    it('Should upload a single file', async () => {
      const readmePath = fileURLToPath(import.meta.resolve('@/readme.md'))
      const response = await request(app)
        .post(`/api/file/autodetect/${createdStreamId}/main`)
        .set('Authorization', `Bearer ${userOneToken}`)
        .set('Accept', 'application/json')
        .attach('test.ifc', readmePath, 'test.ifc')

      expect(response.statusCode).to.equal(201)
      expect(response.headers['content-type']).to.contain('application/json;')
      expect(response.body.uploadResults).to.have.lengthOf(1)
      expect(response.body.uploadResults[0].fileName).to.equal('test.ifc')
      const gqlResponse = await sendRequest(userOneToken, {
        query: gqlQueryToListFileUploads,
        variables: { streamId: createdStreamId }
      })
      expect(noErrors(gqlResponse))
      expect(gqlResponse.body.data.stream.fileUploads).to.have.lengthOf(1)
      expect(gqlResponse.body.data.stream.fileUploads[0].fileName).to.equal('test.ifc')
      expect(gqlResponse.body.data.stream.fileUploads[0].id).to.equal(
        response.body.uploadResults[0].blobId
      )

      //TODO expect subscription notification
    })

    it('Uploads from multipart upload', async () => {
      const response = await request(app)
        .post(`/api/file/autodetect/${createdStreamId}/main`)
        .set('Authorization', `Bearer ${userOneToken}`)
        .attach('blob1', fileURLToPath(import.meta.resolve('@/readme.md')), 'test1.ifc')
        .attach(
          'blob2',
          fileURLToPath(import.meta.resolve('@/package.json')),
          'test2.ifc'
        )
      expect(response.status).to.equal(201)
      expect(response.headers['content-type']).to.contain('application/json;')
      expect(response.body.uploadResults).to.have.lengthOf(2)
      expect(
        response.body.uploadResults.map((file: { fileName: string }) => file.fileName)
      ).to.have.members(['test1.ifc', 'test2.ifc'])
      const gqlResponse = await sendRequest(userOneToken, {
        query: gqlQueryToListFileUploads,
        variables: { streamId: createdStreamId }
      })
      expect(noErrors(gqlResponse))
      expect(
        gqlResponse.body.data.stream.fileUploads,
        JSON.stringify(gqlResponse.body.data)
      ).to.have.lengthOf(2)
      expect(
        gqlResponse.body.data.stream.fileUploads.map(
          (file: { fileName: string }) => file.fileName
        )
      ).to.have.members(['test1.ifc', 'test2.ifc'])
      expect(
        gqlResponse.body.data.stream.fileUploads.map((file: { id: string }) => file.id)
      ).to.have.members(
        response.body.uploadResults.map((file: { blobId: string }) => file.blobId)
      )
    })

    it('Returns 400 for bad form data', async () => {
      const response = await request(app)
        .post(`/api/file/autodetect/${createdStreamId}/main`)
        .set('Authorization', `Bearer ${userOneToken}`)
        .set('Content-type', 'multipart/form-data; boundary=XXX')
        // sending an unfinished part
        .send('--XXX\r\nCon')

      expect(response.status).to.equal(400)
      expect(response.headers['content-type']).to.contain('application/json;')
      expect(response.body.error).to.contain('Upload request error.')
      const gqlResponse = await sendRequest(userOneToken, {
        query: gqlQueryToListFileUploads,
        variables: { streamId: createdStreamId }
      })
      expect(noErrors(gqlResponse))
      expect(
        gqlResponse.body.data.stream.fileUploads,
        JSON.stringify(gqlResponse.body.data)
      ).to.have.lengthOf(0)
    })

    it('Returns 400 for missing headers', async () => {
      const response = await request(app)
        .post(`/api/file/autodetect/${createdStreamId}/main`)
        .set('Authorization', `Bearer ${userOneToken}`)
      // .set('Content-type', 'multipart/form-data; boundary=XXX') // purposely missing content type

      expect(response.status).to.equal(400)
      expect(response.headers['content-type']).to.contain('application/json;')
      expect(response.body.error.message).to.contain('Missing Content-Type')
      const gqlResponse = await sendRequest(userOneToken, {
        query: gqlQueryToListFileUploads,
        variables: { streamId: createdStreamId }
      })
      expect(noErrors(gqlResponse))
      expect(
        gqlResponse.body.data.stream.fileUploads,
        JSON.stringify(gqlResponse.body.data)
      ).to.have.lengthOf(0)
    })

    it('Returns OK but describes errors for too big files', async () => {
      const response = await request(app)
        .post(`/api/file/autodetect/${createdStreamId}/main`)
        .set('Authorization', `Bearer ${userOneToken}`)
        .attach('toolarge.ifc', Buffer.alloc(114_857_601, 'asdf'), 'toolarge.ifc')
      expect(response.status).to.equal(201)
      expect(response.headers['content-type']).to.contain('application/json;')
      expect(response.body.uploadResults).to.have.lengthOf(1)
      expect(
        response.body.uploadResults.map((file: { fileName: string }) => file.fileName)
      ).to.have.members(['toolarge.ifc'])
      const gqlResponse = await sendRequest(userOneToken, {
        query: gqlQueryToListFileUploads,
        variables: { streamId: createdStreamId }
      })
      expect(noErrors(gqlResponse))
      expect(
        gqlResponse.body.data.stream.fileUploads,
        JSON.stringify(gqlResponse.body.data)
      ).to.have.lengthOf(1)
      expect(gqlResponse.body.data.stream.fileUploads[0].id).to.equal(
        response.body.uploadResults[0].blobId
      )
      //TODO expect no notifications
    })

    //TODO test for bad token
    it('Returns 403 for token without stream write permissions', async () => {
      const { token: badToken } = await createToken({
        userId: userOne.id,
        name: 'test token',
        scopes: [Scopes.Streams.Read],
        lifespan: TIME_MS.hour
      })
      const response = await request(app)
        .post(`/api/file/autodetect/${createdStreamId}/main`)
        .set('Authorization', `Bearer ${badToken}`)
        .set('Accept', 'application/json')
        .attach(
          'test.ifc',
          fileURLToPath(import.meta.resolve('@/readme.md')),
          'test.ifc'
        )
      expect(response.statusCode).to.equal(403)
      const gqlResponse = await sendRequest(userOneToken, {
        query: gqlQueryToListFileUploads,
        variables: { streamId: createdStreamId }
      })
      expect(noErrors(gqlResponse))
      expect(
        gqlResponse.body.data.stream.fileUploads,
        JSON.stringify(gqlResponse.body.data)
      ).to.have.lengthOf(0)
      //TODO expect no notifications
    })

    it('Should not upload a file to a non-existent stream', async () => {
      const badStreamId = cryptoRandomString({ length: 10 })
      const response = await request(app)
        .post(`/api/file/autodetect/${badStreamId}/main`)
        .set('Authorization', `Bearer ${userOneToken}`)
        .set('Accept', 'application/json')
        .attach(
          'test.ifc',
          fileURLToPath(import.meta.resolve('@/readme.md')),
          'test.ifc'
        )
      expect(response.statusCode).to.equal(404) //FIXME should be 404 (technically a 401, but we don't want to leak existence of stream so 404 is preferrable)
      const gqlResponse = await sendRequest(userOneToken, {
        query: gqlQueryToListFileUploads,
        variables: { streamId: createdStreamId }
      })
      expect(noErrors(gqlResponse))
      expect(
        gqlResponse.body.data.stream.fileUploads,
        JSON.stringify(gqlResponse.body.data)
      ).to.have.lengthOf(0)
      //TODO expect no subscription notifications
    })

    it('Should not upload a file to a stream you do not have access to', async () => {
      const userTwo = await createTestUser({
        name: 'User Two',
        email: 'user2@example.org',
        password: 'jdsadjsadasfdsa'
      })
      const { id: streamTwoId } = await createTestStream(
        buildBasicTestProject(),
        userTwo
      )

      const response = await request(app)
        .post(`/api/file/autodetect/${streamTwoId}/main`)
        .set('Authorization', `Bearer ${userOneToken}`)
        .set('Accept', 'application/json')
        .attach(
          'test.ifc',
          fileURLToPath(import.meta.resolve('@/readme.md')),
          'test.ifc'
        )

      expect(response.statusCode).to.equal(403)
      expect(response.body).to.deep.equal({
        error: 'You do not have access to the project'
      })

      const gqlResponse = await sendRequest(userOneToken, {
        query: `query ($streamId: String!) {
          stream(id: $streamId) {
            id
            fileUploads {
              id
              fileName
              convertedStatus
            }
          }
        }`,
        variables: { streamId: createdStreamId }
      })
      expect(noErrors(gqlResponse))
      expect(gqlResponse.body.data.stream.fileUploads, JSON.stringify(gqlResponse.body.data)).to.have.lengthOf(0)
      //TODO expect no subscription notifications
    })
  })

  describe('Bind File to Model Version', () => {
    let fileId: string
    let versionId: string
    let branchId: string

    beforeEach(async () => {
      // 1. Upload a file
      const readmePath = fileURLToPath(import.meta.resolve('@/readme.md'))
      const response = await request(app)
        .post(`/api/file/autodetect/${createdStreamId}/main`)
        .set('Authorization', `Bearer ${userOneToken}`)
        .set('Accept', 'application/json')
        .attach('test.ifc', readmePath, 'test.ifc')

      expect(response.statusCode).to.equal(201)
      fileId = response.body.uploadResults[0].blobId

      // 2. Get main branch ID
      const getStreamBranchByName = getStreamBranchByNameFactory({ db })
      const branch = await getStreamBranchByName(createdStreamId, 'main')
      expect(branch).to.exist
      branchId = branch!.id

      // 3. Create a version (commit)
      const createCommit = createCommitFactory({ db })
      const getObject = getObjectFactory({ db })
      const getBranchById = getBranchByIdFactory({ db })
      const insertStreamCommits = insertStreamCommitsFactory({ db })
      const insertBranchCommits = insertBranchCommitsFactory({ db })
      const markCommitBranchUpdated = markCommitBranchUpdatedFactory({ db })

      const createCommitByBranchId = createCommitByBranchIdFactory({
        createCommit,
        getObject,
        getBranchById,
        insertStreamCommits,
        insertBranchCommits,
        markCommitBranchUpdated,
        emitEvent: getEventBus().emit
      })

      const createObject = createObjectFactory({
        storeSingleObjectIfNotFoundFactory: storeSingleObjectIfNotFoundFactory({ db })
      })

      const objectId = await createObject({
        streamId: createdStreamId,
        object: { foo: 'bar' }
      })

      const commit = await createCommitByBranchId({
        authorId: userOne.id,
        streamId: createdStreamId,
        branchId: branchId,
        message: 'Test version for binding',
        sourceApplication: 'IntegrationTest',
        objectId: objectId,
        parents: []
      })
      versionId = commit.id
    })

    it('Should bind a file to a version when user has write access', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${createdStreamId}/versions/${versionId}/bind-file`)
        .set('Authorization', `Bearer ${userOneToken}`)
        .send({ fileId })

      expect(response.statusCode).to.equal(200)
      expect(response.body.upload.id).to.equal(fileId)
      expect(response.body.upload.convertedCommitId).to.equal(versionId)
      expect(response.body.upload.convertedStatus).to.equal(2) // Completed
      expect(response.body.upload.modelId).to.equal(branchId)

      // Verify db changes
      const [dbUpload] = await db('file_uploads').where({ id: fileId })
      expect(dbUpload.convertedCommitId).to.equal(versionId)
      expect(dbUpload.convertedStatus).to.equal(2)
      expect(dbUpload.modelId).to.equal(branchId)
    })

    it('Should return 403 when not authenticated', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${createdStreamId}/versions/${versionId}/bind-file`)
        .send({ fileId })

      expect(response.statusCode).to.equal(403)
    })

    it('Should return 403 when token lacks write permissions', async () => {
      const { token: readToken } = await createToken({
        userId: userOne.id,
        name: 'read token',
        scopes: [Scopes.Streams.Read]
      })

      const response = await request(app)
        .post(`/api/v1/projects/${createdStreamId}/versions/${versionId}/bind-file`)
        .set('Authorization', `Bearer ${readToken}`)
        .send({ fileId })

      expect(response.statusCode).to.equal(403)
    })

    it('Should return 404 when version is not in project', async () => {
      const badVersionId = cryptoRandomString({ length: 10 })
      const response = await request(app)
        .post(`/api/v1/projects/${createdStreamId}/versions/${badVersionId}/bind-file`)
        .set('Authorization', `Bearer ${userOneToken}`)
        .send({ fileId })

      expect(response.statusCode).to.equal(404)
      expect(response.body.error).to.contain('Version not found')
    })

    it('Should return 404 when file is not in project', async () => {
      const badFileId = cryptoRandomString({ length: 10 })
      const response = await request(app)
        .post(`/api/v1/projects/${createdStreamId}/versions/${versionId}/bind-file`)
        .set('Authorization', `Bearer ${userOneToken}`)
        .send({ fileId: badFileId })

      expect(response.statusCode).to.equal(404)
      expect(response.body.error).to.contain('File upload not found')
    })

    it('Should bind a file to a version and insert file_uploads when file upload record is missing but blob exists', async () => {
      // 1. Delete from file_uploads to simulate missing record
      await db('file_uploads').where({ id: fileId }).del()

      // 2. Ensure the blob exists in blob_storage
      await db('blob_storage').insert({
        id: fileId,
        streamId: createdStreamId,
        userId: userOne.id,
        objectKey: 'some-key',
        fileName: 'test.ifc',
        fileType: 'ifc',
        fileSize: 100
      }).onConflict(['id', 'streamId']).ignore()

      // 3. Make bind request
      const response = await request(app)
        .post(`/api/v1/projects/${createdStreamId}/versions/${versionId}/bind-file`)
        .set('Authorization', `Bearer ${userOneToken}`)
        .send({
          fileId,
          fileName: 'test.ifc',
          fileSize: 100,
          fileType: 'ifc'
        })

      expect(response.statusCode).to.equal(200)
      expect(response.body.upload.id).to.equal(fileId)
      expect(response.body.upload.convertedCommitId).to.equal(versionId)
      expect(response.body.upload.convertedStatus).to.equal(2) // Completed
      expect(response.body.upload.modelId).to.equal(branchId)

      // Verify db changes
      const [dbUpload] = await db('file_uploads').where({ id: fileId })
      expect(dbUpload).to.exist
      expect(dbUpload.convertedCommitId).to.equal(versionId)
      expect(dbUpload.convertedStatus).to.equal(2)
      expect(dbUpload.modelId).to.equal(branchId)
    })
  })
})
