import { expect } from 'chai'
import cryptoRandomString from 'crypto-random-string'
import { db } from '@/db/knex'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  buildComponentCodeLookup,
  clearModelSpaceCodeCache
} from '@/modules/progress/services/componentCodeLookup'
import {
  createTestStream,
  type BasicTestStream
} from '@/test/speckle-helpers/streamHelper'
import { createTestUser, type BasicTestUser } from '@/test/authHelper'
import { waitForRegionUser } from '@/test/speckle-helpers/regions'

/**
 * 构件编码反查的集成测试。
 *
 * 覆盖三件事：
 * 1. 多模型项目里，构件没有自己的空间代码时，按**所属模型**的项目信息节点回退；
 * 2. 项目信息节点在深层时，浅层快速通道找不到会回退到全闭包扫描（不漏结果）；
 * 3. 构件自身带空间代码时优先使用自身的值。
 *
 * 注意：branches / commits 的 id 都是 varchar(10)，夹具必须用短 id。
 */
describe('buildComponentCodeLookup @progress', () => {
  let user: BasicTestUser
  let projectId: string
  let projectDb: Awaited<ReturnType<typeof getProjectDbClient>>

  const createRandomUser = async (): Promise<BasicTestUser> => {
    const userDetails = {
      name: cryptoRandomString({ length: 10 }),
      email: `${cryptoRandomString({ length: 10, type: 'url-safe' })}@example.org`,
      password: cryptoRandomString({ length: 12 })
    }
    return createTestUser(userDetails)
  }

  /** 建模型（branch）+ 版本（commit），并把版本指向根对象 */
  const createModel = async (params: {
    modelId: string
    commitId: string
    rootObjectId: string
  }) => {
    const { modelId, commitId, rootObjectId } = params
    await db('branches').insert({
      id: modelId,
      streamId: projectId,
      projectId,
      name: modelId,
      authorId: user.id
    })
    await db('commits').insert({
      id: commitId,
      referencedObject: rootObjectId,
      createdAt: new Date()
    })
    await db('branch_commits').insert({ branchId: modelId, commitId })
  }

  const projectInfoNode = (spaceCode: string) => ({
    name: '项目信息 - 项目信息',
    category: '项目信息',
    空间代码: spaceCode
  })

  const componentNode = (
    applicationId: string,
    classCode: string,
    sectionCode: string,
    serialNumber: string,
    ownSpaceCode?: string
  ) => ({
    applicationId,
    分类对象代码: classCode,
    分部分项代码: sectionCode,
    序号码: serialNumber,
    ...(ownSpaceCode ? { 空间代码: ownSpaceCode } : {})
  })

  const insertObject = async (params: {
    id: string
    data: Record<string, unknown>
    speckleType?: string
  }) => {
    await db('objects').insert({
      id: params.id,
      streamId: projectId,
      speckleType: params.speckleType || 'Objects.Data.DataObject',
      data: JSON.stringify(params.data)
    })
  }

  before(async () => {
    user = await createRandomUser()
    await waitForRegionUser(user.id)

    const stream: Partial<BasicTestStream> = {
      name: 'Component Code Lookup Test',
      isPublic: false
    }
    const created = await createTestStream(stream, user)
    projectId = created.id

    projectDb = await getProjectDbClient({ projectId })
  })

  beforeEach(() => {
    clearModelSpaceCodeCache()
  })

  it('resolves the space code per model from a shallow project info node', async () => {
    await createModel({
      modelId: 'cclma',
      commitId: 'cclca',
      rootObjectId: 'cclroota'
    })
    await createModel({
      modelId: 'cclmb',
      commitId: 'cclcb',
      rootObjectId: 'cclrootb'
    })

    await insertObject({
      id: 'cclroota',
      speckleType: 'Speckle.Core.Models.Collections.Collection',
      data: { __closure: { cclinfoa: 1, cclcompa: 1 } }
    })
    await insertObject({
      id: 'cclrootb',
      speckleType: 'Speckle.Core.Models.Collections.Collection',
      data: { __closure: { cclinfob: 1, cclcompb: 1 } }
    })
    await insertObject({ id: 'cclinfoa', data: projectInfoNode('NB0102') })
    await insertObject({ id: 'cclinfob', data: projectInfoNode('NB0101') })
    await insertObject({
      id: 'cclcompa',
      data: componentNode('ccl_app_a', 'CLS-A', 'SEC-A', 'CB-28')
    })
    await insertObject({
      id: 'cclcompb',
      data: componentNode('ccl_app_b', 'CLS-B', 'SEC-B', 'E01')
    })

    const lookup = await buildComponentCodeLookup(projectDb, projectId, [
      { modelId: 'cclma', applicationIds: ['ccl_app_a'] },
      { modelId: 'cclmb', applicationIds: ['ccl_app_b'] }
    ])

    // 每个模型用自己的空间代码，而不是「项目里第一个」
    expect(lookup.get('ccl_app_a')).to.equal('CLS-ANB0102SEC-ACB-28')
    expect(lookup.get('ccl_app_b')).to.equal('CLS-BNB0101SEC-BE01')
    // 对象 id 也作为键返回
    expect(lookup.get('cclcompa')).to.equal('CLS-ANB0102SEC-ACB-28')
  })

  it('falls back to the full closure scan when the project info node is deep', async () => {
    await createModel({
      modelId: 'cclmdp',
      commitId: 'cclcdp',
      rootObjectId: 'cclrootdp'
    })

    await insertObject({
      id: 'cclrootdp',
      speckleType: 'Speckle.Core.Models.Collections.Collection',
      // 项目信息节点在深度 3，浅层快速通道（深度 <= 2）看不到它
      data: { __closure: { cclcompdp: 1, cclmiddp: 2, cclinfodp: 3 } }
    })
    await insertObject({
      id: 'cclmiddp',
      speckleType: 'Speckle.Core.Models.Collections.Collection',
      data: { name: 'mid' }
    })
    await insertObject({ id: 'cclinfodp', data: projectInfoNode('NB0103') })
    await insertObject({
      id: 'cclcompdp',
      data: componentNode('ccl_app_deep', 'CLS-D', 'SEC-D', 'D01')
    })

    const lookup = await buildComponentCodeLookup(projectDb, projectId, [
      { modelId: 'cclmdp', applicationIds: ['ccl_app_deep'] }
    ])

    expect(lookup.get('ccl_app_deep')).to.equal('CLS-DNB0103SEC-DD01')
  })

  it('prefers the space code stored on the component itself', async () => {
    await createModel({
      modelId: 'cclmown',
      commitId: 'cclcown',
      rootObjectId: 'cclrootown'
    })

    await insertObject({
      id: 'cclrootown',
      speckleType: 'Speckle.Core.Models.Collections.Collection',
      data: { __closure: { cclinfoown: 1, cclcompown: 1 } }
    })
    await insertObject({ id: 'cclinfoown', data: projectInfoNode('NB0199') })
    await insertObject({
      id: 'cclcompown',
      data: componentNode('ccl_app_own', 'CLS-O', 'SEC-O', 'O01', 'OWNSC')
    })

    const lookup = await buildComponentCodeLookup(projectDb, projectId, [
      { modelId: 'cclmown', applicationIds: ['ccl_app_own'] }
    ])

    expect(lookup.get('ccl_app_own')).to.equal('CLS-OOWNSCSEC-OO01')
  })
})
