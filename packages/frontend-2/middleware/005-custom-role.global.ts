import { useCustomPermissions } from '~~/lib/auth/composables/customPermissions'
import { useGlobalToast, ToastNotificationType } from '~~/lib/common/composables/toast'

// 定义企业级一级路由页面与菜单 ID 的对应关系
const ROUTE_MENU_MAPPING: Record<string, string> = {
  '/workbench': 'ent-dashboard',
  '/projects': 'ent-projects',
  '/progress': 'ent-progress',
  '/quality-acceptance': 'ent-quality',
  '/work-valuation': 'ent-cost',
  '/archives': 'ent-archive',
  '/permission/roles': 'ent-permission',
  '/permission/users': 'ent-permission'
}

// 定义项目内各子页面路由与菜单 ID 的对应关系
const PROJECT_SUBPATH_MENU_MAPPING: Record<string, string> = {
  'file-management': 'source-file-management',
  'model-list': 'file-management',
  'workbench/discussions': 'collaborative-management',
  'progress/schedule': 'progress-plan',
  'progress/actual': 'actual-progress',
  'progress/physical': 'visual-progress',
  'quality-acceptance': 'quality-check',
  'work-valuation/BOQ': 'bill-management',
  'work-valuation/monthly-measurement': 'monthly-valuation',
  'work-valuation/safety-measure': 'safety-civilization',
  'archive/model-to-site': 'archives-list',
  'archive/archives': 'archives-borrow'
}

export default defineNuxtRouteMiddleware(async (to) => {
  // 1. 如果是在服务端 SSR 渲染期间，跳过，在客户端初始化时再次处理
  if (import.meta.server) return

  // 2. 初始化和获取当前用户合并角色有效权限
  const { initializePermissions, hasMenuPerm } = useCustomPermissions()
  await initializePermissions()

  // 3. 优先检查是否访问的是具体的项目内子模块页面
  const matchProjectSubpage = to.path.match(/^\/projects\/([^/]+)\/(.+)$/)
  if (matchProjectSubpage) {
    const projectId = matchProjectSubpage[1]
    const subpath = matchProjectSubpage[2]

    const matchedSubpathKey = Object.keys(PROJECT_SUBPATH_MENU_MAPPING).find(
      (key) => subpath === key || subpath.startsWith(key + '/')
    )

    if (matchedSubpathKey) {
      const requiredMenuId = PROJECT_SUBPATH_MENU_MAPPING[matchedSubpathKey]

      if (!hasMenuPerm(requiredMenuId)) {
        const { triggerNotification } = useGlobalToast()
        triggerNotification({
          type: ToastNotificationType.Warning,
          title: '访问受限',
          description: '您没有该模块的访问权限，已自动跳转。'
        })

        // 默认退路：项目工作台，若不行则退回到项目管理大厅，再不行则个人中心
        let fallbackPath = `/projects/${projectId}/workbench`
        if (!hasMenuPerm('ent-projects')) {
          fallbackPath = '/settings/user/profile'
        }

        if (to.path === fallbackPath) {
          return
        }
        return navigateTo(fallbackPath)
      }

      // 已通过具体子模块权限校验，放行
      return
    }
  }

  // 4. 检查通用/全局的一级路由权限（例如 /projects, /workbench 等）
  const matchedPath = Object.keys(ROUTE_MENU_MAPPING).find(
    (path) => to.path === path || to.path.startsWith(path + '/')
  )

  if (matchedPath) {
    const requiredMenuId = ROUTE_MENU_MAPPING[matchedPath]

    if (!hasMenuPerm(requiredMenuId)) {
      const { triggerNotification } = useGlobalToast()
      triggerNotification({
        type: ToastNotificationType.Warning,
        title: '访问受限',
        description: '您没有该页面的访问权限，已自动跳转。'
      })

      // 降级回退机制
      let fallbackPath = '/settings/user/profile'
      if (requiredMenuId !== 'ent-dashboard' && hasMenuPerm('ent-dashboard')) {
        fallbackPath = '/workbench'
      } else if (hasMenuPerm('ent-projects')) {
        fallbackPath = '/projects'
      }

      if (to.path === fallbackPath) {
        return
      }

      return navigateTo(fallbackPath)
    }
  }
})
