<template>
  <div>
    <Portal to="navigation">
      <!-- <HeaderNavLink :to="projectsRoute" name="Projects" :separator="false" /> -->
      <div>数智南北</div>
    </Portal>
    <ProjectsDashboard v-if="isLoggedIn" />
    <div v-else class="mx-auto">
      <CommonLoadingIcon />
    </div>
  </div>
</template>
<script setup lang="ts">
import { useActiveUser } from '~~/lib/auth/composables/activeUser'

useHead({
  title: '项目管理'
})

definePageMeta({
  middleware: ['auth', 'projects-active-check']
})

const { isLoggedIn } = useActiveUser()
</script>
