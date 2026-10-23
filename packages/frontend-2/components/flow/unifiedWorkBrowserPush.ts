import { gql } from '@apollo/client/core'
import type { TypedDocumentNode } from '@apollo/client/core'
import { useApolloClient } from '@vue/apollo-composable'

/**
 * Browser-side fallback for the unified work todo push.
 *
 * Some deployments run the server on a network that cannot reach the unified
 * work platform while the user's browser can. In that case the browser posts the
 * exact same payload the server would have posted, then reports the result back
 * so the push badge stays accurate.
 */

export type UnifiedWorkClientConfig = {
  host: string
  systemCode: string
  token: string
}

export type UnifiedWorkPushRequest = {
  taskId: string
  payload: Record<string, unknown>
}

export type BrowserPushOutcome = {
  /** false when the browser has nothing to push (no config, no pending payloads) */
  attempted: boolean
  pushed: number
  failed: number
  /** true when the platform could not be reached at all (DNS / CORS / mixed content) */
  networkError: boolean
  errors: string[]
}

type ClientConfigResult = {
  unifiedWorkClientConfig?: UnifiedWorkClientConfig | null
}

type PushRequestsResult = {
  unifiedWorkPushRequests: UnifiedWorkPushRequest[]
}

type RecordResultVariables = {
  input: {
    instanceId: string
    taskId: string
    success: boolean
    errorType?: string | null
    errorMessage?: string | null
    errorDetail?: Record<string, unknown> | null
  }
}

const clientConfigQuery = gql`
  query UnifiedWorkClientConfig {
    unifiedWorkClientConfig {
      host
      systemCode
      token
    }
  }
` as unknown as TypedDocumentNode<ClientConfigResult, Record<string, never>>

const pushRequestsQuery = gql`
  query UnifiedWorkPushRequests($instanceId: ID!) {
    unifiedWorkPushRequests(instanceId: $instanceId) {
      taskId
      payload
    }
  }
` as unknown as TypedDocumentNode<PushRequestsResult, { instanceId: string }>

const recordResultMutation = gql`
  mutation RecordUnifiedWorkPushResult($input: RecordUnifiedWorkPushResultInput!) {
    recordUnifiedWorkPushResult(input: $input)
  }
` as unknown as TypedDocumentNode<
  { recordUnifiedWorkPushResult: boolean },
  RecordResultVariables
>

const MAX_ERROR_LENGTH = 500

const errorMessageOf = (value: unknown) => {
  if (value instanceof Error) return value.message
  return String(value)
}

export const useUnifiedWorkBrowserPush = () => {
  const apollo = useApolloClient().client

  const record = async (variables: RecordResultVariables) => {
    try {
      await apollo.mutate({
        mutation: recordResultMutation,
        variables,
        fetchPolicy: 'no-cache'
      })
    } catch {
      // Reporting the outcome must never break the push itself.
    }
  }

  const pushFromBrowser = async (instanceId: string): Promise<BrowserPushOutcome> => {
    const idle: BrowserPushOutcome = {
      attempted: false,
      pushed: 0,
      failed: 0,
      networkError: false,
      errors: []
    }

    let config: UnifiedWorkClientConfig | null | undefined
    try {
      const res = await apollo.query({
        query: clientConfigQuery,
        fetchPolicy: 'network-only'
      })
      config = res.data?.unifiedWorkClientConfig
    } catch {
      return idle
    }

    // No static token configured on the server means the browser cannot
    // authenticate, so the caller should keep using the server-side push.
    if (!config?.host || !config?.token) return idle

    let requests: UnifiedWorkPushRequest[] = []
    try {
      const res = await apollo.query({
        query: pushRequestsQuery,
        variables: { instanceId },
        fetchPolicy: 'network-only'
      })
      requests = res.data?.unifiedWorkPushRequests || []
    } catch {
      return idle
    }

    if (!requests.length) return { ...idle, attempted: true }

    const outcome: BrowserPushOutcome = {
      attempted: true,
      pushed: 0,
      failed: 0,
      networkError: false,
      errors: []
    }

    for (const request of requests) {
      const url = `${config.host}/api/v1/unifiedWork/work-item/push`
      let errorType: string | null = null
      let errorMessage: string | null = null
      let errorDetail: Record<string, unknown> | null = null
      let success = false

      try {
        const response = await fetch(url, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.token}`
          },
          body: JSON.stringify(request.payload)
        })

        if (response.ok) {
          success = true
        } else {
          const body = await response.text().catch(() => '')
          errorType = `HTTP_${response.status}`
          errorMessage = body.slice(0, MAX_ERROR_LENGTH) || `HTTP ${response.status}`
          errorDetail = {
            url,
            method: 'POST',
            status: response.status,
            statusText: response.statusText,
            responseBody: body.slice(0, MAX_ERROR_LENGTH)
          }
        }
      } catch (err) {
        // fetch() rejects for CORS / mixed content / DNS / offline. None of those
        // produce an HTTP response, so they are worth retrying on the server.
        outcome.networkError = true
        errorType = 'BROWSER_NETWORK_ERROR'
        errorMessage = errorMessageOf(err)
        errorDetail = {
          url,
          method: 'POST',
          host: config.host,
          message: errorMessage
        }
      }

      await record({
        input: {
          instanceId,
          taskId: request.taskId,
          success,
          errorType,
          errorMessage,
          errorDetail
        }
      })

      if (success) {
        outcome.pushed += 1
      } else {
        outcome.failed += 1
        if (errorMessage) outcome.errors.push(errorMessage)
      }
    }

    return outcome
  }

  return { pushFromBrowser }
}
