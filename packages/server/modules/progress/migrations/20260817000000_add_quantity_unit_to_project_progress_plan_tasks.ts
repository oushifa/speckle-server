import type { Knex } from 'knex'

const tableName = 'project_progress_plan_tasks'

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(tableName, 'quantity')
  if (!hasColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      table.string('quantity').nullable()
    })
  }

  const hasUnitColumn = await knex.schema.hasColumn(tableName, 'unit')
  if (!hasUnitColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      table.string('unit').nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(tableName, 'quantity')
  if (hasColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn('quantity')
    })
  }

  const hasUnitColumn = await knex.schema.hasColumn(tableName, 'unit')
  if (hasUnitColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn('unit')
    })
  }
}
