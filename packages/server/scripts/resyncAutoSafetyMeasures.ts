/**
 * 可选的一次性订正：把"由月度验工自动生成"的安全文明措施费的 baseDate
 * 重算为"北京时间当月月初"，与手工单据的口径对齐。
 *
 * 背景：
 *  早期版本把隐藏记录的 baseDate 直接复制自月度验工（= 月末 23:59:59.999），
 *  而手工安全文明措施费存的是月初 00:00:00。
 *
 *  ⚠️ 注意：累计口径已改为"**自动生成的记录只要已通过就计入，不看 baseDate**"
 *  （见 rest/router.ts 累计段注释）。因此本脚本**不再是修复累计的必要步骤**，
 *  跑不跑都不影响累计金额；它的作用仅是让存量记录的 baseDate 与手工单据口径一致，
 *  以便将来做"按月份"的查询/报表时不会错位。
 *
 *  重跑是幂等的。
 *
 * 用法（在 packages/server 目录下）：
 *
 *   # 先干跑，核对每条的 baseDate 变化
 *   npx tsx --import ./esmLoader.js ./scripts/resyncAutoSafetyMeasures.ts \
 *     --project=<projectId> --dry-run
 *
 *   # 确认后正式执行
 *   npx tsx --import ./esmLoader.js ./scripts/resyncAutoSafetyMeasures.ts \
 *     --project=<projectId>
 *
 * 参数：
 *   --project=<id>  必填，要订正的项目 id
 *   --dry-run       只打印将要发生的变化，不写库
 */
import { logger } from '@/observability/logging'
import {
  getAllRegisteredDbs,
  getProjectDbClient
} from '@/modules/multiregion/utils/dbSelector'
import { syncSafetyMeasureFromMonthlyMeasurement } from '@/modules/quality-acceptance-form/services/safetyMeasureSync'

const hasFlag = (flag: string) => process.argv.includes(flag)

const getArgValue = (name: string): string | undefined => {
  const prefix = `--${name}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

const formatBaseDate = (value: unknown) => {
  const ms = Number(value)
  if (!Number.isFinite(ms)) return String(value)
  return `${ms} (北京时间 ${new Date(ms + 8 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19)})`
}

const main = async () => {
  const dryRun = hasFlag('--dry-run')
  const projectId = getArgValue('project')
  if (!projectId) {
    throw new Error('缺少参数 --project=<projectId>')
  }

  const db = await getProjectDbClient({ projectId })

  // 找出所有已生成隐藏记录的月度验工
  const rows = await db('safety_measures')
    .where('project_id', projectId)
    .whereNotNull('sourceMeasurementId')
    .select('id', 'code', 'baseDate', 'sourceMeasurementId')

  logger.info(
    { projectId, count: rows.length, dryRun },
    '待检查的自动生成安全文明措施费记录'
  )
  if (!rows.length) return

  for (const row of rows) {
    const source = await db('monthly_measurements')
      .where('id', row.sourceMeasurementId)
      .select('id', 'code', 'baseDate', 'approveStatus')
      .first()

    if (!source) {
      logger.warn(
        { safetyMeasureId: row.id, sourceMeasurementId: row.sourceMeasurementId },
        '找不到来源月度验工，跳过'
      )
      continue
    }

    const before = formatBaseDate(row.baseDate)

    if (dryRun) {
      logger.info(
        {
          code: row.code,
          sourceMeasurementCode: source.code,
          approveStatus: source.approveStatus,
          baseDateBefore: before
        },
        '[dry-run] 将按修复后的逻辑重算 baseDate（未写库）'
      )
      continue
    }

    const result = await syncSafetyMeasureFromMonthlyMeasurement({
      db,
      measurementId: row.sourceMeasurementId,
      status: 'APPROVED'
    })

    const after = await db('safety_measures')
      .where('id', result.safetyMeasureId ?? row.id)
      .select('baseDate')
      .first()

    logger.info(
      {
        code: row.code,
        action: result.action,
        itemCount: result.itemCount,
        baseDateBefore: before,
        baseDateAfter: formatBaseDate(after?.baseDate)
      },
      '订正完成'
    )
  }
}

void main()
  .catch((err) => {
    logger.error(err, '订正自动生成的安全文明措施费失败')
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      const clients = await getAllRegisteredDbs()
      await Promise.all(clients.map((client) => client.destroy()))
    } catch {
      // ignore
    }
  })
