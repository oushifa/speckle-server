<template>
  <LayoutDialog
    v-model:open="isOpen"
    title="编辑工作区短 ID"
    max-width="sm"
    :buttons="dialogButtons"
    :on-submit="updateSlug"
  >
    <p class="text-body-xs text-foreground mb-2">更改工作区短 ID 会有重要影响。</p>
    <p class="text-body-xs text-foreground mb-2">
      使用旧短 ID 生成的所有链接都将无效。这可能会打破 书签或之前共享的链接。
    </p>
    <p class="text-body-xs text-foreground font-medium mb-2">您确定要继续吗？</p>
    <FormTextInput
      v-model:model-value="workspaceShortId"
      name="slug"
      label="新短 ID"
      :help="`${baseUrl}${workspaceRoute(workspaceShortId || '')}`"
      color="foundation"
      :rules="[isStringOfLength({ maxLength: 50, minLength: 3 })]"
      :custom-error-message="
        workspaceShortId !== originalSlug ? error?.graphQLErrors[0]?.message : undefined
      "
      :loading="loading"
      show-label
      @update:model-value="updateDebouncedShortId"
    />
  </LayoutDialog>
</template>

<script setup lang="ts">
import { useForm } from 'vee-validate'
import { graphql } from '~~/lib/common/generated/gql'
import type { LayoutDialogButton } from '@speckle/ui-components'
import type { SettingsWorkspacesGeneralEditSlugDialog_WorkspaceFragment } from '~/lib/common/generated/gql/graphql'
import { isStringOfLength } from '~~/lib/common/helpers/validation'
import { workspaceRoute } from '~/lib/common/helpers/route'
import { useQuery } from '@vue/apollo-composable'
import { validateWorkspaceSlugQuery } from '~/lib/workspaces/graphql/queries'
import { debounce } from 'lodash'
import type { MaybeNullOrUndefined } from '@speckle/shared'

graphql(`
  fragment SettingsWorkspacesGeneralEditSlugDialog_Workspace on Workspace {
    id
    name
    slug
  }
`)

const props = defineProps<{
  workspace: MaybeNullOrUndefined<SettingsWorkspacesGeneralEditSlugDialog_WorkspaceFragment>
  baseUrl: string
}>()

const isOpen = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  (e: 'update:slug', newSlug: string): void
}>()

// Main ref that holds the current value of the slug input.
const workspaceShortId = ref(props.workspace?.slug)
// Used to debounce API calls for slug validation.
const debouncedWorkspaceShortId = ref(props.workspace?.slug || '')
// Keeps track of the initially generated slug to prevent unnecessary validations.
const originalSlug = ref(props.workspace?.slug)

const { error, loading } = useQuery(
  validateWorkspaceSlugQuery,
  () => ({
    slug: debouncedWorkspaceShortId.value
  }),
  () => ({
    enabled: debouncedWorkspaceShortId.value !== props.workspace?.slug
  })
)

const { handleSubmit, resetForm } = useForm<{ slug: string }>()

const updateSlug = handleSubmit(() => {
  if (!workspaceShortId.value) return
  emit('update:slug', workspaceShortId.value)
})

const dialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      isOpen.value = false
    }
  },
  {
    text: '更新',
    props: {
      color: 'primary',
      disabled: workspaceShortId.value === props.workspace?.slug || error.value !== null
    },
    submit: true
  }
])

const updateDebouncedShortId = debounce((value: string) => {
  debouncedWorkspaceShortId.value = value
}, 300)

watch(
  () => props.workspace?.slug,
  (newValue) => {
    workspaceShortId.value = newValue
  },
  { immediate: true }
)

watch(
  () => isOpen.value,
  (newValue) => {
    if (!newValue) {
      resetForm()
      error.value = null
    }
  }
)
</script>
