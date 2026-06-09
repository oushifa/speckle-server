<template>
  <section class="max-w-6xl mx-auto pb-16 px-4">
    <!-- 头部设计：Premium 渐变光晕背景与毛玻璃融合 -->
    <div class="relative overflow-hidden mb-8 p-8 rounded-3xl border border-blue-500/20 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/5 backdrop-blur-xl shadow-xl shadow-blue-900/5">
      <div class="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl"></div>
      <div class="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl"></div>
      
      <div class="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-start gap-4">
          <div class="p-3.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl text-white shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
            <BuildingOffice2Icon class="h-6 w-6" />
          </div>
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              组织架构管理
            </h1>
            <p class="text-sm text-foreground-2 mt-1 max-w-xl">
              配置系统内部行政级别与部门层级树，支持按部门指派人员和职能职称，可直接用于后续业务流中。
            </p>
          </div>
        </div>
        <div class="flex items-center shrink-0">
          <FormButton
            color="primary"
            class="shadow-md shadow-blue-600/10 hover:shadow-lg hover:shadow-blue-600/20 transition-all duration-300"
            @click="openAddModal(null)"
          >
            <PlusIcon class="h-4 w-4 -ml-1 mr-1" />
            新建一级部门
          </FormButton>
        </div>
      </div>
    </div>

    <!-- 主体双栏布局 -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- 左栏：部门层级树 -->
      <div class="lg:col-span-5 bg-foundation p-6 rounded-3xl border border-outline-3 shadow-xl shadow-black/5 flex flex-col">
        <div class="flex items-center justify-between mb-5 border-b border-outline-3 pb-3">
          <h2 class="text-md font-bold text-foreground flex items-center gap-2">
            <QueueListIcon class="h-4 w-4 text-blue-600" />
            部门层级目录
          </h2>
          <span class="text-xs font-semibold px-2 py-0.5 bg-foreground-5 rounded-full text-foreground-2">
            共 {{ flatDepartmentsCount }} 个部门
          </span>
        </div>
        
        <!-- 载入中状态 -->
        <div v-if="loadingTree" class="py-20 flex flex-col items-center justify-center gap-3">
          <div class="h-9 w-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent shadow-sm"></div>
          <span class="text-sm text-foreground-2 font-medium">正在解析组织树...</span>
        </div>

        <!-- 空数据状态 -->
        <div v-else-if="!departmentsTree.length" class="py-16 text-center border border-dashed border-outline-3 rounded-2xl bg-foundation-page/50 flex flex-col items-center justify-center p-6">
          <FolderOpenIcon class="h-10 w-10 text-foreground-3 mb-2" />
          <p class="text-sm font-medium text-foreground-2">暂无部门数据</p>
          <p class="text-xs text-foreground-3 mt-1 mb-4">创建部门来开始构建您的团队体系</p>
          <FormButton size="sm" color="outline" @click="openAddModal(null)">
            立刻创建
          </FormButton>
        </div>

        <!-- 目录树列表：递归树状连线结构 -->
        <div v-else class="max-h-[72vh] overflow-y-auto pr-1">
          <DepartmentTreeNode
            v-for="(node, idx) in departmentsTree"
            :key="node.id"
            :node="node"
            :depth="0"
            :selected-id="selectedDepartmentId"
            :expanded-ids="expandedIds"
            :is-last="idx === departmentsTree.length - 1"
            @select="selectDepartment"
            @toggle="toggleExpand"
            @add="openAddModal"
            @edit="openEditModal"
            @delete="openDeleteModal"
          />
        </div>
      </div>

      <!-- 右栏：部门详情与成员 -->
      <div class="lg:col-span-7 bg-foundation p-6 rounded-3xl border border-outline-3 shadow-xl shadow-black/5 min-h-[500px] flex flex-col">
        <!-- 未选中空状态：设计精致、发光背景气泡 -->
        <div v-if="!selectedDepartment" class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-foundation-page/30 rounded-2xl border border-dashed border-outline-3">
          <div class="relative mb-4">
            <div class="absolute inset-0 rounded-full bg-blue-500/5 blur-xl animate-pulse"></div>
            <div class="relative p-5 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 text-blue-600 dark:text-blue-400 rounded-full border border-blue-500/10">
              <UsersIcon class="h-10 w-10" />
            </div>
          </div>
          <h3 class="text-md font-bold text-foreground">管理部门成员</h3>
          <p class="text-xs text-foreground-2 mt-1.5 max-w-sm leading-relaxed">
            请从左侧列表中选择一个部门，即可在此管理其所属团队人员、分配职称与移除关系。
          </p>
        </div>

        <!-- 已选中展示 -->
        <div v-else class="flex-1 flex flex-col">
          <div class="pb-5 border-b border-outline-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="p-1.5 bg-blue-500/10 text-blue-600 rounded-lg">
                  <TagIcon class="h-4 w-4" />
                </span>
                <h2 class="text-lg font-bold text-foreground tracking-tight">
                  {{ selectedDepartment.name }}
                </h2>
              </div>
              <p class="text-xs text-foreground-3 mt-1">
                部门 ID: <span class="font-mono bg-foundation-page/80 px-1.5 py-0.5 rounded border border-outline-3">{{ selectedDepartment.id }}</span>
              </p>
            </div>
            <div class="flex items-center">
              <FormButton
                size="sm"
                color="primary"
                class="shadow-sm shadow-blue-600/15"
                @click="openAddMemberModal"
              >
                <UserPlusIcon class="h-4 w-4 -ml-1 mr-1" />
                分配成员
              </FormButton>
            </div>
          </div>

          <!-- 成员载入中 -->
          <div v-if="loadingUsers" class="flex-1 flex flex-col items-center justify-center py-24 gap-3">
            <div class="h-9 w-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent shadow-sm"></div>
            <span class="text-sm text-foreground-2">正在载入部门成员...</span>
          </div>

          <!-- 无成员 -->
          <div v-else-if="!departmentUsers.length" class="flex-1 flex flex-col items-center justify-center py-20 bg-foundation-page/40 rounded-2xl border border-outline-3 border-dashed mt-6 text-center p-6">
            <UserIcon class="h-10 w-10 text-foreground-3 mb-2" />
            <p class="text-sm font-semibold text-foreground-2">当前暂无成员</p>
            <p class="text-xs text-foreground-3 mt-1 max-w-xs leading-relaxed">该行政部尚未关联人员，点击上方“分配成员”将已有用户编入该组。</p>
          </div>

          <!-- 成员列表：采用高级卡片列表卡片渲染替代普通生硬的表格 -->
          <div v-else class="mt-6 flex-1 space-y-3 overflow-y-auto max-h-[60vh] pr-1">
            <div
              v-for="user in departmentUsers"
              :key="user.id"
              class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-foundation hover:bg-foundation-page/40 border border-outline-3 rounded-2xl gap-4 transition-all duration-300 hover:shadow-md"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="ring-2 ring-blue-500/10 rounded-full p-0.5">
                  <UserAvatar :user="user" size="sm" class="h-9 w-9" />
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-bold text-foreground truncate">{{ user.name }}</div>
                  <div class="text-xs text-foreground-3 truncate font-mono mt-0.5">{{ user.email || '暂无邮箱' }}</div>
                </div>
              </div>
              
              <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <!-- 职位标牌 -->
                <span class="px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/10 shadow-sm">
                  {{ user.role || '普通职员' }}
                </span>
                
                <!-- 移除按钮 -->
                <FormButton
                  size="sm"
                  color="danger"
                  class="opacity-90 hover:opacity-100"
                  @click="removeMember(user)"
                >
                  移除
                </FormButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 对话框 1：新建 / 编辑部门 -->
    <LayoutDialog
      v-model:open="departmentModalOpen"
      max-width="sm"
      :buttons="departmentModalButtons"
    >
      <template #header>
        <span class="flex items-center gap-1.5">
          <FolderPlusIcon class="h-5 w-5 text-blue-600" />
          {{ isEditMode ? '重命名部门' : (departmentParentId ? '新建子部门' : '新建一级部门') }}
        </span>
      </template>
      <div class="space-y-4 py-3">
        <FormTextInput
          v-model="departmentForm.name"
          name="deptName"
          label="部门名称"
          placeholder="例如：技术研发中心、质检科..."
          color="foundation"
          show-label
          auto-focus
          @keydown.enter="submitDepartment"
        />
      </div>
    </LayoutDialog>

    <!-- 对话框 2：分配成员 -->
    <LayoutDialog
      v-model:open="memberModalOpen"
      max-width="md"
      :buttons="memberModalButtons"
    >
      <template #header>
        <span class="flex items-center gap-1.5">
          <UserPlusIcon class="h-5 w-5 text-blue-600" />
          分配成员
        </span>
      </template>
      <div class="space-y-5 py-3">
        <!-- 用户检索 -->
        <div class="relative">
          <FormTextInput
            v-model="memberForm.searchQuery"
            name="userSearch"
            label="搜索并选择用户"
            placeholder="输入姓名或邮箱开始模糊检索..."
            color="foundation"
            show-label
            @input="onSearchInput"
          />

          <!-- 检索下拉列表 -->
          <div
            v-if="searchResults.length"
            class="absolute z-30 w-full mt-2 bg-foundation border border-outline-3 rounded-2xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-outline-3 overflow-hidden backdrop-blur-md"
          >
            <div
              v-for="u in searchResults"
              :key="u.id"
              class="px-4 py-3 flex items-center justify-between hover:bg-blue-600/5 cursor-pointer text-sm transition-all duration-200"
              @click="selectSearchUser(u)"
            >
              <div class="flex items-center gap-3 min-w-0">
                <UserAvatar :user="u" size="sm" />
                <div class="min-w-0">
                  <div class="font-bold text-foreground truncate">{{ u.name }}</div>
                  <div class="text-xs text-foreground-3 truncate font-mono mt-0.5">{{ u.email }}</div>
                </div>
              </div>
              <PlusIcon class="h-4 w-4 text-blue-600 shrink-0" />
            </div>
          </div>
        </div>

        <!-- 已选中的用户卡片 -->
        <div
          v-if="memberForm.selectedUser"
          class="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between transition-all duration-300"
        >
          <div class="flex items-center gap-3">
            <UserAvatar :user="memberForm.selectedUser" size="sm" />
            <div>
              <div class="text-sm font-bold text-foreground">{{ memberForm.selectedUser.name }}</div>
              <div class="text-xs text-foreground-3 font-mono mt-0.5">{{ memberForm.selectedUser.email }}</div>
            </div>
          </div>
          <FormButton
            size="sm"
            color="outline"
            @click="memberForm.selectedUser = null"
          >
            重选
          </FormButton>
        </div>

        <!-- 职位指派 -->
        <FormTextInput
          v-model="memberForm.title"
          name="memberTitle"
          label="指派职位 / 职称"
          placeholder="例如：部门经理、技术总监、高级开发工程师"
          color="foundation"
          show-label
          @keydown.enter="submitMember"
        />
      </div>
    </LayoutDialog>

    <!-- 弹窗 3：二次确认删除 -->
    <ConfirmDialog
      v-model:open="deleteConfirmOpen"
      title="确认删除部门吗？"
      :text="`删除部门 '${departmentToDelete?.name || ''}' 将会自动级联删除其下属的所有子级部门，并且该部门及其子部门内的所有成员关联关系也将同步被清除。该操作不可撤销！`"
      confirm-text="确认删除"
      @confirm="submitDelete"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRuntimeConfig, useHead } from '#imports'
