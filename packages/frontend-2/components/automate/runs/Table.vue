<template>
  <div>
    <LayoutTable
      :columns="[
        { id: 'status', header: '状态', classes: 'col-span-2' },
        { id: 'runId', header: '运行 ID', classes: 'col-span-3' },
        { id: 'modelVersion', header: '模型版本', classes: 'col-span-3' },
        { id: 'date', header: '日期', classes: 'col-span-2' },
        { id: 'duration', header: '时长', classes: 'col-span-2' }
      ]"
      :items="runs"
      :buttons="[
        {
          icon: EyeIcon,
          label: '查看',
          action: onView
        }
      ]"
      empty-message="该自动化没有任何运行记录"
    >
      <template #status="{ item }">
        <AutomateRunsStatusBadge :run="item" />
      </template>
      <template #runId="{ item }">
        <span class="text-foreground label-light">{{ item.id }}</span>
      </template>
      <template #modelVersion="{ item }">
        <CommonTextLink
          v-if="item.trigger.model && item.trigger.version"
          :to="
            runModelVersionUrl({
              run: item,
              projectId
            }) || ''
          "
        >
          {{ item.trigger.version.id }}
        </CommonTextLink>
        <span v-else class="italic">未知</span>
      </template>
      <template #date="{ item }">
        <span class="caption">{{ runDate(item) }}</span>
      </template>
      <template #duration="{ item }">
        <span class="caption">{{ runDuration(item) }}</span>
      </template>
    </LayoutTable>
    <ProjectPageAutomationsRunDialog
      v-model:open="runInfoOpen"
      :run="openedRun"
      :automation-id="automationId"
      :project-id="projectId"
    />
  </div>
</template>
<script setup lang="ts">
import { EyeIcon } from '@heroicons/vue/24/outline'
import { useAutomationRunDetailsFns } from '~/lib/automate/composables/runs'
import type { AutomationRunDetailsFragment } from '~/lib/common/generated/gql/graphql'

defineProps<{
  projectId: string
  automationId: string
  runs: AutomationRunDetailsFragment[]
}>()

const { runDate, runDuration, runModelVersionUrl } = useAutomationRunDetailsFns()

const openedRun = ref<AutomationRunDetailsFragment>()
const runInfoOpen = ref(false)

const onView = (run: AutomationRunDetailsFragment) => {
  openedRun.value = run
  runInfoOpen.value = true
}
</script>
