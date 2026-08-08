import type { Knex } from 'knex'

const tableName = 'project_model_sync_tasks'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasProgressPercent = await knex.schema.hasColumn(tableName, 'progressPercent')
  const hasProgressPhase = await knex.schema.hasColumn(tableName, 'progressPhase')
  const hasProgressMessage = await knex.schema.hasColumn(tableName, 'progressMessage')

  if (hasProgressPercent && hasProgressPhase && hasProgressMessage) return

  await knex.schema.alterTable(tableName, (table) => {
    if (!hasProgressPercent) {
      table.decimal('progressPercent', 5, 2).nullable()
    }
    if (!hasProgressPhase) {
      table.string('progressPhase', 128).nullable()
    }
    if (!hasProgressMessage) {
      table.text('progressMessage').nullable()
    }
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasProgressPercent = await knex.schema.hasColumn(tableName, 'progressPercent')
  const hasProgressPhase = await knex.schema.hasColumn(tableName, 'progressPhase')
  const hasProgressMessage = await knex.schema.hasColumn(tableName, 'progressMessage')

  if (!hasProgressPercent && !hasProgressPhase && !hasProgressMessage) return

  await knex.schema.alterTable(tableName, (table) => {
    if (hasProgressPercent) {
      table.dropColumn('progressPercent')
    }
    if (hasProgressPhase) {
      table.dropColumn('progressPhase')
    }
    if (hasProgressMessage) {
      table.dropColumn('progressMessage')
    }
  })
}
