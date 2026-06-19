import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasAmount = await knex.schema.hasColumn('boq_items', 'amount')
  if (!hasAmount) {
    await knex.schema.alterTable('boq_items', (table) => {
      table.decimal('amount', 18, 2).nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasAmount = await knex.schema.hasColumn('boq_items', 'amount')
  if (hasAmount) {
    await knex.schema.alterTable('boq_items', (table) => {
      table.dropColumn('amount')
    })
  }
}
