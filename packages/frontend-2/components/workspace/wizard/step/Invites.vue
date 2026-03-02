<template>
  <WorkspaceWizardStep title="邀请您的团队" description="工作区专为协作而生">
    <form
      class="flex flex-col gap-4 w-full md:max-w-lg items-center"
      @submit="onSubmit"
    >
      <div class="flex flex-col gap-2 w-full">
        <FormTextInput
          v-for="field in fields"
          :key="field.key"
          v-model="field.value"
          :name="`email-${field.key}`"
          color="foundation"
          size="lg"
          placeholder="邮箱地址"
          show-clear
          full-width
          use-label-in-errors
          label="邮箱"
          :rules="[isEmailOrEmpty]"
          @blur="field.value = field.value?.trim()"
        />
        <div>
          <FormButton color="subtle" :icon-left="PlusIcon" @click="onAddInvite">
            添加另一个
          </FormButton>
        </div>
      </div>
      <div v-if="verifiedDomain" class="flex flex-col gap-2 w-full">
        <CommonCard class="flex flex-col gap-1 !p-3">
          <FormCheckbox
            v-model="enableDomainDiscoverabilityModel"
            name="enableDomainDiscoverability"
            :label="`允许 @${verifiedDomain} 用户发现此工作区`"
          />
          <div class="ml-6 text-body-2xs text-foreground-2 select-none">
            <p>
              使用
              <span class="font-medium">@{{ verifiedDomain }}</span>
              邮箱注册的用户将能够找到并申请加入此工作区。
            </p>
          </div>
        </CommonCard>
      </div>
      <div class="flex flex-col gap-3 mt-4 w-full md:max-w-96">
        <FormButton size="lg" submit full-width>{{ nextButtonText }}</FormButton>
        <FormButton color="subtle" size="lg" full-width @click.stop="goToPreviousStep">
          返回
        </FormButton>
      </div>
    </form>
  </WorkspaceWizardStep>
</template>

<script setup lang="ts">
import { useWorkspacesWizard } from '~/lib/workspaces/composables/wizard'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { isEmailOrEmpty } from '~~/lib/common/helpers/validation'
import { useForm, useFieldArray } from 'vee-validate'
import { useMixpanel } from '~/lib/core/composables/mp'
import { useVerifiedUserEmailDomains } from '~/lib/workspaces/composables/security'
import { isUndefined } from 'lodash-es'

interface InviteForm {
  fields: string[]
}

const { domains } = useVerifiedUserEmailDomains()
const { goToNextStep, goToPreviousStep, state } = useWorkspacesWizard()
const mixpanel = useMixpanel()
const { handleSubmit } = useForm<InviteForm>({
  initialValues: {
    fields: state.value.invites
  }
})
const { fields, push } = useFieldArray<string>('fields')

const enableDomainDiscoverabilityModel = computed({
  get() {
    if (!verifiedDomain.value) return false

    return !isUndefined(state.value.enableDomainDiscoverabilityForDomain)
      ? state.value.enableDomainDiscoverabilityForDomain !== null
        ? true
        : undefined
      : true
  },
  set(value: boolean) {
    if (value && verifiedDomain.value) {
      state.value.enableDomainDiscoverabilityForDomain = verifiedDomain.value
    } else {
      state.value.enableDomainDiscoverabilityForDomain = undefined
    }
  }
})

const nextButtonText = computed(() =>
  fields.value.filter((field) => !!field.value).length > 0 ? '继续' : '跳过邀请'
)

const verifiedDomain = computed(() => {
  // only support enabling domain discoverability if there's one verified unblocked domain
  if (domains.value.length === 0) return undefined
  return domains.value[0]
})

const onAddInvite = () => {
  push('')
}

const onSubmit = handleSubmit(() => {
  const validInvites = fields.value
    .filter((field) => !!field)
    .map((field) => field.value)

  state.value.invites = validInvites

  if (enableDomainDiscoverabilityModel.value && verifiedDomain.value) {
    state.value.enableDomainDiscoverabilityForDomain = verifiedDomain.value
  } else {
    state.value.enableDomainDiscoverabilityForDomain = null
  }

  mixpanel.track('Workspace Invites Step Completed', {
    inviteCount: validInvites
  })

  goToNextStep()
})

onMounted(() => {
  mixpanel.track('Workspace Invites Step Viewed')
})
</script>
