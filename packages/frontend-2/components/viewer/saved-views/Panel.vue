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
        <div v-tippy="canCreateViewOrGroup?.errorMessage" class="flex items-center">
          <FormButton
            v-tippy="getTooltipProps('创建分组')"
            size="sm"
            color="subtle"
            :icon-left="FolderPlus"
            hide-text
            name="addGroup"
            :disabled="!canCreateViewOrGroup?.authorized || isLoading"
            @click="() => (showCreateGroupDialog = true)"
          />
        </div>
        <div v-tippy="canCreateViewOrGroup?.errorMessage" class="flex items-center">
          <FormButton
            v-tippy="getTooltipProps('创建视图')"
            size="sm"
            color="subtle"
            :icon-left="Plus"
            hide-text
            name="addView"
            :disabled="!canCreateViewOrGroup?.authorized || isLoading"
            @click="onAddView"
          />
        </div>
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
    <div
      v-if="isViewerSeat && !hideViewerSeatDisclaimer"
      class="absolute bottom-0 left-0 right-0 p-2"
    >
      <CommonPromoAlert
        title="保存您的视图"
        text="使用 Editor 席位解锁保存视图的功能。工作区管理员可以更新您的席位类型。"
        show-closer
        @close="hideViewerSeatDisclaimer = true"
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
import { useSynchronizedCookie } from '~/lib/common/composables/reactiveCookie'
import { graphql } from '~/lib/common/generated/gql'
import { WorkspaceSeatType } from '~/lib/common/generated/gql/graphql'
import { useCreateSavedView } from '~/lib/viewer/composables/savedViews/management'
import { useInjectedViewerState } from '~/lib/viewer/composables/setup'
import { ViewsType, viewsTypeLabels } from '~/lib/viewer/helpers/savedViews'
import { useDebouncedTextInput } from '@speckle/ui-components'
import { useKeepAliveScrollState } from '~/lib/common/composables/dom'

graphql(`
  fragment ViewerSavedViewsPanel_Project on Project {
    id
    permissions {
      canCreateSavedView {
        ...FullPermissionCheckResult
      }
    }
    workspace {
      id
      seatType
      planSupportsSavedViews: hasAccessToFeature(featureName: savedViews)
    }
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
const hideViewerSeatDisclaimer = useSynchronizedCookie<boolean>(
  'hideViewerSeatSavedViewsDisclaimer',
  {
    default: () => false
  }
)
const searchMode = ref(false)
const showCreateGroupDialog = ref(false)

const { getTooltipProps } = useSmartTooltipDelay()
useKeepAliveScrollState(useTemplateRef('groupsScrollArea'))

const canCreateViewOrGroup = computed(
  () => project.value?.permissions.canCreateSavedView
)
const isViewerSeat = computed(
  () => project.value?.workspace?.seatType === WorkspaceSeatType.Viewer
)
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
