import type { Knex } from 'knex'

const tableName = 'quality_acceptance_forms'
const projectIdColumn = 'project_id'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasProjectIdColumn = await knex.schema.hasColumn(tableName, projectIdColumn)
  if (hasProjectIdColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.string(projectIdColumn).nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasProjectIdColumn = await knex.schema.hasColumn(tableName, projectIdColumn)
  if (!hasProjectIdColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(projectIdColumn)
  })
}
