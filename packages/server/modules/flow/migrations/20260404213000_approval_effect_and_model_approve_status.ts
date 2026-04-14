import type { Knex } from 'knex'

const approvalDefinitionsTable = 'approval_flow_definitions'
const branchesTable = 'branches'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(approvalDefinitionsTable, (table) => {
    table.jsonb('effectConfig').nullable()
  })

  await knex.schema.alterTable(branchesTable, (table) => {
    table.string('approveStatus').nullable()
    table.index(['approveStatus'], 'branches_approve_status_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(branchesTable, (table) => {
    table.dropIndex(['approveStatus'], 'branches_approve_status_idx')
    table.dropColumn('approveStatus')
  })

  await knex.schema.alterTable(approvalDefinitionsTable, (table) => {
    table.dropColumn('effectConfig')
  })
}
