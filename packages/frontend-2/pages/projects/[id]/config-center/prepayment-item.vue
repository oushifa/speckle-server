<template>
  <div>
    <Portal to="current-page">
      <NuxtLink :to="`/projects/${projectId}/config-center/prepayment-item`">配置中心</NuxtLink>
      <span> / 预付 (留) 款条目</span>
    </Portal>

    <div class="flex flex-col gap-4 h-full mt-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 class="text-heading-lg text-foreground">预付(留)款条目列表</h1>
        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div class="flex gap-2 w-full sm:w-auto">
            <FormTextInput
              v-model="searchQuery"
              name="prepayment-item-search"
              placeholder="输入名称"
              :show-label="false"
              class="w-full sm:w-64"
            />
            <FormButton
              :icon-left="MagnifyingGlassIcon"
              color="primary"
              @click="handleSearch"
            >
              搜索
            </FormButton>
            <FormButton
              color="outline"
              @click="handleReset"
            >
              重置
            </FormButton>
          </div>
          <FormButton
            color="primary"
            :icon-left="PlusIcon"
            class="font-normal"
            @click="onAdd"
          >
            新增
          </FormButton>
        </div>
      </div>

      <div class="bg-foundation rounded-lg border border-outline-3 flex flex-col flex-grow overflow-hidden">
        <LayoutTable
          :columns="columns"
          :items="items"
          empty-message="暂无预付(留)款条目"
          class="flex-grow"
        >
          <template #index="{ item }">
            <span class="text-sm text-foreground-2">{{ getDisplayIndex(item) }}</span>
          </template>
          <template #name="{ item }">
            <span class="text-sm font-medium text-foreground">{{ item.name }}</span>
          </template>
          <template #type="{ item }">
            <span class="text-sm text-foreground">{{ item.type }}</span>
          </template>
          <template #percentage="{ item }">
            <span class="text-sm text-foreground">
              {{ item.percentage !== null && item.percentage !== undefined ? item.percentage : '' }}
            </span>
          </template>
          <template #category="{ item }">
            <span class="text-sm text-foreground">{{ item.category }}</span>
          </template>
          <template #actions="{ item }">
            <div class="flex items-center justify-end gap-1.5 text-sm">
              <button
                class="rounded p-1 text-primary hover:text-primary-focus transition-colors"
                title="编辑"
                @click="onEdit(item)"
              >
                <PencilSquareIcon class="h-4 w-4" />
              </button>
              <button
                class="rounded p-1 text-danger hover:text-danger-darker transition-colors"
                title="删除"
                @click="onDelete(item)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </template>
        </LayoutTable>

        <!-- 分页组件 -->
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-outline-3 p-4 text-[13px] leading-5 text-foreground-2">
          <div class="flex items-center gap-2">
            <span>每页显示</span>
            <label for="prepayment-page-size" class="sr-only">每页显示条数</label>
            <select
              id="prepayment-page-size"
              v-model="pageSize"
              class="rounded border border-outline-3 bg-foundation px-2 py-1 text-[13px] leading-5 focus:border-primary focus:outline-none"
              @change="handlePageSizeChange"
            >
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
            <span>条</span>
            <span class="ml-2">
              共 {{ totalCount }} 条，第 {{ startItemIndex }}-{{ endItemIndex }} 条
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button
              class="rounded px-2 py-1 text-[13px] leading-5 hover:bg-highlight-1 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="currentPage === 1"
              @click="goPrevPage"
            >
              &lt; 上一页
            </button>
            <span class="px-2">第 {{ currentPage }} / {{ totalPages || 1 }} 页</span>
            <button
              class="rounded px-2 py-1 text-[13px] leading-5 hover:bg-highlight-1 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="currentPage >= totalPages"
              @click="goNextPage"
            >
              下一页 &gt;
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <LayoutDialog
      v-model:open="dialogOpen"
      max-width="sm"
      :buttons="dialogButtons"
      prevent-close-on-click-outside
    >
      <template #header>
        {{ isEditMode ? '编辑预付(留)款条目' : '新增预付(留)款条目' }}
      </template>
      <div class="flex flex-col gap-4 mt-2">
        <FormTextInput
          v-model="form.name"
          label="名称"
          name="name"
          placeholder="请输入名称"
          show-label
          color="foundation"
        />
        
        <FormSelectBase
          v-model="selectedTypeOption"
          label="类型"
          name="type"
          placeholder="选择类型"
          show-label
          by="value"
          :items="typeOptions"
          :allow-unset="false"
          mount-menu-on-body
        >
          <template #something-selected="{ value }">
            {{ Array.isArray(value) ? value[0]?.label : value?.label }}
          </template>
          <template #option="{ item }">
            {{ item.label }}
          </template>
        </FormSelectBase>

        <FormTextInput
          v-model="percentageInput"
          label="比例%"
          name="percentage"
          placeholder="请输入比例"
          show-label
          type="number"
          color="foundation"
        />

        <FormSelectBase
          v-model="selectedCategoryOption"
          label="类别"
          name="category"
          placeholder="选择类别"
          show-label
          by="value"
          :items="categoryOptions"
          :allow-unset="false"
          mount-menu-on-body
        >
          <template #something-selected="{ value }">
            {{ Array.isArray(value) ? value[0]?.label : value?.label }}
          </template>
          <template #option="{ item }">
            {{ item.label }}
          </template>
        </FormSelectBase>
      </div>
    </LayoutDialog>

    <CommonConfirmDialog
      v-model:open="deleteDialogOpen"
      title="确认删除"
      :text="deleteDialogText"
      @confirm="executeDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Portal } from 'portal-vue'

