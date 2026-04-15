import type { Knex } from 'knex'

const tableName = 'monthly_measurement_items'
const isSummaryRowColumn = 'isSummaryRow'
const sortIndexColumn = 'sortIndex'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasIsSummaryRow = await knex.schema.hasColumn(tableName, isSummaryRowColumn)
  if (!hasIsSummaryRow) {
    await knex.schema.alterTable(tableName, (table) => {
      table.boolean(isSummaryRowColumn).notNullable().defaultTo(false)
    })
  }

  const hasSortIndex = await knex.schema.hasColumn(tableName, sortIndexColumn)
  if (!hasSortIndex) {
    await knex.schema.alterTable(tableName, (table) => {
      table.integer(sortIndexColumn).notNullable().defaultTo(0)
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasSortIndex = await knex.schema.hasColumn(tableName, sortIndexColumn)
  if (hasSortIndex) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn(sortIndexColumn)
    })
  }

  const hasIsSummaryRow = await knex.schema.hasColumn(tableName, isSummaryRowColumn)
  if (hasIsSummaryRow) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn(isSummaryRowColumn)
    })
  }
}
