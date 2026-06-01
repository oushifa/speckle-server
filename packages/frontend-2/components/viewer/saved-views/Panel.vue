<template>
  <ViewerLayoutSidePanel disable-scrollbar class="relative" @close="$emit('close')">
    <template #title>
      <div class="flex justify-between items-center">
        <div>视图</div>
      </div>
    </template>
    <template #actions>
      <div class="flex items-center gap-0.5">
        <FormButton
          v-tippy="getTooltipProps('搜索视图')"
          size="sm"
          color="subtle"
          :icon-left="Search"
          hide-text
          @click="setSearchMode(true)"
        />
        <FormButton
          v-tippy="getTooltipProps('创建分组')"
          size="sm"
          color="subtle"
          :icon-left="FolderPlus"
          hide-text
          name="addGroup"
          :disabled="isLoading"
          @click="() => (showCreateGroupDialog = true)"
        />
        <FormButton
          v-tippy="getTooltipProps('创建视图')"
          size="sm"
          color="subtle"
          :icon-left="Plus"
          hide-text
          name="addView"
          :disabled="isLoading"
          @click="onAddView"
        />
      </div>
    </template>
    <template v-if="searchMode" #fullTitle>
      <div class="self-center w-full pr-1 flex gap-2 items-center">
        <FormTextInput
          v-bind="bind"
          name="search"
          placeholder="搜索视图..."
          color="foundation"
          auto-focus
          size="sm"
          wrapper-classes="flex-1 -ml-1"
          v-on="on"
        />
        <FormButton
          size="sm"
          color="subtle"
          :icon-left="X"
          hide-text
          name="disableSearch"
          @click="setSearchMode(false)"
        />
      </div>
    </template>
    <div class="px-2 pt-2">
      <ViewerButtonGroup>
        <ViewerButtonGroupButton
          v-for="viewsType in Object.values(ViewsType)"
          :key="viewsType"
          :is-active="selectedViewsType === viewsType"
          class="grow"
          @click="() => (selectedViewsType = viewsType)"
        >
          <span class="text-body-2xs text-foreground px-2 py-1">
            {{ viewsTypeLabels[viewsType] }}
          </span>
        </ViewerButtonGroupButton>
      </ViewerButtonGroup>
    </div>
    <div
      ref="groupsScrollArea"
      class="text-body-sm flex-1 min-h-0 overflow-y-auto simple-scrollbar"
    >
      <ViewerSavedViewsPanelGroups
        :views-type="selectedViewsType"
        :search="searchMode ? search || undefined : undefined"
      />
    </div>
    <ViewerSavedViewsPanelGroupsCreateDialog
      v-model:open="showCreateGroupDialog"
      @success="onAddGroup"
    />
  </ViewerLayoutSidePanel>
</template>
<script setup lang="ts">
import { useMutationLoading } from '@vue/apollo-composable'
import { Search, FolderPlus, Plus, X } from 'lucide-vue-next'
import { graphql } from '~/lib/common/generated/gql'
import { useCreateSavedView } from '~/lib/viewer/composables/savedViews/management'
import { useInjectedViewerState } from '~/lib/viewer/composables/setup'
import { ViewsType, viewsTypeLabels } from '~/lib/viewer/helpers/savedViews'
import { useDebouncedTextInput } from '@speckle/ui-components'
import { useKeepAliveScrollState } from '~/lib/common/composables/dom'

graphql(`
  fragment ViewerSavedViewsPanel_Project on Project {
    id
  }
`)

defineEmits<{
  close: []
}>()

const {
  resources: {
    response: { project }
  },
  ui: {
    savedViews: { openedGroupState }
  }
} = useInjectedViewerState()
const createSavedView = useCreateSavedView()
const isLoading = useMutationLoading()
const { on, bind, value: search } = useDebouncedTextInput()

const selectedViewsType = ref<ViewsType>(ViewsType.All)
const searchMode = ref(false)
const showCreateGroupDialog = ref(false)

const { getTooltipProps } = useSmartTooltipDelay()
useKeepAliveScrollState(useTemplateRef('groupsScrollArea'))
const onAddView = async () => {
  if (isLoading.value) return
  const view = await createSavedView({})
  if (view) {
    // Auto-open the group that the view created to
    openedGroupState.value.set(view.group.id, true)
  }
}

const onAddGroup = async (group: { id: string }) => {
  openedGroupState.value.set(group.id, true)
}

const setSearchMode = (val: boolean) => {
  if (val) {
    searchMode.value = true
  } else {
    searchMode.value = false
  }

  search.value = ''
}
</script>
