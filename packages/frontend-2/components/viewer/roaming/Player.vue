<template>
  <div
    class="flex flex-col gap-2 p-3 bg-foundation border-t border-outline-3 select-none"
  >
    <!-- 顶部状态栏：路线名称、当前点位、时间 -->
    <div class="flex items-center justify-between text-body-2xs">
      <div class="flex items-center gap-1.5 font-medium text-foreground truncate">
        <span
          class="w-2 h-2 rounded-full"
          :class="isPlaying && !isPaused ? 'bg-success animate-pulse' : 'bg-outline-2'"
        />
        <span class="truncate">{{ route.name }}</span>
      </div>
      <div class="flex items-center gap-2 text-foreground-2">
        <span v-if="route.points.length > 0" class="text-body-3xs font-mono">
          点位 {{ currentPointIndex + 1 }}/{{ route.points.length }}
        </span>
        <span class="font-mono text-body-3xs">
          {{ formatTime(currentTime) }} / {{ formatTime(totalTime) }}
        </span>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="flex items-center gap-2">
      <input
        type="range"
        min="0"
        max="1"
        step="0.001"
        :value="progress"
        aria-label="漫游进度调节"
        class="w-full h-1.5 bg-outline-3 rounded-lg appearance-none cursor-pointer accent-primary"
        @input="onProgressInput"
      />
    </div>

    <!-- 底部控制按钮 -->
    <div class="flex items-center justify-between pt-1">
      <div class="flex items-center gap-1">
        <!-- 播放/暂停 -->
        <FormButton
          v-if="!isPlaying || isPaused"
          size="sm"
          color="outline"
          :icon-left="Play"
          hide-text
          class="!h-7 !w-7"
          @click="onPlayOrResume"
        />
        <FormButton
          v-else
          size="sm"
          color="outline"
          :icon-left="Pause"
          hide-text
          class="!h-7 !w-7"
          @click="$emit('pause')"
        />

        <!-- 停止 -->
        <FormButton
          size="sm"
          color="subtle"
          :icon-left="Square"
          hide-text
          class="!h-7 !w-7"
          @click="$emit('stop')"
        />
      </div>

      <div class="flex items-center gap-1.5">
        <!-- 倍速选择 -->
        <div class="relative">
          <button
            type="button"
            class="h-7 px-2 text-body-3xs font-mono rounded border border-outline-3 bg-foundation hover:bg-foundation-2 text-foreground flex items-center gap-0.5"
            @click="showSpeedMenu = !showSpeedMenu"
          >
            {{ playbackSpeed }}x
          </button>
          <div
            v-if="showSpeedMenu"
            class="absolute bottom-8 right-0 bg-foundation border border-outline-3 rounded-lg shadow-lg py-1 z-50 flex flex-col min-w-[70px]"
          >
            <button
              v-for="spd in [0.5, 1.0, 1.5, 2.0, 3.0]"
              :key="spd"
              type="button"
              class="px-3 py-1 text-left text-body-3xs hover:bg-primary/10 text-foreground font-mono"
              :class="playbackSpeed === spd ? 'text-primary font-bold' : ''"
              @click="
                $emit('set-speed', spd)
                showSpeedMenu = false
              "
            >
              {{ spd }}x
            </button>
          </div>
        </div>

        <!-- 循环模式切换 -->
        <FormButton
          size="sm"
          :color="isLoop ? 'primary' : 'subtle'"
          :icon-left="Repeat"
          hide-text
          class="!h-7 !w-7"
          @click="$emit('toggle-loop')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Play, Pause, Square, Repeat } from 'lucide-vue-next'
import { FormButton } from '@speckle/ui-components'
import type { RoamingRoute } from '~/lib/viewer/composables/roaming/types'

const props = defineProps<{
  route: RoamingRoute
  isPlaying: boolean
  isPaused: boolean
  currentPointIndex: number
  currentTime: number
  totalTime: number
  progress: number
  playbackSpeed: number
  isLoop: boolean
}>()

const emit = defineEmits<{
  (e: 'play', route: RoamingRoute): void
  (e: 'pause'): void
  (e: 'resume'): void
  (e: 'stop'): void
  (e: 'set-progress', val: number): void
  (e: 'set-speed', speed: number): void
  (e: 'toggle-loop'): void
}>()

const showSpeedMenu = ref(false)

const formatTime = (sec: number) => {
  const s = Math.floor(sec % 60)
  const m = Math.floor(sec / 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const onProgressInput = (event: Event) => {
  const val = Number((event.target as HTMLInputElement).value)
  emit('set-progress', val)
}

const onPlayOrResume = () => {
  if (props.isPlaying && props.isPaused) {
    emit('resume')
  } else {
    emit('play', props.route)
  }
}
</script>
