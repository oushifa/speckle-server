<template>
  <div class="flex flex-col h-full text-foreground gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-heading-lg mt-3">实际进度</h1>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <FormTextInput
          v-model="searchQuery"
          name="actual-progress-search"
          placeholder="搜索日期、构件编码、记录人"
          :custom-icon="Search"
          color="foundation"
          class="w-72"
        />
        <FormButton
          color="outline"
          :icon-left="Upload"
          :disabled="isLoadingRecords || isImportingExcel"
          @click="triggerImportExcel"
        >
          {{ isImportingExcel ? '导入中...' : '导入Excel' }}
        </FormButton>
        <FormButton
          color="outline"
          :icon-left="Download"
          :disabled="isLoadingRecords"
          @click="handleExportExcel"
        >
          导出Excel
        </FormButton>
        <FormButton
          color="primary"
          :icon-left="Plus"
          :disabled="isLoadingRecords"
          @click="openCreateDialog"
        >
          新增填报
        </FormButton>
        <input
          ref="importInputRef"
          type="file"
          class="hidden"
          aria-label="导入实际进度Excel文件"
          accept=".xlsx,.xls"
          @change="handleImportFileChange"
        />
      </div>
    </div>

    <div
      class="flex-1 overflow-hidden flex flex-col rounded-lg border border-outline-2 bg-foundation"
    >
      <LayoutTable :columns="columns" :items="paginatedItems" class="flex-1">
        <template #reportDate="{ item }">
          <div class="font-medium">{{ item.reportDate }}</div>
          <div class="text-body-xs text-foreground-2">{{ item.weekDay }}</div>
        </template>

        <template #startElementCodes="{ item }">
          <div
            class="cursor-pointer hover:text-primary hover:underline transition text-body-sm break-all pr-4"
            :class="{ 'text-foreground-2 font-light': formatElementCodes(item, 'start') === '未关联' }"
            @click="openDirectLinkDialog(item, 'start')"
          >
            {{ formatElementCodes(item, 'start') }}
          </div>
        </template>

        <template #finishElementCodes="{ item }">
          <div
            class="cursor-pointer hover:text-primary hover:underline transition text-body-sm break-all pr-4"
            :class="{ 'text-foreground-2 font-light': formatElementCodes(item, 'finish') === '未关联' }"
            @click="openDirectLinkDialog(item, 'finish')"
          >
            {{ formatElementCodes(item, 'finish') }}
          </div>
        </template>

        <template #remark="{ item }">
          <div class="text-body-sm truncate">{{ item.remark || '-' }}</div>
        </template>

        <template #constructionLog="{ item }">
          <div class="text-body-sm">
            {{ getConstructionLogPreview(item) }}
          </div>
        </template>

        <template #actions="{ item }">
          <div class="flex items-center justify-end gap-2">
            <FormButton
              size="sm"
              color="outline"
              hide-text
              :icon-left="Eye"
              @click="openViewDialog(item)"
            />
            <FormButton
              size="sm"
              color="outline"
              hide-text
              :icon-left="Pencil"
              @click="openEditDialog(item)"
            />
            <FormButton
              size="sm"
              color="outline"
              hide-text
              :icon-left="Trash2"
              :disabled="deletingRecordId === item.id"
              @click="handleDelete(item.id)"
            />
          </div>
        </template>
      </LayoutTable>
    </div>

    <div
      class="px-4 py-4 border border-outline-2 rounded-lg flex items-center justify-between bg-foundation"
    >
      <div class="flex items-center gap-4 text-sm text-foreground-2">
        <div v-if="isLoadingRecords">正在加载列表...</div>
        <div class="flex items-center gap-2">
          <span>每页显示</span>
          <select
            v-model="itemsPerPage"
            aria-label="每页显示条数"
            class="bg-foundation-2 border border-outline-3 rounded px-2 py-1 outline-none"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
          <span>条</span>
        </div>
        <div>共 {{ totalItems }} 条，第 {{ startItemIndex }}-{{ endItemIndex }} 条</div>
      </div>

      <div class="flex items-center gap-2">
        <button
          :disabled="currentPage === 1"
          class="p-1 rounded hover:bg-foundation-2 disabled:opacity-50 disabled:hover:bg-transparent"
          @click="currentPage > 1 && currentPage--"
        >
          <ChevronLeft class="h-5 w-5 text-foreground-2" />
        </button>

        <button
          v-for="page in totalPages"
          :key="page"
          class="px-3 py-1 rounded text-sm transition-colors"
          :class="
            currentPage === page
              ? 'bg-primary text-white'
              : 'hover:bg-foundation-2 text-foreground'
          "
          @click="currentPage = page"
        >
          {{ page }}
        </button>

        <button
          :disabled="currentPage === totalPages"
          class="p-1 rounded hover:bg-foundation-2 disabled:opacity-50 disabled:hover:bg-transparent"
          @click="currentPage < totalPages && currentPage++"
        >
          <ChevronRight class="h-5 w-5 text-foreground-2" />
        </button>
      </div>
    </div>

    <LayoutDialog
      v-model:open="viewDialogOpen"
      max-width="xl"
      :buttons="viewDialogButtons"
    >
      <template #header>{{ viewDialogTitle }}</template>
      <div class="max-h-[75vh] overflow-y-auto pr-2 space-y-5">
        <div class="text-body-sm text-foreground-2">查看进度情况详细信息</div>

        <section class="rounded-xl bg-foundation-page p-4 space-y-4">
          <div class="text-body-md font-medium">基本信息</div>
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div v-for="item in viewBasicInfoItems" :key="item.label" class="space-y-1">
              <div class="text-body-xs text-foreground-2">{{ item.label }}</div>
              <div class="text-body-md font-medium whitespace-pre-wrap break-words">
                {{ item.value }}
              </div>
            </div>
            <div class="space-y-1">
              <div class="text-body-xs text-foreground-2">关联状态</div>
              <div>
                <span
                  class="inline-flex items-center rounded-full px-3 py-1 text-body-xs font-medium"
                  :class="viewStatusBadgeClass"
                >
                  {{ viewStatusText }}
                </span>
              </div>
            </div>
            <div class="space-y-1">
              <div class="text-body-xs text-foreground-2">关联模型</div>
              <div class="text-body-md font-medium whitespace-pre-wrap break-words">
                {{ displayModelIds(viewLinkedModelIds) }}
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-xl bg-foundation-page p-4 space-y-4">
          <div class="text-body-md font-medium">进度情况</div>
          <div class="space-y-4">
            <div v-for="item in viewProgressItems" :key="item.label" class="space-y-2">
              <div class="text-body-sm font-medium text-foreground-2">
                {{ item.label }}
              </div>
              <div
                class="rounded-xl bg-foundation px-4 py-4 text-body-md whitespace-pre-wrap break-words"
              >
                {{ item.value }}
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-xl bg-foundation-page p-4 space-y-4">
          <div class="flex items-center gap-2">
            <FileText class="h-5 w-5 text-primary" />
            <div class="text-body-md font-medium">施工日志信息</div>
          </div>
          <div class="grid grid-cols-2 gap-5 md:grid-cols-4">
            <div
              v-for="item in viewJournalInfoItems"
              :key="item.label"
              class="space-y-1"
            >
              <div class="text-body-xs text-foreground-2">{{ item.label }}</div>
              <div class="text-body-md font-medium whitespace-pre-wrap break-words">
                {{ item.value }}
              </div>
            </div>
          </div>
        </section>

        <section class="space-y-4">
          <div
            v-for="section in viewDetailSections"
            :key="section.label"
            class="rounded-xl bg-foundation-page p-4 space-y-2"
          >
            <div class="text-body-md font-medium">{{ section.label }}</div>
            <div
              v-if="section.description"
              class="text-body-xs text-foreground-2 whitespace-pre-wrap break-words"
            >
              {{ section.description }}
            </div>
            <div
              class="rounded-xl bg-foundation px-4 py-4 text-body-md whitespace-pre-wrap break-words"
            >
              {{ section.value }}
            </div>
          </div>
        </section>

        <section class="rounded-xl bg-foundation-page p-4 space-y-4">
          <div class="text-body-md font-medium">人员信息</div>
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div v-for="item in viewPeopleItems" :key="item.label" class="space-y-1">
              <div class="text-body-xs text-foreground-2">{{ item.label }}</div>
              <div class="text-body-md font-medium whitespace-pre-wrap break-words">
                {{ item.value }}
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-xl bg-foundation-page p-4 space-y-4">
          <div class="text-body-md font-medium">记录信息</div>
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div v-for="item in viewMetaItems" :key="item.label" class="space-y-1">
              <div class="text-body-xs text-foreground-2">{{ item.label }}</div>
              <div class="text-body-md font-medium whitespace-pre-wrap break-words">
                {{ item.value }}
              </div>
            </div>
          </div>
        </section>
      </div>
    </LayoutDialog>

    <LayoutDialog v-model:open="dialogOpen" max-width="xl" :buttons="dialogButtons">
      <template #header>{{ dialogTitle }}</template>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormTextInput
            v-model="draftForm.taskName"
            name="actual-task-name"
            label="计划任务"
            show-label
          />
          <FormTextInput
            v-model="draftForm.reportTimestamp"
            name="actual-report-timestamp"
            label="年/月/日"
            type="datetime-local"
            show-label
          />
          <FormTextInput
            v-model="draftForm.weekDay"
            name="actual-week-day"
            label="星期"
            show-label
            :disabled="true"
          />
          <FormSelectUsers
            v-model="selectedReporterUser"
            :users="availableUsers"
            label="记录人"
            name="actual-reporter"
            search
            show-label
            selector-placeholder="请选择记录人"
            search-placeholder="搜索项目成员"
            :disabled="isLoadingProjectUsers"
            clearable
          />
          <FormSelectUsers
            v-model="selectedSiteLeaderUser"
            :users="availableUsers"
            label="现场负责人"
            name="actual-site-leader"
            search
            show-label
            selector-placeholder="请选择现场负责人"
            search-placeholder="搜索项目成员"
            :disabled="isLoadingProjectUsers"
            clearable
          />
          <FormTextInput
            v-model="draftForm.highTemperature"
            name="actual-high-temperature"
            label="最高气温"
            show-label
          />
          <FormTextInput
            v-model="draftForm.lowTemperature"
            name="actual-low-temperature"
            label="最低气温"
            show-label
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label class="text-body-sm text-foreground">
            <span class="block mb-2">上午气候</span>
            <select
              v-model="draftForm.morningWeather"
              aria-label="上午气候"
              class="w-full rounded border border-outline-3 bg-foundation px-3 py-2 outline-none"
            >
              <option
                v-for="option in weatherOptions"
                :key="`am-${option}`"
                :value="option"
              >
                {{ option }}
              </option>
            </select>
          </label>
          <label class="text-body-sm text-foreground">
            <span class="block mb-2">下午气候</span>
            <select
              v-model="draftForm.afternoonWeather"
              aria-label="下午气候"
              class="w-full rounded border border-outline-3 bg-foundation px-3 py-2 outline-none"
            >
              <option
                v-for="option in weatherOptions"
                :key="`pm-${option}`"
                :value="option"
              >
                {{ option }}
              </option>
            </select>
          </label>
          <FormTextInput
            v-model="draftForm.nightCondition"
            name="actual-night-condition"
            label="夜间情况"
            show-label
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            id="actual-progress-start-elements"
            class="rounded border border-dashed p-4 bg-foundation-page transition"
            :class="
              activeLinkTarget === 'start'
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'border-outline-3'
            "
          >
            <div class="text-body-sm font-medium">今日开始施工的构件</div>
            <div class="text-body-xs text-foreground-2 mt-1">
              选择今日开始施工的 BIM 构件，保存后自动生成构件编码摘要。
            </div>
            <div class="mt-3">
              <CommonModelObjectMultiModelSelectDrawer
                v-model:model_ids="draftForm.startModelIds"
                v-model:selections="draftForm.startSelections"
                :project-id="projectId"
                placeholder="选择今日开始施工构件"
              />
            </div>
            <div class="text-body-xs text-foreground-2 mt-2">
              已选择 {{ startSelectedObjectCount }} 个构件，涉及
              {{ startSelectedModelCount }} 个模型。
            </div>
          </div>

          <div
            id="actual-progress-finish-elements"
            class="rounded border border-dashed p-4 bg-foundation-page transition"
            :class="
              activeLinkTarget === 'finish'
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'border-outline-3'
            "
          >
            <div class="text-body-sm font-medium">今日完成的构件</div>
            <div class="text-body-xs text-foreground-2 mt-1">
              选择今日完成施工的 BIM 构件，保存后自动生成构件编码摘要。
            </div>
            <div class="mt-3">
              <CommonModelObjectMultiModelSelectDrawer
                v-model:model_ids="draftForm.finishModelIds"
                v-model:selections="draftForm.finishSelections"
                :project-id="projectId"
                placeholder="选择今日完成构件"
              />
            </div>
            <div class="text-body-xs text-foreground-2 mt-2">
              已选择 {{ finishSelectedObjectCount }} 个构件，涉及
              {{ finishSelectedModelCount }} 个模型。
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormTextArea
            v-model="draftForm.constructionRecord"
            name="actual-construction-record"
            label="施工情况记录"
            show-label
          />
          <FormTextArea
            v-model="draftForm.qualityRecord"
            name="actual-quality-record"
            label="质量情况"
            show-label
          />
          <FormTextArea
            v-model="draftForm.safetyRecord"
            name="actual-safety-record"
            label="安全情况"
            show-label
          />
          <FormTextArea
            v-model="draftForm.mortarConcreteSampleRecord"
            name="actual-mortar-record"
            label="砂浆、砼试块情况"
            show-label
          />
          <FormTextArea
            v-model="draftForm.materialEquipmentRecord"
            name="actual-material-equipment-record"
            label="设备、材料、构件、机具进场情况"
            show-label
          />
          <FormTextArea
            v-model="draftForm.siteAppearanceRecord"
            name="actual-site-appearance-record"
            label="场容场貌情况"
            show-label
          />
          <FormTextArea
            v-model="draftForm.overtimeRecord"
            name="actual-overtime-record"
            label="加班情况"
            show-label
          />
          <FormTextArea
            v-model="draftForm.otherRecord"
            name="actual-other-record"
            label="其他情况"
            show-label
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormTextArea
            v-model="draftForm.remark"
            name="actual-remark"
            label="备注"
            show-label
          />
          <FormTextArea
            v-model="draftForm.constructionLog"
            name="actual-construction-log"
            label="施工日志"
            show-label
            :disabled="true"
          />
        </div>
      </div>
    </LayoutDialog>

    <LayoutDialog
      v-model:open="directLinkDialogOpen"
      max-width="md"
      :buttons="directLinkDialogButtons"
    >
      <template #header>{{ directLinkDialogTitle }}</template>
      <div class="space-y-4 py-2">
        <div class="text-body-xs text-foreground-2">
          请选择要关联的模型，然后点击下方按钮在三维视图或构件树中选择构件。
        </div>
        <CommonModelObjectMultiModelSelectDrawer
          v-model:model_ids="directLinkModelIds"
          v-model:selections="directLinkSelections"
          :project-id="projectId"
          :placeholder="directLinkPlaceholder"
        />
      </div>
    </LayoutDialog>
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import type { LayoutDialogButton } from '@speckle/ui-components'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload
} from 'lucide-vue-next'
import { CommonModelObjectMultiModelSelectDrawer } from '#components'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import type { FormUsersSelectItemFragment } from '~/lib/common/generated/gql/graphql'
import {
  createActualProgressRecord,
  deleteActualProgressRecord,
  getActualProgressRecords,
  importActualProgressRecordsFromExcel,
  updateActualProgressRecord,
  type ActualProgressRecord,
  type ActualProgressRecordBimSelection,
  type ActualProgressRecordInput
} from '~/lib/projects/api/progress'

