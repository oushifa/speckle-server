import type { Knex } from 'knex'
import { DepartmentMembers, Departments } from '@/modules/organizations/helpers/db'

/**
 * 获取用户所属部门（含所有父部门和子部门）的所有用户ID列表
 * 用于基于角色的数据过滤：与组织架构可见口径一致（所属部门上下级整条链）
 */
export const getDepartmentUserIdsFactory = (deps: { db: Knex }) => async (userId: string) => {
  // 先查询用户直接所属的部门
  const userDeps = await deps
    .db<{ departmentId: string }>(DepartmentMembers.name)
    .where(DepartmentMembers.col.userId, userId)
    .select(DepartmentMembers.col.departmentId)

  if (userDeps.length === 0) {
    return []
  }

  // 收集用户所属部门及其所有父部门、子部门
  const departmentIds = new Set<string>(userDeps.map((dep) => dep.departmentId))

  // 加载全部部门用于递归查找父子部门
  const allDepartments = await deps
    .db<{ id: string; parentId: string | null }>(Departments.name)
    .select(Departments.col.id, Departments.col.parentId)

  const byId = new Map(allDepartments.map((dep) => [dep.id, dep]))

  // 递归向上收集父部门
  const collectParents = (departmentId: string) => {
    const dep = byId.get(departmentId)
    if (dep?.parentId && !departmentIds.has(dep.parentId)) {
      departmentIds.add(dep.parentId)
      collectParents(dep.parentId)
    }
  }

  // 递归向下收集子部门
  const collectChildren = (parentId: string) => {
    for (const dep of allDepartments) {
      if (dep.parentId === parentId && !departmentIds.has(dep.id)) {
        departmentIds.add(dep.id)
        collectChildren(dep.id)
      }
    }
  }

  // 仅对用户直接所属部门展开祖先链与后代链（与组织架构 getUserDepartmentIds 口径一致）
  const initialDepartmentIds = [...departmentIds]
  for (const departmentId of initialDepartmentIds) {
    collectParents(departmentId)
    collectChildren(departmentId)
  }

  // 查询这些部门的所有用户ID
  const departmentUsers = await deps
    .db<{ userId: string }>(DepartmentMembers.name)
    .whereIn(DepartmentMembers.col.departmentId, [...departmentIds])
    .select(DepartmentMembers.col.userId)

  return [...new Set(departmentUsers.map((u) => u.userId))]
}
