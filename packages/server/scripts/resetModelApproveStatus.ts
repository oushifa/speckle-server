import { knex } from '@/db/knex'
import { Branches } from '@/modules/core/dbSchema'
import { logger } from '@/observability/logging'

const hasFlag = (flag: string) => process.argv.includes(flag)

const main = async () => {
  const dryRun = hasFlag('--dry-run')

  const rowsToUpdate = await knex(Branches.name)
    .whereNotNull(Branches.withoutTablePrefix.col.approveStatus)
    .count<{ count: string }[]>(`${Branches.withoutTablePrefix.col.id} as count`)
    .first()

  const count = Number(rowsToUpdate?.count || 0)
  logger.info({ count, dryRun }, 'Models with non-null approveStatus')

  if (dryRun || count === 0) return

  const updatedCount = await knex(Branches.name)
    .whereNotNull(Branches.withoutTablePrefix.col.approveStatus)
    .update({
      [Branches.withoutTablePrefix.col.approveStatus]: null,
      [Branches.withoutTablePrefix.col.updatedAt]: new Date()
    })

  logger.info({ updatedCount }, 'Reset model approveStatus to null completed')
}

void main()
  .catch((err) => {
    logger.error(err, 'Failed to reset model approveStatus')
    process.exitCode = 1
  })
  .finally(async () => {
    await knex.destroy()
  })
