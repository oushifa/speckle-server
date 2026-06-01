import type { MaybeNullOrUndefined, Optional } from '@speckle/shared'
import type { GenericValidateFunction } from 'vee-validate'
import { graphql } from '~/lib/common/generated/gql/gql'
import {
  SavedViewVisibility,
  type UseSavedViewValidationHelpers_SavedViewFragment
} from '~/lib/common/generated/gql/graphql'
import { Globe, User } from 'lucide-vue-next'
import type { FormRadioGroupItem } from '@speckle/ui-components'
import { useMutationLoading } from '@vue/apollo-composable'
import { useInjectedViewerState } from '~/lib/viewer/composables/setup'

graphql(`
  fragment UseSavedViewValidationHelpers_SavedView on SavedView {
    id
    isHomeView
    visibility
  }
`)

type SavedViewActionAuthCheck = {
  authorized: boolean
  errorMessage?: Optional<string>
  message?: Optional<string>
}

export const useSavedViewValidationHelpers = (params: {
  view: ComputedRef<
    MaybeNullOrUndefined<UseSavedViewValidationHelpers_SavedViewFragment>
  >
}) => {
  const homeViewPrivateError = 'Home 视图必须分享'

  const isLoading = useMutationLoading()
  const { isLoggedIn } = useActiveUser()
  const {
    resources: {
      response: { isFederatedView }
    }
  } = useInjectedViewerState()

  const baseAuth = computed((): SavedViewActionAuthCheck => {
    if (isLoading.value) {
      return { authorized: false }
    }

    if (!isLoggedIn.value) {
      return {
        authorized: false,
        errorMessage: '请先登录',
        message: '请先登录'
      }
    }

    return { authorized: true }
  })

  const canUpdate = computed(() => baseAuth.value)
  const canMove = computed(() => baseAuth.value)
  const canEditTitle = computed(() => baseAuth.value)
  const canEditDescription = computed(() => baseAuth.value)

  const canEmbed = computed((): SavedViewActionAuthCheck => {
    if (isLoading.value) {
      return {
        authorized: false
      }
    }

    if (!isLoggedIn.value) {
      return {
        authorized: false,
        errorMessage: '请先登录',
        message: '请先登录'
      }
    }

    if (params.view.value?.visibility !== SavedViewVisibility.Public) {
      return {
        authorized: false,
        errorMessage: '仅分享视图才能嵌入',
        message: '仅分享视图才能嵌入'
      }
    }

    return { authorized: true }
  })

  const canOpenEditDialog = computed(
    (): SavedViewActionAuthCheck => {
      if (isLoading.value) {
        return {
          authorized: false
        }
      }

      if (!isLoggedIn.value) {
        return {
          authorized: false,
          errorMessage: '请先登录',
          message: '请先登录'
        }
      }

      return { authorized: true }
    }
  )

  const isOnlyVisibleToMe = computed(
    () => params.view.value?.visibility === SavedViewVisibility.AuthorOnly
  )
  const isHomeView = computed(() => params.view.value?.isHomeView)

  /**
   * Visibility options for visibility radio group
   */
  const visibilityOptions = computed((): FormRadioGroupItem<SavedViewVisibility>[] => [
    {
      value: SavedViewVisibility.Public,
      title: '分享',
      introduction: '可见给所有有访问模型权限的用户',
      icon: Globe
    },
    {
      value: SavedViewVisibility.AuthorOnly,
      title: '仅分享给我',
      introduction: '仅可见给视图作者',
      icon: User,
      ...(params.view.value?.isHomeView
        ? {
            disabled: true,
            help: homeViewPrivateError
          }
        : {})
    }
  ])

  const canSetHomeView = computed(
    (): { authorized: boolean; message: Optional<string> } => {
      if (!isLoggedIn.value || isLoading.value) {
        return {
          authorized: false,
          message: !isLoggedIn.value ? '请先登录' : undefined
        }
      }

      if (isFederatedView.value) {
        return {
          authorized: false,
          message: '在联合视图中无法更新 Home 视图设置'
        }
      }

      return { authorized: true, message: undefined }
    }
  )

  const canToggleVisibility = computed(() => {
    if (!isLoggedIn.value || isLoading.value) {
      return {
        authorized: false,
        message: !isLoggedIn.value ? '请先登录' : undefined
      }
    }

    if (isHomeView.value && !isOnlyVisibleToMe.value) {
      return {
        authorized: false,
        message: homeViewPrivateError
      }
    }

    return { authorized: true, message: undefined }
  })

  /**
   * Vee-validate rule for visibility checks
   */
  const validateVisibility: GenericValidateFunction<SavedViewVisibility> = (value) => {
    if (!params.view.value) return true
    if (!params.view.value.isHomeView) return true

    return value === SavedViewVisibility.AuthorOnly ? homeViewPrivateError : true
  }

  return {
    validateVisibility,
    visibilityOptions,
    canUpdate,
    isOnlyVisibleToMe,
    canSetHomeView,
    isHomeView,
    canToggleVisibility,
    canMove,
    canEditTitle,
    canEditDescription,
    canOpenEditDialog,
    canEmbed
  }
}
