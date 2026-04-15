import type { Knex } from 'knex'

const tableName = 'quality_acceptance_forms'
const legacyColumn = 'BIMelement'
const newColumn = 'bimElements'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const [hasLegacyColumn, hasNewColumn] = await Promise.all([
    knex.schema.hasColumn(tableName, legacyColumn),
    knex.schema.hasColumn(tableName, newColumn)
  ])

  if (!hasNewColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      table.jsonb(newColumn).nullable()
    })
  }

  if (hasLegacyColumn) {
    await knex.raw(
      `
      UPDATE "${tableName}"
      SET "${newColumn}" = jsonb_build_object(
        'modelId', '',
        'bimIds', COALESCE(to_jsonb("${legacyColumn}"), '[]'::jsonb)
      )
      WHERE "${newColumn}" IS NULL
      AND "${legacyColumn}" IS NOT NULL
    `
    )

    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn(legacyColumn)
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const [hasLegacyColumn, hasNewColumn] = await Promise.all([
    knex.schema.hasColumn(tableName, legacyColumn),
    knex.schema.hasColumn(tableName, newColumn)
  ])

  if (!hasLegacyColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      table.specificType(legacyColumn, 'text[]').nullable()
    })
  }

  if (hasNewColumn) {
    await knex.raw(
      `
      UPDATE "${tableName}"
      SET "${legacyColumn}" = CASE
        WHEN "${newColumn}" IS NULL THEN NULL
        WHEN jsonb_typeof("${newColumn}" -> 'bimIds') = 'array'
          THEN ARRAY(
            SELECT jsonb_array_elements_text("${newColumn}" -> 'bimIds')
          )
        ELSE NULL
      END
      WHERE "${legacyColumn}" IS NULL
    `
    )

    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn(newColumn)
    })
  }
}
