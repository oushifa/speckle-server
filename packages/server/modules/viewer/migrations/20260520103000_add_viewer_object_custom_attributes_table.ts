import type { Knex } from 'knex'

const TABLE_NAME = 'viewer_object_custom_attributes'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.string('id', 10).primary()
    table.string('projectId').notNullable()
    table.string('modelId').notNullable()
    table.string('applicationId').notNullable()
    table.string('authorId').nullable()
    table.string('name').notNullable()
    table.text('value').notNullable()
    table.timestamp('createdAt').defaultTo(knex.fn.now()).notNullable()
    table.timestamp('updatedAt').defaultTo(knex.fn.now()).notNullable()

    table.index(['projectId', 'modelId', 'applicationId'], `${TABLE_NAME}_scope_idx`)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME)
}
