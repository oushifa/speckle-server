<template>
  <div>
    <div class="flex flex-col space-y-6">
      <SettingsSectionHeader title="删除账户" subheading />
      <CommonCard class="text-body-xs bg-foundation">
        我们将删除您是唯一所有者的所有项目，以及任何关联数据。
        我们将要求您输入您的电子邮件地址并点击删除按钮。
      </CommonCard>
      <div>
        <FormButton @click="toggleDeleteDialog">删除账户</FormButton>
      </div>
    </div>

    <SettingsUserProfileDeleteAccountDialog
      v-model:open="showDeleteDialog"
      :user="user"
    />
  </div>
</template>

<script setup lang="ts">
import type { SettingsUserProfileDeleteAccount_UserFragment } from '~~/lib/common/generated/gql/graphql'

defineProps<{
  user: SettingsUserProfileDeleteAccount_UserFragment
}>()

const showDeleteDialog = ref(false)

function toggleDeleteDialog() {
  showDeleteDialog.value = true
}
</script>
