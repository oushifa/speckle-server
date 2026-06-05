<template>
  <div>
    <Portal to="current-page">
      <NuxtLink :to="`/projects/${projectId}/settings/approval`">项目设置</NuxtLink>
      <span> / 审批流程</span>
    </Portal>

    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-6 mb-8">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">审批流程设置</h1>
        <p class="text-sm text-slate-500 mt-1">配置与管理项目中的各类业务审批流节点及审批人员</p>
      </div>
      <div class="flex items-center gap-3 self-end md:self-auto">
        <!-- Search bar -->
        <div class="relative w-64">
          <label for="search-input" class="sr-only">搜索审批模板</label>
          <input
            id="search-input"
            v-model="searchQuery"
            type="text"
            placeholder="搜索审批模板..."
            class="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          <span class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>
        <!-- Create button -->
        <button
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors duration-150"
          @click="openCreateModal()"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          新建审批流
        </button>
      </div>
    </div>

    <!-- Empty State (No flows at all) -->
    <div
      v-if="flows.length === 0"
      class="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-2xl border border-slate-100 p-8 text-center"
    >
      <div class="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center mb-3">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-sm font-medium text-slate-600">该项目尚未配置任何审批流程</p>
      <button class="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium" @click="openCreateModal()">
        立即新建审批流
      </button>
    </div>

    <!-- Empty Search State -->
    <div
      v-else-if="searchedFlows.length === 0"
      class="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-2xl border border-slate-100 p-8 text-center"
    >
      <div class="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center mb-3">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-sm font-medium text-slate-600">未找到匹配的审批流程</p>
      <button class="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium" @click="searchQuery = ''">
        清除搜索条件
      </button>
    </div>

    <!-- Approval Flows List by Category -->
    <div v-else class="space-y-8">
      <div
        v-for="cat in activeCategories"
        :key="cat.id"
        class="border border-slate-150 bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200 relative overflow-hidden"
      >
        <!-- Category Title Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div class="flex flex-wrap items-center gap-2.5">
            <h2 class="text-base font-bold text-slate-800">{{ cat.name }}</h2>
            <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              共 {{ getFilteredFlowsByCategory(cat.id).length }} 个版本
            </span>
          </div>
          <div class="flex items-center gap-2 self-end sm:self-auto">
            <button
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors duration-150"
              @click="openCreateModal(cat.id)"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
              </svg>
              新建版本
            </button>
          </div>
        </div>

        <!-- Current Active Version Details -->
        <div class="mt-4">
          <div v-if="activeFlows[cat.id]" class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-slate-700">当前生效版本：{{ activeFlows[cat.id]!.name }}</span>
                <span class="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md">V{{ activeFlows[cat.id]!.version }}</span>
                <span class="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md">启用中</span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  class="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg transition-colors"
                  @click="toggleFlowStatus(activeFlows[cat.id]!)"
                >
                  停用
                </button>
                <button
                  class="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg transition-colors"
                  title="编辑"
                  @click="openEditModal(activeFlows[cat.id]!)"
                >
                  <IconEdit class="w-3.5 h-3.5" />
                </button>
                <button
                  class="p-1.5 border border-slate-200 hover:bg-red-50 hover:border-red-100 text-red-500 rounded-lg transition-colors"
                  title="删除"
                  @click="confirmDelete(activeFlows[cat.id]!)"
                >
                  <IconDelete class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p class="text-xs text-slate-500 leading-relaxed">{{ activeFlows[cat.id]!.description || '暂无描述' }}</p>

            <!-- Visual Flow Diagram -->
            <div class="my-4 py-4 px-5 bg-slate-50/50 border border-slate-100 rounded-xl overflow-x-auto simple-scrollbar">
              <div class="flex items-center gap-4 min-w-max py-1">
                <!-- Start Node -->
                <div class="flex flex-col items-center gap-2">
                  <div class="w-9 h-9 rounded-full border-2 border-emerald-500 bg-white flex items-center justify-center shadow-sm">
                    <div class="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  </div>
                  <span class="text-xs font-medium text-slate-600">开始</span>
                </div>

                <!-- Steps -->
                <template v-for="step in activeFlows[cat.id]!.steps" :key="step.id">
                  <!-- Arrow -->
                  <div class="text-slate-300">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  <!-- Step Card -->
                  <div class="flex flex-col items-center gap-2">
                    <div class="border border-blue-100 bg-white rounded-xl shadow-sm px-4 py-2.5 flex flex-col items-center min-w-[120px] relative">
                      <div class="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
                        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                      </div>
                      <span class="text-xs font-bold text-slate-800">{{ step.role }}</span>
                      <span class="text-[10px] text-slate-400 mt-0.5 max-w-[110px] truncate" :title="step.approvers.join('，')">
                        {{ step.approvers.join('，') }}
                      </span>
                      <span class="text-[9px] font-semibold text-blue-600 bg-blue-50/70 border border-blue-100/50 px-1.5 py-0.5 rounded-full mt-1.5">
                        {{ step.mode === 'OR' ? '或签' : '依次审批' }}
                      </span>
                    </div>
                  </div>
                </template>

                <!-- Arrow to End -->
                <div class="text-slate-300">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                <!-- End Node -->
                <div class="flex flex-col items-center gap-2">
                  <div class="w-9 h-9 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center shadow-sm">
                    <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span class="text-xs font-medium text-slate-600">结束</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-slate-400 py-6 bg-slate-50/40 rounded-2xl border border-dashed border-slate-200 text-center">
            当前类别未启用任何审批流程版本
          </div>
        </div>

        <!-- Expandable Version History -->
        <div class="mt-5 border-t border-slate-100 pt-4">
          <details class="group">
            <summary class="flex items-center justify-between text-[11px] font-semibold text-slate-400 cursor-pointer hover:text-slate-600 select-none transition-colors">
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5 transition-transform group-open:rotate-90 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                版本历史 ({{ getFilteredFlowsByCategory(cat.id).length }} 个定义)
              </span>
            </summary>
            <div class="mt-3 space-y-2.5 max-h-64 overflow-y-auto pr-1 simple-scrollbar">
              <div
                v-for="flow in getFilteredFlowsByCategory(cat.id)"
                :key="flow.id"
                class="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/30 hover:bg-slate-50/70 transition-colors"
              >
                <div class="flex items-center gap-2">
                  <span class="text-[11px] font-bold text-slate-500">V{{ flow.version }}</span>
                  <span class="text-[11px] text-slate-600 font-semibold truncate max-w-[140px]">{{ flow.name }}</span>
                  <span
                    :class="[
                      'px-1 py-0.5 text-[8px] font-bold rounded border',
                      flow.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                    ]"
                  >
                    {{ flow.isActive ? '生效中' : '已停用' }}
                  </span>
                  <span class="text-[9px] text-slate-400">最后更新：{{ flow.updatedAt }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <button
                    v-if="!flow.isActive"
                    class="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg transition-colors shadow-sm"
                    @click="toggleFlowStatus(flow)"
                  >
                    启用
                  </button>
                  <button
                    class="p-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg transition-colors shadow-sm"
                    title="编辑"
                    @click="openEditModal(flow)"
                  >
                    <IconEdit class="w-3.5 h-3.5" />
                  </button>
                  <button
                    class="p-1 bg-white border border-slate-200 hover:bg-red-50 hover:border-red-150 text-red-500 rounded-lg transition-colors shadow-sm"
                    title="删除"
                    @click="confirmDelete(flow)"
                  >
                    <IconDelete class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>

    <!-- Confirm Delete Dialog -->
    <CommonConfirmDialog
      v-model:open="isDeleteConfirmOpen"
      title="确定要删除审批流程吗？"
      confirm-text="确认删除"
      @confirm="deleteFlow"
    >
      <div class="text-sm text-slate-500 py-2">
        流程删除后将无法恢复，关联的审批任务将受到影响。确认要删除 <span class="font-bold text-slate-700">“{{ selectedFlow?.name }}” (V{{ selectedFlow?.version }})</span> 吗？
      </div>
    </CommonConfirmDialog>

    <!-- Create / Edit Flow Dialog -->
    <LayoutDialog
      v-model:open="isFormModalOpen"
      max-width="md"
      :buttons="formDialogButtons"
    >
      <template #header>{{ isEditMode ? '编辑审批流程' : '新建审批流程' }}</template>
      <div class="space-y-4 max-h-[65vh] overflow-y-auto pr-2 simple-scrollbar">
        <!-- Warning message for active flows creation -->
        <div v-if="categoryHasDefinitions && !isEditMode" class="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5 flex items-start gap-1.5">
          <svg class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>提示：该类别在当前项目中已存在审批流程。保存新配置将生成该流程的最新版本，原启用版本将被自动替换（原审批流程实例不受影响）。</span>
        </div>

        <!-- Flow Name -->
        <div>
          <label for="flow-name" class="block text-xs font-bold text-slate-700 mb-1.5">审批流名称 *</label>
          <input
            id="flow-name"
            v-model="formFlow.name"
            type="text"
            placeholder="请输入审批流名称，如：业务审批流"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <!-- Category & Status -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="flow-category" class="block text-xs font-bold text-slate-700 mb-1.5">所属类别 *</label>
            <select
              id="flow-category"
              v-model="formFlow.category"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              :disabled="isEditMode || isNewVersion"
            >
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div>
            <span class="block text-xs font-bold text-slate-700 mb-1.5">是否启用 *</span>
            <div class="flex items-center gap-4 mt-2">
              <label class="inline-flex items-center text-sm font-medium text-slate-700 cursor-pointer">
                <input v-model="formFlow.isActive" type="radio" :value="true" class="text-blue-600 focus:ring-blue-500 mr-2" />
                启用
              </label>
              <label class="inline-flex items-center text-sm font-medium text-slate-700 cursor-pointer">
                <input v-model="formFlow.isActive" type="radio" :value="false" class="text-blue-600 focus:ring-blue-500 mr-2" />
                停用
              </label>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div>
          <label for="flow-description" class="block text-xs font-bold text-slate-700 mb-1.5">流程描述</label>
          <textarea
            id="flow-description"
            v-model="formFlow.description"
            rows="2"
            placeholder="请输入审批流程描述，说明适用场景..."
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          ></textarea>
        </div>

        <!-- Steps Settings -->
        <div>
          <div class="flex items-center justify-between border-t border-slate-100 pt-4 mb-3">
            <span class="block text-xs font-bold text-slate-700">审批节点配置</span>
            <button
              type="button"
              class="text-xs text-blue-600 hover:text-blue-700 active:text-blue-800 font-semibold flex items-center gap-1"
              @click="addStep"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
              </svg>
              添加节点
            </button>
          </div>

          <!-- Steps Loop -->
          <div class="space-y-3.5">
            <div
              v-for="(step, sIndex) in formFlow.steps"
              :key="step.id"
              class="bg-slate-50 border border-slate-100 rounded-xl p-4 relative"
            >
              <!-- Step Header with Remove Icon -->
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold text-slate-500">节点 {{ sIndex + 1 }}</span>
                <button
                  v-if="formFlow.steps.length > 1"
                  type="button"
                  class="text-slate-400 hover:text-red-500 transition-colors"
                  title="删除节点"
                  @click="removeStep(sIndex)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <!-- Step Form Details -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-2">
                  <label :for="`step-role-${sIndex}`" class="block text-[11px] font-bold text-slate-600 mb-1.5">角色/节点名 *</label>
                  <input
                    :id="`step-role-${sIndex}`"
                    v-model="step.role"
                    type="text"
                    placeholder="如：项目经理"
                    class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label :for="`step-mode-${sIndex}`" class="block text-[11px] font-bold text-slate-600 mb-1.5">审批模式 *</label>
                  <select
                    :id="`step-mode-${sIndex}`"
                    v-model="step.mode"
                    class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="AND">依次审批 (AND)</option>
                    <option value="OR">或签 (OR)</option>
                  </select>
                </div>
                <div class="md:col-span-3">
                  <FormSelectUsers
                    v-model="step.selectedApprovers"
                    :users="allUsers"
                    multiple
                    search
                    label="选择审批人员 *"
                    show-label
                    class="text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LayoutDialog>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Portal } from 'portal-vue'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import type { LayoutDialogButton } from '@speckle/ui-components'
import dayjs from 'dayjs'

// Route setup
const route = useRoute()
const projectId = computed(() => route.params.id as string)

const apiOrigin = useApiOrigin()
const dbUsers = ref<Array<{ id: string; name: string; avatar: string | null }>>([])
const flows = ref<ApprovalFlow[]>([])
const categories = ref<Category[]>([])

// User Selection Interface
type SelectedUser = {
  id: string
  name: string
  avatar: string | null
}

// Category Interface
interface Category {
  id: string
  name: string
}

// Step Interface
interface Step {
  id: string
  role: string
  approvers: string[]
  selectedApprovers?: SelectedUser[]
  mode: 'OR' | 'AND'
}

// ApprovalFlow Interface
interface ApprovalFlow {
  id: string
  templateId: string
  name: string
  category: Category
  isActive: boolean
  version: number
  description: string
  steps: Step[]
  createdAt: string
  updatedAt: string
}

const loadAllUsers = async () => {
  try {
    const data = await $fetch<Array<{ id: string; name: string; avatar: string | null }>>(`${apiOrigin}/api/users`)
    dbUsers.value = data || []
  } catch (err) {
    console.error('Failed to load users from REST API:', err)
  }
}

const loadCategories = async () => {
  try {
    const data = await $fetch<Category[]>(`${apiOrigin}/api/approval-categories`)
    categories.value = data || []
  } catch (err) {
    console.error('Failed to load categories:', err)
  }
}

const loadApprovalFlows = async () => {
  try {
    const data = await $fetch<ApprovalFlow[]>(`${apiOrigin}/api/projects/${projectId.value}/approval-definitions`)
    flows.value = data || []
  } catch (err) {
    console.error('Failed to load approval flows:', err)
  }
}

onMounted(async () => {
  await Promise.all([loadAllUsers(), loadCategories(), loadApprovalFlows()])
})

const allUsers = computed(() => dbUsers.value)

// Global Toast setup
const { triggerNotification } = useGlobalToast()
const notify = (title: string, description: string, type: ToastNotificationType) => {
  triggerNotification({
    title,
    description,
    type
  })
}

// Search Query
const searchQuery = ref('')

// Filter flows matching search query
const searchedFlows = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return flows.value
  return flows.value.filter(
    (f) => f.name.toLowerCase().includes(query) || f.category.name.toLowerCase().includes(query)
  )
})

