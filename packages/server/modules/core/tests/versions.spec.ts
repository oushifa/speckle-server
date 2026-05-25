import { StreamActionTypes } from '@/modules/activitystream/helpers/types'
import type { BasicTestUser } from '@/test/authHelper'
import { createTestUsers } from '@/test/authHelper'
import type {
  CreateVersionInput,
  MarkReceivedVersionInput
} from '@/modules/core/graph/generated/graphql'
import {
  CreateProjectVersionDocument,
  MarkProjectVersionReceivedDocument,
  UpdateProjectVersionDocument
} from '@/modules/core/graph/generated/graphql'
import type { TestApolloServer } from '@/test/graphqlHelper'
import { testApolloServer } from '@/test/graphqlHelper'
import { beforeEachContext } from '@/test/hooks'
import { getStreamActivities } from '@/test/speckle-helpers/activityStreamHelper'
import type { BasicTestBranch } from '@/test/speckle-helpers/branchHelper'
import { createTestBranches } from '@/test/speckle-helpers/branchHelper'
import { createTestObject } from '@/test/speckle-helpers/commitHelper'
import type { BasicTestStream } from '@/test/speckle-helpers/streamHelper'
import { createTestStreams } from '@/test/speckle-helpers/streamHelper'
import { expect } from 'chai'
import { omit } from 'lodash-es'

describe('Versions', () => {
  const me: BasicTestUser = {
    name: 'hello itsa me',
    email: '',
    id: ''
  }

  const outsider: BasicTestUser = {
    name: 'outsider',
    email: '',
    id: ''
  }

  const myPrivateStream: BasicTestStream = {
    name: 'this is my private stream #1',
    isPublic: false,
    ownerId: '',
    id: ''
  }

  const myBranch: BasicTestBranch = {
    name: 'my branchy #1',
    streamId: '',
    id: '',
    authorId: ''
  }

  before(async () => {
    await beforeEachContext()
    await createTestUsers([me, outsider])
    await createTestStreams([[myPrivateStream, me]])
    await createTestBranches([{ branch: myBranch, stream: myPrivateStream, owner: me }])
  })

  describe('in GraphQL API', () => {
    let apollo: TestApolloServer
    let outsiderApollo: TestApolloServer
    let objectId: string

    const createVersion = async (input: CreateVersionInput) =>
      await apollo.execute(CreateProjectVersionDocument, { input })

    before(async () => {
      apollo = await testApolloServer({
        authUserId: me.id
      })
      outsiderApollo = await testApolloServer({
        authUserId: outsider.id
      })
      objectId = await createTestObject({ projectId: myPrivateStream.id })
    })

    it('can be created', async () => {
      const input: CreateVersionInput = {
        projectId: myPrivateStream.id,
        modelId: myBranch.id,
        objectId,
        message: 'Yoooo!',
        sourceApplication: 'tests',
        parents: [],
        seedId: 'seed-123',
        assetId: 'asset-456'
      }
      const res = await createVersion(input)

      expect(res).to.not.haveGraphQLErrors()
      expect(res.data?.versionMutations.create.id).to.be.ok
      expect(res.data?.versionMutations.create.message).to.eq(input.message)
      expect(res.data?.versionMutations.create.sourceApplication).to.eq(
        input.sourceApplication
      )
      expect(res.data?.versionMutations.create.seedId).to.eq(input.seedId)
      expect(res.data?.versionMutations.create.assetId).to.eq(input.assetId)
      expect(res.data?.versionMutations.create.model.id).to.eq(myBranch.id)
      expect(res.data?.versionMutations.create.referencedObject).to.eq(objectId)
    })

    describe('after creation', () => {
      let firstVersion: CreateVersionInput & { id: string }

      before(async () => {
        firstVersion = {
          projectId: myPrivateStream.id,
          modelId: myBranch.id,
          objectId,
          message: 'welcome #1',
          sourceApplication: 'testsz',
          parents: [],
          id: ''
        }
        const res = await createVersion(omit(firstVersion, ['id']))
        firstVersion.id = res.data!.versionMutations.create.id
        expect(firstVersion.id).to.be.ok
      })

      it('can be marked as received', async () => {
        const input: MarkReceivedVersionInput = {
          versionId: firstVersion.id,
          projectId: myPrivateStream.id,
          sourceApplication: 'booo',
          message: 'hey hihihi'
        }
        const res = await apollo.execute(MarkProjectVersionReceivedDocument, {
          input
        })

        expect(res).to.not.haveGraphQLErrors()
        expect(res.data?.versionMutations.markReceived).to.be.true

        const activities = await getStreamActivities(myPrivateStream.id, {
          actionType: StreamActionTypes.Commit.Receive,
          userId: me.id
        })
        expect(activities).to.have.length(1)
        expect(activities[0].info?.message).to.eq(input.message)
      })

      it('can update external sync fields', async () => {
        const treeJson = JSON.stringify({ model: { id: 'seed-updated' }, elements: [] })
        const res = await apollo.execute(UpdateProjectVersionDocument, {
          input: {
            projectId: myPrivateStream.id,
            versionId: firstVersion.id,
            seedId: 'seed-updated',
            assetId: 'asset-updated',
            assetName: 'asset-name-updated',
            treeJson
          }
        })

        expect(res).to.not.haveGraphQLErrors()
        expect(res.data?.versionMutations.update.id).to.eq(firstVersion.id)
        expect(res.data?.versionMutations.update.seedId).to.eq('seed-updated')
        expect(res.data?.versionMutations.update.assetId).to.eq('asset-updated')
        expect(res.data?.versionMutations.update.assetName).to.eq('asset-name-updated')
        expect(res.data?.versionMutations.update.treeJson).to.eq(treeJson)
      })

      it('allows any logged in user to update external sync fields', async () => {
        const treeJson = JSON.stringify({ model: { id: 'seed-outsider' }, elements: [] })
        const res = await outsiderApollo.execute(UpdateProjectVersionDocument, {
          input: {
            projectId: myPrivateStream.id,
            versionId: firstVersion.id,
            seedId: 'seed-outsider',
            assetId: 'asset-outsider',
            assetName: 'asset-name-outsider',
            treeJson
          }
        })

        expect(res).to.not.haveGraphQLErrors()
        expect(res.data?.versionMutations.update.id).to.eq(firstVersion.id)
        expect(res.data?.versionMutations.update.seedId).to.eq('seed-outsider')
        expect(res.data?.versionMutations.update.assetId).to.eq('asset-outsider')
        expect(res.data?.versionMutations.update.assetName).to.eq('asset-name-outsider')
        expect(res.data?.versionMutations.update.treeJson).to.eq(treeJson)
      })

      it('still blocks regular version message updates for non-members', async () => {
        const res = await outsiderApollo.execute(UpdateProjectVersionDocument, {
          input: {
            projectId: myPrivateStream.id,
            versionId: firstVersion.id,
            message: 'outsider should not edit message'
          }
        })

        expect(res).to.haveGraphQLErrors('You do not have access to the project')
      })
    })
  })
})
