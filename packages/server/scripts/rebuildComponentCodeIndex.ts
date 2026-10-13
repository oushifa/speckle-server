import { getAllRegisteredDbs } from '@/modules/multiregion/utils/dbSelector'
import {
  getIndexedModelCommitsFactory,
  getLatestModelCommitsFactory,
  rebuildModelComponentCodeIndexFactory
} from '@/modules/progress/services/componentCodeIndex'
import { logger } from '@/observability/logging'

/**
 * 全量回填构件编码索引（component_code_index）切片。
 *
 * 特点（面向生产的一次性回填）：
 * - **可续跑**：切片版本已经等于模型最新版本的模型默认跳过，中断后直接重跑即可，
 *   不会重复解析；
 * - 两遍扫描：先批量算出「需要重建的模型」清单（每个项目 2 条查询），再逐个重建，
 *   因此能给出总数与 ETA；
 * - `--limit` 分批、`--sleep-ms` 限流，避免长时间压着数据库；
 * - 单个模型失败只记账不中断，最后汇总并以非 0 退出码结束；
 * - 遍历 `getAllRegisteredDbs()`：单库部署就是主库，多 region 时自动覆盖所有地域库。
 *
 * 用法（在容器内，工作目录 /speckle-server/packages/server）：
 *   yarn tsx --import ./esmLoader.js ./scripts/rebuildComponentCodeIndex.ts [options]
 *
 * 选项：
 *   --dry-run          只统计需要重建的模型，不写库
 *   --force            连「切片已是最新版本」的模型也重建（改了编码规则后用）
 *   --projectId=<id>   只处理指定项目
 *   --modelId=<id>     只处理指定模型
 *   --limit=<n>        本次最多重建 n 个模型（分批跑用）
 *   --sleep-ms=<n>     每个模型之间停顿 n 毫秒（限流用）
 *   --help             显示帮助
 */
const hasFlag = (flag: string) => process.argv.includes(flag)

/** 支持 `--name=value` 与 `--name value` 两种写法；可传多个别名（如 sleep-ms / sleepMs） */
const getArg = (names: string | string[]): string | undefined => {
  const list = Array.isArray(names) ? names : [names]
  for (const name of list) {
    const prefixed = process.argv.find((arg) => arg.startsWith(`--${name}=`))
    if (prefixed) return prefixed.slice(name.length + 3)

    const index = process.argv.indexOf(`--${name}`)
    if (index >= 0) {
      const value = process.argv[index + 1]
      if (value !== undefined && !value.startsWith('--')) return value
    }
  }
  return undefined
}

const getNumberArg = (names: string[]): number | undefined => {
  const raw = getArg(names)
  if (raw === undefined) return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours) return `${hours}h${minutes}m`
  if (minutes) return `${minutes}m${seconds}s`
  return `${seconds}s`
}

type RebuildTarget = {
  projectId: string
  modelId: string
}

const printHelp = () => {
  process.stdout.write(
    [
      '用法: yarn tsx --import ./esmLoader.js ./scripts/rebuildComponentCodeIndex.ts [options]',
      '',
      '  --dry-run          只统计需要重建的模型，不写库',
      '  --force            连切片已是最新版本的模型也重建',
      '  --projectId=<id>   只处理指定项目',
      '  --modelId=<id>     只处理指定模型',
      '  --limit=<n>        本次最多重建 n 个模型',
      '  --sleep-ms=<n>     每个模型之间停顿 n 毫秒',
      '',
      '  —— 单个模型重建时的限流（默认值已按"不占满 CPU"设定）——',
      '  --batch-size=<n>   每批处理多少个候选对象（默认 2000）',
      '  --pause-ms=<n>     每批之后停顿的下限毫秒数（默认 50）',
      '  --duty-cycle=<f>   CPU 占空比上限，0.05~1（默认 0.5 = 干 1 秒歇 1 秒）',
      '',
      '  —— 单个模型重建时的加速开关（默认关闭，需先用验证 SQL 确认覆盖）——',
      '  --max-depth=<n>    只用闭包深度 <= n 的对象做候选（几何/网格对象在深层）',
      '  --prefilter        只在 SQL 侧按"构件编码/分类对象代码"等别名预过滤',
      '  --help             显示帮助',
      ''
    ].join('\n')
  )
}

