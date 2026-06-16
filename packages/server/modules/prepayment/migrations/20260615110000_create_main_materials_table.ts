import type { Knex } from 'knex'

const tableName = 'main_materials'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) {
    await knex.schema.createTable(tableName, (table) => {
      table.string('id', 10).primary()
      table.string('projectId').notNullable()
      table.string('name').notNullable()
      table.string('specification').notNullable()
      table.string('unit').notNullable()
      table.float('referencePrice').notNullable()
      table.string('category').notNullable()
      table
        .timestamp('createdAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table
        .timestamp('updatedAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())

      table.index(['projectId'])
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return
  await knex.schema.dropTable(tableName)
}
