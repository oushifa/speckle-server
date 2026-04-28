import type { Knex } from 'knex'

const tableName = 'project_cost_summaries'
const columnName = 'currentMonthCompletedAmount'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return
  const hasColumn = await knex.schema.hasColumn(tableName, columnName)
  if (hasColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.decimal(columnName, 20, 2).notNullable().defaultTo(0)
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
