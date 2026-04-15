import type { Knex } from 'knex'

const tableName = 'quality_acceptance_forms'
const boqItemIdColumn = 'boqItemId'
const boqItemIdIndex = 'quality_acceptance_forms_boq_item_id_idx'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasBoqItemIdColumn = await knex.schema.hasColumn(tableName, boqItemIdColumn)
  let didCreateColumn = false
  if (!hasBoqItemIdColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      table.string(boqItemIdColumn, 10).nullable()
    })
    didCreateColumn = true
  }

  if (didCreateColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      table.index([boqItemIdColumn], boqItemIdIndex)
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasBoqItemIdColumn = await knex.schema.hasColumn(tableName, boqItemIdColumn)
  if (!hasBoqItemIdColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(boqItemIdColumn)
  })
}
