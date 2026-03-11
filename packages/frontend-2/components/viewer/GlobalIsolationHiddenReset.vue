<template>
  <FormButton
    size="sm"
    color="outline"
    class="pointer-events-auto"
    @click="trackAndReset"
  >
    {{ buttonText }}
  </FormButton>
</template>
<script setup lang="ts">
import { useMixpanel } from '~~/lib/core/composables/mp'
import { useFilterUtilities } from '~/lib/viewer/composables/filtering/filtering'
import { useInjectedViewerState } from '~/lib/viewer/composables/setup'

const viewerState = useInjectedViewerState()
const { resetHiddenAndIsolations, hasAnyIsolationsApplied, hasAnyHiddenApplied } =
  useFilterUtilities({ state: viewerState })

const buttonText = computed(() => {
  if (hasAnyIsolationsApplied.value && hasAnyHiddenApplied.value) {
    return '非隔离所有对象并显示所有对象'
  } else if (hasAnyIsolationsApplied.value) {
    return '非隔离所有对象'
  } else if (hasAnyHiddenApplied.value) {
    return '显示所有对象'
  }
  return '重置'
})

const mp = useMixpanel()
const trackAndReset = () => {
  resetHiddenAndIsolations()

  if (hasAnyIsolationsApplied.value && hasAnyHiddenApplied.value) {
    mp.track('Viewer Action', {
      type: 'action',
      name: 'isolations-hidden',
      action: 'reset'
    })
  } else if (hasAnyIsolationsApplied.value) {
    mp.track('Viewer Action', { type: 'action', name: 'isolations', action: 'reset' })
  } else if (hasAnyHiddenApplied.value) {
    mp.track('Viewer Action', { type: 'action', name: 'hidden', action: 'reset' })
  }
}
</script>
