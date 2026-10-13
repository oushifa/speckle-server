/* eslint-disable camelcase */
import { expect } from 'chai'
import cryptoRandomString from 'crypto-random-string'
import { db } from '@/db/knex'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { initializeComponentCodeIndexOnVersionListeners } from '@/modules/progress/services/componentCodeIndexOnVersion'
import {
  getIndexedModelCommitsFactory,
  lookupApplicationIdsByComponentCodesFactory
} from '@/modules/progress/services/componentCodeIndex'
import { VersionEvents } from '@/modules/core/domain/commits/events'
import {
  initializeEventBus,
  type EventPayload
} from '@/modules/shared/services/eventBus'
import type { Logger } from '@/observability/logging'
import {
  createTestStream,
  type BasicTestStream
} from '@/test/speckle-helpers/streamHelper'
import { createTestUser, type BasicTestUser } from '@/test/authHelper'
import { waitForRegionUser } from '@/test/speckle-helpers/regions'

/**
 * 「版本导入 → 自动重建构件编码索引切片」的集成测试。
 *
 * 用**独立的事件总线实例**，避免和 app 自身注册的监听器互相干扰。
 * 重点验证：
 * 1. versions.created 会触发重建，且监听器不阻塞 emit（重活在后台队列）；
 * 2. 同一模型的重复事件被去重；切片已经新鲜时不再重建；
 * 3. versions.received 只有 versionId，也能通过 branch_commits 反查到模型；
 * 4. 后台任务里的异常绝不会冒到事件总线（否则会打断导入接口）。
 */
const MODEL_ID = 'volmdl'
const COMMIT_ID = 'volcmt'
const ROOT_ID = 'volroot'
const INFO_ID = 'volinfo'
const COMPONENT_ID = 'volcomp'
const APP_ID = 'vol_app_1'
const SPACE_CODE = 'NB0102'
const CODE = `CLS-A${SPACE_CODE}SEC-AV1`

