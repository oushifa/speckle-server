import type { Nullable } from '@/modules/shared/helpers/typeHelper'

export type Department = {
  id: string
  name: string
  parentId: Nullable<string>
  path: string
  createdAt: Date
  updatedAt: Date
}

export type DepartmentMember = {
  departmentId: string
  userId: string
  title: Nullable<string>
  createdAt: Date
  updatedAt: Date
}
