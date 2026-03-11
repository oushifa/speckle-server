<template>
  <form @submit="onSubmit">
    <div class="flex flex-col space-y-4">
      <div class="">
        创建一个新模型，将
        <template v-if="versions.length > 1">所有选中的版本</template>
        <template v-else-if="versions.length">
          选中的版本
          <span class="font-medium">"{{ versions[0].message || '无版本信息' }}"</span>
        </template>
        移动到该模型中。
      </div>
      <FormTextInput
        name="name"
        label="模型名称"
        placeholder="模型/子模型/子子模型"
        help="使用斜杠将模型嵌套在其他模型下面。"
        color="foundation"
        :custom-icon="CubeIcon"
        :rules="rules"
        :disabled="disabled"
        autocomplete="off"
      />
      <div class="flex justify-end">
        <FormButton submit :disabled="disabled">移动</FormButton>
      </div>
    </div>
  </form>
</template>
<script setup lang="ts">
import type { ProjectModelPageDialogMoveToVersionFragment } from '~~/lib/common/generated/gql/graphql'
import { useModelNameValidationRules } from '~~/lib/projects/composables/modelManagement'
import { CubeIcon } from '@heroicons/vue/24/outline'
import { useForm } from 'vee-validate'
import { sanitizeModelName } from '~~/lib/projects/helpers/models'

const emit = defineEmits<{
  (e: 'model-selected', val: string): void
}>()

defineProps<{
  projectId: string
  versions: ProjectModelPageDialogMoveToVersionFragment[]
  disabled?: boolean
}>()

const rules = useModelNameValidationRules()
const { handleSubmit } = useForm<{ name: string }>()

const onSubmit = handleSubmit((values) => {
  emit('model-selected', sanitizeModelName(values.name))
})
</script>
