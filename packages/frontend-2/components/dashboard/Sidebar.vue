<!-- eslint-disable vuejs-accessibility/click-events-have-key-events -->
<!-- eslint-disable vuejs-accessibility/no-static-element-interactions -->
<template>
  <div class="group h-full bg-gradient-to-b from-[#2c3e50] to-[#34495e]">
    <template v-if="isLoggedIn">
      <Portal to="mobile-navigation">
        <div class="lg:hidden">
          <FormButton
            :color="isOpenMobile ? 'outline' : 'subtle'"
            size="sm"
            class="mt-px"
            @click="isOpenMobile = !isOpenMobile"
          >
            <IconSidebar v-if="!isOpenMobile" class="h-4 w-4 -ml-1 -mr-1" />
            <IconSidebarClose v-else class="h-4 w-4 -ml-1 -mr-1" />
          </FormButton>
        </div>
      </Portal>
      <div
        v-keyboard-clickable
        class="lg:hidden absolute inset-0 backdrop-blur-sm z-40 transition-all"
        :class="isOpenMobile ? 'opacity-100' : 'opacity-0 pointer-events-none'"
        @click="isOpenMobile = false"
      />
      <div
        class="absolute z-40 lg:static h-full flex w-[185px] shrink-0 transition-all"
        :class="isOpenMobile ? '' : '-translate-x-[185px] lg:translate-x-0'"
      >
        <div
          class="layout-sidebar-bg absolute left-0 w-full h-screen bg-no-repeat bottom-0 bg-[#2c3e50] z-[99] text-red-400 pointer-events-none"
        ></div>
        <LayoutSidebar class="border-outline-3 px-2 pt-3 pb-2">
          <LayoutSidebarMenu>
            <LayoutSidebarMenuGroup
              v-if="isWorkspacesEnabled && isLoggedIn"
              class="lg:hidden mb-4"
            >
              <HeaderWorkspaceSwitcher />
            </LayoutSidebarMenuGroup>

            <div class="flex flex-col gap-y-2 lg:gap-y-4">
              <LayoutSidebarMenuGroup>
                <NuxtLink
                  v-if="showWorkspaceLinks"
                  to="workbench"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem
                    :class="[
                      'py-2 mb-1',
                      isActive(workbenchRoute) && 'bg-slate-400 hover:!bg-slate-400',
                      'text-white',
                      'hover:bg-slate-300'
                    ]"
                    label="工作台"
                  >
                    <template #icon>
                      <IconHome class="size-4 text-white" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink>

                <NuxtLink
                  v-if="showWorkspaceLinks"
                  :to="projectsLink"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem
                    :class="[
                      'py-2 mb-1',
                      isActive(projectsRoute) && 'bg-slate-400 hover:!bg-slate-400',
                      'text-white',
                      'hover:bg-slate-300'
                    ]"
                    label="项目管理"
                  >
                    <template #icon>
                      <IconProjects class="size-4 text-white" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink>

                <NuxtLink
                  v-if="showWorkspaceLinks"
                  to="progress"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem
                    :class="[
                      'py-2 mb-1',
                      isActive(progressRoute) && 'bg-slate-400 hover:!bg-slate-400',
                      'text-white',
                      'hover:bg-slate-300'
                    ]"
                    label="进度管理"
                  >
                    <template #icon>
                      <IconProcess class="size-4 text-white" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink>

                <NuxtLink
                  v-if="showWorkspaceLinks"
                  to="quality-acceptance"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem
                    :class="[
                      'py-2 mb-1',
                      isActive(qualityAcceptanceRoute) &&
                        'bg-slate-400 hover:!bg-slate-400',
                      'text-white',
                      'hover:bg-slate-300'
                    ]"
                    label="质量验收"
                  >
                    <template #icon>
                      <IconCircleCheck class="size-4 text-white" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink>

                <NuxtLink
                  v-if="showWorkspaceLinks"
                  to="work-valuation"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem
                    :class="[
                      'py-2 mb-1',
                      isActive(workValuationRoute) &&
                        'bg-slate-400 hover:!bg-slate-400',
                      'text-white',
                      'hover:bg-slate-300'
                    ]"
                    label="验工计价"
                  >
                    <template #icon>
                      <IconCalculator class="size-4 text-white" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink>

                <NuxtLink
                  v-if="showWorkspaceLinks"
                  to="archives"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem
                    :class="[
                      'py-2 mb-1',
                      isActive(archivesRoute) && 'bg-slate-400 hover:!bg-slate-400',
                      'text-white',
                      'hover:bg-slate-300'
                    ]"
                    label="档案管理"
                  >
                    <template #icon>
                      <IconFile class="size-4 text-white" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink>
                <!-- <NuxtLink
                  v-if="showWorkspaceLinks && canListDashboards"
                  :to="dashboardsRoute(activeWorkspaceSlug)"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem
                    label="Intelligence"
                    :active="isActive(dashboardsRoute(activeWorkspaceSlug))"
                  >
                    <template #icon>
                      <LayoutDashboard class="size-4 text-foreground-2" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink> -->

                <!-- <NuxtLink :to="connectorsRoute" @click="isOpenMobile = false">
                  <LayoutSidebarMenuGroupItem
                    label="Connectors"
                    :active="isActive(connectorsRoute)"
                  >
                    <template #icon>
                      <IconConnectors class="size-4 text-foreground-2" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink> -->
              </LayoutSidebarMenuGroup>

              <!-- <LayoutSidebarMenuGroup title="资源" collapsible>
                <LayoutSidebarMenuGroupItem
                  v-if="isWorkspacesEnabled"
                  label="给我们反馈"
                  @click="openChat"
                >
                  <template #icon>
                    <IconFeedback class="size-4 text-foreground-2" />
                  </template>
                </LayoutSidebarMenuGroupItem>

                <NuxtLink :to="tutorialsRoute" @click="isOpenMobile = false">
                  <LayoutSidebarMenuGroupItem
                    label="教程"
                    :active="isActive(tutorialsRoute)"
                  >
                    <template #icon>
                      <IconTutorials class="size-4 text-foreground-2" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink>

                <NuxtLink
                  to="https://speckle.community/"
                  target="_blank"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem label="社区论坛" external>
                    <template #icon>
                      <IconCommunity class="size-4 text-foreground-2" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink>

                <NuxtLink
                  :to="docsPageUrl"
                  target="_blank"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem label="文档" external>
                    <template #icon>
                      <IconDocumentation class="size-4 text-foreground-2" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink>

                <NuxtLink
                  to="https://speckle.systems/updates"
                  target="_blank"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem label="更新日志" external>
                    <template #icon>
                      <IconChangelog class="size-4 text-foreground-2" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink>

                <div v-if="isWorkspacesEnabled">
                  <LayoutSidebarMenuGroupItem
                    label="入门指南"
                    @click="openExplainerVideoDialog"
                  >
                    <template #icon>
                      <IconPlay class="size-4 text-foreground-2" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                  <WorkspaceExplainerVideoDialog
                    v-model:open="showExplainerVideoDialog"
                  />
                </div>
              </LayoutSidebarMenuGroup> -->
            </div>
          </LayoutSidebarMenu>
          <template v-if="showSpeckleCon25Promo" #promo>
            <DashboardSpeckleConPromo />
          </template>
        </LayoutSidebar>
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import {
  FormButton,
  LayoutSidebar,
  LayoutSidebarMenu,
  LayoutSidebarMenuGroup,
  LayoutSidebarMenuGroupItem
} from '@speckle/ui-components'
import {
  projectsRoute,
  workspaceRoute,
  workbenchRoute,
  progressRoute,
  qualityAcceptanceRoute,
  workValuationRoute,
  archivesRoute
} from '~/lib/common/helpers/route'
import { useRoute } from 'vue-router'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { useMixpanel } from '~~/lib/core/composables/mp'
import { useActiveWorkspaceSlug } from '~/lib/user/composables/activeWorkspace'
import { graphql } from '~/lib/common/generated/gql'
import { useQuery } from '@vue/apollo-composable'
import dayjs from 'dayjs'
import { useActiveUserMeta } from '~/lib/user/composables/meta'

