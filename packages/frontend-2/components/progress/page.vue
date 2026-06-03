<template>
  <div class="flex flex-col gap-5 text-foreground">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <h1 class="text-heading-lg">进度管理总览</h1>
        <p class="mt-1 text-body-xs text-foreground-2">
          实时监控项目进度，及时发现问题
        </p>
      </div>
      <div class="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
        <label
          class="flex h-10 flex-1 items-center gap-2 rounded-lg border border-outline-3 bg-foundation px-3 xl:min-w-[320px]"
        >
          <Search class="h-4 w-4 shrink-0 text-foreground-2" />
          <span class="sr-only">搜索项目、任务和里程碑</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索项目、任务、里程碑..."
            class="w-full bg-transparent text-body-sm outline-none placeholder:text-foreground-3 border-none"
          />
        </label>
        <button
          type="button"
          aria-label="刷新数据"
          class="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-3 bg-foundation text-foreground-2 transition hover:bg-primary-muted hover:text-primary"
          @click="loadOverview"
        >
          <RefreshCcw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>
    </div>

    <div
      v-if="overviewErrorMessage"
      class="rounded-lg border border-warning bg-warning-lighter px-4 py-3 text-body-xs text-warning-darker"
    >
      {{ overviewErrorMessage }}
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div
        v-for="card in summaryCards"
        :key="card.id"
        class="flex min-h-[96px] items-center justify-between rounded-xl border border-outline-3 bg-foundation px-5 py-4 shadow-sm"
      >
        <div class="flex items-center gap-4">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-xl"
            :class="card.iconBgClass"
          >
            <component :is="card.icon" class="h-5 w-5" :class="card.iconTextClass" />
          </div>
          <div>
            <div class="text-body-2xs text-foreground-2">{{ card.label }}</div>
            <div class="mt-1 text-heading-lg font-bold leading-none text-foreground">
              {{ card.value }}
            </div>
          </div>
        </div>
        <div v-if="card.helper" class="text-body-3xs font-medium text-foreground-2">
          {{ card.helper }}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section class="rounded-xl border border-outline-3 bg-foundation shadow-sm">
        <div
          class="flex items-center justify-between border-b border-outline-3 px-4 py-4"
        >
          <div class="flex items-center gap-2">
            <Target class="h-4 w-4 text-primary" />
            <h2 class="text-body-sm font-semibold text-foreground">关键任务</h2>
            <span
              class="rounded-full bg-primary-muted px-2 py-0.5 text-body-3xs font-medium text-primary"
            >
              {{ filteredKeyTasks.length }}项
            </span>
          </div>
        </div>
        <div class="flex min-h-[296px] flex-col gap-3 p-3">
          <div
            v-for="task in filteredKeyTasks"
            :key="task.id"
            class="flex items-center justify-between gap-4 rounded-lg border border-outline-3 bg-foundation-page px-4 py-3"
          >
            <div class="min-w-0">
              <div class="truncate text-body-sm font-medium text-foreground">
                {{ task.title }}
              </div>
              <div class="mt-1 truncate text-body-xs text-foreground-2">
                {{ task.projectName }}
              </div>
            </div>
            <div class="shrink-0 text-body-xs font-medium text-foreground-2">
              {{ task.deadline }}
            </div>
          </div>
          <div
            v-if="!filteredKeyTasks.length"
            class="flex flex-1 items-center justify-center rounded-lg border border-dashed border-outline-3 bg-foundation-page text-body-sm text-foreground-2"
          >
            {{ isLoading ? '关键任务加载中...' : '暂无关键任务' }}
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-outline-3 bg-foundation shadow-sm">
        <div
          class="flex items-center justify-between border-b border-outline-3 px-4 py-4"
        >
          <div class="flex items-center gap-2">
            <Flag class="h-4 w-4 text-info" />
            <h2 class="text-body-sm font-semibold text-foreground">里程碑</h2>
            <span
              class="rounded-full bg-info-lighter px-2 py-0.5 text-body-3xs font-medium text-info"
            >
              {{ filteredMilestones.length }}项
            </span>
          </div>
        </div>
        <div class="flex min-h-[296px] flex-col gap-3 p-3">
          <div
            v-for="milestone in filteredMilestones"
            :key="milestone.id"
            class="flex items-center justify-between gap-4 rounded-lg border border-outline-3 bg-foundation-page px-4 py-3"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <Flag
                  class="h-3.5 w-3.5 shrink-0"
                  :class="getMilestoneFlagClass(milestone.milestoneType || null)"
                />
                <div class="truncate text-body-sm font-medium text-foreground">
                  {{ milestone.title }}
                </div>
              </div>
              <div class="mt-1 truncate text-body-xs text-foreground-2">
                {{ milestone.projectName }}
              </div>
            </div>
            <div class="shrink-0 text-body-xs font-medium text-foreground-2">
              {{ milestone.deadline }}
            </div>
          </div>
          <div
            v-if="!filteredMilestones.length"
            class="flex flex-1 items-center justify-center rounded-lg border border-dashed border-outline-3 bg-foundation-page text-body-sm text-foreground-2"
          >
            {{ isLoading ? '里程碑加载中...' : '暂无里程碑事件' }}
          </div>
        </div>
      </section>
    </div>

    <section class="rounded-xl border border-outline-3 bg-foundation shadow-sm">
      <div class="border-b border-outline-3 px-4 py-4">
        <div class="flex items-center gap-2">
          <Activity class="h-4 w-4 text-primary" />
          <h2 class="text-body-sm font-semibold text-foreground">项目进度详情</h2>
        </div>
      </div>
      <LayoutTable
        class="progress-overview-table"
        :columns="tableColumns"
        :items="filteredProjects"
        :loading="isLoading"
        empty-message="暂无匹配的项目数据"
      >
        <template #projectInfo="{ item }">
          <div class="flex flex-col gap-1.5 py-1">
            <div class="text-body-sm font-semibold text-foreground">
              {{ item.name }}
            </div>
            <div
              class="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-xs text-foreground-2"
            >
              <span>计划工期: {{ item.planDateRange }}</span>
              <span>任务:</span>
              <span class="font-medium text-success">
                {{ item.finishedTasks }}个完成
              </span>
              <span class="font-medium text-primary">
                {{ item.inProgressTasks }}个进行中
              </span>
              <span v-if="item.delayedTasks > 0" class="font-medium text-danger">
                {{ item.delayedTasks }}个延期
              </span>
            </div>
          </div>
        </template>

        <template #manager="{ item }">
          <span class="text-body-sm text-foreground">{{ item.manager }}</span>
        </template>

        <template #action="{ item }">
          <NuxtLink
            :to="`/projects/${item.id}/progress/schedule`"
            class="inline-flex items-center gap-1 text-body-xs font-medium text-primary transition hover:text-primary-focus"
          >
            查看详情
            <ArrowRight class="h-3.5 w-3.5" />
          </NuxtLink>
        </template>
      </LayoutTable>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useApolloClient } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import {
  getProgressPlanTasks,
  getProgressStatistics,
  type ProgressPlanTask,
  type ProgressStatistics
} from '~/lib/projects/api/progress'
import type { LucideIcon } from 'lucide-vue-next'
import {
  Activity,
  ArrowRight,
  Calendar,
  Flag,
  RefreshCcw,
  Search,
  Target
} from 'lucide-vue-next'

