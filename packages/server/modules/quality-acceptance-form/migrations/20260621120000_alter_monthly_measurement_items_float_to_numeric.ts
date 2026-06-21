import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('monthly_measurement_items')
  if (hasTable) {
    await knex.schema.alterTable('monthly_measurement_items', (table) => {
      table.decimal('pendingTotalQty', 20, 4).alter()
      table.decimal('approvedCumulativeQty', 20, 4).alter()
      table.decimal('measuredQty', 20, 4).alter()
      table.decimal('price', 20, 4).alter()
      table.decimal('contractorQty', 20, 4).alter()
      table.decimal('supervisionQty', 20, 4).alter()
      table.decimal('headquartersQty', 20, 4).alter()
      table.decimal('investmentQty', 20, 4).alter()
      table.decimal('contractorPayAmt', 20, 4).alter()
      table.decimal('investmentPayAmt', 20, 4).alter()
      table.decimal('contractPayAmt', 20, 4).alter()
      table.decimal('leaderPayAmt', 20, 4).alter()
      table.decimal('lastCumulativeQty', 20, 4).alter()
      table.decimal('yearlyCumulativeQty', 20, 4).alter()
      table.decimal('lastCumulativePay', 20, 4).alter()
    })
  }

  const hasRequestTable = await knex.schema.hasTable('monthly_payment_requests')
  if (hasRequestTable) {
    await knex.schema.alterTable('monthly_payment_requests', (table) => {
      table.decimal('lastCumulativePayment', 20, 4).alter()
      table.decimal('contractAmount', 20, 4).alter()
      table.decimal('contractorPayAmt', 20, 4).alter()
      table.decimal('supervisionPayAmt', 20, 4).alter()
      table.decimal('headquartersPayAmt', 20, 4).alter()
      table.decimal('investmentPayAmt', 20, 4).alter()
      table.decimal('contractPayAmt', 20, 4).alter()
      table.decimal('leaderPayAmt', 20, 4).alter()
    })
  }

  const hasPaymentTable = await knex.schema.hasTable('monthly_payment_details')
  if (hasPaymentTable) {
    await knex.schema.alterTable('monthly_payment_details', (table) => {
      table.decimal('interimPayProgress', 20, 4).alter()
      table.decimal('migrantWorkerSalary', 20, 4).alter()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('monthly_measurement_items')
  if (hasTable) {
    await knex.schema.alterTable('monthly_measurement_items', (table) => {
      table.float('pendingTotalQty').alter()
      table.float('approvedCumulativeQty').alter()
      table.float('measuredQty').alter()
      table.float('price').alter()
      table.float('contractorQty').alter()
      table.float('supervisionQty').alter()
      table.float('headquartersQty').alter()
      table.float('investmentQty').alter()
      table.float('contractorPayAmt').alter()
      table.float('investmentPayAmt').alter()
      table.float('contractPayAmt').alter()
      table.float('leaderPayAmt').alter()
      table.float('lastCumulativeQty').alter()
      table.float('yearlyCumulativeQty').alter()
      table.float('lastCumulativePay').alter()
    })
  }

  const hasRequestTable = await knex.schema.hasTable('monthly_payment_requests')
  if (hasRequestTable) {
    await knex.schema.alterTable('monthly_payment_requests', (table) => {
      table.float('lastCumulativePayment').alter()
      table.float('contractAmount').alter()
      table.float('contractorPayAmt').alter()
      table.float('supervisionPayAmt').alter()
      table.float('headquartersPayAmt').alter()
      table.float('investmentPayAmt').alter()
      table.float('contractPayAmt').alter()
      table.float('leaderPayAmt').alter()
    })
  }

  const hasPaymentTable = await knex.schema.hasTable('monthly_payment_details')
  if (hasPaymentTable) {
    await knex.schema.alterTable('monthly_payment_details', (table) => {
      table.float('interimPayProgress').alter()
      table.float('migrantWorkerSalary').alter()
    })
  }
}
