import type { Knex } from 'knex'

const streamsTable = 'streams'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(streamsTable, (table) => {
    table.string('contractCode')
    table.string('contractName')
    table.string('employer')
    table.string('contractor')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(streamsTable, (table) => {
    table.dropColumn('contractCode')
    table.dropColumn('contractName')
    table.dropColumn('employer')
    table.dropColumn('contractor')
  })
}
