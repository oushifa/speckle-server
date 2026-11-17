<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="text-heading-sm">通知列表</div>
      <div class="flex items-center gap-3">
        <span
          v-if="unreadCount > 0"
          class="rounded-full bg-red-100 px-3 py-1 text-body-xs font-medium text-red-600"
        >
          {{ unreadCount }} 未读
        </span>
        <span
          v-else
          class="rounded-full bg-foundation-2 px-3 py-1 text-body-xs font-medium text-foreground-2"
        >
          全部已读
        </span>
        <FormButton
          color="outline"
          size="sm"
          :disabled="unreadCount <= 0 || markingAllRead"
          @click="openReadAllConfirm"
        >
          全部标为已读
        </FormButton>
      </div>
    </div>

    <div v-if="loading" class="text-body-sm text-foreground-2">加载中...</div>
    <div v-else-if="!notifications.length" class="text-body-sm text-foreground-2">
      暂无通知
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="item in notifications"
        :key="item.id"
        class="flex cursor-pointer items-start justify-between rounded-lg border border-outline-3 p-4 transition-colors hover:border-outline-5"
        :class="{ 'opacity-80 bg-foundation-2/60': item.isRead }"
        role="button"
        tabindex="0"
        @click="handleNotificationClick(item)"
        @keydown.enter="handleNotificationClick(item)"
        @keydown.space.prevent="handleNotificationClick(item)"
      >
        <div class="flex items-start gap-3.5 min-w-0 flex-1">
          <div class="mt-1.5 flex-shrink-0 flex items-center justify-center">
            <span
              v-if="!item.isRead"
              class="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-100"
              title="未读"
            />
            <span v-else class="h-2.5 w-2.5 rounded-full bg-slate-300" title="已读" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2 min-w-0">
              <div
                class="text-body-sm truncate"
                :class="
                  item.isRead
                    ? 'font-medium text-foreground-2'
                    : 'font-semibold text-foreground'
                "
              >
                {{ item.title || '未命名通知' }}
              </div>
              <span
                v-if="item.projectName"
                class="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-body-xs font-medium text-primary"
              >
                {{ item.projectName }}
              </span>
              <FlowPushBadge
                v-if="!item.isRead"
                :record="getNotificationPushRecord(item)"
                :loading="retryingId === item.id"
                @retry="retryPush(item.id)"
              />
            </div>
            <p class="mt-1 text-body-sm text-foreground-2 line-clamp-2">
              {{ item.content || '-' }}
            </p>
            <div
              class="mt-2 flex flex-wrap items-center gap-4 text-body-xs text-foreground-2"
            >
              <span class="flex items-center gap-1">
                <ClockIcon class="h-3.5 w-3.5" />
                {{ formatDate(item.createdAt) }}
              </span>
              <span v-if="!item.isRead" class="text-danger font-medium">未读</span>
              <span v-else class="text-foreground-2">已读</span>
            </div>
          </div>
        </div>
        <div class="shrink-0 ml-3 mt-1 flex items-center text-foreground-2">
          <ArrowRightIcon class="h-4 w-4" />
        </div>
      </div>
    </div>

    <CommonConfirmDialog
      v-model:open="isReadAllConfirmOpen"
      title="全部标为已读"
      text="确定要将所有未读通知标记为已读吗？"
      confirm-text="确认标记"
      :loading="markingAllRead"
      :close-on-confirm="false"
      @confirm="onConfirmReadAll"
    />
  </div>
</template>

<script setup lang="ts">
import { ArrowRightIcon, ClockIcon } from '@heroicons/vue/24/outline'
import { useAuthCookie } from '~~/lib/auth/composables/auth'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import FlowPushBadge from './FlowPushBadge.vue'
import type { UnifiedWorkPushRecord } from './flowInstances'

type NotificationPushRecordInput = Partial<UnifiedWorkPushRecord>

type NotificationItem = {
  id: string
  userId?: string
  projectId?: string
  title: string
  content: string
  targetUrl?: string | null
  isRead: boolean
  createdAt: string
  updatedAt?: string
  projectName?: string | null
  unifiedWorkPush?: NotificationPushRecordInput | null
}

type NotificationsListResponse = {
  items?: NotificationItem[]
  unreadCount?: number
}

const emit = defineEmits<{
  (e: 'unread-count-change', count: number): void
}>()

const apiOrigin = useApiOrigin()
const authCookie = useAuthCookie()
const { triggerNotification } = useGlobalToast()

const loading = ref(false)
const retryingId = ref<string | null>(null)
const notifications = ref<NotificationItem[]>([])
const unreadCount = ref(0)
const isReadAllConfirmOpen = ref(false)
const markingAllRead = ref(false)

