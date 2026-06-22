import type { Knex } from 'knex'

const streamsTable = 'streams'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(streamsTable, (table) => {
    table.string('businessUnit').nullable()
    table.string('businessUnitName').nullable()
    table.string('companyId').nullable()
    table.string('companyName').nullable()
    table.string('projectPackageItemguid').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(streamsTable, (table) => {
    table.dropColumn('businessUnit')
    table.dropColumn('businessUnitName')
    table.dropColumn('companyId')
    table.dropColumn('companyName')
    table.dropColumn('projectPackageItemguid')
  })
}
