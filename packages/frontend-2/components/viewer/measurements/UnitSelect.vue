<template>
  <FormSelectBase
    v-model="selectedUnit"
    :items="units"
    label="Unit"
    :show-label="false"
    :name="name || 'units'"
    :allow-unset="false"
    :label-id="labelId"
    :button-id="buttonId"
    size="sm"
  >
    <template #something-selected>
      <div>{{ fullUnitName }}</div>
    </template>
    <template #option="{ item }">
      <div class="flex flex-col">
        <div class="label text-xs">{{ unitDisplayNames[item] || item }}</div>
      </div>
    </template>
  </FormSelectBase>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

type UnitDisplayNames = {
  [unit: string]: string
}

const emit = defineEmits(['update:modelValue'])

const props = defineProps<{
  modelValue: string | undefined
  name?: string
}>()

const labelId = useId()
const buttonId = useId()

// Use a ref for unitDisplayNames
const unitDisplayNames = ref<UnitDisplayNames>({
  mm: '毫米',
  cm: '厘米',
  m: '米',
  km: '千米',
  in: '英寸',
  ft: '英尺',
  yd: ' yard',
  mi: '英里'
})

function getFullUnitName(unit: string): string {
  return unitDisplayNames.value[unit] || unit
}

const fullUnitName = computed(() => getFullUnitName(props.modelValue || ''))

const units = computed(() => Object.keys(unitDisplayNames.value))

const selectedUnit = computed({
  get: () => props.modelValue,
  set: (newVal) => emit('update:modelValue', newVal)
})
</script>
