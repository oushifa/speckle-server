<!-- eslint-disable vuejs-accessibility/mouse-events-have-key-events -->
<template>
  <div>
    <LayoutMenu
      v-model:open="showActionsMenu"
      :items="actionsItems"
      :menu-id="menuId"
      :menu-position="HorizontalDirection.Left"
      @click.stop.prevent
      @chosen="onActionChosen"
    >
      <FormButton
        color="subtle"
        hide-text
        :icon-right="EllipsisHorizontalIcon"
        class="!text-foreground-2"
        @click="showActionsMenu = !showActionsMenu"
      ></FormButton>
    </LayoutMenu>
  </div>
</template>
<script setup lang="ts">
import { EllipsisHorizontalIcon } from '@heroicons/vue/24/solid'
import type { LayoutMenuItem } from '~~/lib/layout/helpers/components'
import { useCopyModelLink } from '~~/lib/projects/composables/modelManagement'
import { VersionActionTypes } from '~~/lib/projects/helpers/components'
import { HorizontalDirection } from '~~/lib/common/composables/window'

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'select'): void
  (e: 'chosen', v: VersionActionTypes): void
  (e: 'embed'): void
}>()

const props = defineProps<{
  open: boolean
  projectId: string
  modelId: string
  versionId: string
  selectionDisabled?: boolean
  selectionDisabledMessage?: string
}>()

const { copy } = useClipboard()
const copyModelLink = useCopyModelLink()
const menuId = useId()

const disabledMessage = computed(
  () =>
    props.selectionDisabledMessage ||
    'Version editing is only allowed to project or version owners'
)

const showActionsMenu = computed({
  get: () => props.open,
  set: (newVal) => emit('update:open', newVal)
})

const actionsItems = computed<LayoutMenuItem<VersionActionTypes>[][]>(() => [
  [
    {
      title: '编辑消息...',
      id: VersionActionTypes.EditMessage,
      disabled: !!props.selectionDisabled,
      disabledTooltip: disabledMessage.value
    }
  ],
  [
    {
      title: '选择',
      id: VersionActionTypes.Select,
      disabled: !!props.selectionDisabled,
      disabledTooltip: disabledMessage.value
    },
    {
      title: '移动到...',
      id: VersionActionTypes.MoveTo,
      disabled: !!props.selectionDisabled,
      disabledTooltip: disabledMessage.value
    }
  ],
  [
    { title: '复制链接', id: VersionActionTypes.Share },
    { title: '复制ID', id: VersionActionTypes.CopyId },
    { title: '嵌入看板...', id: VersionActionTypes.EmbedModel }
  ],
  [
    {
      title: '删除...',
      id: VersionActionTypes.Delete,
      disabled: !!props.selectionDisabled,
      disabledTooltip: disabledMessage.value
    }
  ]
])

const onActionChosen = (params: { item: LayoutMenuItem<VersionActionTypes> }) => {
  const { item } = params

  switch (item.id) {
    case VersionActionTypes.Select:
      emit('select')
      break
    case VersionActionTypes.Share:
      void copyModelLink({
        model: {
          projectId: props.projectId,
          id: props.modelId
        },
        versionId: props.versionId
      })
      break
    case VersionActionTypes.CopyId:
      copy(props.versionId, { successMessage: 'Version ID copied to clipboard' })
      break
    case VersionActionTypes.EmbedModel:
      emit('embed')
      break
  }

  emit('chosen', item.id)
}
</script>
