import { expect } from 'chai'
import cryptoRandomString from 'crypto-random-string'
import { db } from '@/db/knex'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { buildComponentCodeLookup } from '@/modules/progress/services/componentCodeLookup'
import {
  buildComponentCodeLookupWithIndexFactory,
  getIndexedModelCommitsFactory,
  lookupApplicationIdsByComponentCodesFactory,
  rebuildModelComponentCodeIndexFactory
} from '@/modules/progress/services/componentCodeIndex'
import {
  createTestStream,
  type BasicTestStream
} from '@/test/speckle-helpers/streamHelper'
import { createTestUser, type BasicTestUser } from '@/test/authHelper'
import { waitForRegionUser } from '@/test/speckle-helpers/regions'

/**
 * 构件编码索引（component_code_index）的集成测试。
 *
 * 覆盖：
 * 1. 重建切片：状态行版本正确、正向查询能按编码拿到 applicationId；
 * 2. 新鲜切片与实时解析结果一致（同一个 applicationId 必须解出同一个编码）；
 * 3. 切片落后于模型最新版本时**自动回退实时解析**（不能拿旧索引糊弄）；
 * 4. 没有版本的模型不写切片。
 */
const MODEL_ID = 'ccima'
const COMMIT_V1 = 'ccica1'
const COMMIT_V2 = 'ccica2'
const ROOT_V1 = 'ccirt1'
const ROOT_V2 = 'ccirt2'
const INFO_V1 = 'cciif1'
const INFO_V2 = 'cciif2'
const COMPONENT_V1 = 'ccicp1'
const COMPONENT_V2 = 'ccicp2'
const APP_ID_V1 = 'cci_app_v1'
const APP_ID_V2 = 'cci_app_v2'
const SPACE_CODE = 'NB0102'
const CODE_V1 = `CLS-A${SPACE_CODE}SEC-ACB-28`
const CODE_V2 = `CLS-A${SPACE_CODE}SEC-ACB-29`

