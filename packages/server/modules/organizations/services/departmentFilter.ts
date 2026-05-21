import type { Knex } from 'knex'
import { DepartmentMembers } from '@/modules/organizations/helpers/db'

/**
 * 获取用户所属部门的所有用户ID列表
 * 用于基于角色的数据过滤
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

  const departmentIds = userDeps.map((dep) => dep.departmentId)

  // 查询这些部门的所有用户ID
  const departmentUsers = await deps
    .db<{ userId: string }>(DepartmentMembers.name)
    .whereIn(DepartmentMembers.col.departmentId, departmentIds)
    .select(DepartmentMembers.col.userId)

  return [...new Set(departmentUsers.map((u) => u.userId))]
}
