import type { Knex } from 'knex'

const tableName = 'project_drawings'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasConvertedBlobId = await knex.schema.hasColumn(tableName, 'convertedBlobId')
  const hasConversionStatus = await knex.schema.hasColumn(tableName, 'conversionStatus')
  const hasConversionError = await knex.schema.hasColumn(tableName, 'conversionError')

  if (hasConvertedBlobId && hasConversionStatus && hasConversionError) return

  await knex.schema.alterTable(tableName, (table) => {
    if (!hasConvertedBlobId) table.string('convertedBlobId').nullable()
    if (!hasConversionStatus) table.string('conversionStatus', 32).nullable()
    if (!hasConversionError) table.text('conversionError').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasConvertedBlobId = await knex.schema.hasColumn(tableName, 'convertedBlobId')
  const hasConversionStatus = await knex.schema.hasColumn(tableName, 'conversionStatus')
  const hasConversionError = await knex.schema.hasColumn(tableName, 'conversionError')

  if (!hasConvertedBlobId && !hasConversionStatus && !hasConversionError) return

  await knex.schema.alterTable(tableName, (table) => {
    if (hasConvertedBlobId) table.dropColumn('convertedBlobId')
    if (hasConversionStatus) table.dropColumn('conversionStatus')
    if (hasConversionError) table.dropColumn('conversionError')
  })
}
