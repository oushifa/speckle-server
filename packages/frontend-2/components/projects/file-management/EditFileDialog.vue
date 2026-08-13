<template>
  <LayoutDialog v-model:open="open" max-width="lg" :buttons="dialogButtons">
    <template #header>
      {{ isModel ? '编辑模型自定义信息' : '编辑文件信息' }}
    </template>
    <div class="space-y-4 py-2">
      <!-- File Name -->
      <div>
        <label
          class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
        >
          {{ isModel ? '模型名称' : '文件名称' }}
          <span class="text-red-500">*</span>
        </label>
        <input
          v-model="fileName"
          type="text"
          class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="请输入名称"
        />
      </div>

      <!-- File Source & Category -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
          >
            文件来源
          </label>
          <input
            v-model="source"
            type="text"
            list="edit-source-options"
            class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="请选择或输入来源"
          />
          <datalist id="edit-source-options">
            <option value="BIM模型" />
            <option value="手动上传" />
            <option value="施工资料" />
            <option value="设计图纸" />
            <option value="质量验收" />
            <option value="实模一致性" />
          </datalist>
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
          >
            文件分类
          </label>
          <select
            v-model="category"
            class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="模型文件">模型文件</option>
            <option value="工程图纸">工程图纸</option>
            <option value="技术规范">技术规范</option>
            <option value="变更签证">变更签证</option>
            <option value="设计文档">设计文档</option>
            <option value="施工记录">施工记录</option>
            <option value="其他">其他</option>
          </select>
        </div>
      </div>

      <!-- Description / Remarks -->
      <div>
        <label
          class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
        >
          备注说明
        </label>
        <textarea
          v-model="description"
          rows="2"
          class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="请输入备注说明..."
        ></textarea>
      </div>

      <!-- Custom Attributes -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">
            自定义信息 (属性键值对)
          </label>
          <FormButton color="subtle" size="sm" @click="addCustomAttr">
            + 添加属性
          </FormButton>
        </div>
        <div v-if="customAttrs.length === 0" class="text-xs text-slate-400 italic">
          暂无自定义属性，点击“+ 添加属性”增加
        </div>
        <div v-else class="space-y-2 max-h-40 overflow-y-auto pr-1">
          <div
            v-for="(attr, index) in customAttrs"
            :key="index"
            class="flex items-center space-x-2"
          >
            <input
              v-model="attr.key"
              type="text"
              placeholder="属性名"
              class="w-1/2 px-2 py-1 border rounded text-xs border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <input
              v-model="attr.value"
              type="text"
              placeholder="属性值"
              class="w-1/2 px-2 py-1 border rounded text-xs border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <FormButton
              color="danger"
              size="sm"
              hide-text
              @click="removeCustomAttr(index)"
            >
              <IconX class="size-3" />
            </FormButton>
          </div>
        </div>
      </div>
    </div>
  </LayoutDialog>
</template>

<script setup lang="ts">
import {
  LayoutDialog,
  FormButton,
  type LayoutDialogButton
} from '@speckle/ui-components'

interface FileItem {
  id: string
  projectId: string
  name: string
  source: string
  category: string
  description?: string
  customAttributes?: Record<string, any>
  isModel?: boolean
}

const props = defineProps<{
  open: boolean
  projectId: string
  file: FileItem | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'updated'): void
}>()

const open = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const fileName = ref('')
const source = ref('')
const category = ref('')
const description = ref('')
const loading = ref(false)

interface CustomAttr {
  key: string
  value: string
}
const customAttrs = ref<CustomAttr[]>([])

const isModel = computed(() => !!props.file?.isModel)

watch(
  () => props.file,
  (val) => {
    if (val) {
      fileName.value = val.name || ''
      source.value = val.source || (val.isModel ? 'BIM模型' : '手动上传')
      category.value = val.category || (val.isModel ? '模型文件' : '工程图纸')
      description.value = val.description || ''

      const attrs: CustomAttr[] = []
      if (val.customAttributes && typeof val.customAttributes === 'object') {
        Object.entries(val.customAttributes).forEach(([key, value]) => {
          attrs.push({ key, value: String(value) })
        })
      }
      customAttrs.value = attrs
    }
  },
  { immediate: true }
)

const addCustomAttr = () => {
  customAttrs.value.push({ key: '', value: '' })
}

const removeCustomAttr = (index: number) => {
  customAttrs.value.splice(index, 1)
}

const apiOrigin = useApiOrigin()

const handleSave = async () => {
  if (!props.file) return
  if (!fileName.value.trim()) {
    alert('请输入名称')
    return
  }

  loading.value = true
  try {
    const attrsObj: Record<string, string> = {}
    customAttrs.value.forEach((attr) => {
      if (attr.key.trim()) {
        attrsObj[attr.key.trim()] = attr.value
      }
    })

    const res: any = await $fetch(
      `${apiOrigin}/api/projects/${props.projectId}/files/${props.file.id}`,
      {
        method: 'PUT',
        body: {
          name: fileName.value,
          source: source.value,
          category: category.value,
          description: description.value,
          customAttributes: attrsObj
        }
      }
    )

    if (res?.success) {
      emit('updated')
      open.value = false
    } else {
      alert(res?.error || '更新失败')
    }
  } catch (err: any) {
    alert('更新异常: ' + (err?.message || err))
  } finally {
    loading.value = false
  }
}

const dialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: { color: 'subtle' },
    onClick: () => {
      open.value = false
    }
  },
  {
    text: loading.value ? '保存中...' : '保存',
    props: { color: 'primary', disabled: loading.value },
    onClick: handleSave
  }
])
</script>
