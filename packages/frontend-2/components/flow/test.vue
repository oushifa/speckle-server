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
          maxlength="10"
          placeholder="流程ID(可选，最多10位)，例如：flowv0001"
        />
        <div class="text-body-xs text-foreground-2">
          {{
            createMode === 'version'
              ? `当前为新版本模式，将复用模板 ${baseTemplateIdForNewVersion || '-'}`
              : '当前为新流程模式，模板ID将由系统随机生成'
          }}
        </div>
        <label for="flow-definition-resource-type" class="sr-only">资源类型</label>
        <select
          id="flow-definition-resource-type"
          v-model="definitionResourceType"
          class="border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
        >
          <option value="MODEL">模型</option>
          <option value="FORMS">数据库表单</option>
        </select>
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
        <label for="flow-definition-effect-config" class="sr-only">
          effectConfig(JSON)
        </label>
        <textarea
          id="flow-definition-effect-config"
          v-model="effectConfigText"
          class="border border-outline-3 rounded-md px-3 py-2 bg-foundation-page min-h-[132px] font-mono text-body-xs"
          placeholder='effectConfig JSON，例如 {"hooks":{"onInstanceApproved":[{"type":"updateResourceFields","fields":{"approveStatus":"$STATUS"}}]}}'
        />
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
            v-for="group in groupedDefinitions"
            :key="group.templateId"
            class="border border-outline-3 rounded-lg p-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-body-sm font-medium">{{ group.latest.name }}</span>
              <span class="text-body-xs text-foreground-2">
                template: {{ group.templateId }}
              </span>
              <label :for="`flow-version-select-${group.templateId}`" class="sr-only">
                选择版本
              </label>
              <select
                :id="`flow-version-select-${group.templateId}`"
                :value="
                  selectedVersionIdByTemplate[group.templateId] || group.latest.id
                "
                class="text-body-xs border border-outline-3 rounded px-2 py-1 bg-foundation-page"
                @change="
                  onTemplateVersionChange(
                    group.templateId,
                    ($event.target as HTMLSelectElement).value
                  )
                "
              >
                <option
                  v-for="version in group.versions"
                  :key="version.id"
                  :value="version.id"
                >
                  v{{ version.version }} · {{ version.id }}
                  {{ version.isActive ? ' (ACTIVE)' : '' }}
                </option>
              </select>
              <span class="text-body-xs px-2 py-1 rounded bg-foundation-2">
                {{
                  getSelectedDefinitionInGroup(group)?.isActive ? 'ACTIVE' : 'INACTIVE'
                }}
              </span>
              <button
                class="ml-auto px-2 py-1 rounded border border-outline-3 text-body-xs disabled:opacity-50"
                :disabled="mutating"
                @click="
                  toggleDefinitionActive(
                    getSelectedDefinitionInGroup(group)?.id || '',
                    !Boolean(getSelectedDefinitionInGroup(group)?.isActive)
                  )
                "
              >
                {{ getSelectedDefinitionInGroup(group)?.isActive ? '停用' : '启用' }}
              </button>
              <button
                class="px-2 py-1 rounded border border-outline-3 text-body-xs disabled:opacity-50"
                :disabled="mutating || !getSelectedDefinitionInGroup(group)"
                @click="prepareCreateNewVersion(group.templateId)"
              >
                创建新版本
              </button>
              <button
                class="px-2 py-1 rounded border border-outline-3 text-body-xs disabled:opacity-50"
                :disabled="mutating || !getSelectedDefinitionInGroup(group)?.isActive"
                @click="
                  openStartDialog(getSelectedDefinitionInGroup(group)?.id || undefined)
                "
              >
                发起
              </button>
            </div>
            <div class="text-body-xs text-foreground-2 mt-2">
              审批填写项：{{
                getSelectedDefinitionInGroup(group)?.formSchema?.length
                  ? JSON.stringify(getSelectedDefinitionInGroup(group)?.formSchema)
                  : '无'
              }}
            </div>
            <div class="text-body-xs text-foreground-2 mt-1">
              联动资源状态：{{
                isResourceStatusSyncEnabled(getSelectedDefinitionInGroup(group))
                  ? '是'
                  : '否'
              }}
            </div>
            <div class="text-body-xs text-foreground-2 mt-1">
              同一资源并行实例：{{
                isParallelInstancesEnabled(getSelectedDefinitionInGroup(group))
                  ? '允许'
                  : '不允许'
              }}
            </div>
            <div class="text-body-xs text-foreground-2 mt-1">
              effectConfig：{{ getSelectedDefinitionInGroup(group)?.effectConfig }}
            </div>
            <div class="mt-2 space-y-1">
              <div
                v-for="step in getSelectedDefinitionInGroup(group)?.steps || []"
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
import type { TypedDocumentNode } from '@apollo/client/core'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import type {
  ApprovalFlowDefinitionStepInput,
  ApprovalFlowFormFieldInput,
  ApprovalFlowResourceType,
  FlowDefinitionsQuery,
  FlowProcessTimeoutsMutation,
  FlowSetDefinitionActiveMutation,
  FlowSetDefinitionActiveMutationVariables
} from '~~/lib/common/generated/gql/graphql'

