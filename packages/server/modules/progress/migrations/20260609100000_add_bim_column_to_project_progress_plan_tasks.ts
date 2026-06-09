import type { Knex } from 'knex'

const tableName = 'project_progress_plan_tasks'

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(tableName, 'BIM')
  if (hasColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.jsonb('BIM').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(tableName, 'BIM')
  if (!hasColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn('BIM')
  })
}
