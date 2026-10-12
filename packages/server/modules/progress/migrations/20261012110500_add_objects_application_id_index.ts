import type { Knex } from 'knex'

/**
 * 构件编码反查（`componentCodeLookup.buildComponentCodeLookup`）需要按
 * `data->>'applicationId'` 把业务侧的构件标识映射回 objects。
 *
 * 该表达式此前没有任何索引，而查询条件是
 * `"streamId" = ? AND (id IN (...) OR data->>'applicationId' IN (...))`：
 * 未索引的 OR 分支会让 planner 放弃主键，退化成「每个批次一次整项目扫描」。
 * 有了这个表达式索引，两个分支都能走索引。
 *
 * objects 表通常很大，所以用 CONCURRENTLY 建索引避免长时间持写锁。
 * CONCURRENTLY 不能在事务里执行，因此本迁移显式关闭 knex 的事务包装。
 */
const tableName = 'objects'
const indexName = 'objects_stream_appid_idx'

export const config = { transaction: false }

const indexExists = async (knex: Knex, table: string, index: string) => {
  const res = await knex.raw(
    `SELECT 1
       FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = ?
        AND indexname = ?`,
    [table, index]
  )
  return (res?.rows?.length ?? 0) > 0
}

/**
 * `CREATE INDEX CONCURRENTLY` 中途失败（例如容器被健康检查判死重启、连接断开）
 * 会在 catalog 里留下一个 **INVALID** 的索引。它的名字还在，于是
 * `CREATE INDEX ... IF NOT EXISTS`（以及上面的 indexExists）之后都会直接跳过，
 * 结果这个索引永远无效、也不会报任何错 —— 最隐蔽的失败模式。
 *
 * 所以建之前先把无效的同名索引清掉，让重复部署能自愈。
 */
const dropInvalidIndexIfExists = async (knex: Knex, index: string): Promise<void> => {
  const res = await knex.raw(
    `SELECT 1
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname = ?
        AND NOT i.indisvalid`,
    [index]
  )
  if (!(res?.rows?.length ?? 0)) return

  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${index}`)
}

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  await dropInvalidIndexIfExists(knex, indexName)

  if (await indexExists(knex, tableName, indexName)) return

  await knex.raw(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
       ON ${tableName} ("streamId", ((data->>'applicationId')))`
  )
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  await dropInvalidIndexIfExists(knex, indexName)

  if (!(await indexExists(knex, tableName, indexName))) return

  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`)
}
