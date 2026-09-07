import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasAnnualPlans = await knex.schema.hasTable('project_progress_v2_annual_plans')
  if (hasAnnualPlans) {
    const hasColumn = await knex.schema.hasColumn(
      'project_progress_v2_annual_plans',
      'attachments'
    )
    if (!hasColumn) {
      await knex.schema.alterTable('project_progress_v2_annual_plans', (table) => {
        table.jsonb('attachments').nullable()
      })
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasAnnualPlans = await knex.schema.hasTable('project_progress_v2_annual_plans')
  if (hasAnnualPlans) {
    const hasColumn = await knex.schema.hasColumn(
      'project_progress_v2_annual_plans',
      'attachments'
    )
    if (hasColumn) {
      await knex.schema.alterTable('project_progress_v2_annual_plans', (table) => {
        table.dropColumn('attachments')
      })
    }
  }
}
