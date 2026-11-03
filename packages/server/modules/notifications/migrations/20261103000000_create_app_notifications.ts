import type { Knex } from 'knex'

const TABLE_NAME = 'app_notifications'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME)
  if (!hasTable) {
    await knex.schema.createTable(TABLE_NAME, (table) => {
      table.string('id', 36).primary()
      table.string('userId', 32).notNullable().index()
      table.string('projectId', 32).notNullable().index()
      table.string('title', 256).notNullable()
      table.text('content').notNullable().defaultTo('')
      table.string('targetUrl', 512).notNullable().defaultTo('')
      table.boolean('isRead').notNullable().defaultTo(false).index()
      table
        .timestamp('createdAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
        .index()
      table
        .timestamp('updatedAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())

      table.index(['userId', 'isRead', 'createdAt'])
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME)
}
