<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-heading-lg">流程调试</h1>
      <button
        class="px-3 py-2 rounded-md bg-primary text-foundation-page text-body-sm disabled:opacity-50"
        :disabled="mutating"
        @click="loadDefinitions"
      >
        刷新
      </button>
    </div>

    <div class="border border-outline-3 rounded-xl p-4 space-y-4">
      <div class="text-heading-sm">定义流程</div>
      <div class="grid gap-3">
        <label for="flow-definition-name" class="sr-only">流程名称</label>
        <input
          id="flow-definition-name"
          v-model="definitionName"
          class="border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
          placeholder="流程名称，例如：模型审核流程"
        />
        <label for="flow-definition-id" class="sr-only">流程ID(可选)</label>
        <input
          id="flow-definition-id"
          v-model="definitionId"
          class="border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
          placeholder="流程ID(可选)，例如：model_review_flow_v1"
        />
        <label for="flow-definition-form-schema" class="sr-only">
          审批填写项(JSON)
        </label>
        <input
          id="flow-definition-form-schema"
          v-model="formSchemaText"
          class="border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
          placeholder='审批填写项，例如 [{"key":"title","name":"标题","type":"string","required":true}]'
        />
        <label for="flow-definition-steps" class="sr-only">步骤(JSON)</label>
        <input
          id="flow-definition-steps"
          v-model="stepsConfigText"
          class="border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
          placeholder='步骤JSON，例如 [{"name":"专业负责人","requiredApprovals":1}]'
        />
        <label class="inline-flex items-center gap-2 text-body-sm text-foreground-2">
          <input v-model="syncModelApproveStatus" type="checkbox" />
          审批联动模型 approve_status
        </label>
        <label class="inline-flex items-center gap-2 text-body-sm text-foreground-2">
          <input v-model="allowParallelInstancesForSameResource" type="checkbox" />
          允许同一资源多个实例并行
        </label>
        <button
          class="px-3 py-2 rounded-md bg-primary text-foundation-page text-body-sm disabled:opacity-50"
          :disabled="!definitionName.trim() || mutating"
          @click="createDefinition"
        >
          创建定义
        </button>
      </div>

      <div class="space-y-2">
        <div class="text-body-xs text-foreground-2">流程定义列表</div>
        <div v-if="!definitions.length" class="text-body-sm text-foreground-2">
          暂无定义
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="definition in definitions"
            :key="definition.id"
            class="border border-outline-3 rounded-lg p-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-body-sm font-medium">{{ definition.name }}</span>
              <span class="text-body-xs text-foreground-2">
                v{{ definition.version }}
              </span>
              <span class="text-body-xs px-2 py-1 rounded bg-foundation-2">
                {{ definition.isActive ? 'ACTIVE' : 'INACTIVE' }}
              </span>
              <button
                class="ml-auto px-2 py-1 rounded border border-outline-3 text-body-xs disabled:opacity-50"
                :disabled="mutating"
                @click="toggleDefinitionActive(definition.id, !definition.isActive)"
              >
                {{ definition.isActive ? '停用' : '启用' }}
              </button>
              <button
                class="px-2 py-1 rounded border border-outline-3 text-body-xs disabled:opacity-50"
                :disabled="mutating || !definition.isActive"
                @click="openStartDialog(definition.id)"
              >
                发起
              </button>
            </div>
            <div class="text-body-xs text-foreground-2 mt-2">
              审批填写项：{{
                definition.formSchema.length
                  ? JSON.stringify(definition.formSchema)
                  : '无'
              }}
            </div>
            <div class="text-body-xs text-foreground-2 mt-1">
              联动模型状态：{{ isModelStatusSyncEnabled(definition) ? '是' : '否' }}
            </div>
            <div class="text-body-xs text-foreground-2 mt-1">
              同一资源并行实例：{{
                isParallelInstancesEnabled(definition) ? '允许' : '不允许'
              }}
            </div>
            <div class="mt-2 space-y-1">
              <div
                v-for="step in definition.steps"
                :key="step.id"
                class="text-body-xs text-foreground-2"
              >
                Step {{ step.stepIndex }} · {{ step.name }} · required:
                {{ step.requiredApprovals }} · approvers:
                {{ step.approverIds.length ? step.approverIds.join(',') : 'any' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="border border-outline-3 rounded-xl p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div class="text-heading-sm">发起审批</div>
        <button
          class="px-2 py-1 rounded border border-outline-3 text-body-xs disabled:opacity-50"
          :disabled="mutating"
          @click="processTimeouts"
        >
          处理超时
        </button>
      </div>
      <button
        class="px-3 py-2 rounded-md bg-primary text-foundation-page text-body-sm disabled:opacity-50"
        :disabled="mutating || !activeDefinitions.length"
        @click="openStartDialog()"
      >
        发起审批
      </button>
    </div>

    <CommonFlowStartDialog
      v-model:open="isStartDialogOpen"
      :definitions="definitions"
      :flow-id="selectedStartFlowId"
      :loading="mutating"
      @submit="startApproval"
    />
  </div>
</template>

<script setup lang="ts">
import { graphql } from '~~/lib/common/generated/gql'
import { useApolloClient } from '@vue/apollo-composable'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import type {
  ApprovalFlowDefinitionStepInput,
  ApprovalFlowFormFieldInput,
  ApprovalFlowResourceType,
  CreateApprovalFlowDefinitionInput,
  FlowDefinitionsQuery,
  FlowDefinitionsQueryVariables,
  FlowProcessTimeoutsMutation,
  FlowStartMutationVariables,
  FlowSetDefinitionActiveMutation,
  FlowSetDefinitionActiveMutationVariables
} from '~~/lib/common/generated/gql/graphql'

const flowDefinitionsQuery = graphql(`
  query FlowDefinitions($resourceType: ApprovalFlowResourceType) {
    approvalFlowDefinitions(resourceType: $resourceType) {
      id
      name
      resourceType
      isActive
      version
      previousVersionId
      effectConfig
      formSchema {
        key
        name
        type
        required
        placeholder
        options {
          label
          value
        }
      }
      steps {
        id
        name
        stepIndex
        requiredApprovals
        approverIds
        timeoutHours
      }
    }
  }
`)

const createDefinitionMutation = graphql(`
  mutation FlowCreateDefinition($input: CreateApprovalFlowDefinitionInput!) {
    approvalMutations {
      createDefinition(input: $input) {
        id
        name
      }
    }
  }
`)

const setDefinitionActiveMutation = graphql(`
  mutation FlowSetDefinitionActive($definitionId: ID!, $isActive: Boolean!) {
    approvalMutations {
      setDefinitionActive(definitionId: $definitionId, isActive: $isActive) {
        id
        isActive
      }
    }
  }
`)

const processTimeoutsMutation = graphql(`
  mutation FlowProcessTimeouts {
    approvalMutations {
      processTimeouts
    }
  }
`)

const startFlowMutation = graphql(`
  mutation FlowStart($input: StartApprovalFlowInput!) {
    approvalMutations {
      start(input: $input) {
        id
      }
    }
  }
`)

type FlowDefinitionListItem = FlowDefinitionsQuery['approvalFlowDefinitions'][number]

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()

const mutating = ref(false)
const definitions = ref<FlowDefinitionListItem[]>([])
const definitionName = ref('')
const definitionId = ref('')
const definitionResourceType = ref<'MODEL'>('MODEL')
const formSchemaText = ref(
  '[{"key":"title","name":"标题","type":"string","required":true,"placeholder":"请输入标题"},{"key":"reviewer","name":"审批人","type":"user","required":true},{"key":"targetProject","name":"目标项目","type":"project"},{"key":"targetModel","name":"目标模型","type":"model"},{"key":"level","name":"级别","type":"select","options":[{"label":"一般","value":"normal"},{"label":"紧急","value":"urgent"}]}]'
)
const stepsConfigText = ref('[{"name":"默认审批","requiredApprovals":1}]')
const syncModelApproveStatus = ref(false)
const allowParallelInstancesForSameResource = ref(false)
const isStartDialogOpen = ref(false)
const selectedStartFlowId = ref<string | null>(null)

const notify = (title: string, description: string, type: ToastNotificationType) => {
  triggerNotification({
    title,
    description,
    type
  })
}

const activeDefinitions = computed(() =>
  definitions.value.filter((definition) => definition.isActive)
)

const isModelStatusSyncEnabled = (definition: FlowDefinitionListItem) => {
  const config = definition.effectConfig as Record<string, unknown> | null | undefined
  return Boolean(config?.syncModelApproveStatus)
}

const isParallelInstancesEnabled = (definition: FlowDefinitionListItem) => {
  const config = definition.effectConfig as Record<string, unknown> | null | undefined
  return Boolean(config?.allowParallelInstancesForSameResource)
}

const parseStepsConfig = (): ApprovalFlowDefinitionStepInput[] | undefined => {
  const raw = stepsConfigText.value.trim()
  if (!raw) return undefined
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error('步骤配置必须是 JSON 数组')
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`步骤 ${index + 1} 不是有效对象`)
    }
    const record = item as Record<string, unknown>
    const name = String(record.name || '').trim()
    if (!name) {
      throw new Error(`步骤 ${index + 1} 缺少 name`)
    }

    const approverIds = Array.isArray(record.approverIds)
      ? record.approverIds
          .map((id) => String(id || '').trim())
          .filter((id) => id.length > 0)
      : undefined

    const requiredApprovals =
      typeof record.requiredApprovals === 'number'
        ? Math.max(1, Math.floor(record.requiredApprovals))
        : undefined

    const timeoutHours =
      typeof record.timeoutHours === 'number'
        ? Math.max(1, Math.floor(record.timeoutHours))
        : undefined

    return {
      name,
      approverIds,
      requiredApprovals,
      timeoutHours
    }
  })
}

