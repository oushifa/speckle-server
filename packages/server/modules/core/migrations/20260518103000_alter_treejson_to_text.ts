import type { Knex } from 'knex'

const commitsTableName = 'commits'
const treeJsonColumnName = 'treeJson'

export async function up(knex: Knex): Promise<void> {
  const hasTreeJson = await knex.schema.hasColumn(commitsTableName, treeJsonColumnName)
  if (!hasTreeJson) return

  const columnInfo = await getTreeJsonColumnInfo(knex)
  const column = columnInfo?.[0]
  if (!column || column.udt_name === 'text') return

  await knex.schema.raw(
    `ALTER TABLE "${commitsTableName}" ALTER COLUMN "${treeJsonColumnName}" TYPE text;`
  )
}

export async function down(knex: Knex): Promise<void> {
  const hasTreeJson = await knex.schema.hasColumn(commitsTableName, treeJsonColumnName)
  if (!hasTreeJson) return

  const columnInfo = await getTreeJsonColumnInfo(knex)
  const column = columnInfo?.[0]
  if (!column || column.udt_name === 'varchar') return

  await knex.schema.raw(
    `ALTER TABLE "${commitsTableName}" ALTER COLUMN "${treeJsonColumnName}" TYPE varchar(255);`
  )
}

const getTreeJsonColumnInfo = (knex: Knex) =>
  knex('information_schema.columns')
    .select('udt_name')
    .whereRaw('table_name = ? and column_name = ?', [
      commitsTableName,
      treeJsonColumnName
    ])
