<template>
  <div class="flex flex-col gap-4 text-foreground">
    <!-- Header with Title and Tabs -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-2 pb-3"
    >
      <div class="flex items-center gap-6">
        <h1 class="text-heading-lg">进度计划</h1>
        <div class="flex items-center border-b border-outline-2">
          <button
            type="button"
            :class="[
              'px-4 py-2 text-body-sm font-medium transition-colors border-b-2',
              activeTab === 'total'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-foreground-2 hover:text-foreground'
            ]"
            @click="activeTab = 'total'"
          >
            总进度计划
          </button>
          <button
            type="button"
            :class="[
              'px-4 py-2 text-body-sm font-medium transition-colors border-b-2',
              activeTab === 'annual'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-foreground-2 hover:text-foreground'
            ]"
            @click="activeTab = 'annual'"
          >
            年度计划
          </button>
          <button
            type="button"
            :class="[
              'px-4 py-2 text-body-sm font-medium transition-colors border-b-2',
              activeTab === 'monthly'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-foreground-2 hover:text-foreground'
            ]"
            @click="activeTab = 'monthly'"
          >
            月度计划
          </button>
        </div>
      </div>

      <!-- Actions Header -->
      <div class="flex flex-wrap items-center gap-3">
        <template v-if="activeTab === 'total'">
          <FormButton
            size="sm"
            color="primary"
            :icon-left="Upload"
            :disabled="isImporting"
            @click="triggerPlanImport"
          >
            {{ isImporting ? '上传中...' : '导入 / 更新 计划' }}
          </FormButton>
          <FormButton
            size="sm"
            color="outline"
            :icon-left="Download"
            :disabled="!latestPlanFile"
            @click="handleDownloadPlanFile"
          >
            下载计划文件
          </FormButton>
          <input
            ref="planImportInputRef"
            type="file"
            class="hidden"
            accept=".mpp"
            aria-label="导入进度计划文件"
            @change="handlePlanImportChange"
          />
        </template>
        <template v-else-if="activeTab === 'annual'">
          <FormButton
            size="sm"
            color="primary"
            :icon-left="Plus"
            @click="openCreateAnnualDialog"
          >
            新增年度计划
          </FormButton>
        </template>
        <template v-else-if="activeTab === 'monthly'">
          <FormButton
            size="sm"
            color="primary"
            :icon-left="Plus"
            @click="openCreateMonthlyDialog"
          >
            新增月度计划
          </FormButton>
        </template>
      </div>
    </div>

    <!-- ── Tab 1: 总进度计划 ── -->
    <div
      v-if="activeTab === 'total'"
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden flex flex-col"
    >
      <div
        v-if="isLoadingTasks"
        class="px-4 py-10 text-center text-body-sm text-foreground-2 border-b border-outline-2"
      >
        正在加载总计划任务...
      </div>
      <div
        v-else-if="!treeTasks.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2 border-b border-outline-2"
      >
        {{
          latestPlanFile
            ? '当前已上传计划文件，未解析出任务项。'
            : '当前还没有总进度计划，请点击右上角导入 `.mpp` 文件。'
        }}
      </div>
      <LayoutTable
        v-else
        :columns="taskColumns"
        :items="treeTasks"
        class="w-full"
        expand-all-by-default
      >
        <template #taskName="{ item }">
          <span class="text-body-sm font-medium text-foreground">
            {{ item.taskName || item.name }}
          </span>
        </template>
        <template #duration="{ item }">
          <span class="text-body-sm text-center block">{{ item.duration || '-' }}</span>
        </template>
        <template #startDate="{ item }">
          <span class="text-body-sm text-center block">
            {{ item.startDate || '-' }}
          </span>
        </template>
        <template #endDate="{ item }">
          <span class="text-body-sm text-center block">{{ item.endDate || '-' }}</span>
        </template>
      </LayoutTable>

      <div
        v-if="latestPlanFile && !isLoadingTasks"
        class="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-outline-2 bg-foundation-page/60 px-4 py-2 text-body-xs text-foreground-2"
      >
        <span>当前总计划文件：{{ latestPlanFile.fileName }}</span>
        <span v-if="latestPlanFile.updatedAt">
          最后更新：{{
            new Date(latestPlanFile.updatedAt).toLocaleString('zh-CN', {
              hour12: false
            })
          }}
        </span>
      </div>
    </div>

    <!-- ── Tab 2: 年度计划 ── -->
    <div
      v-else-if="activeTab === 'annual'"
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden flex flex-col"
    >
      <div
        v-if="isLoadingAnnual"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        正在加载年度计划...
      </div>
      <div
        v-else-if="!annualPlans.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        暂无年度计划，请点击右上角新增。
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-body-sm border-collapse">
          <thead>
            <tr
              class="border-b border-outline-2 bg-foundation-page/50 text-foreground-2 font-medium"
            >
              <th class="py-3 px-4">年份</th>
              <th class="py-3 px-4">计划名称</th>
              <th class="py-3 px-4">起止日期</th>
              <th class="py-3 px-4">编制人</th>
              <th class="py-3 px-4">附件</th>
              <th class="py-3 px-4">更新时间</th>
              <th class="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="plan in annualPlans"
              :key="plan.id"
              class="border-b border-outline-2 hover:bg-primary-muted/20 transition-colors"
            >
              <td class="py-3 px-4 font-semibold text-primary">{{ plan.year }}年</td>
              <td class="py-3 px-4">
                <NuxtLink
                  :to="`/projects/${projectId}/progress-v2/annual/${plan.id}`"
                  class="font-medium text-primary hover:underline"
                >
                  {{ plan.name }}
                </NuxtLink>
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ plan.startDate ? plan.startDate.slice(0, 10) : '' }} ~
                {{ plan.endDate ? plan.endDate.slice(0, 10) : '' }}
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ plan.preparedBy || '-' }}
              </td>
              <td class="py-3 px-4">
                <div
                  v-if="getPlanAttachments(plan).length > 0"
                  class="flex items-center gap-1.5 flex-wrap"
                >
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-body-xs bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 rounded transition-colors"
                    :title="`查看 ${getPlanAttachments(plan).length} 个附件`"
                    @click="openViewAnnualDialog(plan)"
                  >
                    <Paperclip class="w-3 h-3" />
                    <span>{{ getPlanAttachments(plan).length }} 个附件</span>
                  </button>
                </div>
                <span v-else class="text-foreground-3 text-body-xs">-</span>
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs">
                {{
                  plan.updatedAt
                    ? new Date(plan.updatedAt).toLocaleString('zh-CN', {
                        hour12: false
                      })
                    : '-'
                }}
              </td>
              <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    class="p-1.5 rounded text-foreground-2 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="查看"
                    @click="openViewAnnualDialog(plan)"
                  >
                    <Eye class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    class="p-1.5 rounded text-foreground-2 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="编辑"
                    @click="openEditAnnualDialog(plan)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    class="p-1.5 rounded text-foreground-2 hover:text-danger hover:bg-danger/10 transition-colors"
                    title="删除"
                    @click="promptDeleteAnnual(plan)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Tab 3: 月度计划 ── -->
    <div
      v-else-if="activeTab === 'monthly'"
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden flex flex-col"
    >
      <div
        v-if="isLoadingMonthly"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        正在加载月度计划...
      </div>
      <div
        v-else-if="!monthlyPlans.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        暂无月度计划，请点击右上角新增。
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-body-sm border-collapse">
          <thead>
            <tr
              class="border-b border-outline-2 bg-foundation-page/50 text-foreground-2 font-medium"
            >
              <th class="py-3 px-4">计划月份</th>
              <th class="py-3 px-4">计划标题</th>
              <th class="py-3 px-4">任务数</th>
              <th class="py-3 px-4">附件</th>
              <th class="py-3 px-4">备注说明</th>
              <th class="py-3 px-4">更新时间</th>
              <th class="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="plan in monthlyPlans"
              :key="plan.id"
              class="border-b border-outline-2 hover:bg-primary-muted/20 transition-colors"
            >
              <td class="py-3 px-4 font-semibold text-primary">
                {{ plan.yearMonth }}
              </td>
              <td class="py-3 px-4 font-medium text-foreground">
                {{ plan.title || '-' }}
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ plan.tasks?.length || 0 }} 项施工任务
              </td>
              <td class="py-3 px-4">
                <div
                  v-if="getMonthlyAttachments(plan).length > 0"
                  class="flex items-center gap-1.5 flex-wrap"
                >
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-body-xs bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 rounded transition-colors"
                    :title="`查看 ${getMonthlyAttachments(plan).length} 个附件`"
                    @click="openViewMonthlyDialog(plan)"
                  >
                    <Paperclip class="w-3 h-3" />
                    <span>{{ getMonthlyAttachments(plan).length }} 个附件</span>
                  </button>
                </div>
                <span v-else class="text-foreground-3 text-body-xs">-</span>
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ plan.remark || '-' }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs">
                {{
                  plan.updatedAt
                    ? new Date(plan.updatedAt).toLocaleString('zh-CN', {
                        hour12: false
                      })
                    : '-'
                }}
              </td>
              <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    class="p-1.5 rounded text-foreground-2 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="查看"
                    @click="openViewMonthlyDialog(plan)"
                  >
                    <Eye class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    class="p-1.5 rounded text-foreground-2 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="编辑任务"
                    @click="openEditMonthlyDialog(plan)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    class="p-1.5 rounded text-foreground-2 hover:text-danger hover:bg-danger/10 transition-colors"
                    title="删除"
                    @click="promptDeleteMonthly(plan)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── 弹窗 1: 新增/编辑年度计划 ── -->
    <LayoutDialog
      v-model:open="annualDialogOpen"
      :title="editingAnnualPlan ? '编辑年度计划' : '新增年度计划'"
      max-width="md"
    >
      <form class="space-y-4" @submit.prevent="handleSaveAnnual">
        <div>
          <div class="block text-body-xs font-medium text-foreground-2 mb-1">
            年份
            <span class="text-danger">*</span>
          </div>
          <FormTextInput
            v-model="annualForm.year"
            name="annual-year"
            type="number"
            placeholder="例如 2026"
            color="foundation"
            required
          />
        </div>
        <div>
          <div class="block text-body-xs font-medium text-foreground-2 mb-1">
            计划名称
            <span class="text-danger">*</span>
          </div>
          <FormTextInput
            v-model="annualForm.name"
            name="annual-name"
            placeholder="例如 2026年度总体实施计划"
            color="foundation"
            required
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="block text-body-xs font-medium text-foreground-2 mb-1">
              开始日期
            </div>
            <FormTextInput
              v-model="annualForm.startDate"
              name="annual-start"
              type="date"
              color="foundation"
              required
            />
          </div>
          <div>
            <div class="block text-body-xs font-medium text-foreground-2 mb-1">
              结束日期
            </div>
            <FormTextInput
              v-model="annualForm.endDate"
              name="annual-end"
              type="date"
              color="foundation"
              required
            />
          </div>
        </div>
        <div>
          <div class="block text-body-xs font-medium text-foreground-2 mb-1">
            编制人
          </div>
          <FormTextInput
            v-model="annualForm.preparedBy"
            name="annual-prepared-by"
            placeholder="编制责任人"
            color="foundation"
          />
        </div>
        <div>
          <div class="block text-body-xs font-medium text-foreground-2 mb-1">
            附件（支持上传多个）
          </div>
          <label
            class="flex items-center gap-2 h-9 px-3 rounded-md border border-dashed border-outline-2 cursor-pointer transition-colors hover:bg-primary-muted/20 text-body-xs text-foreground-2"
          >
            <Paperclip class="w-4 h-4 shrink-0" />
            <span>点击添加附件（支持多选）</span>
            <input
              type="file"
              multiple
              class="sr-only"
              @change="onAnnualAttachmentChange"
            />
          </label>
          <div
            v-if="annualAttachments.length > 0"
            class="mt-2 space-y-1.5 max-h-36 overflow-y-auto"
          >
            <div
              v-for="(item, i) in annualAttachments"
              :key="item.id"
              class="flex items-center justify-between px-2.5 py-1.5 rounded bg-foundation-page text-body-xs border border-outline-2"
            >
              <div class="flex items-center gap-1.5 truncate flex-1 min-w-0 mr-2">
                <Paperclip class="w-3.5 h-3.5 shrink-0 text-foreground-2" />
                <span
                  class="truncate text-foreground font-medium"
                  :title="item.fileName"
                >
                  {{ item.fileName }}
                </span>
                <span
                  v-if="item.fileSize"
                  class="text-foreground-3 text-body-3xs shrink-0"
                >
                  ({{ prettyFileSize(item.fileSize) }})
                </span>
              </div>
              <button
                type="button"
                class="p-1 rounded hover:bg-danger/10 text-foreground-2 hover:text-danger transition-colors shrink-0"
                :title="`移除附件 ${item.fileName}`"
                @click="removeAnnualAttachment(i)"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div class="mt-1 text-body-3xs text-foreground-2">
            附件仅作为计划说明存档，导入任务请在年度计划详情页上传 .mpp 文件。
          </div>
        </div>
        <div>
          <div class="block text-body-xs font-medium text-foreground-2 mb-1">
            备注说明
          </div>
          <FormTextArea
            v-model="annualForm.remark"
            name="annual-remark"
            placeholder="计划补充说明..."
            color="foundation"
            rows="3"
          />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <FormButton color="outline" type="button" @click="annualDialogOpen = false">
            取消
          </FormButton>
          <FormButton color="primary" type="submit" :disabled="isSavingAnnual">
            {{ isSavingAnnual ? '保存中...' : '确定保存' }}
          </FormButton>
        </div>
      </form>
    </LayoutDialog>

    <!-- ── 弹窗: 查看年度计划详情 ── -->
    <LayoutDialog
      v-model:open="viewAnnualDialogOpen"
      :title="`${viewingAnnualPlan?.year || ''} 年度计划详情`"
      max-width="md"
    >
      <div v-if="viewingAnnualPlan" class="space-y-4 py-1 text-body-sm">
        <div class="space-y-2.5">
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">年份</span>
            <span class="col-span-2 font-medium text-foreground">
              {{ viewingAnnualPlan.year }} 年
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">计划名称</span>
            <span class="col-span-2 font-medium text-foreground">
              {{ viewingAnnualPlan.name }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">起止日期</span>
            <span class="col-span-2 font-medium text-foreground">
              {{
                viewingAnnualPlan.startDate
                  ? viewingAnnualPlan.startDate.slice(0, 10)
                  : '-'
              }}
              ~
              {{
                viewingAnnualPlan.endDate ? viewingAnnualPlan.endDate.slice(0, 10) : '-'
              }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">编制人</span>
            <span class="col-span-2 font-medium text-foreground">
              {{ viewingAnnualPlan.preparedBy || '-' }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2 items-start">
            <span class="text-foreground-2">
              附件 ({{ getPlanAttachments(viewingAnnualPlan).length }})
            </span>
            <div class="col-span-2">
              <div
                v-if="getPlanAttachments(viewingAnnualPlan).length > 0"
                class="space-y-1.5 max-h-48 overflow-y-auto pr-1"
              >
                <div
                  v-for="(att, idx) in getPlanAttachments(viewingAnnualPlan)"
                  :key="att.blobId || idx"
                  class="flex items-center justify-between px-2.5 py-1.5 rounded bg-foundation-page border border-outline-2 text-body-xs"
                >
                  <div class="flex items-center gap-1.5 truncate flex-1 min-w-0 mr-2">
                    <Paperclip class="w-3.5 h-3.5 shrink-0 text-foreground-2" />
                    <span
                      class="truncate text-foreground font-medium"
                      :title="att.fileName"
                    >
                      {{ att.fileName }}
                    </span>
                    <span
                      v-if="att.fileSize"
                      class="text-foreground-3 text-body-3xs shrink-0"
                    >
                      ({{ prettyFileSize(Number(att.fileSize)) }})
                    </span>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      class="px-2 py-0.5 rounded text-primary hover:bg-primary/10 transition-colors text-body-xs font-medium"
                      @click="openAttachmentPreview(att)"
                    >
                      预览
                    </button>
                    <button
                      type="button"
                      class="px-2 py-0.5 rounded text-foreground-2 hover:text-foreground hover:bg-primary-muted/20 transition-colors text-body-xs"
                      @click="downloadAttachment(att)"
                    >
                      下载
                    </button>
                  </div>
                </div>
              </div>
              <span v-else class="text-foreground-3">-</span>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">更新时间</span>
            <span class="col-span-2 font-medium text-foreground">
              {{
                viewingAnnualPlan.updatedAt
                  ? new Date(viewingAnnualPlan.updatedAt).toLocaleString('zh-CN', {
                      hour12: false
                    })
                  : '-'
              }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">备注</span>
            <span class="col-span-2 font-medium text-foreground whitespace-pre-wrap">
              {{ viewingAnnualPlan.remark || '-' }}
            </span>
          </div>
        </div>

        <div class="pt-3 border-t border-outline-2">
          <NuxtLink
            :to="`/projects/${projectId}/progress-v2/annual/${viewingAnnualPlan.id}`"
            class="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-md bg-primary text-primary-contrast hover:bg-primary-hover transition-colors text-body-sm font-medium"
            @click="viewAnnualDialogOpen = false"
          >
            <span>进入年度计划</span>
            <ChevronRight class="h-4 w-4" />
          </NuxtLink>
        </div>

        <div class="flex justify-end pt-1">
          <FormButton
            color="outline"
            type="button"
            @click="viewAnnualDialogOpen = false"
          >
            关闭
          </FormButton>
        </div>
      </div>
    </LayoutDialog>

    <!-- ── 弹窗: 查看月度计划详情 ── -->
    <LayoutDialog
      v-model:open="viewMonthlyDialogOpen"
      :title="`${viewingMonthlyPlan?.yearMonth || ''} 月度计划详情`"
      max-width="md"
    >
      <div v-if="viewingMonthlyPlan" class="space-y-4 text-body-sm">
        <div class="space-y-2 border-b border-outline-2 pb-3">
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">计划月份</span>
            <span class="col-span-2 font-semibold text-primary">
              {{ viewingMonthlyPlan.yearMonth }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">计划标题</span>
            <span class="col-span-2 font-medium text-foreground">
              {{ viewingMonthlyPlan.title || '-' }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">计划周期</span>
            <span class="col-span-2 text-foreground">
              {{
                viewingMonthlyPlan.startDate
                  ? viewingMonthlyPlan.startDate.slice(0, 10)
                  : ''
              }}
              ~
              {{
                viewingMonthlyPlan.endDate
                  ? viewingMonthlyPlan.endDate.slice(0, 10)
                  : ''
              }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">编制人</span>
            <span class="col-span-2 text-foreground">
              {{ viewingMonthlyPlan.preparedBy || '-' }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">施工任务</span>
            <span class="col-span-2 text-foreground">
              {{ viewingMonthlyPlan.tasks?.length || 0 }} 项施工任务
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">计划附件</span>
            <div class="col-span-2">
              <div
                v-if="getMonthlyAttachments(viewingMonthlyPlan).length > 0"
                class="space-y-1.5"
              >
                <div
                  v-for="(att, idx) in getMonthlyAttachments(viewingMonthlyPlan)"
                  :key="att.blobId || idx"
                  class="flex items-center justify-between px-2.5 py-1.5 rounded bg-foundation-page border border-outline-2 text-body-xs"
                >
                  <div class="flex items-center gap-1.5 truncate flex-1 min-w-0 mr-2">
                    <Paperclip class="w-3.5 h-3.5 shrink-0 text-foreground-2" />
                    <span
                      class="truncate text-foreground font-medium"
                      :title="att.fileName"
                    >
                      {{ att.fileName }}
                    </span>
                    <span
                      v-if="att.fileSize"
                      class="text-foreground-3 text-body-3xs shrink-0"
                    >
                      ({{ prettyFileSize(Number(att.fileSize)) }})
                    </span>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      class="px-2 py-0.5 rounded text-primary hover:bg-primary/10 transition-colors text-body-xs font-medium"
                      @click="openAttachmentPreview(att)"
                    >
                      预览
                    </button>
                    <button
                      type="button"
                      class="px-2 py-0.5 rounded text-foreground-2 hover:text-foreground hover:bg-primary-muted/20 transition-colors text-body-xs"
                      @click="downloadAttachment(att)"
                    >
                      下载
                    </button>
                  </div>
                </div>
              </div>
              <span v-else class="text-foreground-3">-</span>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">更新时间</span>
            <span class="col-span-2 font-medium text-foreground">
              {{
                viewingMonthlyPlan.updatedAt
                  ? new Date(viewingMonthlyPlan.updatedAt).toLocaleString('zh-CN', {
                      hour12: false
                    })
                  : '-'
              }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <span class="text-foreground-2">备注</span>
            <span class="col-span-2 font-medium text-foreground whitespace-pre-wrap">
              {{ viewingMonthlyPlan.remark || '-' }}
            </span>
          </div>
        </div>

        <div class="flex justify-end pt-1">
          <FormButton
            color="outline"
            type="button"
            @click="viewMonthlyDialogOpen = false"
          >
            关闭
          </FormButton>
        </div>
      </div>
    </LayoutDialog>

    <!-- ── 弹窗: 文件预览 ── -->
    <LayoutDialog v-model:open="previewDialogOpen" max-width="xl" fullscreen="all">
      <template #header>
        <div class="flex items-center gap-2 truncate">
          <Paperclip class="w-4 h-4 text-primary shrink-0" />
          <span class="truncate font-medium">
            {{ currentPreviewAttachment?.fileName || '附件预览' }}
          </span>
        </div>
      </template>
      <div
        v-if="currentPreviewAttachment && projectId"
        class="w-full h-[70dvh] flex flex-col justify-center text-foreground text-body-xs px-2 pb-2"
      >
        <CommonFilePreview
          :blob-id="currentPreviewAttachment.blobId"
          :project-id="projectId"
          :file-name="currentPreviewAttachment.fileName"
          :file-size="
            currentPreviewAttachment.fileSize
              ? Number(currentPreviewAttachment.fileSize)
              : null
          "
          class="w-full flex-1 h-full"
        />
      </div>
      <div class="flex justify-end pt-2 border-t border-outline-2 gap-2">
        <FormButton
          v-if="currentPreviewAttachment"
          color="outline"
          size="sm"
          type="button"
          @click="downloadAttachment(currentPreviewAttachment)"
        >
          下载原文件
        </FormButton>
        <FormButton
          color="outline"
          size="sm"
          type="button"
          @click="previewDialogOpen = false"
        >
          关闭
        </FormButton>
      </div>
    </LayoutDialog>

    <!-- ── 弹窗 2: 新增/编辑月度计划 ── -->
    <LayoutDialog
      v-model:open="monthlyDialogOpen"
      :title="editingMonthlyPlan ? '编辑月度计划' : '新增月度计划'"
      max-width="md"
    >
      <form class="space-y-4 py-1" @submit.prevent="handleSaveMonthly">
        <!-- 年月 -->
        <div class="space-y-1.5">
          <div class="block text-body-xs font-medium text-foreground-2">
            年月
            <span class="text-danger">*</span>
          </div>
          <FormTextInput
            v-model="monthlyForm.yearMonth"
            name="monthly-yearMonth"
            type="month"
            :disabled="!!editingMonthlyPlan"
            color="foundation"
            required
            @update:model-value="onYearMonthChange"
          />
        </div>

        <!-- 计划名称 -->
        <div class="space-y-1.5">
          <div class="block text-body-xs font-medium text-foreground-2">
            计划名称
            <span class="text-danger">*</span>
          </div>
          <FormTextInput
            v-model="monthlyForm.title"
            name="monthly-title"
            :placeholder="
              monthlyForm.yearMonth
                ? `${monthlyForm.yearMonth.replace('-', '年')}月月度施工进度计划`
                : '请输入计划名称'
            "
            color="foundation"
            required
          />
        </div>

        <!-- 开始日期 + 结束日期 -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <div class="block text-body-xs font-medium text-foreground-2">
              开始日期
              <span class="text-danger">*</span>
            </div>
            <FormTextInput
              v-model="monthlyForm.startDate"
              name="monthly-start"
              type="date"
              color="foundation"
              required
            />
          </div>
          <div class="space-y-1.5">
            <div class="block text-body-xs font-medium text-foreground-2">
              结束日期
              <span class="text-danger">*</span>
            </div>
            <FormTextInput
              v-model="monthlyForm.endDate"
              name="monthly-end"
              type="date"
              color="foundation"
              required
            />
          </div>
        </div>

        <!-- 编制人 -->
        <div class="space-y-1.5">
          <div class="block text-body-xs font-medium text-foreground-2">编制人</div>
          <FormTextInput
            v-model="monthlyForm.preparedBy"
            name="monthly-preparedBy"
            placeholder="请输入编制人"
            color="foundation"
          />
        </div>

        <!-- 附件上传 -->
        <div class="space-y-1.5">
          <div class="block text-body-xs font-medium text-foreground-2">
            附件（支持上传多个）
          </div>
          <label
            class="flex items-center gap-2 h-9 px-3 rounded-md border border-dashed border-outline-2 cursor-pointer transition-colors hover:bg-primary-muted/20 text-body-xs text-foreground-2"
          >
            <Paperclip class="w-4 h-4 shrink-0" />
            <span>点击添加附件（支持多选）</span>
            <input
              type="file"
              multiple
              class="sr-only"
              @change="onMonthlyAttachmentChange"
            />
          </label>
          <div
            v-if="monthlyAttachments.length > 0"
            class="mt-2 space-y-1.5 max-h-36 overflow-y-auto"
          >
            <div
              v-for="(item, i) in monthlyAttachments"
              :key="item.id"
              class="flex items-center justify-between px-2.5 py-1.5 rounded bg-foundation-page text-body-xs border border-outline-2"
            >
              <div class="flex items-center gap-1.5 truncate flex-1 min-w-0 mr-2">
                <Paperclip class="w-3.5 h-3.5 shrink-0 text-foreground-2" />
                <span
                  class="truncate text-foreground font-medium"
                  :title="item.fileName"
                >
                  {{ item.fileName }}
                </span>
                <span
                  v-if="item.fileSize"
                  class="text-foreground-3 text-body-3xs shrink-0"
                >
                  ({{ prettyFileSize(item.fileSize) }})
                </span>
              </div>
              <button
                type="button"
                class="p-0.5 rounded text-foreground-2 hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                title="移除"
                @click="removeMonthlyAttachment(i)"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- 备注 -->
        <div class="space-y-1.5">
          <div class="block text-body-xs font-medium text-foreground-2">备注</div>
          <FormTextInput
            v-model="monthlyForm.remark"
            name="monthly-remark"
            placeholder="可选"
            color="foundation"
          />
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-outline-2">
          <FormButton color="outline" type="button" @click="monthlyDialogOpen = false">
            取消
          </FormButton>
          <FormButton
            color="primary"
            type="submit"
            :disabled="
              isSavingMonthly ||
              !monthlyForm.yearMonth ||
              !monthlyForm.title ||
              !monthlyForm.startDate ||
              !monthlyForm.endDate
            "
          >
            {{
              isSavingMonthly ? '保存中...' : editingMonthlyPlan ? '保存修改' : '保存'
            }}
          </FormButton>
        </div>
      </form>
    </LayoutDialog>

    <!-- ── 二次确认删除弹窗 (CommonConfirmDialog) ── -->
    <CommonConfirmDialog
      v-model:open="showDeleteConfirm"
      :title="deleteConfirmTitle"
      :text="deleteConfirmText"
      confirm-button-text="确认删除"
      cancel-button-text="取消"
      confirm-button-color="danger"
      @confirm="executeDelete"
    />
  </div>
</template>

<script setup lang="ts">
import {
  Download,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Paperclip,
  X,
  Eye,
  ChevronRight
} from 'lucide-vue-next'
import type { PostBlobResponse } from '~~/lib/core/api/blobStorage'
import type { Optional } from '@speckle/shared'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import { CommonConfirmDialog } from '#components'
import {
  getLatestProgressV2PlanFile,
  uploadProgressV2PlanFile,
  getProgressV2PlanTasks,
  getProgressV2PlanFileDownloadUrl,
  listProgressV2AnnualPlans,
  createProgressV2AnnualPlan,
  updateProgressV2AnnualPlan,
  deleteProgressV2AnnualPlan,
  listProgressV2MonthlyPlans,
  createProgressV2MonthlyPlan,
  updateProgressV2MonthlyPlan,
  deleteProgressV2MonthlyPlan,
  type ProgressV2PlanFile,
  type ProgressV2PlanTask,
  type ProgressV2AnnualPlan,
  type ProgressV2AnnualPlanAttachment,
  type ProgressV2MonthlyPlan
} from '~/lib/projects/api/progress-v2'
import { prettyFileSize } from '~/lib/core/helpers/file'
import { useFileDownload } from '~~/lib/core/composables/fileUpload'

const route = useRoute()
const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()

const activeTab = ref<'total' | 'annual' | 'monthly'>('total')

// ── 总进度计划数据 ──
const isImporting = ref(false)
const isLoadingTasks = ref(false)
const planImportInputRef = ref<HTMLInputElement | null>(null)
const latestPlanFile = ref<ProgressV2PlanFile | null>(null)
const planTasks = ref<ProgressV2PlanTask[]>([])

// 字段使用新版：任务名称（占首列大宽度，负责展开折叠）、工期、开始时间、完成时间
const taskColumns = [
  { id: 'taskName', header: '任务名称', classes: 'col-span-6' },
  { id: 'duration', header: '工期', classes: 'col-span-2 text-center' },
  { id: 'startDate', header: '开始时间', classes: 'col-span-2 text-center' },
  { id: 'endDate', header: '完成时间', classes: 'col-span-2 text-center' }
]

const parseWbsSegments = (wbs?: string) => {
  if (!wbs) return []
  return wbs
    .split('.')
    .filter(Boolean)
    .map((segment) => Number.parseInt(segment, 10))
}

const compareWbs = (left?: string, right?: string) => {
  if (!left && !right) return 0
  if (left && !right) return -1
  if (!left && right) return 1

  const leftSegments = parseWbsSegments(left)
  const rightSegments = parseWbsSegments(right)
  const maxLength = Math.max(leftSegments.length, rightSegments.length)

  for (let index = 0; index < maxLength; index++) {
    const leftSegment = leftSegments[index]
    const rightSegment = rightSegments[index]

    if (leftSegment === undefined) return -1
    if (rightSegment === undefined) return 1
    if (leftSegment !== rightSegment) return leftSegment - rightSegment
  }

  return 0
}

const getParentWbs = (wbs?: string) => {
  if (!wbs) return null
  const segments = wbs.split('.').filter(Boolean)
  if (segments.length <= 1) return null
  return segments.slice(0, -1).join('.')
}

const getWbsLevel = (wbs?: string, fallbackLevel = 0) => {
  if (!wbs) return fallbackLevel
  const segments = wbs.split('.').filter(Boolean)
  return Math.max(segments.length - 1, 0)
}

// 展示方式（展开收缩）使用旧版：按树形层级构建带 children 的嵌套对象，首列渲染箭头与缩进
const rebuildTaskTree = (taskItems: ProgressV2PlanTask[]): ProgressV2PlanTask[] => {
  const orderedItems = [...taskItems].sort((left, right) => {
    const wbsOrder = compareWbs(left.wbs || undefined, right.wbs || undefined)
    if (wbsOrder !== 0) return wbsOrder
    return (left.taskName || left.name).localeCompare(
      right.taskName || right.name,
      'zh-CN'
    )
  })

  const originalParentIds = new Map(
    orderedItems.map((item) => [item.id, item.parentId || undefined])
  )
  const itemMap = new Map(
    orderedItems.map((item) => [
      item.id,
      { ...item, children: [] as ProgressV2PlanTask[] }
    ])
  )
  const itemByWbs = new Map(
    orderedItems.flatMap((item) =>
      item.wbs ? [[item.wbs, itemMap.get(item.id)!] as const] : []
    )
  )

  itemMap.forEach((item) => {
    item.children = []
    item.parentId = null
    item.level = getWbsLevel(item.wbs || undefined, item.level)
  })

  const rootItems: ProgressV2PlanTask[] = []

  orderedItems.forEach((raw) => {
    const item = itemMap.get(raw.id)!
    const wbsParent = getParentWbs(item.wbs || undefined)
    const originalParentId = originalParentIds.get(item.id)
    const parent = item.wbs
      ? wbsParent
        ? itemByWbs.get(wbsParent)
        : undefined
      : originalParentId
      ? itemMap.get(originalParentId)
      : undefined

    if (!parent) {
      rootItems.push(item)
      return
    }

    item.parentId = parent.id
    item.level = parent.level + 1
    parent.children = [...(parent.children || []), item]
    parent.hasChildren = true
  })

  return rootItems
}

// MPP 导入的第 0 级（顶层汇总节点）不在任务树中展示，将其子级上提为顶层
const treeTasks = computed(() => {
  const nonRoot = planTasks.value.filter(
    (t) => (t.level ?? getWbsLevel(t.wbs || undefined)) > 0
  )
  return rebuildTaskTree(nonRoot)
})

const loadTotalPlanData = async () => {
  if (!projectId.value) return
  isLoadingTasks.value = true
  try {
    const [file, tasks] = await Promise.all([
      getLatestProgressV2PlanFile({ projectId: projectId.value, apiOrigin }),
      getProgressV2PlanTasks({ projectId: projectId.value, apiOrigin })
    ])
    latestPlanFile.value = file
    planTasks.value = tasks
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载总进度计划失败',
      description: err instanceof Error ? err.message : String(err)
    })
  } finally {
    isLoadingTasks.value = false
  }
}

const triggerPlanImport = () => {
  planImportInputRef.value?.click()
}

const handlePlanImportChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  isImporting.value = true
  try {
    const res = await uploadProgressV2PlanFile({
      projectId: projectId.value,
      file,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '导入总进度计划成功',
      description: `成功解析并更新 ${res.taskCount} 条总计划任务`
    })
    await loadTotalPlanData()
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '导入总进度计划失败',
      description: err instanceof Error ? err.message : String(err)
    })
  } finally {
    isImporting.value = false
  }
}

const handleDownloadPlanFile = () => {
  if (!projectId.value || !latestPlanFile.value) return
  const url = getProgressV2PlanFileDownloadUrl({
    projectId: projectId.value,
    apiOrigin
  })
  window.open(url, '_blank')
}

// ── 年度计划数据 ──
const isLoadingAnnual = ref(false)
const annualPlans = ref<ProgressV2AnnualPlan[]>([])
const annualDialogOpen = ref(false)
const viewAnnualDialogOpen = ref(false)
const viewingAnnualPlan = ref<ProgressV2AnnualPlan | null>(null)
const editingAnnualPlan = ref<ProgressV2AnnualPlan | null>(null)
const isSavingAnnual = ref(false)
const previewDialogOpen = ref(false)
const currentPreviewAttachment = ref<ProgressV2AnnualPlanAttachment | null>(null)

type FormAttachmentItem = {
  id: string
  blobId?: string
  fileName: string
  fileSize?: number | null
  file?: File
}
const annualAttachments = ref<FormAttachmentItem[]>([])

const { download: downloadBlobFile } = useFileDownload()

const getPlanAttachments = (
  plan: ProgressV2AnnualPlan | null | undefined
): ProgressV2AnnualPlanAttachment[] => {
  if (!plan) return []
  if (Array.isArray(plan.attachments) && plan.attachments.length > 0) {
    return plan.attachments
  }
  if (plan.blobId && plan.fileName) {
    return [
      {
        blobId: plan.blobId,
        fileName: plan.fileName,
        fileSize: plan.fileSize
      }
    ]
  }
  return []
}

const annualForm = reactive<{
  year: string
  name: string
  startDate: string
  endDate: string
  preparedBy: string
  remark: string
}>({
  year: String(new Date().getFullYear()),
  name: '',
  startDate: `${new Date().getFullYear()}-01-01`,
  endDate: `${new Date().getFullYear()}-12-31`,
  preparedBy: '',
  remark: ''
})

const onAnnualAttachmentChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  if (!files.length) return
  for (const f of files) {
    annualAttachments.value.push({
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fileName: f.name,
      fileSize: f.size,
      file: f
    })
  }
  target.value = ''
}

const removeAnnualAttachment = (index: number) => {
  annualAttachments.value.splice(index, 1)
}

const openAttachmentPreview = (att: ProgressV2AnnualPlanAttachment) => {
  currentPreviewAttachment.value = att
  previewDialogOpen.value = true
}

const downloadAttachment = async (att: ProgressV2AnnualPlanAttachment) => {
  if (!projectId.value || !att.blobId) return
  await downloadBlobFile({
    blobId: att.blobId,
    projectId: projectId.value,
    fileName: att.fileName
  })
}

const uploadAnnualAttachment = async (
  file: File
): Promise<{ blobId: string; fileName: string; fileSize: number | null }> => {
  const data = new FormData()
  data.append('file', file)
  const uploadPayload = await $fetch<PostBlobResponse>(
    new URL(`/api/stream/${projectId.value}/blob`, apiOrigin).toString(),
    { method: 'POST', body: data }
  )
  const uploadResults =
    (uploadPayload as Optional<PostBlobResponse>)?.uploadResults || []
  const result = uploadResults.find((r) => r.formKey === 'file')
  if (!result?.blobId) {
    throw new Error(result?.uploadError || '文件上传后未返回 blobId')
  }
  return {
    blobId: result.blobId,
    fileName: result.fileName || file.name,
    fileSize: result.fileSize || file.size || null
  }
}

const loadAnnualPlans = async () => {
  if (!projectId.value) return
  isLoadingAnnual.value = true
  try {
    annualPlans.value = await listProgressV2AnnualPlans({
      projectId: projectId.value,
      apiOrigin
    })
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载年度计划失败',
      description: err instanceof Error ? err.message : String(err)
    })
  } finally {
    isLoadingAnnual.value = false
  }
}

const openCreateAnnualDialog = () => {
  editingAnnualPlan.value = null
  const y = new Date().getFullYear()
  annualForm.year = String(y)
  annualForm.name = `${y}年度实施进度计划`
  annualForm.startDate = `${y}-01-01`
  annualForm.endDate = `${y}-12-31`
  annualForm.preparedBy = ''
  annualForm.remark = ''
  annualAttachments.value = []
  annualDialogOpen.value = true
}

const openViewAnnualDialog = (plan: ProgressV2AnnualPlan) => {
  viewingAnnualPlan.value = plan
  viewAnnualDialogOpen.value = true
}

const openEditAnnualDialog = (plan: ProgressV2AnnualPlan) => {
  editingAnnualPlan.value = plan
  annualForm.year = String(plan.year)
  annualForm.name = plan.name
  annualForm.startDate = plan.startDate ? plan.startDate.slice(0, 10) : ''
  annualForm.endDate = plan.endDate ? plan.endDate.slice(0, 10) : ''
  annualForm.preparedBy = plan.preparedBy || ''
  annualForm.remark = plan.remark || ''
  const rawAttachments = getPlanAttachments(plan)
  annualAttachments.value = rawAttachments.map((att, idx) => ({
    id: att.blobId || `existing-${idx}`,
    blobId: att.blobId,
    fileName: att.fileName,
    fileSize:
      att.fileSize !== null && att.fileSize !== undefined ? Number(att.fileSize) : null
  }))
  annualDialogOpen.value = true
}

const handleSaveAnnual = async () => {
  if (!projectId.value) return
  isSavingAnnual.value = true
  try {
    // 遍历上传新添加的文件，已有附件直接保留
    const finalAttachments: ProgressV2AnnualPlanAttachment[] = []
    for (const item of annualAttachments.value) {
      if (item.file) {
        const uploaded = await uploadAnnualAttachment(item.file)
        finalAttachments.push({
          blobId: uploaded.blobId,
          fileName: uploaded.fileName,
          fileSize:
            uploaded.fileSize !== null && uploaded.fileSize !== undefined
              ? Number(uploaded.fileSize)
              : null
        })
      } else if (item.blobId) {
        finalAttachments.push({
          blobId: item.blobId,
          fileName: item.fileName,
          fileSize:
            item.fileSize !== null && item.fileSize !== undefined
              ? Number(item.fileSize)
              : null
        })
      }
    }

    const firstFileSize =
      finalAttachments[0]?.fileSize !== undefined &&
      finalAttachments[0]?.fileSize !== null
        ? Number(finalAttachments[0].fileSize)
        : null

    const payload = {
      year: Number(annualForm.year),
      name: annualForm.name,
      startDate: annualForm.startDate,
      endDate: annualForm.endDate,
      preparedBy: annualForm.preparedBy || null,
      blobId: finalAttachments[0]?.blobId || null,
      fileName: finalAttachments[0]?.fileName || null,
      fileSize: firstFileSize,
      attachments: finalAttachments,
      remark: annualForm.remark || null
    }

    if (editingAnnualPlan.value) {
      await updateProgressV2AnnualPlan({
        projectId: projectId.value,
        annualPlanId: editingAnnualPlan.value.id,
        apiOrigin,
        data: payload
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '更新成功',
        description: '年度计划信息已更新'
      })
    } else {
      await createProgressV2AnnualPlan({
        projectId: projectId.value,
        apiOrigin,
        data: payload
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '创建成功',
        description: '已新建年度计划'
      })
    }
    annualDialogOpen.value = false
    await loadAnnualPlans()
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '保存失败',
      description: err instanceof Error ? err.message : String(err)
    })
  } finally {
    isSavingAnnual.value = false
  }
}

