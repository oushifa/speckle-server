import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasPhone = await knex.schema.hasColumn('users', 'phone')
  if (!hasPhone) {
    await knex.schema.alterTable('users', (table) => {
      table.string('phone', 32).nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasPhone = await knex.schema.hasColumn('users', 'phone')
  if (hasPhone) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('phone')
    })
  }
}
