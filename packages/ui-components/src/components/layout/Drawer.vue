<template>
  <TransitionRoot as="template" :show="open">
    <Dialog as="div" class="relative" static @close="onDialogClose">
      <div class="fixed inset-0 overflow-hidden" :style="{ zIndex: `${zIndex}` }">
        <TransitionChild
          v-if="mask"
          as="template"
          enter="ease-out duration-300"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <button
            type="button"
            aria-label="Close drawer mask"
            class="absolute inset-0 bg-black/45 dark:bg-black/60"
            @click="onMaskClick"
          />
        </TransitionChild>

        <div class="absolute inset-0 pointer-events-none" :class="wrapperClasses">
          <TransitionChild
            as="template"
            enter="transform transition ease-in-out duration-300"
            :enter-from="panelEnterFrom"
            enter-to="translate-x-0 translate-y-0"
            leave="transform transition ease-in-out duration-300"
            leave-from="translate-x-0 translate-y-0"
            :leave-to="panelEnterFrom"
          >
            <DialogPanel
              class="pointer-events-auto bg-foundation-page border border-outline-3 shadow-xl text-foreground flex flex-col"
              :class="[panelSizeClasses, panelClasses || '']"
              :style="panelStyle"
            >
              <div
                v-if="$slots.header"
                class="border-b border-outline-3 px-4 py-3 sm:px-6"
              >
                <slot name="header" />
              </div>

              <div
                v-else-if="hasBuiltInHeader"
                class="border-b border-outline-3 px-4 py-3 sm:px-6 flex items-center justify-between gap-4"
              >
                <div class="min-w-0 flex-1">
                  <slot name="title">
                    <div class="truncate text-heading-sm">
                      {{ title }}
                    </div>
                  </slot>
                </div>

                <div class="flex items-center gap-2">
                  <slot name="extra" />
                  <FormButton
                    v-if="closable"
                    color="subtle"
                    size="sm"
                    class="!w-6 !h-6 !p-0 text-foreground-2"
                    @click="closeDrawer"
                  >
                    <XMarkIcon class="w-5 h-5" />
                  </FormButton>
                </div>
              </div>

              <div
                v-if="!destroyOnClose || open"
                class="flex-1 overflow-y-auto simple-scrollbar text-body-xs"
                :class="bodyClasses || 'px-4 py-4 sm:px-6 sm:py-5'"
              >
                <slot />
              </div>

              <div
                v-if="$slots.footer"
                class="border-t border-outline-3 px-4 py-3 sm:px-6"
              >
                <slot name="footer" />
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { Dialog, DialogPanel, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { useEventListener } from '@vueuse/core'
import { computed, useSlots } from 'vue'
import { FormButton } from '~~/src/lib'

type DrawerPlacement = 'left' | 'right' | 'top' | 'bottom'

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'close'): void
}>()

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    placement?: DrawerPlacement
    width?: number | string
    height?: number | string
    closable?: boolean
    mask?: boolean
    maskClosable?: boolean
    keyboard?: boolean
    zIndex?: number
    bodyClasses?: string
    panelClasses?: string
    destroyOnClose?: boolean
  }>(),
  {
    placement: 'right',
    width: 378,
    height: 378,
    closable: true,
    mask: true,
    maskClosable: true,
    keyboard: true,
    zIndex: 1000,
    destroyOnClose: false
  }
)

const slots = useSlots()

const open = computed({
  get: () => props.open,
  set: (newValue) => emit('update:open', newValue)
})

const normalizedWidth = computed(() =>
  typeof props.width === 'number' ? `${props.width}px` : props.width
)

const normalizedHeight = computed(() =>
  typeof props.height === 'number' ? `${props.height}px` : props.height
)

const hasBuiltInHeader = computed(
  () => !!props.title || !!slots.title || !!slots.extra || props.closable
)

const wrapperClasses = computed(() => {
  switch (props.placement) {
    case 'left':
      return 'justify-start items-stretch'
    case 'top':
      return 'justify-stretch items-start'
    case 'bottom':
      return 'justify-stretch items-end'
    default:
      return 'justify-end items-stretch'
  }
})

const panelSizeClasses = computed(() => {
  switch (props.placement) {
    case 'top':
    case 'bottom':
      return 'w-full'
    default:
      return 'h-full'
  }
})

const panelStyle = computed(() => {
  if (props.placement === 'top' || props.placement === 'bottom') {
    return {
      height: normalizedHeight.value,
      maxHeight: '100vh'
    }
  }

  return {
    width: normalizedWidth.value,
    maxWidth: '100vw'
  }
})

const panelEnterFrom = computed(() => {
  switch (props.placement) {
    case 'left':
      return '-translate-x-full'
    case 'top':
      return '-translate-y-full'
    case 'bottom':
      return 'translate-y-full'
    default:
      return 'translate-x-full'
  }
})

const closeDrawer = () => {
  if (!open.value) return
  open.value = false
  emit('close')
}

const onMaskClick = () => {
  if (!props.maskClosable) return
  closeDrawer()
}

const onDialogClose = () => {}

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (!open.value || !props.keyboard) return
  if (event.key !== 'Escape') return
  event.preventDefault()
  closeDrawer()
})
</script>
