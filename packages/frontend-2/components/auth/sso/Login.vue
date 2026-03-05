<template>
  <form method="post" @submit="onSubmit">
    <div class="flex flex-col gap-4">
      <h1 class="text-heading-xl text-center mb-8">SSO 登录</h1>

      <FormTextInput
        v-model="email"
        type="email"
        name="email"
        label="您的工作邮箱"
        placeholder="输入您的邮箱"
        size="lg"
        color="foundation"
        :rules="[isEmail, isRequired]"
        :loading="isChecking"
        :help="helpText"
        :custom-error-message="errorMessage"
        show-label
        :disabled="loading"
        auto-focus
        @update:model-value="onEmailChange"
      />

      <AuthSsoWorkspaceSelect
        v-if="shouldShowWorkspaceSelector"
        :items="availableWorkspaces"
        :disabled="loading"
      />
    </div>

    <div class="mt-8 space-y-4">
      <FormButton size="lg" submit full-width :loading="loading" :disabled="!isValid">
        {{ buttonText }}
      </FormButton>
      <FormButton size="lg" color="subtle" full-width :to="loginRoute">
        返回登录页
      </FormButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { useForm } from 'vee-validate'
import { isEmail, isRequired } from '~/lib/common/helpers/validation'
import { loginRoute } from '~/lib/common/helpers/route'
import { useQuery } from '@vue/apollo-composable'
import { workspaceSsoByEmailQuery } from '~/lib/workspaces/graphql/queries'
import { useAuthManager, useLoginOrRegisterUtils } from '~/lib/auth/composables/auth'
import { useDebounceFn } from '@vueuse/core'
import type { AuthSsoLogin_WorkspaceFragment } from '~/lib/common/generated/gql/graphql'
import { graphql } from '~/lib/common/generated/gql/gql'

type FormValues = {
  email: string
  workspace?: AuthSsoLogin_WorkspaceFragment
}

enum EmailCheckState {
  Idle = 'idle',
  Checking = 'checking',
  Checked = 'checked'
}

graphql(`
  fragment AuthSsoLogin_Workspace on LimitedWorkspace {
    id
    slug
    name
    logo
  }
`)

const { meta, handleSubmit, setFieldValue, values } = useForm<FormValues>({
  initialValues: {
    email: '',
    workspace: undefined
  }
})

const { challenge } = useLoginOrRegisterUtils()
const { signInOrSignUpWithSso } = useAuthManager()
const logger = useLogger()
const { triggerNotification } = useGlobalToast()

const loading = ref(false)
const email = ref('')
const emailCheckState = ref<EmailCheckState>(EmailCheckState.Idle)

const {
  loading: isChecking,
  result,
  onResult
} = useQuery(
  workspaceSsoByEmailQuery,
  () => ({ email: email.value }),
  () => ({
    enabled: emailCheckState.value === 'checking'
  })
)

const helpText = computed(() => {
  if (isChecking.value) return 'Checking SSO availability...'
  if (availableWorkspaces.value.length === 0 && emailCheckState.value === 'checked') {
    return '此邮箱未关联任何启用 SSO 的工作空间'
  }
  return undefined
})

const errorMessage = computed(() => {
  if (emailCheckState.value === 'checked' && availableWorkspaces.value.length === 0) {
    return '此邮箱未关联任何启用 SSO 的工作空间'
  }
  return undefined
})

const availableWorkspaces = computed(() => result.value?.workspaceSsoByEmail || [])

// Show workspace selector only if multiple options exist
const shouldShowWorkspaceSelector = computed(
  () =>
    availableWorkspaces.value.length > 1 &&
    emailCheckState.value === EmailCheckState.Checked
)

// Valid when email passes validation and has associated workspaces
const isValid = computed(
  () =>
    meta.value.valid &&
    emailCheckState.value === 'checked' &&
    availableWorkspaces.value.length > 0
)

const buttonText = computed(() => {
  if (isChecking.value) return '检查中...'
  if (!isValid.value) return 'SSO 登录'
  return values.workspace?.name ? `登录 ${values.workspace.name}` : '登录'
})

const debouncedCheckEmail = useDebounceFn((value: string) => {
  if (!value || !meta.value.valid) {
    emailCheckState.value = EmailCheckState.Idle
    return
  }
  emailCheckState.value = EmailCheckState.Checking
}, 300)

const onEmailChange = (value: string) => {
  email.value = value
  emailCheckState.value = EmailCheckState.Idle
  setFieldValue('workspace', undefined)
  debouncedCheckEmail(value)
}

const onSubmit = handleSubmit((values) => {
  if (!values.workspace) return

  loading.value = true

  try {
    signInOrSignUpWithSso({
      challenge: challenge.value,
      workspaceSlug: values.workspace.slug
    })
  } catch (error) {
    logger.error('SSO login failed:', error)
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: 'SSO 登录失败',
      description: error instanceof Error ? error.message : '发生了未知错误'
    })
  } finally {
    loading.value = false
  }
})

onResult((res) => {
  if (!res.data) return
  emailCheckState.value = EmailCheckState.Checked
  const workspaces = res.data.workspaceSsoByEmail || []
  if (workspaces.length === 1) {
    setFieldValue('workspace', workspaces[0])
  }
})
</script>
