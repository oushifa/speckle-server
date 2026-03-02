<template>
  <div>
    <nav
      class="fixed z-40 top-0 h-12 bg-gradient-to-r from-[#2c3e50] to-[#34495e] text-white shadow-xl border-outline-2"
    >
      <div
        class="flex gap-4 items-center justify-between h-full w-screen px-2 lg:pl-1.5"
      >
        <div class="hidden lg:flex lg:w-52">
          <HeaderWorkspaceSwitcher v-if="isWorkspacesEnabled && isLoggedIn" />
          <HeaderLogoBlock
            v-else
            :active="false"
            to="/"
            class="hidden lg:flex lg:min-w-40"
          />
        </div>
        <div class="flex items-center truncate gap-6">
          <FormButton
            v-for="link in links"
            :key="link"
            :color="link === 'BIM赋能' ? 'primary' : 'subtle'"
            class="text-white hover:!text-blue-400"
          >
            {{ link }}
          </FormButton>
          <!-- <ClientOnly>
            <PortalTarget name="mobile-navigation"></PortalTarget>
          </ClientOnly>
          <ClientOnly>
            <PortalTarget name="navigation"></PortalTarget>
          </ClientOnly> -->
        </div>
        <div class="flex items-center justify-end gap-2.5 sm:gap-2 lg:w-52">
          <ClientOnly>
            <PortalTarget name="secondary-actions"></PortalTarget>
            <PortalTarget name="primary-actions"></PortalTarget>
          </ClientOnly>
          <HeaderNavNotifications v-if="isLoggedIn" />
          <div v-if="!hideUserNav" class="flex justify-end items-center gap-x-2">
            <FormButton
              v-if="!activeUser"
              :to="loginUrl.fullPath"
              color="outline"
              class="hidden md:flex"
            >
              登录
            </FormButton>
            <!-- Profile dropdown -->
            <HeaderNavUserMenu :login-url="loginUrl" />
          </div>
        </div>
      </div>
    </nav>
    <PopupsSignIn v-if="!activeUser" />
  </div>
</template>
<script setup lang="ts">
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { loginRoute } from '~~/lib/common/helpers/route'
import type { Optional } from '@speckle/shared'

defineProps<{
  hideUserNav?: boolean
}>()

const links = ['前期要素', '勘察管控', 'BIM赋能', '风险预警', '智能决策', '孪生底座']
const isWorkspacesEnabled = useIsWorkspacesEnabled()
const { activeUser, isLoggedIn } = useActiveUser()
const route = useRoute()
const router = useRouter()

const token = computed(() => route.query.token as Optional<string>)

const loginUrl = computed(() =>
  router.resolve({
    path: loginRoute,
    query: {
      token: token.value || undefined
    }
  })
)
</script>
