import { Router } from 'express'
import { db } from '@/db/knex'
import { Roles } from '@/modules/core/helpers/mainConstants'
import { corsMiddlewareFactory } from '@/modules/core/configs/cors'
import { searchUsersFactory, getUserFactory } from '@/modules/core/repositories/users'
import cryptoRandomString from 'crypto-random-string'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcrypt'
import {
  createDepartmentFactory,
  deleteDepartmentFactory,
  getDepartmentFactory,
  getDepartmentMemberFactory,
  listDepartmentsFactory,
  listDepartmentUsersFactory,
  removeDepartmentMemberFactory,
  updateDepartmentFactory,
  upsertDepartmentMemberFactory
} from '@/modules/organizations/repositories/organizations'
import type { Department } from '@/modules/organizations/domain/types'

type DepartmentNode = Department & { children: DepartmentNode[] }

const toDepartmentTree = (departments: Department[]): DepartmentNode[] => {
  const byParent = new Map<string | null, DepartmentNode[]>()
  for (const dep of departments) {
    const parentKey = dep.parentId || null
    const arr = byParent.get(parentKey) || []
    arr.push({ ...dep, children: [] })
    byParent.set(parentKey, arr)
  }

  const build = (parentId: string | null): DepartmentNode[] => {
    const children = byParent.get(parentId) || []
    return children.map((node) => ({ ...node, children: build(node.id) }))
  }

  return build(null)
}

