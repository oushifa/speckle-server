<template>
  <div
    :class="`${
      isModifiedQuery.modified && root
        ? 'outline outline-2 rounded py-1 px-1 outline-amber-500'
        : ''
    }`"
  >
    <div class="mb-1 flex items-center">
      <button
        class="flex h-full w-full pl-1 pr-2 py-1 items-center gap-1 rounded-[2px] bg-foundation-2"
        @click="unfold = !unfold"
        @mouseenter="highlightObject"
        @focusin="highlightObject"
        @mouseleave="unhighlightObject"
        @focusout="unhighlightObject"
      >
        <IconTriangle
          :class="`h-3 w-3 shrink-0 ${headerClasses} ${unfold ? 'rotate-90' : ''}`"
        />
        <div :class="`truncate text-body-3xs font-medium ${headerClasses}`">
          <!-- @vue-ignore -->
          {{
            REVIT_PROPERTY_NAME_ZH_MAP[title] ||
            REVIT_PROPERTY_NAME_ZH_MAP[headerAndSubheader.header] ||
            title ||
            headerAndSubheader.header
          }}
          <span
            v-if="(props.root || props.modifiedSibling) && isModifiedQuery.modified"
          >
            {{ isModifiedQuery.isNew ? '(新)' : '(旧)' }}
          </span>
        </div>
      </button>
    </div>
    <div v-if="unfold" class="space-y-1 pl-0 py-1 pr-2">
      <!-- 关联质量验收附件 -->
      <div
        v-if="root && associatedAttachments.length"
        class="mb-3 mx-2 p-2 bg-foundation border border-outline-3 rounded-lg text-body-3xs"
      >
        <div class="flex items-center gap-1 text-body-3xs font-semibold text-foreground mb-2">
          <Paperclip class="h-3 w-3 text-primary shrink-0" />
          <span>关联质量验收附件 ({{ associatedAttachments.length }})</span>
        </div>
        <div class="space-y-1.5 max-h-48 overflow-y-auto simple-scrollbar">
          <div
            v-for="(item, index) in associatedAttachments"
            :key="index"
            class="flex items-center justify-between gap-2"
          >
            <div class="flex items-center gap-1 min-w-0 flex-grow">
              <span class="text-foreground-2 shrink-0">[{{ item.formName }}]</span>
              <button
                type="button"
                class="text-primary hover:underline truncate text-left"
                :title="item.attachment.fileName"
                @click="openPreview(item.attachment)"
              >
                {{ item.attachment.fileName }}
              </button>
            </div>
            <span class="text-foreground-3 shrink-0">
              {{ item.attachment.fileSize ? prettyFileSize(item.attachment.fileSize) : '' }}
            </span>
          </div>
        </div>
      </div>
      <!-- key value pair display -->
      <ViewerSelectionKeyValuePair
        v-for="(kvp, index) in [
          ...categorisedValuePairs.primitives,
          ...categorisedValuePairs.nulls
        ]"
        :key="index"
        :kvp="kvp"
      />
      <div
        v-for="(kvp, index) in categorisedValuePairs.objects"
        :key="index"
        class="pl-2"
      >
        <ViewerSelectionObject
          :object="(kvp.value as SpeckleObject) || {}"
          :title="(kvp.key as string)"
          :unfold="autoUnfoldKeys.includes(kvp.key)"
          :parent-path="currentPath"
        />
      </div>
      <div
        v-for="(kvp, index) in categorisedValuePairs.nonPrimitiveArrays"
        :key="index"
        class="text-body-3xs"
      >
        <div class="text-foreground-2 grid grid-cols-3 pl-2">
          <div
            class="col-span-1 truncate text-body-3xs font-medium"
            :title="(kvp.key as string)"
          >
            {{ REVIT_PROPERTY_NAME_ZH_MAP[kvp.key] || kvp.key }}
          </div>
          <div
            class="col-span-2 flex w-full min-w-0 truncate text-body-3xs pl-1 text-foreground"
          >
            <div class="flex-grow truncate">{{ kvp.innerType }} array</div>
            <div class="text-foreground-2">({{ kvp.arrayLength }})</div>
          </div>
        </div>
      </div>
      <div v-for="(kvp, index) in categorisedValuePairs.primitiveArrays" :key="index">
        <div class="grid grid-cols-3">
          <div
            class="col-span-1 truncate text-body-3xs font-medium pl-2 text-foreground-2"
            :title="(kvp.key as string)"
          >
            {{ REVIT_PROPERTY_NAME_ZH_MAP[kvp.key] || kvp.key }}
          </div>
          <div
            class="col-span-2 flex w-full min-w-0 truncate text-body-3xs text-foreground"
            :title="(kvp.value as string)"
          >
            <div class="pl-2.5 flex-grow truncate">{{ kvp.arrayPreview }}</div>
            <div class="text-foreground-2">({{ kvp.arrayLength }})</div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="isModifiedQuery.modified && isModifiedQuery.pair && root" class="mt-2">
      <ViewerSelectionObject :object="isModifiedQuery.pair" :modified-sibling="true" />
    </div>

    <!-- 附件预览 Dialog -->
    <LayoutDialog
      v-model:open="attachmentsDialogOpen"
      max-width="xl"
      fullscreen="all"
      :buttons="attachmentDialogButtons"
    >
      <template #header>
        {{ selectedPreviewAttachment ? selectedPreviewAttachment.fileName : '附件预览' }}
      </template>
      <template v-if="selectedPreviewAttachment">
        <div class="w-full h-[60dvh] flex flex-col justify-center text-foreground text-body-xs px-6 pb-6 pt-2">
          <CommonFilePreview
            :blob-id="selectedPreviewAttachment.id"
            :project-id="projectId"
            :file-name="selectedPreviewAttachment.fileName"
            :file-type="selectedPreviewAttachment.fileType"
            :file-size="selectedPreviewAttachment.fileSize"
            class="w-full flex-1 h-full"
          />
        </div>
      </template>
    </LayoutDialog>
  </div>
</template>
<script setup lang="ts">
import { inject, type Ref } from 'vue'
import type { SpeckleObject } from '~~/lib/viewer/helpers/sceneExplorer'
import { getHeaderAndSubheaderForSpeckleObject } from '~~/lib/object-sidebar/helpers'
import { useInjectedViewerState } from '~~/lib/viewer/composables/setup'
import { useHighlightedObjectsUtilities } from '~/lib/viewer/composables/ui'
import type { KeyValuePair } from '~/components/viewer/selection/types'
import { REVIT_PROPERTY_NAME_ZH_MAP } from '~/lib/viewer/helpers/filters/constants'
import type { QualityAcceptanceForm, QualityAcceptanceAttachment } from '~/components/projects/quality-acceptance/types'
import { useFileDownload } from '~/lib/core/composables/fileUpload'
import { prettyFileSize } from '~/lib/core/helpers/file'
import { Paperclip, Download } from 'lucide-vue-next'

const {
  projectId,
  ui: {
    diff: { result, enabled: diffEnabled }
  }
} = useInjectedViewerState()

const qualityAcceptanceForms = inject<Ref<QualityAcceptanceForm[]>>('qualityAcceptanceForms', ref([]))

const props = withDefaults(
  defineProps<{
    object: SpeckleObject
    root?: boolean
    title?: string
    unfold?: boolean
    debug?: boolean
    modifiedSibling?: boolean
    parentPath?: string
  }>(),
  { debug: false, unfold: false, root: false, modifiedSibling: false }
)

const { highlightObjects, unhighlightObjects } = useHighlightedObjectsUtilities()
const unfold = ref(props.unfold)
const autoUnfoldKeys = ['properties', 'Instance Parameters']

// Compute the current full path for this object
const currentPath = computed(() => {
  if (props.root) return ''
  if (!props.parentPath) return props.title || ''
  return props.parentPath
    ? `${props.parentPath}.${props.title || ''}`
    : props.title || ''
})

const isAdded = computed(() => {
  if (!diffEnabled.value) return false
  return (
    result.value?.added.findIndex(
      (o) => (o.model.raw as SpeckleObject).applicationId === props.object.applicationId
    ) !== -1
  )
})

const isRemoved = computed(() => {
  if (!diffEnabled.value) return false
  return (
    result.value?.removed.findIndex(
      (o) => (o.model.raw as SpeckleObject).applicationId === props.object.applicationId
    ) !== -1
  )
})

const isUnchanged = computed(() => {
  if (!diffEnabled.value) return false
  return (
    result.value?.unchanged.findIndex(
      (o) => (o.model.raw as SpeckleObject).applicationId === props.object.applicationId
    ) !== -1
  )
})

const isModifiedQuery = computed(() => {
  // if (props.modifiedSibling) return { modified: false } // prevent recursion?
  if (!diffEnabled.value) return { modified: false }
  const modifiedObjectPairs = result.value?.modified.map((pair) => {
    return [pair[0].model.raw as SpeckleObject, pair[1].model.raw as SpeckleObject]
  })
  if (!modifiedObjectPairs) return { modified: false }
  const obj = props.object
  const pairedItems = modifiedObjectPairs.find(
    (item) => item[0].id === obj.id || item[1].id === obj.id
  )
  if (!pairedItems) return { modified: false }
  const pair = pairedItems[0].id === obj.id ? pairedItems[1] : pairedItems[0]
  if (!pair) return { modified: false }
  return {
    modified: true,
    pair,
    isNew: pairedItems[0].id !== obj.id
  }
})

const headerClasses = computed(() => {
  if (props.modifiedSibling) return 'text-amber-500'
  if (!props.root) return ''
  if (!diffEnabled.value) return ''
  if (!Object.keys(props.object).includes('applicationId')) return ''
  if (isAdded.value) return 'text-green-500'
  if (isRemoved.value) return 'text-red-500'
  if (isUnchanged.value) return 'text-foreground-2'
  return 'text-amber-500'
})

const headerAndSubheader = computed(() => {
  return getHeaderAndSubheaderForSpeckleObject(props.object)
})

const ignoredProps = [
  '__closure',
  'displayMesh',
  'displayValue',
  'totalChildrenCount',
  '__importedUrl',
  '__parents',
  'bbox'
]

const keyValuePairs = computed(() => {
  const kvps: KeyValuePair[] = []

  // handle revit paramters
  if (props.title === 'parameters') {
    const paramKeys = Object.keys(props.object)
    for (const prop of paramKeys) {
      const param = props.object[prop]
      if (!param || typeof param !== 'object' || param === null) continue
      if (!('name' in param) || typeof param.name !== 'string') continue
      if (!('value' in param)) continue

      kvps.push({
        key: param.name,
        type: typeof param.value,
        innerType: null,
        arrayLength: null,
        arrayPreview: null,
        value: param.value
      })
    }
    return kvps
  }

  const objectKeys = Object.keys(props.object)
  for (const key of objectKeys) {
    if (ignoredProps.includes(key)) continue

    const type = Array.isArray(props.object[key]) ? 'array' : typeof props.object[key]
    let innerType = null
    let arrayLength = null
    let arrayPreview = null
    if (type === 'array') {
      const arr = props.object[key] as unknown[]
      arrayLength = arr.length
      if (arr.length > 0) {
        innerType = Array.isArray(arr[0]) ? 'array' : typeof arr[0]
        // We truncate this above with css - but limit to 100 to limit dom size
        arrayPreview = arr.slice(0, 100).join(', ')
      }
    }

    if (
      props.object[key] &&
      isNameValuePair(props.object[key] as Record<string, unknown>)
    ) {
      // note: handles name value pairs from dui3 -
      const { value, units } = props.object[key] as { value: string; units?: string }
      const fullPath = currentPath.value ? `${currentPath.value}.${key}` : key
      kvps.push({
        key,
        type: typeof value,
        value: value as string,
        units,
        backendPath: fullPath
      })
      continue
    }
    const fullPath = currentPath.value ? `${currentPath.value}.${key}` : key
    kvps.push({
      key,
      type,
      innerType,
      arrayLength,
      arrayPreview,
      value: props.object[key],
      backendPath: fullPath
    })
  }

  return kvps
})

const isNameValuePair = (obj: Record<string, unknown>) => {
  const keys = Object.keys(obj)
  return keys.includes('name') && keys.includes('value')
}

const categorisedValuePairs = computed(() => {
  return {
    primitives: keyValuePairs.value.filter(
      (item) => item.type !== 'object' && item.type !== 'array' && item.value !== null
    ),
    objects: keyValuePairs.value
      .filter((item) => item.type === 'object' && item.value !== null)
      .filter((item) => {
        const keys = Object.keys(item.value as unknown as Record<string, unknown>)
        const nvp = keys.includes('name') && keys.includes('value')
        return !nvp
      }) // filters out name value pairs - note on new properties structure coming out of DUI3
      .sort((a, b) => a.key.toLowerCase().localeCompare(b.key.toLowerCase())),
    nonPrimitiveArrays: keyValuePairs.value.filter(
      (item) =>
        item.type === 'array' &&
        item.value !== null &&
        (item.innerType === 'object' || item.innerType === 'array')
    ),
    primitiveArrays: keyValuePairs.value.filter(
      (item) =>
        item.type === 'array' &&
        item.value !== null &&
        !(item.innerType === 'object' || item.innerType === 'array')
    ),
    nulls: keyValuePairs.value.filter((item) => item.value === null)
  }
})

const highlightObject = () => {
  if (props.object.id && typeof props.object.id === 'string') {
    highlightObjects([props.object.id])
  }
}

const unhighlightObject = () => {
  if (props.object.id && typeof props.object.id === 'string') {
    unhighlightObjects([props.object.id])
  }
}

watch(
  () => props.unfold,
  (newVal) => {
    unfold.value = newVal
  }
)

const associatedForms = computed(() => {
  if (!props.root || !props.object?.applicationId || !qualityAcceptanceForms.value.length) {
    return []
  }
  const appId = props.object.applicationId
  return qualityAcceptanceForms.value.filter((form) => {
    return form.BIM?.some((bim) => bim.applicationIds?.includes(appId))
  })
})

const associatedAttachments = computed(() => {
  const list: { formName: string; attachment: QualityAcceptanceAttachment }[] = []
  for (const form of associatedForms.value) {
    if (form.attachments && form.attachments.length) {
      for (const att of form.attachments) {
        list.push({
          formName: form.name,
          attachment: att
        })
      }
    }
  }
  return list
})

const attachmentsDialogOpen = ref(false)
const selectedPreviewAttachment = ref<QualityAcceptanceAttachment | null>(null)
const { download } = useFileDownload()

const openPreview = (attachment: QualityAcceptanceAttachment) => {
  selectedPreviewAttachment.value = attachment
  attachmentsDialogOpen.value = true
}

const attachmentDialogButtons = computed(() => {
  if (!selectedPreviewAttachment.value) return undefined
  return [
    {
      text: selectedPreviewAttachment.value.fileSize
        ? prettyFileSize(selectedPreviewAttachment.value.fileSize)
        : '下载',
      props: {
        iconLeft: Download,
        color: 'outline' as const
      },
      onClick: async () => {
        if (!selectedPreviewAttachment.value || !projectId.value) return
        try {
          await download({
            blobId: selectedPreviewAttachment.value.id,
            fileName: selectedPreviewAttachment.value.fileName,
            projectId: projectId.value
          })
        } catch (err) {
          console.error('Failed to download attachment:', err)
        }
      }
    }
  ]
})
</script>
