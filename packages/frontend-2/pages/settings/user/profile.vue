<template>
  <div>
    <template v-if="user">
      <div class="md:max-w-xl md:mx-auto pb-6 md:pb-0">
        <SettingsSectionHeader title="个人资料" text="管理您的个人资料" />
        <SettingsUserProfileDetails :user="user" />
        <hr class="my-6 md:my-8 border-outline-2" />
        <SettingsUserProfileChangePassword :user="user" />
        <hr class="my-6 md:my-8 border-outline-2" />
        <SettingsUserProfileDeleteAccount :user="user" />
        <hr class="my-6 md:my-8 border-outline-2" />
        <div class="text-body-2xs text-foreground-2 w-full flex flex-col space-y-2">
          <div class="flex">
            用户 ID: #{{ user.id }}
            <ClipboardIcon
              class="w-4 h-4 ml-2 cursor-pointer hover:text-foreground transition"
              @click="copyUserId"
            />
          </div>
          <div v-if="distinctId" class="flex">
            {{ distinctId }}
            <ClipboardIcon
              class="w-4 h-4 ml-2 cursor-pointer hover:text-foreground transition"
              @click="copyDistinctId"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useActiveUser } from '~/lib/auth/composables/activeUser'
import { ClipboardIcon } from '@heroicons/vue/24/outline'

useHead({
  title: '设置 - 个人资料'
})

definePageMeta({
  layout: 'settings'
})

const { distinctId, activeUser: user } = useActiveUser()
const { copy } = useClipboard()

const copyUserId = () => {
  if (user.value) {
    copy(user.value.id)
  }
}

const copyDistinctId = () => {
  if (distinctId.value) {
    copy(distinctId.value)
  }
}
</script>
