<template>
  <LayoutDialog v-model:open="isOpen" title="删除账户" max-width="md">
    <form class="flex flex-col gap-y-3" @submit="onDelete">
      <p class="text-body-xs">
        <span class="font-medium">您确定要永久删除您的账户吗？此操作无法撤销。</span>
        我们将删除您是唯一所有者的所有项目，以及任何关联数据。
      </p>

      <p class="text-body-xs">
        要确认，请在下方输入您的
        <HelpText :text="emailPlaceholder">电子邮件地址</HelpText>
        。
      </p>

      <div class="flex gap-2 mt-3 mb-6">
        <FormTextInput
          name="deleteEmail"
          label="您的电子邮件地址"
          :placeholder="emailPlaceholder"
          color="foundation"
          full-width
          validate-on-mount
          validate-on-value-update
          hide-error-message
          :rules="[stringMatchesEmail]"
        />
        <FormButton
          color="danger"
          submit
          :disabled="!!Object.values(errors).length || loading"
        >
          删除账户
        </FormButton>
      </div>
    </form>
  </LayoutDialog>
</template>
<script setup lang="ts">
import { useForm } from 'vee-validate'
import type { GenericValidateFunction } from 'vee-validate'
import { graphql } from '~~/lib/common/generated/gql'
import type { SettingsUserProfileDeleteAccount_UserFragment } from '~~/lib/common/generated/gql/graphql'
import { useDeleteAccount } from '~~/lib/user/composables/management'

graphql(`
  fragment SettingsUserProfileDeleteAccount_User on User {
    id
    email
  }
`)

const stringMatchesEmail: GenericValidateFunction<string> = (val: string) => {
  return (val || '').toLowerCase() === (props.user.email || '').toLowerCase()
    ? true
    : 'Value must match the email exactly'
}

const emit = defineEmits<{
  (e: 'deleted'): void
}>()

const props = defineProps<{
  user: SettingsUserProfileDeleteAccount_UserFragment
}>()

const isOpen = defineModel<boolean>('open', { required: true })

const { handleSubmit, errors } = useForm<{ deleteEmail: string }>()
const { mutate, loading } = useDeleteAccount()

const emailPlaceholder = computed(() => props.user.email || 'example@example.com')

const onDelete = handleSubmit(async (values) => {
  const isDeleted = await mutate({
    email: values.deleteEmail
  })
  if (isDeleted) emit('deleted')
})
</script>
