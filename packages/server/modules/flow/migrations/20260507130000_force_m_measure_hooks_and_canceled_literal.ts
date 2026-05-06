import type { Knex } from 'knex'

const flowDefinitionsTable = 'approval_flow_definitions'
const branchesTable = 'branches'
const qualityFormsTable = 'quality_acceptance_forms'
const monthlyMeasurementsTable = 'monthly_measurements'
const monthlyMeasureTemplateId = 'm_measure'

const forcedHooks = {
  onInstancePending: [
    {
      type: 'updateResourceFields',
      fields: {
        approveStatus: '$STATUS'
      }
    }
  ],
  onInstanceApproved: [
    {
      type: 'updateResourceFields',
      fields: {
        approveStatus: '$STATUS'
      }
    }
  ],
  onInstanceRejected: [
    {
      type: 'updateResourceFields',
      fields: {
        approveStatus: '$STATUS'
      }
    }
  ],
  onInstanceCanceled: [
    {
      type: 'updateResourceFields',
      fields: {
        approveStatus: '$STATUS'
      }
    }
  ]
}

const normalizeCanceledLiteral = async (knex: Knex, tableName: string) => {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return
  const hasApproveStatus = await knex.schema.hasColumn(tableName, 'approveStatus')
  if (!hasApproveStatus) return
  await knex(tableName).whereRaw('UPPER("approveStatus") = ?', ['CANCELLED']).update({
    approveStatus: 'CANCELED',
    updatedAt: knex.fn.now()
  })
}

export async function up(knex: Knex): Promise<void> {
  const hasDefinitions = await knex.schema.hasTable(flowDefinitionsTable)
  if (hasDefinitions) {
    await knex(flowDefinitionsTable)
      .where('templateId', monthlyMeasureTemplateId)
      .update({
        effectConfig: knex.raw(
          `COALESCE("effectConfig", '{}'::jsonb) - 'hooks' || jsonb_build_object('hooks', ?::jsonb)`,
          [JSON.stringify(forcedHooks)]
        ),
        updatedAt: knex.fn.now()
      })
  }

  await normalizeCanceledLiteral(knex, branchesTable)
  await normalizeCanceledLiteral(knex, qualityFormsTable)
  await normalizeCanceledLiteral(knex, monthlyMeasurementsTable)
}

export async function down(knex: Knex): Promise<void> {
  const hasDefinitions = await knex.schema.hasTable(flowDefinitionsTable)
  if (!hasDefinitions) return
  // Irreversible migration: we intentionally keep unified CANCELED values and hooks.
}
