<template>
  <div>
    <div v-if="schema.length" class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div v-for="field in schema" :key="field.key" class="space-y-2">
        <template v-if="field.type === 'boolean'">
          <label
            :for="fieldId(field.key)"
            class="inline-flex items-center gap-2 text-body-sm"
          >
            <input
              :id="fieldId(field.key)"
              type="checkbox"
              :checked="Boolean(values[field.key])"
              @change="setValue(field.key, ($event.target as HTMLInputElement).checked)"
            />
            {{ field.name }}
            <span v-if="field.required" class="text-danger">*</span>
          </label>
        </template>

        <template v-else-if="field.type === 'text'">
          <label :for="fieldId(field.key)" class="text-body-xs text-foreground-2">
            {{ field.name }} ({{ field.type }})
            <span v-if="field.required" class="text-danger">*</span>
          </label>
          <textarea
            :id="fieldId(field.key)"
            :value="String(values[field.key] ?? '')"
            class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page min-h-24"
            :placeholder="field.placeholder || `请输入${field.name}`"
            @input="setValue(field.key, ($event.target as HTMLTextAreaElement).value)"
          />
        </template>

        <template v-else-if="field.type === 'date' || field.type === 'datetime'">
          <label :for="fieldId(field.key)" class="text-body-xs text-foreground-2">
            {{ field.name }} ({{ field.type }})
            <span v-if="field.required" class="text-danger">*</span>
          </label>
          <input
            :id="fieldId(field.key)"
            :type="field.type === 'datetime' ? 'datetime-local' : 'date'"
            :value="String(values[field.key] ?? '')"
            class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
            @input="setValue(field.key, ($event.target as HTMLInputElement).value)"
          />
        </template>

        <template v-else-if="field.type === 'project'">
          <label :for="fieldId(field.key)" class="text-body-xs text-foreground-2">
            {{ field.name }} (project)
            <span v-if="field.required" class="text-danger">*</span>
          </label>
          <select
            :id="fieldId(field.key)"
            :value="String(values[field.key] ?? '')"
            class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
            @change="setValue(field.key, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">请选择项目</option>
            <option v-for="item in projectOptions" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </template>

        <template v-else-if="field.type === 'model'">
          <label :for="fieldId(field.key)" class="text-body-xs text-foreground-2">
            {{ field.name }} (model)
            <span v-if="field.required" class="text-danger">*</span>
          </label>
          <select
            :id="fieldId(field.key)"
            :value="String(values[field.key] ?? '')"
            class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
            :disabled="!selectedProjectId"
            @change="setValue(field.key, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">
              {{ selectedProjectId ? '请选择模型' : '请先选择项目' }}
            </option>
            <option v-for="item in modelOptions" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </template>

        <template v-else-if="field.type === 'user'">
          <label :for="fieldId(field.key)" class="text-body-xs text-foreground-2">
            {{ field.name }} (user)
            <span v-if="field.required" class="text-danger">*</span>
          </label>
          <input
            :id="fieldId(field.key)"
            :value="String(userSearchKeywords[field.key] ?? '')"
            class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
            :placeholder="field.placeholder || '输入用户名搜索'"
            @input="
              onUserKeywordInput(field.key, ($event.target as HTMLInputElement).value)
            "
          />
          <select
            :id="fieldSelectId(field.key)"
            :value="String(values[field.key] ?? '')"
            class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
            @change="setValue(field.key, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">请选择用户</option>
            <option
              v-for="item in userOptionsByField[field.key] || []"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }} ({{ item.id }})
            </option>
          </select>
        </template>

        <template v-else>
          <label :for="fieldId(field.key)" class="text-body-xs text-foreground-2">
            {{ field.name }} ({{ field.type }})
            <span v-if="field.required" class="text-danger">*</span>
          </label>
          <select
            v-if="field.type === 'select'"
            :id="fieldId(field.key)"
            :value="String(values[field.key] ?? '')"
            class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
            @change="setValue(field.key, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">{{ field.placeholder || `请选择${field.name}` }}</option>
            <option
              v-for="option in field.options || []"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <input
            v-else
            :id="fieldId(field.key)"
            :type="field.type === 'number' ? 'number' : 'text'"
            :value="String(values[field.key] ?? '')"
            class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
            :placeholder="field.placeholder || `请输入${field.name}`"
            @input="
              setValue(
                field.key,
                field.type === 'number'
                  ? ($event.target as HTMLInputElement).value === ''
                    ? null
                    : Number(($event.target as HTMLInputElement).value)
                  : ($event.target as HTMLInputElement).value
              )
            "
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { graphql } from '~~/lib/common/generated/gql'
import { useApolloClient } from '@vue/apollo-composable'
import type { DocumentNode } from 'graphql'
import { searchProjectsQuery, searchModelsQuery } from '~/lib/form/graphql/queries'
import { mentionsUserSearchQuery } from '~/lib/common/graphql/queries'
import type {
  MentionsUserSearchQuery,
  MentionsUserSearchQueryVariables,
  SearchProjectModelsQuery,
  SearchProjectModelsQueryVariables,
  SearchProjectsQuery,
  SearchProjectsQueryVariables
} from '~~/lib/common/generated/gql/graphql'

