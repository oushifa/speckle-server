import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasMonthlyTable = await knex.schema.hasTable(
    'project_progress_v2_monthly_plans'
  )
  if (hasMonthlyTable) {
    await knex.schema.alterTable('project_progress_v2_monthly_plans', (table) => {
      table.timestamp('startDate', { precision: 3, useTz: true }).nullable()
      table.timestamp('endDate', { precision: 3, useTz: true }).nullable()
      table.string('preparedBy').nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasMonthlyTable = await knex.schema.hasTable(
    'project_progress_v2_monthly_plans'
  )
  if (hasMonthlyTable) {
    await knex.schema.alterTable('project_progress_v2_monthly_plans', (table) => {
      table.dropColumn('preparedBy')
      table.dropColumn('endDate')
      table.dropColumn('startDate')
    })
  }
}
