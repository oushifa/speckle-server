import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE "boq_items" DROP CONSTRAINT IF EXISTS "boq_items_type_check";
    ALTER TABLE "boq_items" DROP CONSTRAINT IF EXISTS "boq_items_depth_check";
    ALTER TABLE "boq_items" DROP CONSTRAINT IF EXISTS "boq_items_type_depth_check";
  `)

  await knex.raw(`
    ALTER TABLE "boq_items"
      ADD CONSTRAINT "boq_items_type_check"
      CHECK ("type" IN ('PROJECT', 'SUBPROJECT', 'CATEGORY', 'SECTION', 'SUBSECTION', 'ITEM'));
  `)

  await knex.raw(`
    ALTER TABLE "boq_items"
      ADD CONSTRAINT "boq_items_depth_check"
      CHECK ("depth" >= 0 AND "depth" <= 5);
  `)

  await knex.raw(`
    ALTER TABLE "boq_items"
      ADD CONSTRAINT "boq_items_type_depth_check"
      CHECK (
        ("type" = 'PROJECT' AND "depth" = 0) OR
        ("type" = 'SUBPROJECT' AND "depth" = 1) OR
        ("type" = 'CATEGORY' AND "depth" IN (1, 2)) OR
        ("type" = 'SECTION' AND "depth" IN (2, 3)) OR
        ("type" = 'SUBSECTION' AND "depth" IN (3, 4)) OR
        ("type" = 'ITEM' AND "depth" IN (4, 5))
      );
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE "boq_items" DROP CONSTRAINT IF EXISTS "boq_items_type_check";
    ALTER TABLE "boq_items" DROP CONSTRAINT IF EXISTS "boq_items_depth_check";
    ALTER TABLE "boq_items" DROP CONSTRAINT IF EXISTS "boq_items_type_depth_check";
  `)

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
