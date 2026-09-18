/**
 * 一次性回填：把历史上已审批通过的 0 期【月度验工】中手写的安全文明措施费数据，
 * 补写进【安全文明措施费】的累计完成数。
 *
 * 背景见方案文档：《0期安全文明措施费并入月度验工方案.md》§10。
 * 线上代码只在"月度验工审批通过"事件上触发写回，不会追溯历史单据，
 * 因此存量已审批的 0 期单据必须用本脚本一次性补齐。
 *
 * 用法（在 packages/server 目录下）：
 *
 *   1. 准备配置文件（见 scripts/config/zeroRoundSafetyMeasureSections.example.json）
 *   2. 先干跑，核对命中的清单项数量
 *      tsx --import ./esmLoader.js ./scripts/backfillZeroRoundSafetyMeasures.ts \
 *        --config=./scripts/config/zeroRoundSafetyMeasureSections.json --dry-run
 *   3. 确认无误后正式执行（去掉 --dry-run）
 *
 * 参数：
 *   --config=<path>   必填，回填配置 JSON
 *   --dry-run         只体检不写库
 *   --allow-duplicate 跳过"同期已有手工安全文明措施费"的重复计量拦截（谨慎使用）
 *
 * 注意：脚本复用 services/safetyMeasureSync.ts 里与线上完全相同的生成逻辑，
 *      不要另写一套 SQL，否则口径必然漂移。
 */
import fs from 'node:fs'
import {
  BoqItems,
  MonthlyMeasurementItems,
  MonthlyMeasurements,
  SafetyMeasures
} from '@/modules/core/dbSchema'
import type { BoqItemRecord } from '@/modules/bop-item/repositories/boq'
import type {
  MonthlyMeasurementItemRecord,
  MonthlyMeasurementRecord,
  SafetyMeasureRecord
} from '@/modules/core/helpers/types'
import { logger } from '@/observability/logging'
import { preciseMul } from '@/modules/shared/helpers/preciseMath'
import {
  getAllRegisteredDbs,
  getProjectDbClient
} from '@/modules/multiregion/utils/dbSelector'
import {
  resolveSafetyMeasureBoqItemIds,
  syncSafetyMeasureFromMonthlyMeasurement
} from '@/modules/quality-acceptance-form/services/safetyMeasureSync'

const hasFlag = (flag: string) => process.argv.includes(flag)