const loadDefinitions = async () => {
  const res = await apollo.query<FlowDefinitionsQuery, FlowDefinitionsQueryVariables>({
    query: flowDefinitionsQuery,
    variables: {
      resourceType: definitionResourceType.value as ApprovalFlowResourceType
    },
    fetchPolicy: 'network-only'
  })
  definitions.value = res.data.approvalFlowDefinitions || []
}

const createDefinition = async () => {
  if (!definitionName.value.trim()) return
  mutating.value = true
  try {
    const parsedFormSchema = JSON.parse(formSchemaText.value.trim() || '[]')
    const formSchema: ApprovalFlowFormFieldInput[] = Array.isArray(parsedFormSchema)
      ? parsedFormSchema.map((item, index) => {
          const record = item as Record<string, unknown>
          const key = String(record.key || '').trim()
          const name = String(record.name || '').trim()
          const type = String(record.type || '').trim()
          const required = Boolean(record.required)
          const placeholder =
            typeof record.placeholder === 'string' ? record.placeholder.trim() : null
          const options = Array.isArray(record.options)
            ? record.options
                .filter(
                  (optionItem) =>
                    optionItem &&
                    typeof optionItem === 'object' &&
                    !Array.isArray(optionItem)
                )
                .map((optionItem, optionIndex) => {
                  const optionRecord = optionItem as Record<string, unknown>
                  const label = String(optionRecord.label || '').trim()
                  const value = String(optionRecord.value || '').trim()
                  if (!label || !value) {
                    throw new Error(
                      `审批填写项 ${index + 1} 的 options[${
                        optionIndex + 1
                      }] 缺少 label/value`
                    )
                  }
                  return { label, value }
                })
            : []
          if (!key || !name || !type) {
            throw new Error(`审批填写项 ${index + 1} 缺少 key/name/type`)
          }
          return { key, name, type, required, placeholder, options }
        })
      : []
    const steps = parseStepsConfig()
    const effectConfig: Record<string, unknown> = {}
    if (syncModelApproveStatus.value) {
      effectConfig.syncModelApproveStatus = true
    }
    if (allowParallelInstancesForSameResource.value) {
      effectConfig.allowParallelInstancesForSameResource = true
    }
    const input: CreateApprovalFlowDefinitionInput = {
      id: definitionId.value.trim() || null,
      name: definitionName.value.trim(),
      isActive: true,
      effectConfig: Object.keys(effectConfig).length ? effectConfig : null,
      formSchema,
      steps
    }
    await apollo.mutate({
      mutation: createDefinitionMutation,
      variables: {
        input
      }
    })
    notify('创建成功', '流程定义已创建', ToastNotificationType.Success)
    definitionName.value = ''
    definitionId.value = ''
    allowParallelInstancesForSameResource.value = false
    syncModelApproveStatus.value = false
  } catch (e) {
    notify('创建失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
    await loadDefinitions()
  }
}

const toggleDefinitionActive = async (definitionId: string, isActive: boolean) => {
  mutating.value = true
  try {
    await apollo.mutate<
      FlowSetDefinitionActiveMutation,
      FlowSetDefinitionActiveMutationVariables
    >({
      mutation: setDefinitionActiveMutation,
      variables: {
        definitionId,
        isActive
      }
    })
    notify(
      '操作成功',
      `流程定义已${isActive ? '启用' : '停用'}`,
      ToastNotificationType.Success
    )
  } catch (e) {
    notify('操作失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
    await loadDefinitions()
  }
}

const processTimeouts = async () => {
  mutating.value = true
  try {
    const res = await apollo.mutate<FlowProcessTimeoutsMutation, Record<string, never>>(
      {
        mutation: processTimeoutsMutation
      }
    )
    notify(
      '处理完成',
      `已处理超时实例：${res.data?.approvalMutations.processTimeouts || 0} 个`,
      ToastNotificationType.Success
    )
  } catch (e) {
    notify('处理失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
  }
}

const openStartDialog = (flowId?: string) => {
  selectedStartFlowId.value = flowId || activeDefinitions.value[0]?.id || null
  if (!selectedStartFlowId.value) {
    notify('发起失败', '没有可用的启用流程定义', ToastNotificationType.Warning)
    return
  }
  isStartDialogOpen.value = true
}

const startApproval = async (payload: {
  definitionId: string
  resourceId: string | null
  formData: Record<string, unknown>
}) => {
  mutating.value = true
  try {
    await apollo.mutate({
      mutation: startFlowMutation,
      variables: {
        input: {
          definitionId: payload.definitionId,
          resourceId: payload.resourceId,
          formData: payload.formData
        }
      } as FlowStartMutationVariables
    })
    notify('发起成功', '审批实例已创建', ToastNotificationType.Success)
  } catch (e) {
    notify('发起失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
  }
}

onMounted(async () => {
  await loadDefinitions()
})
</script>