type DialogMode = 'create' | 'edit'

const actualProgressProjectUsersQuery = gql`
  query ActualProgressProjectUsers($projectId: String!) {
    project(id: $projectId) {
      id
      team {
        id
        user {
          id
          name
          avatar
        }
      }
    }
  }
`

type ActualProgressForm = {
  id: string
  taskName: string
  reportTimestamp: string
  weekDay: string
  reportDate: string
  startElementCodes: string
  finishElementCodes: string
  startModelIds: string[]
  startApplicationIds: string[]
  startSelections: ActualProgressRecordBimSelection[]
  finishModelIds: string[]
  finishApplicationIds: string[]
  finishSelections: ActualProgressRecordBimSelection[]
  startBIM: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }>
  finishBIM: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }>
  remark: string
  highTemperature: string
  lowTemperature: string
  morningWeather: string
  afternoonWeather: string
  nightCondition: string
  constructionRecord: string
  qualityRecord: string
  safetyRecord: string
  mortarConcreteSampleRecord: string
  materialEquipmentRecord: string
  siteAppearanceRecord: string
  overtimeRecord: string
  otherRecord: string
  siteLeader: string
  reporter: string
  constructionLog: string
}

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const uniqueStrings = (values: unknown[]) => {
  const seen = new Set<string>()
  return values.reduce<string[]>((acc, value) => {
    const normalized = normalizeString(value)
    if (!normalized || seen.has(normalized)) return acc
    seen.add(normalized)
    acc.push(normalized)
    return acc
  }, [])
}

