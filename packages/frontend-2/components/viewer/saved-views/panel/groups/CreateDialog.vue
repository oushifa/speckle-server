<template>
  <LayoutDialog
    v-model:open="open"
    title="创建分组"
    max-width="sm"
    :buttons="buttons"
    :on-submit="onSubmit"
  >
    <div class="flex flex-col gap-4">
      <FormTextInput
        name="name"
        label="分组名称"
        show-label
        color="foundation"
        placeholder="输入分组名称"
        :rules="[isRequired, isStringOfLength({ maxLength: 255 })]"
        auto-focus
      />
    </div>
  </LayoutDialog>
</template>
<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import { useMutationLoading } from '@vue/apollo-composable'
import { useForm } from 'vee-validate'
import { isRequired, isStringOfLength } from '~/lib/common/helpers/validation'
import { useCreateSavedViewGroup } from '~/lib/viewer/composables/savedViews/management'
import { useInjectedViewerState } from '~/lib/viewer/composables/setup'

type FormType = {
  name: string
}

const emit = defineEmits<{
  success: [{ id: string }]
}>()
const open = defineModel<boolean>('open', {
  required: true
})
const {
  projectId,
  resources: {
    response: { concreteResourceIdString }
  }
} = useInjectedViewerState()
const isLoading = useMutationLoading()
const createGroup = useCreateSavedViewGroup()
const { handleSubmit, setValues } = useForm<FormType>()

const buttons = computed((): LayoutDialogButton[] => [
  {
    id: 'cancel',
    text: '取消',
    props: {
      color: 'outline'
    },
    onClick: () => {
      open.value = false
    }
  },
  {
    id: 'create',
    text: '创建',
    submit: true
  }
])

const onSubmit = handleSubmit(async (values) => {
  if (isLoading.value) return

  const group = await createGroup({
    projectId: projectId.value,
    resourceIdString: concreteResourceIdString.value,
    groupName: values.name
  })
  if (group) {
    emit('success', {
      id: group.id
    })
    open.value = false
  }
})

watch(open, (newVal, oldVal) => {
  if (newVal && !oldVal) {
    // Reset form state when dialog opens
    setValues({
      name: ''
    })
  }
})
</script>
