import { expect } from 'chai'
import { beforeEachContext } from '@/test/hooks'
import { db } from '@/db/knex'
import { createTestUser } from '@/test/authHelper'
import { createTestStream } from '@/test/speckle-helpers/streamHelper'
import { createBranchFactory } from '@/modules/core/repositories/branches'
import {
  createCommitFactory,
  insertStreamCommitsFactory,
  insertBranchCommitsFactory
} from '@/modules/core/repositories/commits'
import { getBranchByIdFactory, markCommitBranchUpdatedFactory } from '@/modules/core/repositories/branches'
import { getObjectFactory, storeSingleObjectIfNotFoundFactory } from '@/modules/core/repositories/objects'
import { getEventBus } from '@/modules/shared/services/eventBus'
import { createCommitByBranchIdFactory } from '@/modules/core/services/commit/management'
import { createObjectFactory } from '@/modules/core/services/objects/management'
import { getApprovalSubjectHandler } from '@/modules/flow/services/subjectHandlers'
import { createApprovalFlowBindingFactory } from '@/modules/flow/repositories/approvalBindings'
import { buildApolloServer } from '@/app'
import { createAuthedTestContext } from '@/test/graphqlHelper'
import cryptoRandomString from 'crypto-random-string'
import type { ServerAndContext } from '@/test/graphqlHelper'
import type { BasicTestUser } from '@/test/authHelper'
import type { BasicTestStream } from '@/test/speckle-helpers/streamHelper'

const createBranch = createBranchFactory({ db })
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

