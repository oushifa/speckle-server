import type { Knex } from 'knex'

const tableName = 'quality_acceptance_forms'

/**
 * 修复历史数据：
 * 旧版删除月度验工时只清空了 occupiedMeasurementId，没有清空 approveStatus。
 * 送审/驳回/取消过的质量验收单因此会残留 START/PENDING/REJECTED/CANCELED
 * 状态：在列表里显示为“-”（未占用），但新建月度验工的预览只纳入
 * approveStatus 为空的质量验收单，导致这些单据无法再次被关联。
 *
 * 这里只修复“未占用且状态不是 APPROVED”的单据；已审批通过的单据保留
 * 原状态，避免丢失历史审批结果。
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const [hasOccupiedColumn, hasStatusColumn] = await Promise.all([
    knex.schema.hasColumn(tableName, 'occupiedMeasurementId'),
    knex.schema.hasColumn(tableName, 'approveStatus')
  ])
  if (!hasOccupiedColumn || !hasStatusColumn) return

  await knex(tableName)
    .whereNull('occupiedMeasurementId')
    .whereNotNull('approveStatus')
    .whereRaw('UPPER(TRIM(??)) <> ?', ['approveStatus', 'APPROVED'])
    .update({ approveStatus: null, updatedAt: new Date() })
}

export async function down(): Promise<void> {
  // 一次性数据修复，无法恢复原始状态
}
