import type { Knex } from 'knex'

/**
 * Performance indexes for the department read paths (department tree + department users),
 * which run on every project dashboard load and on the department management screens.
 * Purely additive - no behaviour change.
 *
 * See the core perf-index migration for the rationale on `if not exists`.
 */
const indexDefinitions: Array<{ name: string; ddl: string }> = [
  {
    name: 'department_members_userid_idx',
    // department_members' primary key is (departmentId, userId), so `where userId = ?`
    // was a sequential scan even though it runs on every dashboard load.
    ddl: `create index if not exists "department_members_userid_idx" on "department_members" ("userId")`
  },
  {
    name: 'departments_path_idx',
    // only parentId was indexed, while the tree is read with `order by path asc`.
    ddl: `create index if not exists "departments_path_idx" on "departments" ("path")`
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
