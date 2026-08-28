<template>
  <div class="flex flex-col h-full bg-foundation select-none">
    <!-- 头部标题栏 -->
    <div
      class="h-10 pl-4 pr-3 flex items-center justify-between border-b border-outline-3 shrink-0"
    >
      <div class="text-body-xs text-foreground font-medium flex items-center gap-1.5">
        <Footprints class="w-4 h-4 text-primary" />
        <span>{{ isEdit ? '编辑漫游路线' : '新建漫游路线' }}</span>
      </div>
      <FormButton
        size="sm"
        color="subtle"
        :icon-left="X"
        hide-text
        class="!h-7 !w-7"
        @click="$emit('close')"
      />
    </div>

    <!-- 主表单内容区域 -->
    <div class="flex-1 overflow-y-auto simple-scrollbar p-3 flex flex-col gap-3">
      <!-- 1. 路线名称 -->
      <div class="flex flex-col gap-1">
        <div class="text-body-2xs font-medium text-foreground">路线名称</div>
        <FormTextInput
          v-model="form.name"
          name="routeName"
          placeholder="请输入漫游路线名称..."
          size="sm"
          color="foundation"
        />
      </div>

      <!-- 2. 漫游模式选择 -->
      <div class="flex flex-col gap-1.5">
        <div class="text-body-2xs font-medium text-foreground">漫游模式</div>
        <ViewerButtonGroup class="w-full">
          <ViewerButtonGroupButton
            :is-active="form.mode === RoamingMode.Point"
            class="flex-1"
            @click="switchMode(RoamingMode.Point)"
          >
            <span
              class="text-body-2xs px-2 py-1 flex items-center justify-center gap-1"
            >
              <MapPin class="w-3.5 h-3.5" />
              <span>选点漫游</span>
            </span>
          </ViewerButtonGroupButton>
          <ViewerButtonGroupButton
            :is-active="form.mode === RoamingMode.View"
            class="flex-1"
            @click="switchMode(RoamingMode.View)"
          >
            <span
              class="text-body-2xs px-2 py-1 flex items-center justify-center gap-1"
            >
              <Camera class="w-3.5 h-3.5" />
              <span>视角漫游</span>
            </span>
          </ViewerButtonGroupButton>
        </ViewerButtonGroup>
      </div>

      <!-- 3. 选点模式专属操作 -->
      <div
        v-if="form.mode === RoamingMode.Point"
        class="flex flex-col gap-2 p-2.5 rounded-lg bg-foundation-2 border border-outline-3"
      >
        <div class="flex items-center justify-between">
          <span class="text-body-2xs font-medium text-foreground">模型表面选点</span>
          <FormButton
            size="sm"
            :color="isPicking ? 'danger' : 'primary'"
            :icon-left="isPicking ? Square : MousePointerClick"
            @click="togglePicking"
          >
            {{ isPicking ? '停止选点' : '开始选点' }}
          </FormButton>
        </div>
        <div
          v-if="isPicking"
          class="p-2 rounded bg-primary-muted text-primary text-body-3xs flex items-center gap-1.5 animate-pulse"
        >
          <span class="w-2 h-2 rounded-full bg-primary" />
          <span>正在选点中：请直接在 3D 模型表面点击添加路径点</span>
        </div>
        <div class="flex items-center justify-between pt-1">
          <span class="text-body-3xs text-foreground-2">人眼视高偏置</span>
          <div class="flex items-center gap-1">
            <input
              v-model.number="form.eyeHeight"
              type="number"
              step="0.1"
              min="0"
              max="10"
              aria-label="人眼视高偏置"
              class="w-16 h-6 px-1.5 text-body-3xs text-right rounded border border-outline-3 bg-foundation text-foreground focus:outline-none focus:border-primary"
            />
            <span class="text-body-3xs text-foreground-2">米</span>
          </div>
        </div>
      </div>

      <!-- 4. 视角模式专属操作 -->
      <div
        v-else
        class="flex flex-col gap-2 p-2.5 rounded-lg bg-foundation-2 border border-outline-3"
      >
        <div class="flex items-center justify-between">
          <span class="text-body-2xs font-medium text-foreground">当前视角保存</span>
          <FormButton
            size="sm"
            color="primary"
            :icon-left="Camera"
            @click="onCaptureView"
          >
            保存当前视角
          </FormButton>
        </div>
        <div class="text-body-3xs text-foreground-2">
          调整 3D 视图到满意的视角后，点击按钮将当前视角保存为漫游关键帧
        </div>
      </div>

      <!-- 5. 漫游参数全局设置 -->
      <div
        class="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-foundation-2 border border-outline-3"
      >
        <div class="flex items-center justify-between">
          <span class="text-body-3xs text-foreground-2">循环播放</span>
          <CommonSwitch v-model="form.loop" />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-body-3xs text-foreground-2">默认倍速</span>
          <select
            v-model.number="form.speed"
            aria-label="默认漫游倍速"
            class="h-6 px-1 rounded border border-outline-3 bg-foundation text-foreground focus:outline-none focus:border-primary text-body-3xs"
          >
            <option :value="0.5">0.5x</option>
            <option :value="1.0">1.0x</option>
            <option :value="1.5">1.5x</option>
            <option :value="2.0">2.0x</option>
          </select>
        </div>
      </div>

      <!-- 6. 点位列表 -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-body-2xs font-medium text-foreground">
            点位列表 ({{ form.points.length }})
          </span>
          <span class="text-body-3xs text-foreground-2">
            总时长 {{ totalDuration }}s
          </span>
        </div>

        <!-- 列表为空提示 -->
        <div
          v-if="form.points.length === 0"
          class="flex flex-col items-center justify-center p-6 border border-dashed border-outline-3 rounded-lg text-foreground-2 text-body-3xs gap-1.5"
        >
          <Route class="w-6 h-6 text-foreground-3" />
          <span>暂无点位，请点击上方按钮添加点位</span>
        </div>

        <!-- 点位列表项 -->
        <div v-else class="flex flex-col gap-1.5">
          <div
            v-for="(point, idx) in form.points"
            :key="point.id"
            role="button"
            tabindex="0"
            class="flex flex-col p-2.5 rounded-lg border transition cursor-pointer gap-1.5 text-body-3xs select-none"
            :class="[
              selectedPointIndex === idx
                ? 'border-primary ring-2 ring-primary/40 bg-primary-muted/20 shadow-sm'
                : 'border-outline-3 bg-foundation-2 hover:border-outline-2'
            ]"
            @click="selectPoint(idx)"
            @keydown.enter="selectPoint(idx)"
            @keydown.space.prevent="selectPoint(idx)"
          >
            <!-- 点位行头部：序号、名称、操作 -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 truncate">
                <span
                  class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 font-bold transition"
                  :class="[
                    selectedPointIndex === idx
                      ? 'bg-danger text-foreground-on-primary ring-2 ring-warning'
                      : 'bg-primary text-foreground-on-primary'
                  ]"
                >
                  {{ idx + 1 }}
                </span>
                <span
                  class="font-medium truncate"
                  :class="[
                    selectedPointIndex === idx
                      ? 'text-primary font-bold'
                      : 'text-foreground'
                  ]"
                >
                  {{ point.name || `点位 ${idx + 1}` }}
                </span>
                <span
                  v-if="selectedPointIndex === idx"
                  class="text-[10px] px-1 py-0.2 rounded bg-danger/10 text-danger font-medium shrink-0"
                >
                  当前选中
                </span>
              </div>
              <div class="flex items-center gap-0.5" @click.stop>
                <!-- 预览定位 -->
                <FormButton
                  size="sm"
                  color="subtle"
                  :icon-left="Eye"
                  hide-text
                  class="!h-6 !w-6"
                  title="定位到该点位"
                  @click="onPreviewPoint(point)"
                />
                <!-- 上移 -->
                <FormButton
                  size="sm"
                  color="subtle"
                  :icon-left="ArrowUp"
                  hide-text
                  :disabled="idx === 0"
                  class="!h-6 !w-6"
                  title="上移"
                  @click="movePoint(idx, -1)"
                />
                <!-- 下移 -->
                <FormButton
                  size="sm"
                  color="subtle"
                  :icon-left="ArrowDown"
                  hide-text
                  :disabled="idx === form.points.length - 1"
                  class="!h-6 !w-6"
                  title="下移"
                  @click="movePoint(idx, 1)"
                />
                <!-- 删除 -->
                <FormButton
                  size="sm"
                  color="subtle"
                  :icon-left="Trash2"
                  hide-text
                  class="!h-6 !w-6 hover:!text-danger"
                  title="删除"
                  @click="removePoint(idx)"
                />
              </div>
            </div>

            <!-- 参数设置：持续时间与动画曲线 -->
            <div
              class="grid grid-cols-2 gap-2 pt-1.5 border-t border-outline-3/50"
              @click.stop
            >
              <div class="flex items-center gap-1.5">
                <span class="text-foreground-2 shrink-0">用时:</span>
                <input
                  v-model.number="point.duration"
                  type="number"
                  step="0.5"
                  min="0.2"
                  max="60"
                  aria-label="点位用时"
                  class="w-full h-6 px-1.5 rounded border border-outline-3 bg-foundation text-foreground focus:outline-none focus:border-primary text-body-3xs"
                />
                <span class="text-foreground-2 shrink-0">秒</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-foreground-2 shrink-0">曲线:</span>
                <select
                  v-model="point.easing"
                  aria-label="点位缓动曲线"
                  class="w-full h-6 px-1 rounded border border-outline-3 bg-foundation text-foreground focus:outline-none focus:border-primary text-body-3xs"
                >
                  <option
                    v-for="(label, key) in EasingTypeLabels"
                    :key="key"
                    :value="key"
                  >
                    {{ label }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作区 -->
    <div
      class="p-3 border-t border-outline-3 flex items-center justify-between gap-2 shrink-0"
    >
      <FormButton
        size="sm"
        color="outline"
        :icon-left="isPlaying ? Square : Play"
        :disabled="form.points.length < 2"
        @click="onTrialPlay"
      >
        {{ isPlaying ? '停止试播' : '试播预览' }}
      </FormButton>

      <div class="flex items-center gap-2">
        <FormButton size="sm" color="subtle" @click="$emit('close')">取消</FormButton>
        <FormButton
          size="sm"
          color="primary"
          :icon-left="Check"
          :disabled="!form.name.trim() || form.points.length === 0"
          @click="onSave"
        >
          保存漫游
        </FormButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  X,
  Footprints,
  MapPin,
  Camera,
  MousePointerClick,
  Square,
  Route,
  Eye,
  ArrowUp,
  ArrowDown,
  Trash2,
  Play,
  Check
} from 'lucide-vue-next'
import { FormButton, FormTextInput } from '@speckle/ui-components'
import type { RoamingRoute, RoamingPoint } from '~/lib/viewer/composables/roaming/types'
import {
  RoamingMode,
  EasingType,
  EasingTypeLabels
} from '~/lib/viewer/composables/roaming/types'
import { useRoamingAnchoredState } from '~/lib/viewer/composables/roaming/useRoamingAnchoredState'

