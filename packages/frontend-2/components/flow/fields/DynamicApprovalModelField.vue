<template>
  <div class="space-y-2">
    <label :for="projectButtonId" class="text-body-xs text-foreground-2">
      {{ field.name }} (project)
      <span v-if="field.required" class="text-danger">*</span>
    </label>
    <FormSelectBase
      v-model="selectedProjectValue"
      :items="projectOptions"
      :label="`${field.name} (project)`"
      :show-label="false"
      :name="projectInputId"
      :search="true"
      :search-placeholder="'请选择项目'"
      :label-id="projectLabelId"
      :button-id="projectButtonId"
      by="id"
    >
      <template #nothing-selected>请选择项目</template>
      <template #something-selected="{ value: selectedValue }">
        <span class="truncate">
          {{ isArray(selectedValue) ? selectedValue[0]?.name : selectedValue.name }}
        </span>
      </template>
      <template #option="{ item }">
        <span class="truncate">{{ item.name }}</span>
      </template>
    </FormSelectBase>

    <label :for="modelButtonId" class="text-body-xs text-foreground-2">
      {{ field.name }} (model)
      <span v-if="field.required" class="text-danger">*</span>
    </label>
    <FormSelectBase
      v-model="selectedModelValue"
      :multiple="isMultiple"
      :items="modelOptions"
      :label="`${field.name} (model)`"
      :show-label="false"
      :name="modelInputId"
      :search="true"
      :search-placeholder="selectedProjectId ? '请选择模型' : '请先选择项目'"
      :label-id="modelLabelId"
      :button-id="modelButtonId"
      :disabled="!selectedProjectId"
      by="id"
    >
      <template #nothing-selected>
        {{ selectedProjectId ? '请选择模型' : '请先选择项目' }}
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
import { searchProjectsQuery, searchModelsQuery } from '~/lib/form/graphql/queries'
import type { DynamicFormSchemaField } from '~/components/flow/fields/types'
import type {
  SearchProjectModelsQuery,
  SearchProjectModelsQueryVariables,
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
const modelOptions = ref<Array<{ id: string; name: string }>>([])
const selectedProjectId = ref('')
const isMultiple = computed(() => !!props.field.multiple)

const projectInputId = computed(() => `flow-dynamic-form-${props.field.key}-project`)
const modelInputId = computed(() => `flow-dynamic-form-${props.field.key}`)
const projectLabelId = useId()
const projectButtonId = useId()
const modelLabelId = useId()
const modelButtonId = useId()

const selectedProjectValue = computed({
  get: () => projectOptions.value.find((item) => item.id === selectedProjectId.value),
  set: async (newValue: unknown) => {
    const nextProjectId =
      !newValue || isArray(newValue)
        ? ''
        : (newValue as { id: string; name: string }).id
    selectedProjectId.value = nextProjectId
    emit('update:value', isMultiple.value ? [] : '')
    if (!selectedProjectId.value) {
      modelOptions.value = []
      return
    }
    await loadModels(selectedProjectId.value)
  }
})

const selectedModelValue = computed({
  get: () => {
    if (isMultiple.value) {
      const selectedIds = isArray(props.value)
        ? props.value.filter((item): item is string => typeof item === 'string')
        : []
      return modelOptions.value.filter((item) => selectedIds.includes(item.id))
    }
    const selectedId = typeof props.value === 'string' ? props.value : ''
    return modelOptions.value.find((item) => item.id === selectedId)
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

const loadModels = async (projectId: string) => {
  const res = await apollo.query<
    SearchProjectModelsQuery,
    SearchProjectModelsQueryVariables
  >({
    query: searchModelsQuery,
    variables: {
      projectId,
      search: null
    },
    fetchPolicy: 'network-only'
  })
  modelOptions.value = (res.data.project?.models.items || []).map((item) => ({
    id: item.id,
    name: item.name
  }))
}

onMounted(async () => {
  await loadProjects()
})
</script>
