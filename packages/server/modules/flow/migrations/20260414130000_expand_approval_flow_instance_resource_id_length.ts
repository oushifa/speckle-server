import type { Knex } from 'knex'

const tableName = 'approval_flow_instances'
const resourceIdColumn = 'resourceId'
const originalLength = 10

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasColumn = await knex.schema.hasColumn(tableName, resourceIdColumn)
  if (!hasColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.text(resourceIdColumn).nullable().alter()
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasColumn = await knex.schema.hasColumn(tableName, resourceIdColumn)
  if (!hasColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.string(resourceIdColumn, originalLength).nullable().alter()
  })
}
