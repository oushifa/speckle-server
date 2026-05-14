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
        class="absolute z-40 lg:static h-full flex w-64 shrink-0 transition-all"
        :class="isOpenMobile ? '' : '-translate-x-64 lg:translate-x-0'"
      >
        <div
          class="layout-sidebar-bg absolute left-0 w-full h-screen bg-no-repeat bottom-0 bg-[#2c3e50] z-[99] text-red-400 pointer-events-none"
        ></div>
        <LayoutSidebar
          class="project-sidebar border-outline-3 px-2 pt-3 pb-2 bg-gradient-to-b from-[#2c3e50] to-[#1a252f]"
        >
          <LayoutSidebarMenu>
            <LayoutSidebarMenuGroup
              v-if="isWorkspacesEnabled && isLoggedIn"
              class="lg:hidden mb-4"
            >
              <HeaderWorkspaceSwitcher />
            </LayoutSidebarMenuGroup>

            <div class="project-sidebar-menu-stack flex flex-col gap-y-1">
              <LayoutSidebarMenuGroup>
                <NuxtLink
                  v-if="showWorkspaceLinks"
                  :to="projectBaseRoutePath + '/workbench'"
                  @click="isOpenMobile = false"
                >
                  <LayoutSidebarMenuGroupItem
                    :class="[
                      'project-sidebar-top-item',
                      'py-3',
                      isProjectActive('/workbench') &&
                        'bg-white/10 hover:!bg-white/10 border-l-4 border-blue-400',
                      'text-white/80 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                    ]"
                    label="工作台"
                  >
                    <template #icon>
                      <IconHome class="size-4 text-white" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink>

                <LayoutSidebarMenuGroup
                  :class="[
                    'project-sidebar-group-wrapper',
                    isProjectSectionActive(['/model-list', '/workbench/discussions']) &&
                      'project-sidebar-group-wrapper-active'
                  ]"
                  title="模型管理"
                  collapsible
                  :no-hover="true"
                  title-class="project-sidebar-group-title text-white/80"
                  arrow-class="project-sidebar-group-arrow text-white/80"
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
                        'py-2',
                        isProjectActive('/model-list') &&
                          'bg-white/10 hover:!bg-white/10 border-l-4 border-blue-400',
                        'text-white/80 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                      ]"
                      extra-padding
                      label="文件管理"
                    ></LayoutSidebarMenuGroupItem>
                  </NuxtLink>
                  <NuxtLink
                    v-if="showWorkspaceLinks"
                    :to="projectBaseRoutePath + '/workbench/discussions'"
                    @click="isOpenMobile = false"
                  >
                    <LayoutSidebarMenuGroupItem
                      :class="[
                        'py-2',
                        isProjectActive('/workbench/discussions') &&
                          'bg-white/10 hover:!bg-white/10 border-l-4 border-blue-400',
                        'text-white/80 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                      ]"
                      extra-padding
                      label="协同管理"
                    ></LayoutSidebarMenuGroupItem>
                  </NuxtLink>
                </LayoutSidebarMenuGroup>

                <LayoutSidebarMenuGroup
                  :class="[
                    'project-sidebar-group-wrapper',
                    isProjectSectionActive([
                      '/progress/schedule',
                      '/progress/actual',
                      '/progress/physical'
                    ]) && 'project-sidebar-group-wrapper-active'
                  ]"
                  title="进度管理"
                  collapsible
                  :no-hover="true"
                  title-class="project-sidebar-group-title text-white/80"
                  arrow-class="project-sidebar-group-arrow text-white/80"
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
                        'py-2',
                        isProjectActive('/progress/schedule') &&
                          'bg-white/10 hover:!bg-white/10 border-l-4 border-blue-400',
                        'text-white/80 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                      ]"
                      extra-padding
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
                        'py-2',
                        isProjectActive('/progress/actual') &&
                          'bg-white/10 hover:!bg-white/10 border-l-4 border-blue-400',
                        'text-white/80 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                      ]"
                      extra-padding
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
                        'py-2',
                        isProjectActive('/progress/physical') &&
                          'bg-white/10 hover:!bg-white/10 border-l-4 border-blue-400',
                        'text-white/80 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                      ]"
                      extra-padding
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
                      'project-sidebar-top-item',
                      'py-3',
                      isProjectActive('/quality-acceptance') &&
                        'bg-white/10 hover:!bg-white/10 border-l-4 border-blue-400',
                      'text-white/80 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                    ]"
                    label="质量验收"
                  >
                    <template #icon>
                      <IconCircleCheck class="size-4 text-white" />
                    </template>
                  </LayoutSidebarMenuGroupItem>
                </NuxtLink>

                <LayoutSidebarMenuGroup
                  :class="[
                    'project-sidebar-group-wrapper',
                    isProjectSectionActive([
                      '/work-valuation/BOQ',
                      '/work-valuation/monthly-measurement'
                    ]) && 'project-sidebar-group-wrapper-active'
                  ]"
                  title="验工计价"
                  collapsible
                  :no-hover="true"
                  title-class="project-sidebar-group-title text-white/80"
                  arrow-class="project-sidebar-group-arrow text-white/80"
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
                        'py-2',
                        isProjectActive('/work-valuation/BOQ') &&
                          'bg-white/10 hover:!bg-white/10 border-l-4 border-blue-400',
                        'text-white/80 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                      ]"
                      extra-padding
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
                        'py-2',
                        isProjectActive('/work-valuation/monthly-measurement') &&
                          'bg-white/10 hover:!bg-white/10 border-l-4 border-blue-400',
                        'text-white/80 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                      ]"
                      extra-padding
                      label="月度验工"
                    ></LayoutSidebarMenuGroupItem>
                  </NuxtLink>
                </LayoutSidebarMenuGroup>

                <LayoutSidebarMenuGroup
                  :class="[
                    'project-sidebar-group-wrapper',
                    isProjectSectionActive(['/archive/model-to-site', '/archive/archives']) &&
                      'project-sidebar-group-wrapper-active'
                  ]"
                  title="档案管理"
                  collapsible
                  :no-hover="true"
                  title-class="project-sidebar-group-title text-white/80"
                  arrow-class="project-sidebar-group-arrow text-white/80"
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
                        'py-2',
                        isProjectActive('/archive/model-to-site') &&
                          'bg-white/10 hover:!bg-white/10 border-l-4 border-blue-400',
                        'text-white/80 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                      ]"
                      extra-padding
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
                        'py-2',
                        isProjectActive('/archive/archives') &&
                          'bg-white/10 hover:!bg-white/10 border-l-4 border-blue-400',
                        'text-white/80 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                      ]"
                      extra-padding
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
  workspaceRoute
} from '~/lib/common/helpers/route'
import { useRoute } from 'vue-router'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
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

