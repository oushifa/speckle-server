<template>
  <div
    class="flex flex-col gap-3 border-t border-outline-3 px-4 py-3 text-[13px] leading-5 text-foreground-2 sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex flex-wrap items-center gap-2">
      <span>每页显示</span>
      <label :for="pageSizeSelectId" class="sr-only">每页显示条数</label>
      <select
        :id="pageSizeSelectId"
        v-model="pageSizeModel"
        class="rounded border border-outline-3 bg-foundation px-2 py-1 text-[13px] leading-5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option v-for="size in pageSizeOptions" :key="size" :value="size">
          {{ size }}
        </option>
      </select>
      <span>条</span>
      <span class="ml-2">共 {{ total }} 条，第 {{ startItem }}-{{ endItem }} 条</span>
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="rounded border border-outline-3 px-2 py-1 text-[13px] leading-5 text-foreground-2 hover:bg-highlight-1 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="displayPage <= 1"
        @click="goPrevPage"
      >
        &lt; 上一页
      </button>
      <span class="px-2">第 {{ displayPage }} / {{ totalPages }} 页</span>
      <button
        type="button"
        class="rounded border border-outline-3 px-2 py-1 text-[13px] leading-5 text-foreground-2 hover:bg-highlight-1 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canGoNext"
        @click="goNextPage"
      >
        下一页 &gt;
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** 总条数（游标分页时可为当前已加载条数） */
    total: number
    /** 当前页码，从 1 开始 */
    page: number
    /** 每页条数 */
    pageSize: number
    /** 可选每页条数 */
    pageSizeOptions?: number[]
    /** 游标分页场景下由外部给出的“是否还有下一页”，未传则按总条数推算 */
    hasNext?: boolean
  }>(),
  {
    pageSizeOptions: () => [10, 20, 50],
    hasNext: undefined
  }
)

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [pageSize: number]
}>()

const pageSizeSelectId = `pagination-page-size-${useId()}`

const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.total / Number(props.pageSize || 1)))
)

const displayPage = computed(() => Math.min(props.page, totalPages.value))
const startItem = computed(() =>
  props.total === 0 ? 0 : (displayPage.value - 1) * Number(props.pageSize) + 1
)
const endItem = computed(() =>
  Math.min(displayPage.value * Number(props.pageSize), props.total)
)

const canGoNext = computed(() =>
  props.hasNext === undefined ? displayPage.value < totalPages.value : props.hasNext
)

const goToPage = (target: number) => {
  if (target < 1) return
  const next = Math.min(target, totalPages.value)
  if (next === props.page) return
  emit('update:page', next)
}

const goPrevPage = () => goToPage(displayPage.value - 1)
const goNextPage = () => goToPage(displayPage.value + 1)

const onPageSizeChange = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return
  emit('update:pageSize', value)
}

const pageSizeModel = computed({
  get: () => Number(props.pageSize),
  set: (value: number | string) => onPageSizeChange(Number(value))
})
</script>
