import type { Knex } from 'knex'

const commitsTableName = 'commits'

export async function up(knex: Knex): Promise<void> {
  const hasTreeJson = await knex.schema.hasColumn(commitsTableName, 'treeJson')
  if (hasTreeJson) return

  await knex.schema.alterTable(commitsTableName, (table) => {
    table.string('treeJson').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTreeJson = await knex.schema.hasColumn(commitsTableName, 'treeJson')
  if (!hasTreeJson) return

  await knex.schema.alterTable(commitsTableName, (table) => {
    table.dropColumn('treeJson')
  })
}
