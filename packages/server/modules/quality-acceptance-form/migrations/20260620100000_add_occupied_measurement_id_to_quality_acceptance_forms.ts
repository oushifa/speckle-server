import type { Knex } from 'knex'

const qualityFormsTable = 'quality_acceptance_forms'
const monthlyMeasurementsTable = 'monthly_measurements'
const monthlyMeasurementItemsTable = 'monthly_measurement_items'

export async function up(knex: Knex): Promise<void> {
  // 1. 在 quality_acceptance_forms 中增加 occupiedMeasurementId 字段
  const hasQualityForms = await knex.schema.hasTable(qualityFormsTable)
  if (hasQualityForms) {
    const hasOccupiedCol = await knex.schema.hasColumn(qualityFormsTable, 'occupiedMeasurementId')
    if (!hasOccupiedCol) {
      await knex.schema.alterTable(qualityFormsTable, (table) => {
        table.string('occupiedMeasurementId', 10).nullable()
        table.index(['occupiedMeasurementId'], 'quality_forms_occupied_measurement_idx')
      })
    }
  }

  // 2. 在 monthly_measurements 中增加 safetyMeasureId 字段
  const hasMonthlyMeasurements = await knex.schema.hasTable(monthlyMeasurementsTable)
  if (hasMonthlyMeasurements) {
    const hasSafetyCol = await knex.schema.hasColumn(monthlyMeasurementsTable, 'safetyMeasureId')
    if (!hasSafetyCol) {
      await knex.schema.alterTable(monthlyMeasurementsTable, (table) => {
        table.string('safetyMeasureId', 10).nullable()
        table.index(['safetyMeasureId'], 'monthly_measurements_safety_measure_idx')
      })
    }
  }

  // 3. 补全历史已占用数据
  const hasItemsTable = await knex.schema.hasTable(monthlyMeasurementItemsTable)
  if (hasItemsTable && hasQualityForms) {
    const items = await knex(monthlyMeasurementItemsTable)
      .whereNotNull('sourceAcceptanceIds')
      .select('measurementId', 'sourceAcceptanceIds')
    
    for (const item of items) {
      if (Array.isArray(item.sourceAcceptanceIds) && item.sourceAcceptanceIds.length > 0) {
        await knex(qualityFormsTable)
          .whereIn('id', item.sourceAcceptanceIds)
          .update({
            occupiedMeasurementId: item.measurementId,
            updatedAt: new Date()
          })
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasQualityForms = await knex.schema.hasTable(qualityFormsTable)
  if (hasQualityForms) {
    const hasOccupiedCol = await knex.schema.hasColumn(qualityFormsTable, 'occupiedMeasurementId')
    if (hasOccupiedCol) {
      await knex.schema.alterTable(qualityFormsTable, (table) => {
        table.dropIndex(['occupiedMeasurementId'], 'quality_forms_occupied_measurement_idx')
        table.dropColumn('occupiedMeasurementId')
      })
    }
  }

  const hasMonthlyMeasurements = await knex.schema.hasTable(monthlyMeasurementsTable)
  if (hasMonthlyMeasurements) {
    const hasSafetyCol = await knex.schema.hasColumn(monthlyMeasurementsTable, 'safetyMeasureId')
    if (hasSafetyCol) {
      await knex.schema.alterTable(monthlyMeasurementsTable, (table) => {
        table.dropIndex(['safetyMeasureId'], 'monthly_measurements_safety_measure_idx')
        table.dropColumn('safetyMeasureId')
      })
    }
  }
}
