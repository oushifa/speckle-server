<template>
  <div class="rounded-lg border border-outline-3 bg-foundation-page p-6">
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div class="space-y-1">
        <h1 class="text-heading-lg text-foreground">文件转换</h1>
        <p class="text-body-xs text-foreground-2">
          上传源文件后等待第三方转换，完成后可在列表中直接下载结果文件。
        </p>
      </div>

      <div class="flex flex-col gap-3 md:flex-row md:items-center">
        <label class="flex flex-col">
          <span class="sr-only">选择待上传文件</span>
          <input
            class="block w-full cursor-pointer rounded-md border border-outline-3 bg-foundation px-3 py-2 text-body-sm text-foreground md:w-80"
            type="file"
            @change="emit('select-file', $event)"
          />
        </label>
        <FormButton color="primary" :disabled="!hasSelectedFile || isUploading" @click="emit('upload')">
          {{ isUploading ? '上传中...' : '上传文件' }}
        </FormButton>
      </div>
    </div>

    <p v-if="selectedFileLabel" class="mt-3 text-body-xs text-foreground-2">
      已选择：{{ selectedFileLabel }}
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  hasSelectedFile: boolean
  selectedFileLabel: string
  isUploading: boolean
}>()

const emit = defineEmits<{
  'select-file': [event: Event]
  upload: []
}>()
</script>