const isProjectSectionActive = (suffixes: string[]): boolean => {
  return suffixes.some((suffix) => isProjectActive(suffix))
}

</script>

<style scoped>
.layout-sidebar-bg {
  background: url('~~/assets/images/layout/side_bg.png');
  background-size: 100% 100%;
}

.project-sidebar :deep(.flex.flex-col.group > div > button) {
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
  padding-left: 1rem;
  padding-right: 1rem;
}

.project-sidebar :deep(.flex.flex-col.group > div > button > svg:first-child) {
  order: 3;
  margin-left: auto;
}

.project-sidebar :deep(.flex.flex-col.group > div > button > div:nth-child(2)) {
  order: 1;
  width: 1.5rem;
  flex-shrink: 0;
  justify-content: center;
  margin-left: 0;
  margin-right: 0.25rem;
}

.project-sidebar :deep(.flex.flex-col.group > div > button > div:nth-child(3)) {
  order: 2;
  justify-content: flex-start;
}

.project-sidebar :deep(.flex.flex-col.group > div) {
  height: auto;
}

.project-sidebar :deep(.project-sidebar-group-wrapper > div) {
  border-left: 4px solid transparent;
  border-radius: 0.375rem;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

.project-sidebar :deep(.project-sidebar-group-wrapper > div:hover) {
  background: rgb(255 255 255 / 0.05);
}

.project-sidebar :deep(.project-sidebar-group-wrapper-active > div) {
  background: rgb(255 255 255 / 0.1);
  border-left-color: rgb(96 165 250);
}

.project-sidebar :deep(.project-sidebar-group-wrapper-active > div:hover) {
  background: rgb(255 255 255 / 0.1);
}

.project-sidebar :deep(.project-sidebar-top-item) {
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
  padding-left: 1rem;
  padding-right: 1rem;
}

.project-sidebar :deep(.project-sidebar-top-item > div) {
  gap: 0.25rem;
}

.project-sidebar :deep(.project-sidebar-top-item > div > div:first-child) {
  width: 1.5rem;
  flex-shrink: 0;
  justify-content: center;
}

.project-sidebar :deep(.project-sidebar-group-title),
.project-sidebar :deep(.project-sidebar-top-item > div > span),
.project-sidebar :deep(.flex.flex-col.group > div > button h6) {
  font-size: 0.875rem;
  line-height: 1.25rem;
  font-weight: 500;
}

.project-sidebar :deep(.project-sidebar-group-arrow) {
  height: 1rem;
  width: 1rem;
}
</style>
