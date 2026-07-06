import { useCustomPermissions } from '~~/lib/auth/composables/customPermissions'

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

export default defineNuxtRouteMiddleware(async (to) => {
  // 1. 如果是在服务端 SSR 渲染期间，跳过，在客户端初始化时再次处理
  if (process.server) return

  // 2. 检查当前请求路径是否命中了受保护的企业级受限页面 (包括子级页面路径匹配)
  const matchedPath = Object.keys(ROUTE_MENU_MAPPING).find(
    (path) => to.path === path || to.path.startsWith(path + '/')
  )

  if (!matchedPath) return

  // 3. 提取受保护页面所需的菜单权限 ID
  const requiredMenuId = ROUTE_MENU_MAPPING[matchedPath]

  // 4. 初始化和获取当前用户合并角色有效权限
  const { initializePermissions, hasMenuPerm } = useCustomPermissions()
  await initializePermissions()

  // 5. 安全路由守卫拦截
  if (!hasMenuPerm(requiredMenuId)) {
    // 降级回退机制：默认回退到系统最安全、对自定义角色无要求的个人设置页
    let fallbackPath = '/settings/user/profile'
    
    if (requiredMenuId !== 'ent-dashboard' && hasMenuPerm('ent-dashboard')) {
      fallbackPath = '/workbench'
    } else if (hasMenuPerm('ent-projects')) {
      fallbackPath = '/projects'
    }

    // 核心安全防线：若目标跳转路径已经就是退路路径，则终止跳转放行，彻底解开重定向死循环
    if (to.path === fallbackPath) {
      return
    }

    return navigateTo(fallbackPath)
  }
})
