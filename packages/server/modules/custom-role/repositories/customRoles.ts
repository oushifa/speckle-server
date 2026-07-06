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
        CustomRoles.col.dataPerm,
        CustomRoles.col.specialties,
        CustomRoles.col.sections,
        CustomRoles.col.status,
        CustomRoles.col.createdAt,
        CustomRoles.col.updatedAt
      ])
      .orderBy(CustomRoles.col.createdAt, 'asc')

    return rows.map((row) => ({
      ...row,
      menuPerms: parsePerms(row.menuPerms),
      modelPerms: parsePerms(row.modelPerms),
      specialties: parsePerms(row.specialties),
      sections: parsePerms(row.sections)
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
      modelPerms: parsePerms(row.modelPerms),
      specialties: parsePerms(row.specialties),
      sections: parsePerms(row.sections)
    }
  }

export const createCustomRoleFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    name: string
    menuPerms: PermissionId[]
    modelPerms: PermissionId[]
    dataPerm: 'all' | 'dept' | 'project' | 'self'
    specialties?: string[]
    sections?: string[]
  }): Promise<CustomRole> => {
    const now = new Date()
    const record: CustomRole = {
      id: cryptoRandomString({ length: 10 }),
      name: params.name.trim(),
      menuPerms: params.menuPerms,
      modelPerms: params.modelPerms,
      dataPerm: params.dataPerm,
      specialties: params.specialties || [],
      sections: params.sections || [],
      status: 'active',
      createdAt: now,
      updatedAt: now
    }
    await tables.customRoles(db).insert({
      ...record,
      menuPerms: toJsonb(db, record.menuPerms),
      modelPerms: toJsonb(db, record.modelPerms),
      specialties: toJsonb(db, record.specialties),
      sections: toJsonb(db, record.sections)
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
    dataPerm: 'all' | 'dept' | 'project' | 'self'
    specialties?: string[]
    sections?: string[]
  }): Promise<CustomRole | null> => {
    const updated = await tables
      .customRoles(db)
      .where({ [CustomRoles.col.id]: params.roleId })
      .update({
        [CustomRoles.withoutTablePrefix.col.menuPerms]: toJsonb(db, params.menuPerms),
        [CustomRoles.withoutTablePrefix.col.modelPerms]: toJsonb(db, params.modelPerms),
        [CustomRoles.withoutTablePrefix.col.dataPerm]: params.dataPerm,
        [CustomRoles.withoutTablePrefix.col.specialties]: toJsonb(db, params.specialties || []),
        [CustomRoles.withoutTablePrefix.col.sections]: toJsonb(db, params.sections || []),
        [CustomRoles.withoutTablePrefix.col.updatedAt]: new Date()
      })
      .returning<CustomRole[]>('*')

    const row = updated[0] || null
    if (!row) return null
    return {
      ...row,
      menuPerms: parsePerms(row.menuPerms),
      modelPerms: parsePerms(row.modelPerms),
      specialties: parsePerms(row.specialties),
      sections: parsePerms(row.sections)
    }
  }

export const listCustomRoleUsersFactory =
  ({ db }: { db: Knex }) =>
  async (params: { roleId: string }): Promise<CustomRoleUserItem[]> => {
    const rows = await tables
      .customRoleUsers(db)
      .join(Users.name, CustomRoleUsers.col.userId, Users.col.id)
      .where(CustomRoleUsers.col.roleId, params.roleId)
      .orderBy(Users.col.name, 'asc')
      .select<
        Array<{
          id: string
          roleId: string
          userId: string
          userName: string
          createdAt: Date
          updatedAt: Date
        }>
      >([
        CustomRoleUsers.col.id,
        CustomRoleUsers.col.roleId,
        CustomRoleUsers.col.userId,
        Users.colAs('name', 'userName'),
        CustomRoleUsers.col.createdAt,
        CustomRoleUsers.col.updatedAt
      ])

    return rows
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
  }): Promise<number> => {
    const now = new Date()
    const uniqueUserIds = Array.from(new Set(params.userIds.filter(Boolean)))
    if (!uniqueUserIds.length) return 0

    const rows = uniqueUserIds.map((userId) => ({
      id: cryptoRandomString({ length: 10 }),
      roleId: params.roleId,
      userId,
      createdAt: now,
      updatedAt: now
    }))

    await db(CustomRoleUsers.name)
      .insert(rows)
      .onConflict([
        CustomRoleUsers.withoutTablePrefix.col.roleId,
        CustomRoleUsers.withoutTablePrefix.col.userId
      ])
      .ignore()

    return rows.length
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
    const rows = await tables
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
          dataPerm: string
        }>
      >([
        CustomRoleUsers.col.userId,
        CustomRoleUsers.col.roleId,
        CustomRoles.colAs('name', 'roleName'),
        CustomRoles.col.menuPerms,
        CustomRoles.col.modelPerms,
        CustomRoles.col.dataPerm
      ])

    if (!rows.length) return null

    // Merge logic
    const menuPermsSet = new Set<string>()
    const modelPermsSet = new Set<string>()
    const dataPermsSet = new Set<string>()

    for (const r of rows) {
      parsePerms(r.menuPerms).forEach((p) => menuPermsSet.add(p))
      parsePerms(r.modelPerms).forEach((p) => modelPermsSet.add(p))
      if (r.dataPerm) dataPermsSet.add(r.dataPerm)
    }

    const dataPerms = dataPermsSet.has('all') ? ['all'] : Array.from(dataPermsSet)

    return {
      userId: params.userId,
      roleId: rows[0].roleId,
      roleName: rows[0].roleName,
      menuPerms: Array.from(menuPermsSet),
      modelPerms: Array.from(modelPermsSet),
      dataPerms
    }
  }

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
        dataPerms: ['all'],
        isAdmin: true
      }
    }

    const rows = await tables
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
          dataPerm: string
        }>
      >([
        CustomRoleUsers.col.userId,
        CustomRoleUsers.col.roleId,
        CustomRoles.colAs('name', 'roleName'),
        CustomRoles.col.menuPerms,
        CustomRoles.col.modelPerms,
        CustomRoles.col.dataPerm
      ])

    if (!rows.length) {
      return {
        userId: params.userId,
        roleId: null,
        roleName: null,
        menuPerms: [],
        modelPerms: [],
        dataPerms: [],
        isAdmin: false
      }
    }

    const menuPermsSet = new Set<string>()
    const modelPermsSet = new Set<string>()
    const dataPermsSet = new Set<string>()

    for (const r of rows) {
      parsePerms(r.menuPerms).forEach((p) => menuPermsSet.add(p))
      parsePerms(r.modelPerms).forEach((p) => modelPermsSet.add(p))
      if (r.dataPerm) dataPermsSet.add(r.dataPerm)
    }

    const dataPerms = dataPermsSet.has('all') ? ['all'] : Array.from(dataPermsSet)

    return {
      userId: params.userId,
      roleId: rows[0].roleId,
      roleName: rows[0].roleName,
      menuPerms: Array.from(menuPermsSet),
      modelPerms: Array.from(modelPermsSet),
      dataPerms,
      isAdmin: false
    }
  }

export const updateUserRolesFactory =
  ({ db }: { db: Knex }) =>
  async (params: { userId: string; roleIds: string[] }): Promise<void> => {
    const now = new Date()
    await db.transaction(async (trx) => {
      // Delete existing relations
      await trx(CustomRoleUsers.name)
        .where({ [CustomRoleUsers.col.userId]: params.userId })
        .del()

      // Insert new relations
      if (params.roleIds.length > 0) {
        const rows = params.roleIds.map((roleId) => ({
          id: cryptoRandomString({ length: 10 }),
          roleId,
          userId: params.userId,
          createdAt: now,
          updatedAt: now
        }))
        await trx(CustomRoleUsers.name).insert(rows)
      }
    })
  }