const main = async () => {
  if (hasFlag('--help')) {
    printHelp()
    return
  }

  const dryRun = hasFlag('--dry-run')
  const force = hasFlag('--force')
  const projectIdFilter = getArg(['projectId', 'project-id'])
  const modelIdFilter = getArg(['modelId', 'model-id'])
  const limit = getNumberArg(['limit'])
  const sleepMs = getNumberArg(['sleep-ms', 'sleepMs']) ?? 0
  const batchSize = getNumberArg(['batch-size', 'batchSize'])
  const pauseMs = getNumberArg(['pause-ms', 'pauseMs'])
  const dutyCycleRaw = getArg(['duty-cycle', 'dutyCycle'])
  const dutyCycle = dutyCycleRaw === undefined ? undefined : Number(dutyCycleRaw)
  const maxDepth = getNumberArg(['max-depth', 'maxDepth'])
  const prefilter = hasFlag('--prefilter')

  const rebuildOptions = {
    ...(batchSize !== undefined ? { batchSize } : {}),
    ...(pauseMs !== undefined ? { pauseMs } : {}),
    ...(dutyCycle !== undefined && Number.isFinite(dutyCycle) ? { dutyCycle } : {}),
    ...(maxDepth !== undefined ? { maxDepth } : {}),
    prefilter
  }

  logger.info(
    {
      dryRun,
      force,
      projectIdFilter,
      modelIdFilter,
      limit,
      sleepMs,
      ...rebuildOptions
    },
    '参数解析'
  )

  const dbs = await getAllRegisteredDbs()

  let modelsSeen = 0
  let skippedNoVersion = 0
  let skippedFresh = 0
  const targets: Array<{ db: (typeof dbs)[number]; target: RebuildTarget }> = []

  // ---------- 第一遍：批量算出需要重建的模型 ----------
  for (const db of dbs) {
    if (!(await db.schema.hasTable('component_code_index'))) continue

    const rows = (await db('branches')
      .whereNotNull('streamId')
      .modify((query) => {
        if (projectIdFilter) query.where('streamId', projectIdFilter)
        if (modelIdFilter) query.where('id', modelIdFilter)
      })
      .select('id as modelId', 'streamId as projectId')) as Array<{
      modelId: string
      projectId: string
    }>

    const modelIdsByProject = new Map<string, string[]>()
    for (const row of rows) {
      const list = modelIdsByProject.get(row.projectId) ?? []
      list.push(row.modelId)
      modelIdsByProject.set(row.projectId, list)
    }

    logger.info(
      { projects: modelIdsByProject.size, models: rows.length },
      '开始扫描模型切片状态'
    )

    for (const [projectId, modelIds] of modelIdsByProject) {
      const [latest, indexed] = await Promise.all([
        getLatestModelCommitsFactory({ db })({ projectId, modelIds }),
        getIndexedModelCommitsFactory({ db })({ projectId, modelIds })
      ])

      for (const modelId of modelIds) {
        modelsSeen++
        const latestCommitId = latest.get(modelId)?.commitId
        if (!latestCommitId) {
          // 没有任何导入版本的空模型，没有必要（也无法）建索引
          skippedNoVersion++
          continue
        }
        if (!force && indexed.get(modelId)?.commitId === latestCommitId) {
          skippedFresh++
          continue
        }
        targets.push({ db, target: { projectId, modelId } })
      }
    }
  }

  logger.info(
    {
      modelsSeen,
      needsRebuild: targets.length,
      skippedFresh,
      skippedNoVersion,
      dryRun,
      force
    },
    '扫描完成'
  )

  if (dryRun || !targets.length) {
    logger.info({ dryRun }, '未写入任何数据')
    return
  }

  // ---------- 第二遍：逐个重建 ----------
  const selected = limit ? targets.slice(0, limit) : targets
  if (limit && targets.length > selected.length) {
    logger.info(
      { limit, selected: selected.length, remaining: targets.length - selected.length },
      '按 --limit 截断本次处理量，可稍后重跑继续'
    )
  }

  const startedAt = Date.now()
  let rebuilt = 0
  let indexedRows = 0
  const failures: string[] = []
  const rebuilders = new Map<
    unknown,
    ReturnType<typeof rebuildModelComponentCodeIndexFactory>
  >()
  const getRebuilder = (db: (typeof dbs)[number]) => {
    let rebuilder = rebuilders.get(db)
    if (!rebuilder) {
      rebuilder = rebuildModelComponentCodeIndexFactory({ db })
      rebuilders.set(db, rebuilder)
    }
    return rebuilder
  }

  for (const { db, target } of selected) {
    try {
      const result = await getRebuilder(db)({
        ...target,
        options: rebuildOptions
      })
      rebuilt++
      indexedRows += result.rowCount

      if (rebuilt <= 3 || rebuilt % 20 === 0 || rebuilt === selected.length) {
        const elapsedMs = Date.now() - startedAt
        const etaMs = rebuilt ? (elapsedMs / rebuilt) * (selected.length - rebuilt) : 0
        logger.info(
          {
            progress: `${rebuilt}/${selected.length}`,
            model: target.modelId,
            candidates: result.candidates,
            skipped: result.skipped,
            indexedRows,
            modelMs: result.elapsedMs,
            elapsed: formatDuration(elapsedMs),
            eta: formatDuration(etaMs)
          },
          '回填进度'
        )
      }

      if (sleepMs) await sleep(sleepMs)
    } catch (err) {
      failures.push(`${target.projectId}/${target.modelId}`)
      logger.error({ err, ...target }, '重建构件编码索引切片失败')
    }
  }

  logger.info(
    {
      rebuilt,
      indexedRows,
      failures: failures.length,
      failureSamples: failures.slice(0, 20),
      remaining: targets.length - selected.length,
      elapsed: formatDuration(Date.now() - startedAt)
    },
    '回填结束'
  )

  if (failures.length) process.exitCode = 1
}

void main()
  .catch((err) => {
    logger.error(err, '回填构件编码索引失败')
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      const clients = await getAllRegisteredDbs()
      await Promise.all(clients.map((client) => client.destroy()))
    } catch (err) {
      logger.error(err, '关闭数据库连接失败')
    }
  })