// Retrieve flows filtered by category
const getFilteredFlowsByCategory = (categoryId: string) => {
  return searchedFlows.value.filter((f) => f.category.id === categoryId)
}

// Active version lookup per category
const activeFlows = computed(() => {
  const res: Record<string, ApprovalFlow | undefined> = {}
  for (const cat of categories.value) {
    res[cat.id] = flows.value.find((f) => f.category.id === cat.id && f.isActive)
  }
  return res
})

// 仅展示有流程定义的分类
const activeCategories = computed(() => {
  return categories.value.filter((cat) =>
    flows.value.some((f) => f.category.id === cat.id)
  )
})

// Active details for delete
const selectedFlow = ref<ApprovalFlow | null>(null)

// Delete flow dialog state
const isDeleteConfirmOpen = ref(false)

const confirmDelete = (flow: ApprovalFlow) => {
  selectedFlow.value = flow
  isDeleteConfirmOpen.value = true
}

const deleteFlow = async () => {
  if (!selectedFlow.value) return
  const originalName = selectedFlow.value.name
  const version = selectedFlow.value.version
  try {
    await $fetch(`${apiOrigin}/api/projects/${projectId.value}/approval-definitions/${selectedFlow.value.id}`, {
      method: 'DELETE'
    })
    await loadApprovalFlows()
    notify('删除成功', `已成功删除审批流 “${originalName}” (V${version})`, ToastNotificationType.Success)
  } catch (err) {
    console.error(err)
    notify('删除失败', `无法删除审批流 “${originalName}”`, ToastNotificationType.Danger)
  }
  isDeleteConfirmOpen.value = false
  selectedFlow.value = null
}

