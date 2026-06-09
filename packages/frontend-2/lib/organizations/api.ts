export type Department = {
  id: string
  name: string
  parentId: string | null
  path: string
  children: Department[]
  createdAt: string
  updatedAt: string
}

export type DepartmentUser = {
  id: string
  name: string
  bio: string | null
  company: string | null
  avatar: string | null
  verified: boolean | null
  email: string | null
  role: string | null // 实际上在数据库里存的是 title，在查询里别名为 role
}

export type UserSearchResult = {
  id: string
  name: string
  email: string | null
  avatar: string | null
}

const parseUnknownError = (error: unknown) => {
  if (error instanceof Error) return error.message
  const maybeData = (error as { data?: { error?: string | { message?: string } } })
    ?.data
  const nestedError = maybeData?.error
  if (typeof nestedError === 'string') return nestedError
  if (typeof nestedError?.message === 'string') return nestedError.message
  return '请求失败'
}

// 1. 获取部门树
export async function getDepartmentsTree(params: { apiOrigin: string }): Promise<Department[]> {
  const { apiOrigin } = params
  try {
    const payload = await $fetch<{ data: Department[] }>(
      new URL('/api/v1/organizations/departments', apiOrigin).toString(),
      { method: 'GET' }
    )
    return payload.data || []
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

// 2. 获取指定部门的成员列表
export async function getDepartmentUsers(params: {
  departmentId: string
  apiOrigin: string
}): Promise<DepartmentUser[]> {
  const { departmentId, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: DepartmentUser[] }>(
      new URL(`/api/v1/organizations/departments/${departmentId}/users`, apiOrigin).toString(),
      { method: 'GET' }
    )
    return payload.data || []
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

// 3. 创建部门
export async function createDepartment(params: {
  name: string
  parentId?: string | null
  apiOrigin: string
}): Promise<Department> {
  const { name, parentId, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: Department }>(
      new URL('/api/v1/organizations/departments', apiOrigin).toString(),
      {
        method: 'POST',
        body: { name, parentId }
      }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

// 4. 更新部门
export async function updateDepartment(params: {
  departmentId: string
  name?: string
  parentId?: string | null
  apiOrigin: string
}): Promise<Department> {
  const { departmentId, name, parentId, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: Department }>(
      new URL(`/api/v1/organizations/departments/${departmentId}`, apiOrigin).toString(),
      {
        method: 'PATCH',
        body: { name, parentId }
      }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

// 5. 删除部门
export async function deleteDepartment(params: {
  departmentId: string
  apiOrigin: string
}): Promise<boolean> {
  const { departmentId, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: { success: boolean } }>(
      new URL(`/api/v1/organizations/departments/${departmentId}`, apiOrigin).toString(),
      { method: 'DELETE' }
    )
    return !!payload.data?.success
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

// 6. 为部门添加/更新成员
export async function addDepartmentMembers(params: {
  departmentId: string
  userIds: string[]
  title?: string
  apiOrigin: string
}): Promise<boolean> {
  const { departmentId, userIds, title, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: { success: boolean } }>(
      new URL(`/api/v1/organizations/departments/${departmentId}/members`, apiOrigin).toString(),
      {
        method: 'POST',
        body: { userIds, title }
      }
    )
    return !!payload.data?.success
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

// 7. 从部门中移除成员
export async function removeDepartmentMember(params: {
  departmentId: string
  userId: string
  apiOrigin: string
}): Promise<boolean> {
  const { departmentId, userId, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: { success: boolean } }>(
      new URL(`/api/v1/organizations/departments/${departmentId}/members/${userId}`, apiOrigin).toString(),
      { method: 'DELETE' }
    )
    return !!payload.data?.success
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

// 8. 搜索系统用户
export async function searchSystemUsers(params: {
  query: string
  apiOrigin: string
}): Promise<UserSearchResult[]> {
  const { query, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: UserSearchResult[] }>(
      new URL(`/api/v1/organizations/users/search?q=${encodeURIComponent(query)}`, apiOrigin).toString(),
      { method: 'GET' }
    )
    return payload.data || []
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}
