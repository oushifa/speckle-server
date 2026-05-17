import type { Knex } from 'knex'

const drawingsTable = 'alignment_drawings'
const configsTable = 'alignment_configs'

export async function up(knex: Knex): Promise<void> {
  const hasDrawingsTable = await knex.schema.hasTable(drawingsTable)
  if (!hasDrawingsTable) {
    await knex.schema.createTable(drawingsTable, (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table.string('blobId').notNullable()
      table.string('fileName').notNullable()
      table.string('fileType').notNullable()
      table.bigInteger('fileSize').nullable()
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

      table.index(['projectId', 'createdAt'], 'alignment_drawings_project_created_at_idx')
    })
  }

  const hasConfigsTable = await knex.schema.hasTable(configsTable)
  if (!hasConfigsTable) {
    await knex.schema.createTable(configsTable, (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table.string('name').notNullable()
      table.text('description').nullable()
      table.string('drawingId').nullable()
      table.string('drawingName').nullable()
      table.decimal('splitRatio', 5, 4).notNullable().defaultTo(0.5)
      table.jsonb('calibrationPoints').nullable()
      table.jsonb('transform').nullable()
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

      table.index(['projectId', 'updatedAt'], 'alignment_configs_project_updated_at_idx')
      table.index(['projectId', 'drawingId'], 'alignment_configs_project_drawing_idx')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasConfigsTable = await knex.schema.hasTable(configsTable)
  if (hasConfigsTable) {
    await knex.schema.dropTable(configsTable)
  }

  const hasDrawingsTable = await knex.schema.hasTable(drawingsTable)
  if (hasDrawingsTable) {
    await knex.schema.dropTable(drawingsTable)
  }
}
