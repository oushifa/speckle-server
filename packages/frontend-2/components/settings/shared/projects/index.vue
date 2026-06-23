<template>
  <div>
    <div class="flex flex-col-reverse md:justify-between md:flex-row md:gap-x-4">
      <div class="relative w-full md:max-w-md mt-6 md:mt-0">
        <FormTextInput
          name="search"
          :custom-icon="MagnifyingGlassIcon"
          color="foundation"
          search
          placeholder="搜索项目"
          v-bind="bind"
          v-on="on"
        />
      </div>
      <div v-tippy="createDisabledTooltip">
        <FormButton :disabled="isCreateDisabled" @click="openNewProject = true">
          创建项目
        </FormButton>
      </div>
    </div>

    <LayoutTable
      class="mt-6"
      :columns="[
        { id: 'name', header: '项目名称', classes: 'col-span-2 truncate' },
        { id: 'created', header: '创建时间', classes: 'col-span-2' },
        { id: 'visibility', header: '可见性', classes: 'col-span-2' },
        { id: 'modified', header: '修改时间', classes: 'col-span-2' },
        { id: 'models', header: '模型数量', classes: 'col-span-1' },
        { id: 'versions', header: '版本数量', classes: 'col-span-1' },
        { id: 'contributors', header: '项目成员', classes: 'col-span-2 pr-8' },
        { id: 'actions', header: '', classes: 'absolute right-2 top-0.5' }
      ]"
      :items="projects"
    >
      <template #name="{ item }">
        <div v-tippy="item.name" class="truncate">
          <NuxtLink :to="projectRoute(item.id)">
            {{ isProject(item) ? item.name : '' }}
          </NuxtLink>
        </div>
      </template>

      <template #created="{ item }">
        <div v-tippy="formattedFullDate(item.createdAt)" class="text-xs inline-block">
          {{ formattedDateOnly(item.createdAt) }}
        </div>
      </template>

      <template #visibility="{ item }">
        <div class="text-xs capitalize">
          {{ item.visibility.toLowerCase() }}
        </div>
      </template>

      <template #modified="{ item }">
        <div v-tippy="formattedFullDate(item.updatedAt)" class="text-xs inline-block">
          {{ formattedDateOnly(item.updatedAt) }}
        </div>
      </template>

      <template #models="{ item }">
        <div class="text-xs">
          {{ isProject(item) ? item.models.totalCount : '' }}
        </div>
      </template>

      <template #versions="{ item }">
        <div class="text-xs">
          {{ isProject(item) ? item.versions.totalCount : '' }}
        </div>
      </template>

      <template #contributors="{ item }">
        <div v-if="isProject(item)">
          <UserAvatarGroup :users="mergedProjectMemberUsers(item)" :max-count="3" />
        </div>
      </template>

      <template #actions="{ item }">
        <LayoutMenu
          v-model:open="showActionsMenu[item.id]"
          :items="actionItems[item.id]"
          mount-menu-on-body
          :menu-position="HorizontalDirection.Left"
          :menu-id="menuId"
          @chosen="({ item: actionItem }) => onActionChosen(actionItem, item)"
        >
          <FormButton
            :color="showActionsMenu[item.id] ? 'outline' : 'subtle'"
            hide-text
            :icon-right="showActionsMenu[item.id] ? XMarkIcon : EllipsisHorizontalIcon"
            @click.stop="toggleMenu(item.id)"
          />
        </LayoutMenu>
      </template>
    </LayoutTable>

    <ProjectsDeleteDialog
      v-if="projectToModify"
      v-model:open="showProjectDeleteDialog"
      :project="projectToModify"
    />

    <LayoutDialog
      v-if="projectToEditMembers"
      v-model:open="showEditMembersDialog"
      max-width="md"
      :buttons="editMembersDialogButtons"
    >
      <template #header>编辑项目成员</template>
      <div class="grid gap-4">
        <div>
          <p class="text-body-xs text-foreground font-medium">
            {{ projectToEditMembers.name }}
          </p>
          <p class="text-body-2xs text-foreground-2 mt-1">
            选择用户后会直接授予该项目权限，无需对方接受邀请。
          </p>
        </div>

        <div class="grid gap-2">
          <div class="text-body-2xs text-foreground-2">
            当前成员 {{ currentProjectMemberUsers.length }} 人
          </div>
          <UserAvatarGroup :users="currentProjectMemberUsers" :max-count="8" />
        </div>

        <FormSelectUsers
          v-model="selectedUsersToAdd"
          :users="availableUsersToAdd"
          multiple
          search
          label="选择用户"
          show-label
          selector-placeholder="请选择用户"
          search-placeholder="搜索用户"
          :disabled="loadingUsers || addingProjectMembers"
        />

        <p
          v-if="!loadingUsers && !availableUsersToAdd.length"
          class="text-body-2xs text-foreground-2"
        >
          没有可添加的用户。
        </p>
      </div>
    </LayoutDialog>

    <ProjectsAdd
      v-model:open="openNewProject"
      :workspace="workspace"
      @created="onProjectCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { HorizontalDirection } from '~~/lib/common/composables/window'