export const organizationsRouterFactory = (): Router => {
  const router = Router()
  const corsMiddleware = corsMiddlewareFactory({
    corsConfig: {
      origin: true,
      credentials: true
    }
  })

  // 依赖工厂实例化
  const listDepartments = listDepartmentsFactory({ db })
  const listDepartmentUsers = listDepartmentUsersFactory({ db })
  const getDepartment = getDepartmentFactory({ db })
  const createDepartment = createDepartmentFactory({ db })
  const updateDepartment = updateDepartmentFactory({ db })
  const deleteDepartment = deleteDepartmentFactory({ db })
  const upsertDepartmentMember = upsertDepartmentMemberFactory({ db })
  const removeDepartmentMember = removeDepartmentMemberFactory({ db })
  const getDepartmentMember = getDepartmentMemberFactory({ db })
  const searchUsers = searchUsersFactory({ db })
  const getUser = getUserFactory({ db })

  // 统一鉴权中间件：要求登录
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.context || !req.context.auth || !req.context.userId) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    next()
  }

  // 统一鉴权中间件：仅系统管理员有权写
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.context || !req.context.auth || !req.context.userId) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    if (req.context.role !== Roles.Server.Admin) {
      return res.status(403).json({ error: 'Forbidden: Admin role required.' })
    }
    next()
  }

  // OPTIONS 跨域预检
  router.options('/api/v1/organizations/departments', corsMiddleware)
  router.options('/api/v1/organizations/departments/:id', corsMiddleware)
  router.options('/api/v1/organizations/departments/:id/users', corsMiddleware)
  router.options('/api/v1/organizations/departments/:id/members', corsMiddleware)
  router.options('/api/v1/organizations/departments/:id/members/:userId', corsMiddleware)
  router.options('/api/v1/organizations/users/search', corsMiddleware)

  // 1. 获取完整的部门树 (登录用户均可访问)
  router.get('/api/v1/organizations/departments', corsMiddleware, requireAuth, async (req, res) => {
    try {
      const departments = await listDepartments()
      const tree = toDepartmentTree(departments)
      return res.status(200).json({ data: tree })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to fetch department tree.' })
    }
  })

  // 2. 获取指定部门的成员列表 (登录用户均可访问)
  router.get('/api/v1/organizations/departments/:id/users', corsMiddleware, requireAuth, async (req, res) => {
    try {
      const departmentId = req.params.id
      const users = await listDepartmentUsers({ departmentId })
      return res.status(200).json({ data: users })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to fetch department users.' })
    }
  })

  // 3. 创建部门 (限管理员)
  router.post('/api/v1/organizations/departments', corsMiddleware, requireAdmin, async (req, res) => {
    try {
      const { name, parentId } = req.body
      const normalizedName = (name || '').trim()
      if (!normalizedName) {
        return res.status(400).json({ error: 'Department name is required.' })
      }

      if (parentId) {
        const parent = await getDepartment({ departmentId: parentId })
        if (!parent) {
          return res.status(404).json({ error: 'Parent department not found.' })
        }
      }

      const dep = await createDepartment({ name: normalizedName, parentId })
      return res.status(201).json({ data: dep })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to create department.' })
    }
  })

  // 4. 更新部门 (限管理员)
  router.patch('/api/v1/organizations/departments/:id', corsMiddleware, requireAdmin, async (req, res) => {
    try {
      const id = req.params.id
      const { name, parentId } = req.body

      const updated = await updateDepartment({
        departmentId: id,
        name: typeof name === 'string' ? name.trim() : undefined,
        parentId
      })

      if (!updated) {
        return res.status(400).json({ error: 'Update failed: invalid department or parent.' })
      }

      return res.status(200).json({ data: updated })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to update department.' })
    }
  })

  // 5. 删除部门 (限管理员)
  router.delete('/api/v1/organizations/departments/:id', corsMiddleware, requireAdmin, async (req, res) => {
    try {
      const id = req.params.id
      const deleted = await deleteDepartment({ departmentId: id })
      return res.status(200).json({ data: { success: deleted } })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to delete department.' })
    }
  })

  // 6. 添加/更新部门成员 (限管理员)
  router.post('/api/v1/organizations/departments/:id/members', corsMiddleware, requireAdmin, async (req, res) => {
    try {
      const departmentId = req.params.id
      const { userIds, title } = req.body

      if (!Array.isArray(userIds) || !userIds.length) {
        return res.status(400).json({ error: 'At least one userId is required.' })
      }

      const dep = await getDepartment({ departmentId })
      if (!dep) {
        return res.status(404).json({ error: 'Department not found.' })
      }

      // 验证用户是否存在
      const cleanUserIds = Array.from(new Set(userIds.filter(Boolean)))
      const users = await Promise.all(cleanUserIds.map((uid) => getUser(uid)))
      const missingIndex = users.findIndex((u) => !u)
      if (missingIndex >= 0) {
        return res.status(404).json({ error: `User not found: ${cleanUserIds[missingIndex]}` })
      }

      await Promise.all(
        cleanUserIds.map((userId) =>
          upsertDepartmentMember({
            departmentId,
            userId,
            title
          })
        )
      )

      return res.status(200).json({ data: { success: true } })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to add department members.' })
    }
  })

  // 7. 移除部门成员 (限管理员)
  router.delete('/api/v1/organizations/departments/:id/members/:userId', corsMiddleware, requireAdmin, async (req, res) => {
    try {
      const { id: departmentId, userId } = req.params
      const removed = await removeDepartmentMember({ departmentId, userId })
      return res.status(200).json({ data: { success: removed } })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to remove department member.' })
    }
  })

  // 8. 辅助接口：模糊检索用户 (登录用户均可访问)
  router.get('/api/v1/organizations/users/search', corsMiddleware, requireAuth, async (req, res) => {
    try {
      const q = (req.query.q as string) || ''
      const results = await searchUsers(q, 100, undefined) // 提高检索上限便于列表加载
      const userIds = results.users.map((u: any) => u.id)

      let rawUsers: any[] = []
      if (userIds.length > 0) {
        rawUsers = await db('users')
          .leftJoin('user_emails', 'users.id', 'user_emails.userId')
          .whereIn('users.id', userIds)
          .select({
            id: 'users.id',
            phone: 'users.phone',
            email: 'user_emails.email'
          })
      }
      const rawUserMap = new Map<string, any>()
      for (const ru of rawUsers) {
        if (!rawUserMap.has(ru.id) || (ru.email && !rawUserMap.get(ru.id).email)) {
          rawUserMap.set(ru.id, ru)
        }
      }

      let userDepts: Array<{ userId: string; departmentId: string; departmentName: string }> = []
      if (userIds.length > 0) {
        userDepts = await db('department_members')
          .join('departments', 'department_members.departmentId', 'departments.id')
          .whereIn('department_members.userId', userIds)
          .select({
            userId: 'department_members.userId',
            departmentId: 'department_members.departmentId',
            departmentName: 'departments.name'
          })
      }
      const deptMap = new Map<string, { id: string; name: string }>()
      for (const ud of userDepts) {
        deptMap.set(ud.userId, { id: ud.departmentId, name: ud.departmentName })
      }

      let userAcls: Array<{ userId: string; role: string }> = []
      if (userIds.length > 0) {
        userAcls = await db('server_acl').whereIn('userId', userIds).select('userId', 'role')
      }
      const aclMap = new Map<string, string>()
      for (const acl of userAcls) {
        aclMap.set(acl.userId, acl.role)
      }

      // 联查真实最后登录时间（仅限于 sys_log 登录成功的日志记录，支持按 userId 匹配，或旧数据按 target_id 忽略大小写匹配邮箱）
      let lastLoginTimes: Array<{ user_id: string; target_id: string; last_login: Date }> = []
      if (userIds.length > 0) {
        const emails = rawUsers.map((ru) => ru.email).filter(Boolean)
        const lowerEmails = emails.map((e) => e.toLowerCase())
        lastLoginTimes = await db('sys_log')
          .where('action', 'system.user.login')
          .andWhere('result_status', 'success')
          .andWhere(function () {
            this.whereIn('user_id', userIds)
            if (lowerEmails.length > 0) {
              this.orWhereRaw('LOWER(target_id) IN (' + lowerEmails.map(() => '?').join(',') + ')', lowerEmails)
            }
          })
          .groupBy('user_id', 'target_id')
          .select('user_id', 'target_id')
          .max('event_time as last_login')
      }

      const lastLoginMap = new Map<string, string>()
      const emailToUserId = new Map<string, string>()
      for (const ru of rawUsers) {
        if (ru.email) {
          emailToUserId.set(ru.email.toLowerCase(), ru.id)
        }
      }

      for (const item of lastLoginTimes) {
        const userId = item.user_id || (item.target_id ? emailToUserId.get(item.target_id.toLowerCase()) : null)
        if (userId) {
          const currentMax = lastLoginMap.get(userId)
          const newTime = new Date(item.last_login).toISOString()
          if (!currentMax || newTime > currentMax) {
            lastLoginMap.set(userId, newTime)
          }
        }
      }

      // 联查真实项目（Stream）及项目角色
      let userProjectRoles: Array<{ userId: string; projectName: string; role: string }> = []
      if (userIds.length > 0) {
        userProjectRoles = await db('stream_acl')
          .join('streams', 'stream_acl.resourceId', 'streams.id')
          .whereIn('stream_acl.userId', userIds)
          .select({
            userId: 'stream_acl.userId',
            projectName: 'streams.name',
            role: 'stream_acl.role'
          })
      }
      const projectRolesMap = new Map<string, Array<{ projectName: string; role: string }>>()
      for (const item of userProjectRoles) {
        if (!projectRolesMap.has(item.userId)) {
          projectRolesMap.set(item.userId, [])
        }
        projectRolesMap.get(item.userId)!.push({
          projectName: item.projectName,
          role: item.role
        })
      }

      // 联查真实已分配自定义角色
      let userCustomRoles: Array<{ userId: string; roleId: string; roleName: string }> = []
      if (userIds.length > 0) {
        userCustomRoles = await db('custom_role_users')
          .join('custom_roles', 'custom_role_users.roleId', 'custom_roles.id')
          .whereIn('custom_role_users.userId', userIds)
          .select({
            userId: 'custom_role_users.userId',
            roleId: 'custom_role_users.roleId',
            roleName: 'custom_roles.name'
          })
      }
      const customRolesMap = new Map<string, Array<{ id: string; name: string }>>()
      for (const item of userCustomRoles) {
        if (!customRolesMap.has(item.userId)) {
          customRolesMap.set(item.userId, [])
        }
        customRolesMap.get(item.userId)!.push({
          id: item.roleId,
          name: item.roleName
        })
      }

      return res.status(200).json({
        data: results.users.map((u: any) => {
          const raw = rawUserMap.get(u.id) || {}
          return {
            id: u.id,
            name: u.name,
            email: raw.email || u.email || '',
            avatar: u.avatar,
            phone: raw.phone || '',
            department: deptMap.get(u.id) || null,
            role: aclMap.get(u.id) || 'server:user',
            createdAt: u.createdAt,
            lastLogin: lastLoginMap.get(u.id) || null,
            projectRoles: projectRolesMap.get(u.id) || [],
            customRoles: customRolesMap.get(u.id) || []
          }
        })
      })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to search users.' })
    }
  })

  // 9. 创建新用户 (限管理员)
  router.post('/api/v1/organizations/users', corsMiddleware, requireAdmin, async (req, res) => {
    try {
      const { name, email, phone, departmentId, role } = req.body
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required.' })
      }
      const normalizedEmail = email.trim().toLowerCase()
      // 检查邮箱是否已存在
      const existing = await db('user_emails').where('email', normalizedEmail).first()
      if (existing) {
        return res.status(400).json({ error: 'Email address already exists.' })
      }

      const userId = cryptoRandomString({ length: 10 })
      const suuid = uuidv4()
      const passwordDigest = await bcrypt.hash('Srj@6666', 10) // 默认密码
      const now = new Date()

      await db.transaction(async (trx) => {
        // 1. 插入 users 表
        await trx('users').insert({
          id: userId,
          suuid,
          createdAt: now,
          name: name.trim(),
          email: normalizedEmail,
          phone: phone ? phone.trim() : null,
          passwordDigest,
          verified: true
        })

        // 2. 插入 user_emails 表
        await trx('user_emails').insert({
          id: cryptoRandomString({ length: 10 }),
          userId,
          email: normalizedEmail,
          verified: true,
          createdAt: now
        })

        // 3. 插入 server_acl 表
        await trx('server_acl').insert({
          userId,
          role: role || 'server:user'
        })

        // 4. 插入 department_members 表 (如果提供了部门 ID)
        if (departmentId) {
          await trx('department_members').insert({
            departmentId,
            userId,
            title: '普通职员',
            createdAt: now,
            updatedAt: now
          })
        }
      })

      return res.status(201).json({ id: userId, name, email, phone, role })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to create user.' })
    }
  })

  // 10. 编辑用户基本信息与角色/部门 (限管理员)
  router.put('/api/v1/organizations/users/:userId', corsMiddleware, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.userId
      const { email, phone, departmentId, role, status } = req.body

      // 检查用户是否存在
      const user = await db('users').where('id', userId).first()
      if (!user) {
        return res.status(404).json({ error: 'User not found.' })
      }

      await db.transaction(async (trx) => {
        const now = new Date()
        
        // 1. 更新基本字段
        const updateData: any = {}
        if (phone !== undefined) updateData.phone = phone ? phone.trim() : null
        if (email !== undefined) updateData.email = email.trim().toLowerCase()
        
        if (Object.keys(updateData).length > 0) {
          await trx('users').where('id', userId).update(updateData)
        }

        // 如果邮箱有变更，同步更新 user_emails 表
        if (email !== undefined) {
          const normalizedEmail = email.trim().toLowerCase()
          const emailRec = await trx('user_emails').where('userId', userId).first()
          if (emailRec) {
            await trx('user_emails').where('userId', userId).update({ email: normalizedEmail })
          } else {
            await trx('user_emails').insert({
              id: cryptoRandomString({ length: 10 }),
              userId,
              email: normalizedEmail,
              verified: true,
              createdAt: now
            })
          }
        }

        // 2. 更新状态和角色
        if (status === 'inactive') {
          await trx('server_acl').where('userId', userId).update({ role: 'server:archived-user' })
        } else if (role) {
          await trx('server_acl').where('userId', userId).update({ role })
        } else if (status === 'active') {
          // 若启用且无显式角色传入，确保其移出归档状态
          const currentAcl = await trx('server_acl').where('userId', userId).first()
          if (currentAcl && currentAcl.role === 'server:archived-user') {
            await trx('server_acl').where('userId', userId).update({ role: 'server:user' })
          }
        }

        // 3. 更新行政部门关联
        if (departmentId !== undefined) {
          // 删除旧部门关联
          await trx('department_members').where('userId', userId).del()
          if (departmentId) {
            await trx('department_members').insert({
              departmentId,
              userId,
              title: '普通职员',
              createdAt: now,
              updatedAt: now
            })
          }
        }
      })

      return res.status(200).json({ success: true })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to update user.' })
    }
  })

  // 11. 删除用户 (限管理员)
  router.delete('/api/v1/organizations/users/:userId', corsMiddleware, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.userId
      const user = await db('users').where('id', userId).first()
      if (!user) {
        return res.status(404).json({ error: 'User not found.' })
      }

      await db.transaction(async (trx) => {
        // 删除相关的 ACL、邮箱和部门记录
        await trx('server_acl').where('userId', userId).del()
        await trx('user_emails').where('userId', userId).del()
        await trx('department_members').where('userId', userId).del()
        await trx('custom_role_users').where('userId', userId).del()
        // 最后删除主用户表记录
        await trx('users').where('id', userId).del()
      })

      return res.status(200).json({ success: true })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to delete user.' })
    }
  })

  // 12. 批量授权角色 (限管理员)
  router.post('/api/v1/organizations/users/batch-auth', corsMiddleware, requireAdmin, async (req, res) => {
    try {
      const { userIds, role } = req.body
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'userIds array is required and must not be empty.' })
      }
      if (!role) {
        return res.status(400).json({ error: 'Role is required.' })
      }

      await db.transaction(async (trx) => {
        await trx('server_acl').whereIn('userId', userIds).update({ role })
      })

      return res.status(200).json({ success: true })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to batch authorize users.' })
    }
  })

  return router
}