describe('MODEL_VERSION Approval Integration Tests', () => {
  let user: BasicTestUser
  let stream: BasicTestStream
  let branchId: string
  let versionId1: string
  let versionId2: string
  let apollo: ServerAndContext
  let definitionId: string
  let templateId: string

  before(async () => {
    await beforeEachContext()
    
    // Create test user and project
    user = await createTestUser({
      name: 'Flow Tester',
      email: 'flowtester@example.com',
      password: 'strongpassword123',
      id: ''
    })
    
    stream = await createTestStream(
      {
        name: 'Flow Test Project',
        description: 'Test project for model version approval flow'
      },
      user
    )

    // Create a model (branch)
    const branch = await createBranch({
      name: 'model-a',
      streamId: stream.id,
      authorId: user.id,
      description: 'Model A description'
    })
    branchId = branch.id

    // Create real objects for commits
    const object1Id = await createObject({
      streamId: stream.id,
      object: { foo: 'bar' }
    })
    const object2Id = await createObject({
      streamId: stream.id,
      object: { foo: 'baz' }
    })

    // Create version 1
    const v1 = await createCommitByBranchId({
      authorId: user.id,
      streamId: stream.id,
      branchId: branchId,
      message: 'Initial model upload',
      sourceApplication: 'Rhino',
      objectId: object1Id,
      parents: []
    })
    versionId1 = v1.id

    // Create version 2
    const v2 = await createCommitByBranchId({
      authorId: user.id,
      streamId: stream.id,
      branchId: branchId,
      message: 'Updated structural elements',
      sourceApplication: 'Revit',
      objectId: object2Id,
      parents: [versionId1]
    })
    versionId2 = v2.id

    // Setup Apollo server authed context
    apollo = {
      apollo: await buildApolloServer(),
      context: await createAuthedTestContext(user.id)
    }

    // Insert dummy approval flow definition for FK constraints
    definitionId = cryptoRandomString({ length: 10 })
    templateId = cryptoRandomString({ length: 10 })
    await db('approval_flow_definitions').insert({
      id: definitionId,
      templateId,
      projectId: stream.id,
      name: 'Test Definition',
      resourceType: 'MODEL',
      isActive: true,
      version: 1,
      createdBy: user.id
    })
  })

  after(async () => {
    if (definitionId) {
      await db('approval_flow_definitions').where('id', definitionId).del()
    }
  })

  it('MODEL_VERSION subject handler should fetch correct snapshot metadata and version number', async () => {
    const handler = getApprovalSubjectHandler({ subjectType: 'MODEL_VERSION' })
    
    const snapshot1 = await handler.getSubjectSnapshot({
      projectId: stream.id,
      subjectType: 'MODEL_VERSION',
      subjectId: versionId1
    })

    expect(snapshot1).to.have.property('versionId', versionId1)
    expect(snapshot1).to.have.property('modelId', branchId)
    expect(snapshot1).to.have.property('modelName', 'model-a')
    expect(snapshot1).to.have.property('branchId', branchId)
    expect(snapshot1).to.have.property('versionNumber', 1)
    expect(snapshot1).to.have.property('createdBy', user.id)
    expect(snapshot1).to.have.property('message', 'Initial model upload')

    const snapshot2 = await handler.getSubjectSnapshot({
      projectId: stream.id,
      subjectType: 'MODEL_VERSION',
      subjectId: versionId2
    })

    expect(snapshot2).to.have.property('versionId', versionId2)
    expect(snapshot2).to.have.property('versionNumber', 2)
    expect(snapshot2).to.have.property('message', 'Updated structural elements')
  })

  it('should block version update mutation when version status is IN_REVIEW', async () => {
    // Create an active IN_REVIEW binding for version 1
    const createBinding = createApprovalFlowBindingFactory({ db })
    const binding = await createBinding({
      projectId: stream.id,
      subjectType: 'MODEL_VERSION',
      subjectId: versionId1,
      subjectKey: `model_version:${versionId1}`,
      definitionId,
      templateId,
      status: 'IN_REVIEW',
      creator: user.id,
      updater: user.id
    })

    // Execute update mutation
    const updateMutation = `
      mutation UpdateVersion($input: UpdateVersionInput!) {
        versionMutations {
          update(input: $input) {
            id
            message
          }
        }
      }
    `
    const res = await apollo.apollo.executeOperation(
      {
        query: updateMutation,
        variables: {
          input: {
            projectId: stream.id,
            versionId: versionId1,
            message: 'Attempt to update message while in review'
          }
        }
      },
      { contextValue: apollo.context as any }
    )

    expect(res.body.kind).to.equal('single')
    // @ts-ignore
    const singleResult = res.body.singleResult
    expect(singleResult.errors).to.exist
    expect(singleResult.errors[0].message).to.contain('is in review and cannot be updated')

    // Clean up binding
    await db('approval_flow_bindings').where('id', binding.id).del()
  })

  it('should block version delete mutation when version status is IN_REVIEW', async () => {
    // Create an active IN_REVIEW binding for version 2
    const createBinding = createApprovalFlowBindingFactory({ db })
    const binding = await createBinding({
      projectId: stream.id,
      subjectType: 'MODEL_VERSION',
      subjectId: versionId2,
      subjectKey: `model_version:${versionId2}`,
      definitionId,
      templateId,
      status: 'IN_REVIEW',
      creator: user.id,
      updater: user.id
    })

    // Execute delete mutation
    const deleteMutation = `
      mutation DeleteVersions($input: DeleteVersionsInput!) {
        versionMutations {
          delete(input: $input)
        }
      }
    `
    const res = await apollo.apollo.executeOperation(
      {
        query: deleteMutation,
        variables: {
          input: {
            projectId: stream.id,
            versionIds: [versionId2]
          }
        }
      },
      { contextValue: apollo.context as any }
    )

    expect(res.body.kind).to.equal('single')
    // @ts-ignore
    const singleResult = res.body.singleResult
    expect(singleResult.errors).to.exist
    expect(singleResult.errors[0].message).to.contain('is in review and cannot be deleted')

    // Clean up binding
    await db('approval_flow_bindings').where('id', binding.id).del()
  })

  it('should allow update and delete mutations when version is not in review', async () => {
    // Attempt update
    const updateMutation = `
      mutation UpdateVersion($input: UpdateVersionInput!) {
        versionMutations {
          update(input: $input) {
            id
            message
          }
        }
      }
    `
    const resUpdate = await apollo.apollo.executeOperation(
      {
        query: updateMutation,
        variables: {
          input: {
            projectId: stream.id,
            versionId: versionId1,
            message: 'Successful message update'
          }
        }
      },
      { contextValue: apollo.context as any }
    )
    expect(resUpdate.body.kind).to.equal('single')
    // @ts-ignore
    expect(resUpdate.body.singleResult.errors).to.not.exist

    // Attempt delete
    const deleteMutation = `
      mutation DeleteVersions($input: DeleteVersionsInput!) {
        versionMutations {
          delete(input: $input)
        }
      }
    `
    const resDelete = await apollo.apollo.executeOperation(
      {
        query: deleteMutation,
        variables: {
          input: {
            projectId: stream.id,
            versionIds: [versionId1]
          }
        }
      },
      { contextValue: apollo.context as any }
    )
    expect(resDelete.body.kind).to.equal('single')
    // @ts-ignore
    expect(resDelete.body.singleResult.errors).to.not.exist
  })

  it('should query correct latestApprovedVersion through GraphQL', async () => {
    const createBinding = createApprovalFlowBindingFactory({ db })
    const binding = await createBinding({
      projectId: stream.id,
      subjectType: 'MODEL_VERSION',
      subjectId: versionId2,
      subjectKey: `model_version:${versionId2}`,
      definitionId,
      templateId,
      status: 'APPROVED',
      creator: user.id,
      updater: user.id
    })

    const modelQuery = `
      query GetModel($projectId: String!, $modelId: String!) {
        project(id: $projectId) {
          model(id: $modelId) {
            id
            latestApprovedVersion {
              id
              message
            }
          }
        }
      }
    `
    const res = await apollo.apollo.executeOperation(
      {
        query: modelQuery,
        variables: {
          projectId: stream.id,
          modelId: branchId
        }
      },
      { contextValue: apollo.context as any }
    )

    expect(res.body.kind).to.equal('single')
    // @ts-ignore
    const singleResult = res.body.singleResult
    expect(singleResult.errors).to.not.exist
    expect(singleResult.data.project.model.latestApprovedVersion.id).to.equal(versionId2)
    expect(singleResult.data.project.model.latestApprovedVersion.message).to.equal('Updated structural elements')

    // Clean up
    await db('approval_flow_bindings').where('id', binding.id).del()
  })
})
