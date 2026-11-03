import {
  AUTH_SYNC_CHANNEL_NAME,
  AUTH_SYNC_STORAGE_KEY,
  getTabId,
  type AuthSyncMessage
} from '~~/lib/auth/helpers/authSync'

export default defineNuxtPlugin(() => {
  if (import.meta.server || typeof window === 'undefined') return

  const currentTabId = getTabId()

  const handleSyncMessage = (data: unknown) => {
    if (!data || typeof data !== 'object') return
    const msg = data as Partial<AuthSyncMessage>

    // 只有在其他标签页触发登录，并且带有有效 token 时，才自动刷新当前页面
    if (
      msg.type === 'TOKEN_LOGIN' &&
      msg.token &&
      msg.sourceTabId &&
      msg.sourceTabId !== currentTabId
    ) {
      // 避免同一事件重复触发
      window.location.reload()
    }
  }

  // 1. 优先使用 BroadcastChannel 监听跨同源标签页消息
  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL_NAME)
      channel.onmessage = (event: MessageEvent) => {
        handleSyncMessage(event.data)
      }
    } catch {
      // BroadcastChannel 受环境限制失败时静默跳过
    }
  }

  // 2. 兼容降级：监听 storage 事件（跨同源标签页修改 localStorage 时自动触发）
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === AUTH_SYNC_STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue)
        handleSyncMessage(parsed)
      } catch {
        // 解析失败静默忽略
      }
    }
  })
})
