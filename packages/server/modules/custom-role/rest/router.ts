import { Router, type RequestHandler } from 'express'
import { validateRequest } from 'zod-express'
import { z } from 'zod'
import { db } from '@/db/knex'
import {
  addUsersToRoleFactory,
  createCustomRoleFactory,
  deleteCustomRoleFactory,
  getCustomRoleFactory,
  getEffectivePermissionByUserIdFactory,
  getMyEffectivePermissionFactory,
  listCustomRolesFactory,
  listCustomRoleUsersFactory,
  listExistingUserIdsFactory,
  removeCustomRoleUserFactory,
  syncRoleDefaultsToNonCustomizedUsersFactory,
  updateCustomRoleDefaultPermsFactory,
  updateCustomRoleNameFactory,
  updateCustomRoleUserPermsFactory
} from '@/modules/custom-role/repositories/customRoles'
import { listDepartmentsFactory, listDepartmentUsersFactory } from '@/modules/organizations/repositories/organizations'
import { DepartmentMembers } from '@/modules/organizations/helpers/db'
import { Roles } from '@speckle/shared'

const permissionArray = z
  .array(z.string())
  .default([])
  .transform((arr) => Array.from(new Set(arr)))

const roleIdParam = z.object({
  roleId: z.string().min(1)
})

const roleIdAndUserIdParam = z.object({
  roleId: z.string().min(1),
  userId: z.string().min(1)
})

const createRoleBody = z.object({
  name: z.string().min(1).max(128),
  menuPerms: permissionArray,
  modelPerms: permissionArray
})

const patchRoleBody = z.object({
  name: z.string().min(1).max(128)
})

const updateDefaultPermsBody = z.object({
  menuPerms: permissionArray,
  modelPerms: permissionArray,
  syncNonCustomizedUsers: z.boolean().optional().default(true)
})

const addUsersBody = z.object({
  userIds: z.array(z.string().min(1)).min(1)
})

const updateUserPermsBody = z.object({
  menuPerms: permissionArray,
  modelPerms: permissionArray
})

const listCustomRoles = listCustomRolesFactory({ db })
const getCustomRole = getCustomRoleFactory({ db })
const createCustomRole = createCustomRoleFactory({ db })
const updateCustomRoleName = updateCustomRoleNameFactory({ db })
const deleteCustomRole = deleteCustomRoleFactory({ db })
const listCustomRoleUsers = listCustomRoleUsersFactory({ db })
const listExistingUserIds = listExistingUserIdsFactory({ db })
const addUsersToRole = addUsersToRoleFactory({ db })
const updateCustomRoleUserPerms = updateCustomRoleUserPermsFactory({ db })
const removeCustomRoleUser = removeCustomRoleUserFactory({ db })
const getEffectivePermissionByUserId = getEffectivePermissionByUserIdFactory({ db })

// Admin users are signalled via `isAdmin: true` in the response; the caller
// (each frontend app) is responsible for bypassing permission checks when
// `isAdmin` is true, so this server-side factory stays agnostic of any
// particular system's menu/model permission names.
const getMyEffectivePermission = getMyEffectivePermissionFactory({ db })

const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.context.auth || !req.context.userId) {
    return res.status(401).send({ error: 'Authentication required.' })
  }
  return next()
}

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' &&
  !!error &&
  'code' in error &&
  (error as { code?: string }).code === '23505'

