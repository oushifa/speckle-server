import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasActualTable = await knex.schema.hasTable(
    'project_progress_v2_actual_records'
  )
  if (hasActualTable) {
    const hasBim = await knex.schema.hasColumn(
      'project_progress_v2_actual_records',
      'BIM'
    )
    if (!hasBim) {
      await knex.schema.alterTable('project_progress_v2_actual_records', (table) => {
        table.jsonb('BIM').nullable()
      })
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasActualTable = await knex.schema.hasTable(
    'project_progress_v2_actual_records'
  )
  if (hasActualTable) {
    const hasBim = await knex.schema.hasColumn(
      'project_progress_v2_actual_records',
      'BIM'
    )
    if (hasBim) {
      await knex.schema.alterTable('project_progress_v2_actual_records', (table) => {
        table.dropColumn('BIM')
      })
    }
  }
}
