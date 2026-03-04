<template>
  <CommonEmptyState :cta="cta">没有找到匹配您搜索查询的项目</CommonEmptyState>
</template>
<script setup lang="ts">
/**
 * NOTE: This is deprecated, use CommonGenericEmptyState instead
 */

const emit = defineEmits<{ 'clear-search': [] }>()

const cta = {
  text: '清除搜索',
  onClick: () => emit('clear-search')
}
</script>
