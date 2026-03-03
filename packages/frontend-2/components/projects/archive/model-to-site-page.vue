<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h1 class="text-heading-lg text-foreground mt-3">质量验收</h1>
    </div>

    <div class="bg-foundation rounded-lg border border-outline-3 p-8">
      <h2 class="text-lg font-bold text-foreground mb-6">选择三维模型</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div
          v-for="model in models"
          :key="model.id"
          class="group relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-outline-3 p-16 hover:border-primary hover:bg-primary-muted/5 transition-all cursor-pointer"
        >
          <IconModelfiles
            class="w-16 h-16 text-foreground-2 group-hover:text-primary transition-colors"
          />
          <span
            class="text-lg font-medium text-foreground group-hover:text-primary transition-colors"
          >
            {{ model.name }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const models = [
  {
    id: '1',
    name: '建筑模型_主体工程_v1'
  },
  {
    id: '2',
    name: '建筑模型_装饰工程_v2'
  }
]
</script>
