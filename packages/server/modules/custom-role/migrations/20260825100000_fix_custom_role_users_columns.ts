import type { Knex } from 'knex'

/**
 * 修复 custom_role_users 表缺失的列与约束。
 *
 * 背景：该表曾被重建（knex_migrations 中记录的 update_custom_roles_to_multi /
 * extend_custom_roles_v2 迁移文件不在代码仓库中），重建后丢失了
 * menuPerms / modelPerms / isCustomized 三列以及 userId 唯一约束，
 * 导致角色成员列表查询报 "column custom_role_users.menuPerms does not exist"。
 *
 * 本迁移幂等：已存在的列/约束将被跳过。
 */
export async function up(knex: Knex): Promise<void> {
  const hasMenuPerms = await knex.schema.hasColumn('custom_role_users', 'menuPerms')
  const hasModelPerms = await knex.schema.hasColumn('custom_role_users', 'modelPerms')
  const hasIsCustomized = await knex.schema.hasColumn(
    'custom_role_users',
    'isCustomized'
  )

  if (!hasMenuPerms || !hasModelPerms || !hasIsCustomized) {
    await knex.schema.alterTable('custom_role_users', (table) => {
      if (!hasMenuPerms) table.jsonb('menuPerms').notNullable().defaultTo('[]')
      if (!hasModelPerms) table.jsonb('modelPerms').notNullable().defaultTo('[]')
      if (!hasIsCustomized) table.boolean('isCustomized').notNullable().defaultTo(false)
    })
  }

  const userIdUnique = await knex('pg_indexes')
    .where({
      tablename: 'custom_role_users',
      indexname: 'custom_role_users_userid_unique'
    })
    .first()

  if (!userIdUnique) {
    // addUsersToRole 依赖 userId 唯一约束执行 onConflict(userId) upsert
    await knex.schema.alterTable('custom_role_users', (table) => {
      table.unique(['userId'], { indexName: 'custom_role_users_userid_unique' })
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('custom_role_users', (table) => {
    table.dropUnique(['userId'], 'custom_role_users_userid_unique')
    table.dropColumns('menuPerms', 'modelPerms', 'isCustomized')
  })
}
