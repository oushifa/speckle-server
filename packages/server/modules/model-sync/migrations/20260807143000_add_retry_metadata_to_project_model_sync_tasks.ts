import type { Knex } from 'knex'

const tableName = 'project_model_sync_tasks'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasErrorCode = await knex.schema.hasColumn(tableName, 'errorCode')
  const hasRetriable = await knex.schema.hasColumn(tableName, 'retriable')
  const hasRetryCount = await knex.schema.hasColumn(tableName, 'retryCount')

  if (!hasErrorCode || !hasRetriable || !hasRetryCount) {
    await knex.schema.alterTable(tableName, (table) => {
      if (!hasErrorCode) {
        table.string('errorCode', 128).nullable()
      }
      if (!hasRetriable) {
        table.boolean('retriable').notNullable().defaultTo(false)
      }
      if (!hasRetryCount) {
        table.integer('retryCount').notNullable().defaultTo(0)
      }
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasErrorCode = await knex.schema.hasColumn(tableName, 'errorCode')
  const hasRetriable = await knex.schema.hasColumn(tableName, 'retriable')
  const hasRetryCount = await knex.schema.hasColumn(tableName, 'retryCount')

  if (!hasErrorCode && !hasRetriable && !hasRetryCount) return

  await knex.schema.alterTable(tableName, (table) => {
    if (hasErrorCode) {
      table.dropColumn('errorCode')
    }
    if (hasRetriable) {
      table.dropColumn('retriable')
    }
    if (hasRetryCount) {
      table.dropColumn('retryCount')
    }
  })
}
