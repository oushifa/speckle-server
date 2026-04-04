import type { Knex } from 'knex'

const definitionsTable = 'approval_flow_definitions'
const instancesTable = 'approval_flow_instances'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(definitionsTable, (table) => {
    table.jsonb('formSchema').nullable()
  })

  await knex.schema.alterTable(instancesTable, (table) => {
    table.jsonb('formData').nullable()
  })

  await knex.schema.alterTable(definitionsTable, (table) => {
    table.string('projectId', 10).nullable().alter()
  })

  await knex.schema.alterTable(instancesTable, (table) => {
    table.string('projectId', 10).nullable().alter()
    table.string('resourceId', 10).nullable().alter()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(instancesTable, (table) => {
    table.string('resourceId', 10).notNullable().alter()
    table.string('projectId', 10).notNullable().alter()
  })

  await knex.schema.alterTable(definitionsTable, (table) => {
    table.string('projectId', 10).notNullable().alter()
  })

  await knex.schema.alterTable(instancesTable, (table) => {
    table.dropColumn('formData')
  })

  await knex.schema.alterTable(definitionsTable, (table) => {
    table.dropColumn('formSchema')
  })
}
