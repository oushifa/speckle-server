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
          @click="openCreateModal"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          新建审批流
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="filteredFlows.length === 0"
      class="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-2xl border border-slate-100 p-8 text-center"
    >
      <div class="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center mb-3">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-sm font-medium text-slate-600">未找到匹配的审批流程</p>
      <button class="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium" @click="searchQuery = ''">清除搜索条件</button>
    </div>

    <!-- Approval Flows List -->
    <div v-else class="space-y-6">
      <div
        v-for="flow in filteredFlows"
        :key="flow.id"
        class="border border-slate-150 bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200 relative overflow-hidden"
      >
        <!-- Top row: Title, badges, actions -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div class="flex flex-wrap items-center gap-2.5">
            <h2 class="text-base font-bold text-slate-800">{{ flow.name }}</h2>
            <span
              :class="[
                'px-2 py-0.5 text-xs font-semibold rounded-md transition-colors duration-150',
                flow.isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              ]"
            >
              {{ flow.isActive ? '启用' : '已停用' }}
            </span>
            <span class="px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              {{ flow.category }}
            </span>
          </div>

          <!-- Action buttons -->
          <div class="flex items-center gap-2 self-end sm:self-auto">
            <button
              class="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg transition-colors duration-150"
              @click="toggleFlowStatus(flow)"
            >
              {{ flow.isActive ? '停用' : '启用' }}
            </button>
            <button
              class="p-1.5 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-500 rounded-lg transition-colors duration-150"
              title="编辑"
              @click="openEditModal(flow)"
            >
              <IconEdit class="w-4 h-4" />
            </button>
            <button
              class="p-1.5 border border-slate-200 hover:bg-red-50 hover:border-red-100 text-red-500 rounded-lg transition-colors duration-150"
              title="删除"
              @click="confirmDelete(flow)"
            >
              <IconDelete class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Description -->
        <div class="mt-4 text-xs text-slate-500 leading-relaxed">
          {{ flow.description || '暂无描述' }}
        </div>

        <!-- Visual Flow Diagram -->
        <div class="my-6 py-4 px-5 bg-slate-50/50 border border-slate-100 rounded-xl overflow-x-auto simple-scrollbar">
          <div class="flex items-center gap-4 min-w-max py-2">
            <!-- Start Node -->
            <div class="flex flex-col items-center gap-2">
              <div class="w-10 h-10 rounded-full border-2 border-emerald-500 bg-white flex items-center justify-center shadow-sm">
                <div class="w-4 h-4 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>
              <span class="text-xs font-medium text-slate-600">开始</span>
            </div>

            <!-- Steps -->
            <template v-for="step in flow.steps" :key="step.id">
              <!-- Arrow -->
              <div class="text-slate-300">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </div>

              <!-- Step Card -->
              <div class="flex flex-col items-center gap-2">
                <div class="border border-blue-100 bg-white rounded-xl shadow-sm px-4 py-2.5 flex flex-col items-center min-w-[130px] relative">
                  <!-- User Avatar/Group Badge -->
                  <div class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5">
                    <svg class="w-4.5 h-4.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                  </div>
                  <span class="text-xs font-bold text-slate-800">{{ step.role }}</span>
                  <span class="text-[10px] text-slate-400 mt-0.5 max-w-[120px] truncate" :title="step.approvers.join('，')">
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
              <div class="w-10 h-10 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center shadow-sm">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span class="text-xs font-medium text-slate-600">结束</span>
            </div>
          </div>
        </div>

        <!-- Footer timestamps -->
        <div class="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[11px] text-slate-400 border-t border-slate-50 pt-3">
          <span>创建时间: {{ flow.createdAt }}</span>
          <span>最后修改: {{ flow.updatedAt }}</span>
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
        流程删除后将无法恢复，关联的审批任务将受到影响。确认要删除 <span class="font-bold text-slate-700">“{{ selectedFlow?.name }}”</span> 吗？
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
        <!-- Flow Name -->
        <div>
          <label for="flow-name" class="block text-xs font-bold text-slate-700 mb-1.5">审批流名称 *</label>
          <input
            id="flow-name"
            v-model="formFlow.name"
            type="text"
            placeholder="请输入审批流名称，如：质量验收审批流"
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
            >
              <option value="质量验收">质量验收</option>
              <option value="验工计价">验工计价</option>
              <option value="模型管理">模型管理</option>
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

