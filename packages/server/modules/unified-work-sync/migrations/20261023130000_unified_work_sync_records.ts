import type { Knex } from 'knex'

const recordsTable = 'unified_work_sync_records'

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(recordsTable)) return

  await knex.schema.createTable(recordsTable, (table) => {
    table.string('id', 10).primary()
    table.string('instanceId', 10).notNullable().index()
    table.string('taskId', 255).notNullable().unique()
    table.string('systemCode', 64).notNullable()
    table.integer('stepIndex').notNullable().defaultTo(0)
    table.string('approverId', 10).nullable().index()
    table.string('account', 255).nullable()
    // SUCCESS | FAILED
    table.string('status', 16).notNullable().index()
    table.string('errorType', 64).nullable()
    table.text('errorMessage').nullable()
    table.jsonb('errorDetail').nullable()
    table.integer('attempts').notNullable().defaultTo(1)
    table.timestamp('lastAttemptAt').notNullable().defaultTo(knex.fn.now())
    table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    table.index(
      ['instanceId', 'approverId', 'stepIndex'],
      'unified_work_sync_records_instance_approver_idx'
    )
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(recordsTable)
}