export const customRoleRouterFactory = (): Router => {
  const app = Router()

  app.use('/api/v1/custom-roles', requireAuth)

  app.get('/api/v1/custom-roles', async (_req, res) => {
    const roles = await listCustomRoles()
    return res.status(200).send({ items: roles })
  })

  app.post(
    '/api/v1/custom-roles',
    validateRequest({ body: createRoleBody }),
    async (req, res) => {
      try {
        const role = await createCustomRole({
          name: req.body.name,
          menuPerms: req.body.menuPerms || [],
          modelPerms: req.body.modelPerms || []
        })
        return res.status(201).send(role)
      } catch (error) {
        if (isUniqueViolation(error)) {
          return res.status(409).send({ error: 'Role name already exists.' })
        }
        throw error
      }
    }
  )

  app.patch(
    '/api/v1/custom-roles/:roleId',
    validateRequest({ params: roleIdParam, body: patchRoleBody }),
    async (req, res) => {
      try {
        const role = await updateCustomRoleName({
          roleId: req.params.roleId,
          name: req.body.name
        })
        if (!role) return res.status(404).send({ error: 'Role not found.' })
        return res.status(200).send(role)
      } catch (error) {
        if (isUniqueViolation(error)) {
          return res.status(409).send({ error: 'Role name already exists.' })
        }
        throw error
      }
    }
  )

  app.delete(
    '/api/v1/custom-roles/:roleId',
    validateRequest({ params: roleIdParam }),
    async (req, res) => {
      const removed = await deleteCustomRole({ roleId: req.params.roleId })
      if (!removed) return res.status(404).send({ error: 'Role not found.' })
      return res.status(204).send()
    }
  )

  app.patch(
    '/api/v1/custom-roles/:roleId/default-permissions',
    validateRequest({ params: roleIdParam, body: updateDefaultPermsBody }),
    async (req, res) => {
      const updated = await db.transaction(async (trx) => {
        const updateRoleDefaults = updateCustomRoleDefaultPermsFactory({ db: trx })
        const syncUsers = syncRoleDefaultsToNonCustomizedUsersFactory({ db: trx })

        const role = await updateRoleDefaults({
          roleId: req.params.roleId,
          menuPerms: req.body.menuPerms || [],
          modelPerms: req.body.modelPerms || []
        })
        if (!role) return null

        let syncedUserCount = 0
        if (req.body.syncNonCustomizedUsers) {
          syncedUserCount = await syncUsers({
            roleId: req.params.roleId,
            menuPerms: req.body.menuPerms || [],
            modelPerms: req.body.modelPerms || []
          })
        }

        return {
          role,
          syncedUserCount
        }
      })

      if (!updated) return res.status(404).send({ error: 'Role not found.' })
      return res.status(200).send(updated)
    }
  )

  app.get(
    '/api/v1/custom-roles/:roleId/users',
    validateRequest({ params: roleIdParam }),
    async (req, res) => {
      const role = await getCustomRole({ roleId: req.params.roleId })
      if (!role) return res.status(404).send({ error: 'Role not found.' })
      
      const users = await listCustomRoleUsers({ roleId: req.params.roleId })
      
      // 如果不是 admin,需要根据部门过滤用户
      const currentUserRole = req.context.role
      const currentUserId = req.context.userId
      
      if (currentUserRole !== Roles.Server.Admin && currentUserId) {
        const listDepartments = listDepartmentsFactory({ db })
        const listDepartmentUsers = listDepartmentUsersFactory({ db })
        
        // 获取用户所属的部门ID
        const userDeps = await db<{ departmentId: string }>(DepartmentMembers.name)
          .where(DepartmentMembers.col.userId, currentUserId)
          .select(DepartmentMembers.col.departmentId)
        
        const userDepartmentIds = userDeps.map((d: { departmentId: string }) => d.departmentId)
        
        if (userDepartmentIds.length > 0) {
          // 获取所有部门
          const allDepartments = await listDepartments()
          
          // 收集用户有权访问的部门ID(包括子部门)
          const accessibleDepartmentIds = new Set<string>()
          for (const depId of userDepartmentIds) {
            accessibleDepartmentIds.add(depId)
            
            // 递归查找所有子部门
            const findChildren = (parentId: string) => {
              allDepartments.forEach((dep) => {
                if (dep.parentId === parentId) {
                  accessibleDepartmentIds.add(dep.id)
                  findChildren(dep.id)
                }
              })
            }
            
            findChildren(depId)
          }
          
          // 获取这些部门的所有用户ID
          const accessibleUserIds = new Set<string>()
          for (const depId of accessibleDepartmentIds) {
            const deptUsers = await listDepartmentUsers({ departmentId: depId })
            deptUsers.forEach((u: { id: string }) => accessibleUserIds.add(u.id))
          }
          
          // 过滤用户列表
          const filteredUsers = users.filter((u: { userId: string }) => accessibleUserIds.has(u.userId))
          
          return res.status(200).send({ items: filteredUsers })
        }
        
        // 如果用户不属于任何部门,返回空结果
        return res.status(200).send({ items: [] })
      }
      
      return res.status(200).send({ items: users })
    }
  )

  app.post(
    '/api/v1/custom-roles/:roleId/users',
    validateRequest({ params: roleIdParam, body: addUsersBody }),
    async (req, res) => {
      const role = await getCustomRole({ roleId: req.params.roleId })
      if (!role) return res.status(404).send({ error: 'Role not found.' })

      // 如果不是 admin,需要验证用户只能添加自己部门的用户
      const currentUserRole = req.context.role
      const currentUserId = req.context.userId
      
      let userIdsToAdd = req.body.userIds
      
      if (currentUserRole !== Roles.Server.Admin && currentUserId) {
        const listDepartments = listDepartmentsFactory({ db })
        const listDepartmentUsers = listDepartmentUsersFactory({ db })
        
        // 获取用户所属的部门ID
        const userDeps = await db<{ departmentId: string }>(DepartmentMembers.name)
          .where(DepartmentMembers.col.userId, currentUserId)
          .select(DepartmentMembers.col.departmentId)
        
        const userDepartmentIds = userDeps.map((d: { departmentId: string }) => d.departmentId)
        
        if (userDepartmentIds.length > 0) {
          // 获取所有部门
          const allDepartments = await listDepartments()
          
          // 收集用户有权访问的部门ID(包括子部门)
          const accessibleDepartmentIds = new Set<string>()
          for (const depId of userDepartmentIds) {
            accessibleDepartmentIds.add(depId)
            
            // 递归查找所有子部门
            const findChildren = (parentId: string) => {
              allDepartments.forEach((dep) => {
                if (dep.parentId === parentId) {
                  accessibleDepartmentIds.add(dep.id)
                  findChildren(dep.id)
                }
              })
            }
            
            findChildren(depId)
          }
          
          // 获取这些部门的所有用户ID
          const accessibleUserIds = new Set<string>()
          for (const depId of accessibleDepartmentIds) {
            const deptUsers = await listDepartmentUsers({ departmentId: depId })
            deptUsers.forEach((u: { id: string }) => accessibleUserIds.add(u.id))
          }
          
          // 过滤出用户有权添加的用户ID
          userIdsToAdd = userIdsToAdd.filter((id: string) => accessibleUserIds.has(id))
        } else {
          // 如果用户不属于任何部门,不允许添加任何用户
          userIdsToAdd = []
        }
      }

      const existingUserIds = await listExistingUserIds({
        userIds: userIdsToAdd
      })
      const existingUserIdSet = new Set(existingUserIds)
      const skippedUserIds = userIdsToAdd.filter((id: string) => !existingUserIdSet.has(id))

      const addedCount = await addUsersToRole({
        roleId: role.id,
        userIds: existingUserIds,
        menuPerms: role.menuPerms,
        modelPerms: role.modelPerms
      })

      return res.status(200).send({
        addedCount,
        skippedUserIds
      })
    }
  )

  app.patch(
    '/api/v1/custom-roles/:roleId/users/:userId/permissions',
    validateRequest({ params: roleIdAndUserIdParam, body: updateUserPermsBody }),
    async (req, res) => {
      const ok = await updateCustomRoleUserPerms({
        roleId: req.params.roleId,
        userId: req.params.userId,
        menuPerms: req.body.menuPerms || [],
        modelPerms: req.body.modelPerms || []
      })
      if (!ok) return res.status(404).send({ error: 'Role user not found.' })
      return res.status(200).send({ ok: true })
    }
  )

  app.delete(
    '/api/v1/custom-roles/:roleId/users/:userId',
    validateRequest({ params: roleIdAndUserIdParam }),
    async (req, res) => {
      const removed = await removeCustomRoleUser({
        roleId: req.params.roleId,
        userId: req.params.userId
      })
      if (!removed) return res.status(404).send({ error: 'Role user not found.' })
      return res.status(204).send()
    }
  )

  app.get('/api/v1/custom-roles/me/permissions', async (req, res) => {
    const userId = req.context.userId as string
    const item = await getMyEffectivePermission({ userId })
    return res.status(200).send(item)
  })

  app.get(
    '/api/v1/custom-roles/users/:userId/effective-permissions',
    validateRequest({
      params: z.object({
        userId: z.string().min(1)
      })
    }),
    async (req, res) => {
      const item = await getEffectivePermissionByUserId({
        userId: req.params.userId
      })
      if (!item) return res.status(404).send({ error: 'User permissions not found.' })
      return res.status(200).send(item)
    }
  )

  return app
}
