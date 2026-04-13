<template>
  <div>
    <Portal to="navigation">
      <!-- <HeaderNavLink :to="projectsRoute" name="Projects" :separator="false" /> -->
      <div>数智南北</div>
    </Portal>
    <ArchivesPage />
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

useHead({
  title: '档案管理'
})

console.log(dayjs().from('2026-04-10'))

definePageMeta({
  middleware: ['auth']
})
</script>