const normalizeSelections = (
  selections: ActualProgressRecordBimSelection[] | null | undefined
): ActualProgressRecordBimSelection[] =>
  (Array.isArray(selections) ? selections : [])
    .map((group) => ({
      modelId: normalizeString(group?.modelId),
      applicationIds: uniqueStrings(group?.applicationIds || [])
    }))
    .filter((group) => group.modelId && group.applicationIds.length > 0)

const getActualRecordBimSummary = (params: {
  modelIds?: string[] | null
  applicationIds?: string[] | null
  selections?: ActualProgressRecordBimSelection[] | null
}) => {
  const normalizedSelections = normalizeSelections(params.selections)
  const modelIds = uniqueStrings([
    ...(params.modelIds || []),
    ...normalizedSelections.map((group) => group.modelId)
  ])
  const applicationIds = uniqueStrings(
    normalizedSelections.flatMap((group) => group.applicationIds)
  )

  return {
    modelIds,
    applicationIds,
    selections: normalizedSelections
  }
}

const columns = [
  { id: 'reportDate', header: '日期', classes: 'col-span-2' },
  { id: 'startElementCodes', header: '今日开始施工构件编码', classes: 'col-span-2' },
  { id: 'finishElementCodes', header: '今日完成构件编码', classes: 'col-span-2' },
  { id: 'remark', header: '备注', classes: 'col-span-2' },
  { id: 'constructionLog', header: '施工日志', classes: 'col-span-2' },
  { id: 'actions', header: '操作', classes: 'col-span-2 text-right' }
]

