import type { Knex } from 'knex'

const definitionsTable = 'approval_flow_definitions'
const instancesTable = 'approval_flow_instances'
const actionsTable = 'approval_flow_actions'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(definitionsTable))) {
    await knex.schema.createTable(definitionsTable, (table) => {
      table.string('id', 10).primary()
      table.string('projectId', 10).notNullable().index()
      table.string('name').notNullable()
      table.string('resourceType').notNullable().index()
      table.boolean('isActive').notNullable().defaultTo(true).index()
      table.string('createdBy', 10).notNullable()
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
  }

  if (!(await knex.schema.hasTable(instancesTable))) {
    await knex.schema.createTable(instancesTable, (table) => {
      table.string('id', 10).primary()
      table
        .string('definitionId', 10)
        .notNullable()
        .references('id')
        .inTable(definitionsTable)
        .onDelete('cascade')
        .index()
      table.string('projectId', 10).notNullable().index()
      table.string('resourceType').notNullable().index()
      table.string('resourceId', 10).notNullable().index()
      table.string('status').notNullable().index()
      table.integer('currentStep').notNullable().defaultTo(1)
      table.string('createdBy', 10).notNullable()
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
      table.index(['projectId', 'status'], 'approval_flow_instances_project_status_idx')
      table.index(
        ['projectId', 'resourceType', 'resourceId'],
        'approval_flow_instances_project_resource_idx'
      )
    })
  }

  if (!(await knex.schema.hasTable(actionsTable))) {
    await knex.schema.createTable(actionsTable, (table) => {
      table.string('id', 10).primary()
      table
        .string('instanceId', 10)
        .notNullable()
        .references('id')
        .inTable(instancesTable)
        .onDelete('cascade')
        .index()
      table.string('action').notNullable().index()
      table.string('fromStatus').nullable()
      table.string('toStatus').nullable()
      table.text('comment').nullable()
      table.string('actorId', 10).notNullable().index()
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.index(
        ['instanceId', 'createdAt'],
        'approval_flow_actions_instance_created_idx'
      )
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(actionsTable)
  await knex.schema.dropTableIfExists(instancesTable)
  await knex.schema.dropTableIfExists(definitionsTable)
}
