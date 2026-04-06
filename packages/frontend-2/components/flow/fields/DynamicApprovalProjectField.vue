<template>
  <div class="space-y-2">
    <label :for="buttonId" class="text-body-xs text-foreground-2">
      {{ field.name }} (project)
      <span v-if="field.required" class="text-danger">*</span>
    </label>
    <FormSelectBase
      v-model="selectedProjectValue"
      :multiple="isMultiple"
      :items="projectOptions"
      :label="field.name"
      :show-label="false"
      :name="inputId"
      :search="true"
      :search-placeholder="field.placeholder || '请选择项目'"
      :label-id="labelId"
      :button-id="buttonId"
      by="id"
    >
      <template #nothing-selected>
        {{ field.placeholder || '请选择项目' }}
      </template>
      <template #something-selected="{ value: selectedValue }">
        <template v-if="isArray(selectedValue)">
          <span class="truncate">
            {{ selectedValue.map((item) => item.name).join(', ') }}
          </span>
        </template>
        <template v-else>
          <span class="truncate">{{ selectedValue.name }}</span>
        </template>
      </template>
      <template #option="{ item }">
        <span class="truncate">{{ item.name }}</span>
      </template>
    </FormSelectBase>
  </div>
</template>

<script setup lang="ts">
import { isArray } from 'lodash-es'
import { useApolloClient } from '@vue/apollo-composable'
import { searchProjectsQuery } from '~/lib/form/graphql/queries'
import type { DynamicFormSchemaField } from '~/components/flow/fields/types'
import type {
  SearchProjectsQuery,
  SearchProjectsQueryVariables
} from '~~/lib/common/generated/gql/graphql'

const props = defineProps<{
  field: DynamicFormSchemaField
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string | string[]): void
}>()

const apollo = useApolloClient().client
const projectOptions = ref<Array<{ id: string; name: string }>>([])
const inputId = computed(() => `flow-dynamic-form-${props.field.key}`)
const labelId = useId()
const buttonId = useId()
const isMultiple = computed(() => !!props.field.multiple)
const selectedProjectValue = computed({
  get: () => {
    if (isMultiple.value) {
      const selectedIds = isArray(props.value)
        ? props.value.filter((item): item is string => typeof item === 'string')
        : []
      return projectOptions.value.filter((item) => selectedIds.includes(item.id))
    }
    const selectedId = typeof props.value === 'string' ? props.value : ''
    return projectOptions.value.find((item) => item.id === selectedId)
  },
  set: (newValue: unknown) => {
    if (isMultiple.value) {
      const items = isArray(newValue)
        ? newValue.filter(
            (item): item is { id: string; name: string } =>
              typeof item === 'object' && !!item && 'id' in item
          )
        : []
      emit(
        'update:value',
        items.map((item) => item.id)
      )
      return
    }
    if (!newValue || isArray(newValue)) {
      emit('update:value', '')
      return
    }
    emit('update:value', (newValue as { id: string; name: string }).id)
  }
})

const loadProjects = async () => {
  const res = await apollo.query<SearchProjectsQuery, SearchProjectsQueryVariables>({
    query: searchProjectsQuery,
    variables: {
      search: null,
      onlyWithRoles: null,
      workspaceId: null
    },
    fetchPolicy: 'network-only'
  })
  projectOptions.value = (res.data.activeUser?.projects.items || []).map((item) => ({
    id: item.id,
    name: item.name
  }))
}

onMounted(async () => {
  await loadProjects()
})
</script>
