<template>
  <LayoutDialog
    v-model:open="isOpen"
    max-width="sm"
    :buttons="[
      {
        text: '取消',
        props: { color: 'outline' },
        onClick: () => {
          isOpen = false
        }
      },
      {
        text: '保存',
        props: {},
        onClick: () => {
          onSubmit()
        }
      }
    ]"
  >
    <template #header>编辑模型</template>
    <form class="flex flex-col text-foreground" @submit="onSubmit">
      <div class="flex flex-col gap-4 mb-4">
        <FormTextInput
          v-model="newName"
          name="name"
          show-label
          label="模型名称"
          placeholder="模型/名称/这里"
          :rules="rules"
          auto-focus
          color="foundation"
          :disabled="loading"
          help="在模型名称中使用斜杠将其嵌套在其他模型下。"
          autocomplete="off"
        />
        <FormTextArea
          v-model="newDescription"
          name="description"
          show-label
          label="模型描述"
          show-optional
          placeholder="描述"
          color="foundation"
          :disabled="loading"
        />
      </div>
    </form>
  </LayoutDialog>
</template>
<script setup lang="ts">
import type { Get } from 'type-fest'
import { useForm } from 'vee-validate'
import { graphql } from '~~/lib/common/generated/gql'
import type {
  ProjectPageModelsCardRenameDialogFragment,
  UpdateModelMutation
} from '~~/lib/common/generated/gql/graphql'
import { useMixpanel } from '~~/lib/core/composables/mp'
import {
  useModelNameValidationRules,
  useUpdateModel
} from '~~/lib/projects/composables/modelManagement'
import { sanitizeModelName } from '~~/lib/projects/helpers/models'

graphql(`
  fragment ProjectPageModelsCardRenameDialog on Model {
    id
    name
    description
  }
`)

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'updated', newModel: Get<UpdateModelMutation, 'modelMutations.update'>): void
}>()

const props = defineProps<{
  open: boolean
  model: ProjectPageModelsCardRenameDialogFragment
  projectId: string
}>()

const { handleSubmit } = useForm<{ name: string; description: string }>()
const rules = useModelNameValidationRules()
const updateModel = useUpdateModel()

const newName = ref(props.model.name)
const newDescription = ref(props.model.description || '')
const loading = ref(false)

const isOpen = computed({
  get: () => props.open,
  set: (newVal) => emit('update:open', newVal)
})
const mp = useMixpanel()
const onSubmit = handleSubmit(async (vals) => {
  loading.value = true
  const updatedModel = await updateModel({
    id: props.model.id,
    name: sanitizeModelName(vals.name),
    description: vals.description,
    projectId: props.projectId
  }).finally(() => (loading.value = false))
  isOpen.value = false
  mp.track('Branch Action', { type: 'action', name: 'edit' })

  if (updatedModel) emit('updated', updatedModel)
})

watch(
  () => [props.open, props.model.name, props.model.description],
  () => {
    newName.value = props.model.name
    newDescription.value = props.model.description || ''
  }
)
</script>
