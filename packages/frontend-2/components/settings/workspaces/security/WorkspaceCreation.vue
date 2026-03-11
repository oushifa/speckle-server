<template>
  <section class="py-8">
    <SettingsSectionHeader title="Exclusive workspace" subheading />
    <p class="text-body-xs text-foreground-2 mt-2 mb-6">
      控制工作空间成员是否可以创建新的工作空间。
    </p>

    <div class="flex flex-col space-y-6">
      <div class="flex items-center">
        <div class="flex-1 flex-col pr-6 gap-y-1">
          <p class="text-body-xs font-medium text-foreground">限制成员工作空间创建</p>
          <p class="text-body-2xs text-foreground-2 leading-5 max-w-md mt-1">
            防止工作空间成员创建新的工作空间。管理员和访客仍可以创建工作空间。
          </p>
        </div>
        <div
          v-if="props.workspace?.hasAccessToExclusiveMembership"
          v-tippy="
            !canMakeWorkspaceExclusive.authorized
              ? canMakeWorkspaceExclusive.message
              : undefined
          "
        >
          <FormSwitch
            v-model="isExclusive"
            name="workspace-exclusive"
            :disabled="!canMakeWorkspaceExclusive.authorized"
            :show-label="false"
          />
        </div>
        <FormButton
          v-else
          to="mailto:billing@speckle.systems?subject=Workspace%20Creation%20Restriction"
          size="sm"
          color="outline"
        >
          联系我们
        </FormButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useMutation } from '@vue/apollo-composable'
import { graphql } from '~/lib/common/generated/gql'
import type { SettingsWorkspacesSecurityWorkspaceCreation_WorkspaceFragment } from '~/lib/common/generated/gql/graphql'
import { useMixpanel } from '~/lib/core/composables/mp'
import { workspaceUpdateExclusiveMutation } from '~/lib/workspaces/graphql/mutations'

graphql(`
  fragment SettingsWorkspacesSecurityWorkspaceCreation_Workspace on Workspace {
    id
    slug
    role
    isExclusive
    hasAccessToExclusiveMembership: hasAccessToFeature(featureName: exclusiveMembership)
    permissions {
      canMakeWorkspaceExclusive {
        authorized
        message
      }
    }
  }
`)

const props = defineProps<{
  workspace: SettingsWorkspacesSecurityWorkspaceCreation_WorkspaceFragment
}>()

const mixpanel = useMixpanel()
const { mutate: updateExclusive } = useMutation(workspaceUpdateExclusiveMutation)
const { triggerNotification } = useGlobalToast()

const canMakeWorkspaceExclusive = computed(
  () => props.workspace?.permissions?.canMakeWorkspaceExclusive
)

const isExclusive = computed({
  get: () => props.workspace?.isExclusive || false,
  set: async (newVal) => {
    if (!props.workspace?.id) return

    const result = await updateExclusive({
      input: {
        id: props.workspace.id,
        isExclusive: newVal
      }
    }).catch(convertThrowIntoFetchResult)

    if (result?.data) {
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '工作空间创建限制已更新',
        description: `成员工作空间创建已被 ${
          newVal ? '限制' : '允许'
        }。管理员和访客仍可以创建工作空间。`
      })
      mixpanel.track('Workspace Creation Restriction Toggled', {
        value: newVal,
        // eslint-disable-next-line camelcase
        workspace_id: props.workspace?.id
      })
    } else {
      triggerNotification({
        type: ToastNotificationType.Danger,
        title: '更新工作空间创建限制失败'
      })
    }
  }
})
</script>
