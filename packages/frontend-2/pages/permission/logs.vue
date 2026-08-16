<template>
  <div class="p-4">
    <!-- 面包屑 -->
    <Portal to="current-page">
      <NuxtLink to="/permission/roles">权限管理</NuxtLink>
      <span>/ 操作日志</span>
    </Portal>

    <div class="rounded-lg shadow-sm bg-foundation border border-outline-3">
      <div class="p-4">
        <!-- 头部 -->
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-heading-lg text-foreground">操作日志</h1>
          <FormButton
            color="outline"
            size="sm"
            :icon-left="Download"
            class="font-normal"
            :disabled="exporting"
            @click="handleExportCsv"
          >
            {{ exporting ? '导出中...' : '导出日志' }}
          </FormButton>
        </div>

        <!-- 筛选区域 -->
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <div class="relative w-60">
            <Search
              class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-3 z-10"
            />
            <FormTextInput
              v-model="search"
              name="log-search"
              placeholder="搜索操作人、对象、详情..."
              :show-label="false"
              class="pl-8"
              @input="currentPage = 1"
            />
          </div>

          <FormSelectBase
            v-model="selectedType"
            label="操作类型"
            :show-label="false"
            name="log-type"
            placeholder="全部类型"
            by="value"
            :items="typeOptions"
            class="w-36"
            size="base"
          >
            <template #something-selected="{ value }">
              {{
                Array.isArray(value)
                  ? value[0]?.label
                  : (value as any)?.label || '全部类型'
              }}
            </template>
            <template #option="{ item }">
              {{ item.label }}
            </template>
          </FormSelectBase>

          <FormSelectBase
            v-model="selectedResult"
            label="结果"
            :show-label="false"
            name="log-result"
            placeholder="全部结果"
            by="value"
            :items="resultOptions"
            class="w-28"
            size="base"
          >
            <template #something-selected="{ value }">
              {{
                Array.isArray(value)
                  ? value[0]?.label
                  : (value as any)?.label || '全部结果'
              }}
            </template>
            <template #option="{ item }">
              {{ item.label }}
            </template>
          </FormSelectBase>

          <div class="flex items-center gap-1.5">
            <FormTextInput
              v-model="filterDateFrom"
              type="date"
              name="log-date-from"
              :show-label="false"
              class="w-36"
              @change="currentPage = 1"
            />
            <span class="text-xs text-foreground-3">至</span>
            <FormTextInput
              v-model="filterDateTo"
              type="date"
              name="log-date-to"
              :show-label="false"
              class="w-36"
              @change="currentPage = 1"
            />
          </div>

          <FormButton
            v-if="hasFilters"
            color="outline"
            size="sm"
            :icon-left="X"
            class="font-normal"
            @click="clearFilters"
          >
            清除
          </FormButton>

          <span class="ml-auto text-[13px] text-foreground-3">
            共 {{ totalItems }} 条记录
          </span>
        </div>
      </div>

      <!-- 表格内容 -->
      <div class="border-t border-outline-3 mx-4 overflow-x-auto">
        <div class="min-w-[1000px]">
          <!-- 表头 -->
          <div
            class="grid text-xs font-medium border-b border-outline-3 bg-foundation-2 text-foreground-3 py-2.5 px-3"
            style="grid-template-columns: 120px 100px 100px 150px 1fr 150px 70px 60px"
          >
            <div>操作人</div>
            <div>所属模块</div>
            <div>操作类型</div>
            <div>操作对象</div>
            <div>操作详情</div>
            <div>操作时间</div>
            <div class="text-center">结果</div>
            <div class="text-center">详情</div>
          </div>

          <!-- 列表行 -->
          <div v-if="logs.length" class="divide-y divide-outline-3">
            <div
              v-for="log in logs"
              :key="log.id"
              class="grid items-center hover:bg-foundation-2/50 transition-colors py-2.5 px-3"
              style="grid-template-columns: 120px 100px 100px 150px 1fr 150px 70px 60px"
            >
              <!-- 操作人 -->
              <div>
                <p class="text-sm font-medium text-foreground">{{ log.operator }}</p>
                <p class="text-xs text-foreground-3">{{ log.operatorDept }}</p>
              </div>

              <!-- 所属模块 -->
              <div class="text-xs truncate pr-2 text-foreground-2" :title="log.module">
                {{ log.module }}
              </div>

              <!-- 操作类型 -->
              <div>
                <span
                  class="inline-block px-1.5 py-0.5 rounded text-xs whitespace-nowrap"
                  :style="getTypeStyle(log.opType)"
                >
                  {{ log.opType }}
                </span>
              </div>

              <!-- 操作对象 -->
              <div class="text-xs truncate pr-2 text-foreground" :title="log.target">
                {{ log.target }}
              </div>

              <!-- 操作详情 -->
              <div class="text-xs truncate pr-3 text-foreground-2" :title="log.detail">
                {{ log.detail }}
              </div>

              <!-- 操作时间 -->
              <div class="text-xs text-foreground-2">{{ log.operatedAt }}</div>

              <!-- 结果 -->
              <div class="flex justify-center">
                <span
                  class="inline-block px-1.5 py-0.5 rounded-full text-xs font-medium"
                  :class="
                    log.result === '成功'
                      ? 'bg-success-lighter text-success'
                      : 'bg-danger-lighter text-danger'
                  "
                >
                  {{ log.result }}
                </span>
              </div>

              <!-- 详情 -->
              <div class="flex justify-center">
                <button
                  type="button"
                  class="p-1.5 rounded text-primary hover:bg-foundation-3 transition-colors"
                  title="查看详情"
                  @click="viewingLog = log"
                >
                  <Eye class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- 加载中 -->
          <div v-else-if="loading" class="py-16 text-center text-foreground-3">
            <div
              class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"
            ></div>
            <p class="text-sm">正在加载真实日志数据...</p>
          </div>

          <!-- 暂无数据 -->
          <div v-else class="py-16 text-center text-foreground-3">
            <Shield class="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p class="text-sm">暂无操作日志</p>
          </div>
        </div>
      </div>

      <!-- 分页区域 -->
      <div
        v-if="totalPages > 1"
        class="mx-4 border-t border-outline-3 py-3 flex justify-between items-center text-[13px] text-foreground-2"
      >
        <div class="flex items-center gap-2">
          <span>每页显示</span>
          <select
            v-model="pageSize"
            aria-label="每页显示条数"
            class="rounded border border-outline-3 bg-foundation px-2 py-1 focus:border-primary focus:outline-none"
            @change="currentPage = 1"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
          <span>条</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded px-2 py-1 hover:bg-foundation-2 disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            &lt; 上一页
          </button>
          <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
          <button
            class="rounded px-2 py-1 hover:bg-foundation-2 disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            下一页 &gt;
          </button>
        </div>
      </div>
      <div class="h-4" />
    </div>

    <!-- 详情弹窗 -->
    <LayoutDialog v-model:open="dialogOpen" max-width="md">
      <template #header>操作详情</template>
      <div v-if="viewingLog" class="space-y-3 py-2">
        <div v-for="item in detailItems" :key="item.label" class="flex gap-3 text-sm">
          <span class="w-20 flex-shrink-0 text-foreground-3 font-medium">
            {{ item.label }}
          </span>
          <span class="flex-1 text-foreground break-all">{{ item.value }}</span>
        </div>
      </div>
      <div class="flex justify-end pt-3">
        <FormButton color="outline" @click="viewingLog = null">关闭</FormButton>
      </div>
    </LayoutDialog>
  </div>
