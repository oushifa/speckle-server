<template>
  <div>
    <Portal to="navigation">
      <HeaderNavLink
        v-if="showWorkspaceLink"
        link-class="text-white/60 hover:!text-white/80"
        :to="workspaceRoute(project.workspace?.slug)"
        name="项目管理"
        :separator="false"
        active-class="!text-white"
      />
      <HeaderNavLink
        v-else-if="!isWorkspacesEnabled"
        link-class="text-white/60 hover:!text-white/80"
        :to="projectsRoute"
        name="项目管理"
        :separator="false"
        active-class="!text-white"
      />
      <HeaderNavLink
        link-class="text-white/60 hover:!text-white/80"
        :to="projectRoute(project.id)"
        :name="project.name"
        :separator="showWorkspaceLink || !isWorkspacesEnabled"
        active-class="!text-white"
      />
    </Portal>

    <!-- <div class="flex gap-x-3">
      <WorkspaceAvatar
        v-if="project.workspace && isWorkspacesEnabled && !project.workspace.role"
        v-tippy="project.workspace.name"
        :logo="project.workspace.logo"
        :name="project.workspace.name"
        size="sm"
        class="mt-0.5"
      />
      <CommonTitleDescription
        :title="project.name"
        :description="project.description"
      />
    </div> -->
  </div>
</template>

<script setup lang="ts">
import { graphql } from '~~/lib/common/generated/gql'
import type { ProjectPageProjectHeaderFragment } from '~~/lib/common/generated/gql/graphql'
import { projectRoute, projectsRoute } from '~~/lib/common/helpers/route'
import { workspaceRoute } from '~/lib/common/helpers/route'

graphql(`
  fragment ProjectPageProjectHeader on Project {
    id
    name
    description
    workspace {
      id
      slug
      name
      logo
      role
    }
  }
`)

const props = defineProps<{
  project: ProjectPageProjectHeaderFragment
}>()

const isWorkspacesEnabled = useIsWorkspacesEnabled()
const showWorkspaceLink = computed(
  () => !!props.project.workspace?.role && isWorkspacesEnabled.value
)
</script>
