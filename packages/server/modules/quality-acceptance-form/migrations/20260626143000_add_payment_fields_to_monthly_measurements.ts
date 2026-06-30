import type { Knex } from 'knex'

const tableName = 'monthly_measurements'

export async function up(knex: Knex): Promise<void> {
  const hasPaymentPhase = await knex.schema.hasColumn(tableName, 'paymentPhase')
  const hasDetailedDescription = await knex.schema.hasColumn(
    tableName,
    'detailedDescription'
  )

  if (!hasPaymentPhase || !hasDetailedDescription) {
    await knex.schema.alterTable(tableName, (table) => {
      if (!hasPaymentPhase) {
        table.string('paymentPhase').nullable()
      }
      if (!hasDetailedDescription) {
        table.text('detailedDescription').nullable()
      }
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasPaymentPhase = await knex.schema.hasColumn(tableName, 'paymentPhase')
  const hasDetailedDescription = await knex.schema.hasColumn(
    tableName,
    'detailedDescription'
  )

  if (hasPaymentPhase || hasDetailedDescription) {
    await knex.schema.alterTable(tableName, (table) => {
      if (hasPaymentPhase) {
        table.dropColumn('paymentPhase')
      }
      if (hasDetailedDescription) {
        table.dropColumn('detailedDescription')
      }
    })
  }
}
