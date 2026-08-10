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
import { createProject, grantProjectPermissions } from '@/test/projectHelper'
import { createTestBranch } from '@/test/speckle-helpers/branchHelper'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  createProjectModelSyncTaskFactory,
  updateProjectModelSyncTaskFactory
} from '@/modules/model-sync/repositories/tasks'
import { Roles } from '@speckle/shared'
import { TextDecoder } from 'util'

describe('Model sync REST @model-sync', () => {
  let server: Server
  let app: Express
  let serverAddress: string
  let owner: BasicTestUser
  let outsider: BasicTestUser
  let reviewer: BasicTestUser
  let outsiderToken: string
  let reviewerToken: string

  before(async () => {
    const ctx = await beforeEachContext()
    server = ctx.server
    app = ctx.app
    ;({ serverAddress } = await initializeTestServer(ctx))

    owner = await createTestUser({
      name: 'Model Sync Owner',
      email: 'model-sync-owner@example.org'
    })
    outsider = await createTestUser({
      name: 'Model Sync Outsider',
      email: 'model-sync-outsider@example.org'
    })
    reviewer = await createTestUser({
      name: 'Model Sync Reviewer',
      email: 'model-sync-reviewer@example.org'
    })
    outsiderToken = await createAuthTokenForUser(outsider.id)
    reviewerToken = await createAuthTokenForUser(reviewer.id)
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

  it('truncates model sync task audit users to fit schema constraints', async () => {
    const project = await createProject({
      name: 'Model Sync Audit Constraint Project',
      ownerId: owner.id,
      isPublic: false
    })
    const model = await createTestBranch({
      branch: {
        id: '',
        name: 'Model Sync Audit Constraint Model',
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
      fileName: 'audit-limit.rvt',
      status: 'speckle_converting',
      creator: 'rvt-conversion-service',
      updater: 'rvt-conversion-service'
    })

    expect(task.creator).to.equal('rvt-conver')
    expect(task.updater).to.equal('rvt-conver')

    const updatedTask = await updateProjectModelSyncTaskFactory({ db: projectDb })({
      projectId: project.id,
      modelId: model.id,
      taskId: task.id,
      patch: {
        updater: 'rvt-conversion-service',
        progressPercent: 100,
        progressPhase: 'completed'
      }
    })

    expect(updatedTask).to.not.equal(null)
    expect(updatedTask?.updater).to.equal('rvt-conver')
    expect(updatedTask?.progressPercent).to.equal('100.00')
    expect(updatedTask?.progressPhase).to.equal('completed')
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

  it('allows reviewers to hit model sync write endpoints guarded by canCreateVersion', async () => {
    const project = await createProject({
      name: 'Reviewer Model Sync Project',
      ownerId: owner.id,
      isPublic: false
    })
    const model = await createTestBranch({
      branch: {
        id: '',
        name: 'Reviewer Model Sync Model',
        streamId: '',
        authorId: ''
      },
      stream: {
        ...project,
        ownerId: owner.id
      },
      owner
    })

    await grantProjectPermissions({
      projectId: project.id,
      userId: reviewer.id,
      role: Roles.Stream.Reviewer
    })

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/models/${model.id}/model-sync/tasks`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ mode: 'upload' })

    expect(response.status).to.equal(400)
    expect(response.body.error).to.equal('fileName is required')
  })

  it('streams aggregated model sync snapshots across projects', async () => {
    const firstProject = await createProject({
      name: 'Aggregated Model Sync Project A',
      ownerId: owner.id,
      isPublic: false
    })
    const secondProject = await createProject({
      name: 'Aggregated Model Sync Project B',
      ownerId: owner.id,
      isPublic: false
    })

    const [firstModel, secondModel] = await Promise.all([
      createTestBranch({
        branch: {
          id: '',
          name: 'Aggregated Model Sync Model A',
          streamId: '',
          authorId: ''
        },
        stream: {
          ...firstProject,
          ownerId: owner.id
        },
        owner
      }),
      createTestBranch({
        branch: {
          id: '',
          name: 'Aggregated Model Sync Model B',
          streamId: '',
          authorId: ''
        },
        stream: {
          ...secondProject,
          ownerId: owner.id
        },
        owner
      })
    ])

    await Promise.all([
      grantProjectPermissions({
        projectId: firstProject.id,
        userId: reviewer.id,
        role: Roles.Stream.Reviewer
      }),
      grantProjectPermissions({
        projectId: secondProject.id,
        userId: reviewer.id,
        role: Roles.Stream.Reviewer
      })
    ])

    await Promise.all([
      (async () => {
        const projectDb = await getProjectDbClient({ projectId: firstProject.id })
        await createProjectModelSyncTaskFactory({ db: projectDb })({
          projectId: firstProject.id,
          modelId: firstModel.id,
          fileName: 'aggregated-a.rvt',
          status: 'speckle_converting',
          creator: owner.id,
          updater: owner.id
        })
      })(),
      (async () => {
        const projectDb = await getProjectDbClient({ projectId: secondProject.id })
        await createProjectModelSyncTaskFactory({ db: projectDb })({
          projectId: secondProject.id,
          modelId: secondModel.id,
          fileName: 'aggregated-b.rvt',
          status: 'failed',
          creator: owner.id,
          updater: owner.id
        })
      })()
    ])

    const controller = new AbortController()
    const response = await fetch(
      `${serverAddress}/api/v1/model-sync/tasks/events?targets=${encodeURIComponent(
        JSON.stringify([
          { projectId: firstProject.id, modelIds: [firstModel.id] },
          { projectId: secondProject.id, modelIds: [secondModel.id] }
        ])
      )}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${reviewerToken}`
        },
        signal: controller.signal
      }
    )

    expect(response.status).to.equal(200)

    const reader = response.body?.getReader()
    expect(reader).to.exist

    const decoder = new TextDecoder()
    const snapshots = new Map<string, Array<{ id: string; modelId: string; status: string }>>()
    let buffer = ''

    while (snapshots.size < 2) {
      const { done, value } = await reader!.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const eventBlock of events) {
        const eventName = eventBlock.match(/^event:\s*(.+)$/m)?.[1]?.trim()
        const rawData = eventBlock.match(/^data:\s*(.+)$/m)?.[1]?.trim()
        if (eventName !== 'snapshot' || !rawData) continue

        const payload = JSON.parse(rawData) as {
          projectId: string
          tasks: Array<{ id: string; modelId: string; status: string }>
        }
        snapshots.set(payload.projectId, payload.tasks)
      }
    }

    controller.abort()
    await reader?.cancel().catch(() => undefined)

    expect([...snapshots.keys()]).to.have.members([firstProject.id, secondProject.id])
    expect(snapshots.get(firstProject.id)?.[0]).to.include({
      modelId: firstModel.id,
      status: 'speckle_converting'
    })
    expect(snapshots.get(secondProject.id)?.[0]).to.include({
      modelId: secondModel.id,
      status: 'failed'
    })
  })
})
