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

export default {
  Query: {
    departmentTree: async () => {
      const departments = await listDepartments()
      return toDepartmentTree(departments)
    },
    departmentUsers: async (_parent: unknown, args: { departmentId: string }) => {
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
