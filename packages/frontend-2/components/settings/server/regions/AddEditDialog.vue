<template>
  <LayoutDialog
    v-model:open="open"
    max-width="sm"
    :buttons="dialogButtons"
    hide-closer
    prevent-close-on-click-outside
    :on-submit="onSubmit"
  >
    <template #header>创建新区域</template>
    <div class="flex flex-col gap-y-4 mb-2">
      <FormTextInput
        name="name"
        label="区域名称"
        placeholder="名称"
        color="foundation"
        :rules="[isRequired, isStringOfLength({ maxLength: 64 })]"
        auto-focus
        autocomplete="off"
        show-required
        show-label
        help="区域的可读名称。"
      />
      <FormTextArea
        name="description"
        label="区域描述"
        placeholder="描述"
        color="foundation"
        size="lg"
        show-label
        show-optional
        :rules="[isStringOfLength({ maxLength: 65536 })]"
      />
      <SettingsServerRegionsKeySelect
        show-label
        name="key"
        :items="availableRegionKeys"
        label="区域键"
        :rules="[isRequired]"
        show-required
        help="这些键来自服务器多区域配置文件。"
      />
    </div>
  </LayoutDialog>
</template>
<script lang="ts" setup>
import { isRequired, isStringOfLength } from '~~/lib/common/helpers/validation'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { graphql } from '~/lib/common/generated/gql'
import type { SettingsServerRegionsAddEditDialog_ServerRegionItemFragment } from '~/lib/common/generated/gql/graphql'
import { useForm } from 'vee-validate'
import {
  useCreateRegion,
  useUpdateRegion
} from '~/lib/multiregion/composables/management'
import { useMutationLoading } from '@vue/apollo-composable'

graphql(`
  fragment SettingsServerRegionsAddEditDialog_ServerRegionItem on ServerRegionItem {
    id
    name
    description
    key
  }
`)

type ServerRegionItem = SettingsServerRegionsAddEditDialog_ServerRegionItemFragment
type DialogModel = Omit<ServerRegionItem, 'id'>

defineProps<{
  availableRegionKeys: string[]
}>()

const open = defineModel<boolean>('open', { required: true })
const model = defineModel<DialogModel>()
const { handleSubmit, setValues } = useForm<DialogModel>()
const createRegion = useCreateRegion()
const updateRegion = useUpdateRegion()
const loading = useMutationLoading()

const dialogButtons = computed((): LayoutDialogButton[] => {
  return [
    {
      text: '取消',
      props: { color: 'outline' },
      onClick: () => (open.value = false)
    },
    {
      text: isEditMode.value ? '更新' : '创建',
      props: {
        submit: true,
        disabled: loading.value,
        loading: loading.value
      },
      onClick: noop
    }
  ]
})
const isEditMode = computed(() => !!model.value)

const onSubmit = handleSubmit(async (values) => {
  const action = isEditMode.value ? updateRegion : createRegion
  const res = await action({
    input: {
      key: values.key,
      name: values.name,
      description: values.description
    }
  })

  if (res?.id) {
    open.value = false
  }
})

watch(
  model,
  (newVal, oldVal) => {
    if (newVal && newVal !== oldVal) {
      setValues(newVal)
    } else if (!newVal && oldVal) {
      setValues({ name: '', description: '', key: '' })
    }
  },
  { immediate: true }
)
</script>
