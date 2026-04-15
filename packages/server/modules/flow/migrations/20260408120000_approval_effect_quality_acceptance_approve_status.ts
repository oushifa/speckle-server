import type { Knex } from 'knex'

const formsTable = 'quality_acceptance_forms'
const nameColumn = 'name'
const codeColumn = 'code'
const inspectionLotNumberColumn = 'inspectionLotNumber'
const acceptancePartColumn = 'acceptancePart'
const actualStartDateColumn = 'actualStartDate'
const actualFinishDateColumn = 'actualFinishDate'
const inspectorColumn = 'inspector'
const workVolumeColumn = 'workVolume'
const unitColumn = 'unit'
const bimElementColumn = 'bimElements'
const timeZoneColumn = 'timeZone'
const approveStatusColumn = 'approveStatus'
const createdAtColumn = 'createdAt'
const updatedAtColumn = 'updatedAt'
const approveStatusIndex = 'quality_acceptance_forms_approve_status_idx'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(formsTable)
  if (!hasTable) return
  const [
    hasName,
    hasCode,
    hasInspectionLotNumber,
    hasAcceptancePart,
    hasActualStartDate,
    hasActualFinishDate,
    hasInspector,
    hasWorkVolume,
    hasUnit,
    hasBimElement,
    hasTimeZone,
    hasApproveStatus,
    hasCreatedAt,
    hasUpdatedAt
  ] = await Promise.all([
    knex.schema.hasColumn(formsTable, nameColumn),
    knex.schema.hasColumn(formsTable, codeColumn),
    knex.schema.hasColumn(formsTable, inspectionLotNumberColumn),
    knex.schema.hasColumn(formsTable, acceptancePartColumn),
    knex.schema.hasColumn(formsTable, actualStartDateColumn),
    knex.schema.hasColumn(formsTable, actualFinishDateColumn),
    knex.schema.hasColumn(formsTable, inspectorColumn),
    knex.schema.hasColumn(formsTable, workVolumeColumn),
    knex.schema.hasColumn(formsTable, unitColumn),
    knex.schema.hasColumn(formsTable, bimElementColumn),
    knex.schema.hasColumn(formsTable, timeZoneColumn),
    knex.schema.hasColumn(formsTable, approveStatusColumn),
    knex.schema.hasColumn(formsTable, createdAtColumn),
    knex.schema.hasColumn(formsTable, updatedAtColumn)
  ])
  await knex.schema.alterTable(formsTable, (table) => {
    if (!hasName) table.string(nameColumn).nullable()
    if (!hasCode) table.string(codeColumn).nullable()
    if (!hasInspectionLotNumber) table.string(inspectionLotNumberColumn).nullable()
    if (!hasAcceptancePart) table.string(acceptancePartColumn).nullable()
    if (!hasActualStartDate) table.bigInteger(actualStartDateColumn).nullable()
    if (!hasActualFinishDate) table.bigInteger(actualFinishDateColumn).nullable()
    if (!hasInspector) table.string(inspectorColumn).nullable()
    if (!hasWorkVolume) table.float(workVolumeColumn).nullable()
    if (!hasUnit) table.string(unitColumn).nullable()
    if (!hasBimElement) table.jsonb(bimElementColumn).nullable()
    if (!hasTimeZone) table.string(timeZoneColumn).nullable()
    if (!hasApproveStatus) {
      table.integer(approveStatusColumn).nullable()
      table.index([approveStatusColumn], approveStatusIndex)
    }
    if (!hasCreatedAt) {
      table.timestamp(createdAtColumn).notNullable().defaultTo(knex.fn.now())
    }
    if (!hasUpdatedAt) {
      table.timestamp(updatedAtColumn).notNullable().defaultTo(knex.fn.now())
    }
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(formsTable)
  if (!hasTable) return
  const [
    hasName,
    hasCode,
    hasInspectionLotNumber,
    hasAcceptancePart,
    hasActualStartDate,
    hasActualFinishDate,
    hasInspector,
    hasWorkVolume,
    hasUnit,
    hasBimElement,
    hasTimeZone,
    hasApproveStatus,
    hasCreatedAt,
    hasUpdatedAt
  ] = await Promise.all([
    knex.schema.hasColumn(formsTable, nameColumn),
    knex.schema.hasColumn(formsTable, codeColumn),
    knex.schema.hasColumn(formsTable, inspectionLotNumberColumn),
    knex.schema.hasColumn(formsTable, acceptancePartColumn),
    knex.schema.hasColumn(formsTable, actualStartDateColumn),
    knex.schema.hasColumn(formsTable, actualFinishDateColumn),
    knex.schema.hasColumn(formsTable, inspectorColumn),
    knex.schema.hasColumn(formsTable, workVolumeColumn),
    knex.schema.hasColumn(formsTable, unitColumn),
    knex.schema.hasColumn(formsTable, bimElementColumn),
    knex.schema.hasColumn(formsTable, timeZoneColumn),
    knex.schema.hasColumn(formsTable, approveStatusColumn),
    knex.schema.hasColumn(formsTable, createdAtColumn),
    knex.schema.hasColumn(formsTable, updatedAtColumn)
  ])
  await knex.schema.alterTable(formsTable, (table) => {
    if (hasUpdatedAt) table.dropColumn(updatedAtColumn)
    if (hasCreatedAt) table.dropColumn(createdAtColumn)
    if (hasApproveStatus) {
      table.dropIndex([approveStatusColumn], approveStatusIndex)
      table.dropColumn(approveStatusColumn)
    }
    if (hasTimeZone) table.dropColumn(timeZoneColumn)
    if (hasBimElement) table.dropColumn(bimElementColumn)
    if (hasUnit) table.dropColumn(unitColumn)
    if (hasWorkVolume) table.dropColumn(workVolumeColumn)
    if (hasInspector) table.dropColumn(inspectorColumn)
    if (hasActualFinishDate) table.dropColumn(actualFinishDateColumn)
    if (hasActualStartDate) table.dropColumn(actualStartDateColumn)
    if (hasAcceptancePart) table.dropColumn(acceptancePartColumn)
    if (hasInspectionLotNumber) table.dropColumn(inspectionLotNumberColumn)
    if (hasCode) table.dropColumn(codeColumn)
    if (hasName) table.dropColumn(nameColumn)
  })
}
