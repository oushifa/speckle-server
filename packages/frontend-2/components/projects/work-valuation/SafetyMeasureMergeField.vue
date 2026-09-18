<template>
  <div
    v-show="visible"
    class="col-span-1 md:col-span-2 space-y-3 rounded-lg border border-outline-3 bg-foundation p-3"
  >
    <div class="text-xs font-semibold text-foreground">是否包含本期安全文明措施费</div>
    <div class="flex items-center gap-4">
      <label
        class="inline-flex cursor-pointer items-center text-xs font-medium text-foreground"
      >
        <input
          v-model="include"
          type="radio"
          :value="true"
          :disabled="disabled"
          class="mr-2 text-blue-600 focus:ring-blue-500"
        />
        是，并入本期月度验工
      </label>
      <label
        class="inline-flex cursor-pointer items-center text-xs font-medium text-foreground"
      >
        <input
          v-model="include"
          type="radio"
          :value="false"
          :disabled="disabled"
          class="mr-2 text-blue-600 focus:ring-blue-500"
        />
        否，后续单独发起
      </label>
    </div>

    <div v-if="include" class="space-y-1.5">
      <div class="block text-xs font-bold text-slate-700">
        选择属于安全文明措施费的分部工程 *
      </div>
      <BoqTreeSelect
        v-model="sections"
        :project-id="projectId"
        :disabled="disabled"
        multiple
        leaf="section"
        placeholder="点击展开清单并多选分部工程"
      />
      <div class="text-[11px] leading-4 text-foreground-2">
        这些分部工程下的清单项会并入本期月度验工，在明细录入页填写各方数量；
        月度验工审批通过后，投资监理量会写入安全文明措施费的累计完成数。
      </div>
    </div>

    <div v-else class="text-[11px] leading-4 text-foreground-2">
      本期不并入。安全文明措施费需在【安全文明措施费】模块单独发起并走完审批后，
      再回到月度验工中关联。
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BoqTreeSelect from '~/components/common/checklist/BoqTreeSelect.vue'

const props = withDefaults(
  defineProps<{
    projectId?: string | null
    /** 期数，为 "0" 时默认展示该选择区 */
    roundName?: string | null
    disabled?: boolean
  }>(),
  {
    projectId: null,
    roundName: '',
    disabled: false
  }
)

const include = defineModel<boolean>('includeSafetyMeasure', { default: false })
const sections = defineModel<string[]>('safetySectionIds', { default: () => [] })

// 0 期默认展示；已并入的单据在编辑时也要展示，否则用户无法取消并入
const visible = computed(
  () => String(props.roundName ?? '').trim() === '0' || include.value === true
)
</script>
