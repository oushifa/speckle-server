import type { Knex } from 'knex'

const configsTable = 'alignment_configs'
const columnName = 'sectionBox'

export async function up(knex: Knex): Promise<void> {
  const hasConfigsTable = await knex.schema.hasTable(configsTable)
  if (!hasConfigsTable) return

  const hasColumn = await knex.schema.hasColumn(configsTable, columnName)
  if (hasColumn) return

  await knex.schema.alterTable(configsTable, (table) => {
    table.jsonb(columnName).nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasConfigsTable = await knex.schema.hasTable(configsTable)
  if (!hasConfigsTable) return

  const hasColumn = await knex.schema.hasColumn(configsTable, columnName)
  if (!hasColumn) return

  await knex.schema.alterTable(configsTable, (table) => {
    table.dropColumn(columnName)
  })
}
