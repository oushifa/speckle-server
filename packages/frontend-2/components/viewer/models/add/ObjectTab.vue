<template>
  <div class="flex flex-col gap-y-4">
    <div class="text-foreground text-body-xs">
      从当前项目添加对象，通过其 ID 或 对象 URL。
    </div>
    <form class="flex flex-col gap-2" @submit="onSubmit">
      <FormTextInput
        name="objectIdsOrUrl"
        label="值"
        size="lg"
        full-width
        :custom-icon="LinkIcon"
        :rules="[isRequired, isValidValue]"
        help="逗号分隔的对象 ID/URL"
        color="foundation"
        auto-focus
      />
      <FormButton submit>添加</FormButton>
    </form>
  </div>
</template>
<script setup lang="ts">
import { useForm } from 'vee-validate'
import type { RuleExpression } from 'vee-validate'
import { LinkIcon } from '@heroicons/vue/20/solid'
import { isRequired } from '~~/lib/common/helpers/validation'
import { isObjectId } from '~~/lib/common/helpers/resources'
import { useInjectedViewerLoadedResources } from '~~/lib/viewer/composables/setup'
import { difference } from 'lodash-es'

const emit = defineEmits<{
  (e: 'chosen', val: { objectIds: string[] }): void
}>()

type FormPayload = { objectIdsOrUrl: string }
const urlRegexp = /\/models\/([a-zA-Z0-_9,@$]+)$/i

const { handleSubmit } = useForm<FormPayload>()
const { resourceItems } = useInjectedViewerLoadedResources()

const explodeValidatedObjectIds = (commaDelimitedIdList: string) => {
  const idParts = commaDelimitedIdList.split(',')
  const areIdsValid = !idParts.some((id) => !isObjectId(id))
  if (areIdsValid) return idParts
  return null
}

const extractObjectIds = (urlOrObjectIds: string) => {
  const [, idsString] = urlOrObjectIds.match(urlRegexp) || []
  if (idsString) {
    const listedIds = explodeValidatedObjectIds(idsString)
    if (listedIds?.length) return listedIds
  } else {
    const listedIds = explodeValidatedObjectIds(urlOrObjectIds)
    if (listedIds?.length) return listedIds
  }

  return null
}

const removeRedundantIds = (objectIds: string[]) => {
  const loadedObjectIds = resourceItems.value.map((i) => i.objectId)
  const newIds = difference(objectIds, loadedObjectIds)
  return newIds.length ? newIds : null
}

const isValidValue: RuleExpression<string> = (newVal) => {
  const ids = extractObjectIds(newVal)
  if (!ids) return '值必须是逗号分隔的对象 ID 或 对象查看器页面的 URL'

  const newIds = removeRedundantIds(ids)
  if (!newIds) return '所有指定的对象都已在查看器中加载'

  return true
}

const onSubmit = handleSubmit((payload) => {
  const { objectIdsOrUrl } = payload
  const ids = removeRedundantIds(extractObjectIds(objectIdsOrUrl) || [])
  if (!ids?.length) return
  emit('chosen', { objectIds: ids })
})
</script>
