import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasReviewQuantity = await knex.schema.hasColumn('boq_items', 'reviewQuantity')
  const hasChangeQuantity = await knex.schema.hasColumn('boq_items', 'changeQuantity')
  const hasReviewPrice = await knex.schema.hasColumn('boq_items', 'reviewPrice')
  const hasReviewAmount = await knex.schema.hasColumn('boq_items', 'reviewAmount')

  await knex.schema.alterTable('boq_items', (table) => {
    if (!hasReviewQuantity) {
      table.decimal('reviewQuantity', 18, 6).nullable()
    }
    if (!hasChangeQuantity) {
      table.decimal('changeQuantity', 18, 6).nullable()
    }
    if (!hasReviewPrice) {
      table.decimal('reviewPrice', 18, 2).nullable()
    }
    if (!hasReviewAmount) {
      table.decimal('reviewAmount', 18, 2).nullable()
    }
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasReviewQuantity = await knex.schema.hasColumn('boq_items', 'reviewQuantity')
  const hasChangeQuantity = await knex.schema.hasColumn('boq_items', 'changeQuantity')
  const hasReviewPrice = await knex.schema.hasColumn('boq_items', 'reviewPrice')
  const hasReviewAmount = await knex.schema.hasColumn('boq_items', 'reviewAmount')

  await knex.schema.alterTable('boq_items', (table) => {
    if (hasReviewQuantity) {
      table.dropColumn('reviewQuantity')
    }
    if (hasChangeQuantity) {
      table.dropColumn('changeQuantity')
    }
    if (hasReviewPrice) {
      table.dropColumn('reviewPrice')
    }
    if (hasReviewAmount) {
      table.dropColumn('reviewAmount')
    }
  })
}
