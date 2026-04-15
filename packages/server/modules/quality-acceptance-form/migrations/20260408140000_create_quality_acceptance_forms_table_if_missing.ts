import type { Knex } from 'knex'

const tableName = 'quality_acceptance_forms'
const approveStatusIndex = 'quality_acceptance_forms_approve_status_idx'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) {
    await knex.schema.createTable(tableName, (table) => {
      table.string('id', 10).primary()
      table.string('name').nullable()
      table.string('code').nullable()
      table.string('inspectionLotNumber').nullable()
      table.string('acceptancePart').nullable()
      table.bigInteger('actualStartDate').nullable()
      table.bigInteger('actualFinishDate').nullable()
      table.string('inspector').nullable()
      table.float('workVolume').nullable()
      table.string('unit').nullable()
      table.jsonb('bimElements').nullable()
      table.string('timeZone').nullable()
      table.string('approveStatus').nullable()
      table
        .timestamp('createdAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table
        .timestamp('updatedAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table.index(['approveStatus'], approveStatusIndex)
    })
    return
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return
  await knex.schema.dropTable(tableName)
}
