import type {
  CustomRole,
  CustomRoleUserItem,
  EffectivePermission,
  MyEffectivePermission,
  PermissionId
} from '@/modules/custom-role/domain/types'
import { CustomRoles, CustomRoleUsers } from '@/modules/custom-role/helpers/db'
import { ServerAcl, Users } from '@/modules/core/dbSchema'
import { Roles } from '@/modules/core/helpers/mainConstants'
import type { Knex } from 'knex'
import cryptoRandomString from 'crypto-random-string'

const tables = {
  customRoles: (db: Knex) => db<CustomRole>(CustomRoles.name),
  customRoleUsers: (db: Knex) => db(CustomRoleUsers.name)
}

const parsePerms = (value: unknown): PermissionId[] => {
  if (Array.isArray(value)) return value.filter((p): p is string => typeof p === 'string')
  return []
}

const toJsonb = (db: Knex, value: unknown) => db.raw('?::jsonb', [JSON.stringify(value)])

export const listCustomRolesFactory =
  ({ db }: { db: Knex }) =>
  async (): Promise<CustomRole[]> => {
    const rows = await tables
      .customRoles(db)
      .select<CustomRole[]>([
        CustomRoles.col.id,
        CustomRoles.col.name,
        CustomRoles.col.menuPerms,
        CustomRoles.col.modelPerms,
        CustomRoles.col.status,
        CustomRoles.col.createdAt,
        CustomRoles.col.updatedAt
      ])
      .orderBy(CustomRoles.col.createdAt, 'asc')

    return rows.map((row) => ({
      ...row,
      menuPerms: parsePerms(row.menuPerms),
      modelPerms: parsePerms(row.modelPerms)
    }))
  }

export const getCustomRoleFactory =
  ({ db }: { db: Knex }) =>
  async (params: { roleId: string }): Promise<CustomRole | null> => {
    const row =
      (await tables
        .customRoles(db)
        .where({ [CustomRoles.col.id]: params.roleId })
        .first()) || null

    if (!row) return null
    return {
      ...row,
      menuPerms: parsePerms(row.menuPerms),
      modelPerms: parsePerms(row.modelPerms)
    }
  }

export const createCustomRoleFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    name: string
    menuPerms: PermissionId[]
    modelPerms: PermissionId[]
  }): Promise<CustomRole> => {
    const now = new Date()
    const record: CustomRole = {
      id: cryptoRandomString({ length: 10 }),
      name: params.name.trim(),
      menuPerms: params.menuPerms,
      modelPerms: params.modelPerms,
      status: 'active',
      createdAt: now,
      updatedAt: now
    }
    await tables.customRoles(db).insert({
      ...record,
      menuPerms: toJsonb(db, record.menuPerms),
      modelPerms: toJsonb(db, record.modelPerms)
    })
    return record
  }

export const updateCustomRoleNameFactory =
  ({ db }: { db: Knex }) =>
  async (params: { roleId: string; name: string }): Promise<CustomRole | null> => {
    const updated = await tables
      .customRoles(db)
      .where({ [CustomRoles.col.id]: params.roleId })
      .update({
        [CustomRoles.withoutTablePrefix.col.name]: params.name.trim(),
        [CustomRoles.withoutTablePrefix.col.updatedAt]: new Date()
      })
      .returning<CustomRole[]>('*')

    const row = updated[0] || null
    if (!row) return null
    return {
      ...row,
      menuPerms: parsePerms(row.menuPerms),
      modelPerms: parsePerms(row.modelPerms)
    }
  }

export const deleteCustomRoleFactory =
  ({ db }: { db: Knex }) =>
  async (params: { roleId: string }): Promise<boolean> => {
    const deleted = await tables
      .customRoles(db)
      .where({ [CustomRoles.col.id]: params.roleId })
      .del()
    return deleted > 0
  }

export const updateCustomRoleDefaultPermsFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    roleId: string
    menuPerms: PermissionId[]
    modelPerms: PermissionId[]
  }): Promise<CustomRole | null> => {
    const updated = await tables
      .customRoles(db)
      .where({ [CustomRoles.col.id]: params.roleId })
      .update({
        [CustomRoles.withoutTablePrefix.col.menuPerms]: toJsonb(db, params.menuPerms),
        [CustomRoles.withoutTablePrefix.col.modelPerms]: toJsonb(db, params.modelPerms),
        [CustomRoles.withoutTablePrefix.col.updatedAt]: new Date()
      })
      .returning<CustomRole[]>('*')

    const row = updated[0] || null
    if (!row) return null
    return {
      ...row,
      menuPerms: parsePerms(row.menuPerms),
      modelPerms: parsePerms(row.modelPerms)
    }
  }

