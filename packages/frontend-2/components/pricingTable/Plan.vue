<template>
  <div
    class="border border-outline-3 bg-foundation text-foreground rounded-lg p-5 flex flex-col w-full"
  >
    <div class="lg:h-32 flex flex-col">
      <div class="flex-1">
        <div class="flex items-center gap-x-2">
          <h4 class="text-body font-medium">
            {{ formatName(plan) }}
          </h4>
          <CommonBadge v-if="badgeText" rounded>
            {{ badgeText }}
          </CommonBadge>
        </div>
        <p class="text-body mt-1">
          <span class="font-medium">
            {{ planPrice }}
          </span>
          编辑器席位/月
        </p>
        <template v-if="plan !== WorkspacePlans.Free">
          <div class="flex items-center gap-x-2 mt-3 px-1">
            <FormSwitch
              v-model="isYearlyIntervalSelected"
              :show-label="false"
              name="billing-interval"
            />
            <span class="text-body-2xs">Billed yearly</span>
            <CommonBadge rounded color-classes="text-foreground-2 bg-primary-muted">
              -10%
            </CommonBadge>
          </div>
        </template>
      </div>
      <div class="w-full mt-4">
        <div v-if="hasCta">
          <slot name="cta" />
        </div>
        <div v-else v-tippy="buttonTooltip">
          <FormButton
            :color="buttonColor"
            :disabled="!isSelectable"
            full-width
            @click="handleUpgradeClick"
          >
            {{ buttonText }}
          </FormButton>
        </div>
      </div>
    </div>
    <ul class="flex flex-col gap-y-2 mt-4 pt-3 border-t border-outline-3">
      <PricingTablePlanFeature
        v-for="feature in commonFeatures"
        :key="feature.displayName"
        :display-name="feature.displayName"
        :description="feature.description"
        is-included
      />
      <PricingTablePlanFeature
        v-for="(featureMetadata, feature) in WorkspacePlanFeaturesMetadata"
        :key="feature"
        :is-included="planFeatures.includes(feature)"
        :display-name="featureMetadata.displayName"
        :description="featureMetadata.description"
      />
    </ul>
    <div v-if="showAddons && displayAddons.length > 0" class="mt-auto lg:h-32 pt-8">
      <h5 class="text-body-2xs mb-2 text-foreground-2">Available add-ons</h5>
      <div class="flex flex-col gap-y-2">
        <PricingTableAddon
          v-for="addon in displayAddons"
          :key="addon.title"
          :title="addon.title"
          :base-plan="props.plan === WorkspacePlans.Team ? 'team' : 'pro'"
          :is-yearly-interval-selected="isYearlyIntervalSelected"
          :currency="props.currency"
          :tooltip="addon.tooltip"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  type MaybeNullOrUndefined,
  WorkspacePlans,
  WorkspacePlanFeaturesMetadata,
  WorkspacePlanConfigs
} from '@speckle/shared'
import {
  type WorkspacePlan,
  WorkspacePlanStatuses,
  BillingInterval,
  Currency
} from '~/lib/common/generated/gql/graphql'
import { useWorkspacePlanPrices } from '~/lib/billing/composables/prices'
import { formatPrice, formatName } from '~/lib/billing/helpers/plan'
import type { SetupContext } from 'vue'
import { useFeatureFlags } from '~/lib/common/composables/env'

const emit = defineEmits<{
  (e: 'onUpgradeClick'): void
}>()

const props = defineProps<{
  plan: WorkspacePlans
  canUpgrade: boolean
  workspaceId?: MaybeNullOrUndefined<string>
  currentPlan?: MaybeNullOrUndefined<WorkspacePlan>
  activeBillingInterval?: MaybeNullOrUndefined<BillingInterval>
  hasSubscription?: MaybeNullOrUndefined<boolean>
  currency?: Currency
  showAddons?: boolean
}>()

const isYearlyIntervalSelected = defineModel<boolean>('isYearlyIntervalSelected', {
  default: false
})

const slots: SetupContext['slots'] = useSlots()
const { prices } = useWorkspacePlanPrices()
const featureFlags = useFeatureFlags()

const planLimits = computed(
  () => WorkspacePlanConfigs({ featureFlags })[props.plan].limits
)
const planFeatures = computed(
  () => WorkspacePlanConfigs({ featureFlags })[props.plan].features
)

