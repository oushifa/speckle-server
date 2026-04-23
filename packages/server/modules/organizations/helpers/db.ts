import { buildTableHelper } from '@/modules/core/dbSchema'

export const Departments = buildTableHelper('departments', [
  'id',
  'name',
  'parentId',
  'path',
  'createdAt',
  'updatedAt'
])

export const DepartmentMembers = buildTableHelper('department_members', [
  'departmentId',
  'userId',
  'title',
  'createdAt',
  'updatedAt'
])
