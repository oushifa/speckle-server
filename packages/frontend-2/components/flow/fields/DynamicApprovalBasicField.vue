<template>
  <div class="space-y-2">
    <template v-if="field.type === 'boolean'">
      <label :for="inputId" class="inline-flex items-center gap-2 text-body-sm">
        <input
          :id="inputId"
          type="checkbox"
          :checked="checked"
          @change="onBooleanChange"
        />
        {{ field.name }}
        <span v-if="field.required" class="text-danger">*</span>
      </label>
    </template>

    <template v-else-if="field.type === 'text'">
      <label :for="inputId" class="text-body-xs text-foreground-2">
        {{ field.name }} ({{ field.type }})
        <span v-if="field.required" class="text-danger">*</span>
      </label>
      <textarea
        :id="inputId"
        :value="stringValue"
        class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page min-h-24"
        :placeholder="field.placeholder || `请输入${field.name}`"
        @input="onTextInput"
      />
    </template>

    <template v-else-if="field.type === 'date' || field.type === 'datetime'">
      <label :for="buttonId" class="text-body-xs text-foreground-2">
        {{ field.name }} ({{ field.type }})
        <span v-if="field.required" class="text-danger">*</span>
      </label>
      <input
        :id="inputId"
        :type="field.type === 'datetime' ? 'datetime-local' : 'date'"
        :value="stringValue"
        class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
        @input="onTextInput"
      />
    </template>

    <template v-else-if="field.type === 'select'">
      <label :for="inputId" class="text-body-xs text-foreground-2">
        {{ field.name }} ({{ field.type }})
        <span v-if="field.required" class="text-danger">*</span>
      </label>
      <FormSelectBase
        v-model="selectedSelectValue"
        :multiple="isMultiple"
        :items="selectOptions"
        :label="field.name"
        :show-label="false"
        :name="inputId"
        :search="true"
        :search-placeholder="field.placeholder || `请选择${field.name}`"
        :label-id="labelId"
        :button-id="buttonId"
        by="id"
      >
        <template #nothing-selected>
          {{ field.placeholder || `请选择${field.name}` }}
        </template>
        <template #something-selected="{ value: selectedValue }">
          <template v-if="isArray(selectedValue)">
            <span class="truncate">
              {{ selectedValue.map((item) => item.name).join(', ') }}
            </span>
          </template>
          <template v-else>
            <span class="truncate">
              {{ selectedValue.name }}
            </span>
          </template>
        </template>
        <template #option="{ item }">
          <span class="truncate">{{ item.name }}</span>
        </template>
      </FormSelectBase>
    </template>

    <template v-else>
      <label :for="inputId" class="text-body-xs text-foreground-2">
        {{ field.name }} ({{ field.type }})
        <span v-if="field.required" class="text-danger">*</span>
      </label>
      <input
        :id="inputId"
        :type="field.type === 'number' ? 'number' : 'text'"
        :value="stringValue"
        class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
        :placeholder="field.placeholder || `请输入${field.name}`"
        @input="onValueInput"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { isArray } from 'lodash-es'
import type { DynamicFormSchemaField } from '~/components/flow/fields/types'

const props = defineProps<{
  field: DynamicFormSchemaField
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: unknown): void
}>()

const inputId = computed(() => `flow-dynamic-form-${props.field.key}`)
const labelId = useId()
const buttonId = useId()
const stringValue = computed(() => String(props.value ?? ''))
const checked = computed(() => Boolean(props.value))
const isMultiple = computed(() => !!props.field.multiple)
const selectOptions = computed(() =>
  (props.field.options || []).map((option) => ({
    id: option.value,
    name: option.label
  }))
)
const selectedSelectValue = computed({
  get: () => {
    if (isMultiple.value) {
      const selectedIds = isArray(props.value)
        ? props.value.filter((item): item is string => typeof item === 'string')
        : []
      return selectOptions.value.filter((option) => selectedIds.includes(option.id))
    }
    const selectedId = typeof props.value === 'string' ? props.value : ''
    return selectOptions.value.find((option) => option.id === selectedId)
  },
  set: (newValue: unknown) => {
    if (isMultiple.value) {
      const items = isArray(newValue)
        ? newValue.filter(
            (item): item is { id: string; name: string } =>
              typeof item === 'object' && !!item && 'id' in item
          )
        : []
      emit(
        'update:value',
        items.map((item) => item.id)
      )
      return
    }
    if (!newValue || isArray(newValue)) {
      emit('update:value', '')
      return
    }
    emit('update:value', (newValue as { id: string; name: string }).id)
  }
})

const onBooleanChange = (event: Event) => {
  emit('update:value', (event.target as HTMLInputElement).checked)
}

const onTextInput = (event: Event) => {
  emit('update:value', (event.target as HTMLInputElement | HTMLSelectElement).value)
}

const onValueInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  if (props.field.type === 'number') {
    emit('update:value', value === '' ? null : Number(value))
    return
  }
  emit('update:value', value)
}
</script>
