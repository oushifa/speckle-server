<template>
  <section class="flex flex-col space-y-3 pb-8">
    <div class="flex flex-col sm:flex-row gap-y-3 sm:items-center">
      <div class="flex-1 flex-col pr-6 gap-y-1">
        <p class="text-body-xs font-medium text-foreground">默认席位类型</p>
        <p class="text-body-2xs text-foreground-2 leading-5 max-w-[250px] mt-1">
          设置新加入工作空间的用户默认分配的席位类型。
        </p>
      </div>
      <FormSelectBase
        v-model="seatTypeModel"
        v-tippy="!isWorkspaceAdmin ? '您必须是工作空间管理员' : undefined"
        :items="defaultSeatTypeOptions"
        :disabled="!isWorkspaceAdmin"
        name="defaultSeatType"
        label="默认席位类型"
        class="min-w-[240px]"
        :allow-unset="false"
        :show-label="false"
        fully-control-value
      >
        <template #nothing-selected>选择默认席位类型</template>
        <template #something-selected="{ value }">
          <div class="text-foreground font-medium capitalize">
            {{ Array.isArray(value) ? value[0] : value }}
          </div>
        </template>
        <template #option="{ item }">
          <div class="flex flex-col space-y-0.5">
            <span class="capitalize">{{ item }}</span>
            <span class="text-body-3xs text-foreground-2">
              {{ WorkspaceSeatTypeDescription[Roles.Workspace.Member][item] }}
            </span>
          </div>
        </template>
      </FormSelectBase>
    </div>

    <SettingsConfirmDialog
      v-model:open="showConfirmSeatTypeDialog"
      title="Confirm change"
      @confirm="handleSeatTypeConfirm"
      @cancel="handleSeatTypeCancel"
    >
      <p
        v-if="workspace.discoverabilityAutoJoinEnabled"
        class="text-body-xs text-foreground mb-2"
      >
        您已启用
        <span class="font-medium">加入无需管理员审批</span>
        。
      </p>
      <p class="text-body-xs text-foreground mb-2">
        将默认席位类型设置为
        <span class="font-medium">编辑器</span>
        意味着每个加入的用户都将消耗一个付费席位并产生费用。
      </p>
      <p class="text-body-xs text-foreground">您确定要将默认席位类型设置为编辑器吗？</p>
    </SettingsConfirmDialog>
  </section>
</template>

<script setup lang="ts">
import { useMutation } from '@vue/apollo-composable'
import { graphql } from '~/lib/common/generated/gql'
import type {
  WorkspaceSeatType,
  SettingsWorkspacesSecurityDefaultSeat_WorkspaceFragment
} from '~/lib/common/generated/gql/graphql'
import { Roles, SeatTypes } from '@speckle/shared'
import { workspaceUpdateDefaultSeatTypeMutation } from '~/lib/workspaces/graphql/mutations'
import { useMixpanel } from '~/lib/core/composables/mp'
import { useWorkspacePlan } from '~/lib/workspaces/composables/plan'
import { WorkspaceSeatTypeDescription } from '~/lib/settings/helpers/constants'
import {
  getFirstErrorMessage,
  convertThrowIntoFetchResult
} from '~/lib/common/helpers/graphql'

graphql(`
  fragment SettingsWorkspacesSecurityDefaultSeat_Workspace on Workspace {
    id
    slug
    defaultSeatType
    discoverabilityAutoJoinEnabled
    role
  }
`)

const props = defineProps<{
  workspace: SettingsWorkspacesSecurityDefaultSeat_WorkspaceFragment
}>()

const mixpanel = useMixpanel()
const { mutate: updateDefaultSeatType } = useMutation(
  workspaceUpdateDefaultSeatTypeMutation
)
const { triggerNotification } = useGlobalToast()
const { isSelfServePlan, isPaidPlan } = useWorkspacePlan(props.workspace.slug)

const currentSeatType = ref<WorkspaceSeatType>(props.workspace.defaultSeatType)

const showConfirmSeatTypeDialog = ref(false)
const pendingNewSeatType = ref<WorkspaceSeatType>()

const isWorkspaceAdmin = computed(() => {
  return props.workspace.role === Roles.Workspace.Admin
})

const seatTypeModel = computed({
  get: () => currentSeatType.value,
  set: (newValue: WorkspaceSeatType) => {
    handleSeatTypeChange(newValue)
  }
})

const handleSeatTypeChange = (newValue: WorkspaceSeatType) => {
  if (newValue === currentSeatType.value) return

  // If setting to Editor on paid plan, show confirmation
  if (newValue === SeatTypes.Editor && isSelfServePlan.value && isPaidPlan.value) {
    pendingNewSeatType.value = newValue
    showConfirmSeatTypeDialog.value = true
    return
  }
  // Otherwise, apply the change directly
  applySeatTypeChange(newValue)
}

const applySeatTypeChange = async (seatTypeValue: WorkspaceSeatType) => {
  const result = await updateDefaultSeatType({
    input: {
      id: props.workspace.id,
      defaultSeatType: seatTypeValue
    }
  }).catch(convertThrowIntoFetchResult)

  if (result?.data) {
    currentSeatType.value = seatTypeValue

    triggerNotification({
      type: ToastNotificationType.Success,
      title: '默认席位类型已更新',
      description: `新成员将默认分配 ${
        seatTypeValue.charAt(0).toUpperCase() + seatTypeValue.slice(1)
      } 席位`
    })

    mixpanel.track('Workspace Default Seat Type Updated', {
      value: seatTypeValue,
      // eslint-disable-next-line camelcase
      workspace_id: props.workspace.id
    })
  } else {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '更新默认席位类型失败',
      description: getFirstErrorMessage(result?.errors)
    })
  }
}

const handleSeatTypeConfirm = async () => {
  if (!pendingNewSeatType.value) return
  await applySeatTypeChange(pendingNewSeatType.value)
  pendingNewSeatType.value = undefined
}

const handleSeatTypeCancel = () => {
  pendingNewSeatType.value = undefined
  showConfirmSeatTypeDialog.value = false
}

const defaultSeatTypeOptions: WorkspaceSeatType[] = Object.values(SeatTypes)

watch(
  () => props.workspace.defaultSeatType,
  (newVal) => {
    if (newVal) {
      currentSeatType.value = newVal
    }
  }
)
</script>
