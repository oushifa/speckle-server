/* eslint-disable camelcase */
import { VersionEvents } from '@/modules/core/domain/commits/events'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { moduleLogger, type Logger } from '@/observability/logging'
import {
  getComponentCodeIndexRebuildDutyCycle,
  isComponentCodeIndexRebuildEnabled
} from '@/modules/shared/helpers/envHelper'
import type { EventBus } from '@/modules/shared/services/eventBus'
import {
  getIndexedModelCommitsFactory,
  getLatestModelCommitsFactory,
  rebuildModelComponentCodeIndexFactory
} from '@/modules/progress/services/componentCodeIndex'

/**
 * 版本导入 → 自动重建构件编码索引切片。
 *
 * 设计要点（都是被事件总线的语义逼出来的）：
 *
 * 1. **监听器只入队、立刻返回。** `eventBus.emit()` 会 await 所有监听器，而且监听器
 *    抛出的错误会**直接冒泡到导入接口**。所以监听器里不做任何重活、不抛错，重建统统
 *    放到后台队列。
 * 2. **单进程串行队列 + 去重。** 同一个模型在队列里只保留一份（导入往往连着触发多个
 *    事件）；同一时刻只跑一个重建，天然限流。
 * 3. **已经新鲜就跳过。** 事件可能重复投递（同一版本多分支、重试），切片版本等于模型
 *    最新版本时直接返回。
 * 4. **失败不影响任何人**：只记日志。读路径对"切片缺失/落后"的模型会自动回退到实时
 *    解析，所以一次失败的代价只是"这个模型再慢一阵"，不会查错。
 * 5. 整个过程跑在分批 + 让出 CPU 的重建里（见 componentCodeIndex.ts），所以单次重建
 *    不会把机器打满。
 *
 * 也监听 `versions.deleted`：删掉最新版本后，切片要么重建到新的最新版本，要么（模型
 * 已经没有任何版本了）整片删掉，避免留下指向已删版本的脏切片。
 */
type RebuildJob =
  | { kind: 'model'; projectId: string; modelId: string }
  | { kind: 'version'; projectId: string; versionId: string }
  | { kind: 'deleted'; projectId: string; modelId: string }

const jobKey = (job: RebuildJob) => {
  if (job.kind === 'version') return `version:${job.projectId}:${job.versionId}`
  if (job.kind === 'deleted') return `deleted:${job.projectId}:${job.modelId}`
  return `model:${job.projectId}:${job.modelId}`
}

export type ComponentCodeIndexOnVersionListeners = {
  /** 停止监听（模块 shutdown 用） */
  quit: () => void
  /** 等到队列跑空（测试 / 优雅关停用） */
  waitForIdle: () => Promise<void>
  /** 当前排队 + 执行中的任务数 */
  pendingCount: () => number
}

