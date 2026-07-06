import { Router, type RequestHandler } from 'express'
import { validateRequest } from 'zod-express'
import { z } from 'zod'
import { db } from '@/db/knex'
import { requirePermission } from '@/modules/shared/middleware'
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
  updateCustomRoleDefaultPermsFactory,
  updateCustomRoleNameFactory,
  updateUserRolesFactory
} from '@/modules/custom-role/repositories/customRoles'

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
  modelPerms: permissionArray,
  dataPerm: z.enum(['all', 'dept', 'project', 'self']).default('self'),
  specialties: permissionArray.optional(),
  sections: permissionArray.optional()
})

const patchRoleBody = z.object({
  name: z.string().min(1).max(128)
})

const updateDefaultPermsBody = z.object({
  menuPerms: permissionArray,
  modelPerms: permissionArray,
  dataPerm: z.enum(['all', 'dept', 'project', 'self']).default('self'),
  specialties: permissionArray.optional(),
  sections: permissionArray.optional()
})

const addUsersBody = z.object({
  userIds: z.array(z.string().min(1)).min(1)
})

const updateUserRolesBody = z.object({
  roleIds: z.array(z.string())
})

const listCustomRoles = listCustomRolesFactory({ db })
const getCustomRole = getCustomRoleFactory({ db })
const createCustomRole = createCustomRoleFactory({ db })
const updateCustomRoleName = updateCustomRoleNameFactory({ db })
const deleteCustomRole = deleteCustomRoleFactory({ db })
const listCustomRoleUsers = listCustomRoleUsersFactory({ db })
const listExistingUserIds = listExistingUserIdsFactory({ db })
const addUsersToRole = addUsersToRoleFactory({ db })
const removeCustomRoleUser = removeCustomRoleUserFactory({ db })
const getEffectivePermissionByUserId = getEffectivePermissionByUserIdFactory({ db })
const getMyEffectivePermission = getMyEffectivePermissionFactory({ db })
const updateCustomRoleDefaultPerms = updateCustomRoleDefaultPermsFactory({ db })
const updateUserRoles = updateUserRolesFactory({ db })

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
    requirePermission('permission-management:edit'),
    validateRequest({ body: createRoleBody }),
    async (req, res) => {
      try {
        const role = await createCustomRole({
          name: req.body.name,
          menuPerms: req.body.menuPerms || [],
          modelPerms: req.body.modelPerms || [],
          dataPerm: (req.body.dataPerm || 'self') as 'all' | 'dept' | 'project' | 'self',
          specialties: req.body.specialties || [],
          sections: req.body.sections || []
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
    requirePermission('permission-management:edit'),
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
    requirePermission('permission-management:edit'),
    validateRequest({ params: roleIdParam }),
    async (req, res) => {
      const removed = await deleteCustomRole({ roleId: req.params.roleId })
      if (!removed) return res.status(404).send({ error: 'Role not found.' })
      return res.status(204).send()
    }
  )

  app.patch(
    '/api/v1/custom-roles/:roleId/default-permissions',
    requirePermission('permission-management:edit'),
    validateRequest({ params: roleIdParam, body: updateDefaultPermsBody }),
    async (req, res) => {
      const role = await updateCustomRoleDefaultPerms({
        roleId: req.params.roleId,
        menuPerms: req.body.menuPerms || [],
        modelPerms: req.body.modelPerms || [],
        dataPerm: (req.body.dataPerm || 'self') as 'all' | 'dept' | 'project' | 'self',
        specialties: req.body.specialties || [],
        sections: req.body.sections || []
      })

      if (!role) return res.status(404).send({ error: 'Role not found.' })
      return res.status(200).send(role)
    }
  )

  app.get(
    '/api/v1/custom-roles/:roleId/users',
    validateRequest({ params: roleIdParam }),
    async (req, res) => {
      const role = await getCustomRole({ roleId: req.params.roleId })
      if (!role) return res.status(404).send({ error: 'Role not found.' })
      const users = await listCustomRoleUsers({ roleId: req.params.roleId })
      return res.status(200).send({ items: users })
    }
  )

  app.post(
    '/api/v1/custom-roles/:roleId/users',
    requirePermission('permission-management:edit'),
    validateRequest({ params: roleIdParam, body: addUsersBody }),
    async (req, res) => {
      const role = await getCustomRole({ roleId: req.params.roleId })
      if (!role) return res.status(404).send({ error: 'Role not found.' })

      const existingUserIds = await listExistingUserIds({
        userIds: req.body.userIds
      })
      const existingUserIdSet = new Set(existingUserIds)
      const skippedUserIds = req.body.userIds.filter((id) => !existingUserIdSet.has(id))

      const addedCount = await addUsersToRole({
        roleId: role.id,
        userIds: existingUserIds
      })

      return res.status(200).send({
        addedCount,
        skippedUserIds
      })
    }
  )

  app.delete(
    '/api/v1/custom-roles/:roleId/users/:userId',
    requirePermission('permission-management:edit'),
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

  app.put(
    '/api/v1/custom-roles/users/:userId/roles',
    requirePermission('permission-management:edit'),
    validateRequest({
      params: z.object({
        userId: z.string().min(1)
      }),
      body: updateUserRolesBody
    }),
    async (req, res) => {
      await updateUserRoles({
        userId: req.params.userId,
        roleIds: req.body.roleIds
      })
      return res.status(200).send({ ok: true })
    }
  )

  return app
}
