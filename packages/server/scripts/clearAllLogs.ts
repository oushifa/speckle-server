import { knex } from '@/db/knex'
import { logger } from '@/observability/logging'

const SYS_LOG_TABLE = 'sys_log'

const hasFlag = (flag: string) => process.argv.includes(flag)

const usage =
  'Usage: pnpm tsx packages/server/scripts/clearAllLogs.ts [--dry-run] [--force]'

const main = async () => {
  const dryRun = hasFlag('--dry-run')
  const force = hasFlag('--force')

  const row = await knex(SYS_LOG_TABLE).count<{ count: string }[]>('* as count').first()
  const count = Number(row?.count || 0)

  logger.info({ count, dryRun, force }, 'Current sys_log row count')

  if (dryRun || count === 0) return

  if (!force) {
    throw new Error(`Missing --force flag. ${usage}`)
  }

  await knex.raw(`TRUNCATE TABLE ${SYS_LOG_TABLE}`)
  logger.info('All logs were cleared from sys_log')
}

void main()
  .catch((err) => {
    logger.error(err, 'Failed to clear logs')
    process.exitCode = 1
  })
  .finally(async () => {
    await knex.destroy()
  })
