import { buildTableHelper } from '@/modules/core/dbSchema'

export const CustomRoles = buildTableHelper('custom_roles', [
  'id',
  'name',
  'menuPerms',
  'modelPerms',
  'dataPerm',
  'specialties',
  'sections',
  'status',
  'createdAt',
  'updatedAt'
])

export const CustomRoleUsers = buildTableHelper('custom_role_users', [
  'id',
  'roleId',
  'userId',
  'createdAt',
  'updatedAt'
])
