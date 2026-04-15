import { knex } from '@/db/knex'
import { MonthlyMeasurementItems, MonthlyMeasurements } from '@/modules/core/dbSchema'
import { logger } from '@/observability/logging'

const hasFlag = (flag: string) => process.argv.includes(flag)

const main = async () => {
  const dryRun = hasFlag('--dry-run')

  const [measurementCountRow, itemCountRow] = await Promise.all([
    knex(MonthlyMeasurements.name)
      .count<{ count: string }[]>(
        `${MonthlyMeasurements.withoutTablePrefix.col.id} as count`
      )
      .first(),
    knex(MonthlyMeasurementItems.name)
      .count<{ count: string }[]>(
        `${MonthlyMeasurementItems.withoutTablePrefix.col.id} as count`
      )
      .first()
  ])

  const measurementCount = Number(measurementCountRow?.count || 0)
  const itemCount = Number(itemCountRow?.count || 0)

  logger.info(
    { dryRun, measurementCount, itemCount },
    'Monthly measurement rows to clear'
  )

  if (dryRun || (measurementCount === 0 && itemCount === 0)) return

  const result = await knex.transaction(async (trx) => {
    const deletedItems = await trx(MonthlyMeasurementItems.name).delete()
    const deletedMeasurements = await trx(MonthlyMeasurements.name).delete()
    return { deletedItems, deletedMeasurements }
  })

  logger.info(result, 'Clear monthly measurement data completed')
}

void main()
  .catch((err) => {
    logger.error(err, 'Failed to clear monthly measurement data')
    process.exitCode = 1
  })
  .finally(async () => {
    await knex.destroy()
  })