// Toggle active status
const toggleFlowStatus = async (flow: ApprovalFlow) => {
  const nextIsActive = !flow.isActive
  try {
    await $fetch(`${apiOrigin}/api/projects/${projectId.value}/approval-definitions/${flow.id}/toggle-active`, {
      method: 'POST',
      body: { isActive: nextIsActive }
    })
    await loadApprovalFlows()
    const statusMessage = nextIsActive ? '已启用该版本' : '已停用该版本'
    notify(
      nextIsActive ? '启用成功' : '停用成功',
      `“${flow.name}” (V${flow.version}) ${statusMessage}`,
      nextIsActive ? ToastNotificationType.Success : ToastNotificationType.Info
    )
  } catch (err) {
    console.error(err)
    notify('操作失败', `无法更改审批流 “${flow.name}” 的状态`, ToastNotificationType.Danger)
  }
}

// Form state
const isFormModalOpen = ref(false)
const isEditMode = ref(false)
const isNewVersion = ref(false)

const formFlow = ref<{
  id: string
  templateId?: string
  name: string
  category: string
  isActive: boolean
  description: string
  steps: Array<{
    id: string
    role: string
    selectedApprovers: SelectedUser[]
    mode: 'OR' | 'AND'
  }>
}>({
  id: '',
  name: '',
  category: '',
  isActive: true,
  description: '',
  steps: []
})

