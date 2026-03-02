<template>
  <section>
    <div class="md:max-w-xl md:mx-auto pb-6 md:pb-0">
      <SettingsSectionHeader title="常规" text="管理您的服务器设置" />
      <div class="flex flex-col space-y-6">
        <SettingsSectionHeader title="服务器详情" subheading />
        <form class="flex flex-col gap-2" @submit="onSubmit">
          <div class="flex flex-col gap-4">
            <FormTextInput
              v-model="name"
              label="服务器公开名称"
              name="serverName"
              color="foundation"
              placeholder="服务器名称"
              show-label
              label-position="left"
              :rules="requiredRule"
              type="text"
            />
            <hr class="border-outline-3" />
            <FormTextArea
              v-model="description"
              color="foundation"
              label="描述"
              name="description"
              placeholder="描述"
              show-label
              label-position="left"
            />
            <hr class="border-outline-3" />
            <FormTextInput
              v-model="company"
              color="foundation"
              label="所有者"
              name="owner"
              placeholder="所有者"
              show-label
              label-position="left"
            />
            <hr class="border-outline-3" />
            <FormTextInput
              v-model="adminContact"
              color="foundation"
              label="管理员邮箱"
              name="adminEmail"
              placeholder="管理员邮箱"
              show-label
              type="email"
              label-position="left"
            />
            <hr class="border-outline-3" />
            <FormTextInput
              v-model="termsOfService"
              color="foundation"
              label="服务条款 URL"
              name="terms"
              show-label
              label-position="left"
            />
            <hr class="border-outline-3" />
            <FormCheckbox
              v-model="inviteOnly"
              label="仅邀请模式"
              description="只有拥有邀请的用户才能加入服务器"
              label-position="left"
              name="inviteOnly"
              show-label
            />
            <hr class="border-outline-3" />
            <FormCheckbox
              v-model="guestModeEnabled"
              label="访客模式"
              description="启用“访客”服务器角色，允许用户仅参与他们被邀请的项目"
              label-position="left"
              name="guestModeEnabled"
              show-label
            />
            <div class="mt-6">
              <FormButton color="primary" @click="onSubmit">保存更改</FormButton>
            </div>
          </div>
        </form>
      </div>
      <hr class="my-6 md:my-8 border-outline-2" />
      <SettingsServerGeneralVersion />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useQuery, useMutation } from '@vue/apollo-composable'
import { useForm } from 'vee-validate'
import { isRequired } from '~~/lib/common/helpers/validation'
import { useGlobalToast, ToastNotificationType } from '~~/lib/common/composables/toast'
import { FormTextInput, useFormCheckboxModel } from '@speckle/ui-components'
import { useLogger } from '~~/composables/logging'
import {
  ROOT_QUERY,
  convertThrowIntoFetchResult,
  modifyObjectFields
} from '~~/lib/common/helpers/graphql'
import { serverInfoQuery } from '~~/lib/server-management/graphql/queries'
import { serverInfoUpdateMutation } from '~~/lib/server-management/graphql/mutations'
import type {
  ServerInfoUpdateMutationVariables,
  Query
} from '~~/lib/common/generated/gql/graphql'

definePageMeta({
  layout: 'settings'
})

useHead({
  title: 'Settings | Server - General'
})

type FormValues = {
  name: string
  description: string
  company: string
  adminContact: string
  termsOfService: string
  inviteOnly: boolean
  guestModeEnabled: boolean
}

const logger = useLogger()
const { triggerNotification } = useGlobalToast()
const { handleSubmit } = useForm<FormValues>()
const { result } = useQuery(serverInfoQuery)
const { mutate: updateServerInfo } = useMutation(serverInfoUpdateMutation)

const name = ref('')
const description = ref('')
const company = ref('')
const adminContact = ref('')
const termsOfService = ref('')
const { model: inviteOnly, isChecked: isInviteOnlyChecked } = useFormCheckboxModel()
const { model: guestModeEnabled, isChecked: isGuestModeChecked } =
  useFormCheckboxModel()

const requiredRule = [isRequired]

const updateServerInfoAndCache = async (
  variables: ServerInfoUpdateMutationVariables
) => {
  try {
    const result = await updateServerInfo(variables, {
      update: (cache, result) => {
        if (result?.data?.serverInfoUpdate) {
          // Modify 'serverInfo' field of ROOT_QUERY
          modifyObjectFields<undefined, Query['serverInfo']>(
            cache,
            ROOT_QUERY,
            (_fieldName, _variables, value) => {
              const newData = variables.info
              return {
                ...value,
                ...newData,
                guestModeEnabled: newData.guestModeEnabled ?? value.guestModeEnabled
              }
            },
            { fieldNameWhitelist: ['serverInfo'] }
          )
        }
      }
    })
    return result
  } catch (error) {
    return convertThrowIntoFetchResult(error)
  }
}

const onSubmit = handleSubmit(async () => {
  const result = await updateServerInfoAndCache({
    info: {
      name: name.value,
      description: description.value,
      company: company.value,
      adminContact: adminContact.value,
      termsOfService: termsOfService.value,
      inviteOnly: isInviteOnlyChecked.value,
      guestModeEnabled: isGuestModeChecked.value
    }
  })

  if (result && result.data) {
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '保存成功',
      description: '您的服务器设置已保存。'
    })
  } else {
    logger.error(result && result.errors)
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '保存失败',
      description: '更新服务器信息失败'
    })
  }
})

onBeforeMount(() => {
  if (!result.value?.serverInfo) return

  name.value = result.value.serverInfo.name
  description.value = result.value.serverInfo.description || ''
  company.value = result.value.serverInfo.company || ''
  adminContact.value = result.value.serverInfo.adminContact || ''
  termsOfService.value = result.value.serverInfo.termsOfService || ''
  isInviteOnlyChecked.value = !!result.value.serverInfo.inviteOnly
  isGuestModeChecked.value = !!result.value.serverInfo.guestModeEnabled
})
</script>
