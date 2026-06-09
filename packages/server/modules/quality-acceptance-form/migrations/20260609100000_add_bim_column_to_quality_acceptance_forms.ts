import type { Knex } from 'knex'

const tableName = 'quality_acceptance_forms'
const column = 'BIM'

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(tableName, column)
  if (hasColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.jsonb(column).nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(tableName, column)
  if (!hasColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(column)
  })
}