</template>

<script setup lang="ts">
import { Portal } from 'portal-vue'
import { Search, Download, X, Eye, Shield } from 'lucide-vue-next'
import {
  LayoutDialog,
  FormButton,
  FormTextInput,
  FormSelectBase
} from '@speckle/ui-components'
import { useDebounceFn } from '@vueuse/core'
import dayjs from 'dayjs'

useHead({
  title: '操作日志 - 权限管理'
})

interface LogEntry {
  id: string
  operator: string
  operatorDept: string
  opType: string
  module: string
  target: string
  detail: string
  ipAddress: string
  operatedAt: string
  result: '成功' | '失败'
}

const OP_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  // 项目管理 — 主色
  创建项目: {
    bg: 'color-mix(in srgb, var(--primary) 10%, transparent)',
    color: 'var(--primary)'
  },
  项目删除: {
    bg: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
    color: 'var(--destructive)'
  },
  项目批量删除: {
    bg: 'color-mix(in srgb, var(--destructive) 15%, transparent)',
    color: 'var(--destructive)'
  },
  // 文件管理 — 蓝
  模型上传: {
    bg: 'color-mix(in srgb, var(--chart-3) 15%, transparent)',
    color: 'var(--chart-3)'
  },
  版本发布: {
    bg: 'color-mix(in srgb, var(--primary) 12%, transparent)',
    color: 'var(--primary)'
  },
  模型下载: {
    bg: 'color-mix(in srgb, var(--chart-3) 12%, transparent)',
    color: 'var(--chart-3)'
  },
  模型删除: {
    bg: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
    color: 'var(--destructive)'
  },
  模型编辑: {
    bg: 'color-mix(in srgb, var(--chart-3) 12%, transparent)',
    color: 'var(--chart-3)'
  },
  版本删除: {
    bg: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
    color: 'var(--destructive)'
  },
  版本移动: {
    bg: 'color-mix(in srgb, var(--chart-3) 12%, transparent)',
    color: 'var(--chart-3)'
  },
  版本编辑: {
    bg: 'color-mix(in srgb, var(--chart-3) 10%, transparent)',
    color: 'var(--chart-3)'
  },
  // 协同 — 紫
  协同批注: {
    bg: 'color-mix(in srgb, var(--chart-1) 15%, transparent)',
    color: 'var(--chart-1)'
  },
  // 进度 — 绿
  进度计划更新: {
    bg: 'color-mix(in srgb, var(--chart-2) 15%, transparent)',
    color: 'var(--chart-2)'
  },
  进度填报: {
    bg: 'color-mix(in srgb, var(--chart-2) 12%, transparent)',
    color: 'var(--chart-2)'
  },
  月度计划新增: {
    bg: 'color-mix(in srgb, var(--chart-2) 12%, transparent)',
    color: 'var(--chart-2)'
  },
  月度计划编辑: {
    bg: 'color-mix(in srgb, var(--chart-2) 10%, transparent)',
    color: 'var(--chart-2)'
  },
  // 质量 — 青
  检验批新增: {
    bg: 'color-mix(in srgb, var(--chart-2) 15%, transparent)',
    color: 'var(--chart-2)'
  },
  检验批审批: {
    bg: 'color-mix(in srgb, var(--chart-4) 15%, transparent)',
    color: 'var(--chart-4)'
  },
  // 验工 — 橙
  清单编辑: {
    bg: 'color-mix(in srgb, var(--chart-4) 12%, transparent)',
    color: 'var(--chart-4)'
  },
  清单导入: {
    bg: 'color-mix(in srgb, var(--chart-4) 10%, transparent)',
    color: 'var(--chart-4)'
  },
  验工提交: {
    bg: 'color-mix(in srgb, var(--chart-4) 15%, transparent)',
    color: 'var(--chart-4)'
  },
  验工审批: {
    bg: 'color-mix(in srgb, var(--chart-4) 18%, transparent)',
    color: 'var(--chart-4)'
  },
  验工新增: {
    bg: 'color-mix(in srgb, var(--chart-4) 12%, transparent)',
    color: 'var(--chart-4)'
  },
  验工编辑: {
    bg: 'color-mix(in srgb, var(--chart-4) 10%, transparent)',
    color: 'var(--chart-4)'
  },
  验工删除: {
    bg: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
    color: 'var(--destructive)'
  },
  预算同步: {
    bg: 'color-mix(in srgb, var(--chart-4) 10%, transparent)',
    color: 'var(--chart-4)'
  },
  验工调整: {
    bg: 'color-mix(in srgb, var(--chart-4) 10%, transparent)',
    color: 'var(--chart-4)'
  },
  拨款编辑: {
    bg: 'color-mix(in srgb, var(--chart-4) 10%, transparent)',
    color: 'var(--chart-4)'
  },
  // 安全文明措施费 — 绿
  措施新增: {
    bg: 'color-mix(in srgb, var(--chart-2) 12%, transparent)',
    color: 'var(--chart-2)'
  },
  措施编辑: {
    bg: 'color-mix(in srgb, var(--chart-2) 10%, transparent)',
    color: 'var(--chart-2)'
  },
  措施删除: {
    bg: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
    color: 'var(--destructive)'
  },
  措施提交: {
    bg: 'color-mix(in srgb, var(--chart-2) 15%, transparent)',
    color: 'var(--chart-2)'
  },
  措施关联: {
    bg: 'color-mix(in srgb, var(--chart-2) 10%, transparent)',
    color: 'var(--chart-2)'
  },
  // 档案 — 紫
  档案上传: {
    bg: 'color-mix(in srgb, var(--chart-1) 12%, transparent)',
    color: 'var(--chart-1)'
  },
  档案编辑: {
    bg: 'color-mix(in srgb, var(--chart-1) 10%, transparent)',
    color: 'var(--chart-1)'
  },
  档案删除: {
    bg: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
    color: 'var(--destructive)'
  },
  一致性检查: {
    bg: 'color-mix(in srgb, var(--chart-1) 15%, transparent)',
    color: 'var(--chart-1)'
  },
  // 权限 — 主色
  角色授权: {
    bg: 'color-mix(in srgb, var(--primary) 10%, transparent)',
    color: 'var(--primary)'
  },
  角色取消: {
    bg: 'color-mix(in srgb, var(--chart-5) 12%, transparent)',
    color: 'var(--chart-5)'
  },
  权限变更: {
    bg: 'color-mix(in srgb, var(--chart-4) 12%, transparent)',
    color: 'var(--chart-4)'
  },
  成员添加: {
    bg: 'color-mix(in srgb, var(--chart-2) 12%, transparent)',
    color: 'var(--chart-2)'
  },
  成员移除: {
    bg: 'color-mix(in srgb, var(--chart-5) 12%, transparent)',
    color: 'var(--chart-5)'
  },
  角色新增: {
    bg: 'color-mix(in srgb, var(--primary) 12%, transparent)',
    color: 'var(--primary)'
  },
  // 用户
  用户新增: {
    bg: 'color-mix(in srgb, var(--chart-2) 12%, transparent)',
    color: 'var(--chart-2)'
  },
  用户删除: {
    bg: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
    color: 'var(--destructive)'
  },
  // 系统
  数据导出: {
    bg: 'color-mix(in srgb, var(--chart-3) 12%, transparent)',
    color: 'var(--chart-3)'
  },
  用户登录: {
    bg: 'color-mix(in srgb, var(--muted-foreground) 15%, transparent)',
    color: 'var(--muted-foreground)'
  }
}

