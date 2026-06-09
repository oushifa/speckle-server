import { Router } from 'express'
import { db } from '@/db/knex'
import { Roles } from '@/modules/core/helpers/mainConstants'
import { corsMiddlewareFactory } from '@/modules/core/configs/cors'
import { searchUsersFactory, getUserFactory } from '@/modules/core/repositories/users'
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
      const results = await searchUsers(q, 20, undefined)
      return res.status(200).json({
        data: results.users.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          avatar: u.avatar
        }))
      })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to search users.' })
    }
  })

  return router
}
