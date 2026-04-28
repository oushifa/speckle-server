import type { Knex } from 'knex'

const tableName = 'project_cost_summaries'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (hasTable) return

  await knex.schema.createTable(tableName, (table) => {
    table
      .string('projectId', 10)
      .primary()
      .references('id')
      .inTable('streams')
      .onDelete('cascade')
    table.decimal('totalContractAmount', 20, 2).notNullable().defaultTo(0)
    table.decimal('completedAmount', 20, 2).notNullable().defaultTo(0)
    table
      .timestamp('lastRecalculatedAt', { precision: 3, useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
    table
      .timestamp('createdAt', { precision: 3, useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
    table
      .timestamp('updatedAt', { precision: 3, useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return
  await knex.schema.dropTable(tableName)
}