const OP_TYPES = Object.keys(OP_TYPE_COLORS)

type LogApiEvent = {
  eventId: string
  eventTime: string
  who?: {
    userId?: string | null
    user?: { id: string; name: string | null; email: string | null } | null
    ip?: string | null
  } | null
  where?: {
    module?: string | null
  } | null
  what?: {
    targetId?: string | null
    payloadSummary?: { text?: string } | string | Record<string, unknown> | null
  } | null
  result?: {
    status?: 'success' | 'fail' | 'unknown' | null
  } | null
  metadata?: {
    opType?: string
    operatorDept?: string
    target?: string
    detail?: string
  } | null
}

type LogsApiResponse = {
  items: LogApiEvent[]
  total: number
  page: number
  pageSize: number
}

const apiOrigin = useApiOrigin()

// 响应式状态
const search = ref('')
const debouncedSearch = ref('')
const selectedType = ref<{ value: string; label: string } | undefined>(undefined)
const selectedResult = ref<{ value: string; label: string } | undefined>(undefined)
const filterDateFrom = ref('')
const filterDateTo = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const viewingLog = ref<LogEntry | null>(null)
const logs = ref<LogEntry[]>([])
const totalItems = ref(0)
const loading = ref(false)
const exporting = ref(false)

// 下拉可选项
const typeOptions = computed(() => {
  const opts = [{ value: 'all', label: '全部类型' }]
  OP_TYPES.forEach((t) => opts.push({ value: t, label: t }))
  return opts
})

