<template>
  <LayoutDialog v-model:open="open" max-width="lg" :buttons="dialogButtons">
    <template #header>发起审批</template>
    <div class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label for="flow-start-dialog-definition" class="sr-only">流程定义</label>
        <select
          v-if="!flowId"
          id="flow-start-dialog-definition"
          v-model="selectedDefinitionId"
          class="border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
        >
          <option value="">请选择流程定义</option>
          <option
            v-for="definition in availableDefinitions"
            :key="definition.id"
            :value="definition.id"
          >
            {{ definition.name }} (v{{ definition.version }})
          </option>
        </select>
        <label for="flow-start-dialog-resource-id" class="sr-only">资源ID(可选)</label>
        <input
          id="flow-start-dialog-resource-id"
          v-model="resourceId"
          class="border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
          placeholder="资源ID（可为空）"
        />
      </div>
      <DynamicApprovalForm
        v-if="selectedDefinitionFormSchema.length"
        v-model="formFieldValues"
        :schema="selectedDefinitionFormSchema"
      />
    </div>
  </LayoutDialog>
</template>

<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import type { FlowDefinitionsQuery } from '~~/lib/common/generated/gql/graphql'
import DynamicApprovalForm from '~/components/flow/DynamicApprovalForm.vue'

type DefinitionItem = FlowDefinitionsQuery['approvalFlowDefinitions'][number]

const props = defineProps<{
  definitions: DefinitionItem[]
  flowId?: string | null
  defaultResourceId?: string | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (
    e: 'submit',
    payload: {
      templateId: string
      resourceId: string | null
      formData: Record<string, unknown>
    }
  ): void
}>()

const open = defineModel<boolean>('open', { required: true })
const selectedDefinitionId = ref('')
const resourceId = ref('')
const formFieldValues = ref<Record<string, unknown>>({})

const availableDefinitions = computed(() =>
  props.definitions.filter((definition) => definition.isActive)
)

const effectiveDefinitionId = computed(
  () => props.flowId || selectedDefinitionId.value || null
)

const selectedDefinition = computed(
  () =>
    props.definitions.find(
      (definition) => definition.id === effectiveDefinitionId.value
    ) || null
)

const selectedDefinitionFormSchema = computed(
  () => selectedDefinition.value?.formSchema || []
)

const canSubmit = computed(() => !!effectiveDefinitionId.value && !props.loading)

const resetForm = () => {
  selectedDefinitionId.value = availableDefinitions.value[0]?.id || ''
  resourceId.value = props.defaultResourceId?.trim() || ''
  formFieldValues.value = {}
}

watch(
  () => open.value,
  (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      resetForm()
    }
  }
)

const submit = () => {
  if (!canSubmit.value) return
  const definitionId = effectiveDefinitionId.value
  if (!definitionId) return
  emit('submit', {
    templateId:
      (selectedDefinition.value as { templateId?: string } | null)?.templateId ||
      definitionId,
    resourceId: resourceId.value.trim() || null,
    formData: { ...formFieldValues.value }
  })
  open.value = false
}

const dialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      open.value = false
    }
  },
  {
    text: '发起',
    props: {
      color: 'primary',
      loading: !!props.loading
    },
    disabled: !canSubmit.value,
    onClick: submit
  }
])
</script>
