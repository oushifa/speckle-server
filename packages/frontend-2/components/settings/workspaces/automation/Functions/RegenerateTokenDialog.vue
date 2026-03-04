<template>
  <LayoutDialog v-model:open="isOpen" max-width="sm" :buttons="dialogButtons">
    <template #header>Regenerate token</template>
    <div class="flex flex-col gap-2 text-body-xs text-foreground mb-2">
      <div v-if="!newToken">
        <p>您确定要重新生成此函数的令牌吗？</p>
        <p>
          已为
          <strong>{{ workspaceFunction.name }}</strong>
          的令牌将
          <strong>永久</strong>
          无效。
        </p>
      </div>
      <div v-else class="flex flex-col gap-4 text-foreground">
        <div class="flex flex-col gap-1">
          <h6 class="font-medium">新令牌：</h6>
          <div class="w-full">
            <CommonClipboardInputWithToast :value="newToken" />
          </div>
        </div>
        <div
          class="flex gap-4 items-center bg-foundation-2 border border-outline-3 rounded-lg p-3 text-foreground-2 mb-2"
        >
          <div class="max-w-md text-body-2xs">
            <p>
              <span class="font-medium">注意：</span>
              这是您第一次查看完整令牌的机会。
            </p>
            <p class="font-medium">请将其安全地复制粘贴到某处。</p>
          </div>
        </div>
      </div>
    </div>
  </LayoutDialog>
</template>

<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import { useMutation } from '@vue/apollo-composable'
import { regenerateFunctionTokenMutation } from '~/lib/automate/graphql/mutations'
import { graphql } from '~/lib/common/generated/gql'
import type { SettingsWorkspacesAutomationRegenerateTokenDialog_AutomateFunctionFragment } from '~/lib/common/generated/gql/graphql'
import { getFirstErrorMessage } from '~/lib/common/helpers/graphql'

graphql(`
  fragment SettingsWorkspacesAutomationRegenerateTokenDialog_AutomateFunction on AutomateFunction {
    id
    name
  }
`)

const props = defineProps<{
  workspaceFunction: SettingsWorkspacesAutomationRegenerateTokenDialog_AutomateFunctionFragment
}>()

const { triggerNotification } = useGlobalToast()
const { mutate: regenerateToken, loading } = useMutation(
  regenerateFunctionTokenMutation
)

const isOpen = defineModel<boolean>('open', { required: true })

const newToken = ref<string>()

const handleRegenerateToken = async () => {
  const result = await regenerateToken({
    functionId: props.workspaceFunction.id
  }).catch(convertThrowIntoFetchResult)

  const token = result?.data?.automateMutations.regenerateFunctionToken

  if (token) {
    newToken.value = token
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '令牌已重新生成',
      description: '为您的函数生成了一个新令牌。'
    })
  } else {
    const errorMessage = getFirstErrorMessage(result?.errors)
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '重新生成令牌失败',
      description: errorMessage
    })
  }
}

const dialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: (): boolean => (isOpen.value = false)
  },
  {
    text: '重新生成',
    props: { color: 'danger' },
    disabled: loading.value || !!newToken.value,
    onClick: handleRegenerateToken
  }
])

watch(isOpen, (open) => {
  if (!open) {
    newToken.value = undefined
  }
})
</script>
