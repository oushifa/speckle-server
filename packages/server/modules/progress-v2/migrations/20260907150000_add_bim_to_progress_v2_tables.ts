import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. project_progress_v2_plan_tasks 增加 BIM
  const hasPlanTasksTable = await knex.schema.hasTable('project_progress_v2_plan_tasks')
  if (hasPlanTasksTable) {
    const hasBim = await knex.schema.hasColumn('project_progress_v2_plan_tasks', 'BIM')
    if (!hasBim) {
      await knex.schema.alterTable('project_progress_v2_plan_tasks', (table) => {
        table.jsonb('BIM').nullable()
      })
    }
  }

  // 2. project_progress_v2_annual_plan_tasks 增加 BIM
  const hasAnnualTasksTable = await knex.schema.hasTable(
    'project_progress_v2_annual_plan_tasks'
  )
  if (hasAnnualTasksTable) {
    const hasBim = await knex.schema.hasColumn(
      'project_progress_v2_annual_plan_tasks',
      'BIM'
    )
    if (!hasBim) {
      await knex.schema.alterTable('project_progress_v2_annual_plan_tasks', (table) => {
        table.jsonb('BIM').nullable()
      })
    }
  }

  // 3. project_progress_v2_actual_records 增加 BIM
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

  const hasAnnualTasksTable = await knex.schema.hasTable(
    'project_progress_v2_annual_plan_tasks'
  )
  if (hasAnnualTasksTable) {
    const hasBim = await knex.schema.hasColumn(
      'project_progress_v2_annual_plan_tasks',
      'BIM'
    )
    if (hasBim) {
      await knex.schema.alterTable('project_progress_v2_annual_plan_tasks', (table) => {
        table.dropColumn('BIM')
      })
    }
  }

  const hasPlanTasksTable = await knex.schema.hasTable('project_progress_v2_plan_tasks')
  if (hasPlanTasksTable) {
    const hasBim = await knex.schema.hasColumn('project_progress_v2_plan_tasks', 'BIM')
    if (hasBim) {
      await knex.schema.alterTable('project_progress_v2_plan_tasks', (table) => {
        table.dropColumn('BIM')
      })
    }
  }
}
