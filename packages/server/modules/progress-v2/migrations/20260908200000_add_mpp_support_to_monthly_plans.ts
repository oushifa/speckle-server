import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. project_progress_v2_monthly_plans 增加 blobId, fileName, fileSize
  const hasMonthlyTable = await knex.schema.hasTable(
    'project_progress_v2_monthly_plans'
  )
  if (hasMonthlyTable) {
    const hasBlobId = await knex.schema.hasColumn(
      'project_progress_v2_monthly_plans',
      'blobId'
    )
    if (!hasBlobId) {
      await knex.schema.alterTable('project_progress_v2_monthly_plans', (table) => {
        table.string('blobId').nullable()
        table.string('fileName').nullable()
        table.bigInteger('fileSize').nullable()
      })
    }
  }

  // 2. 创建 project_progress_v2_monthly_plan_tasks 表
  const hasMonthlyTasks = await knex.schema.hasTable(
    'project_progress_v2_monthly_plan_tasks'
  )
  if (!hasMonthlyTasks) {
    await knex.schema.createTable('project_progress_v2_monthly_plan_tasks', (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table
        .string('monthlyPlanId', 10)
        .notNullable()
        .references('id')
        .inTable('project_progress_v2_monthly_plans')
        .onDelete('cascade')
      table.string('externalId').nullable()
      table.string('sysTaskId').nullable()
      table.string('wbs').nullable()
      table.string('name').notNullable()
      table.string('parentId', 10).nullable()
      table.integer('level').notNullable().defaultTo(0)
      table.integer('sortOrder').notNullable().defaultTo(0)
      table.string('duration').nullable()
      table.timestamp('planStart', { precision: 3, useTz: true }).nullable()
      table.timestamp('planEnd', { precision: 3, useTz: true }).nullable()
      table.string('predecessor').nullable()
      table.string('quantity').nullable()
      table.string('unit').nullable()
      table.jsonb('BIM').nullable()
      table.string('creator').notNullable()
      table.string('updater').notNullable()
      table
        .timestamp('createdAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table
        .timestamp('updatedAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())

      table.index(['projectId', 'monthlyPlanId'])
      table.index(['monthlyPlanId', 'sortOrder'])
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasMonthlyTasks = await knex.schema.hasTable(
    'project_progress_v2_monthly_plan_tasks'
  )
  if (hasMonthlyTasks) {
    await knex.schema.dropTable('project_progress_v2_monthly_plan_tasks')
  }

  const hasMonthlyTable = await knex.schema.hasTable(
    'project_progress_v2_monthly_plans'
  )
  if (hasMonthlyTable) {
    const hasBlobId = await knex.schema.hasColumn(
      'project_progress_v2_monthly_plans',
      'blobId'
    )
    if (hasBlobId) {
      await knex.schema.alterTable('project_progress_v2_monthly_plans', (table) => {
        table.dropColumn('fileSize')
        table.dropColumn('fileName')
        table.dropColumn('blobId')
      })
    }
  }
}
