import type { Knex } from 'knex'

const tableName = 'project_drawings'
const foldersTableName = 'model_folders'

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
      .string('folderId', 10)
      .nullable()
      .references('id')
      .inTable(foldersTableName)
      .onDelete('set null')
    table.string('name', 512).notNullable()
    table.string('blobId').notNullable()
    table.string('fileName').notNullable()
    table.string('fileType').notNullable()
    table.string('contentType').notNullable()
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

    table.index(['projectId', 'folderId', 'updatedAt'], 'project_drawings_project_folder_updated_at_idx')
    table.index(['projectId', 'updatedAt'], 'project_drawings_project_updated_at_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return
  await knex.schema.dropTable(tableName)
}