// ── 月度计划数据 ──
const isLoadingMonthly = ref(false)
const monthlyPlans = ref<ProgressV2MonthlyPlan[]>([])
const monthlyDialogOpen = ref(false)
const viewMonthlyDialogOpen = ref(false)
const viewingMonthlyPlan = ref<ProgressV2MonthlyPlan | null>(null)
const editingMonthlyPlan = ref<ProgressV2MonthlyPlan | null>(null)
const isSavingMonthly = ref(false)
const monthlyAttachments = ref<FormAttachmentItem[]>([])

const monthlyForm = reactive({
  yearMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(
    2,
    '0'
  )}`,
  title: '',
  startDate: '',
  endDate: '',
  preparedBy: '',
  remark: ''
})

const getMonthlyAttachments = (
  plan: ProgressV2MonthlyPlan
): ProgressV2AnnualPlanAttachment[] => {
  return (plan.attachments as ProgressV2AnnualPlanAttachment[]) || []
}

const onYearMonthChange = (ym: string) => {
  if (!editingMonthlyPlan.value && ym) {
    const parts = ym.split('-')
    if (parts.length === 2) {
      const year = Number.parseInt(parts[0], 10)
      const month = Number.parseInt(parts[1], 10)
      monthlyForm.title = `${year}年${String(month).padStart(2, '0')}月月度施工进度计划`
      monthlyForm.startDate = `${ym}-01`
      const lastDay = new Date(year, month, 0).getDate()
      monthlyForm.endDate = `${ym}-${String(lastDay).padStart(2, '0')}`
    }
  }
}

const onMonthlyAttachmentChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  if (!files.length) return
  for (const f of files) {
    monthlyAttachments.value.push({
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fileName: f.name,
      fileSize: f.size,
      file: f
    })
  }
  target.value = ''
}

const removeMonthlyAttachment = (index: number) => {
  monthlyAttachments.value.splice(index, 1)
}

const openViewMonthlyDialog = (plan: ProgressV2MonthlyPlan) => {
  viewingMonthlyPlan.value = plan
  viewMonthlyDialogOpen.value = true
}

const loadMonthlyPlans = async () => {
  if (!projectId.value) return
  isLoadingMonthly.value = true
  try {
    monthlyPlans.value = await listProgressV2MonthlyPlans({
      projectId: projectId.value,
      apiOrigin
    })
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载月度计划失败',
      description: err instanceof Error ? err.message : String(err)
    })
  } finally {
    isLoadingMonthly.value = false
  }
}

const openCreateMonthlyDialog = () => {
  editingMonthlyPlan.value = null
  monthlyAttachments.value = []
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const firstDay = `${ym}-01`
  const lastDayObj = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const lastDay = `${ym}-${String(lastDayObj.getDate()).padStart(2, '0')}`
  monthlyForm.yearMonth = ym
  monthlyForm.title = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}月月度施工进度计划`
  monthlyForm.startDate = firstDay
  monthlyForm.endDate = lastDay
  monthlyForm.preparedBy = ''
  monthlyForm.remark = ''
  monthlyDialogOpen.value = true
}

