import type { Knex } from 'knex'

const fileUploadTableName = 'file_uploads'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(fileUploadTableName, (table) => {
    table.integer('progressPercent').defaultTo(null)
    table.string('progressPhase').defaultTo(null)
    table.string('progressMessage').defaultTo(null)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(fileUploadTableName, (table) => {
    table.dropColumn('progressMessage')
    table.dropColumn('progressPhase')
    table.dropColumn('progressPercent')
  })
}
