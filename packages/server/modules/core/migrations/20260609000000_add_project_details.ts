import type { Knex } from 'knex'

const streamsTable = 'streams'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(streamsTable, (table) => {
    table.string('projectNumber')
    table.string('constructionUnit')
    table.string('supervisionUnit')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(streamsTable, (table) => {
    table.dropColumn('projectNumber')
    table.dropColumn('constructionUnit')
    table.dropColumn('supervisionUnit')
  })
}
