import { useTimeoutFn } from '@vueuse/core'
import type { Optional } from '@speckle/shared'
import type { ToastNotification } from '@speckle/ui-components'
import { ToastNotificationType } from '@speckle/ui-components'
import { useSynchronizedCookie } from '~/lib/common/composables/reactiveCookie'

/**
 * Persisting toast state between reqs and between CSR & SSR loads so that we can trigger
 * toasts anywhere and anytime
 */
const useGlobalToastState = () =>
  useSynchronizedCookie<Optional<ToastNotification>>('global-toast-state')

/**
 * Set up a new global toast manager/renderer (don't use this in multiple components that live at the same time)
 */
export function useGlobalToastManager() {
  const stateNotification = useGlobalToastState()

  const currentNotification = ref(stateNotification.value)
  const readOnlyNotification = computed(() => currentNotification.value)

  const dismiss = () => {
    currentNotification.value = undefined
    if (stateNotification.value !== undefined) {
      stateNotification.value = undefined
    }
  }

  const { start, stop } = useTimeoutFn(() => {
    dismiss()
  }, 4000)

  watch(
    stateNotification,
    (newVal) => {
      if (!newVal) {
        currentNotification.value = undefined
        stop()
        return
      }
      if (import.meta.server) {
        currentNotification.value = newVal
        return
      }

      // First dismiss old notification, then set a new one on next tick
      currentNotification.value = undefined

      nextTick(() => {
        currentNotification.value = newVal

        // (re-)init timeout
        stop()
        if (newVal.autoClose !== false) start()
      })
    },
    { deep: true, immediate: true }
  )

  return { currentNotification: readOnlyNotification, dismiss }
}

/**
 * Trigger global toast notifications
 */
export function useGlobalToast() {
  const stateNotification = useGlobalToastState()
  const logger = useLogger()

  /**
   * Trigger a new toast notification
   */
  const triggerNotification = (notification: ToastNotification) => {
    stateNotification.value = notification

    if (import.meta.server) {
      logger.info('Queued SSR toast notification', notification)
    }
  }

  /**
   * Immediately dismiss the current toast (clears the global toast state).
   * The renderer (ToastManager) will sync and close the visible toast.
   */
  const dismiss = () => {
    if (stateNotification.value !== undefined) {
      stateNotification.value = undefined
    }
  }

  return { triggerNotification, dismiss }
}

export { ToastNotificationType }
export type { ToastNotification }
