/* eslint-disable no-restricted-imports */
import '../bootstrap.js'

import { knex } from '@/db/knex'
import { ServerAcl, UserEmails, Users } from '@/modules/core/dbSchema'
import { logger } from '@/observability/logging'

type CliArgs = {
  json: boolean
  limit?: number
  query?: string
}

type UserRow = {
  id: string
  name: string | null
  email: string | null
  verified: boolean | null
  company: string | null
  createdAt: string | Date
  role: string | null
}

const usage = `Usage:
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/listUsers.ts
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/listUsers.ts --limit=20
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/listUsers.ts --query=alice --json`

const hasFlag = (flag: string) => process.argv.includes(flag)

const getArgValue = (name: string): string | undefined => {
  const prefix = `--${name}=`
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

const parseArgs = (): CliArgs => {
  if (hasFlag('--help')) {
    console.log(usage)
    process.exit(0)
  }

  const limitValue = getArgValue('limit')
  const query = getArgValue('query')?.trim() || undefined

  if (limitValue !== undefined) {
    const parsed = Number(limitValue)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`Invalid --limit value: ${limitValue}`)
    }

    return {
      json: hasFlag('--json'),
      limit: parsed,
      query
    }
  }

  return {
    json: hasFlag('--json'),
    query
  }
}

const normalizeRows = (rows: UserRow[]) =>
  rows.map((row) => ({
    ...row,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt)
  }))

const main = async () => {
  const args = parseArgs()
  const primaryEmailsAlias = 'primary_emails'

  const query = knex(Users.name)
    .leftJoin(
      knex(UserEmails.name)
        .select({
          userId: UserEmails.withoutTablePrefix.col.userId,
          email: UserEmails.withoutTablePrefix.col.email,
          verified: UserEmails.withoutTablePrefix.col.verified
        })
        .where({ [UserEmails.withoutTablePrefix.col.primary]: true })
        .as(primaryEmailsAlias),
      `${primaryEmailsAlias}.userId`,
      Users.col.id
    )
    .leftJoin(ServerAcl.name, ServerAcl.col.userId, Users.col.id)
    .select<UserRow[]>([
      knex.ref(Users.col.id).as('id'),
      knex.ref(Users.col.name).as('name'),
      knex.ref(`${primaryEmailsAlias}.email`).as('email'),
      knex.ref(`${primaryEmailsAlias}.verified`).as('verified'),
      knex.ref(Users.col.company).as('company'),
      knex.ref(Users.col.createdAt).as('createdAt'),
      knex.ref(ServerAcl.col.role).as('role')
    ])
    .orderBy(Users.col.createdAt, 'desc')

  if (args.query) {
    query.where((builder) => {
      builder
        .whereILike(Users.col.name, `%${args.query}%`)
        .orWhereILike(Users.col.company, `%${args.query}%`)
        .orWhereILike(`${primaryEmailsAlias}.email`, `%${args.query}%`)
    })
  }

  if (args.limit) {
    query.limit(args.limit)
  }

  const rows = normalizeRows(await query)

  if (args.json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`)
  } else {
    console.table(rows)
  }

  logger.info({ count: rows.length }, 'Fetched users')
}

void main()
  .catch((err) => {
    logger.error({ err, usage }, 'Failed to list users')
    process.exitCode = 1
  })
  .finally(async () => {
    await knex.destroy()
  })
