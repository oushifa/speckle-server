<template>
  <LayoutDialog
    v-model:open="open"
    title="删除分组"
    max-width="sm"
    :buttons="buttons"
  >
    <!-- prettier-ignore -->
    <p>
      确定要删除分组 <span class="font-bold">{{ groupName }}</span> 吗？
      <br/>此操作不可撤销，分组内的所有视图会被移出分组。
    </p>
  </LayoutDialog>
</template>
<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import { graphql } from '~/lib/common/generated/gql'
import type { ViewerSavedViewsPanelViewsGroupDeleteDialog_SavedViewGroupFragment } from '~/lib/common/generated/gql/graphql'
import { useDeleteSavedViewGroup } from '~/lib/viewer/composables/savedViews/management'

graphql(`
  fragment ViewerSavedViewsPanelViewsGroupDeleteDialog_SavedViewGroup on SavedViewGroup {
    id
    title
    ...UseDeleteSavedViewGroup_SavedViewGroup
  }
`)

const emit = defineEmits<{
  success: [groupId: string]
}>()

const props = defineProps<{
  group: ViewerSavedViewsPanelViewsGroupDeleteDialog_SavedViewGroupFragment | undefined
}>()

const open = defineModel<boolean>('open', {
  required: true
})
const deleteGroup = useDeleteSavedViewGroup()

const groupName = computed(() => props.group?.title)

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
    id: 'delete',
    text: '删除',
    props: {
      color: 'danger'
    },
    onClick: async () => {
      if (!props.group) return
      const groupId = props.group.id

      const deleted = await deleteGroup(props.group)
      if (deleted) {
        emit('success', groupId)
        open.value = false
      }
    }
  }
])
</script>
