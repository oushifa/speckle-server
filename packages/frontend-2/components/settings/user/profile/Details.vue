<template>
  <div class="flex flex-col gap-y-4">
    <SettingsSectionHeader title="您的详细信息" subheading />
    <FormTextInput
      v-model="name"
      color="foundation"
      label="您的姓名"
      name="name"
      placeholder="John Doe"
      show-label
      label-position="left"
      :rules="[isRequired, isStringOfLength({ maxLength: 512 })]"
      @change="save()"
    />
    <FormTextInput
      v-model="company"
      color="foundation"
      label="您的公司"
      name="company"
      placeholder="Example Ltd."
      show-label
      label-position="left"
      :rules="[isStringOfLength({ maxLength: 512 })]"
      @change="save()"
    />
    <hr class="border-outline-2 my-3" />
    <div class="grid md:grid-cols-2">
      <div class="flex flex-col">
        <span class="text-body-xs font-medium text-foreground">您的头像</span>
        <span class="text-body-2xs text-foreground-2 max-w-[230px]">
          上传您的个人头像图片或使用您的姓名首字母。
        </span>
      </div>
      <div class="flex items-center justify-center">
        <SettingsUserProfileEditAvatar :user="user" size="xxl" />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useForm } from 'vee-validate'
import { debounce } from 'lodash-es'
import { graphql } from '~~/lib/common/generated/gql'
import type {
  SettingsUserProfileDetails_UserFragment,
  UserUpdateInput
} from '~~/lib/common/generated/gql/graphql'
import { isRequired, isStringOfLength } from '~~/lib/common/helpers/validation'
import { useUpdateUserProfile } from '~~/lib/user/composables/management'
import { TIME_MS } from '@speckle/shared'

graphql(`
  fragment SettingsUserProfileDetails_User on User {
    id
    name
    company
    ...UserProfileEditDialogAvatar_User
  }
`)

type FormValues = { name: string; company: string }

const props = defineProps<{
  user: SettingsUserProfileDetails_UserFragment
}>()

const { mutate } = useUpdateUserProfile()
const { handleSubmit } = useForm<FormValues>()

const name = ref('')
const company = ref('')

const save = handleSubmit(async () => {
  debouncedSave.cancel()
  const input: UserUpdateInput = {}
  if (name.value !== props.user.name) input.name = name.value
  if (company.value !== props.user.company) input.company = company.value
  if (!Object.values(input).length) return

  await mutate(input)
})
const debouncedSave = debounce(save, TIME_MS.second)

watch(
  () => props.user,
  (user) => {
    name.value = user.name
    company.value = user.company || ''
  },
  { deep: true, immediate: true }
)
</script>
