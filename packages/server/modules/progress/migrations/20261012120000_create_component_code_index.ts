import type { Knex } from 'knex'

/**
 * 构件编码索引表：把「构件编码 <-> applicationId」的解析结果物化下来，
 * 让外部查询接口不再需要碰 objects。
 *
 * 关键设计：
 *
 * 1. **一张共享表，按 (project_id, model_id) 切片**，不是每个模型版本建一张表。
 *    模型重新导入时只重写自己那一片。
 * 2. 每行都带 `commit_id`（建这份切片时的模型版本）。读路径拿它和该模型当前
 *    最新版本比对：**一致才敢信任索引**，否则回退到实时解析。这是防止
 *    「索引没建好 → 静默返回查不到」的关键。
 * 3. `application_id = ''`（`component_code = ''`）的行是该模型切片的**状态行**，
 *    在重建事务的最后写入。这样读取切片状态只需要一次小范围索引扫描，而
 *    「删旧 + 插新 + 写状态」在同一个事务里，中途失败会整体回滚，不会留下
 *    「看起来新鲜但其实是半份」的切片。
 * 4. 正向（编码 → applicationId）与反向（applicationId → 编码）都要用：
 *    - 反向走主键前缀 (project_id, model_id, application_id)；
 *    - 正向单独建索引。
 */
const tableName = 'component_code_index'
const codeIndex = 'component_code_index_code_idx'
const stateIndex = 'component_code_index_state_idx'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (hasTable) return

  await knex.schema.createTable(tableName, (table) => {
    table.string('project_id').notNullable()
    table.string('model_id').notNullable()
    table.string('commit_id').notNullable()
    // '' 表示该模型切片的状态行
    table.string('application_id').notNullable()
    table.string('object_id').nullable()
    // 状态行为 ''
    table.string('component_code').notNullable()
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

    // 反向查询（applicationId → 编码）直接用这个前缀，不需要额外索引
    table.primary(['project_id', 'model_id', 'application_id', 'component_code'])
  })

  // 正向查询：构件编码 → applicationId
  await knex.schema.alterTable(tableName, (table) => {
    table.index(['project_id', 'component_code'], codeIndex)
  })

  // 切片状态行（每模型一行），部分索引避免扫到大量构件行
  await knex.raw(
    `CREATE INDEX ${stateIndex} ON ${tableName} (project_id, model_id) WHERE application_id = ''`
  )
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  await knex.raw(`DROP INDEX IF EXISTS ${stateIndex}`)
  await knex.schema.dropTableIfExists(tableName)
}
