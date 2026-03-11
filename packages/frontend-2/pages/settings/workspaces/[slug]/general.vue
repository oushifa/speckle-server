<template>
  <section>
    <div class="md:max-w-xl md:mx-auto pb-6 md:pb-0">
      <SettingsSectionHeader title="General" text="Manage your workspace settings" />
      <SettingsSectionHeader title="Workspace details" subheading />
      <div class="pt-6">
        <FormTextInput
          v-model="name"
          color="foundation"
          label="工作空间名称"
          name="name"
          placeholder="工作空间名称"
          show-label
          :disabled="!isAdmin || needsSsoLogin"
          :tooltip-text="disabledTooltipText"
          label-position="left"
          :rules="[isRequired, isStringOfLength({ maxLength: 512 })]"
          validate-on-value-update
          @change="save()"
        />
        <ClientOnly>
          <hr class="my-4 border-outline-3" />
          <FormTextInput
            id="short-id"
            v-model="slug"
            color="foundation"
            label="工作空间短ID"
            name="shortId"
            :help="slugHelp"
            :disabled="disableSlugInput"
            show-label
            label-position="left"
            :tooltip-text="disabledSlugTooltipText"
            read-only
            :right-icon="disableSlugInput ? undefined : IconEdit"
            :right-icon-title="disableSlugInput ? undefined : '编辑工作空间短ID'"
            custom-help-class="!break-all"
            @right-icon-click="openSlugEditDialog"
          />
        </ClientOnly>
        <hr class="my-4 border-outline-3" />
        <FormTextArea
          id="settings-description"
          v-model="description"
          color="foundation"
          label="工作空间描述"
          name="description"
          placeholder="工作空间描述"
          :tooltip-text="disabledTooltipText"
          show-label
          label-position="left"
          :disabled="!isAdmin || needsSsoLogin"
          :rules="[isStringOfLength({ maxLength: 512 })]"
          help="最大512个字符"
          @change="save()"
        />
        <hr class="my-4 border-outline-3" />
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col">
            <span class="text-body-xs font-medium text-foreground">工作空间图标</span>
            <span class="text-body-2xs text-foreground-2 max-w-[230px]">
              上传工作空间图标
            </span>
          </div>
          <div :key="String(isAdmin)" v-tippy="disabledTooltipText">
            <SettingsWorkspacesGeneralEditAvatar
              v-if="workspaceResult?.workspaceBySlug"
              :workspace="workspaceResult?.workspaceBySlug"
              :disabled="!isAdmin || needsSsoLogin"
              size="3xl"
            />
          </div>
        </div>
        <hr class="my-4 border-outline-3" />
        <div class="grid grid-cols-2 gap-4 pt-1">
          <div class="flex flex-col">
            <span class="text-body-xs font-medium text-foreground">
              嵌入模型时是否显示数智南北 logo
            </span>
            <span class="text-body-2xs text-foreground-2 max-w-[230px]">
              控制模型嵌入时是否显示数智南北 logo
            </span>
          </div>
          <div class="flex h-full flex-col justify-center gap-y-2">
            <ClientOnly>
              <div
                v-tippy="
                  !canEditEmbedOptions?.authorized
                    ? canEditEmbedOptions?.message
                    : undefined
                "
                class="flex items-center gap-x-2"
              >
                <FormSwitch
                  v-model="showBranding"
                  :disabled="!canEditEmbedOptions?.authorized || needsSsoLogin"
                  name="showBranding"
                  label="Show branding"
                  :show-label="false"
                  @update:model-value="updateShowBranding"
                />
                <p class="text-body-xs text-foreground-2">
                  {{ showBranding ? 'Logo visible' : 'Logo hidden' }}
                </p>
              </div>
              <p
                v-if="
                  !canEditEmbedOptions?.authorized &&
                  canEditEmbedOptions?.code === 'WorkspaceNoFeatureAccess'
                "
                class="text-body-2xs text-foreground-2"
              >
                此功能仅在商业计划中可用
                <NuxtLink
                  :to="settingsWorkspaceRoutes.billing.route(slug)"
                  class="underline"
                >
                  现在升级
                </NuxtLink>
              </p>
            </ClientOnly>
          </div>
        </div>
      </div>
      <hr class="my-6 border-outline-2" />
      <div class="flex flex-col space-y-6">
        <SettingsSectionHeader title="Leave workspace" subheading />
        <CommonCard class="text-body-xs bg-foundation">
          点击下方按钮将退出此工作空间。
        </CommonCard>
        <div>
          <FormButton color="primary" @click="showLeaveDialog = true">
            退出工作空间
          </FormButton>
        </div>
      </div>
      <template v-if="isAdmin">
        <hr class="mb-6 mt-8 border-outline-2" />
        <div class="flex flex-col space-y-6">
          <SettingsSectionHeader title="Delete workspace" subheading />
          <CommonCard class="text-body-xs bg-foundation">
            所有项目将被删除，包括所有版本和数据。
          </CommonCard>

          <div class="flex">
            <div v-tippy="deleteWorkspaceTooltip">
              <FormButton
                :disabled="!canDeleteWorkspace"
                color="primary"
                @click="showDeleteDialog = true"
              >
                删除工作空间
              </FormButton>
            </div>
          </div>
        </div>
      </template>
      <template v-if="workspaceResult?.workspaceBySlug?.id">
        <hr class="mb-6 mt-8 border-outline-2" />
        <p class="text-body-2xs text-foreground-2">
          工作空间 ID: #{{ workspaceResult?.workspaceBySlug?.id }}
        </p>
      </template>
    </div>

    <SettingsWorkspacesGeneralLeaveDialog
      v-model:open="showLeaveDialog"
      :workspace="workspaceResult?.workspaceBySlug"
    />

    <SettingsWorkspacesGeneralDeleteDialog
      v-model:open="showDeleteDialog"
      :workspace="workspaceResult?.workspaceBySlug"
    />

    <SettingsWorkspacesGeneralEditSlugDialog
      v-model:open="showEditSlugDialog"
      :base-url="baseUrl"
      :workspace="workspaceResult?.workspaceBySlug"
      @update:slug="updateWorkspaceSlug"
    />
  </section>
