import type { Knex } from 'knex'

const folderTableName = 'model_folders'
const branchesTableName = 'branches'
const folderIdCol = 'folderId'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(folderTableName, (table) => {
    table.string('id', 10).primary()
    table
      .string('streamId', 10)
      .notNullable()
      .references('id')
      .inTable('streams')
      .onDelete('cascade')
      .index()
    table
      .string('parentFolderId', 10)
      .nullable()
      .references('id')
      .inTable(folderTableName)
      .onDelete('cascade')
      .index()
    table.string('name', 512).notNullable()
    table.timestamp('createdAt').defaultTo(knex.fn.now())
    table.timestamp('updatedAt').defaultTo(knex.fn.now())
    table.unique(['streamId', 'parentFolderId', 'name'], {
      indexName: 'model_folders_stream_parent_name_unique'
    })
  })

  await knex.schema.alterTable(branchesTableName, (table) => {
    table
      .string(folderIdCol, 10)
      .nullable()
      .references('id')
      .inTable(folderTableName)
      .onDelete('set null')
      .index()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(branchesTableName, (table) => {
    table.dropColumn(folderIdCol)
  })

  await knex.schema.dropTable(folderTableName)
}
