<template>
  <FlowModelApprove :instance-id="instanceId" />
</template>

<script setup lang="ts">
import FlowModelApprove from '~/components/flow/modelApprove/index.vue'

useHead({
  title: '模型审核'
})

definePageMeta({
  layout: 'empty',
  middleware: ['auth']
})

const route = useRoute()
const instanceId = computed(() => String(route.params.id || ''))
</script>