const weatherOptions = ['晴', '阴', '多云', '小雨', '大雨', '雪']

const createDefaultForm = (): ActualProgressForm => ({
  id: '',
  taskName: '路基工程',
  reportTimestamp: '2026-05-13T00:00',
  weekDay: '星期三',
  reportDate: '2026-05-13',
  startElementCodes: '',
  finishElementCodes: '',
  startModelIds: [],
  startApplicationIds: [],
  startSelections: [],
  finishModelIds: [],
  finishApplicationIds: [],
  finishSelections: [],
  startBIM: [],
  finishBIM: [],
  remark: '',
  highTemperature: '28',
  lowTemperature: '18',
  morningWeather: '晴',
  afternoonWeather: '多云',
  nightCondition: '正常施工',
  constructionRecord: '',
  qualityRecord: '',
  safetyRecord: '',
  mortarConcreteSampleRecord: '',
  materialEquipmentRecord: '',
  siteAppearanceRecord: '',
  overtimeRecord: '',
  otherRecord: '',
  siteLeader: '',
  reporter: '',
  constructionLog: ''
})

const route = useRoute()
const { triggerNotification } = useGlobalToast()
const apiOrigin = useApiOrigin()

const actualItems = ref<ActualProgressRecord[]>([])
const searchQuery = ref('')
const itemsPerPage = ref(20)
const currentPage = ref(1)
const importInputRef = ref<HTMLInputElement | null>(null)
const dialogOpen = ref(false)
const viewDialogOpen = ref(false)
const dialogMode = ref<DialogMode>('create')
const editingId = ref<string | null>(null)
const activeLinkTarget = ref<'start' | 'finish' | null>(null)
const draftForm = ref<ActualProgressForm>(createDefaultForm())
const lastOperation = ref('尚未执行导入导出操作')
const isLoadingRecords = ref(false)
const isImportingExcel = ref(false)
const isSavingRecord = ref(false)
const deletingRecordId = ref<string | null>(null)

const directLinkDialogOpen = ref(false)
const isSavingDirectLink = ref(false)
const directLinkModelIds = ref<string[]>([])
const directLinkSelections = ref<ActualProgressRecordBimSelection[]>([])

const directLinkDialogTitle = computed(() => {
  return activeLinkTarget.value === 'start' ? '选取开始施工构件' : '选取完成构件'
})

const directLinkPlaceholder = computed(() => {
  return activeLinkTarget.value === 'start' ? '选择今日开始施工构件' : '选择今日完成构件'
})

const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const { result: projectUsersResult, loading: isLoadingProjectUsers } = useQuery<
  {
    project?: {
      id: string
      team?: Array<{ id: string; user?: FormUsersSelectItemFragment | null }> | null
    } | null
  },
  { projectId: string }
>(
  actualProgressProjectUsersQuery,
  () => ({
    projectId: projectId.value
  }),
  () => ({
    enabled: !!projectId.value,
    fetchPolicy: 'cache-and-network'
  })
)

const hasLinkedElements = (item: {
  startApplicationIds: string[]
  finishApplicationIds: string[]
}) => item.startApplicationIds.length > 0 || item.finishApplicationIds.length > 0

const getElementStatusText = (applicationIds: string[]) =>
  applicationIds.length ? `已关联 ${applicationIds.length} 个` : '未关联'

const getElementStatusBadgeClass = (applicationIds: string[]) =>
  applicationIds.length
    ? 'bg-success-lighter text-success-darker'
    : 'bg-foundation-2 text-foreground-2'

const startSelectedObjectCount = computed(() =>
  draftForm.value.startSelections.reduce(
    (count, group) => count + group.applicationIds.length,
    0
  )
)

const startSelectedModelCount = computed(() => draftForm.value.startModelIds.length)

const finishSelectedObjectCount = computed(() =>
  draftForm.value.finishSelections.reduce(
    (count, group) => count + group.applicationIds.length,
    0
  )
)

