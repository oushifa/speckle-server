<template>
  <div>
    <Portal to="current-page">
      <NuxtLink :to="`/projects/${projectId}/config-center/main-material`">配置中心</NuxtLink>
      <span> / 主材库</span>
    </Portal>

    <div class="flex flex-col gap-4 h-full mt-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 class="text-heading-lg text-foreground">主材库列表</h1>
        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div class="flex gap-2 w-full sm:w-auto">
            <FormTextInput
              v-model="searchQuery"
              name="main-material-search"
              placeholder="输入名称/规格/类别"
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
          empty-message="暂无主材条目"
          class="flex-grow"
        >
          <template #index="{ item }">
            <span class="text-sm text-foreground-2">{{ getDisplayIndex(item) }}</span>
          </template>
          <template #name="{ item }">
            <span class="text-sm font-medium text-foreground">{{ item.name }}</span>
          </template>
          <template #specification="{ item }">
            <span class="text-sm text-foreground">{{ item.specification }}</span>
          </template>
          <template #unit="{ item }">
            <span class="text-sm text-foreground">{{ item.unit }}</span>
          </template>
          <template #referencePrice="{ item }">
            <span class="text-sm text-foreground">
              {{ item.referencePrice !== null && item.referencePrice !== undefined ? formatPrice(item.referencePrice) : '' }}
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
            <label for="material-page-size" class="sr-only">每页显示条数</label>
            <select
              id="material-page-size"
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
        {{ isEditMode ? '编辑主材条目' : '新增主材条目' }}
      </template>
      <div class="flex flex-col gap-4 mt-2">
        <FormTextInput
          v-model="form.name"
          label="材料名称"
          name="name"
          placeholder="请输入材料名称"
          show-label
          color="foundation"
        />

        <FormTextInput
          v-model="form.specification"
          label="规格型号"
          name="specification"
          placeholder="请输入规格型号"
          show-label
          color="foundation"
        />

        <FormTextInput
          v-model="form.unit"
          label="单位"
          name="unit"
          placeholder="请输入单位"
          show-label
          color="foundation"
        />

        <FormTextInput
          v-model="referencePriceInput"
          label="参考单价"
          name="referencePrice"
          placeholder="请输入参考单价"
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

type MainMaterial = {
  id: string
  projectId: string
  name: string
  specification: string
  unit: string
  referencePrice: number
  category: string
  createdAt: string
  updatedAt: string
  displayIndex?: number
}

const route = useRoute()
const { apiOrigin } = useRuntimeConfig().public
const { triggerNotification } = useGlobalToast()

const projectId = computed(() => route.params.id as string)

// 列表查询
const items = ref<MainMaterial[]>([])
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
  { id: 'name', header: '材料名称', classes: 'col-span-3 font-medium' },
  { id: 'specification', header: '规格型号', classes: 'col-span-2' },
  { id: 'unit', header: '单位', classes: 'col-span-1' },
  { id: 'referencePrice', header: '参考单价', classes: 'col-span-2' },
  { id: 'category', header: '类别', classes: 'col-span-2' },
  { id: 'actions', header: '操作', classes: 'col-span-1 text-right' }
]

const categoryOptions = [
  { value: '钢材', label: '钢材' },
  { value: '混凝土', label: '混凝土' },
  { value: '管材', label: '管材' },
  { value: '骨料', label: '骨料' }
]

// 弹框表单
const dialogOpen = ref(false)
const isEditMode = ref(false)
const editingId = ref('')
const form = ref({
  name: '',
  specification: '',
  unit: '',
  category: '钢材'
})
const referencePriceInput = ref<string>('')

const selectedCategoryOption = computed({
  get: () => categoryOptions.find(o => o.value === form.value.category) || categoryOptions[0],
  set: (val) => {
    if (val) form.value.category = val.value
  }
})

// 加载列表
const fetchItems = async () => {
  loading.value = true
  try {
    const url = new URL(`/api/v1/projects/${projectId.value}/main-materials`, apiOrigin)
    url.searchParams.set('page', String(currentPage.value))
    url.searchParams.set('limit', String(pageSize.value))
    if (currentSearch.value) {
      url.searchParams.set('search', currentSearch.value)
    }

    const res = await $fetch<{ data: MainMaterial[]; meta: { total: number } }>(url.toString(), {
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
      title: '加载主材库失败',
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

// 金额千分位格式化
const formatPrice = (price: number) => {
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(price)
}

// 表单增删改
const onAdd = () => {
  isEditMode.value = false
  editingId.value = ''
  form.value = {
    name: '',
    specification: '',
    unit: '',
    category: '钢材'
  }
  referencePriceInput.value = ''
  dialogOpen.value = true
}

const onEdit = (item: MainMaterial) => {
  isEditMode.value = true
  editingId.value = item.id
  form.value = {
    name: item.name,
    specification: item.specification,
    unit: item.unit,
    category: item.category
  }
  referencePriceInput.value = item.referencePrice !== null && item.referencePrice !== undefined ? String(item.referencePrice) : ''
  dialogOpen.value = true
}

const deleteDialogOpen = ref(false)
const deleteDialogText = ref('')
const itemToDelete = ref<MainMaterial | null>(null)

const onDelete = (item: MainMaterial) => {
  itemToDelete.value = item
  deleteDialogText.value = `确定要删除材料“${item.name}”吗？`
  deleteDialogOpen.value = true
}

const executeDelete = async () => {
  if (!itemToDelete.value) return
  const item = itemToDelete.value

  try {
    await $fetch(`/api/v1/projects/${projectId.value}/main-materials/${item.id}`, {
      method: 'DELETE',
      baseURL: apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '删除成功',
      description: '材料条目已成功删除'
    })
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
  if (!form.value.name.trim() || !form.value.specification.trim() || !form.value.unit.trim()) {
    triggerNotification({
      type: ToastNotificationType.Warning,
      title: '表单校验错误',
      description: '材料名称、规格型号、单位均不能为空'
    })
    return
  }

  const rawVal = referencePriceInput.value
  if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
    triggerNotification({
      type: ToastNotificationType.Warning,
      title: '表单校验错误',
      description: '参考单价不能为空'
    })
    return
  }

  const referencePrice = Number(rawVal)
  if (isNaN(referencePrice)) {
    triggerNotification({
      type: ToastNotificationType.Warning,
      title: '表单校验错误',
      description: '参考单价必须为有效数字'
    })
    return
  }

  const payload = {
    name: form.value.name,
    specification: form.value.specification,
    unit: form.value.unit,
    referencePrice,
    category: form.value.category
  }

  try {
    if (isEditMode.value) {
      await $fetch(`/api/v1/projects/${projectId.value}/main-materials/${editingId.value}`, {
        method: 'PUT',
        body: payload,
        baseURL: apiOrigin
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '更新成功',
        description: '材料条目更新成功'
      })
    } else {
      await $fetch(`/api/v1/projects/${projectId.value}/main-materials`, {
        method: 'POST',
        body: payload,
        baseURL: apiOrigin
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '新增成功',
        description: '材料条目创建成功'
      })
    }
    dialogOpen.value = false
    fetchItems()
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '操作失败',
      description: err.message || '请输入正确的信息'
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