</template>

<script setup lang="ts">
import { graphql } from '~~/lib/common/generated/gql'
import { useForm } from 'vee-validate'
import { useQuery, useMutation } from '@vue/apollo-composable'
import {
  settingsUpdateWorkspaceMutation,
  settingsUpdateWorkspaceEmbedOptionsMutation
} from '~/lib/settings/graphql/mutations'
import { settingsWorkspaceGeneralQuery } from '~/lib/settings/graphql/queries'
import type { WorkspaceUpdateInput } from '~~/lib/common/generated/gql/graphql'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import {
  getFirstErrorMessage,
  convertThrowIntoFetchResult
} from '~~/lib/common/helpers/graphql'
import { isRequired, isStringOfLength } from '~~/lib/common/helpers/validation'
import { useMixpanel } from '~/lib/core/composables/mp'
import { Roles, WorkspacePlans } from '@speckle/shared'
import { workspaceRoute, settingsWorkspaceRoutes } from '~/lib/common/helpers/route'
import { useRoute } from 'vue-router'
import { WorkspacePlanStatuses } from '~/lib/common/generated/gql/graphql'
import { useWorkspaceSsoStatus } from '~/lib/workspaces/composables/sso'

graphql(`
  fragment SettingsWorkspacesGeneral_Workspace on Workspace {
    ...SettingsWorkspacesGeneralEditAvatar_Workspace
    ...SettingsWorkspaceGeneralDeleteDialog_Workspace
    ...SettingsWorkspacesGeneralEditSlugDialog_Workspace
    id
    name
    slug
    description
    logo
    role
    plan {
      status
      name
    }
    embedOptions {
      hideSpeckleBranding
    }
    permissions {
      canEditEmbedOptions {
        ...FullPermissionCheckResult
      }
    }
  }
`)

definePageMeta({
  layout: 'settings'
})

useHead({
  title: '设置 | 工作空间'
})

type FormValues = { name: string; description: string }

const routeSlug = computed(() => (route.params.slug as string) || '')

const IconEdit = resolveComponent('IconEdit')

const isBillingIntegrationEnabled = useIsBillingIntegrationEnabled()
const mixpanel = useMixpanel()
const router = useRouter()
const route = useRoute()
const { handleSubmit } = useForm<FormValues>()
const { triggerNotification } = useGlobalToast()
const { mutate: updateMutation } = useMutation(settingsUpdateWorkspaceMutation)
const { mutate: updateEmbedOptionsMutation } = useMutation(
  settingsUpdateWorkspaceEmbedOptionsMutation
)
const { result: workspaceResult } = useQuery(settingsWorkspaceGeneralQuery, () => ({
  slug: routeSlug.value
}))
const config = useRuntimeConfig()
const { hasSsoEnabled, needsSsoLogin } = useWorkspaceSsoStatus({
  workspaceSlug: computed(() => workspaceResult.value?.workspaceBySlug?.slug || '')
})

const name = ref('')
const slug = ref('')
const description = ref('')
const showDeleteDialog = ref(false)
const showEditSlugDialog = ref(false)
const showLeaveDialog = ref(false)
const showBranding = ref(true)

