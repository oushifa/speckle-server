import type { Knex } from 'knex'

const tableName = 'project_model_sync_tasks'

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
      .string('modelId', 10)
      .notNullable()
      .references('id')
      .inTable('branches')
      .onDelete('cascade')
    table.string('fileId', 10).nullable()
    table.string('fileUploadId', 10).nullable()
    table.string('versionId', 10).nullable()
    table.string('fileName', 512).notNullable()
    table.string('fileType').nullable()
    table.bigInteger('fileSize').nullable()
    table.string('status', 64).notNullable()
    table.string('seedId').nullable()
    table.string('assetId').nullable()
    table.string('assetName').nullable()
    table.string('transformTaskId').nullable()
    table.text('error').nullable()
    table.string('creator', 10).notNullable()
    table.string('updater', 10).notNullable()
    table
      .timestamp('createdAt', { precision: 3, useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
    table
      .timestamp('updatedAt', { precision: 3, useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())

    table.index(['projectId', 'modelId', 'createdAt'], 'project_model_sync_tasks_project_model_created_at_idx')
    table.index(['projectId', 'modelId', 'status'], 'project_model_sync_tasks_project_model_status_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  await knex.schema.dropTable(tableName)
}