const getArgValue = (name: string): string | undefined => {
  const prefix = `--${name}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

type BackfillEntry = {
  projectId: string
  monthlyMeasurementId: string
  /** 分部工程标识，支持 boq_items.id 或 boq_items.code */
  sections: string[]
}

type BackfillConfig = { entries: BackfillEntry[] } | BackfillEntry[]

const readConfig = (configPath: string): BackfillEntry[] => {
  if (!fs.existsSync(configPath)) {
    throw new Error(`配置文件不存在：${configPath}`)
  }
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as BackfillConfig
  const entries = Array.isArray(raw) ? raw : raw.entries
  if (!Array.isArray(entries) || !entries.length) {
    throw new Error('配置文件中没有 entries，或 entries 为空')
  }
  for (const [index, entry] of entries.entries()) {
    if (!entry.projectId) throw new Error(`entries[${index}] 缺少 projectId`)
    if (!entry.monthlyMeasurementId) {
      throw new Error(`entries[${index}] 缺少 monthlyMeasurementId`)
    }
    if (!Array.isArray(entry.sections) || !entry.sections.length) {
      throw new Error(`entries[${index}] 缺少 sections`)
    }
  }
  return entries
}

type BackfillSummary = {
  projectId: string
  monthlyMeasurementId: string
  baseDate: string
  roundName: string | null
  sections: string[]
  hitBoqItemCount: number
  matchedLeafItemCount: number
  investmentQtyTotal: number
  investmentAmountTotal: number
}

/** boq_items 上回填需要的字段子集 */
type BoqSectionRow = Pick<BoqItemRecord, 'id' | 'code' | 'name' | 'type' | 'parentId'>

const processEntry = async (params: {
  entry: BackfillEntry
  dryRun: boolean
  allowDuplicate: boolean
}): Promise<BackfillSummary> => {
  const { entry, dryRun, allowDuplicate } = params
  const { projectId, monthlyMeasurementId, sections } = entry

  const projectDb = await getProjectDbClient({ projectId })

  const measurement = await projectDb<MonthlyMeasurementRecord>(
    MonthlyMeasurements.name
  )
    .where('id', monthlyMeasurementId)
    .first()
  if (!measurement) {
    throw new Error(`月度验工不存在：${monthlyMeasurementId}`)
  }
  if (measurement.project_id !== projectId) {
    throw new Error(
      `月度验工 ${monthlyMeasurementId} 不属于项目 ${projectId}（实际为 ${measurement.project_id}）`
    )
  }
  if (measurement.approveStatus !== 'APPROVED') {
    throw new Error(
      `月度验工 ${monthlyMeasurementId} 当前状态为 ${
        measurement.approveStatus ?? '草稿'
      }，仅支持已审批通过的单据回填`
    )
  }
  const roundName = measurement.roundName ?? null
  if (roundName !== '0') {
    logger.warn(
      { monthlyMeasurementId, roundName },
      '月度验工期数不是 0，请确认是否确实要并入安全文明措施费'
    )
  }

  // 解析分部工程标识（id 或 code）
  const boqItems = await projectDb<BoqItemRecord>(BoqItems.name)
    .where('projectId', projectId)
    .select('id', 'code', 'name', 'type', 'parentId')

  const resolveSection = (identifier: string) =>
    boqItems.find((item) => item.id === identifier) ??
    boqItems.find((item) => item.code === identifier)

  const resolvedSections: BoqSectionRow[] = []
  const missing: string[] = []
  for (const identifier of sections) {
    const found = resolveSection(identifier)
    if (found) resolvedSections.push(found)
    else missing.push(identifier)
  }
  if (missing.length) {
    throw new Error(
      `以下分部工程在项目 ${projectId} 中找不到（可用 id 或 code）：${missing.join(
        ', '
      )}`
    )
  }

  const sectionIds = resolvedSections.map((item) => item.id)
  const safetyBoqItemIds = resolveSafetyMeasureBoqItemIds({ boqItems, sectionIds })

  const matchedItems = await projectDb<MonthlyMeasurementItemRecord>(
    MonthlyMeasurementItems.name
  )
    .where('measurementId', monthlyMeasurementId)
    .whereIn('boqItemId', Array.from(safetyBoqItemIds))
    .andWhere('isSummaryRow', false)
    .select('boqItemId', 'boqName', 'price', 'investmentQty')

  const investmentQtyTotal = matchedItems.reduce(
    (sum, row) => sum + Number(row.investmentQty ?? 0),
    0
  )
  // 回填后会进入安全文明措施费"累计完成数"的金额（口径：投资监理量 × 清单单价）
  const investmentAmountTotal = matchedItems.reduce(
    (sum, row) => sum + preciseMul(Number(row.investmentQty ?? 0), row.price ?? 0),
    0
  )

  if (!matchedItems.length) {
    throw new Error(
      `所选分部工程在月度验工 ${monthlyMeasurementId} 的明细中未匹配到任何叶子清单项，请检查分部工程是否正确`
    )
  }

  // 口径自检：历史单据的措施费数据必须填在「投资监理」列，否则回填金额不成立。
  // 干跑阶段就暴露，避免带着错误的 0 值跑进正式库。
  if (investmentAmountTotal === 0) {
    logger.warn(
      { monthlyMeasurementId, matchedLeafItemCount: matchedItems.length },
      '匹配到了清单项，但「投资监理」量合计为 0：历史数据可能不是填在投资监理列，请先与业务确认累计口径后再回填'
    )
  }

  // 重复计量拦截：同期若已存在手工安全文明措施费，回填会造成双计
  const conflicting = await projectDb<SafetyMeasureRecord>(SafetyMeasures.name)
    .where('project_id', projectId)
    .whereNull('sourceMeasurementId')
    .andWhere('baseDate', measurement.baseDate)
    .select('id', 'code', 'roundName')

  if (conflicting.length && !allowDuplicate) {
    throw new Error(
      `项目 ${projectId} 同期（baseDate=${measurement.baseDate}）已存在 ${
        conflicting.length
      } 张手工安全文明措施费（${conflicting
        .map((m) => m.code)
        .join(
          ', '
        )}），回填会造成重复计量。请业务先裁决口径，确认后加 --allow-duplicate 重跑。`
    )
  }

  const summary: BackfillSummary = {
    projectId,
    monthlyMeasurementId,
    baseDate: measurement.baseDate,
    roundName,
    sections: resolvedSections.map((item) => `${item.code} ${item.name}`),
    hitBoqItemCount: safetyBoqItemIds.size,
    matchedLeafItemCount: matchedItems.length,
    investmentQtyTotal,
    investmentAmountTotal
  }

  if (dryRun) {
    logger.info(summary, '[dry-run] 待回填的月度验工（未写库）')
    return summary
  }

  // 走与线上完全相同的入口函数，保证生成逻辑零差异
  // （sectionIdsOverride 用于绕过 includeSafetyMeasure 开关 —— 历史单据没有这个标记）
  const result = await syncSafetyMeasureFromMonthlyMeasurement({
    db: projectDb,
    measurementId: monthlyMeasurementId,
    status: 'APPROVED',
    sectionIdsOverride: sectionIds
  })

  logger.info({ ...summary, ...result }, '回填完成')
  return summary
}

const main = async () => {
  const dryRun = hasFlag('--dry-run')
  const allowDuplicate = hasFlag('--allow-duplicate')
  const configPath = getArgValue('config')

  if (!configPath) {
    throw new Error(
      '缺少参数 --config=<json 文件路径>。示例见 scripts/config/zeroRoundSafetyMeasureSections.example.json'
    )
  }

  const entries = readConfig(configPath)
  logger.info({ entryCount: entries.length, dryRun }, '开始回填 0 期安全文明措施费')

  const failures: Array<{ key: string; error: string }> = []
  const succeeded: string[] = []

  for (const entry of entries) {
    const key = `${entry.projectId}/${entry.monthlyMeasurementId}`
    try {
      await processEntry({ entry, dryRun, allowDuplicate })
      succeeded.push(key)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error({ key }, `回填失败：${message}`)
      failures.push({ key, error: message })
    }
  }

  logger.info(
    {
      dryRun,
      total: entries.length,
      succeeded: succeeded.length,
      failed: failures.length,
      failures: failures.map((f) => `${f.key}: ${f.error}`)
    },
    dryRun ? '干跑结束' : '回填结束'
  )

  if (failures.length) {
    process.exitCode = 1
  }
}

void main()
  .catch((err) => {
    logger.error(err, '回填 0 期安全文明措施费失败')
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      // getAllRegisteredDbs 始终包含主库，Region 模式下还包含各地域库
      const clients = await getAllRegisteredDbs()
      await Promise.all(clients.map((client) => client.destroy()))
    } catch (err) {
      logger.error(err, '关闭数据库连接失败')
    }
  })
