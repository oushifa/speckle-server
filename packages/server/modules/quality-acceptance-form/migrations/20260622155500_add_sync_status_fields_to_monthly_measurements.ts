import type { Knex } from 'knex'

const tableName = 'monthly_measurements'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (hasTable) {
    await knex.schema.alterTable(tableName, (table) => {
      table.string('syncStatusSettlement', 20).notNullable().defaultTo('NONE')
      table.string('syncStatusPaymentDetail', 20).notNullable().defaultTo('NONE')
      table.string('syncStatusPaymentPool', 20).notNullable().defaultTo('NONE')
      
      table.text('syncErrorSettlement').nullable()
      table.text('syncErrorPaymentDetail').nullable()
      table.text('syncErrorPaymentPool').nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (hasTable) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn('syncStatusSettlement')
      table.dropColumn('syncStatusPaymentDetail')
      table.dropColumn('syncStatusPaymentPool')
      
      table.dropColumn('syncErrorSettlement')
      table.dropColumn('syncErrorPaymentDetail')
      table.dropColumn('syncErrorPaymentPool')
    })
  }
}