describe('componentCodeIndex @progress', () => {
  let user: BasicTestUser
  let projectId: string
  let projectDb: Awaited<ReturnType<typeof getProjectDbClient>>

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

  const insertVersion = async (params: {
    commitId: string
    rootObjectId: string
    createdAt: Date
  }) => {
    await db('commits').insert({
      id: params.commitId,
      referencedObject: params.rootObjectId,
      createdAt: params.createdAt
    })
    await db('branch_commits').insert({
      branchId: MODEL_ID,
      commitId: params.commitId
    })
  }

  const componentData = (applicationId: string, serial: string) => ({
    applicationId,
    分类对象代码: 'CLS-A',
    分部分项代码: 'SEC-A',
    序号码: serial
  })

  before(async () => {
    user = await createTestUser({
      name: cryptoRandomString({ length: 10 }),
      email: `${cryptoRandomString({ length: 10, type: 'url-safe' })}@example.org`,
      password: cryptoRandomString({ length: 12 })
    })
    await waitForRegionUser(user.id)

    const stream: Partial<BasicTestStream> = { name: 'Index Test', isPublic: false }
    const created = await createTestStream(stream, user)
    projectId = created.id
    projectDb = await getProjectDbClient({ projectId })

    await db('branches').insert({
      id: MODEL_ID,
      streamId: projectId,
      projectId,
      name: 'index model',
      authorId: user.id
    })

    // 版本 1
    await insertObject({
      id: ROOT_V1,
      speckleType: 'Speckle.Core.Models.Collections.Collection',
      data: { __closure: { [INFO_V1]: 1, [COMPONENT_V1]: 1 } }
    })
    await insertObject({
      id: INFO_V1,
      data: { name: '项目信息 - 项目信息', category: '项目信息', 空间代码: SPACE_CODE }
    })
    await insertObject({
      id: COMPONENT_V1,
      data: componentData(APP_ID_V1, 'CB-28')
    })
    await insertVersion({
      commitId: COMMIT_V1,
      rootObjectId: ROOT_V1,
      createdAt: new Date('2026-10-01T00:00:00Z')
    })
  })

  it('rebuilds a slice and answers the forward lookup by component code', async () => {
    const rebuild = rebuildModelComponentCodeIndexFactory({ db: projectDb })
    const result = await rebuild({ projectId, modelId: MODEL_ID })

    expect(result.commitId).to.equal(COMMIT_V1)
    // 构件级才会物化：构件本身写「对象 id」和「applicationId」两个键
    expect(result.rowCount).to.equal(2)

    const states = await getIndexedModelCommitsFactory({ db: projectDb })({
      projectId,
      modelIds: [MODEL_ID]
    })
    expect(states.get(MODEL_ID)?.commitId).to.equal(COMMIT_V1)

    const hits = await lookupApplicationIdsByComponentCodesFactory({ db: projectDb })({
      projectId,
      componentCodes: [CODE_V1]
    })
    const applicationIds = hits.map((hit) => hit.applicationId).sort()
    expect(applicationIds).to.deep.equal([APP_ID_V1, COMPONENT_V1].sort())

    // 状态行不能被当成构件查出来
    const emptyCodeHits = await lookupApplicationIdsByComponentCodesFactory({
      db: projectDb
    })({ projectId, componentCodes: [''] })
    expect(emptyCodeHits).to.have.lengthOf(0)
  })

  it('returns the same code as the on-the-fly resolver for a fresh slice', async () => {
    const entries = [{ modelId: MODEL_ID, applicationIds: [APP_ID_V1, COMPONENT_V1] }]

    const fromResolver = await buildComponentCodeLookup(projectDb, projectId, entries)

    // 关键判别：新鲜切片必须**完全不碰 objects**，否则说明其实走了回退路径
    const statements: string[] = []
    const onQuery = (query: { sql?: string }) => {
      statements.push(String(query?.sql ?? ''))
    }
    projectDb.client.on('query', onQuery)
    let fromIndex: Map<string, string>
    try {
      fromIndex = await buildComponentCodeLookupWithIndexFactory({ db: projectDb })({
        projectId,
        entries
      })
    } finally {
      projectDb.client.removeListener('query', onQuery)
    }

    expect(statements.some((sql) => sql.includes('component_code_index'))).to.equal(
      true
    )
    expect(
      statements.some((sql) => /from\s+"objects"/i.test(sql)),
      `不应查询 objects，实际 SQL：${statements.join(' | ')}`
    ).to.equal(false)

    expect(fromResolver.get(APP_ID_V1)).to.equal(CODE_V1)
    expect(fromIndex.get(APP_ID_V1)).to.equal(CODE_V1)
    // 对象 id 作为构件标识的（历史数据 / 进度 V2 口径）也必须一致
    expect(fromResolver.get(COMPONENT_V1)).to.equal(CODE_V1)
    expect(fromIndex.get(COMPONENT_V1)).to.equal(CODE_V1)
  })

  it('falls back to on-the-fly resolution when the slice is behind the latest version', async () => {
    // 追加版本 2：构件换了序号码，编码随之变化
    await insertObject({
      id: ROOT_V2,
      speckleType: 'Speckle.Core.Models.Collections.Collection',
      data: { __closure: { [INFO_V2]: 1, [COMPONENT_V2]: 1 } }
    })
    await insertObject({
      id: INFO_V2,
      data: { name: '项目信息 - 项目信息', category: '项目信息', 空间代码: SPACE_CODE }
    })
    await insertObject({
      id: COMPONENT_V2,
      data: componentData(APP_ID_V2, 'CB-29')
    })
    await insertVersion({
      commitId: COMMIT_V2,
      rootObjectId: ROOT_V2,
      createdAt: new Date('2026-10-02T00:00:00Z')
    })

    // 此刻索引里还是版本 1 的切片，必须被判定为过期
    const states = await getIndexedModelCommitsFactory({ db: projectDb })({
      projectId,
      modelIds: [MODEL_ID]
    })
    expect(states.get(MODEL_ID)?.commitId).to.equal(COMMIT_V1)

    const entries = [{ modelId: MODEL_ID, applicationIds: [APP_ID_V2] }]

    // 旧切片里没有 APP_ID_V2：如果错误地信了索引，这里会是 undefined
    const fromIndex = await buildComponentCodeLookupWithIndexFactory({ db: projectDb })(
      {
        projectId,
        entries
      }
    )
    const fromResolver = await buildComponentCodeLookup(projectDb, projectId, entries)

    expect(fromIndex.get(APP_ID_V2)).to.equal(CODE_V2)
    expect(fromResolver.get(APP_ID_V2)).to.equal(CODE_V2)

    // 重建之后又应该走索引，并且结果一致
    const rebuild = rebuildModelComponentCodeIndexFactory({ db: projectDb })
    const rebuilt = await rebuild({ projectId, modelId: MODEL_ID })
    expect(rebuilt.commitId).to.equal(COMMIT_V2)

    const afterRebuild = await buildComponentCodeLookupWithIndexFactory({
      db: projectDb
    })({
      projectId,
      entries
    })
    expect(afterRebuild.get(APP_ID_V2)).to.equal(CODE_V2)

    const hits = await lookupApplicationIdsByComponentCodesFactory({ db: projectDb })({
      projectId,
      componentCodes: [CODE_V2]
    })
    expect(hits.map((hit) => hit.applicationId)).to.include(APP_ID_V2)
  })

  it('does not write a slice for a model without any version', async () => {
    await db('branches').insert({
      id: 'ccimb',
      streamId: projectId,
      projectId,
      name: 'empty model',
      authorId: user.id
    })

    const rebuild = rebuildModelComponentCodeIndexFactory({ db: projectDb })
    const result = await rebuild({ projectId, modelId: 'ccimb' })
    expect(result.commitId).to.equal(null)
    expect(result.rowCount).to.equal(0)
  })
})