const openEditMonthlyDialog = (plan: ProgressV2MonthlyPlan) => {
  editingMonthlyPlan.value = plan
  const rawAttachments = getMonthlyAttachments(plan)
  monthlyAttachments.value = rawAttachments.map((att, idx) => ({
    id: att.blobId || `existing-monthly-${idx}`,
    blobId: att.blobId,
    fileName: att.fileName,
    fileSize:
      att.fileSize !== null && att.fileSize !== undefined ? Number(att.fileSize) : null
  }))
  monthlyForm.yearMonth = plan.yearMonth
  monthlyForm.title = plan.title || ''
  monthlyForm.startDate = plan.startDate ? plan.startDate.slice(0, 10) : ''
  monthlyForm.endDate = plan.endDate ? plan.endDate.slice(0, 10) : ''
  monthlyForm.preparedBy = plan.preparedBy || ''
  monthlyForm.remark = plan.remark || ''
  monthlyDialogOpen.value = true
}

const handleSaveMonthly = async () => {
  if (!projectId.value) return
  isSavingMonthly.value = true
  try {
    const finalAttachments: ProgressV2AnnualPlanAttachment[] = []
    for (const item of monthlyAttachments.value) {
      if (item.file) {
        const uploaded = await uploadAnnualAttachment(item.file)
        finalAttachments.push({
          blobId: uploaded.blobId,
          fileName: uploaded.fileName,
          fileSize:
            uploaded.fileSize !== null && uploaded.fileSize !== undefined
              ? Number(uploaded.fileSize)
              : null
        })
      } else if (item.blobId) {
        finalAttachments.push({
          blobId: item.blobId,
          fileName: item.fileName,
          fileSize:
            item.fileSize !== null && item.fileSize !== undefined
              ? Number(item.fileSize)
              : null
        })
      }
    }

    if (editingMonthlyPlan.value) {
      await updateProgressV2MonthlyPlan({
        projectId: projectId.value,
        monthlyPlanId: editingMonthlyPlan.value.id,
        apiOrigin,
        data: {
          title: monthlyForm.title,
          startDate: monthlyForm.startDate || null,
          endDate: monthlyForm.endDate || null,
          preparedBy: monthlyForm.preparedBy || null,
          attachments: finalAttachments,
          remark: monthlyForm.remark
        }
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '更新成功',
        description: '月度计划已保存'
      })
    } else {
      await createProgressV2MonthlyPlan({
        projectId: projectId.value,
        apiOrigin,
        data: {
          yearMonth: monthlyForm.yearMonth,
          title: monthlyForm.title,
          startDate: monthlyForm.startDate || null,
          endDate: monthlyForm.endDate || null,
          preparedBy: monthlyForm.preparedBy || null,
          attachments: finalAttachments,
          remark: monthlyForm.remark
        }
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '创建成功',
        description: '已新建月度施工计划'
      })
    }
    monthlyDialogOpen.value = false
    await loadMonthlyPlans()
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '保存失败',
      description: err instanceof Error ? err.message : String(err)
    })
  } finally {
    isSavingMonthly.value = false
  }
}

