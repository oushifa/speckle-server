<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
    <SettingsWorkspacesBillingAddOnsCard
      title="无限制项目和模型"
      :subtitle="`${addonPrice} per editor/month`"
      info="在您的工作区中无限制地创建项目和模型。"
      disclaimer="仅在 Business 计划上可用"
      :button="unlimitedAddOnButton"
    />

    <SettingsWorkspacesBillingAddOnsCard
      title="额外数据区域"
      :subtitle="`${currency === Currency.Gbp ? '£' : '$'}500 per region/month`"
      info="通过为您的工作区添加额外的数据区域，解锁每个项目的数据驻留。"
      disclaimer="仅在 Business 计划上可用"
      :button="contactButton"
    />

    <SettingsWorkspacesBillingAddOnsCard
      title="优先支持"
      subtitle="与我们联系"
      info="White-glove treatment with private support channel, onboarding calls and more."
      disclaimer="Only on Business plan"
      :button="contactButton"
    />

    <SettingsWorkspacesBillingUpgradeDialog
      v-model:open="isUpgradeDialogOpen"
      :slug="props.slug"
      :plan="planToUpgrade"
      :billing-interval="
        intervalIsYearly ? BillingInterval.Yearly : BillingInterval.Monthly
      "
      :workspace-id="workspaceId"
    />
  </div>
</template>

<script lang="ts" setup>
import { useWorkspacePlan } from '~~/lib/workspaces/composables/plan'
import { useWorkspaceAddonPrices } from '~/lib/billing/composables/prices'
import { formatPrice } from '~/lib/billing/helpers/plan'
import { PaidWorkspacePlans, type MaybeNullOrUndefined } from '@speckle/shared'
import { BillingInterval, Currency } from '~/lib/common/generated/gql/graphql'
import { useActiveWorkspace } from '~/lib/workspaces/composables/activeWorkspace'
import { useMixpanel } from '~~/lib/core/composables/mp'

const props = defineProps<{
  slug: string
  workspaceId: MaybeNullOrUndefined<string>
}>()

const {
  isBusinessPlan,
  currency,
  plan,
  intervalIsYearly,
  billingInterval,
  hasUnlimitedAddon
} = useWorkspacePlan(props.slug)
const { addonPrices } = useWorkspaceAddonPrices()
const { isAdmin } = useActiveWorkspace(props.slug)
const mixpanel = useMixpanel()

const isUpgradeDialogOpen = ref(false)

const contactButton = computed(() => ({
  text: 'Contact us',
  id: 'contact-us',
  disabled: !isAdmin.value,
  onClick: () => {
    window.location.href = 'mailto:billing@speckle.systems'
  }
}))

const addOnButtonTooltip = computed(() => {
  if (!isAdmin.value)
    return 'You must be a workspace admin in order to purchase the add-on'
  if (hasUnlimitedAddon.value)
    return 'The add-on is already included in your subscription'
  if (!isBusinessPlan.value) return 'Only available for the Business plan'
  return undefined
})

const unlimitedAddOnButton = computed(() => ({
  text: 'Buy add-on',
  id: 'buy-add-on',
  disabled: !isBusinessPlan.value || hasUnlimitedAddon.value || !isAdmin.value,
  disabledMessage: addOnButtonTooltip.value,
  onClick: () => {
    isUpgradeDialogOpen.value = true

    mixpanel.track('Add-on CTA Clicked', {
      plan: plan.value?.name,
      cycle: billingInterval.value,
      type: 'unlimited',
      // eslint-disable-next-line camelcase
      workspace_id: props.workspaceId
    })
  }
}))

const planToUpgrade = computed(() => {
  return plan.value?.name === PaidWorkspacePlans.Team
    ? PaidWorkspacePlans.TeamUnlimited
    : PaidWorkspacePlans.ProUnlimited
})

const addonPrice = computed(() => {
  if (!plan.value) return null
  const addonPrice =
    addonPrices.value?.[currency.value]?.[plan.value.name as PaidWorkspacePlans]
  if (!addonPrice) return null

  return formatPrice({
    amount: intervalIsYearly.value
      ? addonPrice.yearly.amount / 12
      : addonPrice.monthly.amount,
    currency: currency.value
  })
})
</script>
