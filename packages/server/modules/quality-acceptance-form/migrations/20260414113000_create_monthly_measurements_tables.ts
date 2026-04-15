import type { Knex } from 'knex'

const measurementTable = 'monthly_measurements'
const measurementItemsTable = 'monthly_measurement_items'
const codeUniqueKey = 'monthly_measurements_project_code_unique'
const measurementProjectIndex = 'monthly_measurements_project_idx'
const measurementItemsMeasurementIndex = 'monthly_measurement_items_measurement_idx'
const measurementItemsBoqIndex = 'monthly_measurement_items_boq_idx'
const measurementItemsUnique = 'monthly_measurement_items_measurement_boq_unique'

export async function up(knex: Knex): Promise<void> {
  const hasMeasurementTable = await knex.schema.hasTable(measurementTable)
  if (!hasMeasurementTable) {
    await knex.schema.createTable(measurementTable, (table) => {
      table.string('id', 10).primary()
      table.string('project_id').notNullable()
      table.string('unit').nullable()
      table.string('code').notNullable()
      table.bigInteger('baseDate').notNullable()
      table.string('approveStatus').nullable()
      table.string('flowInstanceId', 10).nullable()
      table.string('creator').nullable()
      table
        .timestamp('createdAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table
        .timestamp('updatedAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())

      table.unique(['project_id', 'code'], codeUniqueKey)
      table.index(['project_id'], measurementProjectIndex)
    })
  }

  const hasMeasurementItemsTable = await knex.schema.hasTable(measurementItemsTable)
  if (!hasMeasurementItemsTable) {
    await knex.schema.createTable(measurementItemsTable, (table) => {
      table.string('id', 10).primary()
      table.string('measurementId', 10).notNullable()
      table.string('boqItemId', 10).notNullable()
      table.string('boqCode').nullable()
      table.string('boqName').nullable()
      table.string('boqParentId', 10).nullable()
      table.integer('boqDepth').notNullable().defaultTo(0)
      table.boolean('isSummaryRow').notNullable().defaultTo(false)
      table.integer('sortIndex').notNullable().defaultTo(0)
      table.string('uom').nullable()
      table.float('pendingTotalQty').nullable()
      table.float('approvedCumulativeQty').nullable()
      table.float('measuredQty').nullable()
      table.float('price').nullable()
      table.string('remark').nullable()
      table.specificType('sourceAcceptanceIds', 'text[]').nullable()
      table
        .timestamp('createdAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table
        .timestamp('updatedAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())

      table.index(['measurementId'], measurementItemsMeasurementIndex)
      table.index(['boqItemId'], measurementItemsBoqIndex)
      table.unique(['measurementId', 'boqItemId'], measurementItemsUnique)
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasMeasurementItemsTable = await knex.schema.hasTable(measurementItemsTable)
  if (hasMeasurementItemsTable) {
    await knex.schema.dropTable(measurementItemsTable)
  }

  const hasMeasurementTable = await knex.schema.hasTable(measurementTable)
  if (hasMeasurementTable) {
    await knex.schema.dropTable(measurementTable)
  }
}
