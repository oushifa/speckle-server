<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-heading-lg">流程审核</h1>
      <button
        class="px-3 py-2 rounded-md bg-primary text-foundation-page text-body-sm disabled:opacity-50"
        :disabled="loadingInstances || mutating"
        @click="refreshAll"
      >
        刷新
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="space-y-2">
        <label for="flow-status" class="text-body-xs text-foreground-2">状态筛选</label>
        <select
          id="flow-status"
          v-model="statusFilter"
          class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
        >
          <option value="">全部</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="CANCELED">CANCELED</option>
        </select>
      </div>
      <div class="space-y-2">
        <label for="flow-rollback-step" class="text-body-xs text-foreground-2">
          驳回回退步骤
        </label>
        <input
          id="flow-rollback-step"
          v-model.number="rollbackToStep"
          type="number"
          min="1"
          class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
          placeholder="可选：回退到步骤序号"
        />
      </div>
      <div class="space-y-2">
        <label for="flow-comment" class="text-body-xs text-foreground-2">
          驳回/取消说明
        </label>
        <input
          id="flow-comment"
          v-model="actionComment"
          class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
          placeholder="输入备注（驳回必填）"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
      <div class="border border-outline-3 rounded-lg p-3">
        <div class="text-body-xs text-foreground-2">总数</div>
        <div class="text-heading-sm">{{ stats.totalCount }}</div>
      </div>
      <div class="border border-outline-3 rounded-lg p-3">
        <div class="text-body-xs text-foreground-2">待处理</div>
        <div class="text-heading-sm">{{ stats.pendingCount }}</div>
      </div>
      <div class="border border-outline-3 rounded-lg p-3">
        <div class="text-body-xs text-foreground-2">已通过</div>
        <div class="text-heading-sm">{{ stats.approvedCount }}</div>
      </div>
      <div class="border border-outline-3 rounded-lg p-3">
        <div class="text-body-xs text-foreground-2">已驳回</div>
        <div class="text-heading-sm">{{ stats.rejectedCount }}</div>
      </div>
      <div class="border border-outline-3 rounded-lg p-3">
        <div class="text-body-xs text-foreground-2">已取消</div>
        <div class="text-heading-sm">{{ stats.canceledCount }}</div>
      </div>
      <div class="border border-outline-3 rounded-lg p-3">
        <div class="text-body-xs text-foreground-2">平均处理时长(h)</div>
        <div class="text-heading-sm">{{ stats.averageResolutionHours.toFixed(2) }}</div>
      </div>
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
        <label for="flow-definition-form-schema" class="sr-only">
          审批填写项(JSON)
        </label>
        <label for="flow-definition-steps" class="sr-only">步骤(JSON)</label>
        <input
          id="flow-definition-form-schema"
          v-model="formSchemaText"
          class="border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
          placeholder='审批填写项，例如 [{"key":"test","name":"默认审批","type":"string"}]'
        />
        <input
          id="flow-definition-steps"
          v-model="stepsConfigText"
          class="border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
          placeholder='步骤JSON，例如 [{"name":"专业负责人","requiredApprovals":1}]'
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
            </div>
            <div class="text-body-xs text-foreground-2 mt-2">
              审批填写项：{{
                definition.formSchema.length
                  ? JSON.stringify(definition.formSchema)
                  : '无'
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
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label for="flow-start-definition" class="sr-only">流程定义</label>
        <select
          id="flow-start-definition"
          v-model="selectedDefinitionId"
          class="border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
        >
          <option value="">请选择流程定义</option>
          <option
            v-for="definition in definitions"
            :key="definition.id"
            :value="definition.id"
          >
            {{ definition.name }} (v{{ definition.version }})
          </option>
        </select>
        <label for="flow-model-id" class="sr-only">模型ID(可选)</label>
        <input
          id="flow-model-id"
          v-model="selectedModelId"
          class="border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
          placeholder="模型ID（可为空）"
        />
        <button
          class="px-3 py-2 rounded-md bg-primary text-foundation-page text-body-sm disabled:opacity-50"
          :disabled="!selectedDefinitionId || mutating"
          @click="startApproval"
        >
          发起
        </button>
      </div>
      <div
        v-if="selectedDefinitionFormSchema.length"
        class="grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        <div
          v-for="field in selectedDefinitionFormSchema"
          :key="field.key"
          class="space-y-2"
        >
          <template v-if="field.type === 'boolean'">
            <label
              :for="`flow-start-form-${field.key}`"
              class="inline-flex items-center gap-2 text-body-sm"
            >
              <input
                :id="`flow-start-form-${field.key}`"
                type="checkbox"
                :checked="Boolean(formFieldValues[field.key])"
                @change="
                  setFormFieldValue(
                    field.key,
                    ($event.target as HTMLInputElement).checked
                  )
                "
              />
              {{ field.name }}
            </label>
          </template>
          <template v-else>
            <label
              :for="`flow-start-form-${field.key}`"
              class="text-body-xs text-foreground-2"
            >
              {{ field.name }} ({{ field.type }})
            </label>
            <input
              :id="`flow-start-form-${field.key}`"
              :type="field.type === 'number' ? 'number' : 'text'"
              :value="String(formFieldValues[field.key] ?? '')"
              class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
              :placeholder="`请输入${field.name}`"
              @input="
                setFormFieldValue(
                  field.key,
                  field.type === 'number'
                    ? ($event.target as HTMLInputElement).value === ''
                      ? null
                      : Number(($event.target as HTMLInputElement).value)
                    : ($event.target as HTMLInputElement).value
                )
              "
            />
          </template>
        </div>
      </div>
    </div>

    <div class="border border-outline-3 rounded-xl p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div class="text-heading-sm">审批实例</div>
        <div class="text-body-xs text-foreground-2">总数：{{ totalCount }}</div>
      </div>

      <div v-if="loadingInstances" class="text-body-sm text-foreground-2">
        加载中...
      </div>
      <div v-else-if="!instances.length" class="text-body-sm text-foreground-2">
        暂无数据
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="instance in instances"
          :key="instance.id"
          class="border border-outline-3 rounded-lg p-3 space-y-3"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-body-sm font-medium">
              {{ instance.definition?.name || '未命名流程' }}
            </span>
            <span class="text-body-xs text-foreground-2">#{{ instance.id }}</span>
            <span class="text-body-xs text-foreground-2">
              {{ instance.resourceType }}: {{ instance.resourceId }}
            </span>
            <span class="text-body-xs px-2 py-1 rounded bg-foundation-2">
              {{ instance.status }}
            </span>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              class="px-2 py-1 rounded bg-success text-foundation-page text-body-xs disabled:opacity-50"
              :disabled="instance.status !== 'PENDING' || mutating"
              @click="approveInstance(instance.id)"
            >
              通过
            </button>
            <button
              class="px-2 py-1 rounded bg-danger text-foundation-page text-body-xs disabled:opacity-50"
              :disabled="instance.status !== 'PENDING' || mutating"
              @click="rejectInstance(instance.id)"
            >
              驳回
            </button>
            <button
              class="px-2 py-1 rounded bg-warning text-foundation-page text-body-xs disabled:opacity-50"
              :disabled="instance.status !== 'PENDING' || mutating"
              @click="cancelInstance(instance.id)"
            >
              取消
            </button>
          </div>

          <div class="space-y-2">
            <div class="text-body-xs text-foreground-2">步骤</div>
            <div
              v-for="step in instance.steps"
              :key="step.id"
              class="text-body-xs text-foreground-2"
            >
              Step {{ step.stepIndex }} · {{ step.name }} · {{ step.status }} ·
              {{ step.approvedByIds.length }}/{{ step.requiredApprovals }}
              <span v-if="step.dueAt">· due {{ formatDate(step.dueAt) }}</span>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-body-xs text-foreground-2">时间线</div>
            <div
              v-for="action in instance.actions"
              :key="action.id"
              class="text-body-xs text-foreground-2"
            >
              {{ action.action }} · {{ action.actor?.name || action.actorId }} ·
              {{ formatDate(action.createdAt) }}
              <span v-if="action.comment">· {{ action.comment }}</span>
            </div>
          </div>
        </div>
      </div>

      <button
        v-if="cursor"
        class="px-3 py-2 rounded-md border border-outline-3 text-body-sm disabled:opacity-50"
        :disabled="loadingInstances"
        @click="loadInstances(cursor)"
      >
        加载更多
      </button>
    </div>
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
  FlowInstancesQuery,
  FlowInstancesQueryVariables,
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
      formSchema {
        key
        name
        type
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

const flowInstancesQuery = graphql(`
  query FlowInstances($cursor: String, $status: ApprovalFlowStatus) {
    approvalFlowStats(rangeDays: 30) {
      totalCount
      pendingCount
      approvedCount
      rejectedCount
      canceledCount
      averageResolutionHours
    }
    approvalFlowInstances(limit: 20, cursor: $cursor, status: $status) {
      totalCount
      cursor
      items {
        id
        resourceType
        resourceId
        formData
        status
        currentStep
        createdBy
        createdAt
        updatedAt
        definition {
          id
          name
          resourceType
          isActive
        }
        actions {
          id
          stepId
          action
          fromStatus
          toStatus
          comment
          metadata
          actorId
          createdAt
          actor {
            id
            name
          }
        }
        steps {
          id
          name
          stepIndex
          status
          requiredApprovals
          approverIds
          approvedByIds
          startedAt
          dueAt
          completedAt
        }
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

const approveFlowMutation = graphql(`
  mutation FlowApprove($input: ApproveApprovalFlowInput!) {
    approvalMutations {
      approve(input: $input) {
        id
        status
      }
    }
  }
`)

const rejectFlowMutation = graphql(`
  mutation FlowReject($input: RejectApprovalFlowInput!) {
    approvalMutations {
      reject(input: $input) {
        id
        status
      }
    }
  }
`)

const cancelFlowMutation = graphql(`
  mutation FlowCancel($input: CancelApprovalFlowInput!) {
    approvalMutations {
      cancel(input: $input) {
        id
        status
      }
    }
  }
`)

type FlowDefinitionListItem = FlowDefinitionsQuery['approvalFlowDefinitions'][number]
type FlowListItem = FlowInstancesQuery['approvalFlowInstances']['items'][number]
type FlowStats = FlowInstancesQuery['approvalFlowStats']
type JsonObject = Record<string, unknown>
type FormFieldValue = string | number | boolean | null

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()

const loadingInstances = ref(false)
const mutating = ref(false)
const definitions = ref<FlowDefinitionListItem[]>([])
const selectedDefinitionId = ref('')
const selectedModelId = ref('')
const definitionName = ref('')
const definitionResourceType = ref<'MODEL'>('MODEL')
const formSchemaText = ref('[{"key":"test","name":"默认审批","type":"string"}]')
const stepsConfigText = ref('[{"name":"默认审批","requiredApprovals":1}]')
const formFieldValues = ref<Record<string, FormFieldValue>>({})
const statusFilter = ref<'' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'>('')
const actionComment = ref('')
const rollbackToStep = ref<number | null>(null)
const instances = ref<FlowListItem[]>([])
const cursor = ref<string | null>(null)
const totalCount = ref(0)
const stats = ref<FlowStats>({
  totalCount: 0,
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  canceledCount: 0,
  averageResolutionHours: 0
})

const formatDate = (date?: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

const notify = (title: string, description: string, type: ToastNotificationType) => {
  triggerNotification({
    title,
    description,
    type
  })
}

const selectedDefinition = computed(
  () =>
    definitions.value.find(
      (definition) => definition.id === selectedDefinitionId.value
    ) || null
)

const selectedDefinitionFormSchema = computed(
  () => selectedDefinition.value?.formSchema || []
)

const setFormFieldValue = (key: string, value: FormFieldValue) => {
  formFieldValues.value = {
    ...formFieldValues.value,
    [key]: value
  }
}

const syncFormFieldValues = () => {
  const nextValues: Record<string, FormFieldValue> = {}
  for (const field of selectedDefinitionFormSchema.value) {
    const currentValue = formFieldValues.value[field.key]
    if (currentValue !== undefined) {
      nextValues[field.key] = currentValue
      continue
    }
    if (field.type === 'number') {
      nextValues[field.key] = null
      continue
    }
    if (field.type === 'boolean') {
      nextValues[field.key] = false
      continue
    }
    nextValues[field.key] = ''
  }
  formFieldValues.value = nextValues
}

const buildFormData = (): JsonObject => {
  const result: JsonObject = {}
  for (const field of selectedDefinitionFormSchema.value) {
    const value = formFieldValues.value[field.key]
    if (value === undefined) continue
    result[field.key] = value
  }
  return result
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

const loadInstances = async (nextCursor?: string | null) => {
  loadingInstances.value = true
  try {
    const res = await apollo.query<FlowInstancesQuery, FlowInstancesQueryVariables>({
      query: flowInstancesQuery,
      variables: {
        cursor: nextCursor || null,
        status: statusFilter.value || null
      },
      fetchPolicy: 'network-only'
    })
    const page = res.data.approvalFlowInstances
    stats.value = res.data.approvalFlowStats || {
      totalCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      canceledCount: 0,
      averageResolutionHours: 0
    }
    totalCount.value = page?.totalCount || 0
    cursor.value = page?.cursor || null
    const items = (page?.items || []) as FlowListItem[]
    if (nextCursor) {
      instances.value = [...instances.value, ...items]
    } else {
      instances.value = items
    }
  } finally {
    loadingInstances.value = false
  }
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
          if (!key || !name || !type) {
            throw new Error(`审批填写项 ${index + 1} 缺少 key/name/type`)
          }
          return { key, name, type }
        })
      : []
    const steps = parseStepsConfig()
    const input: CreateApprovalFlowDefinitionInput = {
      name: definitionName.value.trim(),
      isActive: true,
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
  } catch (e) {
    notify('创建失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
    await loadDefinitions()
    await loadInstances()
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
    await loadInstances()
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
    await loadInstances()
  }
}

const startApproval = async () => {
  if (!selectedDefinitionId.value) return
  mutating.value = true
  try {
    const formData = buildFormData()
    await apollo.mutate({
      mutation: startFlowMutation,
      variables: {
        input: {
          definitionId: selectedDefinitionId.value,
          resourceId: selectedModelId.value || null,
          formData
        }
      } as FlowStartMutationVariables
    })
    notify('发起成功', '审批实例已创建', ToastNotificationType.Success)
  } catch (e) {
    notify('发起失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
    await loadInstances()
  }
}

const approveInstance = async (instanceId: string) => {
  mutating.value = true
  try {
    await apollo.mutate({
      mutation: approveFlowMutation,
      variables: {
        input: {
          instanceId,
          comment: actionComment.value || null
        }
      }
    })
    notify('操作成功', '审批已通过', ToastNotificationType.Success)
  } catch (e) {
    notify('操作失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
    await loadInstances()
  }
}

const rejectInstance = async (instanceId: string) => {
  if (!actionComment.value.trim()) {
    notify('驳回失败', '驳回必须填写备注', ToastNotificationType.Warning)
    return
  }
  mutating.value = true
  try {
    await apollo.mutate({
      mutation: rejectFlowMutation,
      variables: {
        input: {
          instanceId,
          comment: actionComment.value.trim(),
          rollbackToStep: rollbackToStep.value || null
        }
      }
    })
    notify('操作成功', '审批已驳回', ToastNotificationType.Success)
  } catch (e) {
    notify('操作失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
    await loadInstances()
  }
}

const cancelInstance = async (instanceId: string) => {
  mutating.value = true
  try {
    await apollo.mutate({
      mutation: cancelFlowMutation,
      variables: {
        input: {
          instanceId,
          comment: actionComment.value || null
        }
      }
    })
    notify('操作成功', '审批已取消', ToastNotificationType.Success)
  } catch (e) {
    notify('操作失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
    await loadInstances()
  }
}

const refreshAll = async () => {
  await loadDefinitions()
  await loadInstances()
}

watch(
  () => statusFilter.value,
  async () => {
    await loadInstances()
  }
)

watch(
  () => definitionResourceType.value,
  async () => {
    await loadDefinitions()
  }
)

watch(
  () => [selectedDefinitionId.value, definitions.value.length],
  () => {
    syncFormFieldValues()
  },
  { immediate: true }
)
onMounted(async () => {
  await refreshAll()
})
</script>
