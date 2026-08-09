import { isTsMode } from '@/root'
import fs from 'fs'
import path from 'path'
import { FsMigrations } from 'knex/lib/migrations/migrate/sources/fs-migrations'

type MigrationRecord = {
  file: string
  directory: string
}

/**
 * Default FS migration source, adjusted to ignore migration file extensions - treat .js and .ts the same
 */
export class SpeckleFsMigrations extends FsMigrations {
  constructor(params: { sortDirsSeparately?: boolean; migrationDirs: string[] }) {
    super(params.migrationDirs, params.sortDirsSeparately || false, [])
    this.loadExtensions = isTsMode ? ['.ts'] : ['.js']
  }

  getMigrationName(migration: { file?: string } | string | undefined): string {
    // Replace .ts w/ .js, if in TS mode
    // (operate on cloned string to avoid mutating the original)
    const migrationFile =
      typeof migration === 'string' ? migration : (migration?.file ?? '')
    const fileName = migrationFile.slice().replace(/\.ts$/, '.js')
    return fileName
  }

  async getMigrations(loadExtensions?: readonly string[]) {
    const base = FsMigrations.prototype as unknown as {
      getMigrations: (
        loadExtensions?: readonly string[]
      ) => Promise<Array<MigrationRecord | undefined>>
    }
    const migrations = await base.getMigrations.call(this, loadExtensions)
    return migrations.filter(
      (migration): migration is MigrationRecord =>
        !!migration &&
        typeof migration.file === 'string' &&
        migration.file.length > 0 &&
        typeof migration.directory === 'string' &&
        migration.directory.length > 0
    )
  }

  getMigration(
    migrationInfo: { file?: string; directory?: string } | string | undefined
  ) {
    const base = FsMigrations.prototype as unknown as {
      getMigration: (migrationInfo: MigrationRecord) => unknown
    }

    if (migrationInfo && typeof migrationInfo !== 'string') {
      return base.getMigration.call(this, migrationInfo as MigrationRecord)
    }

    const fileName = migrationInfo
      ? migrationInfo.replace(/\.js$/, isTsMode ? '.ts' : '.js')
      : ''
    if (!fileName) {
      return {
        up: async () => undefined,
        down: async () => undefined
      }
    }
    const migrationDirs = (
      this as unknown as { migrationsPaths?: string[] }
    ).migrationsPaths ?? []

    for (const directory of migrationDirs) {
      const absoluteDir = path.resolve(process.cwd(), directory)
      const fullPath = path.join(absoluteDir, fileName)
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        return base.getMigration.call(this, {
          file: fileName,
          directory
        })
      }
    }

    throw new Error(`Could not resolve migration file: ${migrationInfo ?? 'unknown'}`)
  }
}
