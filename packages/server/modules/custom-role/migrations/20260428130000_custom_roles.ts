import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('custom_roles', (table) => {
    table.string('id', 10).notNullable().primary()
    table.string('name', 128).notNullable().unique()
    table.jsonb('menuPerms').notNullable().defaultTo('[]')
    table.jsonb('modelPerms').notNullable().defaultTo('[]')
    table.string('status', 32).notNullable().defaultTo('active')
    table
      .timestamp('createdAt', { precision: 3, useTz: true })
      .defaultTo(knex.fn.now())
      .notNullable()
    table
      .timestamp('updatedAt', { precision: 3, useTz: true })
      .defaultTo(knex.fn.now())
      .notNullable()
  })

  await knex.schema.createTable('custom_role_users', (table) => {
    table.string('id', 10).notNullable().primary()
    table
      .string('roleId', 10)
      .notNullable()
      .references('id')
      .inTable('custom_roles')
      .onDelete('cascade')
    table
      .string('userId', 10)
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('cascade')
      .unique()
    table.jsonb('menuPerms').notNullable().defaultTo('[]')
    table.jsonb('modelPerms').notNullable().defaultTo('[]')
    table.boolean('isCustomized').notNullable().defaultTo(false)
    table
      .timestamp('createdAt', { precision: 3, useTz: true })
      .defaultTo(knex.fn.now())
      .notNullable()
    table
      .timestamp('updatedAt', { precision: 3, useTz: true })
      .defaultTo(knex.fn.now())
      .notNullable()

    table.index(['roleId'])
    table.index(['userId'])
    table.unique(['roleId', 'userId'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('custom_role_users')
  await knex.schema.dropTableIfExists('custom_roles')
}
