import type { Knex } from 'knex'

const tableName = 'quality_acceptance_forms'
const attachmentsColumn = 'attachments'
const creatorColumn = 'creator'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasAttachmentsColumn = await knex.schema.hasColumn(tableName, attachmentsColumn)
  const hasCreatorColumn = await knex.schema.hasColumn(tableName, creatorColumn)

  if (!hasAttachmentsColumn || !hasCreatorColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      if (!hasAttachmentsColumn) {
        table.specificType(attachmentsColumn, 'text[]').nullable()
      }
      if (!hasCreatorColumn) {
        table.string(creatorColumn).nullable()
      }
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasAttachmentsColumn = await knex.schema.hasColumn(tableName, attachmentsColumn)
  const hasCreatorColumn = await knex.schema.hasColumn(tableName, creatorColumn)

  if (!hasAttachmentsColumn && !hasCreatorColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    if (hasAttachmentsColumn) {
      table.dropColumn(attachmentsColumn)
    }
    if (hasCreatorColumn) {
      table.dropColumn(creatorColumn)
    }
  })
}
