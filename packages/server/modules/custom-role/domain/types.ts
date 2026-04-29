export type PermissionId = string

export type CustomRole = {
  id: string
  name: string
  menuPerms: PermissionId[]
  modelPerms: PermissionId[]
  status: 'active' | 'disabled'
  createdAt: Date
  updatedAt: Date
}

export type CustomRoleUser = {
  id: string
  roleId: string
  userId: string
  menuPerms: PermissionId[]
  modelPerms: PermissionId[]
  isCustomized: boolean
  createdAt: Date
  updatedAt: Date
}

export type CustomRoleUserItem = CustomRoleUser & {
  userName: string
}

export type EffectivePermission = {
  userId: string
  roleId: string
  roleName: string
  menuPerms: PermissionId[]
  modelPerms: PermissionId[]
  isCustomized: boolean
}

export type MyEffectivePermission = {
  userId: string
  roleId: string | null
  roleName: string | null
  menuPerms: PermissionId[]
  modelPerms: PermissionId[]
  isCustomized: boolean
  isAdmin: boolean
}
