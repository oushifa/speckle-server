import type { TypedDocumentNode } from '@apollo/client/core'
import { gql } from '@apollo/client/core'

export type UnifiedWorkPushRecord = {
  id: string
  instanceId: string
  taskId: string
  systemCode: string
  stepIndex: number
  approverId?: string | null
  account?: string | null
  status: string
  errorType?: string | null
  errorMessage?: string | null
  errorDetail?: Record<string, unknown> | null
  attempts: number
  lastAttemptAt: string
  createdAt: string
  updatedAt: string
}

export type FlowListItem = {
  id: string
  projectId?: string | null
  project?: { id: string; name: string } | null
  resourceType: string
  resourceId?: string | null
  model?: { id: string; name: string } | null
  formData?: Record<string, unknown> | null
  status: string
  currentStep: number
  createdBy: string
  createdByUser?: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
  unifiedWorkPush?: UnifiedWorkPushRecord | null
  definition?: {
    id: string
    name: string
    resourceType: string
    isActive: boolean
    templateId: string
  } | null
  actions: Array<{
    id: string
    stepId?: string | null
    action: string
    fromStatus?: string | null
    toStatus?: string | null
    comment?: string | null
    metadata?: Record<string, unknown> | null
    actorId: string
    createdAt: string
    actor?: { id: string; name: string } | null
  }>
  steps: Array<{
    id: string
    name: string
    stepIndex: number
    status: string
    requiredApprovals: number
    approverIds: string[]
    approvers?: Array<{ id: string; name: string } | null>
    approvedByIds: string[]
    approvedBy?: Array<{ id: string; name: string } | null>
    startedAt?: string | null
    dueAt?: string | null
    completedAt?: string | null
  }>
}

export type FlowInstancesQueryResult = {
  approvalFlowInstances: {
    totalCount: number
    cursor: string | null
    items: FlowListItem[]
  }
}

export type FlowInstancesQueryVariables = {
  cursor?: string | null
  status?: string | null
  limit?: number | null
  scope?: string | null
}

export const flowInstancesQuery = gql`
  query FlowInstancesByScope(
    $cursor: String
    $status: ApprovalFlowStatus
    $limit: Int = 10
    $scope: ApprovalFlowInstanceListScope = ALL
  ) {
    approvalFlowInstances(
      limit: $limit
      cursor: $cursor
      status: $status
      scope: $scope
    ) {
      totalCount
      cursor
      items {
        id
        projectId
        project {
          id
          name
        }
        resourceType
        resourceId
        model {
          id
          name
        }
        formData
        status
        currentStep
        createdBy
        createdByUser {
          id
          name
        }
        createdAt
        updatedAt
        definition {
          id
          name
          resourceType
          isActive
          templateId
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
          approvers {
            id
            name
          }
          approvedByIds
          approvedBy {
            id
            name
          }
          startedAt
          dueAt
          completedAt
        }
        unifiedWorkPush {
          id
          instanceId
          taskId
          systemCode
          stepIndex
          approverId
          account
          status
          errorType
          errorMessage
          errorDetail
          attempts
          lastAttemptAt
          createdAt
          updatedAt
        }
      }
    }
  }
` as unknown as TypedDocumentNode<FlowInstancesQueryResult, FlowInstancesQueryVariables>
