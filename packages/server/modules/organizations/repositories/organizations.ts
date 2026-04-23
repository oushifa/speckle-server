import type { Department, DepartmentMember } from '@/modules/organizations/domain/types'
import { DepartmentMembers, Departments } from '@/modules/organizations/helpers/db'
import { Users } from '@/modules/core/dbSchema'
import type { Knex } from 'knex'
import cryptoRandomString from 'crypto-random-string'

type DepartmentUser = {
  id: string
  name: string
  bio: string | null
  company: string | null
  avatar: string | null
  verified: boolean | null
  role: string | null
}

const tables = {
  departments: (db: Knex) => db<Department>(Departments.name),
  departmentMembers: (db: Knex) => db<DepartmentMember>(DepartmentMembers.name)
}

export const listDepartmentsFactory =
  ({ db }: { db: Knex }) =>
  async (): Promise<Department[]> => {
    return await tables
      .departments(db)
      .select<Department[]>([
        Departments.col.id,
        Departments.col.name,
        Departments.col.parentId,
        Departments.col.path,
        Departments.col.createdAt,
        Departments.col.updatedAt
      ])
      .orderBy(Departments.col.path, 'asc')
  }

export const listDepartmentUsersFactory =
  ({ db }: { db: Knex }) =>
  async (params: { departmentId: string }): Promise<DepartmentUser[]> => {
    return await tables
      .departmentMembers(db)
      .join(Users.name, DepartmentMembers.col.userId, Users.col.id)
      .where(DepartmentMembers.col.departmentId, params.departmentId)
      .select<DepartmentUser[]>([
        Users.col.id,
        Users.col.name,
        Users.col.bio,
        Users.col.company,
        Users.col.avatar,
        Users.col.verified,
        DepartmentMembers.colAs('title', 'role')
      ])
      .orderBy(Users.col.name, 'asc')
  }

export const getDepartmentFactory =
  ({ db }: { db: Knex }) =>
  async (params: { departmentId: string }): Promise<Department | null> => {
    return (
      (await tables
        .departments(db)
        .where({ [Departments.col.id]: params.departmentId })
        .first()) || null
    )
  }

export const findDepartmentByNameFactory =
  ({ db }: { db: Knex }) =>
  async (params: { name: string }): Promise<Department | null> => {
    const normalizedName = params.name.trim()
    if (!normalizedName) return null

    return (
      (await tables
        .departments(db)
        .whereRaw('LOWER(??) = LOWER(?)', [Departments.col.name, normalizedName])
        .first()) || null
    )
  }

export const createDepartmentFactory =
  ({ db }: { db: Knex }) =>
  async (params: { name: string; parentId?: string | null }): Promise<Department> => {
    const now = new Date()
    const id = cryptoRandomString({ length: 10 })
    const parent = params.parentId
      ? await tables
          .departments(db)
          .where({ [Departments.col.id]: params.parentId })
          .first()
      : null

    const department: Department = {
      id,
      name: params.name,
      parentId: params.parentId || null,
      path: parent ? `${parent.path}/${id}` : `/${id}`,
      createdAt: now,
      updatedAt: now
    }

    await tables.departments(db).insert(department)
    return department
  }

export const updateDepartmentFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    departmentId: string
    name?: string
    parentId?: string | null
  }): Promise<Department | null> => {
    return await db.transaction(async (trx) => {
      const deps = trx<Department>(Departments.name)
      const current =
        (await deps.where({ [Departments.col.id]: params.departmentId }).first()) ||
        null
      if (!current) return null

      const patch: Partial<Department> = { updatedAt: new Date() }

      if (typeof params.name === 'string') {
        patch.name = params.name
      }

      if (params.parentId !== undefined) {
        if (params.parentId === current.id) return null

        const parent = params.parentId
          ? (await deps.where({ [Departments.col.id]: params.parentId }).first()) ??
            null
          : null

        if (params.parentId && !parent) return null
        if (parent && parent.path.startsWith(`${current.path}/`)) return null

        const newParentId = params.parentId || null
        const newPath = parent ? `${parent.path}/${current.id}` : `/${current.id}`
        patch.parentId = newParentId
        patch.path = newPath

        if (current.path !== newPath) {
          const descendants = await deps
            .whereLike(Departments.col.path, `${current.path}/%`)
            .select<Array<{ id: string; path: string }>>([
              Departments.col.id,
              Departments.col.path
            ])

          for (const descendant of descendants) {
            await deps.where({ [Departments.col.id]: descendant.id }).update({
              [Departments.col.path]: `${newPath}${descendant.path.slice(
                current.path.length
              )}`,
              [Departments.col.updatedAt]: new Date()
            })
          }
        }
      }

      await deps.where({ [Departments.col.id]: current.id }).update(patch)
      return (await deps.where({ [Departments.col.id]: current.id }).first()) || null
    })
  }

export const deleteDepartmentFactory =
  ({ db }: { db: Knex }) =>
  async (params: { departmentId: string }): Promise<boolean> => {
    const deleted = await tables
      .departments(db)
      .where({ [Departments.col.id]: params.departmentId })
      .del()
    return deleted > 0
  }

export const upsertDepartmentMemberFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    departmentId: string
    userId: string
    title?: string | null
  }): Promise<void> => {
    const now = new Date()
    await tables
      .departmentMembers(db)
      .insert({
        departmentId: params.departmentId,
        userId: params.userId,
        title: params.title || null,
        createdAt: now,
        updatedAt: now
      })
      .onConflict([
        DepartmentMembers.withoutTablePrefix.col.departmentId,
        DepartmentMembers.withoutTablePrefix.col.userId
      ])
      .merge({
        title: params.title || null,
        updatedAt: now
      })
  }

export const removeDepartmentMemberFactory =
  ({ db }: { db: Knex }) =>
  async (params: { departmentId: string; userId: string }): Promise<boolean> => {
    const removed = await tables
      .departmentMembers(db)
      .where({
        [DepartmentMembers.col.departmentId]: params.departmentId,
        [DepartmentMembers.col.userId]: params.userId
      })
      .del()
    return removed > 0
  }

export const removeDepartmentMembersByUserFactory =
  ({ db }: { db: Knex }) =>
  async (params: { userId: string }): Promise<number> => {
    return await tables
      .departmentMembers(db)
      .where({
        [DepartmentMembers.col.userId]: params.userId
      })
      .del()
  }

export const getDepartmentMemberFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    departmentId: string
    userId: string
  }): Promise<DepartmentMember | null> => {
    return (
      (await tables
        .departmentMembers(db)
        .where({
          [DepartmentMembers.col.departmentId]: params.departmentId,
          [DepartmentMembers.col.userId]: params.userId
        })
        .first()) || null
    )
  }
