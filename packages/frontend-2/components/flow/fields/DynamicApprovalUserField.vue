<template>
  <div :class="[layout === 'horizontal' ? 'flex items-center gap-2' : 'space-y-2']">
    <label
      :for="buttonId"
      :class="[
        layout === 'horizontal'
          ? 'text-body-sm font-medium whitespace-nowrap text-foreground shrink-0'
          : 'text-body-xs text-foreground-2'
      ]"
    >
      {{ field.name }}<span v-if="layout !== 'horizontal'"> (user)</span>
      <span v-if="field.required" class="text-danger">*</span>
    </label>
    <FormSelectBase
      v-model="selectedUserValue"
      :multiple="isMultiple"
      :items="userOptions"
      :label="field.name"
      :show-label="false"
      :name="selectId"
      :search="true"
      :search-placeholder="field.placeholder || '输入用户名搜索'"
      :get-search-results="invokeSearchUsers"
      :label-id="labelId"
      :button-id="buttonId"
      by="id"
      :class="[layout === 'horizontal' ? 'flex-1' : '']"
    >
      <template #nothing-selected>请选择用户</template>
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
        <span class="truncate">{{ item.name }} ({{ item.id }})</span>
      </template>
    </FormSelectBase>
  </div>
</template>

<script setup lang="ts">
import { isArray } from 'lodash-es'
import { useApolloClient } from '@vue/apollo-composable'
import { graphql } from '~~/lib/common/generated/gql'
import type { DocumentNode } from 'graphql'
import type { DynamicFormSchemaField } from '~/components/flow/fields/types'

const dynamicFormUsersQuery = graphql(`
  query DynamicFormUsers($query: String!, $limit: Int!, $cursor: String) {
    users(input: { query: $query, limit: $limit, cursor: $cursor, projectId: null }) {
      cursor
      items {
        id
        name
      }
    }
  }
`)

const props = withDefaults(
  defineProps<{
    field: DynamicFormSchemaField
    value: unknown
    layout?: 'vertical' | 'horizontal'
  }>(),
  {
    layout: 'vertical'
  }
)

const emit = defineEmits<{
  (e: 'update:value', value: string | string[]): void
}>()

const apollo = useApolloClient().client
const userOptions = ref<Array<{ id: string; name: string }>>([])
const labelId = useId()
const buttonId = useId()
const selectId = computed(() => `flow-dynamic-form-select-${props.field.key}`)
const isMultiple = computed(() => !!props.field.multiple)
const selectedUserValue = computed({
  get: () => {
    if (isMultiple.value) {
      const selectedIds = isArray(props.value)
        ? props.value.filter((item): item is string => typeof item === 'string')
        : []
      return userOptions.value.filter((item) => selectedIds.includes(item.id))
    }
    const selectedId = typeof props.value === 'string' ? props.value : ''
    return userOptions.value.find((item) => item.id === selectedId)
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

const loadUserOptions = async (searchKeyword: string) => {
  const normalizedQuery = searchKeyword.trim().length ? searchKeyword.trim() : '%'
  const res = await apollo.query({
    query: dynamicFormUsersQuery as unknown as DocumentNode,
    variables: {
      query: normalizedQuery,
      limit: 50,
      cursor: null
    },
    fetchPolicy: 'network-only'
  })
  const items =
    (
      res.data as {
        users?: {
          items?: Array<{ id: string; name: string | null }> | null
        } | null
      }
    ).users?.items || []
  userOptions.value = items.map((item) => ({
    id: item.id,
    name: item.name || item.id
  }))
  return userOptions.value
}

const invokeSearchUsers = async (searchKeyword: string) =>
  await loadUserOptions(searchKeyword)

onMounted(async () => {
  await loadUserOptions('')
})
</script>
