<template>
  <FormSelectBase
    v-model="selectedValue"
    :items="flatDepartments"
    :name="name || 'departmentSelect'"
    :label="label || '选择部门'"
    class="min-w-[120px]"
    :label-id="labelId"
    :button-id="buttonId"
    mount-menu-on-body
    :show-label="showLabel"
    :disabled="disabled"
    :clearable="clearable"
  >
    <template #nothing-selected>请选择</template>
    <template #something-selected="{ value }">
      <div class="truncate text-foreground">
        {{ (value as FlatDepartment).name }}
      </div>
    </template>
    <template #option="{ item }">
      <div class="flex flex-col">
        <span class="truncate whitespace-pre">{{ (item as FlatDepartment).label }}</span>
      </div>
    </template>
  </FormSelectBase>
</template>

<script setup lang="ts">
import { getDepartmentsTree, type Department } from '~~/lib/organizations/api'

type FlatDepartment = {
  id: string
  name: string
  label: string
}

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | undefined): void
}>()

const props = defineProps<{
  modelValue?: string | null
  name?: string
  label?: string
  disabled?: boolean
  showLabel?: boolean
  clearable?: boolean
}>()

const labelId = useId()
const buttonId = useId()
const apiOrigin = useApiOrigin()
const flatDepartments = ref<FlatDepartment[]>([])

const flattenDepartments = (depts: Department[], depth = 0): FlatDepartment[] => {
  const result: FlatDepartment[] = []
  for (const dept of depts) {
    const indent = depth > 0 ? '  '.repeat(depth) + '└─ ' : ''
    result.push({
      id: dept.id,
      name: dept.name,
      label: `${indent}${dept.name}`
    })
    if (dept.children && dept.children.length > 0) {
      result.push(...flattenDepartments(dept.children, depth + 1))
    }
  }
  return result
}

onMounted(async () => {
  try {
    const tree = await getDepartmentsTree({ apiOrigin })
    flatDepartments.value = flattenDepartments(tree)
  } catch (err) {
    console.error('Failed to load departments tree:', err)
  }
})

const selectedValue = computed({
  get: () => {
    return flatDepartments.value.find((d) => d.id === props.modelValue) || undefined
  },
  set: (val) => {
    emit('update:modelValue', val?.id)
  }
})
</script>
