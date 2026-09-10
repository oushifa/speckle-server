import type { Knex } from 'knex'

/**
 * Performance indexes for the hot read paths behind /graphql (project dashboard, model
 * lists, folder tree, department lists). Purely additive - no behaviour change.
 *
 * `if not exists` is deliberate: on a large live database prefer creating these
 * out-of-band with `CREATE INDEX CONCURRENTLY` during a low-traffic window, after which
 * this migration becomes a no-op instead of holding a write lock while it builds.
 */
const indexDefinitions: Array<{ name: string; ddl: string }> = [
  {
    name: 'branches_stream_updatedat_idx',
    // branches only had pkey(id) + unique(streamId, name), so that
    // `where streamId = ? ... order by updatedAt desc` could seek on the filter but had
    // to aggregate every branch of the project and sort before applying the limit.
    ddl: `create index if not exists "branches_stream_updatedat_idx" on "branches" ("streamId", "updatedAt" desc)`
  },
  {
    name: 'streams_workspaceid_idx',
    // streams.workspaceId was added later and never indexed.
    ddl: `create index if not exists "streams_workspaceid_idx" on "streams" ("workspaceId")`
  },
  {
    name: 'streams_updatedat_idx',
    ddl: `create index if not exists "streams_updatedat_idx" on "streams" ("updatedAt" desc)`
  },
  {
    name: 'stream_acl_resourceid_role_idx',
    // stream_acl's pkey/unique both lead with userId, so resourceId lookups were unindexed.
    ddl: `create index if not exists "stream_acl_resourceid_role_idx" on "stream_acl" ("resourceId", "role")`
  },
  {
    name: 'users_name_idx',
    ddl: `create index if not exists "users_name_idx" on "users" ("name")`
  },
  {
    name: 'user_emails_email_idx',
    // only unique(userId, email) existed, but emails are looked up by email alone.
    ddl: `create index if not exists "user_emails_email_idx" on "user_emails" ("email")`
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
