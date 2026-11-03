export const AUTH_SYNC_CHANNEL_NAME = 'sznb_auth_channel'
export const AUTH_SYNC_STORAGE_KEY = 'sznb_auth_sync_event'

export type AuthSyncMessage = {
  type: 'TOKEN_LOGIN'
  token: string
  timestamp: number
  sourceTabId: string
}

let currentTabId: string | null = null

export const getTabId = (): string => {
  if (!currentTabId) {
    currentTabId = `tab_${Math.random().toString(36).slice(2)}_${Date.now()}`
  }
  return currentTabId
}

/**
 * 广播 Token 登录事件给其他同源标签页
 */
export function broadcastTokenLogin(token: string): void {
  if (typeof window === 'undefined' || !token) return

  const message: AuthSyncMessage = {
    type: 'TOKEN_LOGIN',
    token,
    timestamp: Date.now(),
    sourceTabId: getTabId()
  }

  // 1. BroadcastChannel 优先
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL_NAME)
      channel.postMessage(message)
      channel.close()
    }
  } catch {
    // BroadcastChannel 不可用或受限时静默跳过
  }

  // 2. storage 事件作为兼容降级（设置 localStorage 会触发其他同源窗口的 storage 事件）
  try {
    window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(message))
  } catch {
    // localStorage 异常时静默跳过
  }
}
