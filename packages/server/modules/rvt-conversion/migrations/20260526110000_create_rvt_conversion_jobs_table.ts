import type { Knex } from 'knex'

const tableName = 'rvt_conversion_jobs'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (hasTable) return

  await knex.schema.createTable(tableName, (table) => {
    table.string('id', 10).primary()
    table.string('projectId', 64).notNullable()
    table.string('modelId', 64).notNullable()
    table.string('sourceFileId', 64).notNullable()
    table.string('sourceFileName', 512).notNullable()
    table.text('sourceObjectKey').notNullable()
    table.integer('sourceFileSize').nullable()
    table.text('versionMessage').nullable()
    table.string('sourceApplication', 128).nullable()
    table.string('status', 32).notNullable()
    table.string('externalTaskId', 128).nullable()
    table.string('versionId', 64).nullable()
    table.text('errorMessage').nullable()
    table.timestamp('dispatchedAt', { precision: 3, useTz: true }).nullable()
    table.timestamp('acknowledgedAt', { precision: 3, useTz: true }).nullable()
    table.timestamp('finishedAt', { precision: 3, useTz: true }).nullable()
    table.string('creator').notNullable()
    table.string('updater').notNullable()
    table
      .timestamp('createdAt', { precision: 3, useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
    table
      .timestamp('updatedAt', { precision: 3, useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())

    table.index(['projectId', 'modelId', 'createdAt'], `${tableName}_model_created_at_idx`)
    table.index(['status', 'createdAt'], `${tableName}_status_created_at_idx`)
    table.index(['creator', 'createdAt'], `${tableName}_creator_created_at_idx`)
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (hasTable) {
    await knex.schema.dropTable(tableName)
  }
}
