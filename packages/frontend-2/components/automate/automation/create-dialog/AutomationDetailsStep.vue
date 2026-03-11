<template>
  <div class="flex flex-col gap-6">
    <FormSelectProjects
      v-if="!preselectedProject"
      v-model="project"
      label="项目"
      show-label
      help="选择您目标模型所在的项目"
      show-required
      mount-menu-on-body
      :rules="projectRules"
      :allow-unset="false"
      validate-on-value-update
      owned-only
      :workspace-id="workspaceId"
    />
    <FormSelectModels
      v-if="project?.id"
      v-model="model"
      :project-id="project.id"
      label="模型"
      show-label
      :help="selectModelHelpText"
      show-required
      mount-menu-on-body
      :rules="modelRules"
      :allow-unset="false"
      validate-on-value-update
    />
    <FormTextInput
      v-model="automationName"
      name="automationName"
      label="自动化名称"
      color="foundation"
      show-label
      help="为您的自动化命名"
      placeholder="名称"
      :rules="nameRules"
      show-required
      validate-on-value-update
    />
  </div>
</template>
<script setup lang="ts">
import type { Optional } from '@speckle/shared'
import { FormTextInput, ValidationHelpers } from '@speckle/ui-components'
import type {
  FormSelectModels_ModelFragment,
  FormSelectProjects_ProjectFragment
} from '~/lib/common/generated/gql/graphql'

const props = defineProps<{
  preselectedProject?: Optional<FormSelectProjects_ProjectFragment>
  isTestAutomation: boolean
  workspaceId?: string
}>()
const project = defineModel<Optional<FormSelectProjects_ProjectFragment>>('project', {
  required: true
})
const model = defineModel<Optional<FormSelectModels_ModelFragment>>('model', {
  required: true
})
const automationName = defineModel<Optional<string>>('automationName', {
  required: true
})

const projectRules = computed(() => [ValidationHelpers.isRequired])
const modelRules = projectRules
const nameRules = computed(() => [
  ValidationHelpers.isRequired,
  ValidationHelpers.isStringOfLength({ maxLength: 150 })
])

const selectModelHelpText = computed(() => {
  return props.isTestAutomation
    ? '本地函数执行将提供此模型的最新版本'
    : '触发此自动化的模型'
})

watch(
  () => props.preselectedProject,
  (newVal) => {
    if (newVal) {
      project.value = newVal
    }
  },
  { immediate: true }
)

watch(project, (newVal, oldVal) => {
  if (model.value && newVal && newVal.id !== oldVal?.id) {
    model.value = undefined
  }
})
</script>