import type {
  FormUsersSelectItemFragment,
  SettingsSharedProjects_ProjectFragment,
  ProjectsDeleteDialog_ProjectFragment,
  SettingsSharedProjects_WorkspaceFragment,
  AdminPanelUsersListQuery
} from '~~/lib/common/generated/gql/graphql'
import {
  MagnifyingGlassIcon,
  EllipsisHorizontalIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { isProject } from '~~/lib/server-management/helpers/utils'
import {
  useDebouncedTextInput,
  type LayoutMenuItem,
  type LayoutDialogButton
} from '@speckle/ui-components'
import { graphql } from '~/lib/common/generated/gql'
import { useRouter } from 'vue-router'
import { projectRoute, useNavigateToProject } from '~/lib/common/helpers/route'
import { useCanCreatePersonalProject } from '~/lib/projects/composables/permissions'
import { useInviteUserToProject } from '~~/lib/projects/composables/projectManagement'
import { useCanCreateWorkspaceProject } from '~/lib/workspaces/composables/projects/permissions'
import { getUsersQuery } from '~~/lib/server-management/graphql/queries'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { useQuery } from '@vue/apollo-composable'
import { type MaybeNullOrUndefined, Roles } from '@speckle/shared'

graphql(`
  fragment SettingsSharedProjects_Project on Project {
    ...ProjectsDeleteDialog_Project
    id
    name
    visibility
    createdAt
    updatedAt
    models(limit: 0) {
      totalCount
    }
    versions(limit: 0) {
      totalCount
    }
    team {
      id
      user {
        name
        id
        avatar
      }
    }
    permissions {
      canDelete {
        ...FullPermissionCheckResult
      }
      canReadSettings {
        ...FullPermissionCheckResult
      }
      canRead {
        ...FullPermissionCheckResult
      }
    }
  }
`)

graphql(`
  fragment SettingsSharedProjects_Workspace on Workspace {
    id
    ...ProjectsAdd_Workspace
  }
`)

const props = defineProps<{
  workspaceId: MaybeNullOrUndefined<string>
  projects: MaybeNullOrUndefined<SettingsSharedProjects_ProjectFragment[]>
  workspace: MaybeNullOrUndefined<SettingsSharedProjects_WorkspaceFragment>
}>()

const { formattedFullDate, formattedDateOnly } = useDateFormatters()
const navigateToProject = useNavigateToProject()
const { activeUser } = useActiveUser()
const { triggerNotification } = useGlobalToast()
const canCreatePersonal = useCanCreatePersonalProject({
  activeUser: computed(() => activeUser.value)
})

const canCreateWorkspace = useCanCreateWorkspaceProject({
  workspace: computed(() => props.workspace)
})

const isCreateDisabled = computed(() => {
  if (props.workspaceId) {
    return !canCreateWorkspace.canClickCreate.value
  }

  return !canCreatePersonal.canClickCreate.value
})
const createDisabledTooltip = computed(() => {
  if (props.workspaceId) {
    return canCreateWorkspace.cantClickCreateReason.value
  }

  return canCreatePersonal.cantClickCreateReason.value
})

const search = defineModel<string>('search')
const { on, bind } = useDebouncedTextInput({ model: search })
const router = useRouter()
const menuId = useId()
const inviteUsersToProject = useInviteUserToProject()

const projectToModify = ref<ProjectsDeleteDialog_ProjectFragment | null>(null)
const showProjectDeleteDialog = ref(false)
const openNewProject = ref(false)
const showEditMembersDialog = ref(false)
const projectToEditMembers = ref<SettingsSharedProjects_ProjectFragment | null>(null)
const selectedUsersToAdd = ref<FormUsersSelectItemFragment[]>([])
const addingProjectMembers = ref(false)
const addedProjectMembers = ref<Record<string, FormUsersSelectItemFragment[]>>({})

const { result: usersResult, loading: loadingUsers } = useQuery(
  getUsersQuery,
  () => ({
    limit: 500,
    cursor: null,
    query: null
  }),
  () => ({
    enabled: showEditMembersDialog.value
  })
)

const allUsers = computed((): FormUsersSelectItemFragment[] => {
  const items = usersResult.value?.admin.userList.items || []
  return items.map((user: AdminPanelUsersListQuery['admin']['userList']['items'][number]) => ({
    id: user.id,
    name: user.name,
    avatar: user.avatar
  }))
})

const openProjectDeleteDialog = (item: ProjectsDeleteDialog_ProjectFragment) => {
  projectToModify.value = item
  showProjectDeleteDialog.value = true
}

const openEditMembersDialog = (project: SettingsSharedProjects_ProjectFragment) => {
  projectToEditMembers.value = project
  selectedUsersToAdd.value = []
  showEditMembersDialog.value = true
}

const handleProjectClick = (id: string) => {
  router.push(projectRoute(id))
}

enum ActionTypes {
  ViewProject = 'view-project',
  EditMembers = 'edit-members',
  DeleteProject = 'delete-project'
}

const mergedProjectMemberUsers = (
  project: SettingsSharedProjects_ProjectFragment
): FormUsersSelectItemFragment[] => {
  const existingUsers = project.team.map((member) => member.user)
  const optimisticUsers = addedProjectMembers.value[project.id] || []

  return [...existingUsers, ...optimisticUsers].reduce<FormUsersSelectItemFragment[]>(
    (acc, user) => {
      if (!acc.some((item) => item.id === user.id)) acc.push(user)
      return acc
    },
    []
  )
}

const currentProjectMemberUsers = computed(() => {
  if (!projectToEditMembers.value) return []
  return mergedProjectMemberUsers(projectToEditMembers.value)
})

const availableUsersToAdd = computed(() => {
  const existingIds = new Set(currentProjectMemberUsers.value.map((user) => user.id))
  return allUsers.value.filter((user) => !existingIds.has(user.id))
})

const addMembersToProject = async () => {
  if (!projectToEditMembers.value || !selectedUsersToAdd.value.length) {
    showEditMembersDialog.value = false
    return
  }

  addingProjectMembers.value = true

  try {
    await inviteUsersToProject(
      projectToEditMembers.value.id,
      selectedUsersToAdd.value.map((user) => ({
        userId: user.id,
        role: Roles.Stream.Reviewer
      })),
      { hideToasts: true }
    )

    addedProjectMembers.value = {
      ...addedProjectMembers.value,
      [projectToEditMembers.value.id]: [
        ...(addedProjectMembers.value[projectToEditMembers.value.id] || []),
        ...selectedUsersToAdd.value
      ].reduce<FormUsersSelectItemFragment[]>((acc, user) => {
        if (!acc.some((item) => item.id === user.id)) acc.push(user)
        return acc
      }, [])
    }

    triggerNotification({
      type: ToastNotificationType.Success,
      title:
        selectedUsersToAdd.value.length === 1
          ? '项目成员已添加'
          : `已添加 ${selectedUsersToAdd.value.length} 个项目成员`
    })

    showEditMembersDialog.value = false
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '添加项目成员失败',
      description: error instanceof Error ? error.message : undefined
    })
  } finally {
    addingProjectMembers.value = false
  }
}

const editMembersDialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      showEditMembersDialog.value = false
    }
  },
  {
    text: '添加成员',
    props: { color: 'primary' },
    disabled: !selectedUsersToAdd.value.length || addingProjectMembers.value,
    onClick: () => {
      void addMembersToProject()
    }
  }
])

const showActionsMenu = ref<Record<string, boolean>>({})

const actionItems = computed((): { [projectId: string]: LayoutMenuItem[][] } =>
  (props.projects || []).reduce((ret, project) => {
    const canRead = project.permissions.canRead
    const canDelete = project.permissions.canDelete
    const canReadSettings = project.permissions.canReadSettings

    ret[project.id] = [
      [
        {
          title: '查看项目',
          id: ActionTypes.ViewProject,
          disabled: !canRead?.authorized,
          disabledTooltip: canRead?.message
        },
        {
          title: '编辑成员',
          id: ActionTypes.EditMembers,
          disabled: !canReadSettings?.authorized,
          disabledTooltip: canReadSettings?.message
        },
        {
          title: '删除项目...',
          id: ActionTypes.DeleteProject,
          disabled: !canDelete?.authorized,
          disabledTooltip: canDelete?.message
        }
      ]
    ]
    return ret
  }, {} as { [projectId: string]: LayoutMenuItem[][] })
)

const onActionChosen = (
  actionItem: LayoutMenuItem,
  project: ProjectsDeleteDialog_ProjectFragment
) => {
  if (actionItem.id === ActionTypes.EditMembers) {
    openEditMembersDialog(project as SettingsSharedProjects_ProjectFragment)
  } else if (actionItem.id === ActionTypes.ViewProject) {
    handleProjectClick(project.id)
  } else if (actionItem.id === ActionTypes.DeleteProject) {
    openProjectDeleteDialog(project)
  }
}

const toggleMenu = (itemId: string) => {
  showActionsMenu.value[itemId] = !showActionsMenu.value[itemId]
}

const onProjectCreated = (project: { id: string }) => {
  navigateToProject({ id: project.id })
}

watch(showEditMembersDialog, (isOpen) => {
  if (!isOpen) {
    projectToEditMembers.value = null
    selectedUsersToAdd.value = []
  }
})
</script>
