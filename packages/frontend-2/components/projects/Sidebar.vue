<!-- eslint-disable vuejs-accessibility/click-events-have-key-events -->
<!-- eslint-disable vuejs-accessibility/no-static-element-interactions -->
<template>
  <div class="group h-full">
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
        class="absolute z-40 lg:static h-full flex w-[13rem] shrink-0 transition-all"
        :class="isOpenMobile ? '' : '-translate-x-[13rem] lg:translate-x-0'"
      >
        <LayoutSidebar
          class="border-r border-outline-3 px-2 pt-3 pb-2 bg-gradient-to-b from-[#2c3e50] to-[#1a252f]"
        >
          <LayoutSidebarMenu>
            <LayoutSidebarMenuGroup class="hidden lg:block lg:mb-4">
              <NuxtLink to="/projects" class="items-center gap-x-1.5 px-2.5 flex">
                <ChevronLeftIcon class="h-3 w-3 text-white" />
                <p class="text-body-xs font-medium text-white">返回项目管理</p>
              </NuxtLink>
            </LayoutSidebarMenuGroup>
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
                  :to="projectBaseRoutePath + '/workbench'"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem
                    :class="[
                      isProjectActive('/workbench') &&
                        'bg-slate-400 hover:!bg-slate-400',
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

                <LayoutSidebarMenuGroup
                  title="模型管理"
                  collapsible
                  :no-hover="true"
                  title-class="text-white/80"
                  arrow-class="text-white/80"
                >
                  <template #title-icon>
                    <IconModelfiles class="size-4 text-white" />
                  </template>
                  <NuxtLink
                    v-if="showWorkspaceLinks"
                    :to="projectBaseRoutePath + '/model-list'"
                    @click="isOpenMobile = false"
                  >
                    <LayoutSidebarMenuGroupItem
                      :class="[
                        isProjectActive('/model-list') &&
                          'bg-slate-400 hover:!bg-slate-400',
                        'text-white',
                        'hover:bg-slate-300'
                      ]"
                      label="文件管理"
                    ></LayoutSidebarMenuGroupItem>
                  </NuxtLink>
                  <NuxtLink
                    v-if="showWorkspaceLinks"
                    :to="projectBaseRoutePath + '/collaborate'"
                    @click="isOpenMobile = false"
                  >
                    <LayoutSidebarMenuGroupItem
                      :class="[
                        isProjectActive('/collaborate') &&
                          'bg-slate-400 hover:!bg-slate-400',
                        'text-white',
                        'hover:bg-slate-300'
                      ]"
                      label="协同管理"
                    ></LayoutSidebarMenuGroupItem>
                  </NuxtLink>
                </LayoutSidebarMenuGroup>

                <LayoutSidebarMenuGroup
                  title="进度管理"
                  collapsible
                  :no-hover="true"
                  title-class="text-white/80"
                  arrow-class="text-white/80"
                >
                  <template #title-icon>
                    <IconProgress class="size-4 text-white" />
                  </template>
                  <NuxtLink
                    v-if="showWorkspaceLinks"
                    :to="projectBaseRoutePath + '/progress/schedule'"
                    @click="isOpenMobile = false"
                  >
                    <LayoutSidebarMenuGroupItem
                      :class="[
                        isProjectActive('/progress/schedule') &&
                          'bg-slate-400 hover:!bg-slate-400',
                        'text-white',
                        'hover:bg-slate-300'
                      ]"
                      label="进度计划"
                    ></LayoutSidebarMenuGroupItem>
                  </NuxtLink>
                  <NuxtLink
                    v-if="showWorkspaceLinks"
                    :to="projectBaseRoutePath + '/progress/actual'"
                    @click="isOpenMobile = false"
                  >
                    <LayoutSidebarMenuGroupItem
                      :class="[
                        isProjectActive('/progress/actual') &&
                          'bg-slate-400 hover:!bg-slate-400',
                        'text-white',
                        'hover:bg-slate-300'
                      ]"
                      label="实际进度"
                    ></LayoutSidebarMenuGroupItem>
                  </NuxtLink>
                  <NuxtLink
                    v-if="showWorkspaceLinks"
                    :to="projectBaseRoutePath + '/progress/physical'"
                    @click="isOpenMobile = false"
                  >
                    <LayoutSidebarMenuGroupItem
                      :class="[
                        isProjectActive('/progress/physical') &&
                          'bg-slate-400 hover:!bg-slate-400',
                        'text-white',
                        'hover:bg-slate-300'
                      ]"
                      label="形象进度"
                    ></LayoutSidebarMenuGroupItem>
                  </NuxtLink>
                </LayoutSidebarMenuGroup>

                <NuxtLink
                  v-if="showWorkspaceLinks"
                  :to="projectBaseRoutePath + '/quality-acceptance'"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem
                    :class="[
                      isProjectActive('/quality-acceptance') &&
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

                <LayoutSidebarMenuGroup
                  title="验工计价"
                  collapsible
                  :no-hover="true"
                  title-class="text-white/80"
                  arrow-class="text-white/80"
                >
                  <template #title-icon>
                    <IconCalculator class="size-4 text-white" />
                  </template>
                  <NuxtLink
                    v-if="showWorkspaceLinks"
                    :to="projectBaseRoutePath + '/work-valuation/BOQ'"
                    @click="isOpenMobile = false"
                  >
                    <LayoutSidebarMenuGroupItem
                      :class="[
                        isProjectActive('/work-valuation/BOQ') &&
                          'bg-slate-400 hover:!bg-slate-400',
                        'text-white',
                        'hover:bg-slate-300'
                      ]"
                      label="清单管理"
                    ></LayoutSidebarMenuGroupItem>
                  </NuxtLink>
                  <NuxtLink
                    v-if="showWorkspaceLinks"
                    :to="projectBaseRoutePath + '/work-valuation/monthly-measurement'"
                    @click="isOpenMobile = false"
                  >
                    <LayoutSidebarMenuGroupItem
                      :class="[
                        isProjectActive('/work-valuation/monthly-measurement') &&
                          'bg-slate-400 hover:!bg-slate-400',
                        'text-white',
                        'hover:bg-slate-300'
                      ]"
                      label="月度验工"
                    ></LayoutSidebarMenuGroupItem>
                  </NuxtLink>
                </LayoutSidebarMenuGroup>

                <LayoutSidebarMenuGroup
                  title="档案管理"
                  collapsible
                  :no-hover="true"
                  title-class="text-white/80"
                  arrow-class="text-white/80"
                >
                  <template #title-icon>
                    <IconFile class="size-4 text-white" />
                  </template>
                  <NuxtLink
                    v-if="showWorkspaceLinks"
                    :to="projectBaseRoutePath + '/archive/model-to-site'"
                    @click="isOpenMobile = false"
                  >
                    <LayoutSidebarMenuGroupItem
                      :class="[
                        isProjectActive('/archive/model-to-site') &&
                          'bg-slate-400 hover:!bg-slate-400',
                        'text-white',
                        'hover:bg-slate-300'
                      ]"
                      label="实模一致性检查"
                    ></LayoutSidebarMenuGroupItem>
                  </NuxtLink>
                  <NuxtLink
                    v-if="showWorkspaceLinks"
                    :to="projectBaseRoutePath + '/archive/archives'"
                    @click="isOpenMobile = false"
                  >
                    <LayoutSidebarMenuGroupItem
                      :class="[
                        isProjectActive('/archive/archives') &&
                          'bg-slate-400 hover:!bg-slate-400',
                        'text-white',
                        'hover:bg-slate-300'
                      ]"
                      label="档案管理"
                    ></LayoutSidebarMenuGroupItem>
                  </NuxtLink>
                </LayoutSidebarMenuGroup>
              </LayoutSidebarMenuGroup>
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
  workbenchRoute
} from '~/lib/common/helpers/route'
import { useRoute } from 'vue-router'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { useActiveWorkspaceSlug } from '~/lib/user/composables/activeWorkspace'
import { graphql } from '~/lib/common/generated/gql'
import { useQuery } from '@vue/apollo-composable'
import dayjs from 'dayjs'
import { useActiveUserMeta } from '~/lib/user/composables/meta'
import { ChevronLeftIcon } from '@heroicons/vue/24/outline'

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

