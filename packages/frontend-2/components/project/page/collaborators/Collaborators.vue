<template>
  <div>
    <div v-if="project" class="pt-3">
      <div class="flex items-center">
        <h1 class="block text-heading-lg">协同管理</h1>
      </div>
      <div class="mt-6 flex flex-col gap-y-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-body-2xs text-foreground-2 font-medium">模型标签</p>
          <div class="flex items-center border border-outline-3 rounded-lg p-0.5">
            <FormButton
              hide-text
              color="subtle"
              size="sm"
              :icon-left="Squares2X2Icon"
              :class="
                viewMode === 'card'
                  ? '!text-primary-focus !dark:text-foreground-on-primary !bg-info-lighter'
                  : ''
              "
              @click="viewMode = 'card'"
            >
              卡片视图
            </FormButton>
            <FormButton
              hide-text
              color="subtle"
              size="sm"
              :icon-left="ListBulletIcon"
              :class="
                viewMode === 'list'
                  ? '!text-primary-focus !dark:text-foreground-on-primary !bg-info-lighter'
                  : ''
              "
              @click="viewMode = 'list'"
            >
              列表视图
            </FormButton>
          </div>
        </div>
        <template v-if="modelTagCards.length">
          <div
            v-if="viewMode === 'card'"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            <div
              v-for="modelTagCard in modelTagCards"
              :key="modelTagCard.id"
              class="group bg-foundation rounded-lg border border-outline-3 p-3 flex flex-col gap-y-2 transition-all hover:border-outline-5"
            >
              <div class="flex items-center justify-between gap-2">
                <CommonBadge
                  rounded
                  :color="modelTagCard.isResolved ? 'secondary' : 'primary'"
                >
                  {{ modelTagCard.isResolved ? '已解决' : '未解决' }}
                </CommonBadge>
                <span
                  v-tippy="modelTagCard.createdAt.full"
                  class="text-body-3xs text-foreground-3"
                >
                  {{ modelTagCard.createdAt.relative }}
                </span>
              </div>
              <div class="text-body-xs text-foreground line-clamp-2 font-medium">
                {{ modelTagCard.tagText }}
              </div>
              <div class="grid grid-cols-2 gap-2 text-body-2xs">
                <div class="text-foreground-2">创建人</div>
                <div class="text-foreground truncate text-right">
                  {{ modelTagCard.createdBy }}
                </div>
                <div class="text-foreground-2">模型名称</div>
                <div class="text-foreground truncate text-right">
                  {{ modelTagCard.modelName }}
                </div>
                <div class="text-foreground-2">回复数</div>
                <div class="text-foreground text-right">
                  {{ modelTagCard.replyCount }}
                </div>
              </div>
              <div class="flex items-center gap-1 pt-1">
                <FormButton
                  v-tippy="
                    isRepliesVisible(modelTagCard.id) ? '隐藏回复内容' : '查看回复内容'
                  "
                  hide-text
                  color="subtle"
                  size="sm"
                  :icon-left="MessageSquareText"
                  @click="toggleRepliesVisible(modelTagCard.id)"
                >
                  查看回复内容
                </FormButton>
                <FormButton
                  v-tippy="'在模型中查看'"
                  hide-text
                  color="subtle"
                  size="sm"
                  :icon-left="ExternalLink"
                  :to="modelTagCard.modelThreadRoute"
                >
                  在模型中查看
                </FormButton>
                <FormButton
                  v-tippy="modelTagCard.isResolved ? '重新打开' : '已解决'"
                  hide-text
                  color="subtle"
                  size="sm"
                  :icon-left="modelTagCard.isResolved ? RotateCcw : Check"
                  :disabled="isThreadArchiving(modelTagCard.threadId)"
                  @click="
                    toggleResolvedStatus(modelTagCard.threadId, modelTagCard.isResolved)
                  "
                >
                  {{ modelTagCard.isResolved ? '重新打开' : '已解决' }}
                </FormButton>
              </div>
              <div
                v-if="isRepliesVisible(modelTagCard.id)"
                class="mt-1 border border-outline-3 rounded-md bg-foundation-page p-2 space-y-1"
              >
                <div
                  v-for="reply in modelTagCard.replyPreview"
                  :key="reply.id"
                  class="text-body-2xs text-foreground-2"
                >
                  <span class="text-foreground font-medium">
                    {{ reply.authorName }}：
                  </span>
                  {{ reply.text }}
                </div>
                <div
                  v-if="!modelTagCard.replyPreview.length"
                  class="text-body-2xs text-foreground-2"
                >
                  暂无回复内容
                </div>
              </div>
            </div>
          </div>
          <div
            v-else
            class="bg-foundation border border-outline-3 rounded-lg divide-y divide-outline-3"
          >
            <div
              v-for="modelTagCard in modelTagCards"
              :key="modelTagCard.id"
              class="px-3 py-2 transition-colors hover:bg-highlight-1"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="text-body-xs text-foreground truncate font-medium">
                    {{ modelTagCard.tagText }}
                  </div>
                  <div class="text-body-2xs text-foreground-2 mt-1">
                    {{ modelTagCard.modelName }} · {{ modelTagCard.createdBy }} ·
                    <span v-tippy="modelTagCard.createdAt.full">
                      {{ modelTagCard.createdAt.relative }}
                    </span>
                    · {{ modelTagCard.replyCount }} 回复
                  </div>
                </div>
                <CommonBadge
                  rounded
                  :color="modelTagCard.isResolved ? 'secondary' : 'primary'"
                >
                  {{ modelTagCard.isResolved ? '已解决' : '未解决' }}
                </CommonBadge>
              </div>
              <div class="flex items-center gap-1 pt-2">
                <FormButton
                  v-tippy="
                    isRepliesVisible(modelTagCard.id) ? '隐藏回复内容' : '查看回复内容'
                  "
                  hide-text
                  color="subtle"
                  size="sm"
                  :icon-left="MessageSquareText"
                  @click="toggleRepliesVisible(modelTagCard.id)"
                >
                  查看回复内容
                </FormButton>
                <FormButton
                  v-tippy="'在模型中查看'"
                  hide-text
                  color="subtle"
                  size="sm"
                  :icon-left="ExternalLink"
                  @click="checkThread(modelTagCard.modelThreadRoute)"
                >
                  在模型中查看
                </FormButton>
                <FormButton
                  v-tippy="modelTagCard.isResolved ? '重新打开' : '已解决'"
                  hide-text
                  color="subtle"
                  size="sm"
                  :icon-left="modelTagCard.isResolved ? RotateCcw : Check"
                  :disabled="isThreadArchiving(modelTagCard.threadId)"
                  @click="
                    toggleResolvedStatus(modelTagCard.threadId, modelTagCard.isResolved)
                  "
                >
                  {{ modelTagCard.isResolved ? '重新打开' : '已解决' }}
                </FormButton>
              </div>
              <div
                v-if="isRepliesVisible(modelTagCard.id)"
                class="mt-2 border border-outline-3 rounded-md bg-foundation-page p-2 space-y-1"
              >
                <div
                  v-for="reply in modelTagCard.replyPreview"
                  :key="reply.id"
                  class="text-body-2xs text-foreground-2"
                >
                  <span class="text-foreground font-medium">
                    {{ reply.authorName }}：
                  </span>
                  {{ reply.text }}
                </div>
                <div
                  v-if="!modelTagCard.replyPreview.length"
                  class="text-body-2xs text-foreground-2"
                >
                  暂无回复内容
                </div>
              </div>
            </div>
          </div>
        </template>
        <div
          v-else
          class="bg-foundation py-2 px-3 border border-outline-3 rounded-lg text-body-2xs text-foreground-2"
        >
          暂无模型标签
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useQuery } from '@vue/apollo-composable'
import { latestModelsQuery } from '~~/lib/projects/graphql/queries'
import { viewerLoadedThreadsQuery } from '~~/lib/viewer/graphql/queries'
import { ListBulletIcon, Squares2X2Icon } from '@heroicons/vue/24/outline'
import { useArchiveComment } from '~~/lib/viewer/composables/commentManagement'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { Check, ExternalLink, MessageSquareText, RotateCcw } from 'lucide-vue-next'

