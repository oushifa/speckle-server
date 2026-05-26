import type { Knex } from 'knex'

/**
 * Compatibility migration.
 *
 * Some environments already recorded `20260520193000_create_rvt_conversion_jobs.js`
 * in `knex_migrations`, but the original RVT job module/migration was later removed
 * from the codebase. Knex validates migration history against files on disk, so
 * startup fails if the historical filename disappears.
 *
 * Keeping this no-op migration preserves the migration chain for existing databases
 * while remaining safe for fresh databases where the retired table is no longer used.
 */
export async function up(_knex: Knex): Promise<void> {
  // Intentionally empty: retained only to satisfy historical knex migration records.
}

export async function down(_knex: Knex): Promise<void> {
  // Intentionally empty: the legacy migration is retired and should not be recreated.
}
