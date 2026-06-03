import type { Knex } from 'knex'

const tableName = 'project_progress_plan_tasks'

export async function up(knex: Knex): Promise<void> {
  const [hasMilestoneType, hasMilestoneDescription, hasIsCriticalTask] = await Promise.all([
    knex.schema.hasColumn(tableName, 'milestoneType'),
    knex.schema.hasColumn(tableName, 'milestoneDescription'),
    knex.schema.hasColumn(tableName, 'isCriticalTask')
  ])

  if (hasMilestoneType && hasMilestoneDescription && hasIsCriticalTask) return

  await knex.schema.alterTable(tableName, (table) => {
    if (!hasMilestoneType) {
      table.string('milestoneType').nullable()
    }
    if (!hasMilestoneDescription) {
      table.text('milestoneDescription').nullable()
    }
    if (!hasIsCriticalTask) {
      table.boolean('isCriticalTask').notNullable().defaultTo(false)
    }
  })
}

export async function down(knex: Knex): Promise<void> {
  const [hasMilestoneType, hasMilestoneDescription, hasIsCriticalTask] = await Promise.all([
    knex.schema.hasColumn(tableName, 'milestoneType'),
    knex.schema.hasColumn(tableName, 'milestoneDescription'),
    knex.schema.hasColumn(tableName, 'isCriticalTask')
  ])

  if (!hasMilestoneType && !hasMilestoneDescription && !hasIsCriticalTask) return

  await knex.schema.alterTable(tableName, (table) => {
    if (hasMilestoneDescription) {
      table.dropColumn('milestoneDescription')
    }
    if (hasMilestoneType) {
      table.dropColumn('milestoneType')
    }
    if (hasIsCriticalTask) {
      table.dropColumn('isCriticalTask')
    }
  })
}
