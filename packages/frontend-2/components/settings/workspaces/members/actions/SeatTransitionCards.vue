<template>
  <BillingTransitionCards :current-state="currentSeat" :new-state="newSeat">
    <template #current-state>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="bg-foundation rounded-full border border-outline-3 h-10 w-10 flex items-center justify-center"
          >
            <component :is="currentSeat.icon" class="w-5 h-5 text-foreground-2" />
          </div>
          <div>
            <div class="text-body-2xs text-foreground">{{ currentSeat.title }}</div>
            <div class="text-body-3xs text-foreground-2">
              {{ currentSeat.description }}
            </div>
          </div>
        </div>
        <div class="text-body-3xs font-medium text-foreground-2">Current</div>
      </div>
    </template>
    <template #new-state>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="bg-foundation rounded-full border border-blue-200 h-10 w-10 flex items-center justify-center"
          >
            <component :is="newSeat.icon" class="w-5 h-5 text-foreground-2" />
          </div>
          <div>
            <div class="text-body-2xs text-foreground">{{ newSeat.title }}</div>
            <div class="text-body-3xs text-foreground-2">{{ newSeat.description }}</div>
          </div>
        </div>
        <div v-if="isUpgrading" class="ml-auto flex items-center gap-1 font-medium">
          <template v-if="hasAvailableSeat">
            <div class="line-through text-foreground-2">
              {{ seatPrice }}/{{ billingInterval }}
            </div>
            <div class="text-primary">免费</div>
          </template>
          <template v-else-if="isFreePlan || isUnlimitedPlan">
            <div class="text-primary">免费</div>
          </template>
          <template v-else>
            <div class="text-primary">{{ seatPrice }}/{{ billingInterval }}</div>
          </template>
        </div>
        <div v-else class="ml-auto text-primary font-medium">免费</div>
      </div>
    </template>
  </BillingTransitionCards>
</template>

<script setup lang="ts">
import { EyeIcon, PencilIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  isUpgrading: boolean
  isFreePlan: boolean
  isUnlimitedPlan: boolean
  isGuest: boolean
  hasAvailableSeat: boolean
  seatPrice: string
  billingInterval: 'month' | 'year'
}>()

const editorDescription = computed(() =>
  props.isGuest ? '可以编辑项目' : '可以创建和编辑项目'
)

const SeatTypes = {
  viewer: {
    icon: EyeIcon,
    title: '查看者',
    description: '可以查看和评论项目'
  },
  editor: {
    icon: PencilIcon,
    title: '编辑者',
    description: editorDescription.value
  }
} as const

const currentSeat = computed(() =>
  props.isUpgrading ? SeatTypes.viewer : SeatTypes.editor
)

const newSeat = computed(() =>
  props.isUpgrading ? SeatTypes.editor : SeatTypes.viewer
)
</script>