const route = useRoute()
const projectId = computed(() => route.params.id as string)

const { result: modelsResult } = useQuery(latestModelsQuery, () => ({
  projectId: projectId.value
}))
const { result: threadsResult } = useQuery(viewerLoadedThreadsQuery, () => ({
  projectId: projectId.value,
  filter: {
    includeArchived: true
  },
  limit: 200,
  cursor: null
}))
const project = computed(
  () => modelsResult.value?.project || threadsResult.value?.project
)
const viewMode = ref<'card' | 'list'>('card')
const archiveComment = useArchiveComment()
const { triggerNotification } = useGlobalToast()
const repliesVisibleCardIds = ref<Set<string>>(new Set())
const threadResolvedOverrides = ref<Record<string, boolean>>({})
const archivingThreadIds = ref<Set<string>>(new Set())
const { formattedRelativeDate, formattedFullDate } = useDateFormatters()
const { router } = useSafeRouter()

const modelTagCards = computed(() => {
  const models = modelsResult.value?.project?.models?.items || []
  const threads = threadsResult.value?.project?.commentThreads?.items || []
  const modelNamesById = new Map(models.map((model) => [model.id, model.name]))
  const cards = [] as Array<{
    id: string
    threadId: string
    modelId: string
    tagText: string
    modelName: string
    createdBy: string
    createdAt: { full: string; relative: string }
    replyCount: number
    isResolved: boolean
    modelThreadRoute: string
    replyPreview: Array<{ id: string; authorName: string; text: string }>
  }>

  for (const thread of threads) {
    const tagText = thread.rawText?.trim()
    if (!tagText) continue
    const isResolved =
      threadResolvedOverrides.value[thread.id] !== undefined
        ? threadResolvedOverrides.value[thread.id]
        : !!thread.archived
    const replyPreview = (thread.replies?.items || [])
      .filter((reply) => !!reply.rawText?.trim())
      .slice()
      .reverse()
      .map((reply) => ({
        id: reply.id,
        authorName: reply.author?.name || '未知用户',
        text: reply.rawText?.trim() || ''
      }))

    const modelIds = new Set(
      (thread.viewerResources || [])
        .map((resource) => resource.modelId)
        .filter((modelId): modelId is string => !!modelId)
    )

    for (const modelId of modelIds) {
      cards.push({
        id: `${thread.id}-${modelId}`,
        threadId: thread.id,
        modelId,
        tagText,
        modelName: modelNamesById.get(modelId) || modelId,
        createdBy: thread.author?.name || '未知用户',
        createdAt: {
          full: formattedFullDate(thread.createdAt),
          relative: formattedRelativeDate(thread.createdAt, { capitalize: true })
        },
        replyCount: thread.replies?.totalCount || 0,
        isResolved,
        modelThreadRoute: `/projects/${projectId.value}/models/${modelId}#threadId=${thread.id}`,
        replyPreview
      })
    }
  }
  return cards
})