const finishSelectedModelCount = computed(() => draftForm.value.finishModelIds.length)

const availableUsers = computed<FormUsersSelectItemFragment[]>(() =>
  (projectUsersResult.value?.project?.team || [])
    .map((member: { user?: FormUsersSelectItemFragment | null }) => member.user)
    .filter(
      (
        user: FormUsersSelectItemFragment | null | undefined
      ): user is FormUsersSelectItemFragment => !!user
    )
)

const filteredItems = computed(() => {
  const query = searchQuery.value.trim()
  if (!query) return actualItems.value

  return actualItems.value.filter((item) =>
    [
      item.reportDate,
      item.startElementCodes,
      item.finishElementCodes,
      item.reporter,
      item.siteLeader,
      item.remark,
      item.taskName
    ]
      .join(' ')
      .includes(query)
  )
})

const totalItems = computed(() => filteredItems.value.length)
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalItems.value / itemsPerPage.value))
)
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredItems.value.slice(start, start + itemsPerPage.value)
})
const startItemIndex = computed(() =>
  totalItems.value === 0 ? 0 : (currentPage.value - 1) * itemsPerPage.value + 1
)
const endItemIndex = computed(() =>
  Math.min(currentPage.value * itemsPerPage.value, totalItems.value)
)
const dialogTitle = computed(() => {
  if (dialogMode.value === 'create') return '新增实际进度'
  return '编辑实际进度'
})

const dialogButtons = computed<LayoutDialogButton[]>(() => {
  return [
    {
      text: '取消',
      props: { color: 'outline', disabled: isSavingRecord.value },
      onClick: () => {
        dialogOpen.value = false
      }
    },
    {
      text: dialogMode.value === 'create' ? '保存新增' : '保存修改',
      props: { color: 'primary', disabled: isSavingRecord.value },
      onClick: () => {
        saveDraft()
      }
    }
  ]
})

const viewDialogTitle = computed(() => '实际进度详情')

const viewDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '关闭',
    props: { color: 'outline' },
    onClick: () => {
      viewDialogOpen.value = false
    }
  }
])

const directLinkDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: { color: 'outline', disabled: isSavingDirectLink.value },
    onClick: () => {
      directLinkDialogOpen.value = false
    }
  },
  {
    text: '确定',
    props: { color: 'primary', disabled: isSavingDirectLink.value },
    onClick: () => {
      void saveDirectLink()
    }
  }
])

const showSuccess = (title: string, description: string) => {
  triggerNotification({
    type: ToastNotificationType.Success,
    title,
    description
  })
}

const showMessage = (
  title: string,
  description: string,
  type: ToastNotificationType = ToastNotificationType.Danger
) => {
  triggerNotification({
    type,
    title,
    description
  })
}

const formatDateTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('zh-CN', { hour12: false })
}

