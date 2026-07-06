import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. 给 custom_roles 增加 specialties 和 sections JSONB 列，以便于以后拓展
  await knex.schema.alterTable('custom_roles', (table) => {
    table.jsonb('specialties').notNullable().defaultTo('[]')
    table.jsonb('sections').notNullable().defaultTo('[]')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('custom_roles', (table) => {
    table.dropColumn('specialties')
    table.dropColumn('sections')
  })
}
