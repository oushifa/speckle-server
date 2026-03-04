<template>
  <FormClipboardInput :value="value" v-bind="$attrs" @copy="handleCopy" />
</template>

<script setup lang="ts">
import { FormClipboardInput } from '@speckle/ui-components'
import { useClipboard } from '~~/composables/browser'

const { copy } = useClipboard()

defineProps({
  value: {
    type: String,
    required: true
  }
})

const handleCopy = async (value: string) => {
  await copy(value, {
    successMessage: '值已复制到剪贴板',
    failureMessage: '复制值到剪贴板失败'
  })
}
</script>
