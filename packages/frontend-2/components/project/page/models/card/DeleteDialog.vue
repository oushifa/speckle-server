<template>
  <LayoutDialog
    v-model:open="isOpen"
    :buttons="[
      {
        text: '取消',
        props: { color: 'outline' },
        onClick: () => {
          isOpen = false
        }
      },
      {
        text: '删除',
        props: { color: 'danger', disabled: loading },
        onClick: () => {
          onDelete()
        }
      }
    ]"
    max-width="sm"
  >
    <template #header>删除模型</template>
    <div class="flex flex-col text-foreground">
      <p class="mb-2">
        您确定要删除模型
        <span class="inline font-medium">{{ model.name }}</span>
        吗？
      </p>
      <p>此操作不可逆，所有此模型中的版本都将被删除。</p>
    </div>
  </LayoutDialog>
</template>
<script setup lang="ts">
import { graphql } from '~~/lib/common/generated/gql'
import type { ProjectPageModelsCardDeleteDialogFragment } from '~~/lib/common/generated/gql/graphql'
import { useMixpanel } from '~~/lib/core/composables/mp'
import { useDeleteModel } from '~~/lib/projects/composables/modelManagement'

graphql(`
  fragment ProjectPageModelsCardDeleteDialog on Model {
    id
    name
  }
`)

const emit = defineEmits<{
  (e: 'deleted'): void
}>()

const props = defineProps<{
  projectId: string
  model: ProjectPageModelsCardDeleteDialogFragment
}>()

const isOpen = defineModel<boolean>('open', { required: true })
const deleteModel = useDeleteModel()

const loading = ref(false)

const mp = useMixpanel()

const onDelete = async () => {
  loading.value = true
  const deleted = await deleteModel({
    id: props.model.id,
    projectId: props.projectId
  }).finally(() => (loading.value = false))
  isOpen.value = false
  mp.track('Branch Action', { type: 'action', name: 'delete' })

  if (deleted) emit('deleted')
}
</script>
