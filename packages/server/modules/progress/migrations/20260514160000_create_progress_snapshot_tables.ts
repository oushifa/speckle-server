import type { Knex } from 'knex'

const taskElementsTable = 'project_progress_task_elements'
const actualElementEventsTable = 'project_progress_actual_element_events'
const elementSnapshotsTable = 'project_progress_element_snapshots'
const taskSnapshotsTable = 'project_progress_task_snapshots'

const timestamps = (table: Knex.CreateTableBuilder, knex: Knex) => {
  table
    .timestamp('createdAt', { precision: 3, useTz: true })
    .notNullable()
    .defaultTo(knex.fn.now())
  table
    .timestamp('updatedAt', { precision: 3, useTz: true })
    .notNullable()
    .defaultTo(knex.fn.now())
}

export async function up(knex: Knex): Promise<void> {
  const hasTaskElementsTable = await knex.schema.hasTable(taskElementsTable)
  if (!hasTaskElementsTable) {
    await knex.schema.createTable(taskElementsTable, (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table
        .string('taskId', 10)
        .notNullable()
        .references('id')
        .inTable('project_progress_plan_tasks')
        .onDelete('cascade')
      table.string('modelId').notNullable()
      table.string('applicationId').notNullable()
      table.timestamp('planStart', { precision: 3, useTz: true }).nullable()
      table.timestamp('planEnd', { precision: 3, useTz: true }).nullable()
      table.string('creator').notNullable()
      table.string('updater').notNullable()
      timestamps(table, knex)

      table.unique(
        ['projectId', 'taskId', 'modelId', 'applicationId'],
        'project_progress_task_elements_unique'
      )
      table.index(
        ['projectId', 'modelId', 'applicationId'],
        'project_progress_task_elements_project_element_idx'
      )
      table.index(
        ['projectId', 'taskId'],
        'project_progress_task_elements_project_task_idx'
      )
    })
  }

  const hasActualElementEventsTable = await knex.schema.hasTable(
    actualElementEventsTable
  )
  if (!hasActualElementEventsTable) {
    await knex.schema.createTable(actualElementEventsTable, (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table
        .string('recordId', 10)
        .notNullable()
        .references('id')
        .inTable('project_progress_actual_records')
        .onDelete('cascade')
      table.string('modelId').notNullable()
      table.string('applicationId').notNullable()
      table.string('eventType').notNullable()
      table.timestamp('eventAt', { precision: 3, useTz: true }).notNullable()
      table.string('reportDate', 10).notNullable()
      table.string('creator').notNullable()
      table.string('updater').notNullable()
      timestamps(table, knex)

      table.unique(
        ['projectId', 'recordId', 'eventType', 'modelId', 'applicationId'],
        'project_progress_actual_element_events_unique'
      )
      table.index(
        ['projectId', 'modelId', 'applicationId'],
        'project_progress_actual_element_events_project_element_idx'
      )
      table.index(
        ['projectId', 'recordId'],
        'project_progress_actual_element_events_project_record_idx'
      )
      table.index(
        ['projectId', 'eventType', 'eventAt'],
        'project_progress_actual_element_events_project_event_idx'
      )
    })
  }

  const hasElementSnapshotsTable = await knex.schema.hasTable(elementSnapshotsTable)
  if (!hasElementSnapshotsTable) {
    await knex.schema.createTable(elementSnapshotsTable, (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table.string('modelId').notNullable()
      table.string('applicationId').notNullable()
      table.timestamp('plannedStartAt', { precision: 3, useTz: true }).nullable()
      table.timestamp('plannedFinishAt', { precision: 3, useTz: true }).nullable()
      table.timestamp('actualStartAt', { precision: 3, useTz: true }).nullable()
      table.timestamp('actualFinishAt', { precision: 3, useTz: true }).nullable()
      table.string('progressStatus').notNullable()
      table.decimal('progressPercent', 5, 2).nullable()
      table.boolean('isAheadStart').notNullable().defaultTo(false)
      table.boolean('isDelayedFinish').notNullable().defaultTo(false)
      table.timestamp('lastReportAt', { precision: 3, useTz: true }).nullable()
      table.string('creator').notNullable()
      table.string('updater').notNullable()
      timestamps(table, knex)

      table.unique(
        ['projectId', 'modelId', 'applicationId'],
        'project_progress_element_snapshots_unique'
      )
      table.index(
        ['projectId', 'progressStatus'],
        'project_progress_element_snapshots_project_status_idx'
      )
      table.index(
        ['projectId', 'lastReportAt'],
        'project_progress_element_snapshots_project_report_idx'
      )
      table.index(
        ['projectId', 'modelId', 'applicationId'],
        'project_progress_element_snapshots_project_element_idx'
      )
    })
  }

  const hasTaskSnapshotsTable = await knex.schema.hasTable(taskSnapshotsTable)
  if (!hasTaskSnapshotsTable) {
    await knex.schema.createTable(taskSnapshotsTable, (table) => {
      table.string('id', 10).primary()
      table
        .string('projectId', 10)
        .notNullable()
        .references('id')
        .inTable('streams')
        .onDelete('cascade')
      table
        .string('taskId', 10)
        .notNullable()
        .references('id')
        .inTable('project_progress_plan_tasks')
        .onDelete('cascade')
      table.integer('totalElementCount').notNullable().defaultTo(0)
      table.integer('finishedElementCount').notNullable().defaultTo(0)
      table.integer('inProgressElementCount').notNullable().defaultTo(0)
      table.integer('notStartedElementCount').notNullable().defaultTo(0)
      table.integer('delayedElementCount').notNullable().defaultTo(0)
      table.decimal('completionRate', 5, 2).notNullable().defaultTo(0)
      table.timestamp('plannedStartAt', { precision: 3, useTz: true }).nullable()
      table.timestamp('plannedFinishAt', { precision: 3, useTz: true }).nullable()
      table.timestamp('actualStartAt', { precision: 3, useTz: true }).nullable()
      table.timestamp('actualFinishAt', { precision: 3, useTz: true }).nullable()
      table.string('taskStatus').notNullable()
      table.timestamp('lastCalculatedAt', { precision: 3, useTz: true }).nullable()
      table.string('creator').notNullable()
      table.string('updater').notNullable()
      timestamps(table, knex)

      table.unique(['projectId', 'taskId'], 'project_progress_task_snapshots_unique')
      table.index(
        ['projectId', 'taskStatus'],
        'project_progress_task_snapshots_project_status_idx'
      )
      table.index(
        ['projectId', 'plannedFinishAt'],
        'project_progress_task_snapshots_project_finish_idx'
      )
      table.index(
        ['projectId', 'completionRate'],
        'project_progress_task_snapshots_project_rate_idx'
      )
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    taskSnapshotsTable,
    elementSnapshotsTable,
    actualElementEventsTable,
    taskElementsTable
  ]

  for (const tableName of tables) {
    const hasTable = await knex.schema.hasTable(tableName)
    if (!hasTable) continue
    await knex.schema.dropTable(tableName)
  }
}
