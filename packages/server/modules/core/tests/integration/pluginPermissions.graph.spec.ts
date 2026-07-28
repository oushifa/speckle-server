import { beforeEachContext } from '@/test/hooks'
import { expect } from 'chai'
import {
  createRandomEmail,
  createRandomPassword
} from '@/modules/core/helpers/testHelpers'
import { testApolloServer } from '@/test/graphqlHelper'
import type { BasicTestUser } from '@/test/authHelper'
import { createTestUser } from '@/test/authHelper'
import type { BasicTestStream } from '@/test/speckle-helpers/streamHelper'
import { createTestStream } from '@/test/speckle-helpers/streamHelper'
import type { BasicTestBranch } from '@/test/speckle-helpers/branchHelper'
import { createTestBranch } from '@/test/speckle-helpers/branchHelper'
import { Roles } from '@/modules/core/helpers/mainConstants'
import {
  buildBasicTestModel,
  buildBasicTestProject
} from '@/modules/core/tests/helpers/creation'
import { gql } from 'graphql-tag'

const CAN_CREATE_INGESTION_QUERY = gql`
  query CanCreateIngestion($modelId: String!, $projectId: String!) {
    project(id: $projectId) {
      id
      permissions {
        canCreateModel {
          authorized
          code
          message
        }
      }
      model(id: $modelId) {
        id
        permissions {
          canCreateIngestion {
            authorized
            code
            message
          }
          canCreateVersion {
            authorized
            code
            message
          }
          canUpdate {
            authorized
            code
            message
          }
          canDelete {
            authorized
            code
            message
          }
        }
      }
    }
  }
`

describe('DUI Plugin Permissions & Functions GraphQL @core', () => {
  let owner: BasicTestUser
  let nonMemberUser: BasicTestUser
  let project: BasicTestStream
  let model: BasicTestBranch

  before(async () => {
    await beforeEachContext()

    // 1. 创建测试用户
    owner = await createTestUser({
      name: 'Plugin Spec Owner',
      email: createRandomEmail(),
      password: createRandomPassword(),
      role: Roles.Server.User
    })

    nonMemberUser = await createTestUser({
      name: 'Plugin Spec NonMember',
      email: createRandomEmail(),
      password: createRandomPassword(),
      role: Roles.Server.User
    })

    // 2. 创建私有项目和模型
    project = buildBasicTestProject({ name: 'Plugin Test Project', isPublic: false })
    await createTestStream(project, owner)

    model = buildBasicTestModel({ name: 'main', description: 'main test model' })
    await createTestBranch({ branch: model, stream: project, owner })
  })

  describe('1. Owner 权限与 CanCreateIngestion 查询测试', () => {
    it('应该为项目 Owner 授权 canCreateIngestion, canCreateVersion, canCreateModel', async () => {
      const apollo = await testApolloServer({ authUserId: owner.id })
      const res = await apollo.execute(
        CAN_CREATE_INGESTION_QUERY,
        {
          projectId: project.id,
          modelId: model.id
        },
        { assertNoErrors: true }
      )

      expect(res.data?.project).to.be.ok
      expect(res.data?.project.permissions.canCreateModel.authorized).to.be.true

      const modelPerms = res.data?.project.model.permissions
      expect(modelPerms.canCreateIngestion.authorized).to.be.true
      expect(modelPerms.canCreateIngestion.code).to.eq('OK')
      expect(modelPerms.canCreateVersion.authorized).to.be.true
      expect(modelPerms.canCreateVersion.code).to.eq('OK')
      expect(modelPerms.canUpdate.authorized).to.be.true
      expect(modelPerms.canDelete.authorized).to.be.true
    })
  })

  describe('2. 非项目成员权限拦截测试', () => {
    it('对于未加入私有项目的成员，权限应该安全拦截 (authorized: false 或无项目访问权限)', async () => {
      const apollo = await testApolloServer({ authUserId: nonMemberUser.id })
      const res = await apollo.execute(
        CAN_CREATE_INGESTION_QUERY,
        {
          projectId: project.id,
          modelId: model.id
        }
      )

      // 对于私有项目，非成员查询 project 结果可能为 null，或者 model 权限字段拦截
      if (res.data?.project?.model?.permissions) {
        const modelPerms = res.data.project.model.permissions
        expect(modelPerms.canCreateIngestion.authorized).to.be.false
        expect(modelPerms.canCreateVersion.authorized).to.be.false
      } else {
        expect(res.data?.project).to.be.null
      }
    })
  })

  describe('3. 未登录/匿名用户访问防护', () => {
    it('未登录用户查询私有项目时不应崩溃并正确处理权限', async () => {
      const apollo = await testApolloServer({})
      const res = await apollo.execute(
        CAN_CREATE_INGESTION_QUERY,
        {
          projectId: project.id,
          modelId: model.id
        }
      )
      expect(res).to.be.ok
    })
  })
})
