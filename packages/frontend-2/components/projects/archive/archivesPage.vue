<template>
  <div class="">
    <h1 class="text-heading-lg text-foreground mt-3 mb-4">档案管理</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div
        v-for="archive in archives"
        :key="archive.id"
        class="group flex flex-col items-center justify-center p-16 bg-white border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/30 transition-all duration-200 cursor-pointer"
      >
        <FolderIcon
          class="w-16 h-16 text-blue-600 mb-4 group-hover:scale-110 transition-transform duration-200"
        />
        <h3 class="text-xl font-bold text-gray-900 mb-2">{{ archive.title }}</h3>
        <p class="text-gray-500">{{ archive.count }} 个文件</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FolderIcon } from '@heroicons/vue/24/outline'
import { ref } from 'vue'

const archives = ref([
  { id: 1, title: '标段A', count: 240 },
  { id: 2, title: '标段B', count: 185 }
])
</script>