const props = defineProps<{
  routeData?: RoamingRoute | null
  isEdit?: boolean
  controller: ReturnType<
    typeof import('~/lib/viewer/composables/roaming/useRoamingController').useRoamingController
  >
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', route: Omit<RoamingRoute, 'id' | 'createdAt' | 'updatedAt'>): void
}>()

const {
  isPicking,
  isPlaying,
  startPicking,
  stopPicking,
  captureCurrentView,
  previewPoint,
  playRoute,
  stop,
  visualizer
} = props.controller

const { setActiveRoute, setSelectedPointIndex, registerPointSelectCallback } =
  useRoamingAnchoredState()

const selectedPointIndex = ref<number | null>(null)

const form = reactive<{
  name: string
  mode: RoamingMode
  points: RoamingPoint[]
  loop: boolean
  speed: number
  eyeHeight: number
}>({
  name:
    props.routeData?.name ||
    `漫游路线 ${new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })}`,
  mode: props.routeData?.mode || RoamingMode.Point,
  points: props.routeData?.points
    ? JSON.parse(JSON.stringify(props.routeData.points))
    : [],
  loop: props.routeData?.loop ?? false,
  speed: props.routeData?.speed ?? 1.0,
  eyeHeight: props.routeData?.eyeHeight ?? 1.6
})

