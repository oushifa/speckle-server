import type { Knex } from 'knex'

const tableName = 'project_progress_plan_tasks'
const columnName = 'sysTaskId'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasColumn = await knex.schema.hasColumn(tableName, columnName)
  if (hasColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.string(columnName).nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasColumn = await knex.schema.hasColumn(tableName, columnName)
  if (!hasColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName)
  })
}