const invitableCollaboratorsQuery = graphql(`
  query DynamicFormInvitableCollaborators(
    $projectId: String!
    $limit: Int!
    $search: String
  ) {
    project(id: $projectId) {
      id
      invitableCollaborators(filter: { search: $search }, limit: $limit) {
        items {
          user {
            id
            name
          }
        }
      }
    }
  }
`)

type DynamicFormSchemaField = {
  key: string
  name: string
  type: string
  required?: boolean
  placeholder?: string | null
  options?: Array<{ label: string; value: string }>
}

const props = withDefaults(
  defineProps<{
    schema: DynamicFormSchemaField[]
    modelValue: Record<string, unknown>
  }>(),
  {
    schema: () => [],
    modelValue: () => ({})
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, unknown>): void
}>()

const apollo = useApolloClient().client

const values = computed(() => props.modelValue || {})
const projectOptions = ref<Array<{ id: string; name: string }>>([])
const modelOptions = ref<Array<{ id: string; name: string }>>([])
const userOptionsByField = ref<Record<string, Array<{ id: string; name: string }>>>({})
const userSearchKeywords = ref<Record<string, string>>({})

const projectFieldKey = computed(
  () => props.schema.find((field) => field.type === 'project')?.key || null
)

const selectedProjectId = computed(() => {
  const key = projectFieldKey.value
  if (!key) return null
  const raw = values.value[key]
  return typeof raw === 'string' && raw ? raw : null
})

const setValue = (key: string, value: unknown) => {
  emit('update:modelValue', {
    ...values.value,
    [key]: value
  })
}

const fieldId = (key: string) => `flow-dynamic-form-${key}`
const fieldSelectId = (key: string) => `flow-dynamic-form-select-${key}`

const loadProjects = async () => {
  const hasProjectField = props.schema.some((field) => field.type === 'project')
  if (!hasProjectField) return
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

const loadModels = async (projectId: string | null) => {
  if (!projectId) {
    modelOptions.value = []
    return
  }
  const hasModelField = props.schema.some((field) => field.type === 'model')
  if (!hasModelField) return
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

const loadUserOptions = async (keyword: string) => {
  const trimmedKeyword = keyword.trim()
  if (selectedProjectId.value) {
    const res = await apollo.query({
      query: invitableCollaboratorsQuery as unknown as DocumentNode,
      variables: {
        projectId: selectedProjectId.value,
        limit: 20,
        search: trimmedKeyword || null
      },
      fetchPolicy: 'network-only'
    })
    const users =
      (
        res.data as {
          project?: {
            invitableCollaborators?: {
              items?: Array<{
                user?: { id: string; name: string | null } | null
              }> | null
            } | null
          } | null
        }
      ).project?.invitableCollaborators?.items || []
    return users
      .map((item) => item.user)
      .filter((user): user is { id: string; name: string | null } => Boolean(user?.id))
      .map((user) => ({
        id: user.id,
        name: user.name || user.id
      }))
  }

  const res = await apollo.query<
    MentionsUserSearchQuery,
    MentionsUserSearchQueryVariables
  >({
    query: mentionsUserSearchQuery,
    variables: {
      query: trimmedKeyword,
      projectId: null
    },
    fetchPolicy: 'network-only'
  })
  return (res.data.users.items || []).map((item) => ({
    id: item.id,
    name: item.name
  }))
}

const onUserKeywordInput = async (fieldKey: string, keyword: string) => {
  userSearchKeywords.value = {
    ...userSearchKeywords.value,
    [fieldKey]: keyword
  }
  const options = await loadUserOptions(keyword)
  userOptionsByField.value = {
    ...userOptionsByField.value,
    [fieldKey]: options
  }
}

const refreshUserOptions = async () => {
  const userFields = props.schema.filter((field) => field.type === 'user')
  for (const field of userFields) {
    const keyword = userSearchKeywords.value[field.key] || ''
    const options = await loadUserOptions(keyword)
    userOptionsByField.value = {
      ...userOptionsByField.value,
      [field.key]: options
    }
  }
}

watch(
  () => selectedProjectId.value,
  async (projectId) => {
    await loadModels(projectId)
    await refreshUserOptions()
  },
  { immediate: true }
)

watch(
  () => props.schema,
  async () => {
    await loadProjects()
    await refreshUserOptions()
  },
  { immediate: true, deep: true }
)
</script>
