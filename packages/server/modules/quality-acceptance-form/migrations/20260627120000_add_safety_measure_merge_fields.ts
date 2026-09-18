import type { Knex } from 'knex'

const monthlyMeasurementsTable = 'monthly_measurements'
const monthlyMeasurementItemsTable = 'monthly_measurement_items'
const safetyMeasuresTable = 'safety_measures'
const autoSourceUniqueIndex = 'safety_measures_source_measurement_unique'

export async function up(knex: Knex): Promise<void> {
  // 1. monthly_measurements：0 期是否并入安全文明措施费 + 选中的分部工程
  if (await knex.schema.hasTable(monthlyMeasurementsTable)) {
    const hasIncludeCol = await knex.schema.hasColumn(
      monthlyMeasurementsTable,
      'includeSafetyMeasure'
    )
    if (!hasIncludeCol) {
      await knex.schema.alterTable(monthlyMeasurementsTable, (table) => {
        table.boolean('includeSafetyMeasure').notNullable().defaultTo(false)
        table.jsonb('safetySectionIds').nullable()
      })
    }
  }

  // 2. monthly_measurement_items：该清单项是否属于安全文明措施费
  if (await knex.schema.hasTable(monthlyMeasurementItemsTable)) {
    const hasFlagCol = await knex.schema.hasColumn(
      monthlyMeasurementItemsTable,
      'isSafetyMeasure'
    )
    if (!hasFlagCol) {
      await knex.schema.alterTable(monthlyMeasurementItemsTable, (table) => {
        table.boolean('isSafetyMeasure').notNullable().defaultTo(false)
        table.index(
          ['measurementId', 'isSafetyMeasure'],
          'monthly_measurement_items_safety_idx'
        )
      })
    }
  }

  // 3. safety_measures：标记"由月度验工自动生成"的隐藏单据
  if (await knex.schema.hasTable(safetyMeasuresTable)) {
    const hasSourceCol = await knex.schema.hasColumn(
      safetyMeasuresTable,
      'sourceMeasurementId'
    )
    if (!hasSourceCol) {
      await knex.schema.alterTable(safetyMeasuresTable, (table) => {
        table.string('sourceMeasurementId', 10).nullable()
      })

      // 一张月度验工最多生成一条隐藏记录，这是幂等写入的保证。
      // 必须是部分唯一索引：手工单据的 sourceMeasurementId 为 NULL，不参与约束。
      await knex.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS ${autoSourceUniqueIndex}
        ON ${safetyMeasuresTable} ("sourceMeasurementId")
        WHERE "sourceMeasurementId" IS NOT NULL
      `)
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(safetyMeasuresTable)) {
    const hasSourceCol = await knex.schema.hasColumn(
      safetyMeasuresTable,
      'sourceMeasurementId'
    )
    if (hasSourceCol) {
      await knex.raw(`DROP INDEX IF EXISTS ${autoSourceUniqueIndex}`)
      await knex.schema.alterTable(safetyMeasuresTable, (table) => {
        table.dropColumn('sourceMeasurementId')
      })
    }
  }

  if (await knex.schema.hasTable(monthlyMeasurementItemsTable)) {
    const hasFlagCol = await knex.schema.hasColumn(
      monthlyMeasurementItemsTable,
      'isSafetyMeasure'
    )
    if (hasFlagCol) {
      await knex.schema.alterTable(monthlyMeasurementItemsTable, (table) => {
        table.dropIndex(
          ['measurementId', 'isSafetyMeasure'],
          'monthly_measurement_items_safety_idx'
        )
        table.dropColumn('isSafetyMeasure')
      })
    }
  }

  if (await knex.schema.hasTable(monthlyMeasurementsTable)) {
    const hasIncludeCol = await knex.schema.hasColumn(
      monthlyMeasurementsTable,
      'includeSafetyMeasure'
    )
    if (hasIncludeCol) {
      await knex.schema.alterTable(monthlyMeasurementsTable, (table) => {
        table.dropColumn('includeSafetyMeasure')
        table.dropColumn('safetySectionIds')
      })
    }
  }
}
