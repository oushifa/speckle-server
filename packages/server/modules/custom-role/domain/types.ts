export type PermissionId = string

export type CustomRole = {
  id: string
  name: string
  menuPerms: PermissionId[]
  modelPerms: PermissionId[]
  dataPerm: 'all' | 'dept' | 'project' | 'self'
  specialties?: string[]
  sections?: string[]
  status: 'active' | 'disabled'
  createdAt: Date
  updatedAt: Date
}

export type CustomRoleUser = {
  id: string
  roleId: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export type CustomRoleUserItem = CustomRoleUser & {
  userName: string
}

export type EffectivePermission = {
  userId: string
  roleId: string | null
  roleName: string | null
  menuPerms: PermissionId[]
  modelPerms: PermissionId[]
  dataPerms: string[]
}

export type MyEffectivePermission = {
  userId: string
  roleId: string | null
  roleName: string | null
  menuPerms: PermissionId[]
  modelPerms: PermissionId[]
  dataPerms: string[]
  isAdmin: boolean
}