import DepartmentTreeNode from '~/components/settings/server/DepartmentTreeNode.vue'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
  FolderIcon,
  FolderOpenIcon,
  UsersIcon,
  UserIcon,
  FolderPlusIcon,
  TagIcon,
  BuildingOffice2Icon,
  QueueListIcon,
  MagnifyingGlassIcon
} from '@heroicons/vue/24/outline'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { FormButton, FormTextInput } from '@speckle/ui-components'
import {
  getDepartmentsTree,
  getDepartmentUsers,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  addDepartmentMembers,
  removeDepartmentMember,
  searchSystemUsers,
  type Department,
  type DepartmentUser,
  type UserSearchResult
} from '~/lib/organizations/api'

// 绑定 settings layout 侧边栏
definePageMeta({
  layout: 'settings'
})

// 获取服务端接口源地址
const { public: { apiOrigin } } = useRuntimeConfig()

// 设置页面 Title
useHead({
  title: '组织架构管理 | 系统设置'
})

// 基础数据声明
const departmentsTree = ref<Department[]>([])
const departmentUsers = ref<DepartmentUser[]>([])
const selectedDepartmentId = ref<string | null>(null)

// 各种加载状态
const loadingTree = ref(false)
const loadingUsers = ref(false)

// 展开的部门节点集合
const expandedIds = ref<Set<string>>(new Set())

