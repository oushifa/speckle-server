<template>
  <div>
    <CommonAlert color="neutral" hide-icon class="mb-6 mt-2">
      <template #description>
        默认情况下，工作区成员可以查看所有项目。如果是 Viewer 席位，他们可以在 Web
        上查看项目并发表评论。如果是 Editor
        席位，他们可以在工作区中创建新项目，并在获得许可的情况下完全参与其他项目。
      </template>
    </CommonAlert>
    <SettingsWorkspacesMembersTableHeader
      v-model:search="search"
      v-model:role="roleFilter"
      v-model:seat-type="seatTypeFilter"
      search-placeholder="搜索成员..."
      :workspace="workspace"
      show-role-filter
      show-seat-filter
    />
    <LayoutTable
      class="mt-6 mb-12"
      :columns="[
        { id: 'name', header: '名称', classes: 'col-span-3' },
        { id: 'email', header: '邮箱', classes: 'col-span-4' },
        { id: 'seat', header: '席位', classes: 'col-span-2' },
        { id: 'joined', header: '加入时间', classes: 'col-span-2' },
        {
          id: 'actions',
          header: '',
          classes: 'col-span-1 flex items-center justify-end'
        }
      ]"
      :items="members"
      :loading="isVeryFirstLoading"
      :empty-message="
        search.length || seatTypeFilter || roleFilter ? '无结果' : '此工作区没有成员'
      "
    >
      <template #name="{ item }">
        <div class="flex items-center gap-2">
          <UserAvatar
            hide-tooltip
            :user="item.user"
            light-style
            class="bg-foundation"
            no-bg
          />
          <span class="truncate text-body-xs text-foreground">
            {{ item.user.name }}
            <span
              v-if="item.id === activeUser?.id"
              class="text-foreground-3 text-body-3xs"
            >
              (你)
            </span>
          </span>
          <CommonBadge
            v-if="item.role === Roles.Workspace.Admin"
            rounded
            color-classes="bg-highlight-3 text-foreground-2"
          >
            管理员
          </CommonBadge>
          <div
            v-if="
              item.user.workspaceDomainPolicyCompliant === false &&
              item.role !== Roles.Workspace.Guest
            "
            v-tippy="'此用户不符合此工作区设置的域名策略'"
          >
            <ExclamationCircleIcon class="text-danger w-5" />
          </div>
        </div>
      </template>
      <template #email="{ item }">
        <div class="flex">
          <span class="text-foreground truncate">
            {{ item.email }}
          </span>
        </div>
      </template>
      <template #seat="{ item }">
        <SettingsWorkspacesMembersTableSeatType
          :seat-type="item.seatType"
          :role="Roles.Workspace.Member"
        />
      </template>
      <template #joined="{ item }">
        <span class="text-foreground">{{ formattedFullDate(item.joinDate) }}</span>
      </template>
      <template #actions="{ item }">
        <SettingsWorkspacesMembersActionsMenu
          :target-user="item"
          :workspace="workspace"
          :initial-action="selectedAction[item.id]"
        />
      </template>
    </LayoutTable>
    <InfiniteLoading
      v-if="members?.length"
      :settings="{ identifier }"
      class="py-4"
      @infinite="onInfiniteLoad"
    />
    <SettingsWorkspacesMembersActionsProjectPermissionsDialog
      v-model:open="showProjectPermissionsDialog"
      :user="targetUser"
      :workspace-id="workspace?.id || ''"
    />
  </div>
</template>

<script setup lang="ts">
import { Roles, type Nullable, type WorkspaceRoles } from '@speckle/shared'
import {
  settingsWorkspacesMembersSearchQuery,
  settingsWorkspacesMembersTableQuery
} from '~~/lib/settings/graphql/queries'
import type {
  WorkspaceSeatType,
  SettingsWorkspacesMembersActionsMenu_UserFragment
} from '~~/lib/common/generated/gql/graphql'
import { graphql } from '~/lib/common/generated/gql'
import { ExclamationCircleIcon } from '@heroicons/vue/24/outline'
import type { WorkspaceUserActionTypes } from '~/lib/settings/helpers/types'
import { usePaginatedQuery } from '~/lib/common/composables/graphql'
import { useQuery } from '@vue/apollo-composable'

graphql(`
  fragment SettingsWorkspacesMembersTable_WorkspaceCollaborator on WorkspaceCollaborator {
    id
    email
    ...SettingsWorkspacesMembersActionsMenu_User
  }
`)

const props = defineProps<{
  workspaceSlug: string
}>()

const { activeUser } = useActiveUser()
const { result } = useQuery(settingsWorkspacesMembersTableQuery, () => ({
  slug: props.workspaceSlug
}))
const { formattedFullDate } = useDateFormatters()

const selectedAction = ref<Record<string, WorkspaceUserActionTypes>>({})
const search = ref('')
const roleFilter = ref<WorkspaceRoles>()
const seatTypeFilter = ref<WorkspaceSeatType>()
const showProjectPermissionsDialog = ref(false)
const targetUser = ref<SettingsWorkspacesMembersActionsMenu_UserFragment | undefined>(
  undefined
)

const defaultRoles = shallowRef([Roles.Workspace.Admin, Roles.Workspace.Member])

const {
  identifier,
  onInfiniteLoad,
  query: { result: membersResult },
  isVeryFirstLoading
} = usePaginatedQuery({
  query: settingsWorkspacesMembersSearchQuery,
  baseVariables: computed(() => ({
    limit: 10,
    slug: props.workspaceSlug,
    filter: {
      search: search.value,
      roles: roleFilter.value ? [roleFilter.value] : defaultRoles.value,
      seatType: seatTypeFilter.value
    },
    cursor: null as Nullable<string>
  })),
  resolveKey: (vars) => ({
    slug: vars.slug,
    filter: vars.filter
  }),
  resolveCurrentResult: (res) => res?.workspaceBySlug.team,
  resolveNextPageVariables: (baseVars, cursor) => ({
    ...baseVars,
    cursor
  }),
  resolveCursorFromVariables: (vars) => vars.cursor
})

const workspace = computed(() => result.value?.workspaceBySlug)
const members = computed(() => membersResult.value?.workspaceBySlug.team.items)
</script>