export const syncRoleDefaultsToNonCustomizedUsersFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    roleId: string
    menuPerms: PermissionId[]
    modelPerms: PermissionId[]
  }): Promise<number> => {
    return await tables
      .customRoleUsers(db)
      .where({
        [CustomRoleUsers.col.roleId]: params.roleId,
        [CustomRoleUsers.col.isCustomized]: false
      })
      .update({
        [CustomRoleUsers.withoutTablePrefix.col.menuPerms]: toJsonb(db, params.menuPerms),
        [CustomRoleUsers.withoutTablePrefix.col.modelPerms]: toJsonb(db, params.modelPerms),
        [CustomRoleUsers.withoutTablePrefix.col.updatedAt]: new Date()
      })
  }

export const listCustomRoleUsersFactory =
  ({ db }: { db: Knex }) =>
  async (params: { roleId: string }): Promise<CustomRoleUserItem[]> => {
    const rows = await tables
      .customRoleUsers(db)
      .join(Users.name, CustomRoleUsers.col.userId, Users.col.id)
      .join(CustomRoles.name, CustomRoleUsers.col.roleId, CustomRoles.col.id)
      .where(CustomRoleUsers.col.roleId, params.roleId)
      .orderBy(Users.col.name, 'asc')
      .select<
        Array<{
          id: string
          roleId: string
          userId: string
          userName: string
          menuPerms: unknown
          modelPerms: unknown
          roleMenuPerms: unknown
          roleModelPerms: unknown
          isCustomized: boolean
          createdAt: Date
          updatedAt: Date
        }>
      >([
        CustomRoleUsers.col.id,
        CustomRoleUsers.col.roleId,
        CustomRoleUsers.col.userId,
        Users.colAs('name', 'userName'),
        CustomRoleUsers.col.menuPerms,
        CustomRoleUsers.col.modelPerms,
        CustomRoles.colAs('menuPerms', 'roleMenuPerms'),
        CustomRoles.colAs('modelPerms', 'roleModelPerms'),
        CustomRoleUsers.col.isCustomized,
        CustomRoleUsers.col.createdAt,
        CustomRoleUsers.col.updatedAt
      ])

    return rows.map((row) => ({
      ...row,
      // 未个性化的用户继承角色默认权限
      menuPerms: parsePerms(row.isCustomized ? row.menuPerms : row.roleMenuPerms),
      modelPerms: parsePerms(row.isCustomized ? row.modelPerms : row.roleModelPerms)
    }))
  }

export const listExistingUserIdsFactory =
  ({ db }: { db: Knex }) =>
  async (params: { userIds: string[] }): Promise<string[]> => {
    if (!params.userIds.length) return []
    const rows = await db(Users.name)
      .whereIn(Users.col.id, params.userIds)
      .select<Array<{ id: string }>>([Users.col.id])
    return rows.map((row) => row.id)
  }

export const addUsersToRoleFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    roleId: string
    userIds: string[]
    menuPerms: PermissionId[]
    modelPerms: PermissionId[]
  }): Promise<number> => {
    const now = new Date()
    const uniqueUserIds = Array.from(new Set(params.userIds.filter(Boolean)))
    if (!uniqueUserIds.length) return 0

    const rows = uniqueUserIds.map((userId) => ({
      id: cryptoRandomString({ length: 10 }),
      roleId: params.roleId,
      userId,
      menuPerms: toJsonb(db, params.menuPerms),
      modelPerms: toJsonb(db, params.modelPerms),
      isCustomized: false,
      createdAt: now,
      updatedAt: now
    }))

    await db(CustomRoleUsers.name)
      .insert(rows)
      .onConflict(CustomRoleUsers.withoutTablePrefix.col.userId)
      .merge({
        roleId: params.roleId,
        menuPerms: toJsonb(db, params.menuPerms),
        modelPerms: toJsonb(db, params.modelPerms),
        isCustomized: false,
        updatedAt: now
      })

    return rows.length
  }

export const updateCustomRoleUserPermsFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    roleId: string
    userId: string
    menuPerms: PermissionId[]
    modelPerms: PermissionId[]
  }): Promise<boolean> => {
    const updated = await tables
      .customRoleUsers(db)
      .where({
        [CustomRoleUsers.col.roleId]: params.roleId,
        [CustomRoleUsers.col.userId]: params.userId
      })
      .update({
        [CustomRoleUsers.withoutTablePrefix.col.menuPerms]: toJsonb(db, params.menuPerms),
        [CustomRoleUsers.withoutTablePrefix.col.modelPerms]: toJsonb(db, params.modelPerms),
        [CustomRoleUsers.withoutTablePrefix.col.isCustomized]: true,
        [CustomRoleUsers.withoutTablePrefix.col.updatedAt]: new Date()
      })
    return updated > 0
  }

