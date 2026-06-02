<template>
  <div></div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: [
    () => {
      return navigateTo('/drawings')
    }
  ]
})
</script>