const totalDuration = computed(() => {
  const sum = form.points.reduce((acc, p) => acc + (p.duration || 3), 0)
  return Number(sum.toFixed(1))
})

const selectPoint = (idx: number) => {
  selectedPointIndex.value = idx
  const pt = form.points[idx]
  if (pt) {
    onPreviewPoint(pt)
  }
  updateVisualizer()
}

const switchMode = (mode: RoamingMode) => {
  form.mode = mode
  if (isPicking.value) {
    stopPicking()
  }
  updateVisualizer()
}

const togglePicking = () => {
  if (isPicking.value) {
    stopPicking()
  } else {
    startPicking((point) => {
      const idx = form.points.length + 1
      const newPt: RoamingPoint = {
        id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: `点位 ${idx}`,
        position: point,
        target: [point[0], point[1], point[2]],
        duration: 3,
        easing: EasingType.EaseInOut,
        eyeHeight: form.eyeHeight
      }
      form.points.push(newPt)
      selectedPointIndex.value = form.points.length - 1
      updateVisualizer()
    })
  }
}

const onCaptureView = () => {
  const idx = form.points.length + 1
  const captured = captureCurrentView(`视角 ${idx}`, 3)
  if (captured) {
    form.points.push(captured)
    selectedPointIndex.value = form.points.length - 1
    updateVisualizer()
  }
}

