import type { Knex } from 'knex'

const mainTableName = 'project_progress_monthly_plans'
const taskTableName = 'project_progress_monthly_plan_tasks'

export async function up(knex: Knex): Promise<void> {
  // 1. Create main table
  const hasMainTable = await knex.schema.hasTable(mainTableName)
  if (!hasMainTable) {
    await knex.schema.createTable(mainTableName, (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table.string('yearMonth').notNullable()
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

  // 2. Create task table
  const hasTaskTable = await knex.schema.hasTable(taskTableName)
  if (!hasTaskTable) {
    await knex.schema.createTable(taskTableName, (table) => {
      table.string('id', 10).primary()
      table
        .string('monthlyPlanId', 10)
        .notNullable()
        .references('id')
        .inTable(mainTableName)
        .onDelete('cascade')
      table.string('taskName').notNullable()
      table.string('linkedPlanTaskId', 10).nullable()
      table.string('linkedPlanTaskName').nullable()
      table.timestamp('startDate', { precision: 3, useTz: true }).nullable()
      table.timestamp('endDate', { precision: 3, useTz: true }).nullable()
      table.string('totalVolume').nullable()
      table.string('unit').nullable()
      table.string('plannedVolume').nullable()
      table.string('actualVolume').nullable()
      table.integer('progressPercent').nullable().defaultTo(0)
      table.string('remark').nullable()
      table.integer('bimComponentCount').nullable().defaultTo(0)
      table.boolean('bimLinked').nullable().defaultTo(false)
      table.jsonb('selections').nullable()
      table
        .timestamp('createdAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table
        .timestamp('updatedAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTaskTable = await knex.schema.hasTable(taskTableName)
  if (hasTaskTable) {
    await knex.schema.dropTable(taskTableName)
  }

  const hasMainTable = await knex.schema.hasTable(mainTableName)
  if (hasMainTable) {
    await knex.schema.dropTable(mainTableName)
  }
}