const loadAllUsers = async () => {
  try {
    const data = await $fetch<Array<{ id: string; name: string; avatar: string | null }>>(`${apiOrigin}/api/users`)
    dbUsers.value = data || []
  } catch (err) {
    console.error('Failed to load users from REST API:', err)
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
  await Promise.all([loadAllUsers(), loadApprovalFlows()])
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

// User selection type
type SelectedUser = {
  id: string
  name: string
  avatar: string | null
}

// Flow interfaces
interface Step {
  id: string
  role: string
  approvers: string[]
  selectedApprovers?: SelectedUser[]
  mode: 'OR' | 'AND'
}

interface ApprovalFlow {
  id: string
  templateId: string
  name: string
  category: '质量验收' | '验工计价' | '模型管理'
  isActive: boolean
  description: string
  steps: Step[]
  createdAt: string
  updatedAt: string
}

// Search query
const searchQuery = ref('')

// Filtered list
const filteredFlows = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return flows.value
  return flows.value.filter(
    (f) => f.name.toLowerCase().includes(query) || f.category.toLowerCase().includes(query)
  )
})

// Active details
const selectedFlow = ref<ApprovalFlow | null>(null)

// Delete flow state
const isDeleteConfirmOpen = ref(false)

const confirmDelete = (flow: ApprovalFlow) => {
  selectedFlow.value = flow
  isDeleteConfirmOpen.value = true
}

const deleteFlow = async () => {
  if (!selectedFlow.value) return
  const originalName = selectedFlow.value.name
  try {
    await $fetch(`${apiOrigin}/api/projects/${projectId.value}/approval-definitions/${selectedFlow.value.id}`, {
      method: 'DELETE'
    })
    await loadApprovalFlows()
    notify('删除成功', `已成功删除审批流 “${originalName}”`, ToastNotificationType.Success)
  } catch (err) {
    console.error(err)
    notify('删除失败', `无法删除审批流 “${originalName}”`, ToastNotificationType.Danger)
  }
  isDeleteConfirmOpen.value = false
  selectedFlow.value = null
}

// Toggle enabled/disabled status
const toggleFlowStatus = async (flow: ApprovalFlow) => {
  const nextIsActive = !flow.isActive
  try {
    await $fetch(`${apiOrigin}/api/projects/${projectId.value}/approval-definitions/${flow.id}/toggle-active`, {
      method: 'POST',
      body: { isActive: nextIsActive }
    })
    await loadApprovalFlows()
    const statusMessage = nextIsActive ? '已成功启用' : '已成功停用'
    notify(
      nextIsActive ? '开启成功' : '停用成功',
      `“${flow.name}” ${statusMessage}`,
      nextIsActive ? ToastNotificationType.Success : ToastNotificationType.Info
    )
  } catch (err) {
    console.error(err)
    notify('操作失败', `无法更改审批流 “${flow.name}” 状态`, ToastNotificationType.Danger)
  }
}

// Create/Edit form state
const isFormModalOpen = ref(false)
const isEditMode = ref(false)

const formFlow = ref<{
  id: string
  name: string
  category: '质量验收' | '验工计价' | '模型管理'
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
  category: '质量验收',
  isActive: true,
  description: '',
  steps: []
})

const openCreateModal = () => {
  isEditMode.value = false
  formFlow.value = {
    id: `flow-${Date.now()}`,
    name: '',
    category: '质量验收',
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
  selectedFlow.value = flow
  formFlow.value = {
    id: flow.id,
    name: flow.name,
    category: flow.category,
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

// Step actions in form
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

// Dialog button layout for Form
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

// Form save validation & submit
const saveFlowForm = async () => {
  // Validate flow details
  const name = formFlow.value.name.trim()
  if (!name) {
    notify('验证错误', '请输入审批流名称', ToastNotificationType.Warning)
    return
  }

  // Validate step details
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

  // Map step inputs
  const payload = {
    id: isEditMode.value ? formFlow.value.id : undefined,
    templateId: isEditMode.value && selectedFlow.value ? selectedFlow.value.templateId : undefined,
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
/* Scrolled custom styling */
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
