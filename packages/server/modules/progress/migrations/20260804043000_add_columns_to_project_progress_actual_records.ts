import type { Knex } from 'knex'

const tableName = 'project_progress_actual_records'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (hasTable) {
    await knex.schema.alterTable(tableName, (table) => {
      table.string('yearMonth').nullable()
      table.jsonb('tasks').nullable()
      table.jsonb('workers').nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (hasTable) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn('yearMonth')
      table.dropColumn('tasks')
      table.dropColumn('workers')
    })
  }
}
