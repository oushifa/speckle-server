import type { Knex } from 'knex'

const measurementTable = 'monthly_measurements'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(measurementTable)
  if (hasTable) {
    await knex.schema.alterTable(measurementTable, (table) => {
      table.string('roundName').nullable()
      table.bigInteger('startDate').nullable()
      table.bigInteger('endDate').nullable()
      table.string('contractCode').nullable().defaultTo('')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(measurementTable)
  if (hasTable) {
    await knex.schema.alterTable(measurementTable, (table) => {
      table.dropColumn('roundName')
      table.dropColumn('startDate')
      table.dropColumn('endDate')
      table.dropColumn('contractCode')
    })
  }
}