// Check if selected category already has definitions in the project
const categoryHasDefinitions = computed(() => {
  const catId = formFlow.value.category
  return flows.value.some((f) => f.category.id === catId)
})

const openCreateModal = (categoryId?: string) => {
  isEditMode.value = false
  isNewVersion.value = !!categoryId
  formFlow.value = {
    id: `flow-${Date.now()}`,
    name: '',
    category: categoryId || categories.value[0]?.id || '',
    isActive: true,
    description: '',
    steps: [
      {
        id: `step-${Date.now()}-1`,
        role: '项目工程师',
        selectedApprovers: [],
        mode: 'OR'
      }
    ]
  }
  isFormModalOpen.value = true
}

const openEditModal = (flow: ApprovalFlow) => {
  isEditMode.value = true
  isNewVersion.value = false
  selectedFlow.value = flow
  formFlow.value = {
    id: flow.id,
    templateId: flow.templateId,
    name: flow.name,
    category: flow.category.id,
    isActive: flow.isActive,
    description: flow.description,
    steps: flow.steps.map((s: any) => ({
      id: s.id,
      role: s.role,
      selectedApprovers: s.selectedApprovers || s.approvers.map((name: string) => {
        const match = allUsers.value.find((u) => u.name === name)
        return match ? { ...match } : { id: `u-${name}`, name, avatar: null }
      }),
      mode: s.mode
    }))
  }
  isFormModalOpen.value = true
}