export const initializeComponentCodeIndexOnVersionListeners = ({
  eventBus,
  logger = moduleLogger
}: {
  eventBus: EventBus
  logger?: Logger
}): ComponentCodeIndexOnVersionListeners => {
  const queue: RebuildJob[] = []
  const knownKeys = new Set<string>()
  const idleWaiters: Array<() => void> = []
  let draining = false

  const notifyIfIdle = () => {
    if (draining || queue.length || knownKeys.size) return
    while (idleWaiters.length) idleWaiters.shift()?.()
  }

  const enqueue = (job: RebuildJob) => {
    if (!isComponentCodeIndexRebuildEnabled()) return false
    const key = jobKey(job)
    if (knownKeys.has(key)) return false
    knownKeys.add(key)
    queue.push(job)
    if (!draining) void drain()
    return true
  }

  const rebuildModel = async (projectId: string, modelId: string) => {
    const projectDb = await getProjectDbClient({ projectId })

    const hasTable = await projectDb.schema.hasTable('component_code_index')
    if (!hasTable) return

    // 已经新鲜就跳过：事件可能重复投递
    const [latest, indexed] = await Promise.all([
      getLatestModelCommitsFactory({ db: projectDb })({
        projectId,
        modelIds: [modelId]
      }),
      getIndexedModelCommitsFactory({ db: projectDb })({
        projectId,
        modelIds: [modelId]
      })
    ])
    const latestCommitId = latest.get(modelId)?.commitId
    if (!latestCommitId) return
    if (indexed.get(modelId)?.commitId === latestCommitId) return

    const rebuild = rebuildModelComponentCodeIndexFactory({ db: projectDb })
    const result = await rebuild({
      projectId,
      modelId,
      options: {
        batchSize: 1000,
        pauseMs: 50,
        dutyCycle: getComponentCodeIndexRebuildDutyCycle()
      }
    })

    logger.info(
      {
        projectId,
        modelId,
        commitId: result.commitId,
        candidates: result.candidates,
        indexedRows: result.rowCount,
        elapsedMs: result.elapsedMs
      },
      '版本导入后自动重建构件编码索引切片完成'
    )
  }

  const removeModelSlice = async (projectId: string, modelId: string) => {
    const projectDb = await getProjectDbClient({ projectId })
    const hasTable = await projectDb.schema.hasTable('component_code_index')
    if (!hasTable) return
    await projectDb('component_code_index')
      .where({ project_id: projectId, model_id: modelId })
      .del()
  }

  /** 事件里 Received 只带 versionId，需要反查它属于哪些模型 */
  const resolveModelIdsByVersion = async (projectId: string, versionId: string) => {
    const projectDb = await getProjectDbClient({ projectId })
    const rows = (await projectDb('branch_commits')
      .where('commitId', versionId)
      .select('branchId')) as Array<{ branchId: string }>
    return rows.map((row) => row.branchId)
  }

  const handleVersionDeleted = async (projectId: string, modelId: string) => {
    const projectDb = await getProjectDbClient({ projectId })
    const remaining = await projectDb('branch_commits')
      .where({ branchId: modelId })
      .first()

    if (remaining) {
      // 模型还有别的版本：重建到新的最新版本
      enqueue({ kind: 'model', projectId, modelId })
      return
    }
    // 模型已经没有任何版本：整片删掉，避免留下指向已删版本的脏切片
    await removeModelSlice(projectId, modelId)
  }

  const processJob = async (job: RebuildJob) => {
    if (job.kind === 'model') {
      await rebuildModel(job.projectId, job.modelId)
      return
    }
    if (job.kind === 'deleted') {
      await handleVersionDeleted(job.projectId, job.modelId)
      return
    }

    const modelIds = await resolveModelIdsByVersion(job.projectId, job.versionId)
    if (!modelIds.length) return
    for (const modelId of modelIds) {
      // 转成模型级任务，交给去重逻辑
      enqueue({ kind: 'model', projectId: job.projectId, modelId })
    }
  }

  async function drain() {
    if (draining) return
    draining = true
    try {
      while (queue.length) {
        const job = queue.shift()
        if (!job) break
        try {
          await processJob(job)
        } catch (err) {
          // 绝不让错误冒到事件总线（那会打断导入流程）
          logger.error(
            { err, ...job },
            '版本导入后自动重建构件编码索引切片失败（读路径会自动回退，不影响正确性）'
          )
        } finally {
          knownKeys.delete(jobKey(job))
        }
      }
    } finally {
      draining = false
      notifyIfIdle()
    }
  }

  const quitCbs = [
    eventBus.listen(VersionEvents.Created, ({ payload }) => {
      enqueue({ kind: 'model', projectId: payload.projectId, modelId: payload.modelId })
    }),
    eventBus.listen(VersionEvents.Received, ({ payload }) => {
      enqueue({
        kind: 'version',
        projectId: payload.projectId,
        versionId: payload.versionId
      })
    }),
    eventBus.listen(VersionEvents.Deleted, ({ payload }) => {
      // 删除事件里带 modelId；具体"重建到新版本还是整片删掉"在队列里判断
      enqueue({
        kind: 'deleted',
        projectId: payload.projectId,
        modelId: payload.modelId
      })
    })
  ]

  return {
    quit: () => {
      quitCbs.forEach((cb) => cb())
    },
    waitForIdle: () =>
      new Promise<void>((resolve) => {
        if (!draining && !queue.length && !knownKeys.size) {
          resolve()
          return
        }
        idleWaiters.push(resolve)
      }),
    pendingCount: () => queue.length + (draining ? 1 : 0)
  }
}
