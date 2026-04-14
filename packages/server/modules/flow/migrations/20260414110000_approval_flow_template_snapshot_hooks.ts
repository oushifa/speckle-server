import type { Knex } from 'knex'

const definitionsTable = 'approval_flow_definitions'
const instancesTable = 'approval_flow_instances'
const instanceStepsTable = 'approval_flow_instance_steps'
const formSnapshotsTable = 'approval_flow_instance_step_form_snapshots'

const templateIdColumn = 'templateId'
const definitionVersionColumn = 'definitionVersion'
const flowSnapshotColumn = 'flowSnapshot'
const stepSnapshotColumn = 'stepSnapshot'

const activePerTemplateUniqueIndex =
  'approval_flow_definitions_single_active_per_template_idx'
const templateVersionUniqueIndex =
  'approval_flow_definitions_template_version_unique_idx'

export async function up(knex: Knex): Promise<void> {
  const hasDefinitions = await knex.schema.hasTable(definitionsTable)
  if (!hasDefinitions) return

  const hasTemplateId = await knex.schema.hasColumn(definitionsTable, templateIdColumn)
  if (!hasTemplateId) {
    await knex.schema.alterTable(definitionsTable, (table) => {
      table.string(templateIdColumn, 10).nullable().index()
    })
  }

  await knex(definitionsTable)
    .whereNull(templateIdColumn)
    .update({
      [templateIdColumn]: knex.ref('id')
    })

  await knex.schema.alterTable(definitionsTable, (table) => {
    table.string(templateIdColumn, 10).notNullable().alter()
  })

  await knex.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS ${templateVersionUniqueIndex}
     ON ${definitionsTable} ("${templateIdColumn}", "version")`
  )
  await knex.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS ${activePerTemplateUniqueIndex}
     ON ${definitionsTable} ("${templateIdColumn}")
     WHERE "isActive" = true`
  )

  const hasInstances = await knex.schema.hasTable(instancesTable)
  if (hasInstances) {
    const hasInstanceTemplateId = await knex.schema.hasColumn(
      instancesTable,
      templateIdColumn
    )
    const hasDefinitionVersion = await knex.schema.hasColumn(
      instancesTable,
      definitionVersionColumn
    )
    const hasFlowSnapshot = await knex.schema.hasColumn(
      instancesTable,
      flowSnapshotColumn
    )
    if (!hasInstanceTemplateId || !hasDefinitionVersion || !hasFlowSnapshot) {
      await knex.schema.alterTable(instancesTable, (table) => {
        if (!hasInstanceTemplateId)
          table.string(templateIdColumn, 10).nullable().index()
        if (!hasDefinitionVersion) table.integer(definitionVersionColumn).nullable()
        if (!hasFlowSnapshot) table.jsonb(flowSnapshotColumn).nullable()
      })
    }
    await knex.schema.alterTable(instancesTable, (table) => {
      table.string('definitionId', 10).nullable().alter()
    })

    await knex.raw(
      `UPDATE "${instancesTable}" AS i
       SET "${templateIdColumn}" = COALESCE(i."${templateIdColumn}", d."${templateIdColumn}"),
           "${definitionVersionColumn}" = COALESCE(i."${definitionVersionColumn}", d."version"),
           "${flowSnapshotColumn}" = COALESCE(
             i."${flowSnapshotColumn}",
             jsonb_build_object(
               'templateId', d."${templateIdColumn}",
               'definitionId', d."id",
               'version', d."version",
               'name', d."name",
               'resourceType', d."resourceType",
               'effectConfig', d."effectConfig",
               'formSchema', d."formSchema"
             )
           )
       FROM "${definitionsTable}" AS d
       WHERE i."definitionId" = d."id"`
    )
  }

  const hasInstanceSteps = await knex.schema.hasTable(instanceStepsTable)
  if (hasInstanceSteps) {
    const hasStepSnapshot = await knex.schema.hasColumn(
      instanceStepsTable,
      stepSnapshotColumn
    )
    if (!hasStepSnapshot) {
      await knex.schema.alterTable(instanceStepsTable, (table) => {
        table.jsonb(stepSnapshotColumn).nullable()
      })
    }
  }

  const hasFormSnapshots = await knex.schema.hasTable(formSnapshotsTable)
  if (!hasFormSnapshots) {
    await knex.schema.createTable(formSnapshotsTable, (table) => {
      table.string('id', 10).primary()
      table.string('instanceId', 10).notNullable().index()
      table.string('stepId', 10).notNullable().index()
      table.integer('stepIndex').notNullable()
      table.string('snapshotType').notNullable().index()
      table.string('sourceType').notNullable()
      table.string('sourceId').nullable()
      table.string('triggeredBy', 10).notNullable()
      table.string('actionId', 10).nullable().index()
      table.jsonb('formSnapshot').notNullable()
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table
        .foreign('instanceId')
        .references('id')
        .inTable(instancesTable)
        .onDelete('cascade')
      table
        .foreign('stepId')
        .references('id')
        .inTable(instanceStepsTable)
        .onDelete('cascade')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(formSnapshotsTable)

  const hasInstanceSteps = await knex.schema.hasTable(instanceStepsTable)
  if (
    hasInstanceSteps &&
    (await knex.schema.hasColumn(instanceStepsTable, stepSnapshotColumn))
  ) {
    await knex.schema.alterTable(instanceStepsTable, (table) => {
      table.dropColumn(stepSnapshotColumn)
    })
  }

  const hasInstances = await knex.schema.hasTable(instancesTable)
  if (hasInstances) {
    const hasTemplateId = await knex.schema.hasColumn(instancesTable, templateIdColumn)
    const hasDefinitionVersion = await knex.schema.hasColumn(
      instancesTable,
      definitionVersionColumn
    )
    const hasFlowSnapshot = await knex.schema.hasColumn(
      instancesTable,
      flowSnapshotColumn
    )
    if (hasFlowSnapshot || hasDefinitionVersion || hasTemplateId) {
      await knex.schema.alterTable(instancesTable, (table) => {
        if (hasFlowSnapshot) table.dropColumn(flowSnapshotColumn)
        if (hasDefinitionVersion) table.dropColumn(definitionVersionColumn)
        if (hasTemplateId) table.dropColumn(templateIdColumn)
      })
    }
    await knex.schema.alterTable(instancesTable, (table) => {
      table.string('definitionId', 10).notNullable().alter()
    })
  }

  const hasDefinitions = await knex.schema.hasTable(definitionsTable)
  if (hasDefinitions) {
    await knex.raw(`DROP INDEX IF EXISTS ${activePerTemplateUniqueIndex}`)
    await knex.raw(`DROP INDEX IF EXISTS ${templateVersionUniqueIndex}`)

    if (await knex.schema.hasColumn(definitionsTable, templateIdColumn)) {
      await knex.schema.alterTable(definitionsTable, (table) => {
        table.dropColumn(templateIdColumn)
      })
    }
  }
}
