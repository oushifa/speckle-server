<template>
  <ProjectsWorkValuationMmDetail
    :project-id="String(instance?.projectId || '')"
    :item="resolvedMeasurementItem"
  />
</template>
<script lang="ts" setup>
import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import { projectMonthlyMeasurementByIdQuery } from '~/lib/projects/graphql/queries'

const props = defineProps({
  instance: {
    type: Object,
    default: () => ({})
  }
})

const measurementId = computed(() => {
  const resourceId = String(props.instance?.resourceId || '')
  const [table, id] = resourceId.split(':')
  if (table !== 'monthly_measurements' || !id) return ''
  return id
})

const { result: monthlyResult } = useQuery(
  projectMonthlyMeasurementByIdQuery,
  () => ({
    projectId: String(props.instance?.projectId || ''),
    id: measurementId.value
  }),
  {
    enabled: computed(() => !!props.instance?.projectId && !!measurementId.value)
  }
)

const resolvedMeasurementItem = computed(
  () => monthlyResult.value?.project?.monthlyMeasurement || props.instance?.item || null
)
</script>