const normalizeReportTimestamp = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T00:00`
  return trimmed
}

const buildWeekDay = (reportDate: string) => {
  const date = new Date(reportDate)
  const dayMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return Number.isNaN(date.getTime()) ? '' : dayMap[date.getDay()]
}

const buildReportDate = (reportTimestamp: string) => {
  const normalized = normalizeReportTimestamp(reportTimestamp)
  if (!normalized) return ''

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return ''

  return normalized.slice(0, 10)
}

const syncConstructionLog = () => {
  draftForm.value.reportTimestamp = normalizeReportTimestamp(
    draftForm.value.reportTimestamp
  )
  draftForm.value.reportDate = buildReportDate(draftForm.value.reportTimestamp)
  draftForm.value.weekDay = buildWeekDay(draftForm.value.reportDate)
  draftForm.value.constructionLog = [
    draftForm.value.constructionRecord,
    draftForm.value.qualityRecord,
    draftForm.value.safetyRecord
  ]
    .filter(Boolean)
    .join(' ')
}

const buildElementCodes = (applicationIds: string[]) => applicationIds.join('、')

const formatBimCodesOrApplicationIds = (
  bimList: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null | undefined
) => {
  if (!bimList || bimList.length === 0) {
    return '未关联'
  }
  
  const codes: string[] = []
  for (const group of bimList) {
    const appIds = group.applicationIds || []
    const bimIds = group.bimIds || []
    for (let i = 0; i < appIds.length; i++) {
      const bimCode = bimIds[i]
      const appId = appIds[i]
      if (bimCode) {
        codes.push(bimCode)
      } else if (appId) {
        codes.push(appId)
      }
    }
  }

  return codes.length > 0 ? codes.join('、') : '未关联'
}

const formatElementCodes = (item: ActualProgressRecord, type: 'start' | 'finish') => {
  const bimList = type === 'start' ? (item.startBIM || item.BIM) : item.finishBIM
  return formatBimCodesOrApplicationIds(bimList)
}

const syncElementSelections = () => {
  const startSummary = getActualRecordBimSummary({
    modelIds: draftForm.value.startModelIds,
    applicationIds: draftForm.value.startApplicationIds,
    selections: draftForm.value.startSelections
  })
  draftForm.value.startModelIds = startSummary.modelIds
  draftForm.value.startApplicationIds = startSummary.applicationIds
  draftForm.value.startSelections = startSummary.selections
  draftForm.value.startElementCodes = buildElementCodes(startSummary.applicationIds)

  const finishSummary = getActualRecordBimSummary({
    modelIds: draftForm.value.finishModelIds,
    applicationIds: draftForm.value.finishApplicationIds,
    selections: draftForm.value.finishSelections
  })
  draftForm.value.finishModelIds = finishSummary.modelIds
  draftForm.value.finishApplicationIds = finishSummary.applicationIds
  draftForm.value.finishSelections = finishSummary.selections
  draftForm.value.finishElementCodes = buildElementCodes(finishSummary.applicationIds)
}

const getConstructionLogPreview = (
  item: Pick<ActualProgressRecord, 'constructionLog' | 'constructionRecord'>
) => {
  const value = item.constructionLog || item.constructionRecord || '-'
  return value.length > 26 ? `${value.slice(0, 26)}...` : value
}

const displayDetailValue = (value: string | null | undefined) => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || '-'
}

const displayModelIds = (modelIds: string[]) => {
  if (!modelIds.length) return '-'
  return modelIds.join('、')
}

const activeRecord = computed(
  () => actualItems.value.find((item) => item.id === editingId.value) || null
)

const viewLinkedModelIds = computed(() =>
  uniqueStrings([...draftForm.value.startModelIds, ...draftForm.value.finishModelIds])
)

const viewBasicInfoItems = computed(() => [
  { label: '日期', value: displayDetailValue(draftForm.value.reportDate) },
  { label: '填报人', value: displayDetailValue(draftForm.value.reporter) },
  { label: '计划任务', value: displayDetailValue(draftForm.value.taskName) },
  {
    label: '填报时间',
    value: displayDetailValue(
      draftForm.value.reportTimestamp
        ? formatDateTime(draftForm.value.reportTimestamp)
        : draftForm.value.reportDate
    )
  }
])

const viewStatusText = computed(() =>
  hasLinkedElements(draftForm.value) ? '已关联' : '未关联'
)

const viewStatusBadgeClass = computed(() =>
  hasLinkedElements(draftForm.value)
    ? 'bg-success-lighter text-success-darker'
    : 'bg-foundation-2 text-foreground-2'
)

const viewProgressItems = computed(() => [
  {
    label: '今日开始施工构件编码',
    value: formatBimCodesOrApplicationIds(draftForm.value.startBIM)
  },
  {
    label: '今日完成构件编码',
    value: formatBimCodesOrApplicationIds(draftForm.value.finishBIM)
  },
  {
    label: '备注',
    value: displayDetailValue(draftForm.value.remark)
  }
])

const viewJournalInfoItems = computed(() => [
  { label: '星期', value: displayDetailValue(draftForm.value.weekDay) },
  { label: '最高气温', value: displayDetailValue(draftForm.value.highTemperature) },
  { label: '最低气温', value: displayDetailValue(draftForm.value.lowTemperature) },
  { label: '夜间', value: displayDetailValue(draftForm.value.nightCondition) }
])

const viewDetailSections = computed(() => [
  {
    label: '施工情况记录',
    description: '（人员组织、主要机械动态、施工部位及内容、完成程序及验收情况）',
    value: displayDetailValue(draftForm.value.constructionRecord)
  },
  {
    label: '质量情况',
    description: '',
    value: displayDetailValue(draftForm.value.qualityRecord)
  },
  {
    label: '安全情况',
    description: '',
    value: displayDetailValue(draftForm.value.safetyRecord)
  },
  {
    label: '砂浆、砼试块',
    description: '',
    value: displayDetailValue(draftForm.value.mortarConcreteSampleRecord)
  },
  {
    label: '设备、材料、构件、机具等进场',
    description: '',
    value: displayDetailValue(draftForm.value.materialEquipmentRecord)
  },
  {
    label: '场容场貌',
    description: '',
    value: displayDetailValue(draftForm.value.siteAppearanceRecord)
  },
  {
    label: '加班情况',
    description: '',
    value: displayDetailValue(draftForm.value.overtimeRecord)
  },
  {
    label: '其他',
    description: '',
    value: displayDetailValue(draftForm.value.otherRecord)
  },
  {
    label: '施工日志',
    description: '',
    value: displayDetailValue(draftForm.value.constructionLog)
  }
])

const viewPeopleItems = computed(() => [
  { label: '现场负责人', value: displayDetailValue(draftForm.value.siteLeader) },
  { label: '记录人', value: displayDetailValue(draftForm.value.reporter) }
])

const viewMetaItems = computed(() => [
  {
    label: '创建时间',
    value: activeRecord.value?.createdAt
      ? formatDateTime(activeRecord.value.createdAt)
      : '-'
  },
  {
    label: '更新时间',
    value: activeRecord.value?.updatedAt
      ? formatDateTime(activeRecord.value.updatedAt)
      : '-'
  }
])

const resolveStoredUser = (storedValue: string) => {
  const normalized = storedValue.trim()
  if (!normalized) return undefined

  return availableUsers.value.find(
    (user) => user.id === normalized || user.name === normalized
  )
}

const selectedReporterUser = computed<FormUsersSelectItemFragment | undefined>({
  get: () => resolveStoredUser(draftForm.value.reporter),
  set: (user) => {
    draftForm.value.reporter = user?.name || ''
  }
})

const selectedSiteLeaderUser = computed<FormUsersSelectItemFragment | undefined>({
  get: () => resolveStoredUser(draftForm.value.siteLeader),
  set: (user) => {
    draftForm.value.siteLeader = user?.name || ''
  }
})

const cloneRecordToForm = (item: ActualProgressRecord): ActualProgressForm => ({
  id: item.id,
  taskName: item.taskName,
  reportTimestamp: `${item.reportDate}T00:00`,
  weekDay: item.weekDay,
  reportDate: item.reportDate,
  startElementCodes: item.startElementCodes,
  finishElementCodes: item.finishElementCodes,
  startModelIds: item.startModelIds,
  startApplicationIds: item.startApplicationIds,
  startSelections: normalizeSelections(item.startSelections),
  finishModelIds: item.finishModelIds,
  finishApplicationIds: item.finishApplicationIds,
  finishSelections: normalizeSelections(item.finishSelections),
  startBIM: item.startBIM || [],
  finishBIM: item.finishBIM || [],
  remark: item.remark,
  highTemperature: item.highTemperature,
  lowTemperature: item.lowTemperature,
  morningWeather: item.morningWeather,
  afternoonWeather: item.afternoonWeather,
  nightCondition: item.nightCondition,
  constructionRecord: item.constructionRecord,
  qualityRecord: item.qualityRecord,
  safetyRecord: item.safetyRecord,
  mortarConcreteSampleRecord: item.mortarConcreteSampleRecord,
  materialEquipmentRecord: item.materialEquipmentRecord,
  siteAppearanceRecord: item.siteAppearanceRecord,
  overtimeRecord: item.overtimeRecord,
  otherRecord: item.otherRecord,
  siteLeader: item.siteLeader,
  reporter: item.reporter,
  constructionLog: item.constructionLog
})

const buildBimWithInheritedIds = (
  selections: ActualProgressRecordBimSelection[],
  originalBIM: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null | undefined
) => {
  const bimIdMap = new Map<string, string | null>()
  if (originalBIM && Array.isArray(originalBIM)) {
    for (const group of originalBIM) {
      const modelId = group.modelId
      const appIds = group.applicationIds || []
      const bimIds = group.bimIds || []
      for (let i = 0; i < appIds.length; i++) {
        const appId = appIds[i]
        const bimId = bimIds[i]
        if (appId) {
          bimIdMap.set(`${modelId}::${appId}`, bimId)
        }
      }
    }
  }

  return selections.map((sel) => ({
    modelId: sel.modelId,
    applicationIds: sel.applicationIds,
    bimIds: sel.applicationIds.map((appId) => {
      const existingBimId = bimIdMap.get(`${sel.modelId}::${appId}`)
      return existingBimId !== undefined ? existingBimId : null
    })
  }))
}

const buildRecordInput = (form: ActualProgressForm): ActualProgressRecordInput => {
  syncConstructionLog()
  syncElementSelections()
  
  const startBIM = buildBimWithInheritedIds(form.startSelections, form.startBIM)
  const finishBIM = buildBimWithInheritedIds(form.finishSelections, form.finishBIM)

  return {
    taskName: form.taskName.trim(),
    reportDate: form.reportDate,
    startElementCodes: form.startElementCodes,
    finishElementCodes: form.finishElementCodes,
    startBIM,
    finishBIM,
    remark: form.remark,
    highTemperature: form.highTemperature,
    lowTemperature: form.lowTemperature,
    morningWeather: form.morningWeather,
    afternoonWeather: form.afternoonWeather,
    nightCondition: form.nightCondition,
    constructionRecord: form.constructionRecord,
    qualityRecord: form.qualityRecord,
    safetyRecord: form.safetyRecord,
    mortarConcreteSampleRecord: form.mortarConcreteSampleRecord,
    materialEquipmentRecord: form.materialEquipmentRecord,
    siteAppearanceRecord: form.siteAppearanceRecord,
    overtimeRecord: form.overtimeRecord,
    otherRecord: form.otherRecord,
    siteLeader: form.siteLeader,
    reporter: form.reporter,
    constructionLog: form.constructionLog
  }
}

const applyActualRecords = (records: ActualProgressRecord[]) => {
  actualItems.value = records

  if (!records.length) {
    lastOperation.value = '暂无实际进度填报记录'
    return
  }

  const [latestRecord] = [...records].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )
  if (latestRecord) {
    lastOperation.value = `最近更新于 ${formatDateTime(latestRecord.updatedAt)}`
  }
}

const fetchActualRecords = async () => {
  if (!projectId.value) {
    actualItems.value = []
    lastOperation.value = '未识别项目ID'
    return
  }

  isLoadingRecords.value = true
  try {
    const records = await getActualProgressRecords({
      projectId: projectId.value,
      apiOrigin
    })
    applyActualRecords(records)
  } catch (error) {
    actualItems.value = []
    showMessage(
      '加载实际进度失败',
      error instanceof Error ? error.message : '未能获取实际进度列表'
    )
  } finally {
    isLoadingRecords.value = false
  }
}

const openCreateDialog = () => {
  dialogMode.value = 'create'
  editingId.value = null
  activeLinkTarget.value = null
  draftForm.value = createDefaultForm()
  syncElementSelections()
  syncConstructionLog()
  dialogOpen.value = true
}

const openEditDialog = (item: ActualProgressRecord) => {
  dialogMode.value = 'edit'
  editingId.value = item.id
  activeLinkTarget.value = null
  draftForm.value = cloneRecordToForm(item)
  syncElementSelections()
  syncConstructionLog()
  dialogOpen.value = true
}

const openViewDialog = (item: ActualProgressRecord) => {
  editingId.value = item.id
  draftForm.value = cloneRecordToForm(item)
  syncElementSelections()
  syncConstructionLog()
  viewDialogOpen.value = true
}

const openElementLinkDialog = async (
  item: ActualProgressRecord,
  target: 'start' | 'finish'
) => {
  dialogMode.value = 'edit'
  editingId.value = item.id
  activeLinkTarget.value = target
  draftForm.value = cloneRecordToForm(item)
  syncElementSelections()
  syncConstructionLog()
  dialogOpen.value = true

  await nextTick()
  const sectionId =
    target === 'start'
      ? 'actual-progress-start-elements'
      : 'actual-progress-finish-elements'
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  })
}

const openDirectLinkDialog = (item: ActualProgressRecord, target: 'start' | 'finish') => {
  editingId.value = item.id
  activeLinkTarget.value = target
  draftForm.value = cloneRecordToForm(item)
  syncElementSelections()
  
  if (target === 'start') {
    directLinkModelIds.value = [...draftForm.value.startModelIds]
    directLinkSelections.value = normalizeSelections(draftForm.value.startSelections)
  } else {
    directLinkModelIds.value = [...draftForm.value.finishModelIds]
    directLinkSelections.value = normalizeSelections(draftForm.value.finishSelections)
  }
  
  directLinkDialogOpen.value = true
}

const saveDirectLink = async () => {
  if (!projectId.value || !editingId.value || !activeLinkTarget.value) return
  
  isSavingDirectLink.value = true
  try {
    if (activeLinkTarget.value === 'start') {
      draftForm.value.startModelIds = [...directLinkModelIds.value]
      draftForm.value.startSelections = normalizeSelections(directLinkSelections.value)
    } else {
      draftForm.value.finishModelIds = [...directLinkModelIds.value]
      draftForm.value.finishSelections = normalizeSelections(directLinkSelections.value)
    }
    
    // 更新 codes 字符串
    syncElementSelections()
    
    const input = buildRecordInput(draftForm.value)
    const updated = await updateActualProgressRecord({
      projectId: projectId.value,
      recordId: editingId.value,
      apiOrigin,
      input
    })
    
    await fetchActualRecords()
    lastOperation.value = `已更新 ${updated.reportDate} 的构件关联`
    showSuccess('关联已更新', '已成功保存最新的 BIM 构件关联。')
    directLinkDialogOpen.value = false
  } catch (error) {
    showMessage(
      '关联更新失败',
      error instanceof Error ? error.message : '未能保存构件关联'
    )
  } finally {
    isSavingDirectLink.value = false
  }
}

const saveDraft = async () => {
  syncConstructionLog()

  if (!projectId.value) {
    showMessage(
      '保存失败',
      '当前未识别项目ID，无法保存实际进度。',
      ToastNotificationType.Warning
    )
    return
  }

  if (!draftForm.value.taskName.trim()) {
    showMessage('保存失败', '请填写计划任务。', ToastNotificationType.Warning)
    return
  }

  if (!draftForm.value.weekDay) {
    showMessage('保存失败', '请填写有效的时间。', ToastNotificationType.Warning)
    return
  }

  isSavingRecord.value = true
  try {
    if (dialogMode.value === 'create') {
      const created = await createActualProgressRecord({
        projectId: projectId.value,
        apiOrigin,
        input: buildRecordInput(draftForm.value)
      })
      await fetchActualRecords()
      lastOperation.value = `已新增 ${created.reportDate} 的实际进度记录`
      showSuccess('实际进度已新增', '已生成新的施工日志填报记录。')
    } else if (editingId.value) {
      const updated = await updateActualProgressRecord({
        projectId: projectId.value,
        recordId: editingId.value,
        apiOrigin,
        input: buildRecordInput(draftForm.value)
      })
      await fetchActualRecords()
      lastOperation.value = `已更新 ${updated.reportDate} 的实际进度记录`
      showSuccess('实际进度已更新', '当前施工日志及 BIM 关联信息已保存。')
    }

    dialogOpen.value = false
  } catch (error) {
    showMessage(
      dialogMode.value === 'create' ? '新增失败' : '保存失败',
      error instanceof Error ? error.message : '保存实际进度失败'
    )
  } finally {
    isSavingRecord.value = false
  }
}

const handleDelete = async (id: string) => {
  if (!projectId.value) {
    showMessage(
      '删除失败',
      '当前未识别项目ID，无法删除记录。',
      ToastNotificationType.Warning
    )
    return
  }

  deletingRecordId.value = id
  try {
    await deleteActualProgressRecord({
      projectId: projectId.value,
      recordId: id,
      apiOrigin
    })
    await fetchActualRecords()
    lastOperation.value = '已删除一条实际进度记录'
    showSuccess('记录已删除', '该条实际进度记录已从列表移除。')
  } catch (error) {
    showMessage(
      '删除失败',
      error instanceof Error ? error.message : '删除实际进度记录失败'
    )
  } finally {
    deletingRecordId.value = null
  }
}

const triggerImportExcel = () => {
  importInputRef.value?.click()
}

const handleImportFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!projectId.value) {
    showMessage(
      '导入失败',
      '当前未识别项目ID，无法导入实际进度 Excel。',
      ToastNotificationType.Warning
    )
    input.value = ''
    return
  }

  isImportingExcel.value = true

  try {
    const result = await importActualProgressRecordsFromExcel({
      projectId: projectId.value,
      apiOrigin,
      file
    })
    await fetchActualRecords()
    lastOperation.value = `已导入 ${file.name}，新增 ${result.createdCount} 条实际进度记录`
    showSuccess(
      '导入成功',
      `已通过后端解析 Excel，并导入 ${result.createdCount} 条记录。`
    )
  } catch (error) {
    showMessage(
      '导入失败',
      error instanceof Error ? error.message : '实际进度 Excel 导入失败'
    )
  } finally {
    isImportingExcel.value = false
    input.value = ''
  }
}

const handleExportExcel = () => {
  lastOperation.value = '已点击 Excel 导出，导出接口待接入'
  showMessage(
    '导出能力待接入',
    '当前仅保留 Excel 导出入口，后续可继续补真实导出接口。',
    ToastNotificationType.Info
  )
}

watch(
  () => draftForm.value.reportTimestamp,
  () => {
    syncConstructionLog()
  }
)

watch(
  () => [
    draftForm.value.constructionRecord,
    draftForm.value.qualityRecord,
    draftForm.value.safetyRecord
  ],
  () => {
    syncConstructionLog()
  }
)

watch(itemsPerPage, () => {
  currentPage.value = 1
})

watch(totalPages, (pageCount) => {
  if (currentPage.value > pageCount) {
    currentPage.value = pageCount
  }
})

watch(
  projectId,
  () => {
    void fetchActualRecords()
  },
  { immediate: true }
)
</script>
