import type { Knex } from 'knex'

const tableName = 'project_drawing_annotations'
const drawingsTableName = 'project_drawings'

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
    table
      .string('drawingId', 10)
      .notNullable()
      .references('id')
      .inTable(drawingsTableName)
      .onDelete('cascade')

    table.string('title', 512).notNullable()
    table.text('description').notNullable().defaultTo('')
    table.boolean('visible').notNullable().defaultTo(true)

    table.double('pointX').notNullable()
    table.double('pointY').notNullable()
    table.double('pointZ').notNullable()

    table.double('cameraPositionX').notNullable()
    table.double('cameraPositionY').notNullable()
    table.double('cameraPositionZ').notNullable()

    table.double('cameraTargetX').notNullable()
    table.double('cameraTargetY').notNullable()
    table.double('cameraTargetZ').notNullable()

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

    table.index(['projectId', 'drawingId', 'createdAt'], 'project_drawing_annotations_project_drawing_created_at_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return
  await knex.schema.dropTable(tableName)
}

