import type { Knex } from 'knex'

/**
 * `project_id` 是外部查询接口（如 `by-component-codes`）的唯一过滤条件，
 * 但历史上只加了列没有加索引，导致每次查询都是整表扫描。
 *
 * 表单表是按项目切分的业务数据（量级远小于 objects），普通建索引即可，
 * 不需要 CONCURRENTLY。
 */
const tableName = 'quality_acceptance_forms'
const projectIdColumn = 'project_id'
const projectIdIndex = 'quality_acceptance_forms_project_id_idx'

const indexExists = async (
  knex: Knex,
  table: string,
  index: string
): Promise<boolean> => {
  const res = await knex.raw(
    `SELECT 1
       FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = ?
        AND indexname = ?`,
    [table, index]
  )
  return (res?.rows?.length ?? 0) > 0
}

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasColumn = await knex.schema.hasColumn(tableName, projectIdColumn)
  if (!hasColumn) return

  if (await indexExists(knex, tableName, projectIdIndex)) return

  await knex.schema.alterTable(tableName, (table) => {
    table.index([projectIdColumn], projectIdIndex)
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  if (!(await indexExists(knex, tableName, projectIdIndex))) return

  await knex.schema.alterTable(tableName, (table) => {
    table.dropIndex([projectIdColumn], projectIdIndex)
  })
}
