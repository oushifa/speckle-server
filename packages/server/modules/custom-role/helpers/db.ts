import { buildTableHelper } from '@/modules/core/dbSchema'

export const CustomRoles = buildTableHelper('custom_roles', [
  'id',
  'name',
  'menuPerms',
  'modelPerms',
  'status',
  'createdAt',
  'updatedAt'
])

export const CustomRoleUsers = buildTableHelper('custom_role_users', [
  'id',
  'roleId',
  'userId',
  'menuPerms',
  'modelPerms',
  'isCustomized',
  'createdAt',
  'updatedAt'
])
