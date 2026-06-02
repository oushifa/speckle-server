import type { Knex } from 'knex'

const streamsTable = 'streams'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(streamsTable, (table) => {
    table.string('type').notNullable().defaultTo('project')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(streamsTable, (table) => {
    table.dropColumn('type')
  })
}

