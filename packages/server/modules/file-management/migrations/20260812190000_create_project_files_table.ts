import type { Knex } from 'knex'

const tableName = 'project_files'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) {
    await knex.schema.createTable(tableName, (table) => {
      table.string('id', 36).primary()
      table.string('projectId', 255).notNullable().index()
      table.string('modelId', 255).nullable().index()
      table.string('name', 255).notNullable()
      table.string('blobId', 255).nullable()
      table.bigInteger('fileSize').nullable()
      table.string('fileType', 100).nullable()
      table.string('source', 100).notNullable().defaultTo('MANUAL')
      table.string('category', 100).nullable()
      table.jsonb('customAttributes').nullable()
      table.text('description').nullable()
      table.string('uploaderId', 255).nullable()
      table.string('uploaderName', 255).nullable()
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
  const hasTable = await knex.schema.hasTable(tableName)
  if (hasTable) {
    await knex.schema.dropTable(tableName)
  }
}
