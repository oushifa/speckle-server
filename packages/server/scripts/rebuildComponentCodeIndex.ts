import { getAllRegisteredDbs } from '@/modules/multiregion/utils/dbSelector'
import { rebuildModelComponentCodeIndexFactory } from '@/modules/progress/services/componentCodeIndex'
import { logger } from '@/observability/logging'

/**
 * 重建构件编码索引（component_code_index）切片。
 *
 * 用途：索引刚上线时给存量项目做一次全量铺底；也可以用来修复某个模型切片。
 * 上线后由「版本导入事件」负责增量重建，本脚本只在需要时手动跑。
 *
 * 用法：
 *   yarn cli ... 或直接
 *   tsx --import ./esmLoader.js scripts/rebuildComponentCodeIndex.ts [--projectId=xxx] [--modelId=yyy] [--dry-run]
 *
 * 注意：
 * - 只物化「能解析出构件编码的构件」，重建某个模型的开销与模型规模线性相关；
 * - 读路径只有在切片版本与模型最新版本一致时才信任索引，所以本脚本边跑边生效，
 *   跑到哪里哪里就快，没跑到的项目自动继续走实时解析，不存在「查不到」的窗口。
 */
const hasFlag = (flag: string) => process.argv.includes(flag)

const getArg = (name: string): string | undefined => {
  const prefixed = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (prefixed) return prefixed.slice(name.length + 3)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const main = async () => {
  const projectIdFilter = getArg('projectId')
  const modelIdFilter = getArg('modelId')
  const dryRun = hasFlag('--dry-run')

  const dbs = await getAllRegisteredDbs()

  let visitedModels = 0
  let rebuiltModels = 0
  let indexedRows = 0
  const failures: string[] = []

  for (const db of dbs) {
    const hasTable = await db.schema.hasTable('component_code_index')
    if (!hasTable) continue

    const models = (await db('branches')
      .whereNotNull('streamId')
      .modify((query) => {
        if (projectIdFilter) query.where('streamId', projectIdFilter)
        if (modelIdFilter) query.where('id', modelIdFilter)
      })
      .select('id as modelId', 'streamId as projectId')) as Array<{
      modelId: string
      projectId: string
    }>

    logger.info(
      { models: models.length, projectIdFilter, modelIdFilter, dryRun },
      '待重建的模型数'
    )
    if (dryRun) continue

    const rebuild = rebuildModelComponentCodeIndexFactory({ db })

    for (const model of models) {
      visitedModels++
      try {
        const result = await rebuild({
          projectId: model.projectId,
          modelId: model.modelId
        })
        if (!result.commitId) continue
        rebuiltModels++
        indexedRows += result.rowCount
        if (rebuiltModels % 20 === 0) {
          logger.info(
            { rebuiltModels, indexedRows, visitedModels },
            '构件编码索引重建进度'
          )
        }
      } catch (err) {
        failures.push(`${model.projectId}/${model.modelId}`)
        logger.error(
          { err, projectId: model.projectId, modelId: model.modelId },
          '重建构件编码索引切片失败'
        )
      }
    }
  }

  logger.info(
    {
      visitedModels,
      rebuiltModels,
      indexedRows,
      failureCount: failures.length,
      failures: failures.slice(0, 20),
      dryRun
    },
    '构件编码索引重建完成'
  )

  if (failures.length) process.exitCode = 1
}

void main()
  .catch((err) => {
    logger.error(err, '重建构件编码索引失败')
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
