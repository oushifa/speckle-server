import type { Logger } from 'pino'
import {
  dropLogPartitionFactory,
  listSysLogPartitionsFactory
} from '@/modules/logs/repositories/logs'
import type { Knex } from 'knex'

const partitionNameRegex = /^sys_log_(\d{6})$/

const parsePartitionMonth = (partitionName: string): Date | null => {
  const matches = partitionName.match(partitionNameRegex)
  if (!matches) return null

  const value = matches[1]
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6))
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) return null

  return new Date(Date.UTC(year, month - 1, 1))
}

const isOlderThanRetention = (partitionMonthStart: Date, retentionMonths: number): boolean => {
  const now = new Date()
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (retentionMonths - 1), 1)
  )

  return partitionMonthStart < cutoff
}

export const cleanupExpiredLogPartitionsFactory =
  ({ db }: { db: Knex }) =>
  async ({
    retentionMonths,
    logger
  }: {
    retentionMonths: number
    logger: Logger
  }) => {
    const listPartitions = listSysLogPartitionsFactory({ db })
    const dropPartition = dropLogPartitionFactory({ db })
    const partitionNames = await listPartitions()

    const expiredPartitions = partitionNames.filter((partitionName) => {
      const monthStart = parsePartitionMonth(partitionName)
      if (!monthStart) return false
      return isOlderThanRetention(monthStart, retentionMonths)
    })

    for (const partitionName of expiredPartitions) {
      await dropPartition({ partitionName })
      logger.info({ partitionName }, 'Dropped expired sys_log partition')
    }
  }
