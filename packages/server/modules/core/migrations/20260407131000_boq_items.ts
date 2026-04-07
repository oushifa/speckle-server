import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('boq_items', (table) => {
    table.string('id', 10).primary()
    table
      .string('projectId', 10)
      .notNullable()
      .references('id')
      .inTable('streams')
      .onDelete('cascade')
    table.string('parentId', 10).nullable().references('id').inTable('boq_items')
    table.text('type').notNullable()
    table.text('code').notNullable()
    table.text('name').notNullable()
    table.text('unit').nullable()
    table.decimal('quantity', 18, 6).nullable()
    table.decimal('price', 18, 2).nullable()
    table.integer('sortOrder').notNullable().defaultTo(0)
    table.integer('depth').notNullable()
    table.timestamp('createdAt', { precision: 3, useTz: true }).notNullable()
    table.timestamp('updatedAt', { precision: 3, useTz: true }).notNullable()

    table.index(['projectId', 'parentId', 'sortOrder'])
    table.index(['projectId', 'type', 'sortOrder'])
    table.unique(['projectId', 'code'])
  })

  await knex.raw(`
    ALTER TABLE "boq_items"
      ADD CONSTRAINT "boq_items_type_check"
      CHECK ("type" IN ('PROJECT', 'CATEGORY', 'SECTION', 'SUBSECTION', 'ITEM'));
  `)

  await knex.raw(`
    ALTER TABLE "boq_items"
      ADD CONSTRAINT "boq_items_depth_check"
      CHECK ("depth" >= 0 AND "depth" <= 4);
  `)

  await knex.raw(`
    ALTER TABLE "boq_items"
      ADD CONSTRAINT "boq_items_type_depth_check"
      CHECK (
        ("type" = 'PROJECT' AND "depth" = 0) OR
        ("type" = 'CATEGORY' AND "depth" = 1) OR
        ("type" = 'SECTION' AND "depth" = 2) OR
        ("type" = 'SUBSECTION' AND "depth" = 3) OR
        ("type" = 'ITEM' AND "depth" = 4)
      );
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('boq_items')
}
