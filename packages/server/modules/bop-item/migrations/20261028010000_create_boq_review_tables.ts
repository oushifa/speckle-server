import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasRecordsTable = await knex.schema.hasTable('boq_review_records')
  if (!hasRecordsTable) {
    await knex.schema.createTable('boq_review_records', (table) => {
      table.string('id', 32).primary()
      table.string('projectId', 10).notNullable().index()
      table.string('kind', 16).notNullable().index()
      table.string('code', 64).notNullable()
      table.text('reason').notNullable().defaultTo('')
      table.string('applicant', 128).notNullable().defaultTo('')
      table.string('applicantId', 32).nullable()
      table.string('applyDate', 32).notNullable().defaultTo('')
      table.string('approveStatus', 32).notNullable().defaultTo('START')
      table.string('flowInstanceId', 32).nullable().index()
      table.string('effectiveAt', 32).nullable()
      table.jsonb('attachments').notNullable().defaultTo('[]')
      table.jsonb('history').notNullable().defaultTo('[]')
      table
        .timestamp('createdAt', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table
        .timestamp('updatedAt', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())

      table.index(['projectId', 'kind', 'code'])
    })
  }

  const hasRowsTable = await knex.schema.hasTable('boq_review_rows')
  if (!hasRowsTable) {
    await knex.schema.createTable('boq_review_rows', (table) => {
      table.string('id', 32).primary()
      table
        .string('recordId', 32)
        .notNullable()
        .references('id')
        .inTable('boq_review_records')
        .onDelete('CASCADE')
        .index()
      table.string('projectId', 10).notNullable().index()
      table.integer('sortIndex').notNullable().defaultTo(0)
      table.string('source', 16).notNullable().defaultTo('import')
      table.string('boqItemId', 32).nullable().index()
      table.string('sourceCode', 128).nullable()
      table.string('parentCode', 128).nullable()
      table.string('code', 128).notNullable().defaultTo('')
      table.string('name', 512).notNullable().defaultTo('')
      table.string('unit', 64).notNullable().defaultTo('')
      table.decimal('baseChangeQty', 18, 6).nullable()
      table.decimal('reviewQty', 18, 6).nullable()
      table.decimal('reviewQtySupervisor', 18, 6).nullable()
      table.decimal('reviewQtyContract', 18, 6).nullable()
      table.decimal('changeQty', 18, 6).nullable()
      table.decimal('changeQtySupervisor', 18, 6).nullable()
      table.decimal('changeQtyContract', 18, 6).nullable()
      table.decimal('reviewUnitPrice', 18, 2).nullable()
      table.jsonb('beforeSnapshot').nullable()
      table.jsonb('afterSnapshot').nullable()
      table
        .timestamp('createdAt', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table
        .timestamp('updatedAt', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasRowsTable = await knex.schema.hasTable('boq_review_rows')
  if (hasRowsTable) {
    await knex.schema.dropTable('boq_review_rows')
  }

  const hasRecordsTable = await knex.schema.hasTable('boq_review_records')
  if (hasRecordsTable) {
    await knex.schema.dropTable('boq_review_records')
  }
}
