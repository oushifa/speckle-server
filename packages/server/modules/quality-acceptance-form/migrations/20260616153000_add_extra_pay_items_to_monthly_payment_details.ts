import type { Knex } from 'knex'

const tableName = 'monthly_payment_details'

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(tableName, 'extraPayItems')
  if (!hasColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      table.jsonb('extraPayItems').nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(tableName, 'extraPayItems')
  if (hasColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn('extraPayItems')
    })
  }
}

