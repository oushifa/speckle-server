import type { Knex } from 'knex'

const statusColumn = 'approveStatus'
const qualityTable = 'quality_acceptance_forms'
const monthlyTable = 'monthly_measurements'

export async function up(knex: Knex): Promise<void> {
  const hasQuality = await knex.schema.hasTable(qualityTable)
  if (hasQuality) {
    await knex.raw(`
      ALTER TABLE "${qualityTable}"
      ALTER COLUMN "${statusColumn}" DROP DEFAULT
    `)
  }

  const hasMonthly = await knex.schema.hasTable(monthlyTable)
  if (hasMonthly) {
    await knex.raw(`
      ALTER TABLE "${monthlyTable}"
      ALTER COLUMN "${statusColumn}" DROP DEFAULT
    `)
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasQuality = await knex.schema.hasTable(qualityTable)
  if (hasQuality) {
    await knex.raw(`
      ALTER TABLE "${qualityTable}"
      ALTER COLUMN "${statusColumn}" SET DEFAULT 'PENDING'
    `)
  }

  const hasMonthly = await knex.schema.hasTable(monthlyTable)
  if (hasMonthly) {
    await knex.raw(`
      ALTER TABLE "${monthlyTable}"
      ALTER COLUMN "${statusColumn}" SET DEFAULT 'PENDING'
    `)
  }
}
