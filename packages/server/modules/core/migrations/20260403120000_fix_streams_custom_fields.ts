import type { Knex } from 'knex'

/**
 * Compatibility migration.
 *
 * Some environments have this migration recorded in `knex_migrations`, but the
 * original file no longer exists in the repository. Keep the historical name so
 * Knex can validate migration history when switching branches or starting from
 * an older shared database.
 */
export async function up(knex: Knex): Promise<void> {
  void knex
  // Intentionally empty: retained only to satisfy historical knex records.
}

export async function down(knex: Knex): Promise<void> {
  void knex
  // Intentionally empty: the retired migration should not be replayed.
}