type FlowDefinitionListItem = FlowDefinitionsQuery['approvalFlowDefinitions'][number]

const flowDefinitionsQuery = graphql(`
  query FlowDefinitions($resourceType: ApprovalFlowResourceType) {
    approvalFlowDefinitions(resourceType: $resourceType) {
      id
      templateId
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
`) as unknown as TypedDocumentNode<
  { approvalFlowDefinitions: FlowDefinitionsQuery['approvalFlowDefinitions'] },
  { resourceType: ApprovalFlowResourceType }
>

const createDefinitionMutation = graphql(`
  mutation FlowCreateDefinition($input: CreateApprovalFlowDefinitionInput!) {
    approvalMutations {
      createDefinition(input: $input) {
        id
        name
      }
    }
  }
`) as unknown as TypedDocumentNode<
  { approvalMutations: { createDefinition: { id: string; name: string } } },
  { input: Record<string, unknown> }
>

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
`) as unknown as TypedDocumentNode<
  { approvalMutations: { start: { id: string } } },
  { input: Record<string, unknown> }
>

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()

const mutating = ref(false)
const definitions = ref<FlowDefinitionListItem[]>([])
const definitionName = ref('')
const definitionId = ref('')
const definitionResourceType = ref<'MODEL' | 'FORMS'>('MODEL')
const formSchemaText = ref(
  '[{"key":"title","name":"标题","type":"string","required":true,"placeholder":"请输入标题"},{"key":"reviewer","name":"审批人","type":"user","required":true},{"key":"targetProject","name":"目标项目","type":"project"},{"key":"targetModel","name":"目标模型","type":"model"},{"key":"level","name":"级别","type":"select","options":[{"label":"一般","value":"normal"},{"label":"紧急","value":"urgent"}]}]'
)
const stepsConfigText = ref('[{"name":"默认审批","requiredApprovals":1}]')
const effectConfigText = ref(
  '{"hooks":{"onInstancePending":[{"type":"updateResourceFields","fields":{"approveStatus":"$STATUS"}}],"onInstanceApproved":[{"type":"updateResourceFields","fields":{"approveStatus":"$STATUS"}}],"onInstanceRejected":[{"type":"updateResourceFields","fields":{"approveStatus":"$STATUS"}}]}}'
)
const isStartDialogOpen = ref(false)
const selectedStartFlowId = ref<string | null>(null)
const createMode = ref<'new' | 'version'>('new')
const baseTemplateIdForNewVersion = ref<string | null>(null)
const previousVersionIdForNewVersion = ref<string | null>(null)
const selectedVersionIdByTemplate = ref<Record<string, string>>({})

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

const getTemplateId = (definition: FlowDefinitionListItem) =>
  (definition.templateId || definition.id).trim()

const groupedDefinitions = computed(() => {
  const groups: Record<
    string,
    {
      templateId: string
      latest: FlowDefinitionListItem
      versions: FlowDefinitionListItem[]
    }
  > = {}
  for (const definition of definitions.value) {
    const templateId = getTemplateId(definition)
    if (!groups[templateId]) {
      groups[templateId] = {
        templateId,
        latest: definition,
        versions: []
      }
    }
    groups[templateId].versions.push(definition)
  }
  return Object.values(groups)
    .map((group) => {
      const sorted = [...group.versions].sort((a, b) => b.version - a.version)
      return {
        ...group,
        latest: sorted[0],
        versions: sorted
      }
    })
    .sort((a, b) => b.latest.version - a.latest.version)
})

const getSelectedDefinitionInGroup = (group: {
  templateId: string
  versions: FlowDefinitionListItem[]
}) => {
  const selectedId = selectedVersionIdByTemplate.value[group.templateId]
  return group.versions.find((v) => v.id === selectedId) || group.versions[0] || null
}

const onTemplateVersionChange = (templateId: string, definitionId: string) => {
  selectedVersionIdByTemplate.value = {
    ...selectedVersionIdByTemplate.value,
    [templateId]: definitionId
  }
}

const isResourceStatusSyncEnabled = (definition?: FlowDefinitionListItem | null) => {
  if (!definition) return false
  const config = definition.effectConfig as Record<string, unknown> | null | undefined
  if (definition.resourceType === 'FORMS') {
    return Boolean(config?.syncFormApproveStatus)
  }
  return Boolean(config?.syncModelApproveStatus)
}

const isParallelInstancesEnabled = (definition?: FlowDefinitionListItem | null) => {
  if (!definition) return false
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
  const res = await apollo.query({
    query: flowDefinitionsQuery,
    variables: {
      resourceType: definitionResourceType.value as ApprovalFlowResourceType
    },
    fetchPolicy: 'network-only'
  })
  definitions.value = res.data.approvalFlowDefinitions || []
  const nextSelected: Record<string, string> = {}
  for (const group of groupedDefinitions.value) {
    const active = group.versions.find((v) => v.isActive)
    nextSelected[group.templateId] = active?.id || group.versions[0]?.id || ''
  }
  selectedVersionIdByTemplate.value = nextSelected
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
    const effectConfigRaw = effectConfigText.value.trim()
    const parsedEffectConfig: unknown = effectConfigRaw
      ? JSON.parse(effectConfigRaw)
      : {}
    if (
      parsedEffectConfig === null ||
      typeof parsedEffectConfig !== 'object' ||
      Array.isArray(parsedEffectConfig)
    ) {
      throw new Error('effectConfig 必须是 JSON 对象')
    }
    const effectConfig: Record<string, unknown> = {
      ...(parsedEffectConfig as Record<string, unknown>)
    }
    const input = {
      id: definitionId.value.trim() || null,
      templateId:
        createMode.value === 'version'
          ? baseTemplateIdForNewVersion.value || null
          : null,
      previousVersionId:
        createMode.value === 'version'
          ? previousVersionIdForNewVersion.value || null
          : null,
      name: definitionName.value.trim(),
      resourceType: definitionResourceType.value as ApprovalFlowResourceType,
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
    createMode.value = 'new'
    baseTemplateIdForNewVersion.value = null
    previousVersionIdForNewVersion.value = null
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

const _processTimeouts = async () => {
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

const prepareCreateNewVersion = (templateId: string) => {
  const group = groupedDefinitions.value.find((g) => g.templateId === templateId)
  if (!group) return
  const base = getSelectedDefinitionInGroup(group)
  if (!base) return
  createMode.value = 'version'
  baseTemplateIdForNewVersion.value = templateId
  previousVersionIdForNewVersion.value = base.id
  definitionName.value = base.name
  definitionId.value = ''
  definitionResourceType.value = base.resourceType as 'MODEL' | 'FORMS'
  formSchemaText.value = JSON.stringify(base.formSchema || [])
  stepsConfigText.value = JSON.stringify(
    (base.steps || []).map((s) => ({
      name: s.name,
      approverIds: s.approverIds,
      requiredApprovals: s.requiredApprovals,
      timeoutHours: s.timeoutHours || null
    }))
  )
  effectConfigText.value = JSON.stringify(base.effectConfig || {}, null, 2)
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
  templateId: string
  resourceId: string | null
  formData: Record<string, unknown>
}) => {
  mutating.value = true
  try {
    await apollo.mutate({
      mutation: startFlowMutation,
      variables: {
        input: {
          templateId: payload.templateId,
          resourceId: payload.resourceId,
          formData: payload.formData
        }
      }
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

watch(definitionResourceType, async () => {
  effectConfigText.value =
    '{"hooks":{"onInstancePending":[{"type":"updateResourceFields","fields":{"approveStatus":"$STATUS"}}],"onInstanceApproved":[{"type":"updateResourceFields","fields":{"approveStatus":"$STATUS"}}],"onInstanceRejected":[{"type":"updateResourceFields","fields":{"approveStatus":"$STATUS"}}]}}'
  await loadDefinitions()
})
</script>
