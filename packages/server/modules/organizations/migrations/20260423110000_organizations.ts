import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('departments', (table) => {
    table.string('id', 10).notNullable().primary()
    table.string('name', 512).notNullable()
    table
      .string('parentId', 10)
      .nullable()
      .references('id')
      .inTable('departments')
      .onDelete('cascade')
    table.string('path', 4096).notNullable()
    table
      .timestamp('createdAt', { precision: 3, useTz: true })
      .defaultTo(knex.fn.now())
      .notNullable()
    table
      .timestamp('updatedAt', { precision: 3, useTz: true })
      .defaultTo(knex.fn.now())
      .notNullable()
    table.index(['parentId'])
    table.unique(['parentId', 'name'])
  })

  await knex.schema.createTable('department_members', (table) => {
    table
      .string('departmentId', 10)
      .notNullable()
      .references('id')
      .inTable('departments')
      .onDelete('cascade')
    table
      .string('userId', 10)
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('cascade')
    table.string('title', 256).nullable()
    table
      .timestamp('createdAt', { precision: 3, useTz: true })
      .defaultTo(knex.fn.now())
      .notNullable()
    table
      .timestamp('updatedAt', { precision: 3, useTz: true })
      .defaultTo(knex.fn.now())
      .notNullable()
    table.primary(['departmentId', 'userId'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('department_members')
  await knex.schema.dropTableIfExists('departments')
}
