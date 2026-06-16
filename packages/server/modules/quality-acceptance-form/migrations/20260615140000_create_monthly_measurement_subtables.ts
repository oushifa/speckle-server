import type { Knex } from 'knex'

const detailsTable = 'monthly_measurement_details'
const paymentTable = 'monthly_payment_details'
const requestTable = 'monthly_payment_requests'
const itemsTable = 'monthly_measurement_items'

export async function up(knex: Knex): Promise<void> {
  // 1. 创建 monthly_measurement_details
  const hasDetails = await knex.schema.hasTable(detailsTable)
  if (!hasDetails) {
    await knex.schema.createTable(detailsTable, (table) => {
      table.string('id', 10).primary()
      table.string('measurementId', 10).notNullable().index()
      table.specificType('acceptanceAttachments', 'text[]').nullable()
      
      table.text('supervisionOpinion').nullable()
      table.string('supervisionAuditor').nullable()
      table.timestamp('supervisionDate', { useTz: true }).nullable()
      
      table.text('headquartersOpinion').nullable()
      table.string('headquartersAuditor').nullable()
      table.timestamp('headquartersDate', { useTz: true }).nullable()
      
      table.text('investmentOpinion').nullable()
      table.string('investmentAuditor').nullable()
      table.timestamp('investmentDate', { useTz: true }).nullable()
      
      table.text('ownerOpinion').nullable()
      table.string('ownerAuditor').nullable()
      table.timestamp('ownerDate', { useTz: true }).nullable()
      
      table.timestamp('createdAt', { precision: 3, useTz: true }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt', { precision: 3, useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }

  // 2. 创建 monthly_payment_details
  const hasPayment = await knex.schema.hasTable(paymentTable)
  if (!hasPayment) {
    await knex.schema.createTable(paymentTable, (table) => {
      table.string('id', 10).primary()
      table.string('measurementId', 10).notNullable().index()
      table.specificType('paymentAttachments', 'text[]').nullable()
      table.float('interimPayProgress').nullable().defaultTo(0)
      table.float('migrantWorkerSalary').nullable().defaultTo(0)
      table.text('interimRemark').nullable()
      
      table.string('contractorSign').nullable()
      table.string('supervisionSign').nullable()
      table.string('preparerSign').nullable()
      table.timestamp('interimSignDate', { useTz: true }).nullable()
      
      table.timestamp('createdAt', { precision: 3, useTz: true }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt', { precision: 3, useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }

  // 3. 创建 monthly_payment_requests
  const hasRequest = await knex.schema.hasTable(requestTable)
  if (!hasRequest) {
    await knex.schema.createTable(requestTable, (table) => {
      table.string('id', 10).primary()
      table.string('measurementId', 10).notNullable().index()
      table.specificType('requestAttachments', 'text[]').nullable()
      table.float('lastCumulativePayment').nullable().defaultTo(0)
      table.float('contractAmount').nullable().defaultTo(0)
      
      table.float('contractorPayAmt').nullable().defaultTo(0)
      table.float('supervisionPayAmt').nullable().defaultTo(0)
      table.float('headquartersPayAmt').nullable().defaultTo(0)
      table.float('investmentPayAmt').nullable().defaultTo(0)
      table.float('contractPayAmt').nullable().defaultTo(0)
      table.float('leaderPayAmt').nullable().defaultTo(0)

      table.text('reqContractorOpinion').nullable()
      table.string('reqContractorAuditor').nullable()
      table.timestamp('reqContractorDate', { useTz: true }).nullable()

      table.text('reqSupervisionOpinion').nullable()
      table.string('reqSupervisionAuditor').nullable()
      table.timestamp('reqSupervisionDate', { useTz: true }).nullable()

      table.text('reqHeadquartersOpinion').nullable()
      table.string('reqHeadquartersAuditor').nullable()
      table.timestamp('reqHeadquartersDate', { useTz: true }).nullable()

      table.text('reqInvestmentOpinion').nullable()
      table.string('reqInvestmentAuditor').nullable()
      table.timestamp('reqInvestmentDate', { useTz: true }).nullable()

      table.text('reqContractOpinion').nullable()
      table.string('reqContractAuditor').nullable()
      table.timestamp('reqContractDate', { useTz: true }).nullable()

      table.text('reqLeaderOpinion').nullable()
      table.string('reqLeaderAuditor').nullable()
      table.timestamp('reqLeaderDate', { useTz: true }).nullable()
      
      table.timestamp('createdAt', { precision: 3, useTz: true }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt', { precision: 3, useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }

  // 4. 修改 monthly_measurement_items
  const hasItemsTable = await knex.schema.hasTable(itemsTable)
  if (hasItemsTable) {
    await knex.schema.alterTable(itemsTable, (table) => {
      table.float('contractorQty').nullable().defaultTo(0)
      table.float('supervisionQty').nullable().defaultTo(0)
      table.float('headquartersQty').nullable().defaultTo(0)
      table.float('investmentQty').nullable().defaultTo(0)
      table.float('contractorPayAmt').nullable().defaultTo(0)
      table.float('investmentPayAmt').nullable().defaultTo(0)
      table.float('contractPayAmt').nullable().defaultTo(0)
      table.float('leaderPayAmt').nullable().defaultTo(0)
    })

    // 数据迁移：拷贝旧的 measuredQty 到 contractorQty, supervisionQty, headquartersQty, investmentQty
    await knex(itemsTable).update({
      contractorQty: knex.ref('measuredQty'),
      supervisionQty: knex.ref('measuredQty'),
      headquartersQty: knex.ref('measuredQty'),
      investmentQty: knex.ref('measuredQty')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  // 回滚操作：删除新增加的字段和表格
  const hasItemsTable = await knex.schema.hasTable(itemsTable)
  if (hasItemsTable) {
    await knex.schema.alterTable(itemsTable, (table) => {
      table.dropColumn('contractorQty')
      table.dropColumn('supervisionQty')
      table.dropColumn('headquartersQty')
      table.dropColumn('investmentQty')
      table.dropColumn('contractorPayAmt')
      table.dropColumn('investmentPayAmt')
      table.dropColumn('contractPayAmt')
      table.dropColumn('leaderPayAmt')
    })
  }

  await knex.schema.dropTableIfExists(requestTable)
  await knex.schema.dropTableIfExists(paymentTable)
  await knex.schema.dropTableIfExists(detailsTable)
}
