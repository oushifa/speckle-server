<template>
  <LayoutDialog
    v-model:open="open"
    max-width="sm"
    hide-closer
    :buttons="[
      {
        text: '取消',
        props: { color: 'outline' },
        onClick: () => {
          open = false
        }
      },
      {
        text: '删除',
        props: { color: 'danger' },
        onClick: onConfirm
      }
    ]"
  >
    <template #header>删除同步</template>
  </LayoutDialog>
</template>

<script setup lang="ts">
import { useDeleteAccSyncItem } from '~/lib/acc/composables/useDeleteAccSyncItem'
import type { ProjectPageModelRemoveSyncDialog_AccSyncItemFragment } from '~/lib/common/generated/gql/graphql'
import { graphql } from '~~/lib/common/generated/gql'

graphql(`
  fragment ProjectPageModelRemoveSyncDialog_AccSyncItem on AccSyncItem {
    id
    accFileName
  }
`)

const props = defineProps<{
  projectId: string
  syncItem: ProjectPageModelRemoveSyncDialog_AccSyncItemFragment
}>()

const open = defineModel<boolean>('open', { required: true })

const deleteAccSyncItem = useDeleteAccSyncItem()

const onConfirm = async () => {
  await deleteAccSyncItem(props.projectId, props.syncItem.id)
}
</script>