const commonFeatures = shallowRef([
  {
    displayName: '无限制成员和访客',
    description: '您可以在您的工作空间中拥有无限制的人员'
  },
  {
    displayName: '免费查看席位',
    description: '在网络查看器上，查看和评论模型的人员可以免费使用。'
  },
  {
    displayName: `${planLimits.value.projectCount} 项目${
      planLimits.value.projectCount === 1 ? '' : 's'
    }`,
    description:
      props.plan === WorkspacePlans.Pro
        ? 'Your maximum number of projects. Can be extended with the Unlimited projects and models add-on.'
        : 'Your maximum number of projects'
  },
  {
    displayName: `${planLimits.value.modelCount} models per workspace`,
    description:
      props.plan === WorkspacePlans.Pro
        ? '您可以在您的工作空间中拥有无限制的模型。可以通过 Unlimited projects and models add-on 扩展。'
        : '您可以在您的工作空间中拥有无限制的模型'
  },
  {
    displayName: planLimits.value.versionsHistory
      ? `${planLimits.value.versionsHistory.value} 天版本历史记录`
      : '完整版本历史记录',
    description: '您可以访问和比较您模型的早期版本。最新版本始终可访问。'
  },
  {
    displayName: planLimits.value.versionsHistory
      ? `${planLimits.value.versionsHistory.value} 天评论历史记录`
      : '完整评论历史记录',
    description: '在 3D 网络查看器中访问过去的评论'
  }
])
const planPrice = computed(() => {
  let basePrice = 0
  if (props.plan === WorkspacePlans.Team || props.plan === WorkspacePlans.Pro) {
    basePrice =
      prices.value?.[props.currency || Currency.Usd]?.[props.plan]?.[
        isYearlyIntervalSelected.value
          ? BillingInterval.Yearly
          : BillingInterval.Monthly
      ].amount || 0
  }

  return formatPrice({
    amount: basePrice
      ? isYearlyIntervalSelected.value
        ? basePrice / 12
        : basePrice
      : 0,
    currency: props.currency || Currency.Usd
  })
})

const hasCta = computed(() => !!slots.cta)

const canUpgradeToPlan = computed(() => {
  if (!props.currentPlan) return false

  const allowedUpgrades: Partial<Record<WorkspacePlans, WorkspacePlans[]>> = {
    [WorkspacePlans.Free]: [WorkspacePlans.Team, WorkspacePlans.Pro],
    [WorkspacePlans.Team]: [WorkspacePlans.Pro],
    [WorkspacePlans.TeamUnlimited]: [WorkspacePlans.Team, WorkspacePlans.Pro],
    [WorkspacePlans.ProUnlimited]: [WorkspacePlans.Pro]
  }

  return allowedUpgrades[props.currentPlan.name]?.includes(props.plan)
})

const isMatchingInterval = computed(
  () =>
    props.activeBillingInterval ===
    (isYearlyIntervalSelected.value ? BillingInterval.Yearly : BillingInterval.Monthly)
)

const isDowngrade = computed(() => {
  return !canUpgradeToPlan.value && props.currentPlan?.name !== props.plan
})

const isMatchingTier = computed(() => {
  return (
    (props.currentPlan?.name === WorkspacePlans.Team &&
      props.plan === WorkspacePlans.Team) ||
    (props.currentPlan?.name === WorkspacePlans.Pro &&
      props.plan === WorkspacePlans.Pro) ||
    (props.currentPlan?.name === WorkspacePlans.TeamUnlimited &&
      props.plan === WorkspacePlans.Team) ||
    (props.currentPlan?.name === WorkspacePlans.ProUnlimited &&
      props.plan === WorkspacePlans.Pro)
  )
})

const isCurrentPlan = computed(() => {
  if (props.plan === WorkspacePlans.Free) {
    return props.currentPlan?.name === props.plan
  }

  return (
    isMatchingInterval.value &&
    (props.currentPlan?.name === props.plan || isMatchingTier.value)
  )
})

const isAnnualToMonthly = computed(() => {
  return (
    !isMatchingInterval.value &&
    !isYearlyIntervalSelected.value &&
    (props.currentPlan?.name === props.plan ||
      (props.currentPlan?.name === WorkspacePlans.TeamUnlimited &&
        props.plan === WorkspacePlans.Team) ||
      (props.currentPlan?.name === WorkspacePlans.ProUnlimited &&
        props.plan === WorkspacePlans.Pro))
  )
})

const isMonthlyToAnnual = computed(() => {
  return (
    !isMatchingInterval.value &&
    props.currentPlan?.name === props.plan &&
    isYearlyIntervalSelected.value
  )
})

