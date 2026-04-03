import type { Knex } from 'knex'

const branchesTableName = 'branches'
const foldersTableName = 'model_folders'
const folderModelsTableName = 'model_folder_models'
const folderIdCol = 'folderId'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(folderModelsTableName, (table) => {
    table
      .string('folderId', 10)
      .notNullable()
      .references('id')
      .inTable(foldersTableName)
      .onDelete('cascade')
    table
      .string('modelId', 10)
      .notNullable()
      .references('id')
      .inTable(branchesTableName)
      .onDelete('cascade')
    table
      .string('streamId', 10)
      .notNullable()
      .references('id')
      .inTable('streams')
      .onDelete('cascade')
      .index()
    table.timestamp('createdAt').defaultTo(knex.fn.now())
    table.primary(['folderId', 'modelId'])
    table.unique(['streamId', 'folderId', 'modelId'], {
      indexName: 'model_folder_models_stream_folder_model_unique'
    })
  })

  const hasFolderId = await knex.schema.hasColumn(branchesTableName, folderIdCol)
  if (hasFolderId) {
    await knex.schema.raw(`
      INSERT INTO "${folderModelsTableName}" ("folderId", "modelId", "streamId")
      SELECT "${folderIdCol}", "id", "streamId"
      FROM "${branchesTableName}"
      WHERE "${folderIdCol}" IS NOT NULL
      ON CONFLICT ("folderId", "modelId") DO NOTHING
    `)

    await knex.schema.alterTable(branchesTableName, (table) => {
      table.dropColumn(folderIdCol)
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasFolderId = await knex.schema.hasColumn(branchesTableName, folderIdCol)

  if (!hasFolderId) {
    await knex.schema.alterTable(branchesTableName, (table) => {
      table
        .string(folderIdCol, 10)
        .nullable()
        .references('id')
        .inTable(foldersTableName)
        .onDelete('set null')
        .index()
    })
  }

  await knex.schema.raw(`
    UPDATE "${branchesTableName}" b
    SET "${folderIdCol}" = sq."folderId"
    FROM (
      SELECT "modelId", MIN("folderId") as "folderId"
      FROM "${folderModelsTableName}"
      GROUP BY "modelId"
    ) sq
    WHERE b."id" = sq."modelId"
  `)

  await knex.schema.dropTable(folderModelsTableName)
}
