import { db } from '@/db/knex'
import type { Resolvers } from '@/modules/core/graph/generated/graphql'
import { getUserFactory } from '@/modules/core/repositories/users'
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
import { ForbiddenError, InvalidArgumentError, NotFoundError } from '@/modules/shared/errors'
import type { GraphQLContext } from '@/modules/shared/helpers/typeHelper'
import { Roles } from '@speckle/shared'
import type { Knex } from 'knex'
import { DepartmentMembers } from '@/modules/organizations/helpers/db'

const listDepartments = listDepartmentsFactory({ db })
const listDepartmentUsers = listDepartmentUsersFactory({ db })
const getDepartment = getDepartmentFactory({ db })
const createDepartment = createDepartmentFactory({ db })
const updateDepartment = updateDepartmentFactory({ db })
const deleteDepartment = deleteDepartmentFactory({ db })
const upsertDepartmentMember = upsertDepartmentMemberFactory({ db })
const removeDepartmentMember = removeDepartmentMemberFactory({ db })
const getDepartmentMember = getDepartmentMemberFactory({ db })
const getUser = getUserFactory({ db })

// 创建查询用户部门的工厂函数
const getUserDepartmentsFactory = (deps: { db: Knex }) => async (userId: string) => {
  return await deps
    .db<{ departmentId: string }>(DepartmentMembers.name)
    .where(DepartmentMembers.col.userId, userId)
    .select(DepartmentMembers.col.departmentId)
}

const getUserDepartments = getUserDepartmentsFactory({ db })

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

/**
 * 获取用户所属的所有部门ID(包括通过部门成员关系关联的部门)
 */
const getUserDepartmentIds = async (
  userId: string,
  departments: Department[]
): Promise<string[]> => {
  const userDepartmentIds = new Set<string>()
  
  // 查询用户直接所属的部门
  const userDeps = await getUserDepartments(userId)
  userDeps.forEach((dep: { departmentId: string }) => userDepartmentIds.add(dep.departmentId))
  
  // 如果没有找到部门,返回空数组
  if (userDepartmentIds.size === 0) {
    return []
  }
  
  // 获取这些部门的所有子部门ID
  const allDepartmentIds = new Set<string>()
  for (const depId of userDepartmentIds) {
    allDepartmentIds.add(depId)
    
    // 查找所有子部门
    const findChildren = (parentId: string) => {
      departments.forEach((dep) => {
        if (dep.parentId === parentId) {
          allDepartmentIds.add(dep.id)
          findChildren(dep.id)
        }
      })
    }
    
    findChildren(depId)
  }
  
  return Array.from(allDepartmentIds)
}

/**
 * 为普通用户过滤部门树,只返回其所属部门及子部门
 */
const filterDepartmentsForUser = async (
  userId: string,
  departments: Department[]
): Promise<DepartmentNode[]> => {
  const userDepartmentIds = await getUserDepartmentIds(userId, departments)
  
  if (userDepartmentIds.length === 0) {
    return []
  }
  
  // 构建完整的部门树
  const fullTree = toDepartmentTree(departments)
  
  // 过滤树,只保留用户有权访问的部门
  const filterTree = (nodes: DepartmentNode[]): DepartmentNode[] => {
    return nodes
      .filter((node) => userDepartmentIds.includes(node.id))
      .map((node) => ({
        ...node,
        children: node.children ? filterTree(node.children) : []
      }))
  }
  
  return filterTree(fullTree)
}

