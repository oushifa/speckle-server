import { ref, computed } from 'vue'
import { useActiveUser } from './activeUser'

export interface CustomUserPermissions {
  userId: string | null
  roleId: string | null
  roleName: string | null
  menuPerms: string[]
  modelPerms: string[]
  dataPerms: string[]
  isAdmin: boolean
}

// 全局单例权限状态缓存
const permissionState = ref<CustomUserPermissions>({
  userId: null,
  roleId: null,
  roleName: null,
  menuPerms: [],
  modelPerms: [],
  dataPerms: [],
  isAdmin: false
})

const isInitialized = ref(false)
const isLoading = ref(false)

export function useCustomPermissions() {
  const { userId, isLoggedIn, activeUser, isAdmin } = useActiveUser()
  const apiOrigin = useApiOrigin()

  const initializePermissions = async (force = false) => {
    if (!isLoggedIn.value || !userId.value) {
      permissionState.value = {
        userId: null,
        roleId: null,
        roleName: null,
        menuPerms: [],
        modelPerms: [],
        dataPerms: [],
        isAdmin: false
      }
      isInitialized.value = false
      return
    }

    if (isInitialized.value && !force && permissionState.value.userId === userId.value) {
      return
    }

    isLoading.value = true
    try {
      // 1. 如果是系统级超管(server:admin)，直接设定为具有全部特权
      if (isAdmin.value || activeUser.value?.role === 'server:admin') {
        permissionState.value = {
          userId: userId.value,
          roleId: null,
          roleName: '系统管理员',
          menuPerms: ['*'], // 超管豁免全部菜单限制
          modelPerms: ['*'], // 超管豁免全部按钮限制
          dataPerms: ['all'],
          isAdmin: true
        }
        isInitialized.value = true
        return
      }

      // 2. 普通用户，向后端拉取合并后的有效权限集并存至全局状态
      const data = await $fetch<any>(`${apiOrigin}/api/v1/custom-roles/me/permissions`)
      permissionState.value = {
        userId: userId.value,
        roleId: data.roleId || null,
        roleName: data.roleName || null,
        menuPerms: data.menuPerms || [],
        modelPerms: data.modelPerms || [],
        dataPerms: data.dataPerms || [],
        isAdmin: false
      }
      isInitialized.value = true
    } catch (e) {
      console.error('获取有效权限集失败，降级为空权限:', e)
      permissionState.value = {
        userId: userId.value,
        roleId: null,
        roleName: null,
        menuPerms: [],
        modelPerms: [],
        dataPerms: [],
        isAdmin: false
      }
    } finally {
      isLoading.value = false
    }
  }

  // 快捷菜单检查方法
  const hasMenuPerm = (menuId: string) => {
    if (permissionState.value.isAdmin) return true
    return permissionState.value.menuPerms.includes(menuId)
  }

  // 快捷操作动作检查方法
  const hasFunctionalPerm = (permissionCode: string) => {
    if (permissionState.value.isAdmin) return true
    return permissionState.value.modelPerms.includes(permissionCode)
  }

  return {
    permissions: computed(() => permissionState.value),
    isInitialized: computed(() => isInitialized.value),
    isLoading: computed(() => isLoading.value),
    initializePermissions,
    hasMenuPerm,
    hasFunctionalPerm
  }
}
