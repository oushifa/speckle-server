<template>
  <ViewerCommentsPortalOrDiv class="relative" to="bottomPanel">
    <ViewerControlsRight
      v-if="isGreaterThanSm && showControls"
      :sidebar-open="sidebarOpen && shouldRenderSidebar"
      :sidebar-width="sidebarWidth"
    />
    <ViewerSidebar
      v-if="shouldRenderSidebar"
      :open="sidebarOpen"
      @close="onClose"
      @width-change="sidebarWidth = $event"
    >
      <template #title>
        <div class="flex items-center gap-x-2">
          <span>已选择</span>
          <CommonBadge v-if="objects.length > 1" rounded>
            {{ objects.length }}
          </CommonBadge>
        </div>
      </template>
      <template #actions>
        <div class="relative flex gap-x-0.5 items-center">
          <div ref="quickCardContainerRef">
            <ViewerQuickCardButton
              :active="showQuickCard"
              @click="showQuickCard = !showQuickCard"
            />
            <Teleport to="body">
              <div
                v-if="showQuickCard"
                ref="quickCardPanelRef"
                class="z-[1000] bg-foundation border border-outline-2 rounded-lg shadow-xl overflow-hidden"
                :style="quickCardPanelStyle"
              >
                <div
                  class="h-10 pl-4 pr-2 flex items-center border-b border-outline-2 text-body-xs text-foreground font-medium leading-none"
                >
                  快捷卡片
                </div>

                <!-- 单个构件时平铺展示 -->
                <div
                  v-if="objects.length <= 1"
                  class="simple-scrollbar overflow-y-auto max-h-[50dvh] py-1 pr-2"
                >
                  <div
                    v-if="objects.length === 1"
                    v-for="field in getQuickCardFieldsForObject(objects[0])"
                    :key="field.label"
                    class="grid grid-cols-3 w-full pl-2 h-5 items-center"
                  >
                    <div
                      class="col-span-1 truncate text-body-3xs mr-2 font-medium text-foreground-2"
                      :title="field.label"
                    >
                      {{ field.label }}
                    </div>
                    <div
                      class="col-span-2 pl-1 truncate text-body-3xs flex gap-1 items-center text-foreground"
                      :title="field.value"
                    >
                      <span class="truncate">{{ field.value }}</span>
                    </div>
                  </div>
                  <div v-else class="py-4 text-center text-body-xs text-foreground-2">
                    无选中构件
                  </div>
                </div>

                <!-- 多个构件时折叠面板列表展示 -->
                <div
                  v-else
                  class="simple-scrollbar overflow-y-auto max-h-[50dvh] p-2 space-y-1.5"
                >
                  <div
                    v-for="(obj, index) in objects"
                    :key="obj.id || index"
                    class="border border-outline-3 rounded overflow-hidden bg-foundation-2"
                  >
                    <!-- 折叠头部 -->
                    <button
                      type="button"
                      class="w-full flex items-center justify-between px-2 py-1.5 bg-foundation hover:bg-outline-3 text-left transition-colors"
                      @click="toggleObjectExpand(obj.id)"
                    >
                      <span class="text-body-3xs font-semibold text-foreground truncate">
                        {{ getObjectName(obj) }}
                      </span>
                      <ChevronRight
                        :class="`w-3.5 h-3.5 shrink-0 text-foreground-2 transition-transform duration-200 ${
                          expandedObjectIds.has(obj.id) ? 'rotate-90' : ''
                        }`"
                      />
                    </button>
                    <!-- 折叠展开的属性内容 -->
                    <div
                      v-if="expandedObjectIds.has(obj.id)"
                      class="p-1.5 space-y-0.5 bg-foundation border-t border-outline-3"
                    >
                      <div
                        v-for="field in getQuickCardFieldsForObject(obj)"
                        :key="field.label"
                        class="grid grid-cols-3 w-full pl-1 h-5 items-center"
                      >
                        <div
                          class="col-span-1 truncate text-body-3xs mr-1 font-medium text-foreground-2"
                          :title="field.label"
                        >
                          {{ field.label }}
                        </div>
                        <div
                          class="col-span-2 pl-1 truncate text-body-3xs flex gap-1 items-center text-foreground"
                          :title="field.value"
                        >
                          <span class="truncate">{{ field.value }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Teleport>
          </div>
          <ViewerVisibilityButton
            :is-hidden="isHidden"
            :force-visible="showSubMenu"
            @click="hideOrShowSelection"
          />
          <ViewerIsolateButton
            :is-isolated="isIsolated"
            :force-visible="showSubMenu"
            @click="isolateOrUnisolateSelection"
          />
          <LayoutMenu
            v-model:open="showSubMenu"
            :menu-id="menuId"
            :items="actionsItems"
            :custom-menu-items-classes="['!w-42']"
            @click.stop.prevent
            @chosen="onActionChosen"
          >
            <FormButton
              hide-text
              color="subtle"
              size="sm"
              :icon-left="Ellipsis"
              :class="{
                '!bg-highlight-3': showSubMenu
              }"
              @click="showSubMenu = !showSubMenu"
            />
          </LayoutMenu>
        </div>
      </template>

      <div class="space-y-1">
        <ViewerSelectionObject
          v-for="(object, index) in objectsLimited"
          :key="(object.id as string)"
          :object="object"
          :root="true"
          :unfold="index === 0 && !isSmallerOrEqualSm"
        />
      </div>
      <div v-if="itemCount <= objects.length" class="mb-2">
        <FormButton size="sm" text full-width @click="itemCount += 10">
          查看更多 ({{ objects.length - itemCount }})
        </FormButton>
      </div>

      <template #footer>
        <p class="text-foreground-2 text-body-3xs">按住 "shift" 键可选择多个对象</p>
      </template>
    </ViewerSidebar>
  </ViewerCommentsPortalOrDiv>
</template>
<script setup lang="ts">
import { onKeyStroke, useBreakpoints, useEventListener } from '@vueuse/core'
import type { CSSProperties } from 'vue'
import { useInjectedViewerState, useInjectedViewer } from '~~/lib/viewer/composables/setup'
import { getTargetObjectIds } from '~~/lib/object-sidebar/helpers'
import { containsAll } from '~~/lib/common/helpers/utils'
import { useSelectionUtilities } from '~~/lib/viewer/composables/ui'
import { useFilterUtilities } from '~/lib/viewer/composables/filtering/filtering'
import { uniqWith } from 'lodash-es'
import { useMixpanel } from '~~/lib/core/composables/mp'
import { useIsSmallerOrEqualThanBreakpoint } from '~~/composables/browser'
import { modelRoute } from '~/lib/common/helpers/route'
import { TailwindBreakpoints } from '~~/lib/common/helpers/tailwind'
import type { LayoutMenuItem } from '~~/lib/layout/helpers/components'
import { Ellipsis, ChevronRight } from 'lucide-vue-next'
import { useEmbed } from '~/lib/viewer/composables/setup/embed'
import type { QualityAcceptanceForm } from '~/components/projects/quality-acceptance/types'
import type { SpeckleObject } from '~~/lib/viewer/helpers/sceneExplorer'

enum ActionTypes {
  OpenInNewTab = 'open-in-new-tab'
}

const {
  projectId,
  viewer: {
    metadata: { filteringState }
  },
  ui: { diff, measurement, threads, filters },
  urlHashState: { focusedThreadId }
} = useInjectedViewerState()
const { objects, clearSelection } = useSelectionUtilities()
const viewer = useInjectedViewer()
const worldTree = computed(() => viewer.metadata.worldTree.value)

// 注入质量验收表单
const { apiOrigin } = useRuntimeConfig().public
const qualityAcceptanceForms = ref<QualityAcceptanceForm[]>([])
const fetchQualityAcceptanceForms = async () => {
  if (!projectId.value) return
  try {
    const data = await $fetch<any>(
      `${apiOrigin}/api/v1/projects/${projectId.value}/quality-acceptance/forms`,
      {
        params: {
          limit: 1000
        }
      }
    )
    if (data && data.items) {
      qualityAcceptanceForms.value = data.items
    }
  } catch (err) {
    console.error('Failed to fetch quality acceptance forms in sidebar:', err)
  }
}

watch(
  () => projectId.value,
  (newId) => {
    if (newId) {
      fetchQualityAcceptanceForms()
    }
  },
  { immediate: true }
)

provide('qualityAcceptanceForms', qualityAcceptanceForms)

// 快捷卡片展开收起机制
const expandedObjectIds = ref<Set<string>>(new Set())

const toggleObjectExpand = (id: string) => {
  if (expandedObjectIds.value.has(id)) {
    expandedObjectIds.value.delete(id)
  } else {
    expandedObjectIds.value.add(id)
  }
}

watch(
  () => objects.value,
  (newObjects) => {
    expandedObjectIds.value.clear()
    if (newObjects.length > 0 && newObjects[0].id) {
      expandedObjectIds.value.add(newObjects[0].id)
    }
  },
  { immediate: true, deep: true }
)

const { hideObjects, showObjects, isolateObjects, unIsolateObjects } =
  useFilterUtilities()

const { isSmallerOrEqualSm } = useIsSmallerOrEqualThanBreakpoint()
const breakpoints = useBreakpoints(TailwindBreakpoints)
const isGreaterThanSm = breakpoints.greater('sm')
const menuId = useId()
const mp = useMixpanel()
const { showControls } = useEmbed()

const itemCount = ref(20)
const sidebarOpen = ref(false)
const sidebarWidth = ref(280)
const showSubMenu = ref(false)
const showQuickCard = ref(false)
const quickCardContainerRef = ref<HTMLElement>()
const quickCardPanelRef = ref<HTMLElement>()

const quickCardPanelPosition = ref({
  top: 0,
  left: 0,
  width: 320
})

const quickCardPanelStyle = computed<CSSProperties>(() => {
  return {
    position: 'fixed',
    top: `${quickCardPanelPosition.value.top}px`,
    left: `${quickCardPanelPosition.value.left}px`,
    width: `${quickCardPanelPosition.value.width}px`,
    maxWidth: 'calc(100vw - 1rem)'
  }
})

type QuickCardField = {
  label: string
  aliases: string[]
}

type FlattenedEntry = {
  key: string
  path: string
  value: unknown
  units?: string
}

const quickCardFields: QuickCardField[] = [
  { label: '名称', aliases: ['名称', 'name'] },
  { label: '族名称', aliases: ['族名称', 'familyname', 'family'] },
  { label: '类型名称', aliases: ['类型名称', 'typename', 'type name'] },
  {
    label: '构件编码',
    aliases: ['构件编码', '构件编号', 'componentcode', 'elementcode']
  },
  { label: '分类对象代码', aliases: ['分类对象代码', 'classificationobjectcode'] },
  { label: '空间代码', aliases: ['空间代码', 'spacecode'] },
  { label: '分部分项代码', aliases: ['分部分项代码', 'sectionitemcode'] },
  { label: '序号码', aliases: ['序号码', '序号', 'serialnumber'] },
  { label: '结构材质', aliases: ['结构材质', '材质和装饰', '材质', 'material'] },
  { label: '长度', aliases: ['长度', 'length'] },
  { label: '面积', aliases: ['面积', 'area'] },
  { label: '厚度', aliases: ['厚度', 'thickness'] },
  { label: '顶部高程', aliases: ['顶部高程', 'topelevation'] },
  { label: '底部高程', aliases: ['底部高程', 'bottomelevation'] },
  { label: '体积', aliases: ['体积', 'volume'] },
  {
    label: '其他尺寸参数',
    aliases: ['其他尺寸参数', '尺寸参数', 'otherdimensions', 'otherdimension']
  }
]

const normalizedText = (value: string) => {
  return value.toLowerCase().replace(/[\s_.:/\\()[\]{}（）-]/g, '')
}

const formatDisplayValue = (value: unknown, units?: string) => {
  if (value === null || value === undefined || value === '') return '-'
  const unitsSuffix = units?.trim().length ? ` ${units}` : ''
  if (Array.isArray(value))
    return value.length ? `${value.join(', ')}${unitsSuffix}` : '-'
  if (typeof value === 'object') return '-'
  return `${String(value)}${unitsSuffix}`
}

const flattenObjectEntries = (
  input: unknown,
  currentPath = '',
  entries: FlattenedEntry[] = []
) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return entries

  const objectValue = input as Record<string, unknown>
  const ignoredKeys = new Set([
    '__closure',
    'displayMesh',
    'displayValue',
    'totalChildrenCount',
    '__importedUrl',
    '__parents',
    'bbox'
  ])

  for (const [key, rawValue] of Object.entries(objectValue)) {
    if (ignoredKeys.has(key)) continue

    const newPath = currentPath ? `${currentPath}.${key}` : key
    if (
      rawValue &&
      typeof rawValue === 'object' &&
      !Array.isArray(rawValue) &&
      'name' in (rawValue as Record<string, unknown>) &&
      'value' in (rawValue as Record<string, unknown>)
    ) {
      const param = rawValue as { name?: unknown; value?: unknown }
      const parameterName =
        typeof param.name === 'string' && param.name.length ? param.name : key
      entries.push({
        key: parameterName,
        path: newPath,
        value: param.value,
        units:
          'units' in param && typeof (param as { units?: unknown }).units === 'string'
            ? ((param as { units?: string }).units as string)
            : undefined
      })
      continue
    }

    if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      flattenObjectEntries(rawValue, newPath, entries)
      continue
    }

    entries.push({
      key,
      path: newPath,
      value: rawValue
    })
  }

  return entries
}

const getObjectName = (obj: SpeckleObject) => {
  const entries = flattenObjectEntries(obj)
  const nameEntry = entries.find(
    (entry) =>
      normalizedText(entry.key) === 'name' || normalizedText(entry.key) === '名称'
  )
  if (nameEntry && nameEntry.value) return String(nameEntry.value)
  return obj.name || obj.speckle_type || '未命名构件'
}

const getQuickCardFieldsForObject = (obj: SpeckleObject) => {
  const entries = flattenObjectEntries(obj)

  const findVal = (aliases: string[]) => {
    const normalizedAliases = aliases.map(normalizedText)
    const exactMatch = entries.find((entry) => {
      const keyNorm = normalizedText(entry.key)
      const pathNorm = normalizedText(entry.path)
      return normalizedAliases.some((alias) => keyNorm === alias || pathNorm === alias)
    })
    if (exactMatch) return formatDisplayValue(exactMatch.value, exactMatch.units)

    const fuzzyMatch = entries.find((entry) => {
      const keyNorm = normalizedText(entry.key)
      const pathNorm = normalizedText(entry.path)
      return normalizedAliases.some(
        (alias) => keyNorm.includes(alias) || pathNorm.includes(alias)
      )
    })
    if (fuzzyMatch) return formatDisplayValue(fuzzyMatch.value, fuzzyMatch.units)
    return '-'
  }

  const otherDimVal = () => {
    const matched = entries.filter((entry) => {
      const keyNorm = normalizedText(entry.key)
      const pathNorm = normalizedText(entry.path)
      return (
        keyNorm.includes('宽度') ||
        keyNorm.includes('高度') ||
        keyNorm.includes('直径') ||
        keyNorm.includes('半径') ||
        pathNorm.includes('宽度') ||
        pathNorm.includes('高度') ||
        pathNorm.includes('直径') ||
        pathNorm.includes('半径') ||
        keyNorm === 'b' ||
        keyNorm === 'h' ||
        pathNorm.endsWith('.b') ||
        pathNorm.endsWith('.h')
      )
    })
    if (!matched.length) return '-'
    return matched
      .slice(0, 5)
      .map((entry) => `${entry.key}: ${formatDisplayValue(entry.value, entry.units)}`)
      .join('；')
  }

  const node = (() => {
    if (!worldTree.value || !obj.id) return null
    const nodes = worldTree.value.findId(obj.id)
    return nodes && nodes.length ? nodes[0] : null
  })()

  return quickCardFields.map((field) => {
    if (field.label === '其他尺寸参数') {
      return {
        label: field.label,
        value: otherDimVal()
      }
    }
    if (field.label === '空间代码') {
      const val = findVal(field.aliases)
      if (val !== '-' && val !== '') return { label: field.label, value: val }
      if (node && node.model.subtreeId !== undefined) {
        const spaceCode = worldTree.value?.getSpaceCode(node.model.subtreeId)
        if (spaceCode) {
          return { label: field.label, value: spaceCode }
        }
      }
      return { label: field.label, value: '-' }
    }
    if (field.label === '构件编码') {
      const val = findVal(field.aliases)
      if (val !== '-' && val !== '') return { label: field.label, value: val }
      if (node) {
        const compCode = worldTree.value?.getComponentCode(node)
        if (compCode) {
          return { label: field.label, value: compCode }
        }
      }
      return { label: field.label, value: '-' }
    }
    return {
      label: field.label,
      value: findVal(field.aliases)
    }
  })
}

const objectsUniqueByAppId = computed(() => {
  if (!diff.enabled.value) return objects.value
  return uniqWith(objects.value, (a, b) => {
    return a.applicationId === b.applicationId
  })
})

const shouldRenderSidebar = computed(() => {
  return (!isSmallerOrEqualSm.value || sidebarOpen.value) && !measurement.enabled.value
})

const objectsLimited = computed(() => {
  return objectsUniqueByAppId.value.slice(0, itemCount.value)
})

const hiddenObjects = computed(() => filteringState.value?.hiddenObjects)
// Use singleton isolatedObjectsSet from viewer state
const { isolatedObjectsSet } = filters

const allTargetIds = computed(() => {
  const ids = []
  for (const obj of objects.value) {
    ids.push(...getTargetObjectIds(obj))
  }

  return ids
})

const isHidden = computed(() => {
  if (!hiddenObjects.value) return false
  return containsAll(allTargetIds.value, hiddenObjects.value)
})

const isIsolated = computed(() => {
  if (!isolatedObjectsSet.value) return false
  return containsAll(allTargetIds.value, isolatedObjectsSet.value)
})

const actionsItems = computed<LayoutMenuItem[][]>(() => [
  [
    {
      title:
        allTargetIds.value.length > 1 ? '在新标签页中打开对象' : '在新标签页中打开对象',
      id: ActionTypes.OpenInNewTab
    }
  ]
])

const selectionLink = computed(() => {
  return modelRoute(projectId.value, allTargetIds.value.join(','))
})

const onActionChosen = (params: { item: LayoutMenuItem; event: MouseEvent }) => {
  const { item } = params

  switch (item.id) {
    case ActionTypes.OpenInNewTab:
      window.open(selectionLink.value, '_blank')
      break
  }
}

const hideOrShowSelection = () => {
  if (!isHidden.value) {
    hideObjects(allTargetIds.value)
    mp.track('Viewer Action', {
      type: 'action',
      name: 'selection',
      action: 'hide'
    })
    return
  }

  showObjects(allTargetIds.value)
  mp.track('Viewer Action', {
    type: 'action',
    name: 'selection',
    action: 'show'
  })
}

const isolateOrUnisolateSelection = () => {
  if (isIsolated.value) {
    unIsolateObjects(allTargetIds.value)
    mp.track('Viewer Action', {
      type: 'action',
      name: 'selection',
      action: 'unisolate'
    })
  } else {
    isolateObjects(allTargetIds.value)
  }
}

const trackAndClearSelection = () => {
  clearSelection()
}

const onClose = () => {
  sidebarOpen.value = false
  trackAndClearSelection()
}

const forceClose = () => {
  sidebarOpen.value = false
}

const updateQuickCardPanelPosition = () => {
  if (!import.meta.client || !quickCardContainerRef.value) return
  const triggerRect = quickCardContainerRef.value.getBoundingClientRect()
  const width = Math.min(380, Math.max(260, window.innerWidth - 16))
  const gap = 4
  const viewportPadding = 8
  const preferredLeft = triggerRect.right - width
  const left = Math.max(
    viewportPadding,
    Math.min(preferredLeft, window.innerWidth - width - viewportPadding)
  )
  const top = triggerRect.bottom + gap

  quickCardPanelPosition.value = {
    top,
    left,
    width
  }
}

watch(showQuickCard, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  updateQuickCardPanelPosition()
})

watch([sidebarOpen, shouldRenderSidebar], ([isOpen, shouldRender]) => {
  if (!isOpen || !shouldRender) {
    showQuickCard.value = false
  }
})

if (import.meta.client) {
  useEventListener(window, 'resize', () => {
    if (!showQuickCard.value) return
    updateQuickCardPanelPosition()
  })

  useEventListener(window, 'scroll', () => {
    if (!showQuickCard.value) return
    updateQuickCardPanelPosition()
  })

  useEventListener(document, 'mousedown', (event) => {
    if (!showQuickCard.value) return
    const target = event.target as Node | null
    if (!target) return

    const clickedTrigger = !!quickCardContainerRef.value?.contains(target)
    const clickedPanel = !!quickCardPanelRef.value?.contains(target)
    if (clickedTrigger || clickedPanel) return

    showQuickCard.value = false
  })
}

onKeyStroke('Escape', () => {
  // Cleareance of any vis/iso state coming from here should happen in clearSelection()
  // Note: we're not using the trackAndClearSelection method beacuse
  // we want to track whether people press buttons or keys
  clearSelection()
  mp.track('Viewer Action', {
    type: 'action',
    name: 'selection',
    action: 'clear',
    source: 'keypress-escape'
  })
})

watch(
  [
    () => objects.value.length,
    () => focusedThreadId.value,
    () => threads.openThread.newThreadEditor.value,
    () => isSmallerOrEqualSm.value
  ],
  ([objLen, threadId, isNewThreadEditorOpen, isSmSm]) => {
    // Close sidebar if a thread is focused
    if (threadId) {
      sidebarOpen.value = false
      return
    }

    // Close sidebar if new thread editor is open and screen is small
    if (isNewThreadEditorOpen && isSmSm) {
      sidebarOpen.value = false
      return
    }

    // Open sidebar if objects are selected and no thread is focused
    if (objLen !== 0 && !threadId) {
      sidebarOpen.value = true
    } else if (objLen === 0) {
      sidebarOpen.value = false
    }
  }
)

defineExpose({
  forceClose
})
</script>
