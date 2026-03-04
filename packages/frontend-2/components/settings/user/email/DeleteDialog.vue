<template>
  <LayoutDialog
    v-model:open="isOpen"
    :title="isAdding ? '停止添加电子邮件?' : '删除电子邮件地址'"
    max-width="xs"
    :buttons="dialogButtons"
  >
    <p class="text-body-xs text-foreground mb-2">
      {{
        isAdding
          ? `您确定要停止添加 ${email?.email} 吗？任何进行中的操作都将被丢弃。`
          : `您确定要从您的账户删除 ${email?.email} 吗？`
      }}
    </p>
  </LayoutDialog>
</template>

<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import type { UserEmail } from '~/lib/common/generated/gql/graphql'
import { useUserEmails } from '~/lib/user/composables/emails'

const props = defineProps<{
  email?: UserEmail
  isAdding?: boolean
}>()

const isOpen = defineModel<boolean>('open', { required: true })

const { deleteUserEmail } = useUserEmails()

const dialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: props.isAdding ? 'No' : 'Cancel',
    props: { color: 'outline' },
    onClick: () => {
      isOpen.value = false
    }
  },
  {
    text: props.isAdding ? 'Yes' : 'Delete',
    props: { color: 'primary' },
    onClick: () => {
      onDeleteEmail()
    }
  }
])

const onDeleteEmail = async () => {
  if (!props.email) return
  const success = await deleteUserEmail({
    email: props.email,
    hideToast: props.isAdding
  })
  if (success) {
    isOpen.value = false
  }
}
</script>
