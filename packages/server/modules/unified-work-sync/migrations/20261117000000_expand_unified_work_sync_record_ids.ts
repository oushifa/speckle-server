import type { Knex } from 'knex'

const recordsTable = 'unified_work_sync_records'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(recordsTable))) return

  await knex.schema.alterTable(recordsTable, (table) => {
    table.string('instanceId', 64).notNullable().alter()
    table.string('approverId', 32).nullable().alter()
  })
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(recordsTable))) return

  await knex.schema.alterTable(recordsTable, (table) => {
    table.string('instanceId', 10).notNullable().alter()
    table.string('approverId', 10).nullable().alter()
  })
}
