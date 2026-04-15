import { knex } from '@/db/knex'
import { QualityAcceptanceForms } from '@/modules/core/dbSchema'
import { logger } from '@/observability/logging'

const hasFlag = (flag: string) => process.argv.includes(flag)

const main = async () => {
  const dryRun = hasFlag('--dry-run')

  const rowsToUpdate = await knex(QualityAcceptanceForms.name)
    .whereNotNull(QualityAcceptanceForms.withoutTablePrefix.col.approveStatus)
    .count<{ count: string }[]>(
      `${QualityAcceptanceForms.withoutTablePrefix.col.id} as count`
    )
    .first()

  const count = Number(rowsToUpdate?.count || 0)
  logger.info({ count, dryRun }, 'Quality acceptance forms with non-null approveStatus')

  if (dryRun || count === 0) return

  const updatedCount = await knex(QualityAcceptanceForms.name)
    .whereNotNull(QualityAcceptanceForms.withoutTablePrefix.col.approveStatus)
    .update({
      [QualityAcceptanceForms.withoutTablePrefix.col.approveStatus]: null,
      [QualityAcceptanceForms.withoutTablePrefix.col.updatedAt]: new Date()
    })

  logger.info(
    { updatedCount },
    'Reset quality acceptance approveStatus to null completed'
  )
}

void main()
  .catch((err) => {
    logger.error(err, 'Failed to reset quality acceptance approveStatus')
    process.exitCode = 1
  })
  .finally(async () => {
    await knex.destroy()
  })