const onPreviewPoint = (point: RoamingPoint) => {
  previewPoint(point, form.mode, form.eyeHeight)
}

const removePoint = (idx: number) => {
  form.points.splice(idx, 1)
  if (selectedPointIndex.value === idx) {
    selectedPointIndex.value =
      form.points.length > 0 ? Math.min(idx, form.points.length - 1) : null
  } else if (selectedPointIndex.value !== null && selectedPointIndex.value > idx) {
    selectedPointIndex.value--
  }
  updateVisualizer()
}

const movePoint = (idx: number, delta: number) => {
  const newIdx = idx + delta
  if (newIdx < 0 || newIdx >= form.points.length) return
  const temp = form.points[idx]
  form.points[idx] = form.points[newIdx]
  form.points[newIdx] = temp

  if (selectedPointIndex.value === idx) {
    selectedPointIndex.value = newIdx
  } else if (selectedPointIndex.value === newIdx) {
    selectedPointIndex.value = idx
  }

  updateVisualizer()
}

const updateVisualizer = () => {
  const previewRoute: RoamingRoute = {
    id: 'preview',
    name: form.name,
    mode: form.mode,
    points: form.points,
    loop: form.loop,
    speed: form.speed,
    eyeHeight: form.eyeHeight,
    createdAt: 0,
    updatedAt: 0
  }
  setActiveRoute(previewRoute)
  setSelectedPointIndex(selectedPointIndex.value)
  visualizer.renderRoute(previewRoute, selectedPointIndex.value)
}

const onTrialPlay = () => {
  if (isPlaying.value) {
    stop()
    updateVisualizer()
  } else {
    const previewRoute: RoamingRoute = {
      id: 'preview',
      name: form.name,
      mode: form.mode,
      points: form.points,
      loop: form.loop,
      speed: form.speed,
      eyeHeight: form.eyeHeight,
      createdAt: 0,
      updatedAt: 0
    }
    playRoute(previewRoute)
  }
}

const onSave = () => {
  if (!form.name.trim() || form.points.length === 0) return
  stop()
  stopPicking()
  setActiveRoute(null)
  setSelectedPointIndex(null)
  emit('save', {
    name: form.name.trim(),
    mode: form.mode,
    points: form.points,
    loop: form.loop,
    speed: form.speed,
    eyeHeight: form.eyeHeight
  })
}

watch(
  () => [form.points.length, form.mode, form.eyeHeight],
  () => {
    updateVisualizer()
  }
)

let unregisterCallback: (() => void) | null = null

onMounted(() => {
  if (form.points.length > 0) {
    selectedPointIndex.value = 0
  }
  updateVisualizer()
  unregisterCallback = registerPointSelectCallback((idx) => {
    selectPoint(idx)
  })
})

onUnmounted(() => {
  stop()
  stopPicking()
  setActiveRoute(null)
  setSelectedPointIndex(null)
  visualizer.clear()
  if (unregisterCallback) {
    unregisterCallback()
  }
})
</script>