type ProgressOverviewProjectsQueryResult = {
  activeUser: {
    id: string
    projects: {
      items: Array<{
        id: string
        name: string | null
        responsible: string | null
        team: Array<{ user: { name: string | null } | null } | null> | null
      } | null>
    }
  } | null
}

type SummaryCard = {
  id: string
  label: string
  value: string
  icon: LucideIcon
  iconBgClass: string
  iconTextClass: string
  helper?: string
}

type ProjectOverviewStatus = 'onTrack' | 'attention' | 'delayed'

type ProgressItem = {
  id: string
  name: string
  manager: string
  planDateRange: string
  progress: number
  totalTasks: number
  finishedTasks: number
  inProgressTasks: number
  delayedTasks: number
  scheduleStatus: ProjectOverviewStatus
}

type ScheduleCardItem = {
  id: string
  title: string
  projectName: string
  deadline: string
  sortTime: number
  milestoneType?: ProgressPlanTask['milestoneType']
}

type ProjectBase = {
  id: string
  name: string
  responsible: string | null
  teamNames: string[]
}

type ProjectDisplayTaskStats = {
  totalTasks: number
  finishedTasks: number
  inProgressTasks: number
  delayedTasks: number
}

const progressOverviewProjectsQuery = gql`
  query ProgressOverviewProjects {
    activeUser {
      id
      projects(limit: 100) {
        items {
          id
          name
          responsible
          team {
            user {
              name
            }
          }
        }
      }
    }
  }
`

