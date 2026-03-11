<template>
  <LayoutDialog v-model:open="isOpen" max-width="sm" :buttons="dialogButtons">
    <template #header>
      {{ props.application ? '编辑应用程序' : '创建应用程序' }}
    </template>
    <form @submit="onSubmit">
      <div class="flex flex-col gap-3 mb-2">
        <FormTextInput
          v-model="name"
          label="应用程序名称"
          help="应用程序名称"
          color="foundation"
          name="name"
          :rules="[isRequired]"
          show-label
          type="text"
        />
        <FormSelectMulti
          v-model="scopes"
          name="scopes"
          label="作用域"
          placeholder="选择作用域"
          help="为令牌限制最小作用域是一种好的实践。"
          :rules="[isMultiItemSelected]"
          show-label
          :items="applicationScopes"
          mount-menu-on-body
          :label-id="badgesLabelId"
          :button-id="badgesButtonId"
          by="id"
        >
          <template #something-selected="{ value }">
            <template v-if="value.length === 1">
              {{ value[0].text }}
            </template>
            <template v-else>{{ value.length }} 个作用域已选择</template>
          </template>
          <template #option="{ item }">
            <div class="flex items-center w-full">
              <span class="text-xs text-foreground-2">{{ item.id }}</span>
            </div>
          </template>
        </FormSelectMulti>
        <FormTextInput
          v-model="redirectUrl"
          label="重定向 URL"
          help="认证后，用户将被重定向（一起携带访问令牌）到此 URL。"
          name="redirectUrl"
          color="foundation"
          show-label
          :rules="[isRequired, isUrl]"
          type="text"
        />
        <FormTextInput
          v-model="description"
          label="应用程序简介"
          color="foundation"
          help="应用程序简介"
          name="description"
          show-label
          show-optional
          type="text"
        />
      </div>
    </form>
  </LayoutDialog>
</template>

<script setup lang="ts">
import { useMutation } from '@vue/apollo-composable'
import type { AllScopes } from '@speckle/shared'
import { LayoutDialog, type LayoutDialogButton } from '@speckle/ui-components'
import type {
  ApplicationFormValues,
  ApplicationItem
} from '~~/lib/developer-settings/helpers/types'
import {
  createApplicationMutation,
  editApplicationMutation
} from '~~/lib/developer-settings/graphql/mutations'
import {
  isMultiItemSelected,
  isRequired,
  isUrl,
  fullyResetForm
} from '~~/lib/common/helpers/validation'
import { useForm } from 'vee-validate'
import {
  convertThrowIntoFetchResult,
  getCacheId,
  getFirstErrorMessage
} from '~~/lib/common/helpers/graphql'
import { useGlobalToast, ToastNotificationType } from '~~/lib/common/composables/toast'
import { useServerInfoScopes } from '~~/lib/common/composables/serverInfo'

const props = defineProps<{
  application?: ApplicationItem
}>()

const emit = defineEmits<{
  (e: 'application-created', applicationId: string): void
}>()

const isOpen = defineModel<boolean>('open', { required: true })

const { scopes: allScopes } = useServerInfoScopes()
const { mutate: createApplication } = useMutation(createApplicationMutation)
const { mutate: editApplication } = useMutation(editApplicationMutation)
const { triggerNotification } = useGlobalToast()
const { handleSubmit, resetForm } = useForm<ApplicationFormValues>()

const badgesLabelId = useId()
const badgesButtonId = useId()
const name = ref('')
const scopes = ref<typeof applicationScopes.value>([])
const redirectUrl = ref('')
const description = ref('')

const applicationScopes = computed(() => {
  return Object.values(allScopes.value).map((value) => ({
    id: value.name,
    text: value.name
  }))
})

const onSubmit = handleSubmit(async (applicationFormValues) => {
  const applicationId = props.application?.id

  if (props.application) {
    const usedScopeIds = applicationFormValues.scopes.map((t) => t.id)
    const result = await editApplication(
      {
        app: {
          id: props.application.id,
          name: name.value,
          scopes: applicationFormValues.scopes.map((t) => t.id),
          redirectUrl: redirectUrl.value,
          description: description.value
        }
      },
      {
        update: (cache, { data }) => {
          if (applicationId && data?.appUpdate) {
            cache.modify({
              id: getCacheId('ServerApp', applicationId),
              fields: {
                redirectUrl: () => applicationFormValues.redirectUrl,
                description: () => description.value || '',
                scopes: () =>
                  allScopes.value.filter((t) => usedScopeIds.includes(t.name)),
                name: () => name.value
              }
            })
          }
        }
      }
    ).catch(convertThrowIntoFetchResult)

    if (result?.data?.appUpdate) {
      isOpen.value = false
      resetFormFields()
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '应用程序已更新',
        description: '应用程序已成功更新'
      })
    } else {
      const errorMessage = getFirstErrorMessage(result?.errors)
      triggerNotification({
        type: ToastNotificationType.Danger,
        title: '更新应用程序失败',
        description: errorMessage
      })
    }
  } else {
    const result = await createApplication({
      app: {
        name: name.value,
        scopes: applicationFormValues.scopes.map((t) => t.id),
        redirectUrl: redirectUrl.value,
        description: description.value
      }
    }).catch(convertThrowIntoFetchResult)

    if (result?.data?.appCreate) {
      isOpen.value = false
      resetFormFields()
      emit('application-created', result.data.appCreate)
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '应用程序已创建',
        description: '应用程序已成功创建'
      })
    } else {
      const errorMessage = getFirstErrorMessage(result?.errors)
      triggerNotification({
        type: ToastNotificationType.Danger,
        title: '创建应用程序失败',
        description: errorMessage
      })
    }
  }
})

const dialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      isOpen.value = false
    }
  },
  {
    text: props.application ? '保存' : '创建',
    props: {},
    onClick: onSubmit
  }
])

const resetApplicationModel = () => {
  if (props.application) {
    name.value = props.application.name
    scopes.value = (props.application.scopes || []).map((scope) => ({
      id: scope.name as (typeof AllScopes)[number],
      text: scope.name as (typeof AllScopes)[number]
    }))
    redirectUrl.value = props.application.redirectUrl
    description.value = props.application.description || ''
  } else {
    resetFormFields()
  }
}

const resetFormFields = () => {
  name.value = ''
  scopes.value = []
  redirectUrl.value = ''
  description.value = ''
  fullyResetForm(resetForm)
}

watch(
  () => isOpen.value,
  (newVal) => {
    if (newVal) {
      resetApplicationModel()
    }
  }
)
</script>
