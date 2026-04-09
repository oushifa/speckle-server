<template>
  <CommonAlert
    v-if="variant === 'alert'"
    class="select-none"
    size="2xs"
    color="info"
    hide-icon
    :actions="actions"
  >
    <template #description>
      {{ text }}
    </template>
  </CommonAlert>
  <div v-else class="flex flex-col space-y-1">
    <div class="text-body-3xs text-foreground-2 pr-8 select-none">
      升级您的计划以查看 {{ versionLimitFormatted }} 之前的版本。
    </div>
    <FormButton color="outline" size="sm" @click="handleUpgradeClick">
      升级您的计划
    </FormButton>
  </div>
</template>
<script setup lang="ts">
import type { AlertAction } from '@speckle/ui-components'
import { useWorkspaceLimits } from '~/lib/workspaces/composables/limits'
import { settingsWorkspaceRoutes } from '~~/lib/common/helpers/route'
import { useMixpanel } from '~/lib/core/composables/mp'
import type {
  ViewerLimitAlertType,
  ViewerLimitAlertVariant
} from '~/lib/common/helpers/permissions'
import { graphql } from '~/lib/common/generated/gql'
import type { ViewerResourcesWorkspaceLimitAlert_WorkspaceFragment } from '~/lib/common/generated/gql/graphql'

graphql(`
  fragment ViewerResourcesWorkspaceLimitAlert_Workspace on Workspace {
    id
    slug
  }
`)

const props = withDefaults(
  defineProps<{
    limitType: ViewerLimitAlertType
    variant?: ViewerLimitAlertVariant
    workspace: ViewerResourcesWorkspaceLimitAlert_WorkspaceFragment
  }>(),
  {
    variant: 'alert'
  }
)

const mixpanel = useMixpanel()

const { commentLimitFormatted, versionLimitFormatted } = useWorkspaceLimits({
  slug: computed(() => props.workspace.slug || '')
})

const text = computed(() => {
  if (props.limitType === 'comment') {
    return `升级您的计划以查看 ${commentLimitFormatted.value} 之前的评论。`
  }
  return `升级您的计划以查看 ${versionLimitFormatted.value} 之前的版本。`
})

const actions = computed((): AlertAction[] => [
  {
    title: '升级',
    onClick: handleUpgradeClick
  }
])

const handleUpgradeClick = () => {
  // Track the appropriate event based on the limit type
  mixpanel.track(
    props.limitType === 'comment' ? '升级评论按钮点击' : '升级版本按钮点击',
    {
      location: 'viewer',
      // eslint-disable-next-line camelcase
      workspace_id: props.workspace.slug
    }
  )
  return navigateTo(settingsWorkspaceRoutes.billing.route(props.workspace.slug))
}
</script>
