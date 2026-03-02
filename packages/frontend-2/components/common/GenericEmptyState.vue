<template>
  <CommonEmptyState :cta="cta">
    {{ search ? '未找到符合搜索条件的项目' : message }}
  </CommonEmptyState>
</template>
<script setup lang="ts">
const emit = defineEmits<{ 'clear-search': [] }>()

const props = withDefaults(
  defineProps<{
    search?: boolean
    message?: string
  }>(),
  {
    message: '未找到项目！'
  }
)

const clearSearchCta = ref({
  text: '清除搜索',
  onClick: () => emit('clear-search')
})

const cta = computed(() => (props.search ? clearSearchCta.value : undefined))
</script>
