/* eslint-disable no-restricted-imports */
import '../bootstrap.js'

import { knex } from '@/db/knex'
import { ServerAcl, Users } from '@/modules/core/dbSchema'
import { logger } from '@/observability/logging'
import { Roles } from '@speckle/shared'

const hasFlag = (flag: string) => process.argv.includes(flag)

const getArgValue = (name: string): string | undefined => {
  const prefix = `--${name}=`
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

const getUserIdInput = (): string | undefined => {
  return getArgValue('userId') || process.argv[2]
}

const usage =
  'Usage: pnpm tsx packages/server/scripts/setServerAdmin.ts --userId=<userId> [--dry-run]'

const main = async () => {
  const dryRun = hasFlag('--dry-run')
  const userId = getUserIdInput()

  if (!userId) {
    throw new Error(`Missing userId. ${usage}`)
  }

  const user = await knex(Users.name)
    .where({ [Users.withoutTablePrefix.col.id]: userId })
    .first()

  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  const existingAcl = await knex(ServerAcl.name)
    .where({ [ServerAcl.withoutTablePrefix.col.userId]: userId })
    .first<{ userId: string; role: string }>()

  if (existingAcl?.role === Roles.Server.Admin) {
    logger.info({ userId }, 'User is already server admin')
    return
  }

  if (dryRun) {
    logger.info(
      { userId, previousRole: existingAcl?.role || null, nextRole: Roles.Server.Admin },
      'Dry run: server role update skipped'
    )
    return
  }

  if (existingAcl) {
    await knex(ServerAcl.name)
      .where({ [ServerAcl.withoutTablePrefix.col.userId]: userId })
      .update({ [ServerAcl.withoutTablePrefix.col.role]: Roles.Server.Admin })
  } else {
    await knex(ServerAcl.name).insert({
      [ServerAcl.withoutTablePrefix.col.userId]: userId,
      [ServerAcl.withoutTablePrefix.col.role]: Roles.Server.Admin
    })
  }

  logger.info({ userId }, 'Server role updated to server:admin')
}

void main()
  .catch((err) => {
    logger.error(err, 'Failed to set server admin role')
    process.exitCode = 1
  })
  .finally(async () => {
    await knex.destroy()
  })
