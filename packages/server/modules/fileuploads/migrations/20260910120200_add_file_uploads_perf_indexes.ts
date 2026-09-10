import type { Knex } from 'knex'

/**
 * file_uploads only had index(streamId); the pending-model queries filter on streamId +
 * convertedStatus and order by uploadDate, so the ordering was unindexed.
 * Purely additive - no behaviour change.
 *
 * See the core perf-index migration for the rationale on `if not exists`.
 */
const indexDefinitions: Array<{ name: string; ddl: string }> = [
  {
    name: 'file_uploads_stream_uploaddate_idx',
    ddl: `create index if not exists "file_uploads_stream_uploaddate_idx" on "file_uploads" ("streamId", "uploadDate" desc)`
  }
]

export async function up(knex: Knex): Promise<void> {
  for (const { ddl } of indexDefinitions) {
    await knex.schema.raw(ddl)
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const { name } of indexDefinitions) {
    await knex.schema.raw(`drop index if exists "${name}"`)
  }
}
