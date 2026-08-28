<template>
  <CommonConfirmDialog
    v-model:open="open"
    title="删除漫游路线"
    confirm-text="确认删除"
    cancel-text="取消"
    @confirm="$emit('confirm')"
  >
    <div class="flex flex-col gap-2 text-body-xs text-foreground">
      <p>
        确定要删除漫游路线
        <span class="font-medium text-primary">“{{ routeName }}”</span>
        吗？
      </p>
      <p class="text-body-3xs text-foreground-2">此操作不可恢复。</p>
    </div>
  </CommonConfirmDialog>
</template>

<script setup lang="ts">
defineProps<{
  routeName?: string
}>()

defineEmits<{
  confirm: []
}>()

const open = defineModel<boolean>('open', { required: true })
</script>
