import type { Knex } from 'knex'

const tableName = 'quality_acceptance_forms'
const acceptanceContentColumn = 'acceptanceContent'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasAcceptanceContentColumn = await knex.schema.hasColumn(
    tableName,
    acceptanceContentColumn
  )
  if (hasAcceptanceContentColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.string(acceptanceContentColumn).nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasAcceptanceContentColumn = await knex.schema.hasColumn(
    tableName,
    acceptanceContentColumn
  )
  if (!hasAcceptanceContentColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(acceptanceContentColumn)
  })
}
