<template>
  <form @submit="onSubmit">
    <div class="flex flex-col gap-y-4">
      <div class="">
        把
        <template v-if="versions.length > 1">所有选中的版本</template>
        <template v-else-if="versions.length">
          选中的版本
          <span class="font-medium">"{{ versions[0].message || '无版本信息' }}"</span>
        </template>
        移动到目标模型。
      </div>
      <CommonModelSelect
        :project-id="projectId"
        name="model"
        label="目标模型"
        :rules="[isRequired]"
        :disabled="disabled"
        mount-menu-on-body
        :excluded-ids="modelId ? [modelId] : undefined"
      />
      <div class="flex justify-end">
        <FormButton submit :disabled="disabled">移动</FormButton>
      </div>
    </div>
  </form>
</template>
<script setup lang="ts">
import type {
  CommonModelSelectorModelFragment,
  ProjectModelPageDialogMoveToVersionFragment
} from '~~/lib/common/generated/gql/graphql'
import { useForm } from 'vee-validate'
import { isRequired } from '~~/lib/common/helpers/validation'

const emit = defineEmits<{
  (e: 'model-selected', val: string): void
}>()

defineProps<{
  projectId: string
  versions: ProjectModelPageDialogMoveToVersionFragment[]
  disabled?: boolean
  modelId?: string
}>()

const { handleSubmit } = useForm<{
  model: CommonModelSelectorModelFragment
}>()

const onSubmit = handleSubmit((values) => {
  emit('model-selected', values.model.name)
})
</script>
