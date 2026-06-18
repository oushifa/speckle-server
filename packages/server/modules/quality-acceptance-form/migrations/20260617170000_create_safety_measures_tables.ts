import type { Knex } from 'knex'

const safetyMeasuresTable = 'safety_measures'
const safetyMeasureDetailsTable = 'safety_measure_details'
const safetyMeasureItemsTable = 'safety_measure_items'

export async function up(knex: Knex): Promise<void> {
  // 1. 创建 safety_measures 表
  const hasSafetyMeasures = await knex.schema.hasTable(safetyMeasuresTable)
  if (!hasSafetyMeasures) {
    await knex.schema.createTable(safetyMeasuresTable, (table) => {
      table.string('id', 10).primary()
      table.string('project_id').notNullable()
      table.string('unit').nullable()
      table.string('code').notNullable()
      table.bigInteger('baseDate').notNullable()
      table.string('roundName').notNullable()
      table.bigInteger('startDate').nullable()
      table.bigInteger('endDate').nullable()
      table.jsonb('boqSectionIds').nullable()
      table.string('approveStatus').nullable()
      table.string('flowInstanceId', 10).nullable()
      table.string('creator').nullable()
      table.timestamp('createdAt', { precision: 3, useTz: true }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt', { precision: 3, useTz: true }).notNullable().defaultTo(knex.fn.now())

      table.unique(['project_id', 'code'], 'safety_measures_project_code_unique')
      table.index(['project_id'], 'safety_measures_project_idx')
    })
  }

  // 2. 创建 safety_measure_details 表
  const hasSafetyMeasureDetails = await knex.schema.hasTable(safetyMeasureDetailsTable)
  if (!hasSafetyMeasureDetails) {
    await knex.schema.createTable(safetyMeasureDetailsTable, (table) => {
      table.string('id', 10).primary()
      table.string('safetyMeasureId', 10).notNullable().index('safety_measure_details_measure_idx')
      table.jsonb('attachments').nullable()
      
      table.text('supervisionOpinion').nullable()
      table.string('supervisionAuditor').nullable()
      table.timestamp('supervisionDate', { useTz: true }).nullable()
      
      table.text('headquartersOpinion').nullable()
      table.string('headquartersAuditor').nullable()
      table.timestamp('headquartersDate', { useTz: true }).nullable()
      
      table.text('engineeringOpinion').nullable()
      table.string('engineeringAuditor').nullable()
      table.timestamp('engineeringDate', { useTz: true }).nullable()
      
      table.text('contractOpinion').nullable()
      table.string('contractAuditor').nullable()
      table.timestamp('contractDate', { useTz: true }).nullable()
      
      table.timestamp('createdAt', { precision: 3, useTz: true }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt', { precision: 3, useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }

  // 3. 创建 safety_measure_items 表
  const hasSafetyMeasureItems = await knex.schema.hasTable(safetyMeasureItemsTable)
  if (!hasSafetyMeasureItems) {
    await knex.schema.createTable(safetyMeasureItemsTable, (table) => {
      table.string('id', 10).primary()
      table.string('safetyMeasureId', 10).notNullable().index('safety_measure_items_measure_idx')
      table.string('boqItemId', 10).notNullable().index('safety_measure_items_boq_idx')
      table.string('boqCode').nullable()
      table.string('boqName').nullable()
      table.string('boqParentId', 10).nullable()
      table.integer('boqDepth').notNullable().defaultTo(0)
      table.boolean('isSummaryRow').notNullable().defaultTo(false)
      table.integer('sortIndex').notNullable().defaultTo(0)
      table.string('uom').nullable()
      table.float('price').nullable()
      table.float('contractQty').nullable()
      table.float('contractAmount').nullable()
      
      table.float('contractorQty').nullable().defaultTo(0)
      table.float('contractorAmount').nullable().defaultTo(0)
      
      table.float('supervisionQty').nullable().defaultTo(0)
      table.float('supervisionAmount').nullable().defaultTo(0)
      
      table.float('headquartersQty').nullable().defaultTo(0)
      table.float('headquartersAmount').nullable().defaultTo(0)
      
      table.float('engineeringQty').nullable().defaultTo(0)
      table.float('engineeringAmount').nullable().defaultTo(0)
      
      table.float('contractDeptQty').nullable().defaultTo(0)
      table.float('contractDeptAmount').nullable().defaultTo(0)
      
      table.timestamp('createdAt', { precision: 3, useTz: true }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt', { precision: 3, useTz: true }).notNullable().defaultTo(knex.fn.now())

      table.unique(['safetyMeasureId', 'boqItemId'], 'safety_measure_items_measure_boq_unique')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(safetyMeasureItemsTable)
  await knex.schema.dropTableIfExists(safetyMeasureDetailsTable)
  await knex.schema.dropTableIfExists(safetyMeasuresTable)
}
