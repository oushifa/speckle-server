<template>
  <LayoutDialog
    v-model:open="openState"
    max-width="sm"
    hide-closer
    :buttons="dialogButtons"
  >
    <template #header>创建新模型</template>
    <form @submit="onSubmit">
      <div class="flex flex-col space-y-6 mb-4">
        <FormTextInput
          v-model="newModelName"
          color="foundation"
          name="name"
          label="模型名称"
          show-label
          placeholder="模型/子模型/子子模型"
          :custom-icon="CubeIcon"
          :rules="rules"
          :disabled="anyMutationsLoading"
          help="使用斜杠嵌套模型，例如：a/b/c"
          autocomplete="off"
        />
        <FormTextArea
          v-model="newDescription"
          color="foundation"
          name="description"
          show-label
          show-optional
          label="模型描述"
          placeholder="描述"
          size="lg"
          :disabled="anyMutationsLoading"
        />
      </div>
    </form>
  </LayoutDialog>
</template>
<script setup lang="ts">
import { CubeIcon } from '@heroicons/vue/24/outline'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { useMutationLoading } from '@vue/apollo-composable'
import { useForm } from 'vee-validate'
import type { ProjectPageLatestItemsModelItemFragment } from '~/lib/common/generated/gql/graphql'
import { useMixpanel } from '~~/lib/core/composables/mp'
import {
  useCreateNewModel,
  useModelNameValidationRules
} from '~~/lib/projects/composables/modelManagement'
import { sanitizeModelName } from '~~/lib/projects/helpers/models'

type FormValues = {
  name: string
  description: string
}

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'submit', val: { model: ProjectPageLatestItemsModelItemFragment }): void
}>()

const props = defineProps<{
  open: boolean
  projectId: string
  /**
   * If creating a nested model, specify the prefix of the parent model here as it will be prefixed
   * to whatever the user enters.
   * E.g. if creating a model under "a/b", then put "a/b" here
   */
  parentModelName?: string
  /**
   * Prefill the model name input. Takes precedence over `parentModelName`.
   */
  modelName?: string
}>()

const { handleSubmit } = useForm<FormValues>()
const anyMutationsLoading = useMutationLoading()
const rules = useModelNameValidationRules()
const createModel = useCreateNewModel()
const mp = useMixpanel()

const newModelName = ref('')
const newDescription = ref('')

const openState = computed({
  get: () => props.open,
  set: (newVal) => emit('update:open', newVal)
})

const onSubmit = handleSubmit(async ({ name, description }) => {
  const res = await createModel({
    name: sanitizeModelName(name),
    description,
    projectId: props.projectId
  })

  if (!res?.id) return
  emit('submit', { model: res })

  mp.track('Branch Action', { type: 'action', name: 'create', mode: 'dialog' })
  openState.value = false
})

watch(
  () => props.open,
  (isOpen, oldIsOpen) => {
    if (isOpen && isOpen !== oldIsOpen) {
      if (props.modelName) {
        newModelName.value = props.modelName
      } else if (props.parentModelName) {
        newModelName.value = `${props.parentModelName}/`
      } else {
        newModelName.value = ''
      }
      newDescription.value = ''
    }
  }
)

const dialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      openState.value = false
    }
  },
  {
    text: '创建',
    props: {},
    onClick: () => {
      onSubmit()
    },
    disabled: anyMutationsLoading.value
  }
])
</script>
