<template>
  <ProjectPageSettingsBlock background title="问题讨论" :auth-check="canUpdate">
    <template #introduction>
      <p class="text-body-xs text-foreground">控制谁可以在这个项目上发表评论。</p>
    </template>
    <FormRadioGroup
      v-model="selectedOption"
      :disabled="!canUpdate.authorized"
      :options="radioOptions"
      size="sm"
      @update:model-value="emitUpdate"
    />
  </ProjectPageSettingsBlock>
</template>

<script setup lang="ts">
import { UserGroupIcon, UserCircleIcon } from '@heroicons/vue/24/outline'
import { FormRadioGroup } from '@speckle/ui-components'
import {
  castToSupportedVisibility,
  SupportedProjectVisibility
} from '~/lib/projects/helpers/visibility'
import { graphql } from '~~/lib/common/generated/gql'
import type { ProjectPageSettingsGeneralBlockDiscussions_ProjectFragment } from '~~/lib/common/generated/gql/graphql'

graphql(`
  fragment ProjectPageSettingsGeneralBlockDiscussions_Project on Project {
    id
    visibility
    allowPublicComments
    permissions {
      canUpdateAllowPublicComments {
        ...FullPermissionCheckResult
      }
    }
  }
`)

const props = defineProps<{
  project: ProjectPageSettingsGeneralBlockDiscussions_ProjectFragment
}>()

const emit = defineEmits<{
  (event: 'update-comments-permission', value: boolean): void
}>()

enum CommentPermission {
  Anyone = 'anyone',
  TeamMembers = 'teamMembers'
}

const selectedOption = ref(
  props.project.allowPublicComments
    ? CommentPermission.Anyone
    : CommentPermission.TeamMembers
)

const canUpdate = computed(() => props.project.permissions.canUpdateAllowPublicComments)

const radioOptions = computed(() => [
  {
    value: CommentPermission.Anyone,
    title: '任何用户',
    introduction: '任何用户都可以在这个项目上发表评论。',
    icon: UserGroupIcon
  },
  {
    value: CommentPermission.TeamMembers,
    title: '团队成员',
    introduction: '只有团队成员才能在这个项目上发表评论。',
    icon: UserCircleIcon,
    help:
      castToSupportedVisibility(props.project.visibility) !==
      SupportedProjectVisibility.Public
        ? '只有团队成员才能在私有项目上发表评论。'
        : undefined
  }
])

watch(
  () => props.project.visibility,
  (newVisibility) => {
    if (
      castToSupportedVisibility(newVisibility) !== SupportedProjectVisibility.Public
    ) {
      selectedOption.value = CommentPermission.TeamMembers
    }
  },
  { immediate: true }
)

const emitUpdate = (value: CommentPermission) => {
  emit('update-comments-permission', value === CommentPermission.Anyone)
}
</script>
