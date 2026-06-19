import type { Knex } from 'knex'

const streamsTable = 'streams'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(streamsTable, (table) => {
    table.string('projectGuid')
    table.string('bidSection')
    table.double('contractPrice')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(streamsTable, (table) => {
    table.dropColumn('projectGuid')
    table.dropColumn('bidSection')
    table.dropColumn('contractPrice')
  })
}