// 移除旧的扁平化处理，采用组件递归渲染。

const flatDepartmentsCount = computed(() => {
  let count = 0
  const walk = (nodes: Department[]) => {
    count += nodes.length
    nodes.forEach((node) => {
      if (node.children?.length) walk(node.children)
    })
  }
  walk(departmentsTree.value)
  return count
})

const selectedDepartment = computed<Department | null>(() => {
  if (!selectedDepartmentId.value) return null
  
  // 深度查找
  let found: Department | null = null
  const walk = (nodes: Department[]) => {
    for (const node of nodes) {
      if (node.id === selectedDepartmentId.value) {
        found = node
        break
      }
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }
  walk(departmentsTree.value)
  return found
})

// --- 接口方法调用 ---
const loadTree = async () => {
  loadingTree.value = true
  try {
    departmentsTree.value = await getDepartmentsTree({ apiOrigin })
  } catch (err: any) {
    alert(err.message || '获取部门树失败')
  } finally {
    loadingTree.value = false
  }
}

const loadUsers = async (depId: string) => {
  loadingUsers.value = true
  try {
    departmentUsers.value = await getDepartmentUsers({ departmentId: depId, apiOrigin })
  } catch (err: any) {
    alert(err.message || '加载成员失败')
  } finally {
    loadingUsers.value = false
  }
}

// 展开/折叠节点
const toggleExpand = (id: string) => {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
}

const isExpanded = (id: string) => expandedIds.value.has(id)

// 选中某个部门
const selectDepartment = (id: string) => {
  selectedDepartmentId.value = id
  loadUsers(id)
}

// --- 对话框 1：新建 / 编辑部门的表单及提交逻辑 ---
const departmentModalOpen = ref(false)
const isEditMode = ref(false)
const departmentParentId = ref<string | null>(null)
const editingDepartment = ref<Department | null>(null)
const departmentForm = ref({ name: '' })

const openAddModal = (parentId: string | null = null) => {
  isEditMode.value = false
  departmentParentId.value = parentId
  departmentForm.value.name = ''
  departmentModalOpen.value = true
}

const openEditModal = (node: Department) => {
  isEditMode.value = true
  editingDepartment.value = {
    id: node.id,
    name: node.name,
    parentId: node.parentId,
    path: '',
    children: [],
    createdAt: '',
    updatedAt: ''
  }
  departmentForm.value.name = node.name
  departmentModalOpen.value = true
}

const submitDepartment = async () => {
  const name = departmentForm.value.name.trim()
  if (!name) return

  try {
    if (isEditMode.value && editingDepartment.value) {
      await updateDepartment({
        departmentId: editingDepartment.value.id,
        name,
        apiOrigin
      })
    } else {
      const dep = await createDepartment({
        name,
        parentId: departmentParentId.value,
        apiOrigin
      })
      // 展开新增的父级部门以展示子部门
      if (departmentParentId.value) {
        expandedIds.value.add(departmentParentId.value)
      }
      // 默认选中新部门
      selectedDepartmentId.value = dep.id
    }
    await loadTree()
    if (selectedDepartmentId.value) {
      await loadUsers(selectedDepartmentId.value)
    }
    departmentModalOpen.value = false
  } catch (err: any) {
    alert(err.message || '部门保存失败')
  }
}

const departmentModalButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      departmentModalOpen.value = false
    }
  },
  {
    text: '确定',
    props: { color: 'primary' },
    onClick: submitDepartment
  }
])