const isSelectable = computed(() => {
  if (!props.canUpgrade) return false
  // Free CTA has no clickable scenario
  if (props.plan === WorkspacePlans.Free) return false

  // Dont allow upgrades during cancelation
  if (props.currentPlan?.status === WorkspacePlanStatuses.CancelationScheduled) {
    return false
  }

  // Allow selection if current plan is canceled and plan is upgradeable or the same
  if (props.currentPlan?.status === WorkspacePlanStatuses.Canceled) {
    return canUpgradeToPlan.value || isMatchingTier.value
  }

  // Allow selection if switching from monthly to yearly for the same plan
  if (isMonthlyToAnnual.value && props.currentPlan?.name === props.plan) return true

  // Disable if current plan and intervals match
  if (isCurrentPlan.value) return false

  // Handle billing interval changes
  if (!isMatchingInterval.value) {
    // Allow yearly upgrades from monthly plans
    if (isMonthlyToAnnual.value) return canUpgradeToPlan.value

    // Never allow switching to monthly if currently on yearly billing
    if (props.activeBillingInterval === BillingInterval.Yearly) return false

    // Allow monthly plan changes only for upgrades
    return canUpgradeToPlan.value
  }

  // Allow upgrades to higher tier plans
  return canUpgradeToPlan.value
})

const buttonColor = computed(() => {
  if (props.currentPlan?.name === WorkspacePlans.Free) {
    return props.plan === WorkspacePlans.Team ? 'primary' : 'outline'
  }
  return 'outline'
})

const buttonText = computed(() => {
  // Current plan case
  if (
    isCurrentPlan.value &&
    props.currentPlan?.status !== WorkspacePlanStatuses.Canceled
  ) {
    return '当前计划'
  }

  // Allow if current plan is Free, or the current plan is expired/canceled
  if (
    props.currentPlan?.name === WorkspacePlans.Free ||
    props.currentPlan?.status === WorkspacePlanStatuses.Canceled
  ) {
    return `订阅 ${formatName(props.plan)}`
  }
  // Billing interval and lower plan case
  if (isDowngrade.value) {
    return `降级到 ${formatName(props.plan)}`
  }
  // Billing interval change and current plan
  if (isAnnualToMonthly.value) {
    return '切换到月度计划'
  }
  if (isMonthlyToAnnual.value) {
    return '切换到年度计划'
  }
  // Upgrade case
  return canUpgradeToPlan.value ? `升级到 ${formatName(props.plan)}` : ''
})

const buttonTooltip = computed(() => {
  if (
    props.plan === WorkspacePlans.Free &&
    props.currentPlan?.name === WorkspacePlans.Free
  )
    return undefined

  if (!props.canUpgrade) {
    return '您必须是工作空间管理员。'
  }

  if (props.currentPlan?.status === WorkspacePlanStatuses.Canceled) {
    if (!canUpgradeToPlan.value && !isMatchingTier.value) {
      return '您只能重新订阅相同或更高的计划'
    }
  }

  if (props.currentPlan?.status === WorkspacePlanStatuses.CancelationScheduled) {
    return '您必须先续订订阅'
  }

  if (isDowngrade.value) {
    return '降级计划目前不支持。请联系 billing@speckle.systems。'
  }

  if (isAnnualToMonthly.value) {
    return '从年度计划切换到月度计划目前不支持。请联系 billing@speckle.systems。'
  }

  if (
    props.activeBillingInterval === BillingInterval.Yearly &&
    !isYearlyIntervalSelected.value &&
    canUpgradeToPlan.value
  ) {
    return '从年度计划升级到月度计划目前不支持。请联系 billing@speckle.systems。'
  }

  return undefined
})

const badgeText = computed(() =>
  props.currentPlan?.name === props.plan &&
  props.currentPlan?.status !== WorkspacePlanStatuses.Canceled &&
  props.currentPlan?.status !== WorkspacePlanStatuses.CancelationScheduled
    ? 'Current plan'
    : ''
)

const displayAddons = computed(() => {
  if (props.plan === WorkspacePlans.Pro) {
    return [
      {
        title: '无限制项目和模型',
        tooltip: '您可以在下一步购买此功能'
      }
    ]
  }
  return []
})

const handleUpgradeClick = () => {
  if (!props.workspaceId) return
  if (props.plan !== WorkspacePlans.Team && props.plan !== WorkspacePlans.Pro) return
  emit('onUpgradeClick')
}
</script>
