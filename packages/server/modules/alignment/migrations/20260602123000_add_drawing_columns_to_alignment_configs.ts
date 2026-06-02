import type { Knex } from 'knex'

const configsTable = 'alignment_configs'

const drawingColumns = [
  'modelId',
  'modelName',
  'versionId',
  'versionCreatedAt',
  'blobId',
  'fileName',
  'fileType',
  'fileSize'
] as const

export async function up(knex: Knex): Promise<void> {
  const hasConfigsTable = await knex.schema.hasTable(configsTable)
  if (!hasConfigsTable) return

  const hasModelId = await knex.schema.hasColumn(configsTable, 'modelId')
  const hasModelName = await knex.schema.hasColumn(configsTable, 'modelName')
  const hasVersionId = await knex.schema.hasColumn(configsTable, 'versionId')
  const hasVersionCreatedAt = await knex.schema.hasColumn(configsTable, 'versionCreatedAt')
  const hasBlobId = await knex.schema.hasColumn(configsTable, 'blobId')
  const hasFileName = await knex.schema.hasColumn(configsTable, 'fileName')
  const hasFileType = await knex.schema.hasColumn(configsTable, 'fileType')
  const hasFileSize = await knex.schema.hasColumn(configsTable, 'fileSize')

  await knex.schema.alterTable(configsTable, (table) => {
    if (!hasModelId) {
      table.string('modelId').nullable()
    }
    if (!hasModelName) {
      table.string('modelName').nullable()
    }
    if (!hasVersionId) {
      table.string('versionId').nullable()
    }
    if (!hasVersionCreatedAt) {
      table.timestamp('versionCreatedAt', { precision: 3, useTz: true }).nullable()
    }
    if (!hasBlobId) {
      table.string('blobId').nullable()
    }
    if (!hasFileName) {
      table.string('fileName').nullable()
    }
    if (!hasFileType) {
      table.string('fileType').nullable()
    }
    if (!hasFileSize) {
      table.bigInteger('fileSize').nullable()
    }
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasConfigsTable = await knex.schema.hasTable(configsTable)
  if (!hasConfigsTable) return

  const columnsToDrop: string[] = []
  for (const column of [...drawingColumns].reverse()) {
    if (await knex.schema.hasColumn(configsTable, column)) {
      columnsToDrop.push(column)
    }
  }

  if (!columnsToDrop.length) return

  await knex.schema.alterTable(configsTable, (table) => {
    for (const column of columnsToDrop) {
      table.dropColumn(column)
    }
  })
}
