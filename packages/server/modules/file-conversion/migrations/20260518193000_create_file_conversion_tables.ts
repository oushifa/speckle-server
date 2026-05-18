import type { Knex } from 'knex'

const filesTable = 'file_conversion_files'
const eventsTable = 'file_conversion_events'

export async function up(knex: Knex): Promise<void> {
  const hasFilesTable = await knex.schema.hasTable(filesTable)
  if (!hasFilesTable) {
    await knex.schema.createTable(filesTable, (table) => {
      table.string('id', 10).primary()
      table.string('fileName', 512).notNullable()
      table.integer('fileSize').nullable()
      table.text('sourceObjectKey').nullable()
      table.text('sourceFileUrl').nullable()
      table.text('resultObjectKey').nullable()
      table.text('resultFileUrl').nullable()
      table.string('streamId', 64).notNullable().unique()
      table.string('status', 32).notNullable()
      table.boolean('isConverted').notNullable().defaultTo(false)
      table.timestamp('uploadedAt', { precision: 3, useTz: true }).nullable()
      table.timestamp('startedAt', { precision: 3, useTz: true }).nullable()
      table.timestamp('convertedAt', { precision: 3, useTz: true }).nullable()
      table.text('errorMessage').nullable()
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

      table.index(['creator', 'updatedAt'], `${filesTable}_creator_updated_at_idx`)
      table.index(['status', 'createdAt'], `${filesTable}_status_created_at_idx`)
    })
  }

  const hasEventsTable = await knex.schema.hasTable(eventsTable)
  if (!hasEventsTable) {
    await knex.schema.createTable(eventsTable, (table) => {
      table.string('id', 10).primary()
      table
        .string('fileId', 10)
        .notNullable()
        .references('id')
        .inTable(filesTable)
        .onDelete('cascade')
      table.string('streamId', 64).notNullable()
      table.string('status', 32).notNullable()
      table.string('startedBy', 128).nullable()
      table.timestamp('startedAt', { precision: 3, useTz: true }).nullable()
      table.timestamp('finishedAt', { precision: 3, useTz: true }).nullable()
      table.jsonb('callbackPayload').nullable()
      table.text('errorMessage').nullable()
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

      table.index(['fileId', 'createdAt'], `${eventsTable}_file_created_at_idx`)
      table.index(['status', 'createdAt'], `${eventsTable}_status_created_at_idx`)
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasEventsTable = await knex.schema.hasTable(eventsTable)
  if (hasEventsTable) {
    await knex.schema.dropTable(eventsTable)
  }

  const hasFilesTable = await knex.schema.hasTable(filesTable)
  if (hasFilesTable) {
    await knex.schema.dropTable(filesTable)
  }
}