const resultOptions = [
  { value: 'all', label: '全部结果' },
  { value: '成功', label: '成功' },
  { value: '失败', label: '失败' }
]

// 是否有处于启用状态的过滤器
const hasFilters = computed(() => {
  return (
    search.value.trim() !== '' ||
    (selectedType.value && selectedType.value.value !== 'all') ||
    (selectedResult.value && selectedResult.value.value !== 'all') ||
    filterDateFrom.value !== '' ||
    filterDateTo.value !== ''
  )
})

// 构建查询参数
const buildLogQuery = (params?: { page?: number; pageSize?: number }) => {
  const query = new URLSearchParams()
  query.set('page', String(params?.page || currentPage.value))
  query.set('pageSize', String(params?.pageSize || pageSize.value))

  if (debouncedSearch.value) {
    query.set('q', debouncedSearch.value)
  }
  if (selectedType.value?.value && selectedType.value.value !== 'all') {
    query.set('opType', selectedType.value.value)
  }
  if (selectedResult.value?.value === '成功') {
    query.set('result', 'success')
  } else if (selectedResult.value?.value === '失败') {
    query.set('result', 'fail')
  }
  if (filterDateFrom.value) {
    query.set('dateFrom', filterDateFrom.value)
  }
  if (filterDateTo.value) {
    query.set('dateTo', filterDateTo.value)
  }

  return query
}

const getPayloadSummaryText = (
  payloadSummary: LogApiEvent['what'] extends { payloadSummary?: infer T } ? T : unknown
) => {
  if (typeof payloadSummary === 'string') return payloadSummary
  if (payloadSummary && typeof payloadSummary === 'object') {
    if ('text' in payloadSummary && typeof payloadSummary.text === 'string') {
      return payloadSummary.text
    }

    try {
      return JSON.stringify(payloadSummary)
    } catch {
      return '-'
    }
  }

  return '-'
}

