import type { Knex } from 'knex'

const tableName = 'blob_storage'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(tableName, (table) => {
    table.string('multipartUploadId').defaultTo(null)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn('multipartUploadId')
  })
}