// --- 对话框 3：删除确认及删除逻辑 ---
const deleteConfirmOpen = ref(false)
const departmentToDelete = ref<Department | null>(null)

const openDeleteModal = (node: Department) => {
  departmentToDelete.value = node
  deleteConfirmOpen.value = true
}

const submitDelete = async () => {
  if (!departmentToDelete.value) return
  try {
    await deleteDepartment({ departmentId: departmentToDelete.value.id, apiOrigin })
    if (selectedDepartmentId.value === departmentToDelete.value.id) {
      selectedDepartmentId.value = null
      departmentUsers.value = []
    }
    await loadTree()
    deleteConfirmOpen.value = false
  } catch (err: any) {
    alert(err.message || '删除部门失败')
  }
}

// --- 对话框 2：分配成员表单及用户搜索逻辑 ---
const memberModalOpen = ref(false)
const memberForm = ref<{
  searchQuery: string
  selectedUser: UserSearchResult | null
  title: string
}>({
  searchQuery: '',
  selectedUser: null,
  title: ''
})
const searchResults = ref<UserSearchResult[]>([])
let searchTimeout: NodeJS.Timeout | null = null

const openAddMemberModal = () => {
  memberForm.value = {
    searchQuery: '',
    selectedUser: null,
    title: ''
  }
  searchResults.value = []
  memberModalOpen.value = true
}