const tableColumns = [
  { id: 'projectInfo', header: '项目信息', classes: 'col-span-7' },
  { id: 'manager', header: '项目经理', classes: 'col-span-3' },
  { id: 'action', header: '操作', classes: 'col-span-2 text-right' }
]

const STATUS_PRIORITY: Record<ProjectOverviewStatus, number> = {
  delayed: 0,
  attention: 1,
  onTrack: 2
}

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()
const apiOrigin = useApiOrigin()

const searchQuery = ref('')
const isLoading = ref(false)
const overviewErrorMessage = ref('')
const progressProjects = ref<ProgressItem[]>([])
const keyTasks = ref<ScheduleCardItem[]>([])
const milestones = ref<ScheduleCardItem[]>([])

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase())

const includesQuery = (values: string[]) => {
  if (!normalizedSearchQuery.value) return true
  return values.some((value) =>
    value.toLowerCase().includes(normalizedSearchQuery.value)
  )
}

const filteredProjects = computed(() =>
  progressProjects.value.filter((item) =>
    includesQuery([
      item.name,
      item.manager,
      item.planDateRange,
      `${item.finishedTasks}个完成`,
      `${item.inProgressTasks}个进行中`
    ])
  )
)

const filteredKeyTasks = computed(() =>
  keyTasks.value.filter((item) =>
    includesQuery([item.title, item.projectName, item.deadline])
  )
)

const filteredMilestones = computed(() =>
  milestones.value.filter((item) =>
    includesQuery([item.title, item.projectName, item.deadline])
  )
)

const totalTaskCount = computed(() =>
  progressProjects.value.reduce((total, item) => total + item.totalTasks, 0)
)

const averageProgress = computed(() => {
  if (!progressProjects.value.length) return 0
  const total = progressProjects.value.reduce((sum, item) => sum + item.progress, 0)
  return Math.round(total / progressProjects.value.length)
})

const summaryCards = computed<SummaryCard[]>(() => [
  {
    id: 'projects',
    label: '项目总数',
    value: String(progressProjects.value.length),
    icon: Calendar,
    iconBgClass: 'bg-primary-muted',
    iconTextClass: 'text-primary',
    helper: isLoading.value ? '加载中' : '真实聚合'
  },
  {
    id: 'tasks',
    label: '任务总数',
    value: String(totalTaskCount.value),
    icon: Target,
    iconBgClass: 'bg-info-lighter',
    iconTextClass: 'text-info',
    helper: isLoading.value ? '加载中' : '计划任务'
  },
  {
    id: 'progress',
    label: '平均进度',
    value: `${averageProgress.value}%`,
    icon: Activity,
    iconBgClass: 'bg-success-lighter',
    iconTextClass: 'text-success',
    helper: isLoading.value ? '加载中' : '自动汇总'
  }
])

const getTimestamp = (value: string | null) => {
  if (!value) return Number.MAX_SAFE_INTEGER
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp
}

const formatPlanDate = (value: string | null) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('zh-CN').replaceAll('/', '-')
}

