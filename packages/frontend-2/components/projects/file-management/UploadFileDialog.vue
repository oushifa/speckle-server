<template>
  <LayoutDialog v-model:open="open" max-width="lg" :buttons="dialogButtons">
    <template #header>上传文件</template>
    <div class="space-y-4 py-2">
      <!-- File Selector -->
      <div>
        <label
          class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
        >
          选择文件
          <span class="text-red-500">*</span>
        </label>
        <div
          class="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition-colors"
          :class="
            selectedFile
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
              : 'border-slate-300 dark:border-slate-700'
          "
          @click="triggerFileSelect"
        >
          <input
            ref="fileInputRef"
            type="file"
            class="hidden"
            @change="handleFileChange"
          />
          <div v-if="selectedFile" class="flex items-center justify-between">
            <div class="flex items-center space-x-2 truncate">
              <IconFile class="size-6 text-blue-500 shrink-0" />
              <div class="text-left truncate">
                <p
                  class="text-sm font-medium text-slate-800 dark:text-slate-100 truncate"
                >
                  {{ selectedFile.name }}
                </p>
                <p class="text-xs text-slate-500">
                  {{ formatFileSize(selectedFile.size) }}
                </p>
              </div>
            </div>
            <FormButton color="subtle" size="sm" @click.stop="clearSelectedFile">
              重选
            </FormButton>
          </div>
          <div v-else class="py-4">
            <IconUpload class="size-8 mx-auto text-slate-400 mb-2" />
            <p class="text-sm text-slate-600 dark:text-slate-300">
              点击选择文件，或拖拽文件至此处
            </p>
            <p class="text-xs text-slate-400 mt-1">支持各类文档、图纸、模型等文件</p>
          </div>
        </div>
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
            list="source-options"
            class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="请选择或输入文件来源"
          />
          <datalist id="source-options">
            <option value="手动上传" />
            <option value="施工资料" />
            <option value="设计图纸" />
            <option value="质量验收" />
            <option value="验工计价" />
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
            <option value="工程图纸">工程图纸</option>
            <option value="技术规范">技术规范</option>
            <option value="变更签证">变更签证</option>
            <option value="设计文档">设计文档</option>
            <option value="施工记录">施工记录</option>
            <option value="模型文件">模型文件</option>
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
          placeholder="请输入文件相关备注或补充说明..."
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
              placeholder="属性名 (如: 编制单位)"
              class="w-1/2 px-2 py-1 border rounded text-xs border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <input
              v-model="attr.value"
              type="text"
              placeholder="属性值 (如: 中铁三局)"
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

const props = defineProps<{
  open: boolean
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'uploaded'): void
}>()

const open = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const source = ref('手动上传')
const category = ref('工程图纸')
const description = ref('')
const loading = ref(false)

interface CustomAttr {
  key: string
  value: string
}
const customAttrs = ref<CustomAttr[]>([])

const triggerFileSelect = () => {
  fileInputRef.value?.click()
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const clearSelectedFile = () => {
  selectedFile.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const addCustomAttr = () => {
  customAttrs.value.push({ key: '', value: '' })
}

const removeCustomAttr = (index: number) => {
  customAttrs.value.splice(index, 1)
}

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const apiOrigin = useApiOrigin()

const handleUpload = async () => {
  if (!selectedFile.value) {
    alert('请选择要上传的文件')
    return
  }

  loading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('source', source.value)
    formData.append('category', category.value)
    formData.append('description', description.value)

    const attrsObj: Record<string, string> = {}
    customAttrs.value.forEach((attr) => {
      if (attr.key.trim()) {
        attrsObj[attr.key.trim()] = attr.value
      }
    })
    formData.append('customAttributes', JSON.stringify(attrsObj))

    const res: any = await $fetch(
      `${apiOrigin}/api/projects/${props.projectId}/files/upload`,
      {
        method: 'POST',
        body: formData
      }
    )

    if (res?.success) {
      emit('uploaded')
      open.value = false
      // Reset form
      selectedFile.value = null
      description.value = ''
      customAttrs.value = []
    } else {
      alert(res?.error || '文件上传失败')
    }
  } catch (err: any) {
    alert('上传异常: ' + (err?.message || err))
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
    text: loading.value ? '上传中...' : '提交上传',
    props: { color: 'primary', disabled: loading.value || !selectedFile.value },
    onClick: handleUpload
  }
])
</script>
