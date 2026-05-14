<template>
  <div class="border border-outline-3 rounded-xl bg-foundation-page p-2 h-full">
    <div v-if="loading" class="text-body-xs text-foreground-2 px-1 py-2">加载中...</div>
    <div
      v-for="row in visibleRows"
      :key="row.id"
      class="py-1"
      :style="{ paddingLeft: `${row.level * 14}px` }"
    >
      <div
        class="group flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors"
        :class="isSelected(row.id) ? 'bg-foundation-focus' : 'hover:bg-primary-muted'"
      >
        <button
          type="button"
          class="w-5 h-5 text-foreground-2 hover:text-foreground"
          :disabled="!row.hasChildren"
          @click.stop="toggleExpand(row.id)"
        >
          {{ row.hasChildren ? (isExpanded(row.id) ? '▾' : '▸') : '' }}
        </button>
        <button
          type="button"
          class="flex-1 text-left text-body-xs truncate"
          :class="isSelected(row.id) ? 'text-primary font-medium' : 'text-foreground'"
          @click="selectRow(row.id)"
        >
          {{ row.name }}
        </button>
        <button
          type="button"
          class="ml-auto flex h-7 w-7 items-center justify-center rounded border border-outline-3 text-body-3xs hover:bg-foundation transition-opacity"
          :class="
            isSelected(row.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          "
          @click.stop="startCreate(row.id)"
        >
          <IconPlus class="h-3.5 w-3.5" />
        </button>
        <button
          v-if="row.id !== ROOT_ID"
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded border border-outline-3 text-body-3xs hover:bg-foundation transition-opacity"
          :class="
            isSelected(row.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          "
          @click.stop="startRelation(row.id)"
        >
          <IconFile class="h-3.5 w-3.5" />
        </button>
        <button
          v-if="row.id !== ROOT_ID"
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded border border-outline-3 text-body-3xs text-danger hover:bg-danger-lighter transition-opacity"
          :class="
            isSelected(row.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          "
          @click.stop="startDelete(row.id)"
        >
          <IconDelete class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <LayoutDialog v-model:open="createModalOpen" max-width="sm">
      <template #header>新建下级</template>
      <div class="flex flex-col gap-3">
        <div class="text-body-xs text-foreground-2">
          当前父级：{{ currentCreateParentName || ROOT_NAME }}
        </div>
        <input
          v-model.trim="newChildName"
          class="w-full border border-outline-3 rounded px-2 py-1.5 text-body-xs bg-foundation-page"
          placeholder="请输入名称"
          @keydown.enter="createChild"
          @keydown.esc="cancelCreate"
        />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-body-3xs rounded border border-outline-3 hover:bg-foundation"
            @click="cancelCreate"
          >
            取消
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-body-3xs rounded border border-outline-3 hover:bg-foundation"
            @click="createChild"
          >
            确定
          </button>
        </div>
      </div>
    </LayoutDialog>

    <LayoutDialog v-model:open="relationModalOpen" max-width="sm">
      <template #header>模型关联</template>
      <div class="flex flex-col gap-3">
        <div class="text-body-xs text-foreground-2">
          当前节点：{{ currentRelationTargetName }}
        </div>
        <div
          class="max-h-[320px] overflow-y-auto border border-outline-3 rounded-md p-2 bg-foundation-page"
        >
          <div v-if="loadingRelationModels" class="text-body-xs text-foreground-2 py-1">
            模型加载中...
          </div>
          <div
            v-else-if="!relationModelOptions.length"
            class="text-body-xs text-foreground-2 py-1"
          >
            暂无模型
          </div>
          <label
            v-for="model in relationModelOptions"
            v-else
            :key="model.id"
            class="flex items-center gap-2 py-1 cursor-pointer text-body-xs text-foreground"
          >
            <input
              type="checkbox"
              :checked="relationSelectedIds.includes(model.id)"
              @change="toggleRelationModel(model.id)"
            />
            <span class="truncate">{{ model.name }}</span>
          </label>
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-body-3xs rounded border border-outline-3 hover:bg-foundation"
            @click="cancelRelation"
          >
            取消
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-body-3xs rounded border border-outline-3 hover:bg-foundation disabled:opacity-60"
            :disabled="savingRelation"
            @click="confirmRelation"
          >
            {{ savingRelation ? '保存中...' : '确认' }}
          </button>
        </div>
      </div>
    </LayoutDialog>

    <LayoutDialog v-model:open="deleteModalOpen" max-width="sm">
      <template #header>删除节点</template>
      <div class="flex flex-col gap-3">
        <div class="text-body-xs text-foreground">
          确认删除「{{ currentDeleteTargetName }}」吗？
        </div>
        <div v-if="currentDeleteCount > 1" class="text-body-xs text-danger">
          将同时删除 {{ currentDeleteCount - 1 }} 个下级节点
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-body-3xs rounded border border-outline-3 hover:bg-foundation"
            @click="cancelDelete"
          >
            取消
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-body-3xs rounded border border-danger text-danger hover:bg-danger-lighter disabled:opacity-60"
            :disabled="deleting"
            @click="confirmDelete"
          >
            {{ deleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </LayoutDialog>
  </div>
</template>

<script setup lang="ts">
import { graphql } from '~~/lib/common/generated/gql'
import { latestModelsPaginationQuery } from '~~/lib/projects/graphql/queries'
import { useApolloClient } from '@vue/apollo-composable'
import type { ProjectLatestModelsPaginationQuery } from '~~/lib/common/generated/gql/graphql'

type RawTreeItem = {
  id: string
  name: string
  parent: string | null
  projectId?: string
  createdAt?: string
  updatedAt?: string
  relative?: string[]
}

type VisibleRow = {
  id: string
  name: string
  level: number
  hasChildren: boolean
}

const props = defineProps({
  project: {
    type: Object,
    default: () => ({})
  },
  projectId: {
    type: String,
    default: ''
  }
})

const ROOT_ID = '__building_model_root__'
const ROOT_NAME = props.project?.name || '建筑模型'

const projectFoldersByParentQuery = graphql(`
  query ProjectFoldersByParent($projectId: String!, $parentId: String) {
    project(id: $projectId) {
      id
      folders(limit: 100, filter: { parentId: $parentId }) {
        items {
          id
          name
          projectId
          parentId
          createdAt
          updatedAt
          models {
            id
          }
        }
      }
    }
  }
`)

const createFolderMutation = graphql(`
  mutation CreateFolder($input: CreateFolderInput!) {
    folderMutations {
      create(input: $input) {
        id
      }
    }
  }
`)

const deleteFolderMutation = graphql(`
  mutation DeleteFolder($input: DeleteFolderInput!) {
    folderMutations {
      delete(input: $input)
    }
  }
`)

const addModelToFolderMutation = graphql(`
  mutation AddModelToFolder($input: AddModelToFolderInput!) {
    folderMutations {
      addModel(input: $input)
    }
  }
`)

const removeModelFromFolderMutation = graphql(`
  mutation RemoveModelFromFolder($input: RemoveModelFromFolderInput!) {
    folderMutations {
      removeModel(input: $input)
    }
  }
`)

const emit = defineEmits<{
  (e: 'update:selected-model-ids', val: string[] | null): void
}>()

const loading = ref(false)
const sourceItems = ref<RawTreeItem[]>([])
const expandedIds = ref<Set<string>>(new Set([ROOT_ID]))
const creatingForId = ref<string | null>(null)
const createModalOpen = ref(false)
const deletingForId = ref<string | null>(null)
const deleteModalOpen = ref(false)
const deleting = ref(false)
const relationModalOpen = ref(false)
const relatingForId = ref<string | null>(null)
const loadingRelationModels = ref(false)
const savingRelation = ref(false)
const relationSelectedIds = ref<string[]>([])
const relationModelOptions = ref<{ id: string; name: string }[]>([])
const newChildName = ref('')
const selectedId = ref<string>(ROOT_ID)
const apollo = useApolloClient().client

type RawTreeItemFromApi = {
  id: string
  name: string
  parentId: string | null
  projectId?: string
  createdAt?: string
  updatedAt?: string
  models?: Array<{ id: string }>
}

const normalizeItems = (payload: unknown): RawTreeItem[] => {
  const rows = (payload as RawTreeItemFromApi[]) || []

  return rows.map((item) => ({
    id: item.id,
    name: item.name,
    parent: item.parentId ?? null,
    projectId: item.projectId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    relative: (item.models || []).map((m) => m.id)
  }))
}

const childrenMap = computed(() => {
  const map = new Map<string, RawTreeItem[]>()
  const ensure = (key: string) => {
    if (!map.has(key)) map.set(key, [])
    return map.get(key) as RawTreeItem[]
  }

  ensure(ROOT_ID)
  sourceItems.value.forEach((item) => {
    const parentKey = item.parent || ROOT_ID
    ensure(parentKey).push(item)
  })

  return map
})

const visibleRows = computed<VisibleRow[]>(() => {
  const rows: VisibleRow[] = []

  const walk = (parentId: string, level: number) => {
    const children = childrenMap.value.get(parentId) || []
    children.forEach((child) => {
      const hasChildren = (childrenMap.value.get(child.id)?.length || 0) > 0
      rows.push({
        id: child.id,
        name: child.name,
        level,
        hasChildren
      })
      if (expandedIds.value.has(child.id)) {
        walk(child.id, level + 1)
      }
    })
  }

  const rootChildren = childrenMap.value.get(ROOT_ID) || []
  rows.push({
    id: ROOT_ID,
    name: ROOT_NAME,
    level: 0,
    hasChildren: rootChildren.length > 0
  })

  if (expandedIds.value.has(ROOT_ID)) {
    walk(ROOT_ID, 1)
  }

  return rows
})

const isExpanded = (id: string) => expandedIds.value.has(id)
const isSelected = (id: string) => selectedId.value === id
const emitSelectedModelIds = (id: string = selectedId.value) => {
  if (id === ROOT_ID) {
    emit('update:selected-model-ids', null)
    return
  }

  const ids = sourceItems.value.find((item) => item.id === id)?.relative || []
  emit('update:selected-model-ids', ids)
}

const selectRow = (id: string) => {
  selectedId.value = id
  emitSelectedModelIds(id)
}

const toggleExpand = (id: string) => {
  if (!visibleRows.value.find((row) => row.id === id)?.hasChildren) return
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
    expandedIds.value = new Set(expandedIds.value)
    return
  }
  expandedIds.value.add(id)
  expandedIds.value = new Set(expandedIds.value)
}

const startCreate = (parentId: string) => {
  creatingForId.value = parentId
  createModalOpen.value = true
  newChildName.value = ''
  expandedIds.value.add(parentId)
  expandedIds.value = new Set(expandedIds.value)
}

const currentRelationTargetName = computed(() => {
  if (!relatingForId.value) return ''
  return sourceItems.value.find((item) => item.id === relatingForId.value)?.name || ''
})

const loadRelationModelOptions = async () => {
  if (!props.projectId) return

  loadingRelationModels.value = true
  try {
    const rows: { id: string; name: string }[] = []
    let cursor: string | null = null

    while (true) {
      const res = (await apollo.query({
        query: latestModelsPaginationQuery,
        variables: {
          projectId: props.projectId,
          filter: null,
          cursor,
          limit: 100
        },
        fetchPolicy: 'no-cache'
      })) as { data?: ProjectLatestModelsPaginationQuery }

      const models = (res.data?.project?.models?.items || []) as Array<{
        id: string
        name: string
        displayName: string
      }>
      rows.push(
        ...models.map((model) => ({
          id: model.id,
          name: model.displayName || model.name
        }))
      )

      cursor = res.data?.project?.models?.cursor || null
      if (!cursor || models.length === 0) break
    }

    relationModelOptions.value = rows
  } finally {
    loadingRelationModels.value = false
  }
}

const startRelation = async (id: string) => {
  if (id === ROOT_ID) return
  relatingForId.value = id
  relationSelectedIds.value = [
    ...(sourceItems.value.find((item) => item.id === id)?.relative || [])
  ]
  relationModalOpen.value = true
  await loadRelationModelOptions()
}

const cancelRelation = () => {
  if (savingRelation.value) return
  relationModalOpen.value = false
  relatingForId.value = null
  relationSelectedIds.value = []
}

const toggleRelationModel = (modelId: string) => {
  if (relationSelectedIds.value.includes(modelId)) {
    relationSelectedIds.value = relationSelectedIds.value.filter((id) => id !== modelId)
    return
  }
  relationSelectedIds.value = [...relationSelectedIds.value, modelId]
}

const confirmRelation = async () => {
  if (!relatingForId.value) return

  savingRelation.value = true
  try {
    const targetFolder = sourceItems.value.find(
      (item) => item.id === relatingForId.value
    )
    const currentIds = new Set(targetFolder?.relative || [])
    const nextIds = new Set(relationSelectedIds.value)
    const idsToAdd = [...nextIds].filter((id) => !currentIds.has(id))
    const idsToRemove = [...currentIds].filter((id) => !nextIds.has(id))

    await Promise.all([
      ...idsToAdd.map((modelId) =>
        apollo.mutate({
          mutation: addModelToFolderMutation,
          variables: {
            input: {
              projectId: props.projectId,
              folderId: relatingForId.value!,
              modelId
            }
          }
        })
      ),
      ...idsToRemove.map((modelId) =>
        apollo.mutate({
          mutation: removeModelFromFolderMutation,
          variables: {
            input: {
              projectId: props.projectId,
              folderId: relatingForId.value!,
              modelId
            }
          }
        })
      )
    ])

    await getTree()
    if (selectedId.value === relatingForId.value) {
      emitSelectedModelIds(relatingForId.value)
    }
    cancelRelation()
  } finally {
    savingRelation.value = false
  }
}

const getDescendantIds = (parentId: string): string[] => {
  const result: string[] = []
  const children = childrenMap.value.get(parentId) || []

  children.forEach((child) => {
    result.push(child.id)
    result.push(...getDescendantIds(child.id))
  })

  return result
}

const startDelete = (id: string) => {
  if (id === ROOT_ID) return
  deletingForId.value = id
  deleteModalOpen.value = true
}

const closeDeleteModal = () => {
  deleteModalOpen.value = false
  deletingForId.value = null
}

const cancelDelete = () => {
  if (deleting.value) return
  closeDeleteModal()
}

const currentDeleteTargetName = computed(() => {
  if (!deletingForId.value) return ''
  return sourceItems.value.find((item) => item.id === deletingForId.value)?.name || ''
})

const currentDeleteCount = computed(() => {
  if (!deletingForId.value) return 0
  return 1 + getDescendantIds(deletingForId.value).length
})

const confirmDelete = async () => {
  if (!deletingForId.value) return

  deleting.value = true
  try {
    await apollo.mutate({
      mutation: deleteFolderMutation,
      variables: {
        input: {
          projectId: props.projectId,
          id: deletingForId.value
        }
      }
    })

    const deletedIdSet = new Set([
      deletingForId.value,
      ...getDescendantIds(deletingForId.value)
    ])
    await getTree()

    if (selectedId.value && deletedIdSet.has(selectedId.value)) {
      selectedId.value = ROOT_ID
      emitSelectedModelIds(ROOT_ID)
    }
    expandedIds.value = new Set(
      [...expandedIds.value].filter((id) => !deletedIdSet.has(id))
    )
    closeDeleteModal()
  } finally {
    deleting.value = false
  }
}

const cancelCreate = () => {
  createModalOpen.value = false
  creatingForId.value = null
  newChildName.value = ''
}

const currentCreateParentName = computed(() => {
  if (!creatingForId.value || creatingForId.value === ROOT_ID) return ROOT_NAME
  return (
    sourceItems.value.find((item) => item.id === creatingForId.value)?.name || ROOT_NAME
  )
})

const createChild = async () => {
  if (!newChildName.value || !creatingForId.value) return

  await apollo.mutate({
    mutation: createFolderMutation,
    variables: {
      input: {
        projectId: props.projectId,
        name: newChildName.value,
        parentId: creatingForId.value === ROOT_ID ? null : creatingForId.value
      }
    }
  })

  await getTree()
  cancelCreate()
}

const getTree = async () => {
  if (!props.projectId) return
  loading.value = true

  try {
    const rows: RawTreeItemFromApi[] = []

    const traverse = async (parentId: string | null) => {
      const res = await apollo.query({
        query: projectFoldersByParentQuery,
        variables: {
          projectId: props.projectId,
          parentId
        },
        fetchPolicy: 'no-cache'
      })

      const items = res.data?.project?.folders?.items || []
      rows.push(
        ...items.map((item) => ({
          id: item.id,
          name: item.name,
          parentId: item.parentId || null,
          projectId: item.projectId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          models: item.models || []
        }))
      )

      for (const folder of items) {
        await traverse(folder.id)
      }
    }

    await traverse(null)
    sourceItems.value = normalizeItems(rows)
  } finally {
    loading.value = false
  }
}

onMounted(getTree)
onMounted(() => emitSelectedModelIds(ROOT_ID))
</script>
