import type { Knex } from 'knex'

const tableName = 'project_progress_plan_files'
const projectCreatedAtIndex = 'project_progress_plan_files_project_created_at_idx'

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

    table.index(['projectId', 'createdAt'], projectCreatedAtIndex)
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  await knex.schema.dropTable(tableName)
}
