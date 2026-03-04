<template>
  <div
    class="relative rounded-md overflow-hidden aspect-[896/405] max-h-[405px] w-full"
  >
    <figure v-if="isDarkTheme" class="absolute w-full">
      <img
        src="~/assets/images/connectors/hero_dark.webp"
        alt="Speckle Connectors"
        class="w-full h-auto aspect-[896/405] object-cover"
      />
      <img
        src="~/assets/images/connectors/hero_dark.webp"
        alt="Speckle Connectors"
        class="absolute bottom-0 left-0 w-full h-[125px] aspect-[896/405] object-cover object-left-bottom blur-[20px]"
      />
    </figure>
    <figure v-else class="absolute w-full">
      <img
        src="~/assets/images/connectors/hero_light.webp"
        alt="Speckle Connectors"
        class="w-full h-auto aspect-[896/405] object-cover"
      />
      <img
        src="~/assets/images/connectors/hero_light.webp"
        alt="Sync data in real time"
        class="absolute bottom-0 left-0 w-full h-[125px] aspect-[896/405] object-cover object-left-bottom blur-[20px]"
      />
    </figure>

    <div class="absolute bottom-0 w-full p-6">
      <h3>实时同步模型数据</h3>
      <p class="text-body-xs text-foreground-2 mt-2 max-w-md text-balance">
        使用我们定制的连接器，在最流行的 AEC 应用程序之间提取和交换数据。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTheme } from '~/lib/core/composables/theme'

const { isDarkTheme } = useTheme()
</script>
