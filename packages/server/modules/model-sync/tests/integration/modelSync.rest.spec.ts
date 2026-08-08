import { expect } from 'chai'
import type { Express } from 'express'
import type { Server } from 'http'
import request from 'supertest'
import { beforeEachContext, initializeTestServer } from '@/test/hooks'
import {
  createAuthTokenForUser,
  createTestUser,
  type BasicTestUser
} from '@/test/authHelper'
import { createProject } from '@/test/projectHelper'
import { createTestBranch } from '@/test/speckle-helpers/branchHelper'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { createProjectModelSyncTaskFactory } from '@/modules/model-sync/repositories/tasks'

describe('Model sync REST @model-sync', () => {
  let server: Server
  let app: Express
  let owner: BasicTestUser
  let outsider: BasicTestUser
  let outsiderToken: string

  before(async () => {
    const ctx = await beforeEachContext()
    server = ctx.server
    app = ctx.app
    await initializeTestServer(ctx)

    owner = await createTestUser({
      name: 'Model Sync Owner',
      email: 'model-sync-owner@example.org'
    })
    outsider = await createTestUser({
      name: 'Model Sync Outsider',
      email: 'model-sync-outsider@example.org'
    })
    outsiderToken = await createAuthTokenForUser(outsider.id)
  })

  after(async () => {
    await server?.close()
  })

  it('allows any authenticated user to list resumable project model sync tasks', async () => {
    const project = await createProject({
      name: 'Private Model Sync Project',
      ownerId: owner.id,
      isPublic: false
    })
    const model = await createTestBranch({
      branch: {
        id: '',
        name: 'Private Model Sync Model',
        streamId: '',
        authorId: ''
      },
      stream: {
        ...project,
        ownerId: owner.id
      },
      owner
    })

    const projectDb = await getProjectDbClient({ projectId: project.id })
    const task = await createProjectModelSyncTaskFactory({ db: projectDb })({
      projectId: project.id,
      modelId: model.id,
      fileName: 'private-model.rvt',
      status: 'failed',
      creator: owner.id,
      updater: owner.id
    })

    const retriableTask = await projectDb('project_model_sync_tasks')
      .where({ id: task.id })
      .update(
        {
          retriable: true,
          retryCount: 0
        },
        '*'
      )

    expect(retriableTask).to.have.lengthOf(1)

    const response = await request(app)
      .get(`/api/v1/projects/${project.id}/model-sync/tasks?status=resumable`)
      .set('Authorization', `Bearer ${outsiderToken}`)

    expect(response.status).to.equal(200)
    expect(response.body.data).to.have.lengthOf(1)
    expect(response.body.data[0].id).to.equal(task.id)
  })

  it('rejects anonymous requests for project model sync task listing', async () => {
    const project = await createProject({
      name: 'Anonymous Model Sync Project',
      ownerId: owner.id,
      isPublic: false
    })

    const response = await request(app).get(
      `/api/v1/projects/${project.id}/model-sync/tasks?status=resumable`
    )

    expect(response.status).to.equal(401)
  })
})
