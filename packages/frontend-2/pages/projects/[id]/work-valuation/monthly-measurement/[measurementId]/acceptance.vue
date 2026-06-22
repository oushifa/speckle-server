<template>
  <div
    class="space-y-6 pb-6 relative bg-foundation p-4 rounded-b-lg border border-t-0 border-outline-3"
  >
    <!-- 汇总展示 -->
    <div class="space-y-6">
      <!-- 表格上方单据元数据区 -->
      <div class="text-center space-y-2 relative">
        <h2 class="text-xl font-bold text-foreground">
          {{ contractName }}&nbsp;{{ formatDateMonth(item?.baseDate) }}&nbsp;{{
            item?.roundName ? `第${item.roundName}期` : '第1期'
          }}
        </h2>
        <div
          class="flex justify-between items-center text-xs text-foreground-2 px-1 pt-2 border-b border-outline-3 pb-1.5"
        >
          <div>
            承建单位（盖章）：
            <span class="font-medium text-foreground">
              {{ item?.unit || '上海建工集团股份有限公司' }}
            </span>
          </div>
          <div class="flex items-center space-x-3">
            <span>合同编号：{{ projectContractCode }}</span>
          </div>
          <div class="flex items-center space-x-3">
            <span>单位：元</span>
          </div>
        </div>
      </div>

      <!-- 经典深蓝色双层表头表格 -->
      <div class="border border-outline-3 rounded-lg overflow-auto shadow-sm">
        <table class="w-full text-[11px] text-left min-w-[1050px] border-collapse">
          <thead class="bg-[#0f4c9c] text-white text-center sticky top-0 z-10">
            <tr class="border-b border-blue-800">
              <th rowspan="2" class="px-2 py-2 border-r border-blue-800 w-10">序号</th>
              <th rowspan="2" class="px-2 py-2 border-r border-blue-800 w-16">
                清单章节
              </th>
              <th
                rowspan="2"
                class="px-2 py-2 border-r border-blue-800 text-left pl-3 w-56"
              >
                内容名称
              </th>
              <th
                rowspan="2"
                class="px-2 py-2 border-r border-blue-800 text-right pr-3 w-28"
              >
                合同价
              </th>
              <th colspan="4" class="px-2 py-1.5 border-b border-blue-800 border-r">
                本期完成工作量
              </th>
              <th
                rowspan="2"
                class="px-2 py-2 border-r border-blue-800 text-right pr-3 w-28"
              >
                本年完成工作量
              </th>
              <th
                rowspan="2"
                class="px-2 py-2 border-r border-blue-800 text-right pr-3 w-28"
              >
                累计完成工作量
              </th>
              <th
                rowspan="2"
                class="px-2 py-2 border-r border-blue-800 text-right pr-3 w-20"
              >
                合同累计完成比例%
              </th>
              <th rowspan="2" class="px-2 py-2 w-20">备注</th>
            </tr>
            <tr class="bg-[#1a5ba8]">
              <th class="px-2 py-1.5 border-r border-blue-800 text-right pr-3 w-24">
                施工单位
              </th>
              <th class="px-2 py-1.5 border-r border-blue-800 text-right pr-3 w-24">
                施工监理
              </th>
              <th class="px-2 py-1.5 border-r border-blue-800 text-right pr-3 w-24">
                现场指挥部
              </th>
              <th class="px-2 py-1.5 border-r border-blue-800 text-right pr-3 w-24">
                投资监理
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in acceptanceGroups" :key="group.groupKey">
              <tr
                v-for="row in group.rows"
                :key="row.boqItemId"
                class="border-b border-outline-3 bg-foundation hover:bg-highlight-1/20 transition-colors"
              >
                <td class="px-2 py-2 text-center text-foreground-2">
                  {{ row.displayIndex }}
                </td>
                <td class="px-2 py-2 text-center font-mono">{{ row.boqCode }}</td>
                <td class="px-2 py-2 text-left pl-3 font-medium">
                  <button
                    class="text-primary hover:underline text-left"
                    :title="isReadOnly ? '点击查看清单明细' : '点击编辑清单明细'"
                    @click="openTreeEdit(row.boqItemId, row.boqName)"
                  >
                    {{ row.boqName }}
                  </button>
                </td>
                <td class="px-2 py-2 text-right pr-3 font-mono">
                  {{ formatMoney(row.contractAmount) }}
                </td>
                <td class="px-2 py-2 text-right pr-3 font-mono">
                  {{ formatMoney(row.contractorAmount) }}
                </td>
                <td class="px-2 py-2 text-right pr-3 font-mono text-foreground-2">
                  {{ formatMoney(row.supervisionAmount) }}
                </td>
                <td class="px-2 py-2 text-right pr-3 font-mono text-foreground-2">
                  {{ formatMoney(row.headquartersAmount) }}
                </td>
                <td
                  class="px-2 py-2 text-right pr-3 font-mono text-primary font-medium"
                >
                  {{ formatMoney(row.investmentAmount) }}
                </td>
                <td class="px-2 py-2 text-right pr-3 font-mono">
                  {{ formatMoney(row.yearlyAmount) }}
                </td>
                <td
                  class="px-2 py-2 text-right pr-3 font-mono font-medium text-success-darker"
                >
                  {{ formatMoney(row.cumulativeAmount) }}
                </td>
                <td class="px-2 py-2 text-right pr-3 font-mono">
                  {{ row.cumulativeRate }}%
                </td>
                <td
                  class="px-2 py-2 text-center text-foreground-2 truncate max-w-[80px]"
                >
                  {{ row.remark || '-' }}
                </td>
              </tr>

              <tr
                class="bg-foundation-2 font-bold text-foreground border-b border-outline-3"
              >
                <td class="px-2 py-2.5 text-center" />
                <td class="px-2 py-2.5 text-center" />
                <td class="px-2 py-2.5 text-left pl-3">
                  {{ group.groupBoqName }} 小计
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono">
                  {{ formatMoney(group.subtotal.contractAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono">
                  {{ formatMoney(group.subtotal.contractorAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono">
                  {{ formatMoney(group.subtotal.supervisionAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono">
                  {{ formatMoney(group.subtotal.headquartersAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono text-primary">
                  {{ formatMoney(group.subtotal.investmentAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono">
                  {{ formatMoney(group.subtotal.yearlyAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono text-success-darker">
                  {{ formatMoney(group.subtotal.cumulativeAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono">
                  {{ group.subtotal.cumulativeRate }}%
                </td>
                <td class="px-2 py-2.5 text-center" />
              </tr>
            </template>

            <!-- 总价行 -->
            <tr
              class="bg-[#0f4c9c] font-bold text-white border-t border-blue-900 sticky bottom-0 z-10"
            >
              <td class="px-2 py-2.5 text-center" />
              <td class="px-2 py-2.5 text-center" />
              <td class="px-2 py-2.5 text-left pl-3">总价</td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono">
                {{ formatMoney(totalSums.contractAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono">
                {{ formatMoney(totalSums.contractorAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono">
                {{ formatMoney(totalSums.supervisionAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono">
                {{ formatMoney(totalSums.headquartersAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono text-white">
                {{ formatMoney(totalSums.investmentAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono">
                {{ formatMoney(totalSums.yearlyAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono text-white">
                {{ formatMoney(totalSums.cumulativeAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono">
                {{ totalSums.cumulativeRate }}%
              </td>
              <td class="px-2 py-2.5 text-center" />
            </tr>
            <!-- 项目负责人、统计员等附加说明行 -->
            <tr class="bg-foundation-2 text-foreground-2 text-center border-t border-outline-3">
              <td colspan="12" class="px-2 py-2 text-left pl-3 font-semibold text-xs">
                <div class="flex justify-between items-center w-full max-w-[800px]">
                  <span>项目负责人：施柳盛</span>
                  <span>统计员：{{ flowInitiatorName || '-' }}</span>
                  <span>联系电话：13788903651</span>
                  <span>填报日期：{{ flowInitiatorDate || '-' }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 四方审核意见签署区 -->
      <div class="bg-foundation space-y-4 shadow-sm">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <!-- 施工监理意见 -->
          <div
            class="p-4 border border-outline-3 rounded-lg bg-foundation-2 space-y-3 flex flex-col justify-between"
          >
            <span class="text-xs font-semibold text-foreground-2">
              <span v-if="currentStepName === '施工监理总监'" class="text-red-500 mr-0.5 font-bold">*</span>
              施工监理意见
            </span>
            <textarea
              v-model="acceptanceDetails.supervisionOpinion"
              placeholder="审核意见..."
              :disabled="!permissions.supervision"
              class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs focus:outline-none focus:border-primary disabled:opacity-60 h-20"
            />
            <div class="grid grid-cols-2 gap-2">
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">经办人</div>
                <div class="text-xs font-medium text-foreground">
                  {{ getAcceptanceAuditUser('supervision') }}
                </div>
              </div>
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">日期</div>
                <div class="text-xs font-mono text-foreground">
                  {{ getAcceptanceOperatorDate('施工监理经办人') || '\u00A0' }}
                </div>
              </div>
            </div>
          </div>

          <!-- 现场指挥部意见 -->
          <div
            class="p-4 border border-outline-3 rounded-lg bg-foundation-2 space-y-3 flex flex-col justify-between"
          >
            <span class="text-xs font-semibold text-foreground-2">
              <span v-if="currentStepName === '现场指挥'" class="text-red-500 mr-0.5 font-bold">*</span>
              现场指挥部意见
            </span>
            <textarea
              v-model="acceptanceDetails.headquartersOpinion"
              placeholder="审核意见..."
              :disabled="!permissions.headquarters"
              class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs focus:outline-none focus:border-primary disabled:opacity-60 h-20"
            />
            <div class="grid grid-cols-2 gap-2">
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">经办人</div>
                <div class="text-xs font-medium text-foreground">
                  {{ getAcceptanceAuditUser('headquarters') }}
                </div>
              </div>
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">日期</div>
                <div class="text-xs font-mono text-foreground">
                  {{ getAcceptanceOperatorDate('现场指挥部经办人') || '\u00A0' }}
                </div>
              </div>
            </div>
          </div>

          <!-- 投资监理意见 -->
          <div
            class="p-4 border border-outline-3 rounded-lg bg-foundation-2 space-y-3 flex flex-col justify-between"
          >
            <span class="text-xs font-semibold text-foreground-2">
              <span v-if="currentStepName === '投资监理总监'" class="text-red-500 mr-0.5 font-bold">*</span>
              投资监理意见
            </span>
            <textarea
              v-model="acceptanceDetails.investmentOpinion"
              placeholder="审核意见..."
              :disabled="!permissions.investment"
              class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs focus:outline-none focus:border-primary disabled:opacity-60 h-20"
            />
            <div class="grid grid-cols-2 gap-2">
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">经办人</div>
                <div class="text-xs font-medium text-foreground">
                  {{ getAcceptanceAuditUser('investment') }}
                </div>
              </div>
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">日期</div>
                <div class="text-xs font-mono text-foreground">
                  {{ getAcceptanceOperatorDate('投资监理经办人') || '\u00A0' }}
                </div>
              </div>
            </div>
          </div>

          <!-- 合约部管理意见 -->
          <div
            class="p-4 border border-outline-3 rounded-lg bg-foundation-2 space-y-3 flex flex-col justify-between"
          >
            <span class="text-xs font-semibold text-foreground-2">
              <span v-if="currentStepName === '合约管理部负责人'" class="text-red-500 mr-0.5 font-bold">*</span>
              合约部管理意见
            </span>
            <textarea
              v-model="acceptanceDetails.ownerOpinion"
              placeholder="审核意见..."
              :disabled="!permissions.contract"
              class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs focus:outline-none focus:border-primary disabled:opacity-60 h-20"
            />
            <div class="grid grid-cols-2 gap-2">
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">经办人</div>
                <div class="text-xs font-medium text-foreground">
                  {{ getAcceptanceAuditUser('owner') }}
                </div>
              </div>
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">日期</div>
                <div class="text-xs font-mono text-foreground">
                  {{ getAcceptanceOperatorDate('合约管理部经办人') || '\u00A0' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部固定浮动操作栏 -->
    <div
      class="sticky bottom-0 bg-foundation border-t border-outline-3 p-3 flex justify-end items-center gap-3 z-30 shadow-md"
    >
      <FormButton
        color="outline"
        class="border-primary text-primary"
        @click="openModelViewer"
      >
        验工模型查看
      </FormButton>

      <FormButton color="outline" @click="openAttachmentsDialog">
        <PaperClipIcon class="h-4 w-4 mr-1 text-foreground-2" />
        附件 ({{ acceptanceDetails.acceptanceAttachments?.length || 0 }})
      </FormButton>

      <FormButton
        color="outline"
        class="border-primary text-primary"
        @click="handlePrintSummary"
      >
        打印汇总表
      </FormButton>

      <FormButton
        color="outline"
        class="border-primary text-primary"
        @click="openPrintDetailDialog"
      >
        打印明细
      </FormButton>

      <FormButton
        v-if="isCurrentApprover"
        color="outline"
        class="border-primary text-primary"
        @click="openSafetyMeasureDialog"
      >
        安全文明措施关联
      </FormButton>

      <FormButton
        v-if="isCurrentApprover"
        color="primary"
        :loading="acceptanceSaving"
        @click="saveTab1Acceptance"
      >
        <span class="flex items-center gap-1">
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
            />
          </svg>
          保存
        </span>
      </FormButton>

      <FormButton color="outline" @click="goBackToList">
        <span>关闭</span>
      </FormButton>
    </div>

    <!-- 附件弹出层 LayoutDialog -->
    <LayoutDialog
      v-model:open="attachmentsDialogOpen"
      max-width="md"
      :prevent-close-on-click-outside="deleteConfirmOpen"
    >
      <template #header>验工附件管理</template>
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <span class="text-sm font-semibold">
            附件列表 ({{ acceptanceDetails.acceptanceAttachments?.length || 0 }} 个)
          </span>
          <input
            ref="acceptanceFileRef"
            type="file"
            class="hidden"
            multiple
            @change="handleAcceptanceFileUpload"
          />
          <FormButton
            v-if="isCurrentApprover"
            size="sm"
            color="primary"
            @click="triggerAcceptanceUpload"
          >
            上传新文件
          </FormButton>
        </div>

        <div
          v-if="acceptanceDetails.acceptanceAttachments?.length"
          class="space-y-2 max-h-[300px] overflow-y-auto pr-1"
        >
          <div
            v-for="(attachment, aIdx) in acceptanceDetails.acceptanceAttachments"
            :key="aIdx"
            class="flex justify-between items-center p-2 rounded bg-foundation-2 border border-outline-3 text-xs"
          >
            <div class="flex items-center gap-1.5 min-w-0 pr-3">
              <PaperClipIcon class="h-4 w-4 text-foreground-2 flex-shrink-0" />
              <span class="truncate" :title="attachment.name">
                {{ attachment.name || attachment.blobId }}
              </span>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button
                class="text-primary hover:underline font-medium"
                @click="downloadBlobWithAuth({ blobId: attachment.blobId, fileName: attachment.name || attachment.blobId, projectId: props.projectId })"
              >
                下载
              </button>
              <button
                v-if="isCurrentApprover"
                class="text-danger hover:underline font-medium"
                @click="removeAcceptanceAttachment(Number(aIdx))"
              >
                删除
              </button>
            </div>
          </div>
        </div>
        <div
          v-else
          class="text-center text-xs text-foreground-2 py-6 border border-dashed rounded-lg border-outline-3"
        >
          暂无上传的附件文件
        </div>
      </div>
    </LayoutDialog>

    <!-- 验工三维模型查看弹窗 -->
    <LayoutDialog v-model:open="modelViewerOpen" max-width="xl">
      <template #header>月度验工模型查看</template>
      <div class="h-[500px] w-full relative">
        <div
          v-if="acceptanceFormsLoading"
          class="h-full w-full flex items-center justify-center text-sm text-foreground-2"
        >
          加载项目构件信息中...
        </div>
        <div
          v-else-if="!selectedPreviewModelIds.length"
          class="h-full w-full flex items-center justify-center text-sm text-foreground-2"
        >
          该月度验工单下暂无关联的构件模型
        </div>
        <CommonModelPropsViewer
          v-else
          :project-id="projectId"
          :model-ids="selectedPreviewModelIds"
          :filter-bims="selectedPreviewBimIds"
          :filter-application-ids="selectedPreviewApplicationIds"
        />
      </div>
    </LayoutDialog>
    <!-- 删除附件二次确认弹窗 -->
    <CommonConfirmDialog
      v-model:open="deleteConfirmOpen"
      title="确认删除附件"
      text="您确定要删除该附件吗？此操作无法撤销。"
      confirm-text="确认删除"
      :loading="deletingAttachment"
      @confirm="executeDeleteAttachment"
    />

    <!-- 安全文明措施关联弹窗 -->
    <LayoutDialog
      v-model:open="safetyMeasureDialogOpen"
      max-width="md"
      :prevent-close-on-click-outside="safetyMeasureConfirmDialogOpen"
    >
      <template #header>安全文明措施关联</template>
      <div class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-foreground">选择已审核通过的安全文明措施费</label>
          <FormSelectBase
            v-model="selectedMeasureValue"
            :items="selectOptions"
            label="关联安全文明措施费"
            :show-label="false"
            name="safety-measure"
            by="id"
            class="w-full text-xs"
          >
            <template #something-selected="{ value }">
              <span class="truncate text-foreground text-xs">{{ (value as any)?.label || '不关联' }}</span>
            </template>
            <template #option="{ item }">
              <span class="truncate text-xs">{{ (item as any)?.label || '不关联' }}</span>
            </template>
          </FormSelectBase>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <FormButton color="outline" size="sm" @click="safetyMeasureDialogOpen = false">
            取消
          </FormButton>
          <FormButton color="primary" size="sm" :loading="safetyMeasureSaving" @click="handleAssociateSafetyMeasure">
            确认
          </FormButton>
        </div>
      </div>
    </LayoutDialog>

    <!-- 确认关联/解绑二次确认弹窗 -->
    <CommonConfirmDialog
      v-model:open="safetyMeasureConfirmDialogOpen"
      :title="safetyMeasureConfirmDialogTitle"
      :text="safetyMeasureConfirmDialogText"
      confirm-text="确认"
      :loading="safetyMeasureSaving"
      @confirm="executeAssociateSafetyMeasure"
    />

    <!-- 打印明细章节选择弹窗 -->
    <LayoutDialog
      v-model:open="printDetailDialogOpen"
      max-width="md"
    >
      <template #header>选择打印明细章节</template>
      <div class="space-y-4 p-2 text-xs">
        <div class="space-y-2">
          <label class="text-xs font-semibold text-foreground">选择要打印的聚合章节（可多选）</label>
          <div class="max-h-[220px] overflow-y-auto border border-outline-3 rounded p-2.5 space-y-2.5 bg-foundation">
            <div
              v-for="item in aggregatedItems"
              :key="item.boqItemId"
              class="flex items-center gap-2 px-1 py-0.5 hover:bg-highlight-1/10 rounded cursor-pointer select-none"
              @click="toggleGroupSelection(item.boqItemId)"
            >
              <input
                type="checkbox"
                :checked="selectedPrintGroupKeys.includes(item.boqItemId)"
                class="rounded border-outline-3 text-primary focus:ring-primary h-3.5 w-3.5 pointer-events-none"
                readOnly
              />
              <span class="text-foreground text-xs font-medium">{{ item.boqCode }} {{ item.boqName }}</span>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <FormButton color="outline" size="sm" @click="printDetailDialogOpen = false">
            取消
          </FormButton>
          <FormButton color="primary" size="sm" :disabled="!selectedPrintGroupKeys.length" @click="executePrintDetail">
            确认打印
          </FormButton>
        </div>
      </div>
    </LayoutDialog>

    <!-- 打印专属内容区域 (使用 Teleport 传送至 body 根节点，以彻底解决预览空白问题) -->
    <Teleport to="body" v-if="isPrinting">
      <div id="print-section" class="text-black bg-white p-6 font-sans">
      <!-- 1. 打印汇总表 -->
      <div v-if="printType === 'summary'" class="space-y-6">
        <div class="text-center space-y-2 relative">
          <h1 class="text-2xl font-bold tracking-wider">验 工 计 价 汇 总 表</h1>
          <h2 class="text-sm font-medium">
            {{ contractName }}&nbsp;&nbsp;&nbsp;&nbsp;{{ formatDateMonth(item?.baseDate) }}&nbsp;&nbsp;&nbsp;&nbsp;{{ item?.roundName ? '第' + item.roundName + '期' : '第1期' }}
          </h2>
          <div class="flex justify-between items-center text-xs px-1 pt-2 border-b border-black pb-1.5 font-semibold">
            <div>承包人(盖章)：{{ item?.unit || '上海公路桥梁（集团）有限公司' }}</div>
            <div>合同编号：{{ projectContractCode }}</div>
            <div>单位：元</div>
          </div>
        </div>

        <table class="print-table w-full text-[11px] text-left border-collapse border border-black">
          <thead>
            <tr class="font-bold text-center border-b border-black">
              <th rowspan="2" class="w-10 border-r border-black">序号</th>
              <th rowspan="2" class="w-16 border-r border-black">清单章节</th>
              <th rowspan="2" class="border-r border-black text-left pl-3 w-56">内容名称</th>
              <th rowspan="2" class="border-r border-black text-right pr-3 w-28">合同价</th>
              <th colspan="4" class="border-b border-black border-r border-black text-center">本期完成工作量</th>
              <th rowspan="2" class="border-r border-black text-right pr-3 w-28">本年完成工作量</th>
              <th rowspan="2" class="border-r border-black text-right pr-3 w-28">累计完成工作量</th>
              <th rowspan="2" class="border-r border-black text-right pr-3 w-20">合同累计完成比例%</th>
              <th rowspan="2" class="w-20">备注</th>
            </tr>
            <tr class="border-b border-black font-bold">
              <th class="border-r border-black text-right pr-3 w-24">施工单位</th>
              <th class="border-r border-black text-right pr-3 w-24">施工监理</th>
              <th class="border-r border-black text-right pr-3 w-24">现场指挥部</th>
              <th class="border-r border-black text-right pr-3 w-24">投资监理</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in acceptanceGroups" :key="group.groupKey">
              <tr v-for="row in group.rows" :key="row.boqItemId" class="border-b border-black">
                <td class="text-center border-r border-black">{{ row.displayIndex }}</td>
                <td class="text-center font-mono border-r border-black">{{ row.boqCode }}</td>
                <td class="text-left pl-3 border-r border-black">{{ row.boqName }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(row.contractAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(row.contractorAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(row.supervisionAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(row.headquartersAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(row.investmentAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(row.yearlyAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(row.cumulativeAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ row.cumulativeRate }}%</td>
                <td class="text-center">{{ row.remark || '-' }}</td>
              </tr>
              <tr class="font-bold border-b border-black bg-gray-50">
                <td class="text-center border-r border-black"></td>
                <td class="text-center border-r border-black"></td>
                <td class="text-left pl-3 border-r border-black">{{ group.groupBoqName }} 小计</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(group.subtotal.contractAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(group.subtotal.contractorAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(group.subtotal.supervisionAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(group.subtotal.headquartersAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(group.subtotal.investmentAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(group.subtotal.yearlyAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(group.subtotal.cumulativeAmount) }}</td>
                <td class="text-right pr-3 font-mono border-r border-black">{{ group.subtotal.cumulativeRate }}%</td>
                <td class="text-center"></td>
              </tr>
            </template>
            <tr class="font-bold border-b border-black bg-gray-100">
              <td class="text-center border-r border-black"></td>
              <td class="text-center border-r border-black"></td>
              <td class="text-left pl-3 border-r border-black">总价</td>
              <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(totalSums.contractAmount) }}</td>
              <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(totalSums.contractorAmount) }}</td>
              <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(totalSums.supervisionAmount) }}</td>
              <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(totalSums.headquartersAmount) }}</td>
              <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(totalSums.investmentAmount) }}</td>
              <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(totalSums.yearlyAmount) }}</td>
              <td class="text-right pr-3 font-mono border-r border-black">{{ formatMoney(totalSums.cumulativeAmount) }}</td>
              <td class="text-right pr-3 font-mono border-r border-black">{{ totalSums.cumulativeRate }}%</td>
              <td class="text-center"></td>
            </tr>
            <!-- 新增一行项目负责人等附加说明 -->
            <tr class="border-b border-black font-semibold bg-white text-black">
              <td colspan="12" class="px-2 py-2.5 text-left pl-3 text-xs">
                <div class="flex justify-between items-center w-full">
                  <span>项目负责人：施柳盛</span>
                  <span>统计员：{{ flowInitiatorName || '-' }}</span>
                  <span>联系电话：13788903651</span>
                  <span>填报日期：{{ flowInitiatorDate || '-' }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 四方盖章意见 -->
        <div class="grid grid-cols-4 gap-4 mt-8 print-opinions">
          <div class="border border-black p-3 rounded space-y-2 text-xs flex flex-col justify-between h-36">
            <div class="font-bold">施工监理意见：</div>
            <div class="italic flex-grow">{{ acceptanceDetails.supervisionOpinion || '' }}</div>
            <div class="text-[10px]">
              <div>经办人：{{ getAcceptanceAuditUser('supervision') }}</div>
              <div>日&nbsp;&nbsp;期：{{ getAcceptanceOperatorDate('施工监理经办人') || formatDate(acceptanceDetails.supervisionDate) }}</div>
            </div>
          </div>
          <div class="border border-black p-3 rounded space-y-2 text-xs flex flex-col justify-between h-36">
            <div class="font-bold">现场指挥部意见：</div>
            <div class="italic flex-grow">{{ acceptanceDetails.headquartersOpinion || '' }}</div>
            <div class="text-[10px]">
              <div>经办人：{{ getAcceptanceAuditUser('headquarters') }}</div>
              <div>日&nbsp;&nbsp;期：{{ getAcceptanceOperatorDate('现场指挥部经办人') || formatDate(acceptanceDetails.headquartersDate) }}</div>
            </div>
          </div>
          <div class="border border-black p-3 rounded space-y-2 text-xs flex flex-col justify-between h-36">
            <div class="font-bold">投资监理意见：</div>
            <div class="italic flex-grow">{{ acceptanceDetails.investmentOpinion || '' }}</div>
            <div class="text-[10px]">
              <div>经办人：{{ getAcceptanceAuditUser('investment') }}</div>
              <div>日&nbsp;&nbsp;期：{{ getAcceptanceOperatorDate('投资监理经办人') || formatDate(acceptanceDetails.investmentDate) }}</div>
            </div>
          </div>
          <div class="border border-black p-3 rounded space-y-2 text-xs flex flex-col justify-between h-36">
            <div class="font-bold">合约部管理意见：</div>
            <div class="italic flex-grow">{{ acceptanceDetails.ownerOpinion || '' }}</div>
            <div class="text-[10px]">
              <div>经办人：{{ getAcceptanceAuditUser('owner') }}</div>
              <div>日&nbsp;&nbsp;期：{{ getAcceptanceOperatorDate('合约管理部经办人') || formatDate(acceptanceDetails.ownerDate) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 打印明细表 -->
      <div v-if="printType === 'detail'" class="space-y-6">
        <div class="text-center space-y-2 relative">
          <h1 class="text-2xl font-bold tracking-wider">验 工 计 价 月 报</h1>
          <h2 class="text-sm font-medium">
            {{ contractName }}&nbsp;&nbsp;&nbsp;&nbsp;{{ formatDateMonth(item?.baseDate) }}&nbsp;&nbsp;&nbsp;&nbsp;{{ item?.roundName ? '第' + item.roundName + '期' : '第1期' }}
          </h2>
          <div class="flex justify-between items-center text-xs px-1 pt-2 border-b border-black pb-1.5 font-semibold">
            <div>承包人(盖章)：{{ item?.unit || '上海公路桥梁（集团）有限公司' }}</div>
            <div>合同编号：{{ projectContractCode }}</div>
            <div>单位：元</div>
          </div>
        </div>

        <table class="print-table w-full text-[10px] text-left border-collapse border border-black">
          <thead>
            <tr class="font-bold text-center border-b border-black">
              <th rowspan="3" class="w-20 border-r border-black">清单编号</th>
              <th rowspan="3" class="w-56 text-left pl-3 border-r border-black">项目名称</th>
              <th rowspan="3" class="w-10 border-r border-black">单位</th>
              <th colspan="3" class="border-r border-black">合同量</th>
              <th colspan="3" class="border-r border-black">复核量</th>
              <th colspan="8" class="border-r border-black">本月完成数</th>
              <th colspan="2" class="border-r border-black">本年完成工程量</th>
              <th colspan="3" class="border-r border-black">累计完成数</th>
              <th rowspan="3" class="w-20">备注</th>
            </tr>
            <tr class="font-bold border-b border-black">
              <th rowspan="2" class="w-16 border-r border-black">单价</th>
              <th rowspan="2" class="w-16 border-r border-black">数量</th>
              <th rowspan="2" class="w-20 border-r border-black">合同价</th>
              <th rowspan="2" class="w-16 border-r border-black">单价</th>
              <th rowspan="2" class="w-16 border-r border-black">数量</th>
              <th rowspan="2" class="w-20 border-r border-black">合价</th>
              <th colspan="2" class="border-r border-black">施工单位</th>
              <th colspan="2" class="border-r border-black">施工监理</th>
              <th colspan="2" class="border-r border-black">现场指挥部</th>
              <th colspan="2" class="border-r border-black">投资监理</th>
              <th rowspan="2" class="w-16 border-r border-black">数量</th>
              <th rowspan="2" class="w-20 border-r border-black">金额 (元)</th>
              <th rowspan="2" class="w-16 border-r border-black">数量</th>
              <th rowspan="2" class="w-20 border-r border-black">累计完成工作量</th>
              <th rowspan="2" class="border-r border-black">合同累计完成比例%</th>
            </tr>
            <tr class="font-bold border-b border-black">
              <th class="w-16 border-r border-black">数量</th>
              <th class="w-20 border-r border-black">金额 (元)</th>
              <th class="w-16 border-r border-black">数量</th>
              <th class="w-20 border-r border-black">金额 (元)</th>
              <th class="w-16 border-r border-black">数量</th>
              <th class="w-20 border-r border-black">金额 (元)</th>
              <th class="w-16 border-r border-black">数量</th>
              <th class="w-20 border-r border-black">金额 (元)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in printDetailRows" :key="row.boqItemId" class="border-b border-black" :class="{ 'font-medium bg-gray-50': row.isSummaryRow }">
              <td class="text-center font-mono border-r border-black">{{ row.boqCode }}</td>
              <td class="text-left border-r border-black pl-1">
                <div :style="{ paddingLeft: Math.max(0, row.boqDepth - 1) * 8 + 'px' }">
                  {{ row.boqName }}
                </div>
              </td>
              <td class="text-center border-r border-black">{{ row.uom || '-' }}</td>
              
              <!-- 合同量 -->
              <td class="text-right font-mono border-r border-black">{{ !row.isSummaryRow ? formatMoney(row.price) : '-' }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatQty(row.pendingTotalQty) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(row.contractAmount) }}</td>
              
              <!-- 复核量 -->
              <td class="text-right font-mono border-r border-black">{{ !row.isSummaryRow ? formatMoney(row.price) : '-' }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatQty(row.pendingTotalQty) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(row.contractAmount) }}</td>
              
              <!-- 本月完成数 -->
              <!-- 施工单位 -->
              <td class="text-right font-mono border-r border-black">{{ formatQty(row.contractorQty) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(row.contractorAmount) }}</td>
              <!-- 施工监理 -->
              <td class="text-right font-mono border-r border-black">{{ formatQty(row.supervisionQty) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(row.supervisionAmount) }}</td>
              <!-- 现场指挥部 -->
              <td class="text-right font-mono border-r border-black">{{ formatQty(row.headquartersQty) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(row.headquartersAmount) }}</td>
              <!-- 投资监理 -->
              <td class="text-right font-mono border-r border-black">{{ formatQty(row.investmentQty) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(row.investmentAmount) }}</td>
              
              <!-- 本年完成工程量 -->
              <td class="text-right font-mono border-r border-black">{{ formatQty((row.yearlyCumulativeQty || 0) + (row.investmentQty || 0)) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(row.yearlyAmount) }}</td>
              
              <!-- 累计完成数 -->
              <td class="text-right font-mono border-r border-black">{{ formatQty((row.lastCumulativeQty || 0) + (row.investmentQty || 0)) }}</td>
              <td class="text-right font-mono border-r border-black text-success-darker">{{ formatMoney(row.cumulativeAmount) }}</td>
              <td class="text-right font-mono border-r border-black">{{ getCumulativeRate(row) }}%</td>
              
              <td class="text-center">{{ row.remark || '-' }}</td>
            </tr>
            <!-- 合计行 -->
            <tr v-if="printDetailRoot" class="font-bold border-b border-black bg-gray-100">
              <td class="text-center border-r border-black">合计</td>
              <td class="text-left border-r border-black pl-3">{{ printDetailRoot.boqName }}</td>
              <td class="text-center border-r border-black">-</td>
              <!-- 合同量 -->
              <td class="text-right border-r border-black">-</td>
              <td class="text-right font-mono border-r border-black">{{ formatQty(printDetailRoot.pendingTotalQty) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(printDetailRoot.contractAmount) }}</td>
              <!-- 复核量 -->
              <td class="text-right border-r border-black">-</td>
              <td class="text-right font-mono border-r border-black">{{ formatQty(printDetailRoot.pendingTotalQty) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(printDetailRoot.contractAmount) }}</td>
              <!-- 本月完成数 -->
              <!-- 施工单位 -->
              <td class="text-right font-mono border-r border-black">{{ formatQty(printDetailRoot.contractorQty) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(printDetailRoot.contractorAmount) }}</td>
              <!-- 施工监理 -->
              <td class="text-right font-mono border-r border-black">{{ formatQty(printDetailRoot.supervisionQty) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(printDetailRoot.supervisionAmount) }}</td>
              <!-- 现场指挥部 -->
              <td class="text-right font-mono border-r border-black">{{ formatQty(printDetailRoot.headquartersQty) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(printDetailRoot.headquartersAmount) }}</td>
              <!-- 投资监理 -->
              <td class="text-right font-mono border-r border-black">{{ formatQty(printDetailRoot.investmentQty) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(printDetailRoot.investmentAmount) }}</td>
              <!-- 本年完成工程量 -->
              <td class="text-right font-mono border-r border-black">{{ formatQty((printDetailRoot.yearlyCumulativeQty || 0) + (printDetailRoot.investmentQty || 0)) }}</td>
              <td class="text-right font-mono border-r border-black">{{ formatMoney(printDetailRoot.yearlyAmount) }}</td>
              <!-- 累计完成数 -->
              <td class="text-right font-mono border-r border-black">{{ formatQty((printDetailRoot.lastCumulativeQty || 0) + (printDetailRoot.investmentQty || 0)) }}</td>
              <td class="text-right font-mono border-r border-black text-success-darker">{{ formatMoney(printDetailRoot.cumulativeAmount) }}</td>
              <td class="text-right font-mono border-r border-black">{{ getCumulativeRate(printDetailRoot) }}%</td>
              <td class="text-center">-</td>
            </tr>
          </tbody>
        </table>

        <!-- 四方盖章意见 -->
        <div class="grid grid-cols-4 gap-4 mt-8 print-opinions">
          <div class="border border-black p-3 rounded space-y-2 text-xs flex flex-col justify-between h-36">
            <div class="font-bold">施工监理意见：</div>
            <div class="italic flex-grow">{{ acceptanceDetails.supervisionOpinion || '' }}</div>
            <div class="text-[10px]">
              <div>经办人：{{ getAcceptanceAuditUser('supervision') }}</div>
              <div>日&nbsp;&nbsp;期：{{ getAcceptanceOperatorDate('施工监理经办人') || formatDate(acceptanceDetails.supervisionDate) }}</div>
            </div>
          </div>
          <div class="border border-black p-3 rounded space-y-2 text-xs flex flex-col justify-between h-36">
            <div class="font-bold">现场指挥部意见：</div>
            <div class="italic flex-grow">{{ acceptanceDetails.headquartersOpinion || '' }}</div>
            <div class="text-[10px]">
              <div>经办人：{{ getAcceptanceAuditUser('headquarters') }}</div>
              <div>日&nbsp;&nbsp;期：{{ getAcceptanceOperatorDate('现场指挥部经办人') || formatDate(acceptanceDetails.headquartersDate) }}</div>
            </div>
          </div>
          <div class="border border-black p-3 rounded space-y-2 text-xs flex flex-col justify-between h-36">
            <div class="font-bold">投资监理意见：</div>
            <div class="italic flex-grow">{{ acceptanceDetails.investmentOpinion || '' }}</div>
            <div class="text-[10px]">
              <div>经办人：{{ getAcceptanceAuditUser('investment') }}</div>
              <div>日&nbsp;&nbsp;期：{{ getAcceptanceOperatorDate('投资监理经办人') || formatDate(acceptanceDetails.investmentDate) }}</div>
            </div>
          </div>
          <div class="border border-black p-3 rounded space-y-2 text-xs flex flex-col justify-between h-36">
            <div class="font-bold">合约部管理意见：</div>
            <div class="italic flex-grow">{{ acceptanceDetails.ownerOpinion || '' }}</div>
            <div class="text-[10px]">
              <div>经办人：{{ getAcceptanceAuditUser('owner') }}</div>
              <div>日&nbsp;&nbsp;期：{{ getAcceptanceOperatorDate('合约管理部经办人') || formatDate(acceptanceDetails.ownerDate) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { PaperClipIcon } from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import { useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import { FormButton, LayoutDialog, FormSelectBase } from '@speckle/ui-components'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { projectQualityAcceptanceFormsQuery } from '~/lib/projects/graphql/queries'
import {
  getMonthlyMeasurementAuditDisplayStatus,
  getMonthlyMeasurementPermissions
} from '~/lib/projects/helpers/monthlyMeasurementApproval'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { useFileDownload } from '~~/lib/core/composables/fileUpload'

type MonthlyMeasurementNode = {
  id: string
  code: string
  baseDate: string
  approveStatus?: string | null
  flowInstanceId?: string | null
  currentStepName?: string | null
  currentStepApprovers?: string[] | null
  unit?: string | null
  roundName?: string | null
  flowInitiator?: {
    id: string
    name: string
  } | null
  createdAt?: string | number | null
  creator?: {
    id: string
    name: string
  } | null
}

const props = defineProps<{
  item: MonthlyMeasurementNode | null
  projectId: string
  flowInstance?: any
}>()

const emit = defineEmits(['refetch'])
const apiOrigin = useApiOrigin()
const { userId } = useActiveUser()
const { triggerNotification } = useGlobalToast()
const { download: downloadBlobWithAuth } = useFileDownload()

const deleteConfirmOpen = ref(false)
const deleteTargetIdx = ref<number | null>(null)
const deletingAttachment = ref(false)

const currentStepName = computed(() => {
  if (!props.flowInstance) return ''
  const pendingStep = props.flowInstance.steps?.find((s: any) => s.status === 'PENDING')
  return pendingStep ? (pendingStep.name || '').trim() : ''
})

const flowInitiatorName = computed(() => {
  return (
    props.item?.flowInitiator?.name ||
    props.flowInstance?.actions?.find((a: any) => a.action === 'STARTED')?.actor
      ?.name ||
    props.item?.creator?.name ||
    ''
  )
})

const flowInitiatorDate = computed(() => {
  const startedAction = props.flowInstance?.actions?.find((a: any) => a.action === 'STARTED')
  const dateVal = startedAction?.createdAt || props.item?.createdAt
  if (!dateVal) return '-'
  const ts = Number(dateVal)
  if (!Number.isNaN(ts) && ts > 0) {
    return dayjs(ts).format('YYYY-MM-DD')
  }
  const parsed = dayjs(String(dateVal))
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '-'
})

// 数据缓存
const aggregatedItems = ref<any[]>([])
const acceptanceSummary = ref({ current: 0, cumulative: 0, contract: 0 })

const sumAggregatedRows = (rows: any[]) => {
  let contractAmount = 0
  let contractorAmount = 0
  let supervisionAmount = 0
  let headquartersAmount = 0
  let investmentAmount = 0
  let yearlyAmount = 0
  let cumulativeAmount = 0

  for (const row of rows) {
    contractAmount += Number(row.contractAmount || 0)
    contractorAmount += Number(row.contractorAmount || 0)
    supervisionAmount += Number(row.supervisionAmount || 0)
    headquartersAmount += Number(row.headquartersAmount || 0)
    investmentAmount += Number(row.investmentAmount || 0)
    yearlyAmount += Number(row.yearlyAmount || 0)
    cumulativeAmount += Number(row.cumulativeAmount || 0)
  }

  return {
    contractAmount,
    contractorAmount,
    supervisionAmount,
    headquartersAmount,
    investmentAmount,
    yearlyAmount,
    cumulativeAmount,
    cumulativeRate:
      contractAmount > 0
        ? Math.round((cumulativeAmount / contractAmount) * 10000) / 100
        : 0
  }
}

const acceptanceGroups = computed(() => {
  const groups = new Map<
    string,
    {
      groupKey: string
      groupBoqCode: string
      groupBoqName: string
      rows: Array<any>
      subtotal: ReturnType<typeof sumAggregatedRows>
    }
  >()

  let displayIndex = 1
  for (const row of aggregatedItems.value) {
    const groupKey = row.groupBoqItemId || row.boqParentId || row.boqItemId
    const groupBoqCode = row.groupBoqCode || row.boqCode || '-'
    const groupBoqName = row.groupBoqName || row.boqName || '未分类'
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        groupKey,
        groupBoqCode,
        groupBoqName,
        rows: [],
        subtotal: sumAggregatedRows([])
      })
    }
    groups.get(groupKey)!.rows.push({
      ...row,
      displayIndex
    })
    displayIndex += 1
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    subtotal: sumAggregatedRows(group.rows)
  }))
})

// 查询项目信息（用于显示元数据大标题）
const { result: projectResult } = useQuery(
  gql`
    query ProjectNameForAcceptance($id: String!) {
      project(id: $id) {
        id
        name
        contractName
        contractCode
      }
    }
  `,
  () => ({
    id: props.projectId
  })
)
const contractName = computed(() => {
  const contract = projectResult.value?.project?.contractName
  if (contract && contract.trim().length) return contract
  return projectResult.value?.project?.name || '项目合同'
})
const projectContractCode = computed(() => {
  const code = projectResult.value?.project?.contractCode
  if (code && code.trim().length) return code
  return '-'
})

const totalSums = computed(() => {
  return sumAggregatedRows(aggregatedItems.value)
})

// Tab 1 签署意见数据
const acceptanceDetails = ref<any>({
  measurementId: '',
  acceptanceAttachments: [],
  supervisionOpinion: '',
  supervisionAuditor: '',
  supervisionDateStr: '',
  headquartersOpinion: '',
  headquartersAuditor: '',
  headquartersDateStr: '',
  investmentOpinion: '',
  investmentAuditor: '',
  investmentDateStr: '',
  ownerOpinion: '',
  ownerAuditor: '',
  ownerDateStr: ''
})
const acceptanceSaving = ref(false)

// 弹出层管理
const attachmentsDialogOpen = ref(false)
const modelViewerOpen = ref(false)

const route = useRoute()
const isReadOnly = computed(() => route.query.mode !== 'edit')

const permissions = computed(() => {
  const result = {
    contractor: false,
    supervision: false,
    headquarters: false,
    investment: false,
    contract: false,
    leader: false,
    owner: false
  }

  if (isReadOnly.value) return result

  const isDraft = !props.item?.approveStatus || props.item?.approveStatus === 'START'
  const currentUserId = userId.value

  if (!currentUserId) return result

  if (isDraft) {
    const creatorId = props.item?.creator?.id
    if (creatorId === currentUserId) {
      result.contractor = true
    }
    return result
  }

  if (props.flowInstance && props.flowInstance.status === 'PENDING') {
    const pendingStep = props.flowInstance.steps?.find(
      (s: any) => s.status === 'PENDING'
    )
    if (pendingStep) {
      const stepName = (pendingStep.name || '').trim()
      const approverIds = pendingStep.approverIds || []

      if (approverIds.includes(currentUserId)) {
        const isStep = (names: string[]) => names.includes(stepName)

        if (isStep(['施工单位'])) result.contractor = true
        if (isStep(['施工监理经办人', '施工监理总监', '施工监理', '监理', '专业监理']))
          result.supervision = true
        if (isStep(['现场指挥部经办人', '现场指挥', '现场指挥部', '指挥部']))
          result.headquarters = true
        if (isStep(['投资监理经办人', '投资监理总监', '投资监理']))
          result.investment = true
        if (
          isStep([
            '合约管理部经办人',
            '合约管理部负责人',
            '计划合同部',
            '合约部',
            '合约管理部'
          ])
        )
          result.contract = true
        if (isStep(['分管领导'])) result.leader = true
        if (
          isStep(['合约管理部负责人', '分管领导', '计划合同部', '合约部', '合约管理部'])
        )
          result.owner = true
      }
    }
  }

  return result
})

const isCurrentApprover = computed(() => {
  if (isReadOnly.value) return false
  const isDraft = !props.item?.approveStatus || props.item?.approveStatus === 'START'
  const currentUserId = userId.value
  if (!currentUserId) return false

  if (isDraft) {
    const creatorId = props.item?.creator?.id
    return creatorId === currentUserId
  }

  if (props.flowInstance && props.flowInstance.status === 'PENDING') {
    const pendingStep = props.flowInstance.steps?.find(
      (s: any) => s.status === 'PENDING'
    )
    if (pendingStep) {
      const approverIds = pendingStep.approverIds || []
      return approverIds.includes(currentUserId)
    }
  }

  return false
})

const acceptanceAuditStepMap = {
  supervision: ['施工监理经办人', '施工监理总监'],
  headquarters: ['现场指挥部经办人', '现场指挥'],
  investment: ['投资监理经办人', '投资监理总监'],
  owner: ['合约管理部经办人', '合约管理部负责人', '分管领导']
} as const

type AcceptanceAuditKey = keyof typeof acceptanceAuditStepMap

const getAuditUserDisplay = (stepNames: readonly string[]) => {
  if (!props.flowInstance) return ''
  const steps = props.flowInstance.steps || []
  const actions = props.flowInstance.actions || []

  const matchingSteps = steps.filter((s: any) =>
    stepNames.map((n) => n.trim()).includes(s.name?.trim())
  )

  const names: string[] = []
  for (const s of matchingSteps) {
    if (s.status === 'APPROVED' || s.status === 'REJECTED') {
      const action = actions.find(
        (a: any) =>
          a.stepId === s.id &&
          (a.action === 'APPROVED' ||
            a.action === 'STEP_APPROVED' ||
            a.action === 'REJECTED')
      )
      if (action && action.actor?.name) {
        names.push(action.actor.name)
      } else if (s.approvers && s.approvers.length > 0) {
        names.push(...s.approvers.map((u: any) => u.name).filter(Boolean))
      }
    }
  }

  const uniqueNames = Array.from(new Set(names))
  return uniqueNames.join('、') || '\u00A0'
}

const getAcceptanceAuditUser = (key: AcceptanceAuditKey) => {
  return getAuditUserDisplay(acceptanceAuditStepMap[key])
}

const getAcceptanceOperatorDate = (stepName: string) => {
  if (!props.flowInstance) return ''
  const steps = props.flowInstance.steps || []
  const step = steps.find((s: any) => s.name?.trim() === stepName.trim())
  if (step && step.status === 'APPROVED' && step.completedAt) {
    const parsed = dayjs(step.completedAt)
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
  }
  return ''
}

const getAcceptanceAuditDate = (value: string | null | undefined) => {
  if (!value) return '-'
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '-'
}

// 载入聚合工程列表数据
const loadAggregatedItems = async () => {
  if (!props.item?.id || !props.projectId) return
  try {
    const items = await $fetch<any[]>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/aggregated-items?level=section`
    )
    aggregatedItems.value = items

    let current = 0
    let cumulative = 0
    let contract = 0
    for (const row of items) {
      current += row.investmentAmount || 0
      cumulative += row.cumulativeAmount || 0
      contract += row.contractAmount || 0
    }
    acceptanceSummary.value = { current, cumulative, contract }
  } catch {
    aggregatedItems.value = []
  }
}

// 载入 Tab 1 意见及附件数据
const loadTab1Data = async () => {
  if (!props.item?.id || !props.projectId) return
  try {
    const data = await $fetch<any>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/acceptance`
    )

    // 初始化日期选择器格式，将大整数/字符串转化为 YYYY-MM-DD
    const formatDateForInput = (d: any) => {
      if (!d) return ''
      const ts = Number(d)
      if (!Number.isNaN(ts) && ts > 0) {
        return dayjs(ts).isValid() ? dayjs(ts).format('YYYY-MM-DD') : ''
      }
      const parsed = dayjs(String(d))
      return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
    }

    acceptanceDetails.value = {
      ...data,
      acceptanceAttachments: data.acceptanceAttachments || [],
      supervisionDateStr: formatDateForInput(data.supervisionDate),
      headquartersDateStr: formatDateForInput(data.headquartersDate),
      investmentDateStr: formatDateForInput(data.investmentDate),
      ownerDateStr: formatDateForInput(data.ownerDate)
    }
  } catch {
    // 默认空结构
  }
}

const saveTab1Acceptance = async () => {
  if (!props.item?.id || !props.projectId) return
  acceptanceSaving.value = true

  try {
    await $fetch(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/acceptance`,
      {
        method: 'PATCH',
        body: {
          supervisionOpinion: acceptanceDetails.value.supervisionOpinion,
          headquartersOpinion: acceptanceDetails.value.headquartersOpinion,
          investmentOpinion: acceptanceDetails.value.investmentOpinion,
          ownerOpinion: acceptanceDetails.value.ownerOpinion,
          acceptanceAttachments: acceptanceDetails.value.acceptanceAttachments
        }
      }
    )
    await loadTab1Data()
    emit('refetch')
    triggerNotification({
      title: '保存成功',
      description: '保存成功！',
      type: ToastNotificationType.Success
    })
  } catch (err: any) {
    triggerNotification({
      title: '保存失败',
      description: err.data?.error || '保存失败',
      type: ToastNotificationType.Danger
    })
  } finally {
    acceptanceSaving.value = false
  }
}

const openAttachmentsDialog = () => {
  attachmentsDialogOpen.value = true
}

const acceptanceFileRef = ref<HTMLInputElement | null>(null)
const triggerAcceptanceUpload = () => {
  acceptanceFileRef.value?.click()
}
const handleAcceptanceFileUpload = async (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (!files?.length) return
  try {
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      const res = await $fetch<any>(`${apiOrigin}/api/stream/${props.projectId}/blob`, {
        method: 'POST',
        body: formData
      })
      const uploadResults = res?.uploadResults || []
      const result = uploadResults.find((r: any) => r.formKey === 'file')
      const blobId = result?.blobId
      if (blobId) {
        const list = acceptanceDetails.value.acceptanceAttachments || []
        list.push({ blobId, name: file.name })
        acceptanceDetails.value.acceptanceAttachments = [...list]
      } else {
        throw new Error('未获取到文件标识')
      }
    }
    await saveTab1Acceptance()
  } catch (err) {
    triggerNotification({
      title: '文件上传失败',
      description: '文件上传失败：' + err,
      type: ToastNotificationType.Danger
    })
  }
}
const removeAcceptanceAttachment = (idx: number) => {
  deleteTargetIdx.value = idx
  deleteConfirmOpen.value = true
}

const executeDeleteAttachment = async () => {
  if (deleteTargetIdx.value === null) return
  deletingAttachment.value = true
  try {
    const list = [...(acceptanceDetails.value.acceptanceAttachments || [])]
    list.splice(deleteTargetIdx.value, 1)
    acceptanceDetails.value.acceptanceAttachments = list
    await saveTab1Acceptance()
  } finally {
    deletingAttachment.value = false
    deleteConfirmOpen.value = false
    deleteTargetIdx.value = null
  }
}

// -------------------------------------------------------------
// 三维模型构件 ID 解析及查询加载
// -------------------------------------------------------------
const previewSourceAcceptanceIds = computed(() => {
  const ids = new Set<string>()
  aggregatedItems.value.forEach((row) => {
    ;(row.sourceAcceptanceIds || []).forEach((id: string) => ids.add(id))
  })
  return Array.from(ids)
})

const { result: acceptanceFormsResult, loading: acceptanceFormsLoading } = useQuery(
  projectQualityAcceptanceFormsQuery,
  () => ({
    projectId: props.projectId,
    search: null,
    cursor: null,
    limit: 500
  }),
  {
    enabled: computed(
      () =>
        !!props.projectId &&
        modelViewerOpen.value &&
        previewSourceAcceptanceIds.value.length > 0
    )
  }
)

const selectedPreviewModelIds = computed(() => {
  const selectedIds = new Set(previewSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: any) => {
      if (!form || !selectedIds.has(form.id)) return
      const BIM = form.BIM || []
      BIM.forEach((entry: any) => {
        if (entry.modelId) ids.add(entry.modelId)
      })
    }
  )
  return Array.from(ids)
})

const selectedPreviewBimIds = computed(() => {
  const selectedIds = new Set(previewSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: any) => {
      if (!form || !selectedIds.has(form.id)) return
      const BIM = form.BIM || []
      BIM.forEach((entry: any) => {
        ;(entry.bimIds || []).forEach((id: any) => {
          if (typeof id === 'string' && id) ids.add(id)
        })
      })
    }
  )
  return Array.from(ids)
})

const selectedPreviewApplicationIds = computed(() => {
  const selectedIds = new Set(previewSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: any) => {
      if (!form || !selectedIds.has(form.id)) return
      const BIM = form.BIM || []
      BIM.forEach((entry: any) => {
        ;(entry.applicationIds || []).forEach((id: any) => {
          if (typeof id === 'string' && id) ids.add(id)
        })
      })
    }
  )
  return Array.from(ids)
})

const openModelViewer = () => {
  modelViewerOpen.value = true
}

// 明细清单录入导航跳转入口
const openTreeEdit = (
  boqItemId: string | null = null,
  boqName: string = '全部章节'
) => {
  navigateTo({
    path: `/projects/${props.projectId}/work-valuation/monthly-measurement/${props.item?.id}/acceptance-edit`,
    query: {
      boqItemId: boqItemId || '',
      boqName: boqName || '',
      mode: route.query.mode || ''
    }
  })
}

const goBackToList = () => {
  navigateTo(`/projects/${props.projectId}/work-valuation/monthly-measurement`)
}

// -------------------------------------------------------------
// 通用辅助方法
// -------------------------------------------------------------
const getBlobDownloadUrl = (blobId: string) => {
  return `${apiOrigin}/api/stream/${props.projectId}/blob/${blobId}`
}

const formatMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '0.00'
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatDate = (value: any) => {
  if (!value) return '-'
  const ts = Number(value)
  if (!Number.isNaN(ts) && ts > 0) {
    return dayjs(ts).format('YYYY-MM-DD')
  }
  return dayjs(String(value)).format('YYYY-MM-DD')
}

const formatDateMonth = (value: any) => {
  if (!value) return '-'
  const ts = Number(value)
  if (!Number.isNaN(ts) && ts > 0) {
    return dayjs(ts).format('YYYY年MM月')
  }
  return dayjs(String(value)).format('YYYY年MM月')
}

const formatQty = (value: any) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (isNaN(num)) return '-'
  if (Number.isInteger(num)) return `${num}`
  return num.toFixed(2)
}

// 安全文明措施关联相关变量与方法
const safetyMeasureDialogOpen = ref(false)
const safetyMeasureConfirmDialogOpen = ref(false)
const availableSafetyMeasures = ref<any[]>([])
const selectedSafetyMeasureId = ref<string | null>(null)
const safetyMeasureSaving = ref(false)
const safetyMeasureConfirmDialogTitle = ref('')
const safetyMeasureConfirmDialogText = ref('')

const selectOptions = computed(() => {
  const list = availableSafetyMeasures.value.map((m) => ({
    id: m.id,
    label: formatMeasureLabel(m)
  }))
  return [{ id: 'none', label: '不关联' }, ...list]
})

const selectedMeasureValue = computed({
  get: () => {
    const id = selectedSafetyMeasureId.value
    if (!id) return { id: 'none', label: '不关联' }
    const found = availableSafetyMeasures.value.find((m) => m.id === id)
    return found ? { id: found.id, label: formatMeasureLabel(found) } : { id: 'none', label: '不关联' }
  },
  set: (val: any) => {
    selectedSafetyMeasureId.value = val?.id === 'none' ? null : val?.id
  }
})

const openSafetyMeasureDialog = async () => {
  if (!props.projectId || !props.item?.id) return
  selectedSafetyMeasureId.value = (props.item as any).safetyMeasureId || null
  safetyMeasureDialogOpen.value = true

  const apiOrigin = useApiOrigin()
  try {
    const res = await $fetch<any>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/safety-measures`,
      {
        params: {
          unoccupied: 'true',
          excludeMeasurementId: props.item.id
        }
      }
    )
    availableSafetyMeasures.value = res.items || []
  } catch (err) {
    console.error('拉取安全文明措施费失败', err)
  }
}

const formatMeasureLabel = (measure: any) => {
  if (!measure?.baseDate) return ''
  const dateStr = dayjs(Number(measure.baseDate)).format('YYYY-MM')
  const round = measure.roundName || '1'
  return `${dateStr} 第${round}期`
}

const handleAssociateSafetyMeasure = () => {
  const currentId = (props.item as any).safetyMeasureId || null
  const nextId = selectedSafetyMeasureId.value

  if (currentId === nextId) {
    safetyMeasureDialogOpen.value = false
    return
  }

  if (nextId) {
    safetyMeasureConfirmDialogTitle.value = '确认关联安全文明措施费'
    safetyMeasureConfirmDialogText.value = '关联安全文明措施费将覆盖本月度验工中对应的清单项工程量数据，是否确认？'
  } else {
    safetyMeasureConfirmDialogTitle.value = '确认取消关联安全文明措施费'
    safetyMeasureConfirmDialogText.value = '取消关联将还原清单项为默认 of 质量验收工程量，是否确认？'
  }
  safetyMeasureConfirmDialogOpen.value = true
}

const executeAssociateSafetyMeasure = async () => {
  if (!props.projectId || !props.item?.id) return
  safetyMeasureSaving.value = true
  const apiOrigin = useApiOrigin()
  try {
    await $fetch(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/associate-safety-measure`,
      {
        method: 'POST',
        body: {
          safetyMeasureId: selectedSafetyMeasureId.value
        }
      }
    )
    triggerNotification({
      title: '操作成功',
      description: '关联安全文明措施费已更新',
      type: ToastNotificationType.Success
    })
    safetyMeasureConfirmDialogOpen.value = false
    safetyMeasureDialogOpen.value = false
    emit('refetch')
    await loadAggregatedItems()
  } catch (err: any) {
    triggerNotification({
      title: '操作失败',
      description: err.data?.error || '操作失败',
      type: ToastNotificationType.Danger
    })
  } finally {
    safetyMeasureSaving.value = false
  }
}

watch(
  () => props.item?.id,
  () => {
    if (props.item?.id) {
      void loadAggregatedItems()
      void loadTab1Data()
    }
  },
  { immediate: true }
)

// -------------------------------------------------------------
// 打印相关变量及方法
// -------------------------------------------------------------
const printDetailDialogOpen = ref(false)
const selectedPrintGroupKeys = ref<string[]>([])
const printType = ref<'summary' | 'detail' | null>(null)
const printDetailRows = ref<any[]>([])
const printDetailRoot = ref<any | null>(null)
const isPrinting = ref(false)

const toggleGroupSelection = (key: string) => {
  const index = selectedPrintGroupKeys.value.indexOf(key)
  if (index > -1) {
    selectedPrintGroupKeys.value.splice(index, 1)
  } else {
    selectedPrintGroupKeys.value.push(key)
  }
}

const handlePrintSummary = async () => {
  printType.value = 'summary'
  isPrinting.value = true
  document.body.classList.add('is-printing')
  await nextTick()
  window.print()
}

const openPrintDetailDialog = () => {
  if (aggregatedItems.value.length > 0) {
    selectedPrintGroupKeys.value = [aggregatedItems.value[0].boqItemId]
  } else {
    selectedPrintGroupKeys.value = []
  }
  printDetailDialogOpen.value = true
}

const executePrintDetail = async () => {
  if (!props.item?.id || !props.projectId || !selectedPrintGroupKeys.value.length) return

  try {
    const list = await $fetch<any[]>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/detail-items`
    )

    const allSubtreeIds = new Set<string>()
    selectedPrintGroupKeys.value.forEach((rootId) => {
      const subtreeSet = getSubtreeItemIds(rootId, list)
      subtreeSet.forEach((id) => allSubtreeIds.add(id))
    })

    const filtered = list.filter((row) => allSubtreeIds.has(row.boqItemId))

    // 对该子树自底向上重算汇总
    const byId = new Map<string, any>()
    const depthMap = new Map<number, any[]>()
    filtered.forEach((row) => {
      row.contractorQty = row.contractorQty || 0
      row.supervisionQty = row.supervisionQty || 0
      row.headquartersQty = row.headquartersQty || 0
      row.investmentQty = row.investmentQty || 0
      row.measuredQtyDefault = row.measuredQtyDefault || 0
      row.lastCumulativeQty = row.lastCumulativeQty || 0
      row.yearlyCumulativeQty = row.yearlyCumulativeQty || 0
      row.pendingTotalQty = row.pendingTotalQty || 0

      if (row.isSummaryRow) {
        row.contractorQty = 0
        row.supervisionQty = 0
        row.headquartersQty = 0
        row.investmentQty = 0
        row.measuredQtyDefault = 0
        row.lastCumulativeQty = 0
        row.yearlyCumulativeQty = 0
        row.pendingTotalQty = 0

        // 汇总行金额初始化
        row.contractAmount = 0
        row.contractorAmount = 0
        row.supervisionAmount = 0
        row.headquartersAmount = 0
        row.investmentAmount = 0
        row.yearlyAmount = 0
        row.cumulativeAmount = 0
      } else {
        // 明明细行金额初始化
        const price = Number(row.price || 0)
        row.contractAmount = row.boqAmount !== undefined && row.boqAmount !== null ? Number(row.boqAmount) : (row.pendingTotalQty || 0) * price
        row.contractorAmount = (row.contractorQty || 0) * price
        row.supervisionAmount = (row.supervisionQty || 0) * price
        row.headquartersAmount = (row.headquartersQty || 0) * price
        row.investmentAmount = (row.investmentQty || 0) * price
        row.yearlyAmount = ((row.yearlyCumulativeQty || 0) + (row.investmentQty || 0)) * price
        row.cumulativeAmount = ((row.lastCumulativeQty || 0) + (row.investmentQty || 0)) * price
      }
      byId.set(row.boqItemId, row)
      const d = Number(row.boqDepth || 0)
      if (!depthMap.has(d)) depthMap.set(d, [])
      depthMap.get(d)!.push(row)
    })

    const depths = Array.from(depthMap.keys()).sort((a, b) => b - a)
    depths.forEach((depth) => {
      const rows = depthMap.get(depth) || []
      rows.forEach((row) => {
        if (!row.boqParentId) return
        const parent = byId.get(row.boqParentId)
        if (!parent || !parent.isSummaryRow) return
        parent.contractorQty = (parent.contractorQty || 0) + (row.contractorQty || 0)
        parent.supervisionQty = (parent.supervisionQty || 0) + (row.supervisionQty || 0)
        parent.headquartersQty = (parent.headquartersQty || 0) + (row.headquartersQty || 0)
        parent.investmentQty = (parent.investmentQty || 0) + (row.investmentQty || 0)
        parent.measuredQtyDefault = (parent.measuredQtyDefault || 0) + (row.measuredQtyDefault || 0)
        parent.lastCumulativeQty = (parent.lastCumulativeQty || 0) + (row.lastCumulativeQty || 0)
        parent.yearlyCumulativeQty = (parent.yearlyCumulativeQty || 0) + (row.yearlyCumulativeQty || 0)
        parent.pendingTotalQty = (parent.pendingTotalQty || 0) + (row.pendingTotalQty || 0)

        // 累加金额
        parent.contractAmount = (parent.contractAmount || 0) + (row.contractAmount || 0)
        parent.contractorAmount = (parent.contractorAmount || 0) + (row.contractorAmount || 0)
        parent.supervisionAmount = (parent.supervisionAmount || 0) + (row.supervisionAmount || 0)
        parent.headquartersAmount = (parent.headquartersAmount || 0) + (row.headquartersAmount || 0)
        parent.investmentAmount = (parent.investmentAmount || 0) + (row.investmentAmount || 0)
        parent.yearlyAmount = (parent.yearlyAmount || 0) + (row.yearlyAmount || 0)
        parent.cumulativeAmount = (parent.cumulativeAmount || 0) + (row.cumulativeAmount || 0)
      })
    })

    // 汇总这几个勾选的根节点的数据，生成虚拟“合计”行对象
    const sumRoot = {
      boqItemId: 'virtual-sum',
      boqCode: '合计',
      boqName: '选中章节合计',
      uom: '',
      price: 0,
      pendingTotalQty: 0,
      boqAmount: 0,
      contractorQty: 0,
      supervisionQty: 0,
      headquartersQty: 0,
      investmentQty: 0,
      measuredQtyDefault: 0,
      lastCumulativeQty: 0,
      yearlyCumulativeQty: 0,
      contractAmount: 0,
      contractorAmount: 0,
      supervisionAmount: 0,
      headquartersAmount: 0,
      investmentAmount: 0,
      yearlyAmount: 0,
      cumulativeAmount: 0
    }

    selectedPrintGroupKeys.value.forEach((rootId) => {
      const rootRow = byId.get(rootId)
      if (rootRow) {
        sumRoot.pendingTotalQty += (rootRow.pendingTotalQty || 0)
        sumRoot.boqAmount += (rootRow.boqAmount !== undefined && rootRow.boqAmount !== null ? rootRow.boqAmount : (rootRow.pendingTotalQty || 0) * (rootRow.price || 0))
        sumRoot.contractorQty += (rootRow.contractorQty || 0)
        sumRoot.supervisionQty += (rootRow.supervisionQty || 0)
        sumRoot.headquartersQty += (rootRow.headquartersQty || 0)
        sumRoot.investmentQty += (rootRow.investmentQty || 0)
        sumRoot.measuredQtyDefault += (rootRow.measuredQtyDefault || 0)
        sumRoot.lastCumulativeQty += (rootRow.lastCumulativeQty || 0)
        sumRoot.yearlyCumulativeQty += (rootRow.yearlyCumulativeQty || 0)

        sumRoot.contractAmount += (rootRow.contractAmount || 0)
        sumRoot.contractorAmount += (rootRow.contractorAmount || 0)
        sumRoot.supervisionAmount += (rootRow.supervisionAmount || 0)
        sumRoot.headquartersAmount += (rootRow.headquartersAmount || 0)
        sumRoot.investmentAmount += (rootRow.investmentAmount || 0)
        sumRoot.yearlyAmount += (rootRow.yearlyAmount || 0)
        sumRoot.cumulativeAmount += (rootRow.cumulativeAmount || 0)
      }
    })

    printDetailRows.value = filtered
    printDetailRoot.value = sumRoot
    printType.value = 'detail'
    printDetailDialogOpen.value = false

    // 延迟 300ms，等待弹窗淡出过渡动画完全执行完毕
    await new Promise((resolve) => setTimeout(resolve, 300))

    isPrinting.value = true
    document.body.classList.add('is-printing')
    await nextTick()
    window.print()
  } catch (err) {
    triggerNotification({
      title: '加载明细失败',
      description: '无法拉取清单明细，请重试',
      type: ToastNotificationType.Danger
    })
  }
}

const getSubtreeItemIds = (rootId: string, allItems: any[]): Set<string> => {
  const childMap = new Map<string, string[]>()
  allItems.forEach((item) => {
    if (item.boqParentId) {
      if (!childMap.has(item.boqParentId)) childMap.set(item.boqParentId, [])
      childMap.get(item.boqParentId)!.push(item.boqItemId)
    }
  })
  const subtreeIds = new Set<string>()
  const traverse = (id: string) => {
    subtreeIds.add(id)
    const children = childMap.get(id) || []
    children.forEach((cId) => traverse(cId))
  }
  traverse(rootId)
  return subtreeIds
}

const getCumulativeRate = (row: any) => {
  const contractQty = row.pendingTotalQty || 0
  if (contractQty <= 0) return '0.00'
  const cumulativeQty = (row.lastCumulativeQty || 0) + (row.investmentQty || 0)
  return ((cumulativeQty / contractQty) * 100).toFixed(2)
}

const handleAfterPrint = () => {
  isPrinting.value = false
  printType.value = null
  document.body.classList.remove('is-printing')
}

onMounted(() => {
  window.addEventListener('afterprint', handleAfterPrint)
})

onUnmounted(() => {
  window.removeEventListener('afterprint', handleAfterPrint)
})
</script>

<style scoped>
/* 微调日期输入框 */
:deep(input[type='date']) {
  font-size: 11px;
  padding: 3px 6px;
}
/* 给大标题增加 subtle animation */
.animate-pulse-once {
  animation: pulse-once 1.2s ease-out;
}
@keyframes pulse-once {
  0% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

/* 正常情况下隐藏打印专区 */
#print-section {
  display: none;
}

@media print {
  html, body {
    height: auto !important;
    overflow: visible !important;
  }
  
  /* 当处于打印状态时，隐藏 body 下除了打印区以外的所有直接子节点（包括 #__nuxt、弹窗遮罩及 Portal 节点） */
  body.is-printing > :not(#print-section) {
    display: none !important;
  }
  
  /* 让传送在 body 下的打印区可见 */
  body.is-printing #print-section {
    position: absolute;
    left: 0;
    top: 0;
    width: 100% !important;
    display: block !important;
    background-color: white !important;
    color: black !important;
  }
  
  /* 细黑实线表格 */
  .print-table {
    border: 1px solid #000 !important;
    border-collapse: collapse !important;
    width: 100% !important;
    color: #000 !important;
  }
  .print-table tr {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .print-table th, .print-table td {
    border: 1px solid #000 !important;
    padding: 3px 4px !important;
    font-size: 9px !important;
    line-height: 1.15 !important;
    color: #000 !important;
  }
  .print-table th {
    background-color: #f2f2f2 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    text-align: center !important;
    font-weight: bold !important;
  }
  /* 四方盖章网格排版 */
  .print-opinions {
    display: grid !important;
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    gap: 12px !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .print-opinions > div {
    border: 1px solid #000 !important;
    padding: 8px !important;
    background-color: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
</style>