const isRepliesVisible = (cardId: string) => repliesVisibleCardIds.value.has(cardId)

const toggleRepliesVisible = (cardId: string) => {
  const next = new Set(repliesVisibleCardIds.value)
  if (next.has(cardId)) next.delete(cardId)
  else next.add(cardId)
  repliesVisibleCardIds.value = next
}

const isThreadArchiving = (threadId: string) => archivingThreadIds.value.has(threadId)

const toggleResolvedStatus = async (threadId: string, isResolved: boolean) => {
  if (isThreadArchiving(threadId)) return

  const nextArchived = !isResolved
  const nextArchiving = new Set(archivingThreadIds.value)
  nextArchiving.add(threadId)
  archivingThreadIds.value = nextArchiving

  const success = await archiveComment({
    commentId: threadId,
    projectId: projectId.value,
    archived: nextArchived
  })

  const updatedArchiving = new Set(archivingThreadIds.value)
  updatedArchiving.delete(threadId)
  archivingThreadIds.value = updatedArchiving

  if (!success) return

  threadResolvedOverrides.value = {
    ...threadResolvedOverrides.value,
    [threadId]: nextArchived
  }

  triggerNotification({
    title: `问题 ${nextArchived ? '已解决。' : '已重新打开。'}`,
    type: ToastNotificationType.Info
  })
}
const checkThread = (path: string) => {
  router.push({
    path
  })
}
</script>
