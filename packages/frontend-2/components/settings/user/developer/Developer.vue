<template>
  <section>
    <div class="md:max-w-5xl md:mx-auto pb-6 md:pb-0">
      <div class="flex flex-col">
        <SettingsSectionHeader title="开发人员设置" text="管理您的令牌和已授权应用" />
        <div class="flex flex-col gap-6">
          <div class="flex flex-col">
            <SettingsSectionHeader
              title="探索 GraphQL"
              class="md:gap-0"
              subheading
              :buttons="[
                {
                  props: {
                    color: 'outline',
                    target: '_blank',
                    external: true
                  },
                  onClick: goToExplorer,
                  label: '打开浏览器'
                }
              ]"
            />
          </div>

          <hr class="border-outline-3" />
          <SettingsUserDeveloperAccessTokens @delete="openDeleteDialog" />
          <hr class="border-outline-3" />
          <SettingsUserDeveloperApplications @delete="openDeleteDialog" />
          <hr class="border-outline-3" />
          <SettingsUserDeveloperAuthorizedApps @delete="openDeleteDialog" />
        </div>
      </div>
      <SettingsUserDeveloperDeleteDialog
        v-model:open="showDeleteDialog"
        :item="itemToModify"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  TokenItem,
  ApplicationItem,
  AuthorizedAppItem
} from '~~/lib/developer-settings/helpers/types'

useHead({
  title: 'Developer Settings'
})

const apiOrigin = useApiOrigin()

const itemToModify = ref<TokenItem | ApplicationItem | AuthorizedAppItem | null>(null)
const showDeleteDialog = ref(false)

const openDeleteDialog = (item: TokenItem | ApplicationItem | AuthorizedAppItem) => {
  itemToModify.value = item
  showDeleteDialog.value = true
}

const goToExplorer = () => {
  if (!import.meta.client) return
  window.location.href = new URL('/explorer', apiOrigin).toString()
}
</script>
