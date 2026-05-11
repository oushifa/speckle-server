import type { Knex } from 'knex'

const catalogsTable = 'viewer_catalogs'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(catalogsTable, (table) => {
    table.string('id').notNullable().primary()
    table
      .string('projectId')
      .notNullable()
      .references('id')
      .inTable('streams')
      .onDelete('CASCADE')
    table
      .string('authorId')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL') // If the author is deleted, we keep the catalog but lose the author reference
    table.string('title').notNullable()
    table.jsonb('treeData').notNullable().defaultTo('[]')

    table
      .timestamp('createdAt', { precision: 3, useTz: true })
      .defaultTo(knex.fn.now())
      .notNullable()
    table
      .timestamp('updatedAt', { precision: 3, useTz: true })
      .defaultTo(knex.fn.now())
      .notNullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(catalogsTable)
}
