import type { Knex } from 'knex'

const commitsTableName = 'commits'

export async function up(knex: Knex): Promise<void> {
  const hasAssetName = await knex.schema.hasColumn(commitsTableName, 'assetName')
  if (hasAssetName) return

  await knex.schema.alterTable(commitsTableName, (table) => {
    table.string('assetName').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasAssetName = await knex.schema.hasColumn(commitsTableName, 'assetName')
  if (!hasAssetName) return

  await knex.schema.alterTable(commitsTableName, (table) => {
    table.dropColumn('assetName')
  })
}