const addStep = () => {
  formFlow.value.steps.push({
    id: `step-${Date.now()}-${formFlow.value.steps.length + 1}`,
    role: '',
    selectedApprovers: [],
    mode: 'AND'
  })
}

const removeStep = (index: number) => {
  if (formFlow.value.steps.length > 1) {
    formFlow.value.steps.splice(index, 1)
  }
}

// Dialog buttons config
const formDialogButtons = computed((): LayoutDialogButton[] => {
  return [
    {
      text: '取消',
      props: { color: 'outline' },
      onClick: () => {
        isFormModalOpen.value = false
      }
    },
    {
      text: '保存',
      props: { color: 'primary' },
      onClick: saveFlowForm
    }
  ]
})

// Form submit & save
const saveFlowForm = async () => {
  const name = formFlow.value.name.trim()
  if (!name) {
    notify('验证错误', '请输入审批流名称', ToastNotificationType.Warning)
    return
  }

  for (let i = 0; i < formFlow.value.steps.length; i++) {
    const step = formFlow.value.steps[i]
    if (!step.role.trim()) {
      notify('验证错误', `请输入节点 ${i + 1} 的角色/节点名`, ToastNotificationType.Warning)
      return
    }
    if (step.selectedApprovers.length === 0) {
      notify('验证错误', `请选择节点 ${i + 1} 的审批人员`, ToastNotificationType.Warning)
      return
    }
  }

  const payload = {
    id: isEditMode.value ? formFlow.value.id : undefined,
    templateId: isEditMode.value ? formFlow.value.templateId : undefined,
    name,
    category: formFlow.value.category,
    isActive: formFlow.value.isActive,
    description: formFlow.value.description.trim(),
    steps: formFlow.value.steps
  }

  try {
    await $fetch(`${apiOrigin}/api/projects/${projectId.value}/approval-definitions`, {
      method: 'POST',
      body: payload
    })
    await loadApprovalFlows()
    notify(
      isEditMode.value ? '修改成功' : '创建成功',
      `已保存 “${name}” 的配置`,
      ToastNotificationType.Success
    )
    isFormModalOpen.value = false
    selectedFlow.value = null
  } catch (err) {
    console.error(err)
    notify('保存失败', `无法保存审批流 “${name}”`, ToastNotificationType.Danger)
  }
}
</script>

<style scoped>
.simple-scrollbar::-webkit-scrollbar {
  height: 6px;
  width: 6px;
}
.simple-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.simple-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
.simple-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
