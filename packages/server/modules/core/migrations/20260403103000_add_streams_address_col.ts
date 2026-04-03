import type { Knex } from 'knex'

const tableName = 'streams'
const colAddress = 'address'
const colProgress = 'progress'
const colStartDate = 'startDate'
const colEndDate = 'endDate'
const colResponsible = 'responsible'
const colStatus = 'status'
const colTimeZone = 'timeZone'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(tableName, (table) => {
    table.string(colAddress)
    table.integer(colProgress)
    table.bigint(colStartDate)
    table.bigint(colEndDate)
    table.string(colResponsible)
    table.string(colStatus)
    table.string(colTimeZone)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(colAddress)
    table.dropColumn(colProgress)
    table.dropColumn(colStartDate)
    table.dropColumn(colEndDate)
    table.dropColumn(colResponsible)
    table.dropColumn(colStatus)
    table.dropColumn(colTimeZone)
  })
}
