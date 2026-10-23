<template>
  <Tippy
    interactive
    :delay="[120, 80]"
    placement="top-start"
    :max-width="420"
    :hide-on-click="false"
  >
    <span
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-body-xs whitespace-nowrap cursor-default"
      :class="badgeClass"
      @click.stop
      @mousedown.stop
    >
      <span class="h-1.5 w-1.5 rounded-full" :class="dotClass"></span>
      {{ label }}
    </span>

    <template #content>
      <div class="p-2 space-y-2 text-left max-w-[400px]" @click.stop>
        <div class="flex items-center justify-between gap-4">
          <span class="font-medium">{{ label }}</span>
          <span v-if="record" class="text-foreground-2">
            尝试 {{ record.attempts }} 次
          </span>
        </div>

        <template v-if="record">
          <div class="text-foreground-2 break-all">
            任务 ID：
            <span class="font-mono text-foreground">{{ record.taskId }}</span>
          </div>
          <div class="text-foreground-2 break-all">
            流程实例：
            <span class="font-mono text-foreground">{{ record.instanceId }}</span>
          </div>
          <div class="text-foreground-2 break-all">
            审批人：
            <span class="font-mono text-foreground">
              {{ record.approverId || '-' }}
            </span>
          </div>
          <div class="text-foreground-2">待办账号：{{ record.account || '-' }}</div>
          <div class="text-foreground-2">
            最近尝试：{{ formatDate(record.lastAttemptAt) }}
          </div>

          <template v-if="isFailed">
            <div class="border-t border-outline-3 pt-2 mt-1 space-y-1">
              <div class="text-danger">
                错误类型：
                <span class="font-mono">{{ record.errorType || 'UNKNOWN' }}</span>
              </div>
              <div class="text-foreground break-words">
                {{ record.errorMessage || '（无错误信息）' }}
              </div>
              <div v-if="requestInfo" class="text-foreground-2 break-all">
                请求：{{ requestInfo }}
              </div>
              <div v-if="responseBody" class="space-y-1">
                <div class="text-foreground-2">服务端返回：</div>
                <pre
                  class="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-foundation-2 p-1.5 font-mono text-[11px] text-foreground"
                  >{{ responseBody }}</pre
                >
              </div>
            </div>
          </template>
        </template>
        <div v-else class="text-foreground-2">
          该待办尚未尝试推送（或所属流程已结束、记录已清理）。
        </div>

        <div class="pt-1 flex justify-end">
          <FormButton
            size="sm"
            color="primary"
            :disabled="loading"
            @click.stop="onRetry"
          >
            {{ loading ? '推送中…' : '重新推送' }}
          </FormButton>
        </div>
      </div>
    </template>
  </Tippy>
</template>

<script setup lang="ts">
import { Tippy } from 'vue-tippy'
import type { UnifiedWorkPushRecord } from './flowInstances'

const props = withDefaults(
  defineProps<{
    record?: UnifiedWorkPushRecord | null
    loading?: boolean
  }>(),
  {
    record: null,
    loading: false
  }
)

const emit = defineEmits<{
  (e: 'retry'): void
}>()

const status = computed(() => props.record?.status || null)
const isFailed = computed(() => status.value === 'FAILED')
const isSuccess = computed(() => status.value === 'SUCCESS')

const label = computed(() => {
  if (isSuccess.value) return '已推送'
  if (isFailed.value) return '推送失败'
  return '未推送'
})

const badgeClass = computed(() => {
  if (isSuccess.value) return 'bg-success/10 text-success'
  if (isFailed.value) return 'bg-danger/10 text-danger'
  return 'bg-foundation-2 text-foreground-2'
})

const dotClass = computed(() => {
  if (isSuccess.value) return 'bg-success'
  if (isFailed.value) return 'bg-danger'
  return 'bg-outline-5'
})

const detail = computed(() => props.record?.errorDetail || null)

const requestInfo = computed(() => {
  const d = detail.value
  if (!d) return ''
  const parts: string[] = []
  if (d.method) parts.push(String(d.method))
  if (d.url) parts.push(String(d.url))
  if (d.status !== undefined && d.status !== null) {
    parts.push(`HTTP ${d.status}${d.statusText ? ` ${d.statusText}` : ''}`)
  }
  if (d.code) parts.push(`code: ${d.code}`)
  return parts.join(' · ')
})

const responseBody = computed(() => {
  const body = detail.value?.responseBody
  if (body === undefined || body === null) return ''
  if (typeof body === 'string') return body
  try {
    return JSON.stringify(body, null, 2)
  } catch {
    return String(body)
  }
})

const formatDate = (date?: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

const onRetry = () => {
  if (props.loading) return
  emit('retry')
}
</script>
