<template>
  <LayoutDialog
    v-model:open="open"
    title="移动到分组"
    max-width="sm"
    :buttons="buttons"
    :on-submit="onSubmit"
  >
    <div class="flex flex-col gap-4">
      <FormSelectSavedViewGroup
        name="group"
        label="选择分组"
        show-label
        :project-id="projectId"
        :resource-id-string="resourceIdString"
        :rules="[isRequired]"
      />
    </div>
  </LayoutDialog>
</template>
<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import { useForm } from 'vee-validate'
import { graphql } from '~/lib/common/generated/gql'
import type {
  FormSelectSavedViewGroup_SavedViewGroupFragment,
  ViewerSavedViewsPanelViewMoveDialog_SavedViewFragment
} from '~/lib/common/generated/gql/graphql'
import { isRequired } from '~/lib/common/helpers/validation'
import { useUpdateSavedView } from '~/lib/viewer/composables/savedViews/management'
import { useInjectedViewerState } from '~/lib/viewer/composables/setup'

graphql(`
  fragment ViewerSavedViewsPanelViewMoveDialog_SavedView on SavedView {
    id
    group {
      ...FormSelectSavedViewGroup_SavedViewGroup
    }
    ...UseUpdateSavedView_SavedView
  }
`)

type FormType = {
  group: FormSelectSavedViewGroup_SavedViewGroupFragment
}

const emit = defineEmits<{
  success: [groupId: string]
}>()

const propsData = defineProps<{
  view: ViewerSavedViewsPanelViewMoveDialog_SavedViewFragment | undefined
}>()

const open = defineModel<boolean>('open', {
  required: true
})
const { handleSubmit, setValues } = useForm<FormType>()
const {
  projectId,
  resources: {
    request: { resourceIdString }
  }
} = useInjectedViewerState()
const updateView = useUpdateSavedView()

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
    id: 'save',
    text: '保存',
    submit: true
  }
])

const onSubmit = handleSubmit(async (values) => {
  if (!propsData.view) return
  const groupId = values.group.id !== propsData.view.group.id ? values.group.id : null
  if (!groupId) return

  const res = await updateView({
    view: propsData.view,
    input: {
      id: propsData.view.id,
      projectId: propsData.view.projectId,
      groupId
    }
  })

  if (res?.id) {
    emit('success', groupId)
    open.value = false
  }
})

watch(open, (newVal, oldVal) => {
  if (!propsData.view) return

  if (newVal && !oldVal) {
    // Reset form state when dialog opens
    setValues({
      group: markRaw({ ...propsData.view.group })
    })
  }
})
</script>
