<template>
  <div>
    <div v-if="project">
      <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
        <Portal to="current-project">
          <div>{{ project.name }}</div>
        </Portal>
        <ProjectPageHeader :project="project" />
      </div>
      <!-- <LayoutTabsHorizontal v-model:active-item="activePageTab" :items="pageTabItems"> -->
      <NuxtPage v-if="project" :project="project" />
      <CommonLoadingBar v-else loading />
      <!-- </LayoutTabsHorizontal> -->
    </div>

    <WorkspaceMoveProject
      v-if="project && isWorkspacesEnabled"
      v-model:open="showMoveDialog"
      event-source="project-page"
      :project="project"
    />
  </div>
</template>
<script setup lang="ts">
import { useQuery } from '@vue/apollo-composable'
import { graphql } from '~~/lib/common/generated/gql'
import { projectPageQuery } from '~~/lib/projects/graphql/queries'
import { useGeneralProjectPageUpdateTracking } from '~~/lib/projects/composables/projectPages'
import { projectRoute, projectWebhooksRoute } from '~/lib/common/helpers/route'
import { Portal } from 'portal-vue'
import type { Optional } from '@speckle/shared'

graphql(`
  fragment ProjectPageProject on Project {
    id
    createdAt
    modelCount: models(limit: 0) {
      totalCount
    }
    commentThreadCount: commentThreads(limit: 0) {
      totalCount
    }
    workspace {
      id
      permissions {
        canListDashboards {
          ...FullPermissionCheckResult
        }
      }
    }
    permissions {
      canReadSettings {
        ...FullPermissionCheckResult
      }
      canUpdate {
        ...FullPermissionCheckResult
      }
      canMoveToWorkspace {
        ...FullPermissionCheckResult
      }
    }
    ...ProjectPageTeamInternals_Project
    ...ProjectPageProjectHeader
    ...ProjectPageTeamDialog
    ...WorkspaceMoveProjectManager_ProjectBase
    ...ProjectPageSettingsTab_Project
    ...WorkspaceMoveProject_Project
    hasAccessToDashboards: hasAccessToFeature(featureName: dashboards)
  }
`)

definePageMeta({
  middleware: [
    'require-valid-project',
    function (to) {
      // Redirect from /projects/:id/models to /projects/:id
      const projectId = to.params.id as string
      if (/\/models\/?$/i.test(to.path)) {
        return navigateTo(projectRoute(projectId))
      }

      // Redirect from /projects/:id/webhooks to /projects/:id/settings/webhooks
      if (/\/projects\/\w*?\/webhooks/i.test(to.path)) {
        return navigateTo(projectWebhooksRoute(projectId))
      }
    }
  ],
  alias: ['/projects/:id/models', '/projects/:id/webhooks'],
  layout: 'projects'
})

const route = useRoute()

const projectId = computed(() => route.params.id as string)
const token = computed(() => route.query.token as Optional<string>)

const pageFetchPolicy = usePageQueryStandardFetchPolicy()
useGeneralProjectPageUpdateTracking({ projectId }, { notifyOnProjectUpdate: true })
const { result: projectPageResult } = useQuery(
  projectPageQuery,
  () => ({
    id: projectId.value,
    ...(token.value?.length ? { token: token.value } : {})
  }),
  () => ({
    fetchPolicy: pageFetchPolicy.value
  })
)

const showMoveDialog = ref(false)

const project = computed(() => projectPageResult.value?.project)
const projectName = computed(() =>
  project.value?.name.length ? project.value.name : ''
)

useHead({
  title: projectName,
  meta: [
    {
      name: 'robots',
      content: 'noindex, nofollow'
    }
  ]
})

const isWorkspacesEnabled = useIsWorkspacesEnabled()
</script>
