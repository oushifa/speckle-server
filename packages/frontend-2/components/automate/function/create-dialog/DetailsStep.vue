<template>
  <div class="flex flex-col gap-6 mb-4">
    <div class="flex flex-col gap-2 sm:gap-0 sm:flex-row sm:gap-x-4 w-full">
      <UserAvatarEditable
        v-model:edit-mode="avatarEditMode"
        name="image"
        placeholder="FN"
        size="xxl"
        @update:model-value="avatarEditMode = false"
      />

      <FormTextInput
        size="lg"
        name="name"
        label="函数名称"
        placeholder="名称"
        color="foundation"
        help="这将是函数的显示名称和存储库名称。"
        show-label
        :rules="nameRules"
        validate-on-value-update
        wrapper-classes="flex-1"
        autocomplete="off"
      />
    </div>
    <FormMarkdownEditor
      name="description"
      label="描述"
      show-label
      show-required
      :rules="descriptionRules"
      validate-on-value-update
    />
    <FormSelectBase
      v-if="workspaces?.length"
      name="workspace"
      label="工作空间"
      placeholder="选择一个工作空间"
      show-label
      allow-unset
      clearable
      help="允许您工作空间中的自动化使用此函数。"
      :items="workspaces"
    >
      <template #something-selected="{ value }">
        <div class="label label--light">
          {{ isArray(value) ? value[0].name : value.name }}
        </div>
      </template>
      <template #option="{ item, selected }">
        <div class="flex flex-col">
          <div :class="['label label--light', selected ? 'text-primary' : '']">
            {{ item.name }}
          </div>
        </div>
      </template>
    </FormSelectBase>
    <FormSelectSourceApps
      name="allowedSourceApps"
      label="支持的应用"
      show-label
      multiple
      help="来自这些应用的版本将支持此函数。如果留空，所有应用都将被支持。"
      clearable
      button-style="tinted"
      validate-on-value-update
      show-optional
    />
    <FormTags
      name="tags"
      color="foundation"
      label="标签"
      show-label
      show-clear
      help="适当的标签将帮助其他用户找到您的函数。"
      validate-on-value-update
      show-optional
    />
    <FormSelectBase
      v-if="githubOrgs?.length"
      name="org"
      label="组织"
      show-label
      allow-unset
      button-style="tinted"
      clearable
      show-optional
      placeholder="选择一个 GitHub 组织"
      help="选择一个组织将发布您的 Git 存储库。如果留空，它将发布到您的个人账号。"
      :items="githubOrgs"
      mount-menu-on-body
      validate-on-value-update
    >
      <template #something-selected="{ value }">
        <div class="label label--light">
          {{ isArray(value) ? value[0] : value }}
        </div>
      </template>
      <template #option="{ item, selected }">
        <div class="flex flex-col">
          <div :class="['label label--light', selected ? 'text-primary' : '']">
            {{ item }}
          </div>
        </div>
      </template>
    </FormSelectBase>
  </div>
</template>
<script setup lang="ts">
import { ValidationHelpers } from '@speckle/ui-components'
import { isArray } from 'lodash-es'
import type { AutomateFunctionCreateDialog_WorkspaceFragment } from '~/lib/common/generated/gql/graphql'

defineProps<{
  githubOrgs?: string[]
  workspaces?: AutomateFunctionCreateDialog_WorkspaceFragment[]
}>()

const avatarEditMode = ref(false)

const nameRules = computed(() => [
  ValidationHelpers.isRequired,
  ValidationHelpers.isStringOfLength({ maxLength: 150 })
])
const descriptionRules = computed(() => [ValidationHelpers.isRequired])
</script>
