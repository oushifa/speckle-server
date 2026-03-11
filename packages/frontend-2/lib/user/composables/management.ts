import { useMutation } from '@vue/apollo-composable'
import { cloneDeep } from 'lodash-es'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { useAuthManager } from '~~/lib/auth/composables/auth'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import type {
  UserDeleteInput,
  UserUpdateInput
} from '~~/lib/common/generated/gql/graphql'
import {
  convertThrowIntoFetchResult,
  getCacheId,
  getFirstErrorMessage
} from '~~/lib/common/helpers/graphql'
import {
  deleteAccountMutation,
  updateNotificationPreferencesMutation,
  updateUserMutation
} from '~~/lib/user/graphql/mutations'
import type { NotificationPreferences } from '~~/lib/user/helpers/components'

export function useUpdateUserProfile() {
  const { mutate, loading } = useMutation(updateUserMutation)
  const { triggerNotification } = useGlobalToast()

  return {
    mutate: async (input: UserUpdateInput) => {
      const result = await mutate(
        { input },
        {
          update: (cache, res) => {
            const update = res.data?.activeUserMutations.update
            if (!update) return

            // Updated LimitedUser as well
            cache.modify({
              id: getCacheId('LimitedUser', update.id),
              fields: {
                name: () => update.name,
                bio: () => update.bio || null,
                company: () => update.company || null,
                avatar: () => update.avatar || null
              }
            })
          }
        }
      ).catch(convertThrowIntoFetchResult)

      if (result?.data?.activeUserMutations.update.id) {
        triggerNotification({
          type: ToastNotificationType.Success,
          title: '个人资料已更新'
        })
      } else {
        const errMsg = getFirstErrorMessage(result?.errors)
        triggerNotification({
          type: ToastNotificationType.Danger,
          title: '更新个人资料失败',
          description: errMsg
        })
      }

      return result
    },
    loading
  }
}

export function useUpdateNotificationPreferences() {
  const { mutate, loading } = useMutation(updateNotificationPreferencesMutation)
  const { triggerNotification } = useGlobalToast()
  const { activeUser } = useActiveUser()

  return {
    mutate: async (input: NotificationPreferences) => {
      const result = await mutate(
        { input },
        {
          update: (cache, res) => {
            if (!res.data?.userNotificationPreferencesUpdate || !activeUser.value)
              return

            // Update preferences in cache
            cache.modify({
              id: getCacheId('User', activeUser.value.id),
              fields: {
                notificationPreferences: () => cloneDeep(input)
              }
            })
          }
        }
      ).catch(convertThrowIntoFetchResult)

      if (result?.data?.userNotificationPreferencesUpdate) {
        triggerNotification({
          type: ToastNotificationType.Success,
          title: '通知偏好已更新'
        })
      } else {
        const errMsg = getFirstErrorMessage(result?.errors)
        triggerNotification({
          type: ToastNotificationType.Danger,
          title: '更新通知偏好失败',
          description: errMsg
        })
      }

      return result
    },
    loading
  }
}

export function useDeleteAccount() {
  const { mutate, loading } = useMutation(deleteAccountMutation)
  const { triggerNotification } = useGlobalToast()
  const { logout } = useAuthManager()

  return {
    mutate: async (input: UserDeleteInput) => {
      const result = await mutate({
        input: {
          email: input.email.toLowerCase()
        }
      }).catch(convertThrowIntoFetchResult)

      const isSuccess = !!result?.data?.userDelete
      if (isSuccess) {
        triggerNotification({
          type: ToastNotificationType.Info,
          title: '账户已删除',
          description: '您已被注销'
        })
      } else {
        const errMsg = getFirstErrorMessage(result?.errors)
        triggerNotification({
          type: ToastNotificationType.Danger,
          title: '删除账户失败',
          description: errMsg
        })
      }

      // Log user out
      if (isSuccess) await logout({ skipToast: true })

      return isSuccess
    },
    loading
  }
}
