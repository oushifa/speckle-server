<template>
  <div
    class="flex flex-col border border-outline-3 rounded-lg overflow-hidden bg-foundation transition shadow-sm hover:border-outline-2"
    :class="[isCurrentPlaying ? 'ring-1 ring-success border-success' : '']"
  >
    <!-- 卡片头部信息与操作栏 -->
    <div
      role="button"
      tabindex="0"
      class="flex items-center justify-between p-2.5 bg-foundation cursor-pointer select-none"
      @click="isExpanded = !isExpanded"
      @keydown.enter="isExpanded = !isExpanded"
      @keydown.space.prevent="isExpanded = !isExpanded"
    >
      <div class="flex items-center gap-2 min-w-0">
        <component
          :is="isExpanded ? ChevronDown : ChevronRight"
          class="w-4 h-4 text-foreground-2 shrink-0"
        />
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-1.5 truncate">
            <span class="text-body-xs font-medium text-foreground truncate">
              {{ route.name }}
            </span>
            <span
              class="px-1.5 py-0.5 text-body-3xs rounded text-foreground-2 shrink-0 font-normal"
              :class="
                route.mode === RoamingMode.Point
                  ? 'bg-success-lightest text-success dark:text-success-lighter'
                  : 'bg-purple-500/10 text-purple-500 dark:text-purple-400'
              "
            >
              {{ route.mode === RoamingMode.Point ? '选点漫游' : '视角漫游' }}
            </span>
          </div>
          <div class="flex items-center gap-2 text-body-3xs text-foreground-2 mt-0.5">
            <span>{{ route.points.length }} 个点位</span>
            <span>·</span>
            <span>总时长 {{ totalDuration }}s</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮群 -->
      <div class="flex items-center gap-1 shrink-0" @click.stop>
        <!-- 播放/暂停按钮 -->
        <FormButton
          size="sm"
          :color="isCurrentPlaying && !isPaused ? 'primary' : 'subtle'"
          :class="
            isCurrentPlaying && !isPaused
              ? '!bg-success !text-white focus-visible:!border-success'
              : ''
          "
          :icon-left="isCurrentPlaying && !isPaused ? Pause : Play"
          hide-text
          class="!h-7 !w-7"
          @click="onPlayClick"
        />

        <!-- 编辑按钮 -->
        <FormButton
          size="sm"
          color="subtle"
          :icon-left="Pencil"
          hide-text
          class="!h-7 !w-7"
          @click="$emit('edit', route)"
        />

        <!-- 删除按钮 -->
        <FormButton
          size="sm"
          color="subtle"
          :icon-left="Trash2"
          hide-text
          class="!h-7 !w-7 hover:!text-danger"
          @click="$emit('delete', route)"
        />
      </div>
    </div>

    <!-- 展开的点位列表 -->
    <div
      v-if="isExpanded"
      class="flex flex-col border-t border-outline-3 bg-foundation-2 p-2 gap-1 max-h-64 overflow-y-auto simple-scrollbar"
    >
      <div
        v-for="(point, idx) in route.points"
        :key="point.id"
        role="button"
        tabindex="0"
        class="flex items-center justify-between px-2 py-1 rounded text-body-3xs bg-foundation hover:bg-foundation-3 transition cursor-pointer"
        @click="$emit('preview-point', route, point, idx)"
        @keydown.enter="$emit('preview-point', route, point, idx)"
        @keydown.space.prevent="$emit('preview-point', route, point, idx)"
      >
        <div class="flex items-center gap-1.5 text-foreground truncate">
          <span
            class="w-4 h-4 rounded-full bg-outline-3 flex items-center justify-center text-[10px] font-mono shrink-0"
          >
            {{ idx + 1 }}
          </span>
          <span class="truncate">{{ point.name || `点位 ${idx + 1}` }}</span>
        </div>
        <div class="flex items-center gap-2 text-foreground-2 shrink-0">
          <span class="font-mono">{{ point.duration }}s</span>
          <span class="text-foreground-3 text-[10px]">
            {{ EasingTypeLabels[point.easing] || '平滑' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronRight, ChevronDown, Play, Pause, Pencil, Trash2 } from 'lucide-vue-next'
import { FormButton } from '@speckle/ui-components'
import type { RoamingRoute, RoamingPoint } from '~/lib/viewer/composables/roaming/types'
import { RoamingMode, EasingTypeLabels } from '~/lib/viewer/composables/roaming/types'

const props = defineProps<{
  route: RoamingRoute
  isCurrentPlaying: boolean
  isPaused: boolean
}>()

const emit = defineEmits<{
  (e: 'play', route: RoamingRoute): void
  (e: 'pause'): void
  (e: 'resume'): void
  (e: 'edit', route: RoamingRoute): void
  (e: 'delete', route: RoamingRoute): void
  (e: 'preview-point', route: RoamingRoute, point: RoamingPoint, idx: number): void
}>()

const isExpanded = ref(false)

const totalDuration = computed(() => {
  const sum = props.route.points.reduce((acc, p) => acc + (p.duration || 3), 0)
  return Number(sum.toFixed(1))
})

const onPlayClick = () => {
  if (props.isCurrentPlaying) {
    if (props.isPaused) {
      emit('resume')
    } else {
      emit('pause')
    }
  } else {
    emit('play', props.route)
  }
}
</script>
