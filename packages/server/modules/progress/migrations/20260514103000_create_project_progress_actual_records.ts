import type { Knex } from 'knex'

const tableName = 'project_progress_actual_records'
const projectReportDateIndex = 'project_progress_actual_records_project_report_date_idx'
const projectUpdatedAtIndex = 'project_progress_actual_records_project_updated_at_idx'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (hasTable) return

  await knex.schema.createTable(tableName, (table) => {
    table.string('id', 10).primary()
    table
      .string('projectId', 10)
      .notNullable()
      .references('id')
      .inTable('streams')
      .onDelete('cascade')
    table.string('taskName').notNullable()
    table.string('reportDate', 10).notNullable()
    table.text('startElementCodes').nullable()
    table.text('finishElementCodes').nullable()
    table.jsonb('bimElements').nullable()
    table.text('remark').nullable()
    table.string('highTemperature').nullable()
    table.string('lowTemperature').nullable()
    table.string('morningWeather').nullable()
    table.string('afternoonWeather').nullable()
    table.text('nightCondition').nullable()
    table.text('constructionRecord').nullable()
    table.text('qualityRecord').nullable()
    table.text('safetyRecord').nullable()
    table.text('mortarConcreteSampleRecord').nullable()
    table.text('materialEquipmentRecord').nullable()
    table.text('siteAppearanceRecord').nullable()
    table.text('overtimeRecord').nullable()
    table.text('otherRecord').nullable()
    table.string('siteLeader').nullable()
    table.string('reporter').nullable()
    table.text('constructionLog').nullable()
    table.string('creator').notNullable()
    table.string('updater').notNullable()
    table
      .timestamp('createdAt', { precision: 3, useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
    table
      .timestamp('updatedAt', { precision: 3, useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())

    table.index(['projectId', 'reportDate'], projectReportDateIndex)
    table.index(['projectId', 'updatedAt'], projectUpdatedAtIndex)
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  await knex.schema.dropTable(tableName)
}
