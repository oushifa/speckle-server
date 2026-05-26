import type { Knex } from 'knex'

const commitsTableName = 'commits'

export async function up(knex: Knex): Promise<void> {
  const hasSeedId = await knex.schema.hasColumn(commitsTableName, 'seedId')
  const hasAssetId = await knex.schema.hasColumn(commitsTableName, 'assetId')

  if (!hasSeedId || !hasAssetId) {
    await knex.schema.alterTable(commitsTableName, (table) => {
      if (!hasSeedId) {
        table.string('seedId').nullable()
      }

      if (!hasAssetId) {
        table.string('assetId').nullable()
      }
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasSeedId = await knex.schema.hasColumn(commitsTableName, 'seedId')
  const hasAssetId = await knex.schema.hasColumn(commitsTableName, 'assetId')

  if (hasSeedId || hasAssetId) {
    await knex.schema.alterTable(commitsTableName, (table) => {
      if (hasSeedId) {
        table.dropColumn('seedId')
      }

      if (hasAssetId) {
        table.dropColumn('assetId')
      }
    })
  }
}
