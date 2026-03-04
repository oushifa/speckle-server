<template>
  <div class="flex justify-center flex-col text-center my-12">
    <h2 class="text-heading mt-2 text-foreground">
      {{ !canCreateProject ? '暂无项目' : '创建您的第一个项目' }}
    </h2>
    <h4 class="text-body-xs mb-4 mt-2 max-w-xs mx-auto text-foreground-2">
      项目是您模型和版本的存储库。
    </h4>
    <div class="flex flex-col items-center gap-2">
      <FormButton
        v-if="canCreateProject"
        color="outline"
        class="shadow-lg"
        @click="$emit('create-project')"
      >
        创建新项目
      </FormButton>
    </div>
  </div>
</template>
<script setup lang="ts">
defineProps<{ canCreateProject: boolean | undefined }>()

defineEmits(['create-project'])
</script>