const getAuthHeaders = (): Record<string, string> | undefined =>
  authCookie.value ? { Authorization: `Bearer ${authCookie.value}` } : undefined

const formatDate = (date?: string | null) => {
  if (!date) return '-'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString()
}

const getNotificationPushRecord = (
  item: NotificationItem
): UnifiedWorkPushRecord | null => {
  const raw = item.unifiedWorkPush
  if (!raw) return null
  return {
    id: raw.id || item.id,
    instanceId: raw.instanceId || item.id,
    taskId: raw.taskId || '',
    systemCode: raw.systemCode || '',
    stepIndex: raw.stepIndex ?? 0,
    approverId: raw.approverId ?? item.userId ?? null,
    account: raw.account ?? null,
    status: raw.status || '',
    errorType: raw.errorType ?? null,
    errorMessage: raw.errorMessage ?? null,
    errorDetail: raw.errorDetail ?? null,
    attempts: raw.attempts ?? 0,
    lastAttemptAt: raw.lastAttemptAt || item.updatedAt || item.createdAt,
    createdAt: raw.createdAt || item.createdAt,
    updatedAt: raw.updatedAt || item.updatedAt || item.createdAt
  }
}

const loadNotifications = async (options?: { silent?: boolean }) => {
  if (!options?.silent) loading.value = true
  try {
    const res = await $fetch<NotificationsListResponse>(
      `${apiOrigin}/api/v1/notifications`,
      {
        headers: getAuthHeaders()
      }
    )
    const items = res.items || []
    const nextUnreadCount =
      typeof res.unreadCount === 'number'
        ? res.unreadCount
        : items.filter((item) => !item.isRead).length
    notifications.value = items
    unreadCount.value = nextUnreadCount
    emit('unread-count-change', nextUnreadCount)
  } catch (e) {
    if (!options?.silent) {
      notifications.value = []
      unreadCount.value = 0
      emit('unread-count-change', 0)
      triggerNotification({
        title: '加载失败',
        description: (e as Error).message || '获取通知列表失败',
        type: ToastNotificationType.Danger
      })
    }
  } finally {
    if (!options?.silent) loading.value = false
  }
}

const refresh = async () => {
  await loadNotifications()
}

const openReadAllConfirm = () => {
  if (unreadCount.value <= 0 || markingAllRead.value) return
  isReadAllConfirmOpen.value = true
}

const onConfirmReadAll = async () => {
  if (markingAllRead.value) return
  markingAllRead.value = true
  try {
    await $fetch(`${apiOrigin}/api/v1/notifications/read-all`, {
      method: 'PUT',
      headers: getAuthHeaders()
    })
    isReadAllConfirmOpen.value = false
    notifications.value = notifications.value.map((item) => ({
      ...item,
      isRead: true
    }))
    unreadCount.value = 0
    emit('unread-count-change', 0)
    triggerNotification({
      title: '操作成功',
      description: '所有通知已全部标为已读',
      type: ToastNotificationType.Success
    })
    await loadNotifications({ silent: true })
  } catch (e) {
    triggerNotification({
      title: '操作失败',
      description: (e as Error).message || '标记已读失败',
      type: ToastNotificationType.Danger
    })
  } finally {
    markingAllRead.value = false
  }
}

const retryPush = async (id: string) => {
  if (retryingId.value) return
  retryingId.value = id
  try {
    const res = await $fetch<{
      success?: boolean
      pushCount?: number
      failCount?: number
      pushed?: number
      count?: number
      message?: string
    }>(`${apiOrigin}/api/v1/notifications/${id}/retry-push`, {
      method: 'POST',
      headers: getAuthHeaders()
    })
    const pushed = res?.pushCount ?? res?.pushed ?? res?.count ?? (res?.success ? 1 : 0)
    triggerNotification({
      title: pushed > 0 ? '重新推送成功' : '重新推送完成',
      description:
        pushed > 0
          ? `已成功推送 ${pushed} 条通知`
          : res?.message || '本次没有通知被推送，请展开失败原因排查',
      type: pushed > 0 ? ToastNotificationType.Success : ToastNotificationType.Warning
    })
    await loadNotifications({ silent: true })
  } catch (e) {
    triggerNotification({
      title: '重新推送失败',
      description: (e as Error).message || '重试推送失败',
      type: ToastNotificationType.Danger
    })
  } finally {
    retryingId.value = null
  }
}

const handleNotificationClick = (item: NotificationItem) => {
  void navigateTo(`/flow/notification/${item.id}`)
}

defineExpose({ refresh })

onMounted(async () => {
  await loadNotifications()
})
</script>