export const removeCustomRoleUserFactory =
  ({ db }: { db: Knex }) =>
  async (params: { roleId: string; userId: string }): Promise<boolean> => {
    const removed = await tables
      .customRoleUsers(db)
      .where({
        [CustomRoleUsers.col.roleId]: params.roleId,
        [CustomRoleUsers.col.userId]: params.userId
      })
      .del()
    return removed > 0
  }

export const getEffectivePermissionByUserIdFactory =
  ({ db }: { db: Knex }) =>
  async (params: { userId: string }): Promise<EffectivePermission | null> => {
    const row = await tables
      .customRoleUsers(db)
      .join(CustomRoles.name, CustomRoleUsers.col.roleId, CustomRoles.col.id)
      .where(CustomRoleUsers.col.userId, params.userId)
      .select<
        Array<{
          userId: string
          roleId: string
          roleName: string
          menuPerms: unknown
          modelPerms: unknown
          roleMenuPerms: unknown
          roleModelPerms: unknown
          isCustomized: boolean
          updatedAt: Date
        }>
      >([
        CustomRoleUsers.col.userId,
        CustomRoleUsers.col.roleId,
        CustomRoles.colAs('name', 'roleName'),
        CustomRoleUsers.col.menuPerms,
        CustomRoleUsers.col.modelPerms,
        CustomRoles.colAs('menuPerms', 'roleMenuPerms'),
        CustomRoles.colAs('modelPerms', 'roleModelPerms'),
        CustomRoleUsers.col.isCustomized,
        CustomRoleUsers.col.updatedAt
      ])
      .orderBy(CustomRoleUsers.col.updatedAt, 'desc')
      .first()

    if (!row) return null
    return {
      userId: row.userId,
      roleId: row.roleId,
      roleName: row.roleName,
      // 未个性化的用户继承角色默认权限
      menuPerms: parsePerms(row.isCustomized ? row.menuPerms : row.roleMenuPerms),
      modelPerms: parsePerms(row.isCustomized ? row.modelPerms : row.roleModelPerms),
      isCustomized: row.isCustomized
    }
  }

// NOTE: this factory is intentionally agnostic of any downstream system's
// concrete menu/model permission set. Admin users are flagged via `isAdmin`
// and the caller (e.g. each frontend app) is responsible for bypassing
// permission checks when `isAdmin` is true. This keeps speckle-server as a
// generic authZ provider reusable across multiple systems.
export const getMyEffectivePermissionFactory =
  ({ db }: { db: Knex }) =>
  async (params: { userId: string }): Promise<MyEffectivePermission> => {
    // Check server-level role (admin bypass)
    const aclRow = await db(ServerAcl.name)
      .where({ [ServerAcl.col.userId]: params.userId })
      .select<Array<{ role: string }>>([ServerAcl.col.role])
      .first()
    const isAdmin = aclRow?.role === Roles.Server.Admin
    if (isAdmin) {
      return {
        userId: params.userId,
        roleId: null,
        roleName: null,
        menuPerms: [],
        modelPerms: [],
        isCustomized: false,
        isAdmin: true
      }
    }

    const row = await tables
      .customRoleUsers(db)
      .join(CustomRoles.name, CustomRoleUsers.col.roleId, CustomRoles.col.id)
      .where(CustomRoleUsers.col.userId, params.userId)
      .select<
        Array<{
          userId: string
          roleId: string
          roleName: string
          menuPerms: unknown
          modelPerms: unknown
          roleMenuPerms: unknown
          roleModelPerms: unknown
          isCustomized: boolean
          updatedAt: Date
        }>
      >([
        CustomRoleUsers.col.userId,
        CustomRoleUsers.col.roleId,
        CustomRoles.colAs('name', 'roleName'),
        CustomRoleUsers.col.menuPerms,
        CustomRoleUsers.col.modelPerms,
        CustomRoles.colAs('menuPerms', 'roleMenuPerms'),
        CustomRoles.colAs('modelPerms', 'roleModelPerms'),
        CustomRoleUsers.col.isCustomized,
        CustomRoleUsers.col.updatedAt
      ])
      .orderBy(CustomRoleUsers.col.updatedAt, 'desc')
      .first()

    if (!row) {
      return {
        userId: params.userId,
        roleId: null,
        roleName: null,
        menuPerms: [],
        modelPerms: [],
        isCustomized: false,
        isAdmin: false
      }
    }

    return {
      userId: row.userId,
      roleId: row.roleId,
      roleName: row.roleName,
      // 未个性化的用户继承角色默认权限
      menuPerms: parsePerms(row.isCustomized ? row.menuPerms : row.roleMenuPerms),
      modelPerms: parsePerms(row.isCustomized ? row.modelPerms : row.roleModelPerms),
      isCustomized: row.isCustomized,
      isAdmin: false
    }
  }
