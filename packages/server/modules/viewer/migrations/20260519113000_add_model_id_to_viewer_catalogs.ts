import type { Knex } from 'knex'

const catalogsTable = 'viewer_catalogs'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(catalogsTable, (table) => {
    table.string('modelId').nullable().references('id').inTable('branches').onDelete('CASCADE')
  })

  await knex.schema.alterTable(catalogsTable, (table) => {
    table.index(['projectId', 'modelId'], 'viewer_catalogs_project_id_model_id_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(catalogsTable, (table) => {
    table.dropIndex(['projectId', 'modelId'], 'viewer_catalogs_project_id_model_id_idx')
    table.dropColumn('modelId')
  })
}
