import type { Knex } from 'knex'

const routesTable = 'roaming_routes'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(routesTable)
  if (!hasTable) {
    await knex.schema.createTable(routesTable, (table) => {
      table.string('id', 36).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table.string('name').notNullable()
      table.string('mode', 32).notNullable().defaultTo('point')
      table.jsonb('points').notNullable().defaultTo('[]')
      table.boolean('loop').notNullable().defaultTo(false)
      table.decimal('speed', 3, 1).notNullable().defaultTo(1.0)
      table.decimal('eyeHeight', 4, 2).nullable().defaultTo(1.6)
      table.string('creator').nullable()
      table.string('updater').nullable()
      table
        .timestamp('createdAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table
        .timestamp('updatedAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())

      table.index(['projectId', 'updatedAt'], 'roaming_routes_project_updated_at_idx')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(routesTable)
  if (hasTable) {
    await knex.schema.dropTable(routesTable)
  }
}
