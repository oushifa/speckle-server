import type { Knex } from 'knex'

const tableName = 'branches'
const colProjectId = 'projectId'
const indexName = 'branches_project_id_idx'

/**
 * 图纸库（drawings）中的模型以共享存储项目中的 branch 形式存在。
 * 新增 projectId 用于标记该 branch 归属的业务项目，实现图纸库按项目隔离。
 * 普通模型 branch 该字段为空，不影响既有查询。
 */
export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(tableName, colProjectId)
  if (hasColumn) return

  await knex.schema.alterTable(tableName, (table) => {
    table.string(colProjectId, 10).nullable().index(indexName)
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(tableName, colProjectId)
  if (!hasColumn) return

  // Postgres 在删除列时会一并删除其索引
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(colProjectId)
  })
}