const formatScheduleCardDeadline = (value: string | null) => {
  if (!value) return '未设置日期'
  return formatPlanDate(value)
}

const getProjectManager = (project: ProjectBase) => {
  return project.responsible || project.teamNames[0] || '-'
}

const getMilestoneFlagClass = (value: ProgressPlanTask['milestoneType']) => {
  switch (value) {
    case 'project':
      return 'text-primary'
    case 'phase':
      return 'text-info'
    case 'acceptance':
      return 'text-success'
    default:
      return 'text-foreground-2'
  }
}

const resolveDisplayTaskStats = (
  tasks: ProgressPlanTask[]
): ProjectDisplayTaskStats => {
  const leafTasks = tasks.filter((task) => !task.hasChildren)

  return {
    totalTasks: leafTasks.length,
    finishedTasks: leafTasks.filter(
      (task) =>
        task.taskStatus === 'finished_on_time' || task.taskStatus === 'finished_delayed'
    ).length,
    inProgressTasks: leafTasks.filter((task) => task.taskStatus === 'in_progress')
      .length,
    delayedTasks: leafTasks.filter((task) => task.taskStatus === 'delayed').length
  }
}

const resolveScheduleState = (statistics: ProgressStatistics) => {
  if (!statistics.totalTasks) {
    return {
      scheduleStatus: 'onTrack' as const,
      scheduleText: '暂无任务'
    }
  }

  if (
    statistics.delayedTasks > 0 ||
    statistics.delayedFinishElements > 0 ||
    statistics.delayedNotStartedElements > 0
  ) {
    return {
      scheduleStatus: 'delayed' as const,
      scheduleText: `延期 ${statistics.delayedTasks || 1} 项`
    }
  }

  if (statistics.inProgressTasks > 0 || statistics.inProgressDelayedElements > 0) {
    return {
      scheduleStatus: 'attention' as const,
      scheduleText: `进行中 ${statistics.inProgressTasks} 项`
    }
  }

  if (statistics.finishedTasks === statistics.totalTasks) {
    return {
      scheduleStatus: 'onTrack' as const,
      scheduleText: '已完成'
    }
  }

  if (statistics.notStartedTasks === statistics.totalTasks) {
    return {
      scheduleStatus: 'onTrack' as const,
      scheduleText: '待开始'
    }
  }

  return {
    scheduleStatus: 'onTrack' as const,
    scheduleText: '按计划推进'
  }
}

const resolvePlanDateRange = (
  tasks: Awaited<ReturnType<typeof getProgressPlanTasks>>
) => {
  const dates = tasks.flatMap((task) => [task.startDate, task.endDate]).filter(Boolean)
  if (!dates.length) return '- 至 -'

  const timestamps = dates
    .map((value) => new Date(value as string).getTime())
    .filter((value) => !Number.isNaN(value))
    .sort((left, right) => left - right)

  if (!timestamps.length) return '- 至 -'

  return `${formatPlanDate(new Date(timestamps[0]).toISOString())} 至 ${formatPlanDate(
    new Date(timestamps[timestamps.length - 1]).toISOString()
  )}`
}

const loadProjectBases = async (): Promise<ProjectBase[]> => {
  const response = await apollo.query<ProgressOverviewProjectsQueryResult>({
    query: progressOverviewProjectsQuery,
    fetchPolicy: 'network-only'
  })

  return (response.data.activeUser?.projects.items || [])
    .filter((item): item is NonNullable<typeof item> => !!item)
    .map((item) => ({
      id: item.id,
      name: item.name || item.id,
      responsible: item.responsible,
      teamNames: (item.team || [])
        .flatMap((member) => {
          const name = member?.user?.name?.trim()
          return name ? [name] : []
        })
        .filter(Boolean)
    }))
}

