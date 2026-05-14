import type { Knex } from 'knex'

const tableName = 'project_progress_plan_tasks'
const projectSortOrderIndex = 'project_progress_plan_tasks_project_sort_order_idx'
const projectParentIndex = 'project_progress_plan_tasks_project_parent_idx'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (hasTable) return

  await knex.schema.createTable(tableName, (table) => {
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
      .inTable('project_progress_plan_files')
      .onDelete('set null')
    table.string('externalId').nullable()
    table.string('wbs').nullable()
    table.string('name').notNullable()
    table.string('parentId', 10).nullable()
    table.integer('level').notNullable().defaultTo(0)
    table.integer('sortOrder').notNullable().defaultTo(0)
    table.string('duration').nullable()
    table.timestamp('planStart', { precision: 3, useTz: true }).nullable()
    table.timestamp('planEnd', { precision: 3, useTz: true }).nullable()
    table.string('predecessor').nullable()
    table.string('inspectionBatch').nullable()
    table.jsonb('bimElements').nullable()
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

    table.index(['projectId', 'sortOrder'], projectSortOrderIndex)
    table.index(['projectId', 'parentId'], projectParentIndex)
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  await knex.schema.dropTable(tableName)
}
