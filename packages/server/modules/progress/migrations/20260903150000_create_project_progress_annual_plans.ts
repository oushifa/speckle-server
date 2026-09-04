import type { Knex } from 'knex'

const annualPlansTable = 'project_progress_annual_plans'
const planFilesTable = 'project_progress_plan_files'
const planTasksTable = 'project_progress_plan_tasks'

export async function up(knex: Knex): Promise<void> {
  // 1. 创建年度计划主表
  const hasAnnualPlansTable = await knex.schema.hasTable(annualPlansTable)
  if (!hasAnnualPlansTable) {
    await knex.schema.createTable(annualPlansTable, (table) => {
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

  // 2. 为 project_progress_plan_files 增加 annualPlanId
  const hasPlanFilesTable = await knex.schema.hasTable(planFilesTable)
  if (hasPlanFilesTable) {
    const hasAnnualCol = await knex.schema.hasColumn(planFilesTable, 'annualPlanId')
    if (!hasAnnualCol) {
      await knex.schema.alterTable(planFilesTable, (table) => {
        table
          .string('annualPlanId', 10)
          .nullable()
          .references('id')
          .inTable(annualPlansTable)
          .onDelete('cascade')
        table.index(['projectId', 'annualPlanId'])
      })
    }
  }

  // 3. 为 project_progress_plan_tasks 增加 annualPlanId
  const hasPlanTasksTable = await knex.schema.hasTable(planTasksTable)
  if (hasPlanTasksTable) {
    const hasAnnualCol = await knex.schema.hasColumn(planTasksTable, 'annualPlanId')
    if (!hasAnnualCol) {
      await knex.schema.alterTable(planTasksTable, (table) => {
        table
          .string('annualPlanId', 10)
          .nullable()
          .references('id')
          .inTable(annualPlansTable)
          .onDelete('cascade')
        table.index(['projectId', 'annualPlanId'])
      })
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasPlanTasksTable = await knex.schema.hasTable(planTasksTable)
  if (hasPlanTasksTable) {
    const hasAnnualCol = await knex.schema.hasColumn(planTasksTable, 'annualPlanId')
    if (hasAnnualCol) {
      await knex.schema.alterTable(planTasksTable, (table) => {
        table.dropColumn('annualPlanId')
      })
    }
  }

  const hasPlanFilesTable = await knex.schema.hasTable(planFilesTable)
  if (hasPlanFilesTable) {
    const hasAnnualCol = await knex.schema.hasColumn(planFilesTable, 'annualPlanId')
    if (hasAnnualCol) {
      await knex.schema.alterTable(planFilesTable, (table) => {
        table.dropColumn('annualPlanId')
      })
    }
  }

  const hasAnnualPlansTable = await knex.schema.hasTable(annualPlansTable)
  if (hasAnnualPlansTable) {
    await knex.schema.dropTable(annualPlansTable)
  }
}
