/* eslint-disable no-console */
export interface UnifiedWorkConfig {
  host?: string
  systemCode?: string
  token?: string
  [key: string]: unknown
}

export type MockInput = Record<string, unknown>

export interface PushOptions {
  dryRun?: boolean
  [key: string]: unknown
}

export type RemoveInput =
  | string
  | {
      taskId?: string
      instanceId?: string
      [key: string]: unknown
    }

export interface TodoPushDebug {
  config: UnifiedWorkConfig
  refreshConfig: () => Promise<UnifiedWorkConfig>
  setConfig: (overrides: Partial<UnifiedWorkConfig>) => UnifiedWorkConfig
  resetConfig: () => UnifiedWorkConfig
  push: (target?: string | MockInput, options?: PushOptions) => Promise<unknown>
  pushMock: (mockData?: MockInput, options?: PushOptions) => Promise<unknown>
  remove: (target: RemoveInput) => Promise<unknown>
  retry: (instanceId: string) => Promise<unknown>
}

declare global {
  interface Window {
    __todoPushDebug?: TodoPushDebug
  }
}

export default defineNuxtPlugin(() => {
  if (import.meta.server || typeof window === 'undefined') return

  let baseConfig: UnifiedWorkConfig = {}
  let overrides: Partial<UnifiedWorkConfig> = {}
  const activeTarget: UnifiedWorkConfig = {}

  const syncTarget = () => {
    for (const key of Object.keys(activeTarget)) {
      delete activeTarget[key]
    }
    Object.assign(activeTarget, baseConfig, overrides)
  }

  const getEffectiveConfig = (): UnifiedWorkConfig => ({
    ...baseConfig,
    ...overrides
  })

  const configProxy = new Proxy(activeTarget, {
    get(target, prop: string | symbol) {
      if (typeof prop !== 'string') return Reflect.get(target, prop)
      if (prop in overrides) {
        return overrides[prop]
      }
      return target[prop]
    },
    set(target, prop: string | symbol, value: unknown) {
      if (typeof prop === 'string') {
        overrides = {
          ...overrides,
          [prop]: value
        }
        target[prop] = value
        console.log(`[UnifiedWork DevTool] 设置配置覆盖: ${prop} =`, value)
      }
      return true
    },
    has(target, prop: string | symbol) {
      return Reflect.has(target, prop)
    },
    ownKeys(target) {
      return Reflect.ownKeys(target)
    },
    getOwnPropertyDescriptor(target, prop: string | symbol) {
      return Reflect.getOwnPropertyDescriptor(target, prop)
    }
  })

  const getOverridesOrUndefined = () => {
    return Object.keys(overrides).length > 0 ? { ...overrides } : undefined
  }

  const refreshConfig = async (): Promise<UnifiedWorkConfig> => {
    try {
      const res = await $fetch<UnifiedWorkConfig | { config?: UnifiedWorkConfig }>(
        '/api/v1/flow/unified-work/config'
      )
      const remoteConfig =
        res && typeof res === 'object' && 'config' in res && res.config
          ? res.config
          : (res as UnifiedWorkConfig) || {}
      baseConfig = { ...remoteConfig }
      overrides = {}
      syncTarget()
      console.log(
        '🔄 [UnifiedWork DevTool] 后端环境变量配置已刷新并重置 overrides:',
        activeTarget
      )
      return getEffectiveConfig()
    } catch (err) {
      console.warn('⚠️ [UnifiedWork DevTool] 拉取后端配置失败:', err)
      return getEffectiveConfig()
    }
  }

  const setConfig = (newOverrides: Partial<UnifiedWorkConfig>): UnifiedWorkConfig => {
    overrides = { ...overrides, ...newOverrides }
    syncTarget()
    console.log('✏️ [UnifiedWork DevTool] 配置覆盖已更新:', overrides)
    console.log('👉 [UnifiedWork DevTool] 当前生效配置:', activeTarget)
    return getEffectiveConfig()
  }

  const resetConfig = (): UnifiedWorkConfig => {
    overrides = {}
    syncTarget()
    console.log(
      '🔄 [UnifiedWork DevTool] 配置覆盖已重置，恢复后端默认值:',
      activeTarget
    )
    return getEffectiveConfig()
  }

  const push = async (target?: string | MockInput, options?: PushOptions) => {
    const resolvedInstanceId =
      typeof target === 'string'
        ? target.trim()
        : target &&
          typeof target === 'object' &&
          ('instanceId' in target ||
            ('id' in target && !('assignee' in target && !('status' in target))))
        ? String(
            (target as Record<string, unknown>).instanceId ||
              (target as Record<string, unknown>).id
          ).trim()
        : null
    const isInstanceId = Boolean(resolvedInstanceId)
    const start = performance.now()

    if (isInstanceId && resolvedInstanceId) {
      const url = `/api/v1/flow/instances/${resolvedInstanceId}/debug-push`
      const body = {
        dryRun: options?.dryRun,
        configOverrides: getOverridesOrUndefined()
      }
      try {
        const res = await $fetch<Record<string, unknown>>(url, {
          method: 'POST',
          body
        })
        const durationMs = Math.round(performance.now() - start)
        const summary = (res?.summary as Record<string, number> | undefined) || {}
        const items = (res?.items as Array<Record<string, unknown>> | undefined) || []

        console.group(
          `🚀 [UnifiedWork DevTool] 实例 [${resolvedInstanceId}] 调试推送 (${durationMs}ms)${
            options?.dryRun ? ' [Dry Run]' : ''
          }`
        )
        console.table([
          {
            耗时: `${durationMs}ms`,
            模式: options?.dryRun ? '试跑 (DryRun)' : '实际推送',
            待办总数: summary.total ?? items.length,
            成功: summary.successCount ?? 0,
            失败: summary.failCount ?? 0,
            生效Host:
              (res?.effectiveConfig as Record<string, unknown> | undefined)?.host || '-'
          }
        ])
        if (items.length > 0) {
          console.groupCollapsed('📋 各待办节点推送明细')
          console.table(
            items.map((item) => ({
              TaskId: item.taskId,
              审批人:
                (item.approver as Record<string, unknown> | undefined)?.name ||
                item.taskId,
              状态: item.success ? '成功 ✅' : '失败 ❌',
              HTTP状态: item.statusCode || '-',
              错误: item.error || '-'
            }))
          )
          console.groupEnd()
        }
        console.log('📦 请求 Body:', body)
        console.log('📥 完整响应:', res)
        console.groupEnd()
        return res
      } catch (err: unknown) {
        const durationMs = Math.round(performance.now() - start)
        console.group(
          `❌ [UnifiedWork DevTool] 实例 [${resolvedInstanceId}] 推送失败 (${durationMs}ms)`
        )
        console.error('异常详情:', err)
        console.log('📦 请求 Body:', body)
        console.groupEnd()
        throw err
      }
    } else {
      const mockData =
        target && typeof target === 'object'
          ? 'mockData' in target &&
            typeof target.mockData === 'object' &&
            target.mockData !== null
            ? (target.mockData as Record<string, unknown>)
            : target
          : undefined

      const url = '/api/v1/flow/unified-work/mock-push'
      const body = {
        mockData,
        dryRun: options?.dryRun,
        configOverrides: getOverridesOrUndefined()
      }
      try {
        const res = await $fetch<Record<string, unknown>>(url, {
          method: 'POST',
          body
        })
        const durationMs = Math.round(performance.now() - start)
        console.group(
          `🚀 [UnifiedWork DevTool] Mock 待办推送 (${durationMs}ms)${
            options?.dryRun ? ' [Dry Run]' : ''
          }`
        )
        console.table([
          {
            耗时: `${durationMs}ms`,
            模式: options?.dryRun ? '试跑 (DryRun)' : '实际推送',
            状态: res?.success ? '成功 ✅' : '失败 ❌',
            HTTP状态: res?.statusCode || '-',
            第三方响应:
              (res?.responseBody as Record<string, unknown> | undefined)?.code ?? '-',
            生效Host:
              (res?.effectiveConfig as Record<string, unknown> | undefined)?.host || '-'
          }
        ])
        console.log('📦 请求 Body:', body)
        console.log('📥 原始响应:', res)
        console.groupEnd()
        return res
      } catch (err: unknown) {
        const durationMs = Math.round(performance.now() - start)
        console.group(`❌ [UnifiedWork DevTool] Mock 推送失败 (${durationMs}ms)`)
        console.error('异常详情:', err)
        console.log('📦 请求 Body:', body)
        console.groupEnd()
        throw err
      }
    }
  }

  const pushMock = async (mockData?: MockInput, options?: PushOptions) => {
    return await push(mockData || {}, options)
  }

  const remove = async (target: RemoveInput) => {
    const url = '/api/v1/flow/unified-work/debug-remove'
    const body = {
      taskId: typeof target === 'string' ? target : target?.taskId,
      instanceId: typeof target === 'object' ? target?.instanceId : undefined,
      configOverrides: getOverridesOrUndefined()
    }

    const start = performance.now()
    try {
      const res = await $fetch<Record<string, unknown>>(url, {
        method: 'POST',
        body
      })
      const durationMs = Math.round(performance.now() - start)
      const summary = (res?.summary as Record<string, number> | undefined) || {}
      const results = (res?.results as Array<Record<string, unknown>> | undefined) || []

      console.group(`🗑️ [UnifiedWork DevTool] 调试删除待办 (${durationMs}ms)`)
      console.table([
        {
          耗时: `${durationMs}ms`,
          删除总数: summary.total ?? results.length,
          第三方删除成功: summary.successCount ?? 0,
          第三方删除失败: summary.failCount ?? 0,
          本地同步删除记录数: summary.localDeletedCount ?? 0,
          生效Host:
            (res?.effectiveConfig as Record<string, unknown> | undefined)?.host || '-'
        }
      ])
      if (results.length > 0) {
        console.groupCollapsed('📋 删除节点明细')
        console.table(
          results.map((r) => ({
            TaskId: r.taskId,
            第三方删除: r.success ? '成功 ✅' : '失败 ❌',
            HTTP状态: r.statusCode || '-',
            本地记录清理: r.localRecordDeleted ? '已删除' : '未删除/无需删除',
            错误: r.error || '-'
          }))
        )
        console.groupEnd()
      }
      console.log('📦 请求入参:', body)
      console.log('📥 完整删除响应:', res)
      console.groupEnd()
      return res
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - start)
      console.group(`❌ [UnifiedWork DevTool] 删除待办失败 (${durationMs}ms)`)
      console.error('异常详情:', err)
      console.log('📦 请求入参:', body)
      console.groupEnd()
      throw err
    }
  }

  const retry = async (instanceId: string) => {
    const url = `/api/v1/flow/instances/${instanceId}/retry-push`
    const start = performance.now()
    try {
      const res = await $fetch<Record<string, unknown>>(url, {
        method: 'POST'
      })
      const durationMs = Math.round(performance.now() - start)
      const pushed =
        (res?.pushed as number | undefined) ??
        (res?.count as number | undefined) ??
        (res?.success ? 1 : 0)
      console.group(
        `🔁 [UnifiedWork DevTool] 重推实例待办 [${instanceId}] (${durationMs}ms)`
      )
      console.table([
        {
          耗时: `${durationMs}ms`,
          结果: res?.success ?? pushed > 0 ? '成功 ✅' : '无待办/未推送',
          成功推送数: pushed,
          失败数: res?.failed ?? 0,
          移除数: res?.removed ?? 0
        }
      ])
      console.log('📥 响应详情:', res)
      console.groupEnd()
      return res
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - start)
      console.group(
        `❌ [UnifiedWork DevTool] 重推实例 [${instanceId}] 失败 (${durationMs}ms)`
      )
      console.error('异常详情:', err)
      console.groupEnd()
      throw err
    }
  }

  const debugObj: TodoPushDebug = {
    config: configProxy,
    refreshConfig,
    setConfig,
    resetConfig,
    push,
    pushMock,
    remove,
    retry
  }

  window.__todoPushDebug = debugObj

  void refreshConfig().then(() => {
    console.log(
      '💡 [UnifiedWork] 待办推送 DevTool 调试钩子已就绪，当前环境变量配置:',
      activeTarget
    )
  })
})
