<template>
  <ViewerLayoutPanel>
    <div class="flex flex-col gap-2 p-3">
      <CommonAlert v-if="!isLightingSupported" class="mb-1" size="xs" color="info">
        <template #title>
          <span class="block text-body-2xs">当前视图模式下不可用。</span>
        </template>
      </CommonAlert>

      <div class="flex gap-2 items-center justify-between">
        <span class="text-foreground text-body-2xs">太阳阴影</span>
        <FormSwitch
          v-model="sunlightShadows"
          name="sunShadows"
          :show-label="false"
          :disabled="!isLightingSupported"
        />
      </div>
      <div class="pt-1 grid grid-cols-2 gap-x-4 gap-y-2">
        <FormRange
          v-model="intensity"
          name="intensity"
          label="强度"
          :min="1"
          :max="10"
          :step="0.05"
          :disabled="!isLightingSupported"
        />
        <FormRange
          v-model="elevation"
          name="elevation"
          label="仰角"
          :min="0"
          :max="Math.PI"
          :step="0.05"
          :disabled="!isLightingSupported"
        />
        <FormRange
          v-model="azimuth"
          name="azimuth"
          label="方位角"
          :min="-Math.PI * 0.5"
          :max="Math.PI * 0.5"
          :step="0.05"
          :disabled="!isLightingSupported"
        />
        <FormRange
          v-model="indirectLightIntensity"
          name="indirect"
          label="间接光"
          :min="0"
          :max="5"
          :step="0.05"
          :disabled="!isLightingSupported"
        />
      </div>
    </div>
  </ViewerLayoutPanel>
</template>

<script setup lang="ts">
import { ViewMode, type SunLightConfiguration } from '@speckle/viewer'
import { useInjectedViewerState } from '~~/lib/viewer/composables/setup'
import { useMixpanel } from '~~/lib/core/composables/mp'
import { debounce } from 'lodash-es'
import { FormSwitch } from '@speckle/ui-components'
import { useViewModeUtilities } from '~/lib/viewer/composables/ui'
import { TIME_MS } from '@speckle/shared'

const mp = useMixpanel()
const {
  viewMode: { mode: currentViewMode }
} = useViewModeUtilities()

const isLightingSupported = computed(() => {
  const supported = currentViewMode.value === ViewMode.DEFAULT
  return supported
})

const debounceTrackLightConfigChange = debounce(() => {
  mp.track('Viewer Action', {
    type: 'action',
    name: 'light-config-change'
  })
}, TIME_MS.second)

const createLightConfigComputed = <K extends keyof SunLightConfiguration>(key: K) =>
  computed({
    get: () => lightConfig.value[key],
    set: (newVal) => {
      lightConfig.value = {
        ...lightConfig.value,
        [key]: newVal
      }
      debounceTrackLightConfigChange()
    }
  })

const {
  ui: { lightConfig }
} = useInjectedViewerState()

const intensity = createLightConfigComputed('intensity')
const elevation = createLightConfigComputed('elevation')
const azimuth = createLightConfigComputed('azimuth')
const indirectLightIntensity = createLightConfigComputed('indirectLightIntensity')
const sunlightShadows = createLightConfigComputed('castShadow')
</script>