definePageMeta({
  middleware: ['admin']
})
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'

const getDisplayIndex = (item: any) => item.displayIndex
import {
  LayoutDialog,
  LayoutTable,
  FormTextInput,
  FormButton,
  FormSelectBase,
  type LayoutDialogButton
} from '@speckle/ui-components'
import { useGlobalToast, ToastNotificationType } from '~/lib/common/composables/toast'

type PrepaymentItem = {
  id: string
  projectId: string
  name: string
  type: string
  percentage: number | null
  category: string
  createdAt: string
  updatedAt: string
  displayIndex?: number
}

const route = useRoute()
const { apiOrigin } = useRuntimeConfig().public
const { triggerNotification } = useGlobalToast()

const projectId = computed(() => route.params.id as string)

// 列表查询相关
const items = ref<PrepaymentItem[]>([])
const searchQuery = ref('')
const currentSearch = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const totalCount = ref(0)
const loading = ref(false)

const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))
const startItemIndex = computed(() => {
  if (totalCount.value === 0) return 0
  return (currentPage.value - 1) * pageSize.value + 1
})
const endItemIndex = computed(() => {
  return Math.min(currentPage.value * pageSize.value, totalCount.value)
})

const columns = [
  { id: 'index', header: '序号', classes: 'col-span-1' },
  { id: 'name', header: '名称', classes: 'col-span-3' },
  { id: 'type', header: '类型', classes: 'col-span-2' },
  { id: 'percentage', header: '比例%', classes: 'col-span-2' },
  { id: 'category', header: '类别', classes: 'col-span-3' },
  { id: 'actions', header: '操作', classes: 'col-span-1 text-right' }
]

// 选项配置
const typeOptions = [
  { value: '预付数', label: '预付数' },
  { value: '预留数', label: '预留数' }
]
const categoryOptions = [
  { value: '税费调整', label: '税费调整' },
  { value: '税费调整后合计', label: '税费调整后合计' },
  { value: '中期支付预留', label: '中期支付预留' },
  { value: '中期支付预留返还', label: '中期支付预留返还' },
  { value: '预付款', label: '预付款' },
  { value: '预付款扣回', label: '预付款扣回' }
]

// 表单弹框相关
const dialogOpen = ref(false)
const isEditMode = ref(false)
const editingId = ref('')
const form = ref({
  name: '',
  type: '预付数',
  category: '税费调整'
})
const percentageInput = ref<string>('')

const selectedTypeOption = computed({
  get: () => typeOptions.find(o => o.value === form.value.type) || typeOptions[0],
  set: (val) => {
    if (val) form.value.type = val.value
  }
})

const selectedCategoryOption = computed({
  get: () => categoryOptions.find(o => o.value === form.value.category) || categoryOptions[0],
  set: (val) => {
    if (val) form.value.category = val.value
  }
})

