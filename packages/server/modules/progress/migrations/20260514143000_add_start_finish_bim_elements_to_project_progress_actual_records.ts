import type { Knex } from 'knex'

const tableName = 'project_progress_actual_records'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasStartBimElements = await knex.schema.hasColumn(tableName, 'startBimElements')
  const hasFinishBimElements = await knex.schema.hasColumn(
    tableName,
    'finishBimElements'
  )

  if (!hasStartBimElements || !hasFinishBimElements) {
    await knex.schema.alterTable(tableName, (table) => {
      if (!hasStartBimElements) {
        table.jsonb('startBimElements').nullable()
      }
      if (!hasFinishBimElements) {
        table.jsonb('finishBimElements').nullable()
      }
    })
  }

  if (!hasStartBimElements) {
    await knex(tableName)
      .whereNotNull('bimElements')
      .whereNull('startBimElements')
      .update({
        startBimElements: knex.ref('bimElements')
      })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasStartBimElements = await knex.schema.hasColumn(tableName, 'startBimElements')
  const hasFinishBimElements = await knex.schema.hasColumn(
    tableName,
    'finishBimElements'
  )

  if (!hasStartBimElements && !hasFinishBimElements) return

  await knex.schema.alterTable(tableName, (table) => {
    if (hasStartBimElements) {
      table.dropColumn('startBimElements')
    }
    if (hasFinishBimElements) {
      table.dropColumn('finishBimElements')
    }
  })
}
