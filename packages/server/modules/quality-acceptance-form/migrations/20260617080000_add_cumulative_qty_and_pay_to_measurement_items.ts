import type { Knex } from 'knex'

const itemsTable = 'monthly_measurement_items'

export async function up(knex: Knex): Promise<void> {
  const hasItemsTable = await knex.schema.hasTable(itemsTable)
  if (hasItemsTable) {
    await knex.schema.alterTable(itemsTable, (table) => {
      table.float('lastCumulativeQty').nullable().defaultTo(0)
      table.float('yearlyCumulativeQty').nullable().defaultTo(0)
      table.float('lastCumulativePay').nullable().defaultTo(0)
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasItemsTable = await knex.schema.hasTable(itemsTable)
  if (hasItemsTable) {
    await knex.schema.alterTable(itemsTable, (table) => {
      table.dropColumn('lastCumulativeQty')
      table.dropColumn('yearlyCumulativeQty')
      table.dropColumn('lastCumulativePay')
    })
  }
}
