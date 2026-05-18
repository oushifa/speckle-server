<template>
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div class="flex flex-col gap-3 md:flex-row md:items-center">
      <label class="flex flex-col">
        <span class="sr-only">按文件名搜索</span>
        <input
          :value="keyword"
          class="rounded-md border border-outline-3 bg-foundation px-3 py-2 text-body-sm text-foreground"
          placeholder="按文件名搜索"
          type="text"
          @input="emit('update:keyword', ($event.target as HTMLInputElement).value)"
          @keyup.enter="emit('refresh')"
        />
      </label>
      <label class="flex flex-col">
        <span class="sr-only">按状态筛选</span>
        <select
          :value="status"
          class="rounded-md border border-outline-3 bg-foundation px-3 py-2 text-body-sm text-foreground"
          @change="emit('update:status', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">全部状态</option>
          <option value="uploaded">上传中</option>
          <option value="pending">待转换</option>
          <option value="queued">已排队</option>
          <option value="processing">转换中</option>
          <option value="success">已完成</option>
          <option value="failed">转换失败</option>
        </select>
      </label>
    </div>

    <FormButton color="outline" :disabled="isLoading" @click="emit('refresh')">
      {{ isLoading ? '刷新中...' : '刷新列表' }}
    </FormButton>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  keyword: string
  status: string
  isLoading: boolean
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:status': [value: string]
  refresh: []
}>()
</script>