// ── 删除二次确认 (CommonConfirmDialog) ──
const showDeleteConfirm = ref(false)
const deleteConfirmTitle = ref('确认删除')
const deleteConfirmText = ref('确定要删除该项吗？此操作不可逆。')
let pendingDeleteAction: (() => Promise<void>) | null = null

const promptDeleteAnnual = (plan: ProgressV2AnnualPlan) => {
  deleteConfirmTitle.value = '删除年度计划'
  deleteConfirmText.value = `确定要删除「${plan.name}」吗？关联的年度任务树也将被移除。`
  pendingDeleteAction = async () => {
    await deleteProgressV2AnnualPlan({
      projectId: projectId.value,
      annualPlanId: plan.id,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '删除成功',
      description: '年度计划已删除'
    })
    await loadAnnualPlans()
  }
  showDeleteConfirm.value = true
}

const promptDeleteMonthly = (plan: ProgressV2MonthlyPlan) => {
  deleteConfirmTitle.value = '删除月度计划'
  deleteConfirmText.value = `确定要删除「${plan.yearMonth}」月度计划吗？`
  pendingDeleteAction = async () => {
    await deleteProgressV2MonthlyPlan({
      projectId: projectId.value,
      monthlyPlanId: plan.id,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '删除成功',
      description: '月度计划已删除'
    })
    await loadMonthlyPlans()
  }
  showDeleteConfirm.value = true
}

const executeDelete = async () => {
  if (!pendingDeleteAction) return
  try {
    await pendingDeleteAction()
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '删除失败',
      description: err instanceof Error ? err.message : String(err)
    })
  } finally {
    pendingDeleteAction = null
    showDeleteConfirm.value = false
  }
}

watch(
  () => activeTab.value,
  (tab) => {
    if (tab === 'total') loadTotalPlanData()
    else if (tab === 'annual') loadAnnualPlans()
    else if (tab === 'monthly') loadMonthlyPlans()
  }
)

onMounted(() => {
  loadTotalPlanData()
})
</script>
