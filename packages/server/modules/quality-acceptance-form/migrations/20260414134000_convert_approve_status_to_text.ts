import type { Knex } from 'knex'

const qualityTable = 'quality_acceptance_forms'
const monthlyTable = 'monthly_measurements'
const statusColumn = 'approveStatus'

const toTextCaseExpr = `"${statusColumn}"::text`

export async function up(knex: Knex): Promise<void> {
  const hasQuality = await knex.schema.hasTable(qualityTable)
  if (hasQuality) {
    await knex.raw(`
      ALTER TABLE "${qualityTable}"
      ALTER COLUMN "${statusColumn}" TYPE text
      USING (
        CASE
          WHEN "${statusColumn}" IS NULL THEN NULL
          WHEN ${toTextCaseExpr} = '0' THEN 'PENDING'
          WHEN ${toTextCaseExpr} = '1' THEN 'APPROVED'
          WHEN ${toTextCaseExpr} = '2' THEN 'REJECTED'
          WHEN ${toTextCaseExpr} = '3' THEN 'CANCELLED'
          ELSE UPPER(${toTextCaseExpr})
        END
      )
    `)
    await knex.raw(`
      ALTER TABLE "${qualityTable}"
      ALTER COLUMN "${statusColumn}" DROP DEFAULT
    `)
  }

  const hasMonthly = await knex.schema.hasTable(monthlyTable)
  if (hasMonthly) {
    await knex.raw(`
      ALTER TABLE "${monthlyTable}"
      ALTER COLUMN "${statusColumn}" TYPE text
      USING (
        CASE
          WHEN "${statusColumn}" IS NULL THEN NULL
          WHEN ${toTextCaseExpr} = '0' THEN 'PENDING'
          WHEN ${toTextCaseExpr} = '1' THEN 'APPROVED'
          WHEN ${toTextCaseExpr} = '2' THEN 'REJECTED'
          WHEN ${toTextCaseExpr} = '3' THEN 'CANCELLED'
          ELSE UPPER(${toTextCaseExpr})
        END
      )
    `)
    await knex.raw(`
      ALTER TABLE "${monthlyTable}"
      ALTER COLUMN "${statusColumn}" DROP DEFAULT
    `)
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasQuality = await knex.schema.hasTable(qualityTable)
  if (hasQuality) {
    await knex.raw(`
      ALTER TABLE "${qualityTable}"
      ALTER COLUMN "${statusColumn}" TYPE integer
      USING (
        CASE
          WHEN "${statusColumn}" IS NULL THEN NULL
          WHEN UPPER("${statusColumn}") = 'PENDING' THEN 0
          WHEN UPPER("${statusColumn}") = 'APPROVED' THEN 1
          WHEN UPPER("${statusColumn}") = 'REJECTED' THEN 2
          WHEN UPPER("${statusColumn}") IN ('CANCELED', 'CANCELLED') THEN 3
          WHEN "${statusColumn}" ~ '^[0-9]+$' THEN "${statusColumn}"::integer
          ELSE 0
        END
      )
    `)
    await knex.raw(`
      ALTER TABLE "${qualityTable}"
      ALTER COLUMN "${statusColumn}" SET DEFAULT 0
    `)
  }

  const hasMonthly = await knex.schema.hasTable(monthlyTable)
  if (hasMonthly) {
    await knex.raw(`
      ALTER TABLE "${monthlyTable}"
      ALTER COLUMN "${statusColumn}" TYPE integer
      USING (
        CASE
          WHEN "${statusColumn}" IS NULL THEN NULL
          WHEN UPPER("${statusColumn}") = 'PENDING' THEN 0
          WHEN UPPER("${statusColumn}") = 'APPROVED' THEN 1
          WHEN UPPER("${statusColumn}") = 'REJECTED' THEN 2
          WHEN UPPER("${statusColumn}") IN ('CANCELED', 'CANCELLED') THEN 3
          WHEN "${statusColumn}" ~ '^[0-9]+$' THEN "${statusColumn}"::integer
          ELSE 0
        END
      )
    `)
    await knex.raw(`
      ALTER TABLE "${monthlyTable}"
      ALTER COLUMN "${statusColumn}" SET DEFAULT 0
    `)
  }
}
