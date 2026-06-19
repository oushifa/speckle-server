import type { Knex } from 'knex'

const safetyMeasureDetailsTable = 'safety_measure_details'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(safetyMeasureDetailsTable)
  if (hasTable) {
    await knex.schema.alterTable(safetyMeasureDetailsTable, (table) => {
      table.string('supervisionApproveAuditor').nullable()
      table.timestamp('supervisionApproveDate', { useTz: true }).nullable()
      
      table.string('headquartersApproveAuditor').nullable()
      table.timestamp('headquartersApproveDate', { useTz: true }).nullable()
      
      table.string('engineeringApproveAuditor').nullable()
      table.timestamp('engineeringApproveDate', { useTz: true }).nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(safetyMeasureDetailsTable)
  if (hasTable) {
    await knex.schema.alterTable(safetyMeasureDetailsTable, (table) => {
      table.dropColumn('supervisionApproveAuditor')
      table.dropColumn('supervisionApproveDate')
      table.dropColumn('headquartersApproveAuditor')
      table.dropColumn('headquartersApproveDate')
      table.dropColumn('engineeringApproveAuditor')
      table.dropColumn('engineeringApproveDate')
    })
  }
}
