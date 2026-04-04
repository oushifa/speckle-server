import type { Knex } from 'knex'

const definitionsTable = 'approval_flow_definitions'
const instancesTable = 'approval_flow_instances'
const actionsTable = 'approval_flow_actions'
const definitionStepsTable = 'approval_flow_definition_steps'
const instanceStepsTable = 'approval_flow_instance_steps'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(definitionsTable, (table) => {
    table.integer('version').notNullable().defaultTo(1)
    table
      .string('previousVersionId', 10)
      .nullable()
      .references('id')
      .inTable(definitionsTable)
      .onDelete('set null')
    table.jsonb('triggerConfig').nullable()
  })

  await knex.schema.createTable(definitionStepsTable, (table) => {
    table.string('id', 10).primary()
    table
      .string('definitionId', 10)
      .notNullable()
      .references('id')
      .inTable(definitionsTable)
      .onDelete('cascade')
      .index()
    table.string('name').notNullable()
    table.integer('stepIndex').notNullable()
    table.specificType('approverIds', 'text[]').notNullable().defaultTo('{}')
    table.integer('requiredApprovals').notNullable().defaultTo(1)
    table.integer('timeoutHours').nullable()
    table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
    table.unique(['definitionId', 'stepIndex'], {
      indexName: 'approval_flow_definition_steps_definition_step_index_unique'
    })
  })

  await knex.schema.createTable(instanceStepsTable, (table) => {
    table.string('id', 10).primary()
    table
      .string('instanceId', 10)
      .notNullable()
      .references('id')
      .inTable(instancesTable)
      .onDelete('cascade')
      .index()
    table
      .string('definitionStepId', 10)
      .nullable()
      .references('id')
      .inTable(definitionStepsTable)
      .onDelete('set null')
    table.string('name').notNullable()
    table.integer('stepIndex').notNullable()
    table.string('status').notNullable().defaultTo('WAITING').index()
    table.specificType('approverIds', 'text[]').notNullable().defaultTo('{}')
    table.integer('requiredApprovals').notNullable().defaultTo(1)
    table.specificType('approvedByIds', 'text[]').notNullable().defaultTo('{}')
    table.timestamp('startedAt').nullable()
    table.timestamp('dueAt').nullable()
    table.timestamp('completedAt').nullable()
    table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
    table.unique(['instanceId', 'stepIndex'], {
      indexName: 'approval_flow_instance_steps_instance_step_index_unique'
    })
  })

  await knex.schema.alterTable(actionsTable, (table) => {
    table
      .string('stepId', 10)
      .nullable()
      .references('id')
      .inTable(instanceStepsTable)
      .onDelete('set null')
      .index()
    table.jsonb('metadata').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(actionsTable, (table) => {
    table.dropColumn('metadata')
    table.dropColumn('stepId')
  })

  await knex.schema.dropTable(instanceStepsTable)
  await knex.schema.dropTable(definitionStepsTable)

  await knex.schema.alterTable(definitionsTable, (table) => {
    table.dropColumn('triggerConfig')
    table.dropColumn('previousVersionId')
    table.dropColumn('version')
  })
}