// 检索用户输入防抖处理
const onSearchInput = () => {
  if (searchTimeout) clearTimeout(searchTimeout)

  const query = memberForm.value.searchQuery.trim()
  if (!query) {
    searchResults.value = []
    return
  }

  searchTimeout = setTimeout(async () => {
    try {
      searchResults.value = await searchSystemUsers({ query, apiOrigin })
    } catch (err: any) {
      console.error('检索用户错误:', err)
    }
  }, 300)
}

const selectSearchUser = (user: UserSearchResult) => {
  memberForm.value.selectedUser = user
  memberForm.value.searchQuery = ''
  searchResults.value = []
}

const submitMember = async () => {
  if (!selectedDepartmentId.value || !memberForm.value.selectedUser) return
  try {
    await addDepartmentMembers({
      departmentId: selectedDepartmentId.value,
      userIds: [memberForm.value.selectedUser.id],
      title: memberForm.value.title.trim() || undefined,
      apiOrigin
    })
    await loadUsers(selectedDepartmentId.value)
    memberModalOpen.value = false
  } catch (err: any) {
    alert(err.message || '分配成员失败')
  }
}

const memberModalButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      memberModalOpen.value = false
    }
  },
  {
    text: '分配',
    props: { color: 'primary' },
    onClick: submitMember
  }
])

// --- 从部门中移除成员 ---
const removeMember = async (user: DepartmentUser) => {
  if (!selectedDepartmentId.value) return
  const confirmed = confirm(`确定要把成员 '${user.name}' 从当前部门移除吗？`)
  if (!confirmed) return

  try {
    await removeDepartmentMember({
      departmentId: selectedDepartmentId.value,
      userId: user.id,
      apiOrigin
    })
    await loadUsers(selectedDepartmentId.value)
  } catch (err: any) {
    alert(err.message || '移除成员失败')
  }
}

onMounted(() => {
  loadTree()
})
</script>

<style scoped>
/* 自定义现代平滑滚动条，增加极致体验感 */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.25);
  border-radius: 99px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.45);
}
</style>