const loadProjectOverviewItem = async (project: ProjectBase) => {
  const [statistics, planTasks] = await Promise.all([
    getProgressStatistics({
      projectId: project.id,
      apiOrigin
    }),
    getProgressPlanTasks({
      projectId: project.id,
      apiOrigin
    })
  ])

  const scheduleState = resolveScheduleState(statistics)
  const displayTaskStats = resolveDisplayTaskStats(planTasks)

  return {
    item: {
      id: project.id,
      name: project.name,
      manager: getProjectManager(project),
      planDateRange: resolvePlanDateRange(planTasks),
      progress: Math.round(statistics.completionRate),
      totalTasks: displayTaskStats.totalTasks,
      finishedTasks: displayTaskStats.finishedTasks,
      inProgressTasks: displayTaskStats.inProgressTasks,
      delayedTasks: displayTaskStats.delayedTasks,
      scheduleStatus: scheduleState.scheduleStatus,
      scheduleText: scheduleState.scheduleText
    },
    keyTasks: planTasks
      .filter((task) => task.isCriticalTask)
      .map<ScheduleCardItem>((task) => ({
        id: `${project.id}-${task.id}-critical`,
        title: task.taskName,
        projectName: project.name,
        deadline: formatScheduleCardDeadline(task.endDate),
        sortTime: getTimestamp(task.endDate)
      })),
    milestones: planTasks
      .filter(
        (
          task
        ): task is ProgressPlanTask & {
          milestoneType: NonNullable<ProgressPlanTask['milestoneType']>
        } => !!task.milestoneType
      )
      .map<ScheduleCardItem>((task) => ({
        id: `${project.id}-${task.id}-milestone`,
        title: task.milestoneDescription?.trim() || task.taskName,
        projectName: project.name,
        deadline: formatScheduleCardDeadline(task.endDate),
        sortTime: getTimestamp(task.endDate),
        milestoneType: task.milestoneType
      }))
  }
}

const loadOverview = async () => {
  isLoading.value = true
  overviewErrorMessage.value = ''

  try {
    const projectBases = await loadProjectBases()
    const settledResults = await Promise.allSettled(
      projectBases.map((project) => loadProjectOverviewItem(project))
    )

    const successResults = settledResults.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : []
    )
    const failedCount = settledResults.length - successResults.length

    progressProjects.value = successResults
      .map((result) => result.item)
      .sort((left, right) => {
        const statusOrder =
          STATUS_PRIORITY[left.scheduleStatus] - STATUS_PRIORITY[right.scheduleStatus]
        if (statusOrder !== 0) return statusOrder
        if (left.progress !== right.progress) return right.progress - left.progress
        return left.name.localeCompare(right.name, 'zh-CN')
      })

    keyTasks.value = successResults
      .flatMap((result) => result.keyTasks)
      .sort((left, right) => {
        if (left.sortTime !== right.sortTime) return left.sortTime - right.sortTime
        return left.title.localeCompare(right.title, 'zh-CN')
      })

    milestones.value = successResults
      .flatMap((result) => result.milestones)
      .sort((left, right) => {
        if (left.sortTime !== right.sortTime) return left.sortTime - right.sortTime
        return left.title.localeCompare(right.title, 'zh-CN')
      })

    if (failedCount > 0) {
      triggerNotification({
        type: ToastNotificationType.Warning,
        title: '部分项目进度加载失败',
        description: `已成功加载 ${successResults.length} 个项目，失败 ${failedCount} 个项目。`
      })
    }
  } catch (error) {
    progressProjects.value = []
    keyTasks.value = []
    milestones.value = []
    overviewErrorMessage.value =
      error instanceof Error ? error.message : '进度总览加载失败，请稍后重试。'
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '进度总览加载失败',
      description: overviewErrorMessage.value
    })
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadOverview()
})
</script>

<style scoped>
.progress-overview-table :deep(.z-10.grid.grid-cols-12) {
  min-height: 50px;
}

.progress-overview-table :deep(.relative.grid.grid-cols-12) {
  min-height: 76px;
}

.progress-overview-table :deep(.relative.grid.grid-cols-12 > div:not(:first-child)) {
  display: flex;
  align-items: center;
}
</style>