const mapLogEvent = (event: LogApiEvent): LogEntry => ({
  id: event.eventId || `${Date.now()}`,
  operator: event.who?.user?.name || event.who?.userId || '系统用户',
  operatorDept: event.metadata?.operatorDept || '项目部',
  opType: event.metadata?.opType || '未知类型',
  module: event.where?.module || '未知模块',
  target: event.metadata?.target || event.what?.targetId || '-',
  detail: event.metadata?.detail || getPayloadSummaryText(event.what?.payloadSummary),
  ipAddress: event.who?.ip || '-',
  operatedAt: dayjs(event.eventTime).format('YYYY-MM-DD HH:mm:ss'),
  result: event.result?.status === 'success' ? '成功' : '失败'
})

const fetchLogsPage = async (params?: { page?: number; pageSize?: number }) => {
  const query = buildLogQuery(params)
  return await $fetch<LogsApiResponse>(
    `${apiOrigin}/api/v1/logs/events?${query.toString()}`
  )
}

// 清空全部过滤器
const clearFilters = () => {
  search.value = ''
  selectedType.value = undefined
  selectedResult.value = undefined
  filterDateFrom.value = ''
  filterDateTo.value = ''
  currentPage.value = 1
}

// 详情弹框是否显示
const dialogOpen = computed({
  get: () => !!viewingLog.value,
  set: (val) => {
    if (!val) viewingLog.value = null
  }
})

// 获取操作类型高亮背景与文本色样式
const getTypeStyle = (opType: string) => {
  return (
    OP_TYPE_COLORS[opType] || { bg: 'var(--muted)', color: 'var(--muted-foreground)' }
  )
}

// 获取详情弹窗键值项
const detailItems = computed(() => {
  const log = viewingLog.value
  if (!log) return []
  return [
    { label: '操作人', value: `${log.operator}（${log.operatorDept}）` },
    { label: '所属模块', value: log.module },
    { label: '操作类型', value: log.opType },
    { label: '操作对象', value: log.target },
    { label: '操作详情', value: log.detail },
    { label: 'IP 地址', value: log.ipAddress },
    { label: '操作时间', value: log.operatedAt },
    { label: '操作结果', value: log.result }
  ]
})

const loadRealLogs = async () => {
  loading.value = true
  try {
    const data = await fetchLogsPage()
    logs.value = Array.isArray(data.items) ? data.items.map(mapLogEvent) : []
    totalItems.value = Number(data.total || 0)
  } catch (err) {
    logs.value = []
    totalItems.value = 0
    // eslint-disable-next-line no-console
    console.warn('Failed to load real logs from database', err)
  } finally {
    loading.value = false
  }
}

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalItems.value / pageSize.value))
})

// 导出为 CSV 文件
const handleExportCsv = async () => {
  exporting.value = true
  try {
    const exportPageSize = 500
    let exportPage = 1
    let exportTotal = 0
    const exportLogs: LogEntry[] = []

    do {
      const data = await fetchLogsPage({
        page: exportPage,
        pageSize: exportPageSize
      })
      exportTotal = Number(data.total || 0)
      exportLogs.push(...(Array.isArray(data.items) ? data.items.map(mapLogEvent) : []))
      exportPage += 1
    } while (exportLogs.length < exportTotal)

    const headers = [
      '操作人',
      '部门/单位',
      '所属模块',
      '操作类型',
      '操作对象',
      '操作详情',
      '操作时间',
      '结果',
      'IP地址'
    ]
    const rows = exportLogs.map((log) => [
      log.operator,
      log.operatorDept,
      log.module,
      log.opType,
      log.target,
      log.detail,
      log.operatedAt,
      log.result,
      log.ipAddress
    ])

    const csvContent =
      '\uFEFF' +
      [
        headers.join(','),
        ...rows.map((row) =>
          row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `操作日志导出-${dayjs().format('YYYYMMDDHHmmss')}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}

const updateDebouncedSearch = useDebounceFn((value: string) => {
  debouncedSearch.value = value.trim()
}, 300)

watch(
  search,
  (value) => {
    currentPage.value = 1
    updateDebouncedSearch(value)
  },
  { immediate: true }
)

watch([selectedType, selectedResult, filterDateFrom, filterDateTo], () => {
  currentPage.value = 1
})

watch(
  [
    debouncedSearch,
    selectedType,
    selectedResult,
    filterDateFrom,
    filterDateTo,
    currentPage,
    pageSize
  ],
  () => {
    void loadRealLogs()
  },
  { immediate: true }
)
</script>