const isAdmin = computed(
  () => workspaceResult.value?.workspaceBySlug?.role === Roles.Workspace.Admin
)
const adminRef = toRef(isAdmin)
const canDeleteWorkspace = computed(
  () =>
    isAdmin.value &&
    !needsSsoLogin.value &&
    (!isBillingIntegrationEnabled ||
      !(
        [
          WorkspacePlanStatuses.Valid,
          WorkspacePlanStatuses.PaymentFailed,
          WorkspacePlanStatuses.CancelationScheduled
        ] as string[]
      ).includes(
        workspaceResult.value?.workspaceBySlug?.plan?.status as WorkspacePlanStatuses
      ) ||
      workspaceResult.value?.workspaceBySlug?.plan?.name === WorkspacePlans.Free)
)
const deleteWorkspaceTooltip = computed(() => {
  if (needsSsoLogin.value) return '您无法删除需要SSO登录的工作空间，除非您已登录'
  if (!canDeleteWorkspace.value)
    return '您无法删除具有活动计划的工作空间。请先取消计划再删除。'
  if (!isAdmin.value) return '仅管理员才能删除工作空间'
  return undefined
})

const save = handleSubmit(async () => {
  if (!workspaceResult.value?.workspaceBySlug) return

  const input: WorkspaceUpdateInput = {
    id: workspaceResult.value.workspaceBySlug.id
  }
  if (name.value !== workspaceResult.value.workspaceBySlug.name) input.name = name.value
  if (description.value !== workspaceResult.value.workspaceBySlug.description)
    input.description = description.value

  const result = await updateMutation({ input }).catch(convertThrowIntoFetchResult)

  if (result?.data) {
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '工作空间已更新'
    })

    mixpanel.track('Workspace General Settings Updated', {
      fields: (Object.keys(input) as Array<keyof WorkspaceUpdateInput>).filter(
        (key) => key !== 'id'
      ),
      // eslint-disable-next-line camelcase
      workspace_id: workspaceResult.value.workspaceBySlug.id,
      source: 'settings'
    })
  } else {
    const errorMessage = getFirstErrorMessage(result?.errors)
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '工作空间更新失败',
      description: errorMessage
    })
  }
})

watch(
  () => workspaceResult,
  () => {
    if (workspaceResult.value?.workspaceBySlug) {
      name.value = workspaceResult.value.workspaceBySlug.name
      description.value = workspaceResult.value.workspaceBySlug.description ?? ''
      slug.value = workspaceResult.value.workspaceBySlug.slug ?? ''
      showBranding.value =
        !workspaceResult.value.workspaceBySlug.embedOptions.hideSpeckleBranding
    }
  },
  { deep: true, immediate: true }
)

const baseUrl = config.public.baseUrl

const slugHelp = computed(() => {
  // Ensure the correct slug is used both on the server and client
  if (!workspaceResult.value?.workspaceBySlug) {
    return `${baseUrl}/workspaces/${routeSlug.value}`
  }
  return `${baseUrl}/workspaces/${workspaceResult.value.workspaceBySlug.slug}`
})

const canEditEmbedOptions = computed(
  () => workspaceResult.value?.workspaceBySlug?.permissions?.canEditEmbedOptions
)

const disabledTooltipText = computed(() => {
  if (!adminRef.value) return '仅管理员才能编辑此字段'
  if (needsSsoLogin.value) return '请使用您的SSO提供商登录以编辑此字段'
  return undefined
})

const disableSlugInput = computed(() => !isAdmin.value || hasSsoEnabled.value)

const disabledSlugTooltipText = computed(() => {
  return hasSsoEnabled.value ? '短ID不能在启用SSO时更改。' : disabledTooltipText.value
})

const openSlugEditDialog = () => {
  if (hasSsoEnabled.value) return
  showEditSlugDialog.value = true
}

const updateShowBranding = async () => {
  if (!workspaceResult.value?.workspaceBySlug) return

  const result = await updateEmbedOptionsMutation({
    input: {
      workspaceId: workspaceResult.value.workspaceBySlug.id,
      hideSpeckleBranding: !showBranding.value
    }
  })

  if (result && result.data) {
    mixpanel.track('Workspace Embed Options Updated', {
      hideBranding: !showBranding.value,
      // eslint-disable-next-line camelcase
      workspace_id: workspaceResult.value.workspaceBySlug.id
    })

    triggerNotification({
      type: ToastNotificationType.Success,
      title: `已${showBranding.value ? '启用' : '禁用'}嵌入中的数智南北徽标`
    })
  }
}
const updateWorkspaceSlug = async (newSlug: string) => {
  if (!workspaceResult.value?.workspaceBySlug) {
    return
  }

  const oldSlug = slug.value

  const result = await updateMutation({
    input: {
      id: workspaceResult.value.workspaceBySlug.id,
      slug: newSlug
    }
  })

  if (result && result.data) {
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '工作空间短ID已更新'
    })

    showEditSlugDialog.value = false

    slug.value = newSlug

    if (routeSlug.value === oldSlug) {
      router.replace(workspaceRoute(newSlug))
    }
  } else {
    const errorMessage = getFirstErrorMessage(result && result.errors)
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '更新工作空间短ID失败',
      description: errorMessage
    })
  }
}
</script>