const { isLoggedIn } = useActiveUser()
const isWorkspacesEnabled = useIsWorkspacesEnabled()
const route = useRoute()
const activeWorkspaceSlug = useActiveWorkspaceSlug()

const { result } = useQuery(dashboardSidebarQuery, () => ({}), {
  enabled: isWorkspacesEnabled.value
})
const { hasDismissedSpeckleCon25Banner } = useActiveUserMeta()

const isOpenMobile = ref(false)

const showSpeckleCon25Promo = computed(() => {
  if (hasDismissedSpeckleCon25Banner.value) return false
  return dayjs().isBefore('2025-11-07', 'day')
})
const activeWorkspace = computed(() => result.value?.activeUser?.activeWorkspace)

const showWorkspaceLinks = computed(() => {
  return isWorkspacesEnabled.value
    ? activeWorkspace.value
      ? !!activeWorkspace.value?.role
      : true
    : isLoggedIn.value
})

const _projectsLink = computed(() => {
  return isWorkspacesEnabled.value
    ? activeWorkspaceSlug.value
      ? workspaceRoute(activeWorkspaceSlug.value)
      : projectsRoute
    : projectsRoute
})

const workbenchLink = computed(() => {
  return isWorkspacesEnabled.value ? activeWorkspaceSlug.value : workbenchRoute
})

const projectBaseRoute = computed(() => {
  const projectId = route.params.id as string | undefined
  return projectId ? `/projects/${projectId}` : null
})

const projectBaseRoutePath = computed(() => {
  return projectBaseRoute.value || projectsRoute
})

const isProjectActive = (suffix = ''): boolean => {
  const base = projectBaseRoute.value
  if (!base) return false
  const fullPath = `${base}${suffix}`
  return route.path === fullPath
}

const isActive = (...routes: string[]): boolean => {
  return routes.some((routeTo) => route.path === routeTo)
}
</script>