// 数据加载与请求
const fetchItems = async () => {
  loading.value = true
  try {
    const url = new URL(`/api/v1/projects/${projectId.value}/prepayment-items`, apiOrigin)
    url.searchParams.set('page', String(currentPage.value))
    url.searchParams.set('limit', String(pageSize.value))
    if (currentSearch.value) {
      url.searchParams.set('search', currentSearch.value)
    }

    const res = await $fetch<{ data: PrepaymentItem[]; meta: { total: number } }>(url.toString(), {
      method: 'GET'
    })
    const baseIndex = (currentPage.value - 1) * pageSize.value
    items.value = (res.data || []).map((item, idx) => ({
      ...item,
      displayIndex: baseIndex + idx + 1
    }))
    totalCount.value = res.meta?.total || 0
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载列表失败',
      description: err.message || '网络请求错误'
    })
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentSearch.value = searchQuery.value
  currentPage.value = 1
  fetchItems()
}

const handleReset = () => {
  searchQuery.value = ''
  currentSearch.value = ''
  currentPage.value = 1
  fetchItems()
}

const handlePageSizeChange = () => {
  currentPage.value = 1
  fetchItems()
}

const goPrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    fetchItems()
  }
}

const goNextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    fetchItems()
  }
}

// 增删改交互
const onAdd = () => {
  isEditMode.value = false
  editingId.value = ''
  form.value = {
    name: '',
    type: '预付数',
    category: '税费调整'
  }
  percentageInput.value = ''
  dialogOpen.value = true
}

const onEdit = (item: PrepaymentItem) => {
  isEditMode.value = true
  editingId.value = item.id
  form.value = {
    name: item.name,
    type: item.type,
    category: item.category
  }
  percentageInput.value = item.percentage !== null && item.percentage !== undefined ? String(item.percentage) : ''
  dialogOpen.value = true
}

const deleteDialogOpen = ref(false)
const deleteDialogText = ref('')
const itemToDelete = ref<PrepaymentItem | null>(null)

const onDelete = (item: PrepaymentItem) => {
  itemToDelete.value = item
  deleteDialogText.value = `确定要删除“${item.name}”吗？`
  deleteDialogOpen.value = true
}

const executeDelete = async () => {
  if (!itemToDelete.value) return
  const item = itemToDelete.value

  try {
    await $fetch(`/api/v1/projects/${projectId.value}/prepayment-items/${item.id}`, {
      method: 'DELETE',
      baseURL: apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '删除成功',
      description: '条目已被删除'
    })
    // 重新获取列表
    if (items.value.length === 1 && currentPage.value > 1) {
      currentPage.value--
    }
    fetchItems()
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '删除失败',
      description: err.message || '请重试'
    })
  } finally {
    itemToDelete.value = null
  }
}

const onSubmit = async () => {
  if (!form.value.name.trim()) {
    triggerNotification({
      type: ToastNotificationType.Warning,
      title: '表单校验错误',
      description: '名称不能为空'
    })
    return
  }

  let percentage: number | null = null
  const rawVal = percentageInput.value
  if (rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '') {
    const val = Number(rawVal)
    if (isNaN(val)) {
      triggerNotification({
        type: ToastNotificationType.Warning,
        title: '表单校验错误',
        description: '比例必须为有效数字'
      })
      return
    }
    percentage = val
  }

  const payload = {
    name: form.value.name,
    type: form.value.type,
    percentage,
    category: form.value.category
  }

  try {
    if (isEditMode.value) {
      await $fetch(`/api/v1/projects/${projectId.value}/prepayment-items/${editingId.value}`, {
        method: 'PUT',
        body: payload,
        baseURL: apiOrigin
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '更新成功',
        description: '条目信息已更新'
      })
    } else {
      await $fetch(`/api/v1/projects/${projectId.value}/prepayment-items`, {
        method: 'POST',
        body: payload,
        baseURL: apiOrigin
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '新增成功',
        description: '条目已创建'
      })
    }
    dialogOpen.value = false
    fetchItems()
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '操作失败',
      description: err.message || '请检查输入'
    })
  }
}

const dialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      dialogOpen.value = false
    }
  },
  {
    text: isEditMode.value ? '保存' : '新增',
    props: { color: 'primary' },
    onClick: onSubmit
  }
])

onMounted(() => {
  fetchItems()
})
</script>
