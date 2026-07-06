import type { Knex } from 'knex'
import { getMyEffectivePermissionFactory } from '@/modules/custom-role/repositories/customRoles'
import { db } from '@/db/knex'

const getMyEffectivePermission = getMyEffectivePermissionFactory({ db })

export interface DataFilterOptions {
  userId: string
  /**
   * 表中代表数据创建者/所属人的列名，默认为 'creatorId'
   */
  creatorCol?: string
  /**
   * 表中代表所属行政部门 ID 的列名，默认为 'departmentId'
   */
  deptCol?: string
  /**
   * 表中代表项目 ID 的列名，默认为 'projectId'
   */
  projectCol?: string
}

/**
 * 通用 Knex 数据隔离条件注入助手 (企业级/项目级多角色数据权限对接)
 */
export async function applyDataPermissionFilter(
  query: Knex.QueryBuilder,
  options: DataFilterOptions
): Promise<Knex.QueryBuilder> {
  const { userId, creatorCol = 'creatorId', deptCol = 'departmentId', projectCol = 'projectId' } = options

  // 1. 获取该用户合并后的有效权限
  const perm = await getMyEffectivePermission({ userId })

  // 2. 超管或者具备全部数据权限（dataPerms 中有 'all'）则直接豁免过滤
  if (perm.isAdmin || perm.dataPerms.includes('all')) {
    return query
  }

  // 3. 构建并集条件进行行级拦截
  query.andWhere((qb) => {
    let hasConditions = false

    // A. 包含本人数据过滤
    if (perm.dataPerms.includes('self')) {
      qb.orWhere(creatorCol, '=', userId)
      hasConditions = true
    }

    // B. 包含本部门数据过滤 (通过子查询关联用户的实际所属行政部门)
    if (perm.dataPerms.includes('dept')) {
      qb.orWhereExists(function () {
        this.select('*')
          .from('users')
          .where({ id: userId })
          .whereRaw(`users."departmentId" = ${deptCol}`)
      })
      hasConditions = true
    }

    // C. 包含本人所在项目数据过滤 (通过子查询关联 Speckle Stream ACL 确定参建项目)
    if (perm.dataPerms.includes('project')) {
      qb.orWhereExists(function () {
        this.select('*')
          .from('stream_acl')
          .where({ userId })
          .whereRaw(`stream_acl."resourceId" = ${projectCol}`)
      })
      hasConditions = true
    }

    // D. 防御性安全边界：若没有任何数据维度（如未分配角色或空权限），则阻断查询
    if (!hasConditions) {
      qb.whereRaw('1 = 0')
    }
  })

  return query
}