const dashboardSidebarQuery = graphql(`
  query DashboardSidebar {
    activeUser {
      id
      activeWorkspace {
        id
        role
      }
    }
  }
`)

const sidebarPermissionsQuery = graphql(`
  query SidebarPermissions($slug: String!) {
    workspaceBySlug(slug: $slug) {
      permissions {
        canListDashboards {
          ...FullPermissionCheckResult
        }
      }
    }
  }
`)

const { isLoggedIn } = useActiveUser()
const isWorkspacesEnabled = useIsWorkspacesEnabled()
const isDashboardsEnabled = useIsDashboardsModuleEnabled()
const route = useRoute()
const activeWorkspaceSlug = useActiveWorkspaceSlug()
const { $intercom } = useNuxtApp()
const mixpanel = useMixpanel()
const { result: permissionsResult } = useQuery(
  sidebarPermissionsQuery,
  () => ({
    slug: activeWorkspaceSlug.value || ''
  }),
  () => ({
    enabled: isDashboardsEnabled.value && !!activeWorkspaceSlug.value
  })
)
const { result } = useQuery(dashboardSidebarQuery, () => ({}), {
  enabled: isWorkspacesEnabled.value
})
const { hasDismissedSpeckleCon25Banner } = useActiveUserMeta()

const isOpenMobile = ref(false)
const showExplainerVideoDialog = ref(false)

const showSpeckleCon25Promo = computed(() => {
  if (hasDismissedSpeckleCon25Banner.value) return false
  return dayjs().isBefore('2025-11-07', 'day')
})
const activeWorkspace = computed(() => result.value?.activeUser?.activeWorkspace)
const canListDashboards = computed(() => {
  return permissionsResult.value?.workspaceBySlug?.permissions?.canListDashboards
    ?.authorized
})

const showWorkspaceLinks = computed(() => {
  return isWorkspacesEnabled.value
    ? activeWorkspace.value
      ? !!activeWorkspace.value?.role
      : true
    : isLoggedIn.value
})

const projectsLink = computed(() => {
  return isWorkspacesEnabled.value
    ? activeWorkspaceSlug.value
      ? workspaceRoute(activeWorkspaceSlug.value)
      : projectsRoute
    : projectsRoute
})

const workbenchLink = computed(() => {
  return isWorkspacesEnabled.value ? activeWorkspaceSlug.value : workbenchRoute
})

const openChat = () => {
  $intercom.show()
  isOpenMobile.value = false
}

const openExplainerVideoDialog = () => {
  showExplainerVideoDialog.value = true
  isOpenMobile.value = false
  mixpanel.track('Getting Started Video Opened', {
    location: 'sidebar'
  })
}

const isActive = (...routes: string[]): boolean => {
  return routes.some((routeTo) => route.path === routeTo)
}
</script>

<style scoped>
.layout-sidebar-bg {
  background: url('~~/assets/images/layout/side_bg.png');
  background-size: 100% 100%;
}
</style>
