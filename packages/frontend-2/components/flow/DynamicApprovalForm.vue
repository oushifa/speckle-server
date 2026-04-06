<template>
  <div>
    <div v-if="schema.length" class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div v-for="field in schema" :key="field.key" class="space-y-2">
        <DynamicApprovalProjectField
          v-if="field.type === 'project'"
          :field="field"
          :value="values[field.key]"
          @update:value="setValue(field.key, $event)"
        />
        <DynamicApprovalModelField
          v-else-if="field.type === 'model'"
          :field="field"
          :value="values[field.key]"
          @update:value="setValue(field.key, $event)"
        />
        <DynamicApprovalUserField
          v-else-if="field.type === 'user'"
          :field="field"
          :value="values[field.key]"
          @update:value="setValue(field.key, $event)"
        />
        <DynamicApprovalBasicField
          v-else
          :field="field"
          :value="values[field.key]"
          @update:value="setValue(field.key, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import DynamicApprovalBasicField from '~/components/flow/fields/DynamicApprovalBasicField.vue'
import DynamicApprovalModelField from '~/components/flow/fields/DynamicApprovalModelField.vue'
import DynamicApprovalProjectField from '~/components/flow/fields/DynamicApprovalProjectField.vue'
import DynamicApprovalUserField from '~/components/flow/fields/DynamicApprovalUserField.vue'
import type { DynamicFormSchemaField } from '~/components/flow/fields/types'

const props = withDefaults(
  defineProps<{
    schema: DynamicFormSchemaField[]
    modelValue: Record<string, unknown>
  }>(),
  {
    schema: () => [],
    modelValue: () => ({})
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, unknown>): void
}>()

const values = computed(() => props.modelValue || {})

const setValue = (key: string, value: unknown) => {
  emit('update:modelValue', {
    ...values.value,
    [key]: value
  })
}
</script>
