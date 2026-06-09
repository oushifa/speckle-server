import type { Knex } from 'knex'

const tableName = 'project_progress_actual_records'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const [hasStartBIM, hasFinishBIM, hasBIM] = await Promise.all([
    knex.schema.hasColumn(tableName, 'startBIM'),
    knex.schema.hasColumn(tableName, 'finishBIM'),
    knex.schema.hasColumn(tableName, 'BIM')
  ])

  if (!hasStartBIM || !hasFinishBIM || !hasBIM) {
    await knex.schema.alterTable(tableName, (table) => {
      if (!hasStartBIM) table.jsonb('startBIM').nullable()
      if (!hasFinishBIM) table.jsonb('finishBIM').nullable()
      if (!hasBIM) table.jsonb('BIM').nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const [hasStartBIM, hasFinishBIM, hasBIM] = await Promise.all([
    knex.schema.hasColumn(tableName, 'startBIM'),
    knex.schema.hasColumn(tableName, 'finishBIM'),
    knex.schema.hasColumn(tableName, 'BIM')
  ])

  await knex.schema.alterTable(tableName, (table) => {
    if (hasStartBIM) table.dropColumn('startBIM')
    if (hasFinishBIM) table.dropColumn('finishBIM')
    if (hasBIM) table.dropColumn('BIM')
  })
}
