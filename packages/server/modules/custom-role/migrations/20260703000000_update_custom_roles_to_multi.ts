import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. 修改 custom_roles 表，添加 dataPerm 字段
  await knex.schema.alterTable('custom_roles', (table) => {
    table.string('dataPerm', 32).notNullable().defaultTo('self')
  })

  // 2. 修改 custom_role_users 表
  await knex.schema.alterTable('custom_role_users', (table) => {
    // 删除 userId 的唯一约束
    table.dropUnique(['userId'])
    // 删除冗余字段
    table.dropColumn('menuPerms')
    table.dropColumn('modelPerms')
    table.dropColumn('isCustomized')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('custom_role_users', (table) => {
    table.jsonb('menuPerms').notNullable().defaultTo('[]')
    table.jsonb('modelPerms').notNullable().defaultTo('[]')
    table.boolean('isCustomized').notNullable().defaultTo(false)
    table.unique(['userId'])
  })

  await knex.schema.alterTable('custom_roles', (table) => {
    table.dropColumn('dataPerm')
  })
}
