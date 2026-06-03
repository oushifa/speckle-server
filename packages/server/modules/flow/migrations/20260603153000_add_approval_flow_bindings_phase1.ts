import type { Knex } from 'knex'

const bindingsTable = 'approval_flow_bindings'
const instancesTable = 'approval_flow_instances'
const definitionsTable = 'approval_flow_definitions'

const bindingIdColumn = 'bindingId'
const roundNoColumn = 'roundNo'
const subjectSnapshotColumn = 'subjectSnapshot'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(bindingsTable))) {
    await knex.schema.createTable(bindingsTable, (table) => {
      table.string('id', 10).primary()
      table.string('projectId', 10).notNullable().index()
      table.string('subjectType', 64).notNullable().index()
      table.text('subjectId').notNullable()
      table.string('subjectTable', 255).nullable()
      table.text('subjectKey').notNullable().unique()
      table
        .string('definitionId', 10)
        .notNullable()
        .references('id')
        .inTable(definitionsTable)
        .onDelete('restrict')
        .index()
      table.string('templateId', 10).notNullable().index()
      table.string('currentInstanceId', 10).nullable().index()
      table.integer('currentRoundNo').notNullable().defaultTo(0)
      table.string('status', 64).notNullable().defaultTo('DRAFT').index()
      table.timestamp('lastSubmittedAt').nullable()
      table.string('lastSubmittedBy', 10).nullable()
      table.timestamp('lastReturnedAt').nullable()
      table.string('lastReturnedBy', 10).nullable()
      table.timestamp('finishedAt').nullable()
      table.jsonb('metadata').nullable()
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
      table.string('creator', 10).notNullable().index()
      table.string('updater', 10).notNullable().index()
      table.index(
        ['projectId', 'subjectType', 'subjectId'],
        'approval_flow_bindings_project_subject_idx'
      )
      table.index(['projectId', 'status'], 'approval_flow_bindings_project_status_idx')
    })
  }

  const hasBindingId = await knex.schema.hasColumn(instancesTable, bindingIdColumn)
  const hasRoundNo = await knex.schema.hasColumn(instancesTable, roundNoColumn)
  const hasSubjectSnapshot = await knex.schema.hasColumn(instancesTable, subjectSnapshotColumn)

  if (!hasBindingId || !hasRoundNo || !hasSubjectSnapshot) {
    await knex.schema.alterTable(instancesTable, (table) => {
      if (!hasBindingId) {
        table
          .string(bindingIdColumn, 10)
          .nullable()
          .references('id')
          .inTable(bindingsTable)
          .onDelete('set null')
          .index()
      }
      if (!hasRoundNo) {
        table.integer(roundNoColumn).notNullable().defaultTo(1)
      }
      if (!hasSubjectSnapshot) {
        table.jsonb(subjectSnapshotColumn).nullable()
      }
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn(instancesTable, subjectSnapshotColumn)) {
    await knex.schema.alterTable(instancesTable, (table) => {
      table.dropColumn(subjectSnapshotColumn)
    })
  }

  if (await knex.schema.hasColumn(instancesTable, roundNoColumn)) {
    await knex.schema.alterTable(instancesTable, (table) => {
      table.dropColumn(roundNoColumn)
    })
  }

  if (await knex.schema.hasColumn(instancesTable, bindingIdColumn)) {
    await knex.schema.alterTable(instancesTable, (table) => {
      table.dropColumn(bindingIdColumn)
    })
  }

  await knex.schema.dropTableIfExists(bindingsTable)
}
