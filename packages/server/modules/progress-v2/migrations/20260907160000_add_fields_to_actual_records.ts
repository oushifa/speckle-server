import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasActualTable = await knex.schema.hasTable(
    'project_progress_v2_actual_records'
  )
  if (hasActualTable) {
    await knex.schema.alterTable('project_progress_v2_actual_records', (table) => {
      table.timestamp('planStartDate', { precision: 3, useTz: true }).nullable()
      table.timestamp('planEndDate', { precision: 3, useTz: true }).nullable()
      table.string('componentCode').nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasActualTable = await knex.schema.hasTable(
    'project_progress_v2_actual_records'
  )
  if (hasActualTable) {
    await knex.schema.alterTable('project_progress_v2_actual_records', (table) => {
      table.dropColumn('componentCode')
      table.dropColumn('planEndDate')
      table.dropColumn('planStartDate')
    })
  }
}
