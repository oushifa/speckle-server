import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. project_progress_v2_plan_files: 总进度计划文件表
  const hasPlanFiles = await knex.schema.hasTable('project_progress_v2_plan_files')
  if (!hasPlanFiles) {
    await knex.schema.createTable('project_progress_v2_plan_files', (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table.string('blobId').notNullable()
      table.string('fileName').notNullable()
      table.string('fileType').notNullable()
      table.bigInteger('fileSize').nullable()
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

      table.index(['projectId', 'createdAt'])
    })
  }

  // 2. project_progress_v2_plan_tasks: 总进度计划任务表
  const hasPlanTasks = await knex.schema.hasTable('project_progress_v2_plan_tasks')
  if (!hasPlanTasks) {
    await knex.schema.createTable('project_progress_v2_plan_tasks', (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table
        .string('planFileId', 10)
        .nullable()
        .references('id')
        .inTable('project_progress_v2_plan_files')
        .onDelete('set null')
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

      table.index(['projectId', 'sortOrder'])
      table.index(['projectId', 'parentId'])
    })
  }

  // 3. project_progress_v2_annual_plans: 年度计划主表
  const hasAnnualPlans = await knex.schema.hasTable('project_progress_v2_annual_plans')
  if (!hasAnnualPlans) {
    await knex.schema.createTable('project_progress_v2_annual_plans', (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table.integer('year').notNullable()
      table.string('name').notNullable()
      table.timestamp('startDate', { precision: 3, useTz: true }).notNullable()
      table.timestamp('endDate', { precision: 3, useTz: true }).notNullable()
      table.string('preparedBy').nullable()
      table.string('blobId').nullable()
      table.string('fileName').nullable()
      table.bigInteger('fileSize').nullable()
      table.text('remark').nullable()
      table.string('createdBy').notNullable()
      table
        .timestamp('createdAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table
        .timestamp('updatedAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())

      table.index(['projectId', 'year'])
    })
  }

  // 4. project_progress_v2_annual_plan_tasks: 年度计划任务表
  const hasAnnualTasks = await knex.schema.hasTable('project_progress_v2_annual_plan_tasks')
  if (!hasAnnualTasks) {
    await knex.schema.createTable('project_progress_v2_annual_plan_tasks', (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table
        .string('annualPlanId', 10)
        .notNullable()
        .references('id')
        .inTable('project_progress_v2_annual_plans')
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

      table.index(['projectId', 'annualPlanId'])
      table.index(['annualPlanId', 'sortOrder'])
    })
  }

  // 5. project_progress_v2_monthly_plans: 月度计划表
  const hasMonthlyPlans = await knex.schema.hasTable('project_progress_v2_monthly_plans')
  if (!hasMonthlyPlans) {
    await knex.schema.createTable('project_progress_v2_monthly_plans', (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table.string('yearMonth', 7).notNullable() // e.g. "2026-09"
      table.string('title').nullable()
      table.text('remark').nullable()
      table.jsonb('tasks').nullable().defaultTo('[]') // 包含自主添加的任务数组
      table.string('createdBy').notNullable()
      table
        .timestamp('createdAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table
        .timestamp('updatedAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())

      table.unique(['projectId', 'yearMonth'])
    })
  }

  // 6. project_progress_v2_actual_records: 进度管理实际填报记录表
  const hasActualRecords = await knex.schema.hasTable('project_progress_v2_actual_records')
  if (!hasActualRecords) {
    await knex.schema.createTable('project_progress_v2_actual_records', (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table.string('taskName').notNullable()
      table.string('sectionName').nullable()
      table.string('reportDate', 10).notNullable()
      table.timestamp('actualStartDate', { precision: 3, useTz: true }).nullable()
      table.timestamp('actualEndDate', { precision: 3, useTz: true }).nullable()
      table.integer('progressPercent').notNullable().defaultTo(0)
      table.string('weather').nullable()
      table.string('highTemperature').nullable()
      table.string('lowTemperature').nullable()
      table.text('constructionRecord').nullable()
      table.text('qualityRecord').nullable()
      table.text('safetyRecord').nullable()
      table.string('reporter').nullable()
      table.text('remark').nullable()
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

      table.index(['projectId', 'reportDate'])
      table.index(['projectId', 'updatedAt'])
    })
  }

  // 7. project_progress_v2_milestones: 里程碑表
  const hasMilestones = await knex.schema.hasTable('project_progress_v2_milestones')
  if (!hasMilestones) {
    await knex.schema.createTable('project_progress_v2_milestones', (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table.string('taskName').notNullable()
      table.timestamp('plannedStart', { precision: 3, useTz: true }).nullable()
      table.timestamp('plannedEnd', { precision: 3, useTz: true }).nullable()
      table.timestamp('actualStart', { precision: 3, useTz: true }).nullable()
      table.timestamp('actualEnd', { precision: 3, useTz: true }).nullable()
      table.string('status', 30).notNullable().defaultTo('未开始') // 未开始、进行中、按期完成、逾期完成、已逾期
      table.string('milestoneType', 30).nullable().defaultTo('phase') // project, phase, inspection
      table.string('responsible').nullable()
      table.text('remark').nullable()
      table.jsonb('tags').nullable().defaultTo('["milestone"]')
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

      table.index(['projectId', 'status'])
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('project_progress_v2_milestones')
  await knex.schema.dropTableIfExists('project_progress_v2_actual_records')
  await knex.schema.dropTableIfExists('project_progress_v2_monthly_plans')
  await knex.schema.dropTableIfExists('project_progress_v2_annual_plan_tasks')
  await knex.schema.dropTableIfExists('project_progress_v2_annual_plans')
  await knex.schema.dropTableIfExists('project_progress_v2_plan_tasks')
  await knex.schema.dropTableIfExists('project_progress_v2_plan_files')
}
