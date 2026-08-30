import type { Knex } from 'knex'

const routesTable = 'roaming_routes'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(routesTable)
  if (hasTable) {
    const hasColumn = await knex.schema.hasColumn(routesTable, 'modelId')
    if (!hasColumn) {
      await knex.schema.alterTable(routesTable, (table) => {
        table
          .string('modelId')
          .nullable()
          .references('id')
          .inTable('branches')
          .onDelete('CASCADE')
      })
      await knex.schema.alterTable(routesTable, (table) => {
        table.index(['projectId', 'modelId'], 'roaming_routes_project_id_model_id_idx')
      })
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(routesTable)
  if (hasTable) {
    const hasColumn = await knex.schema.hasColumn(routesTable, 'modelId')
    if (hasColumn) {
      await knex.schema.alterTable(routesTable, (table) => {
        table.dropIndex(
          ['projectId', 'modelId'],
          'roaming_routes_project_id_model_id_idx'
        )
        table.dropColumn('modelId')
      })
    }
  }
}
