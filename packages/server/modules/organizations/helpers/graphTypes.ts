import type { Nullable } from '@/modules/shared/helpers/typeHelper'

export type DepartmentGraphQLReturn = {
  id: string
  name: string
  parentId: Nullable<string>
  path: string
  createdAt: Date
  updatedAt: Date
  children?: DepartmentGraphQLReturn[]
}