describe('componentCodeIndexOnVersion @progress', () => {
  let user: BasicTestUser
  let projectId: string
  let projectDb: Awaited<ReturnType<typeof getProjectDbClient>>

  const createdPayload = (): EventPayload<typeof VersionEvents.Created>['payload'] =>
    ({
      projectId,
      modelId: MODEL_ID,
      version: {},
      userId: user.id,
      modelName: 'vol model',
      input: {}
    } as unknown as EventPayload<typeof VersionEvents.Created>['payload'])

  const recordingLogger = () => {
    const info: unknown[][] = []
    const error: unknown[][] = []
    const logger = {
      info: (...args: unknown[]) => info.push(args),
      error: (...args: unknown[]) => error.push(args),
      child: () => logger
    }
    return { logger: logger as unknown as Logger, info, error }
  }

  const clearSlice = async () =>
    db('component_code_index')
      .where({ project_id: projectId, model_id: MODEL_ID })
      .del()

  before(async () => {
    user = await createTestUser({
      name: cryptoRandomString({ length: 10 }),
      email: `${cryptoRandomString({ length: 10, type: 'url-safe' })}@example.org`,
      password: cryptoRandomString({ length: 12 })
    })
    await waitForRegionUser(user.id)

    const stream: Partial<BasicTestStream> = {
      name: 'OnVersion Test',
      isPublic: false
    }
    const created = await createTestStream(stream, user)
    projectId = created.id
    projectDb = await getProjectDbClient({ projectId })

    await db('branches').insert({
      id: MODEL_ID,
      streamId: projectId,
      projectId,
      name: 'vol model',
      authorId: user.id
    })
    await db('objects').insert([
      {
        id: ROOT_ID,
        streamId: projectId,
        speckleType: 'Speckle.Core.Models.Collections.Collection',
        data: JSON.stringify({ __closure: { [INFO_ID]: 1, [COMPONENT_ID]: 1 } })
      },
      {
        id: INFO_ID,
        streamId: projectId,
        speckleType: 'Objects.Data.DataObject',
        data: JSON.stringify({
          name: '项目信息 - 项目信息',
          category: '项目信息',
          空间代码: SPACE_CODE
        })
      },
      {
        id: COMPONENT_ID,
        streamId: projectId,
        speckleType: 'Objects.Data.DataObject',
        data: JSON.stringify({
          applicationId: APP_ID,
          分类对象代码: 'CLS-A',
          分部分项代码: 'SEC-A',
          序号码: 'V1'
        })
      }
    ])
    await db('commits').insert({
      id: COMMIT_ID,
      referencedObject: ROOT_ID,
      createdAt: new Date()
    })
    await db('branch_commits').insert({ branchId: MODEL_ID, commitId: COMMIT_ID })
  })

  it('rebuilds on versions.created, dedupes duplicates and skips fresh slices', async () => {
    const bus = initializeEventBus()
    const { logger, info, error } = recordingLogger()
    const listeners = initializeComponentCodeIndexOnVersionListeners({
      eventBus: bus,
      logger
    })

    try {
      // 监听器只入队：emit 必须立刻返回，不能被重建阻塞
      const startedAt = Date.now()
      await bus.emit({ eventName: VersionEvents.Created, payload: createdPayload() })
      expect(Date.now() - startedAt).to.be.lessThan(1000)

      // 重复事件（同一模型）应当被去重
      await bus.emit({ eventName: VersionEvents.Created, payload: createdPayload() })

      await listeners.waitForIdle()
      expect(error).to.have.lengthOf(0)
      expect(info).to.have.lengthOf(1)

      const hits = await lookupApplicationIdsByComponentCodesFactory({ db: projectDb })(
        {
          projectId,
          componentCodes: [CODE]
        }
      )
      expect(hits.map((hit) => hit.applicationId)).to.include(APP_ID)

      // 切片已经新鲜：再投一次事件不应再重建
      await bus.emit({ eventName: VersionEvents.Created, payload: createdPayload() })
      await listeners.waitForIdle()
      expect(info).to.have.lengthOf(1)
    } finally {
      listeners.quit()
    }
  })

  it('rebuilds the affected models on versions.received (only a versionId is given)', async () => {
    await clearSlice()

    const bus = initializeEventBus()
    const { logger, info } = recordingLogger()
    const listeners = initializeComponentCodeIndexOnVersionListeners({
      eventBus: bus,
      logger
    })

    try {
      await bus.emit({
        eventName: VersionEvents.Received,
        payload: {
          projectId,
          versionId: COMMIT_ID,
          userId: user.id,
          sourceApplication: 'test',
          message: null
        } as unknown as EventPayload<typeof VersionEvents.Received>['payload']
      })
      await listeners.waitForIdle()

      expect(info).to.have.lengthOf(1)
      const states = await getIndexedModelCommitsFactory({ db: projectDb })({
        projectId,
        modelIds: [MODEL_ID]
      })
      expect(states.get(MODEL_ID)?.commitId).to.equal(COMMIT_ID)
    } finally {
      listeners.quit()
    }
  })

  it('never lets background failures escape into the event bus', async () => {
    await clearSlice()

    const bus = initializeEventBus()
    const errors: unknown[][] = []
    const logger = {
      // 让重建成功后的日志抛错，模拟"后台任务里出错"
      info: () => {
        throw new Error('boom')
      },
      error: (...args: unknown[]) => errors.push(args),
      child: () => logger
    }
    const listeners = initializeComponentCodeIndexOnVersionListeners({
      eventBus: bus,
      logger: logger as unknown as Logger
    })

    try {
      // emit 不能 reject —— 否则导入接口会被打断
      await bus.emit({ eventName: VersionEvents.Created, payload: createdPayload() })
      await listeners.waitForIdle()

      expect(errors).to.have.lengthOf(1)
    } finally {
      listeners.quit()
    }
  })
})
