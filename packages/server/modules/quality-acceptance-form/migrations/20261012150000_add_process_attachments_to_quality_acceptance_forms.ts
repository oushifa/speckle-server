import type { Knex } from 'knex'

const qualityFormsTable = 'quality_acceptance_forms'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(qualityFormsTable)
  if (!hasTable) return

  const hasColumn = await knex.schema.hasColumn(qualityFormsTable, 'processAttachments')
  if (hasColumn) return

  await knex.schema.alterTable(qualityFormsTable, (table) => {
    // 过程文件：与附件（attachments）并列的第二组附件，存 blob id 数组
    table.specificType('processAttachments', 'text[]').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(qualityFormsTable)
  if (!hasTable) return

  const hasColumn = await knex.schema.hasColumn(qualityFormsTable, 'processAttachments')
  if (!hasColumn) return

  await knex.schema.alterTable(qualityFormsTable, (table) => {
    table.dropColumn('processAttachments')
  })
}