export default {
  Query: {
    departmentTree: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      const departments = await listDepartments()
      
      // 如果是 admin,返回完整的部门树
      if (ctx.role === Roles.Server.Admin) {
        return toDepartmentTree(departments)
      }
      
      // 如果是普通用户,只返回其所属部门及子部门
      if (ctx.userId) {
        return await filterDepartmentsForUser(ctx.userId, departments)
      }
      
      // 未认证用户返回空数组
      return []
    },
    departmentUsers: async (
      _parent: unknown,
      args: { departmentId: string },
      ctx: GraphQLContext
    ) => {
      // 验证用户是否有权限查看该部门的用户
      if (!ctx.userId) {
        throw new ForbiddenError('Authentication required.')
      }
      
      // admin 可以查看所有部门的用户
      if (ctx.role === Roles.Server.Admin) {
        return await listDepartmentUsers({ departmentId: args.departmentId })
      }
      
      // 普通用户只能查看自己所属部门(包括子部门)的用户
      const departments = await listDepartments()
      const userDepartments = await getUserDepartmentIds(ctx.userId, departments)
      
      if (!userDepartments.includes(args.departmentId)) {
        throw new ForbiddenError('You do not have permission to view this department.')
      }
      
      return await listDepartmentUsers({ departmentId: args.departmentId })
    }
  },
  Mutation: {
    departmentMutations: () => ({})
  },
  DepartmentMutations: {
    create: async (
      _parent: unknown,
      args: { input: { name: string; parentId?: string | null } },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new ForbiddenError('Authentication required.')
      const name = args.input.name.trim()
      if (!name) throw new InvalidArgumentError('Department name is required.')

      if (args.input.parentId) {
        const parent = await getDepartment({ departmentId: args.input.parentId })
        if (!parent) throw new NotFoundError('Parent department not found.')
      }

      return await createDepartment({
        name,
        parentId: args.input.parentId
      })
    },
    update: async (
      _parent: unknown,
      args: { input: { id: string; name?: string | null; parentId?: string | null } },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new ForbiddenError('Authentication required.')

      const updated = await updateDepartment({
        departmentId: args.input.id,
        name: args.input.name?.trim() || undefined,
        parentId: args.input.parentId
      })
      if (!updated) {
        throw new InvalidArgumentError('Update failed: invalid department or parent.')
      }

      return updated
    },
    delete: async (_parent: unknown, args: { input: { id: string } }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new ForbiddenError('Authentication required.')
      return await deleteDepartment({ departmentId: args.input.id })
    },
    addMember: async (
      _parent: unknown,
      args: { input: { departmentId: string; userIds: string[]; title?: string | null } },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new ForbiddenError('Authentication required.')

      const userIds = Array.from(new Set(args.input.userIds.filter(Boolean)))
      if (!userIds.length) {
        throw new InvalidArgumentError('At least one userId is required.')
      }

      const dep = await getDepartment({ departmentId: args.input.departmentId })
      if (!dep) throw new NotFoundError('Department not found.')

      const users = await Promise.all(userIds.map((userId) => getUser(userId)))
      const notFoundUserId = users.findIndex((user) => !user)
      if (notFoundUserId >= 0) {
        throw new NotFoundError(`User not found: ${userIds[notFoundUserId]}`)
      }

      await Promise.all(
        userIds.map((userId) =>
          upsertDepartmentMember({
            departmentId: args.input.departmentId,
            userId,
            title: args.input.title
          })
        )
      )
      return true
    },
    updateMember: async (
      _parent: unknown,
      args: { input: { departmentId: string; userIds: string[]; title?: string | null } },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new ForbiddenError('Authentication required.')

      const userIds = Array.from(new Set(args.input.userIds.filter(Boolean)))
      if (!userIds.length) {
        throw new InvalidArgumentError('At least one userId is required.')
      }

      const checks = await Promise.all(
        userIds.map((userId) =>
          getDepartmentMember({
            departmentId: args.input.departmentId,
            userId
          })
        )
      )

      const missingIdx = checks.findIndex((member) => !member)
      if (missingIdx >= 0) {
        throw new NotFoundError(`Department member not found: ${userIds[missingIdx]}`)
      }

      await Promise.all(
        userIds.map((userId) =>
          upsertDepartmentMember({
            departmentId: args.input.departmentId,
            userId,
            title: args.input.title
          })
        )
      )
      return true
    },
    removeMember: async (
      _parent: unknown,
      args: { input: { departmentId: string; userId: string } },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new ForbiddenError('Authentication required.')
      return await removeDepartmentMember({
        departmentId: args.input.departmentId,
        userId: args.input.userId
      })
    }
  },
  Department: {
    children: (parent: DepartmentNode) => {
      return parent.children || []
    }
  }
} as Resolvers
