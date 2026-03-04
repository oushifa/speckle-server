<template>
  <div class="flex flex-col space-y-6">
    <SettingsSectionHeader title="更改密码" subheading />
    <CommonCard class="text-body-xs bg-foundation">
      点击下方按钮开始重置密码流程。
      <br />
      重置完成后，您将收到一封包含进一步说明的电子邮件。
    </CommonCard>
    <div>
      <FormButton color="primary" @click="onClick">重置密码</FormButton>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { SettingsUserProfileChangePassword_UserFragment } from '~~/lib/common/generated/gql/graphql'
import { graphql } from '~~/lib/common/generated/gql'
import { usePasswordReset } from '~~/lib/auth/composables/passwordReset'

graphql(`
  fragment SettingsUserProfileChangePassword_User on User {
    id
    email
  }
`)

const { sendResetEmail } = usePasswordReset()

const props = defineProps<{
  user: SettingsUserProfileChangePassword_UserFragment
}>()

const onClick = async () => {
  const email = props.user.email
  if (!email) return
  await sendResetEmail(email)
}
</script>
