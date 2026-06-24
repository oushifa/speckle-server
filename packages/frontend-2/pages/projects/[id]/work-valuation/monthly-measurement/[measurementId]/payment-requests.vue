<template>
  <div
    class="relative bg-foundation p-6 rounded-lg border border-outline-3 shadow-sm w-full max-w-full overflow-hidden"
  >
    <div class="print-hidden">
      <!-- 顶部项目页眉和副标题 -->
      <div class="text-center space-y-1 mb-6">
        <h2 class="text-xs text-foreground-2 tracking-widest font-semibold">
          上海公路投资建设发展有限公司
        </h2>
        <h1 class="text-xl font-bold text-foreground tracking-wide mt-1">
          工程费用支付申请表
        </h1>
        <p class="text-[11px] text-foreground-2 mt-1">
          {{
            props.item?.baseDate
              ? dayjs(Number(props.item.baseDate)).format('YYYY年MM月')
              : '2020年12月'
          }}{{ props.item?.code || '第3期' }}
        </p>
      </div>

      <!-- 费用信息与基础元数据栏 -->
      <div class="space-y-3 pb-3 border-b border-outline-3 border-dashed mb-5">
        <div
          class="flex flex-wrap justify-between items-center text-xs text-foreground-2 gap-4"
        >
          <span>费用申请单位名称：上海建工集团股份有限公司</span>
          <span>单位：元</span>
        </div>

        <div
          class="flex flex-wrap justify-start items-center gap-6 text-xs text-foreground-2"
        >
          <span>合同编号：{{ projectContractCode }}</span>

          <div class="flex items-center gap-1.5">
            <span>上期末累计付款：</span>
            <input
              v-model.number="paymentRequest.lastCumulativePayment"
              type="number"
              disabled
              class="w-36 text-center text-xs bg-foundation border border-outline-3 rounded px-2.5 py-1 text-foreground-2 opacity-70 cursor-not-allowed font-mono"
            />
          </div>

          <div class="flex items-center gap-1.5">
            <span>合同金额：</span>
            <input
              v-model.number="paymentRequest.contractAmount"
              type="number"
              disabled
              class="w-40 text-center text-xs bg-foundation border border-outline-3 rounded px-2.5 py-1 text-foreground-2 opacity-70 cursor-not-allowed font-mono"
            />
          </div>
        </div>
      </div>

      <!-- 六方审批卡片网格（横向并排六列，自适应） -->
      <div class="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <!-- 1. 施工单位 -->
        <div
          class="border border-outline-3 rounded-lg bg-foundation p-3 space-y-3 flex flex-col justify-between shadow-sm min-h-[360px]"
        >
          <div class="space-y-2.5">
            <div class="space-y-1">
              <span class="text-[10px] text-foreground-2 block">本次申请支付</span>
              <input
                v-if="permissions.contractor"
                v-model.number="paymentRequest.contractorPayAmt"
                type="number"
                class="w-full text-center bg-foundation border border-outline-3 rounded text-xs py-1 font-mono focus:outline-none focus:border-primary"
              />
              <input
                v-else
                :value="
                  contractorState.isReached
                    ? formatMoney(paymentRequest.contractorPayAmt)
                    : '-'
                "
                type="text"
                disabled
                class="w-full text-center bg-foundation border border-outline-3 rounded text-xs py-1 font-mono focus:outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <div class="space-y-1">
              <span class="text-[10px] text-foreground-2 font-medium block">
                <span class="text-red-500 mr-0.5 font-bold">*</span>
                支付申请理由陈述
              </span>
              <textarea
                v-model="paymentRequest.reqContractorOpinion"
                placeholder="请输入陈述理由..."
                :disabled="!permissions.contractor"
                class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs h-32 focus:outline-none focus:border-primary disabled:opacity-60 resize-none"
              />
            </div>
          </div>
          <div class="space-y-2 pt-2 border-t border-outline-3 border-dashed">
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10">经办人</span>
              <input
                type="text"
                :value="flowInitiatorName"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center"
              />
            </div>
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10 text-nowrap">施工</span>
              <input
                type="text"
                :value="contractorManagerDisplay"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center"
              />
            </div>
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10">日期</span>
              <input
                :value="contractorDateDisplay"
                type="text"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center font-mono text-[10px]"
              />
            </div>
          </div>
        </div>

        <!-- 2. 施工监理 -->
        <div
          class="border border-outline-3 rounded-lg bg-foundation p-3 space-y-3 flex flex-col justify-between shadow-sm min-h-[360px]"
        >
          <div class="space-y-2.5">
            <div class="space-y-1">
              <span class="text-[10px] text-foreground-2 block">本次申请支付</span>
              <input
                v-if="permissions.supervision"
                v-model.number="paymentRequest.supervisionPayAmt"
                type="number"
                class="w-full text-center bg-foundation border border-outline-3 rounded text-xs py-1 font-mono focus:outline-none focus:border-primary"
              />
              <input
                v-else
                :value="
                  supervisionState.isReached
                    ? formatMoney(paymentRequest.supervisionPayAmt)
                    : '-'
                "
                type="text"
                disabled
                class="w-full text-center bg-foundation border border-outline-3 rounded text-xs py-1 font-mono focus:outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <div class="space-y-1">
              <span class="text-[10px] text-foreground-2 font-medium block">
                <span v-if="currentStepName === '施工监理总监'" class="text-red-500 mr-0.5 font-bold">*</span>
                施工监理意见
              </span>
              <textarea
                v-model="paymentRequest.reqSupervisionOpinion"
                placeholder="请输入监理意见..."
                :disabled="!permissions.supervision"
                class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs h-32 focus:outline-none focus:border-primary disabled:opacity-60 resize-none"
              />
            </div>
          </div>
          <div class="space-y-2 pt-2 border-t border-outline-3 border-dashed">
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10">经办人</span>
              <input
                type="text"
                :value="supervisionOperatorDisplay"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center"
              />
            </div>
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10 text-nowrap">总监</span>
              <input
                type="text"
                :value="supervisionAuditorModel"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center"
              />
            </div>
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10">日期</span>
              <input
                :value="supervisionDateDisplay"
                type="text"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center font-mono text-[10px]"
              />
            </div>
          </div>
        </div>

        <!-- 3. 现场指挥部 -->
        <div
          class="border border-outline-3 rounded-lg bg-foundation p-3 space-y-3 flex flex-col justify-between shadow-sm min-h-[360px]"
        >
          <div class="space-y-2.5">
            <div class="space-y-1">
              <span class="text-[10px] text-foreground-2 block">本次申请支付</span>
              <input
                v-if="permissions.headquarters"
                v-model.number="paymentRequest.headquartersPayAmt"
                type="number"
                class="w-full text-center bg-foundation border border-outline-3 rounded text-xs py-1 font-mono focus:outline-none focus:border-primary"
              />
              <input
                v-else
                :value="
                  headquartersState.isReached
                    ? formatMoney(paymentRequest.headquartersPayAmt)
                    : '-'
                "
                type="text"
                disabled
                class="w-full text-center bg-foundation border border-outline-3 rounded text-xs py-1 font-mono focus:outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <div class="space-y-1">
              <span class="text-[10px] text-foreground-2 font-medium block">
                <span v-if="currentStepName === '现场指挥'" class="text-red-500 mr-0.5 font-bold">*</span>
                现场指挥部意见
              </span>
              <textarea
                v-model="paymentRequest.reqHeadquartersOpinion"
                placeholder="请输入意见..."
                :disabled="!permissions.headquarters"
                class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs h-32 focus:outline-none focus:border-primary disabled:opacity-60 resize-none"
              />
            </div>
          </div>
          <div class="space-y-2 pt-2 border-t border-outline-3 border-dashed">
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10">经办人</span>
              <input
                type="text"
                :value="headquartersOperatorDisplay"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center"
              />
            </div>
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10 text-nowrap">现场指挥</span>
              <input
                type="text"
                :value="headquartersAuditorModel"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center text-[10px] font-semibold"
              />
            </div>
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10">日期</span>
              <input
                :value="headquartersDateDisplay"
                type="text"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center font-mono text-[10px]"
              />
            </div>
          </div>
        </div>

        <!-- 4. 投资监理 -->
        <div
          class="border border-outline-3 rounded-lg bg-foundation p-3 space-y-3 flex flex-col justify-between shadow-sm min-h-[360px]"
        >
          <div class="space-y-2.5">
            <div class="space-y-1">
              <span class="text-[10px] text-foreground-2 block">本次申请支付</span>
              <input
                v-if="permissions.investment"
                v-model.number="paymentRequest.investmentPayAmt"
                type="number"
                class="w-full text-center bg-foundation border border-outline-3 rounded text-xs py-1 font-mono focus:outline-none focus:border-primary"
              />
              <input
                v-else
                :value="
                  investmentState.isReached
                    ? formatMoney(paymentRequest.investmentPayAmt)
                    : '-'
                "
                type="text"
                disabled
                class="w-full text-center bg-foundation border border-outline-3 rounded text-xs py-1 font-mono focus:outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <div class="space-y-1">
              <span class="text-[10px] text-foreground-2 font-medium block">
                <span v-if="currentStepName === '投资监理总监'" class="text-red-500 mr-0.5 font-bold">*</span>
                投资监理意见
              </span>
              <textarea
                v-model="paymentRequest.reqInvestmentOpinion"
                placeholder="请输入投资监理意见..."
                :disabled="!permissions.investment"
                class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs h-32 focus:outline-none focus:border-primary disabled:opacity-60 resize-none text-[10px] leading-relaxed"
              />
            </div>
          </div>
          <div class="space-y-2 pt-2 border-t border-outline-3 border-dashed">
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10">经办人</span>
              <input
                type="text"
                :value="investmentOperatorDisplay"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center"
              />
            </div>
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10 text-nowrap">总监</span>
              <input
                type="text"
                :value="investmentAuditorModel"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center"
              />
            </div>
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10">日期</span>
              <input
                :value="investmentDateDisplay"
                type="text"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center font-mono text-[10px]"
              />
            </div>
          </div>
        </div>

        <!-- 5. 合约管理部 -->
        <div
          class="border border-outline-3 rounded-lg bg-foundation p-3 space-y-3 flex flex-col justify-between shadow-sm min-h-[360px]"
        >
          <div class="space-y-2.5">
            <div class="space-y-1">
              <span class="text-[10px] text-foreground-2 block">本次申请支付</span>
              <input
                v-if="permissions.contract"
                v-model.number="paymentRequest.contractPayAmt"
                type="number"
                class="w-full text-center bg-foundation border border-outline-3 rounded text-xs py-1 font-mono focus:outline-none focus:border-primary"
              />
              <input
                v-else
                :value="
                  contractState.isReached
                    ? formatMoney(paymentRequest.contractPayAmt)
                    : '-'
                "
                type="text"
                disabled
                class="w-full text-center bg-foundation border border-outline-3 rounded text-xs py-1 font-mono focus:outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <div class="space-y-1">
              <span class="text-[10px] text-foreground-2 font-medium block">
                <span v-if="currentStepName === '合约管理部负责人'" class="text-red-500 mr-0.5 font-bold">*</span>
                合约管理部意见
              </span>
              <textarea
                v-model="paymentRequest.reqContractOpinion"
                placeholder="请输入合约部意见..."
                :disabled="!permissions.contract"
                class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs h-32 focus:outline-none focus:border-primary disabled:opacity-60 resize-none text-[10px] leading-relaxed"
              />
            </div>
          </div>
          <div class="space-y-2 pt-2 border-t border-outline-3 border-dashed">
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10">经办人</span>
              <input
                type="text"
                :value="contractOperatorDisplay"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center"
              />
            </div>
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10 text-nowrap">负责人</span>
              <input
                type="text"
                :value="contractAuditorModel"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center"
              />
            </div>
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10">日期</span>
              <input
                :value="contractDateDisplay"
                type="text"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center font-mono text-[10px]"
              />
            </div>
          </div>
        </div>

        <!-- 6. 分管领导 -->
        <div
          class="border border-outline-3 rounded-lg bg-foundation p-3 space-y-3 flex flex-col justify-between shadow-sm min-h-[360px]"
        >
          <div class="space-y-2.5">
            <div class="space-y-1">
              <span class="text-[10px] text-foreground-2 block">本次申请支付</span>
              <input
                v-if="permissions.leader"
                v-model.number="paymentRequest.leaderPayAmt"
                type="number"
                class="w-full text-center bg-foundation border border-outline-3 rounded text-xs py-1 font-mono focus:outline-none focus:border-primary"
              />
              <input
                v-else
                :value="
                  leaderState.isReached ? formatMoney(paymentRequest.leaderPayAmt) : '-'
                "
                type="text"
                disabled
                class="w-full text-center bg-foundation border border-outline-3 rounded text-xs py-1 font-mono focus:outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <div class="space-y-1">
              <span class="text-[10px] text-foreground-2 font-medium block">
                <span v-if="currentStepName === '分管领导'" class="text-red-500 mr-0.5 font-bold">*</span>
                分管领导意见
              </span>
              <textarea
                v-model="paymentRequest.reqLeaderOpinion"
                placeholder="请输入领导审批..."
                :disabled="!permissions.leader"
                class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs h-32 focus:outline-none focus:border-primary disabled:opacity-60 resize-none text-[10px] leading-relaxed"
              />
            </div>
          </div>
          <div class="space-y-2 pt-2 border-t border-outline-3 border-dashed">
            <div class="flex items-center gap-1.5 text-xs text-foreground-2">
              <span class="shrink-0 w-10">&nbsp;</span>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10 text-[10px] text-nowrap">分管领导</span>
              <input
                type="text"
                :value="leaderAuditorModel"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center text-[11px]"
              />
            </div>
            <div class="flex items-center gap-1.5 text-xs text-foreground-2 overflow-hidden">
              <span class="shrink-0 w-10">日期</span>
              <input
                :value="leaderDateDisplay"
                type="text"
                disabled
                class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-1.5 py-0.5 opacity-65 cursor-not-allowed text-center font-mono text-[10px]"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 底部居中大控制按钮组 -->
      <div
        class="flex justify-center items-center gap-4 pt-4 border-t border-outline-3"
      >
        <button
          class="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors focus:outline-none shadow-sm"
          @click="triggerPrint('cover')"
        >
          <PrinterIcon class="h-3.5 w-3.5" />
          打印封面
        </button>

        <button
          v-if="isCurrentApprover"
          class="flex items-center gap-1.5 px-6 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 transition-colors focus:outline-none shadow-sm"
          :disabled="requestSaving"
          @click="saveTab3Request"
        >
          <ArrowDownTrayIcon class="h-3.5 w-3.5" />
          {{ requestSaving ? '正在保存...' : '保存' }}
        </button>

        <button
          class="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors focus:outline-none shadow-sm"
          @click="triggerPrint('payment')"
        >
          <PrinterIcon class="h-3.5 w-3.5" />
          打印申请表
        </button>

        <!-- 底部附件按钮，点击打开弹窗 -->
        <button
          class="flex items-center gap-1.5 px-4 py-1.5 border border-outline-3 text-xs font-semibold rounded hover:bg-foundation-2 bg-foundation text-foreground-2 transition-colors focus:outline-none"
          @click="openAttachmentsDialog"
        >
          <PaperClipIcon class="h-3.5 w-3.5" />
          附件 ({{ paymentRequest.requestAttachments?.length || 0 }})
        </button>
      </div>

      <!-- 附件管理弹出层 LayoutDialog -->
      <LayoutDialog
        v-model:open="attachmentsDialogOpen"
        max-width="md"
        :prevent-close-on-click-outside="deleteConfirmOpen"
      >
        <template #header>支付申请单附件管理</template>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-sm font-semibold">
              附件列表 ({{ paymentRequest.requestAttachments?.length || 0 }} 个)
            </span>
            <input
              ref="requestFileRef"
              type="file"
              class="hidden"
              multiple
              @change="handleRequestFileUpload"
            />
            <button
              v-if="isCurrentApprover"
              class="px-3 py-1.5 text-xs font-semibold text-white rounded bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none"
              @click="triggerRequestUpload"
            >
              上传新文件
            </button>
          </div>

          <div
            v-if="paymentRequest.requestAttachments?.length"
            class="space-y-2 max-h-[300px] overflow-y-auto pr-1"
          >
            <div
              v-for="(attachment, aIdx) in paymentRequest.requestAttachments"
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
                  @click="
                    downloadBlobWithAuth({
                      blobId: attachment.blobId,
                      fileName: attachment.name || attachment.blobId,
                      projectId: props.projectId
                    })
                  "
                >
                  下载
                </button>
                <button
                  v-if="isCurrentApprover"
                  class="text-danger hover:underline font-medium"
                  @click="removeRequestAttachment(Number(aIdx))"
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

      <LayoutDialog v-model:open="coverDialogOpen" max-width="xl">
        <template #header>验工计价封面</template>
        <div class="max-h-[80vh] overflow-auto p-4 bg-[#f9fafb]">
          <div class="print-cover-sheet">
            <div class="print-cover-title">验 工 月 报</div>

            <div class="print-cover-subtitle text-[#111]">
              {{ coverContractName }} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              {{ printPeriod }}
            </div>

            <div class="print-cover-grid">
              <div
                v-for="party in coverParties"
                :key="party.key"
                class="print-cover-col"
              >
                <div class="print-cover-row">
                  <div class="print-cover-label">本期计价：</div>
                  <div class="print-cover-val">
                    {{ formatMoney(getPartyAmounts(party.key).current) }}
                  </div>
                  <div class="print-cover-unit">元</div>
                </div>
                <div class="print-cover-row">
                  <div class="print-cover-label">本年累计价：</div>
                  <div class="print-cover-val">
                    {{ formatMoney(getPartyAmounts(party.key).yearly) }}
                  </div>
                  <div class="print-cover-unit">元</div>
                </div>
                <div class="print-cover-row">
                  <div class="print-cover-label">开工累计价：</div>
                  <div class="print-cover-val">
                    {{ formatMoney(getPartyAmounts(party.key).cumulative) }}
                  </div>
                  <div class="print-cover-unit">元</div>
                </div>
                <div class="print-cover-stamp">{{ party.label }}:(章)</div>
                <div class="print-cover-sign">
                  {{ party.roleLabel }}:{{ getPartySignInfo(party.key).name }}
                </div>
                <div class="print-cover-date">
                  日期:{{ getPartySignInfo(party.key).date }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </LayoutDialog>
    </div>

    <!-- 打印专属内容区域 (使用 Teleport 传送至 body 根节点，以彻底解决预览空白问题) -->
    <Teleport v-if="isPrinting" to="body">
      <div id="print-section" class="print-sheet">
        <!-- 1. 验工计价封面打印样式 -->
        <div v-if="printType === 'cover'" class="print-cover-sheet">
          <div class="print-cover-title">验 工 月 报</div>

          <div class="print-cover-subtitle text-[#111]">
            {{ coverContractName }} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            {{ printPeriod }}
          </div>

          <div class="print-cover-grid">
            <div v-for="party in coverParties" :key="party.key" class="print-cover-col">
              <div class="print-cover-row">
                <div class="print-cover-label">本期计价：</div>
                <div class="print-cover-val">
                  {{ formatMoney(getPartyAmounts(party.key).current) }}
                </div>
                <div class="print-cover-unit">元</div>
              </div>
              <div class="print-cover-row">
                <div class="print-cover-label">本年累计价：</div>
                <div class="print-cover-val">
                  {{ formatMoney(getPartyAmounts(party.key).yearly) }}
                </div>
                <div class="print-cover-unit">元</div>
              </div>
              <div class="print-cover-row">
                <div class="print-cover-label">开工累计价：</div>
                <div class="print-cover-val">
                  {{ formatMoney(getPartyAmounts(party.key).cumulative) }}
                </div>
                <div class="print-cover-unit">元</div>
              </div>
              <div class="print-cover-stamp">{{ party.label }}:(章)</div>
              <div class="print-cover-sign">
                {{ party.roleLabel }}:{{ getPartySignInfo(party.key).name }}
              </div>
              <div class="print-cover-date">
                日期:{{ getPartySignInfo(party.key).date }}
              </div>
            </div>
          </div>
        </div>

        <!-- 2. 工程费用支付申请表打印样式 -->
        <div v-else-if="printType === 'payment'" class="print-payment-container">
          <div class="print-title">工程费用支付申请表</div>
          <div class="print-subtitle">{{ printPeriod }}</div>

          <div class="flex justify-between items-center py-3 text-xs">
            <span>费用申请单位名称：{{ applicantUnitName }}</span>
            <span>{{ coverContractName }}</span>
            <span>单位：元</span>
          </div>

          <!-- <table class="print-table print-info-table">
            <tr>
              <td class="print-cell">合同编号：{{ projectContractCode }}</td>
              <td class="print-cell">
                上期末累计付款：{{ formatMoney(paymentRequest.lastCumulativePayment) }}
              </td>
              <td class="print-cell">
                合同金额：{{ formatMoney(paymentRequest.contractAmount) }}
              </td>
              <td class="print-cell">附件：{{ printAttachmentNames }}</td>
            </tr>
          </table> -->

          <table class="print-table print-main-table">
            <tr>
              <td class="print-cell">合同编号：{{ projectContractCode }}</td>
              <td class="print-cell">
                上期末累计付款：{{ formatMoney(paymentRequest.lastCumulativePayment) }}
              </td>
              <td class="print-cell">
                合同金额：{{ formatMoney(paymentRequest.contractAmount) }}
              </td>
              <td class="print-cell">附件：{{ printAttachmentNames }}</td>
            </tr>
            <tr>
              <th class="print-head" colspan="1" style="width: 16.66%">费用申请单位</th>
              <th class="print-head" colspan="5" style="width: 83.34%">费用审核单位</th>
            </tr>
            <tr>
              <td class="print-amount-cell">
                本次申请支付：{{
                  contractorState.isReached
                    ? formatMoney(paymentRequest.contractorPayAmt)
                    : '-'
                }}
              </td>
              <td class="print-amount-cell">
                本次申请支付：{{
                  supervisionState.isReached
                    ? formatMoney(paymentRequest.supervisionPayAmt)
                    : '-'
                }}
              </td>
              <td class="print-amount-cell">
                本次申请支付：{{
                  headquartersState.isReached
                    ? formatMoney(paymentRequest.headquartersPayAmt)
                    : '-'
                }}
              </td>
              <td class="print-amount-cell">
                本次申请支付：{{
                  investmentState.isReached
                    ? formatMoney(paymentRequest.investmentPayAmt)
                    : '-'
                }}
              </td>
              <td class="print-amount-cell">
                本次申请支付：{{
                  contractState.isReached
                    ? formatMoney(paymentRequest.contractPayAmt)
                    : '-'
                }}
              </td>
              <td class="print-amount-cell">
                本次申请支付：{{
                  leaderState.isReached ? formatMoney(paymentRequest.leaderPayAmt) : '-'
                }}
              </td>
            </tr>
            <tr>
              <td class="print-opinion-title">支付申请理由陈述:</td>
              <td class="print-opinion-title">施工监理意见：</td>
              <td class="print-opinion-title">现场指挥部意见：</td>
              <td class="print-opinion-title">投资监理意见：</td>
              <td class="print-opinion-title">计划合约部意见：</td>
              <td class="print-opinion-title">分管领导意见：</td>
            </tr>
            <tr>
              <td class="print-opinion-body">
                {{
                  contractorState.isReached
                    ? paymentRequest.reqContractorOpinion || ''
                    : ''
                }}
              </td>
              <td class="print-opinion-body">
                {{
                  supervisionState.isReached
                    ? paymentRequest.reqSupervisionOpinion || ''
                    : ''
                }}
              </td>
              <td class="print-opinion-body">
                {{
                  headquartersState.isReached
                    ? paymentRequest.reqHeadquartersOpinion || ''
                    : ''
                }}
              </td>
              <td class="print-opinion-body">
                {{
                  investmentState.isReached
                    ? paymentRequest.reqInvestmentOpinion || ''
                    : ''
                }}
              </td>
              <td class="print-opinion-body">
                {{
                  contractState.isReached ? paymentRequest.reqContractOpinion || '' : ''
                }}
              </td>
              <td class="print-opinion-body">
                {{ leaderState.isReached ? paymentRequest.reqLeaderOpinion || '' : '' }}
              </td>
            </tr>
            <tr>
              <td class="print-sign-cell">经办人：{{ flowInitiatorName }}</td>
              <td class="print-sign-cell">经办人：{{ supervisionOperatorDisplay }}</td>
              <td class="print-sign-cell">经办人：{{ headquartersOperatorDisplay }}</td>
              <td class="print-sign-cell">经办人：{{ investmentOperatorDisplay }}</td>
              <td class="print-sign-cell">经办人：{{ contractOperatorDisplay }}</td>
              <td class="print-sign-cell">经办人：-</td>
            </tr>
            <tr>
              <td class="print-sign-cell">项目经理：{{ contractorManagerDisplay }}</td>
              <td class="print-sign-cell">总监：{{ supervisionAuditorModel }}</td>
              <td class="print-sign-cell">现场指挥：{{ headquartersAuditorModel }}</td>
              <td class="print-sign-cell">总监：{{ investmentAuditorModel }}</td>
              <td class="print-sign-cell">负责人：{{ contractAuditorModel }}</td>
              <td class="print-sign-cell">分管领导：{{ leaderAuditorModel }}</td>
            </tr>
            <tr>
              <td class="print-sign-cell">日期：{{ contractorDateDisplay }}</td>
              <td class="print-sign-cell">日期：{{ supervisionDateDisplay }}</td>
              <td class="print-sign-cell">日期：{{ headquartersDateDisplay }}</td>
              <td class="print-sign-cell">日期：{{ investmentDateDisplay }}</td>
              <td class="print-sign-cell">日期：{{ contractDateDisplay }}</td>
              <td class="print-sign-cell">日期：{{ leaderDateDisplay }}</td>
            </tr>
          </table>
        </div>
      </div>
    </Teleport>
    <!-- 删除附件二次确认弹窗 -->
    <CommonConfirmDialog
      v-model:open="deleteConfirmOpen"
      title="确认删除附件"
      text="您确定要删除该附件吗？此操作无法撤销。"
      confirm-text="确认删除"
      :loading="deletingAttachment"
      @confirm="executeDeleteAttachment"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from 'vue'
import {
  PaperClipIcon,
  ArrowDownTrayIcon,
  PrinterIcon
} from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import { useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import { LayoutDialog } from '@speckle/ui-components'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
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
  flowInitiator?: {
    id: string
    name: string
  } | null
  creator?: {
    id: string
    name: string
  } | null
  roundName?: string | null
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

// Tab 3 数据
type PaymentRequestAttachment = {
  blobId: string
  name?: string
}

type PaymentRequestState = {
  measurementId: string
  requestAttachments: PaymentRequestAttachment[]
  lastCumulativePayment: number
  contractAmount: number
  contractorPayAmt: number
  supervisionPayAmt: number
  headquartersPayAmt: number
  investmentPayAmt: number
  contractPayAmt: number
  leaderPayAmt: number
  reqContractorOpinion: string
  reqContractorAuditor: string
  reqContractorDate?: string | number
  reqSupervisionOpinion: string
  reqSupervisionAuditor: string
  reqSupervisionDate?: string | number
  reqHeadquartersOpinion: string
  reqHeadquartersAuditor: string
  reqHeadquartersDate?: string | number
  reqInvestmentOpinion: string
  reqInvestmentAuditor: string
  reqInvestmentDate?: string | number
  reqContractOpinion: string
  reqContractAuditor: string
  reqContractDate?: string | number
  reqLeaderOpinion: string
  reqLeaderAuditor: string
  reqLeaderDate?: string | number
}

const createDefaultPaymentRequest = (): PaymentRequestState => ({
  measurementId: '',
  requestAttachments: [],
  lastCumulativePayment: 0,
  contractAmount: 0,
  contractorPayAmt: 0,
  supervisionPayAmt: 0,
  headquartersPayAmt: 0,
  investmentPayAmt: 0,
  contractPayAmt: 0,
  leaderPayAmt: 0,
  reqContractorOpinion: '',
  reqContractorAuditor: '',
  reqContractorDate: undefined,
  reqSupervisionOpinion: '',
  reqSupervisionAuditor: '',
  reqSupervisionDate: undefined,
  reqHeadquartersOpinion: '',
  reqHeadquartersAuditor: '',
  reqHeadquartersDate: undefined,
  reqInvestmentOpinion: '',
  reqInvestmentAuditor: '',
  reqInvestmentDate: undefined,
  reqContractOpinion: '',
  reqContractAuditor: '',
  reqContractDate: undefined,
  reqLeaderOpinion: '',
  reqLeaderAuditor: '',
  reqLeaderDate: undefined
})

const normalizePaymentRequest = (
  data?: Partial<PaymentRequestState> | null
): PaymentRequestState => ({
  ...createDefaultPaymentRequest(),
  ...(data || {}),
  requestAttachments: data?.requestAttachments || []
})

const paymentRequest = ref<PaymentRequestState>(createDefaultPaymentRequest())
const requestSaving = ref(false)

const attachmentsDialogOpen = ref(false)
const openAttachmentsDialog = () => {
  attachmentsDialogOpen.value = true
}

const isPrinting = ref(false)
const printType = ref<'cover' | 'payment' | null>(null)

const triggerPrint = async (type: 'cover' | 'payment') => {
  printType.value = type
  isPrinting.value = true
  document.body.classList.add('is-printing')
  await nextTick()
  window.print()
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

const currentStepName = computed(() => {
  if (!props.flowInstance) return ''
  const pendingStep = props.flowInstance.steps?.find((s: any) => s.status === 'PENDING')
  return pendingStep ? (pendingStep.name || '').trim() : ''
})

const getPartyAmounts = (partyKey: string) => {
  const sums = { current: 0, yearly: 0, cumulative: 0 }
  for (const row of coverAggregatedItems.value) {
    let amt = 0
    if (partyKey === 'contractor') {
      amt = Number(row.contractorAmount || 0)
    } else if (partyKey === 'supervision') {
      amt = Number(row.supervisionAmount || 0)
    } else if (partyKey === 'headquarters') {
      amt = Number(row.headquartersAmount || 0)
    } else if (partyKey === 'investment') {
      amt = Number(row.investmentAmount || 0)
    }

    const historyCumulative =
      Number(row.cumulativeAmount || 0) - Number(row.investmentAmount || 0)
    const historyYearly =
      Number(row.yearlyAmount || 0) - Number(row.investmentAmount || 0)

    sums.current += amt
    sums.yearly += historyYearly + amt
    sums.cumulative += historyCumulative + amt
  }
  return sums
}

const getPartySignInfo = (partyKey: string) => {
  if (partyKey === 'contractor') {
    return { name: contractorManagerDisplay.value, date: contractorDateDisplay.value }
  }
  if (partyKey === 'supervision') {
    return { name: supervisionAuditorModel.value, date: supervisionDateDisplay.value }
  }
  if (partyKey === 'headquarters') {
    return { name: headquartersAuditorModel.value, date: headquartersDateDisplay.value }
  }
  if (partyKey === 'investment') {
    return { name: investmentAuditorModel.value, date: investmentDateDisplay.value }
  }
  return { name: '', date: '' }
}

const coverDialogOpen = ref(false)
const openCoverDialog = () => {
  coverDialogOpen.value = true
}

const coverAggregatedItems = ref<any[]>([])
const loadCoverAggregated = async () => {
  if (!props.item?.id || !props.projectId) return
  try {
    coverAggregatedItems.value = await $fetch<any[]>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/aggregated-items`
    )
  } catch {
    coverAggregatedItems.value = []
  }
}

const coverAmounts = computed(() => {
  const sums = { current: 0, yearly: 0, cumulative: 0 }
  for (const row of coverAggregatedItems.value) {
    sums.current += Number(row.investmentAmount || 0)
    sums.yearly += Number(row.yearlyAmount || 0)
    sums.cumulative += Number(row.cumulativeAmount || 0)
  }
  return sums
})

const { result: coverProjectResult } = useQuery(
  gql`
    query CoverProjectInfo($id: String!) {
      project(id: $id) {
        id
        name
        contractName
        contractCode
        employer
        contractor
        responsible
        bidSection
      }
    }
  `,
  () => ({
    id: props.projectId
  })
)

const coverContractName = computed(() => {
  const contract = coverProjectResult.value?.project?.contractName
  if (contract && contract.trim().length) return contract
  return coverProjectResult.value?.project?.name || '项目合同'
})
const projectContractCode = computed(() => {
  const code = coverProjectResult.value?.project?.contractCode
  if (code && code.trim().length) return code
  return '-'
})

const applicantUnitName = computed(() => {
  const value = coverProjectResult.value?.project?.contractor
  if (value && value.trim().length) return value
  return '费用申请单位'
})
const route = useRoute()
const isReadOnly = computed(() => route.query.mode !== 'edit')

const projectManagerName = computed(() => {
  const value = coverProjectResult.value?.project?.responsible
  if (value && value.trim().length) return value
  return '-'
})

const printPeriod = computed(() => {
  const monthStr = props.item?.baseDate
    ? dayjs(Number(props.item.baseDate)).format('YYYY年MM月')
    : '-'
  const round = props.item?.roundName || ''
  if (!round) return monthStr
  if (round.includes('期')) return `${monthStr}${round}`
  return `${monthStr}第${round}期`
})

const printAttachmentNames = computed(() => {
  const list = paymentRequest.value.requestAttachments || []
  const names = list.map((a: any) => a?.name).filter(Boolean)
  return names.length ? names.join('，') : ''
})

const coverParties = [
  { key: 'contractor', label: '施工单位', roleLabel: '项目经理' },
  { key: 'supervision', label: '施工监理', roleLabel: '总监' },
  { key: 'headquarters', label: '现场指挥部', roleLabel: '现场指挥' },
  { key: 'investment', label: '投资监理', roleLabel: '总监' }
]

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

const getStepUserDisplay = (stepName: string) => {
  if (!props.flowInstance) return ''
  const steps = props.flowInstance.steps || []
  const actions = props.flowInstance.actions || []

  const step = steps.find((s: any) => s.name?.trim() === stepName.trim())
  if (step) {
    if (step.status === 'PENDING') {
      return '正在审核'
    }
    if (step.status === 'APPROVED' || step.status === 'REJECTED') {
      const action = actions.find(
        (a: any) =>
          a.stepId === step.id &&
          (a.action === 'APPROVED' ||
            a.action === 'STEP_APPROVED' ||
            a.action === 'REJECTED')
      )
      if (action && action.actor?.name) {
        return action.actor.name
      }
      if (step.approvers && step.approvers.length > 0) {
        return step.approvers
          .map((u: any) => u.name)
          .filter(Boolean)
          .join('、')
      }
    }
  }
  return ''
}

const flowInitiatorName = computed(() => {
  return (
    props.item?.flowInitiator?.name ||
    props.flowInstance?.actions?.find((a: any) => a.action === 'STARTED')?.actor
      ?.name ||
    ''
  )
})

const contractorManagerDisplay = computed(() => {
  return getStepUserDisplay('施工单位')
})

const supervisionOperatorDisplay = computed(() => {
  return getStepUserDisplay('施工监理经办人')
})

const supervisionAuditorModel = computed(() => {
  return getStepUserDisplay('施工监理总监')
})

const headquartersOperatorDisplay = computed(() => {
  return getStepUserDisplay('现场指挥部经办人')
})

const headquartersAuditorModel = computed(() => {
  return getStepUserDisplay('现场指挥')
})

const investmentOperatorDisplay = computed(() => {
  return getStepUserDisplay('投资监理经办人')
})

const investmentAuditorModel = computed(() => {
  return getStepUserDisplay('投资监理总监')
})

const contractOperatorDisplay = computed(() => {
  return getStepUserDisplay('合约管理部经办人')
})

const contractAuditorModel = computed(() => {
  return getStepUserDisplay('合约管理部负责人')
})

const leaderAuditorModel = computed(() => {
  return getStepUserDisplay('分管领导')
})

const paymentRequestAuditStepMap = {
  contractor: ['施工单位'],
  supervisionOperator: ['施工监理经办人'],
  supervisionApprover: ['施工监理总监'],
  headquartersOperator: ['现场指挥部经办人'],
  headquartersApprover: ['现场指挥'],
  investmentOperator: ['投资监理经办人'],
  investmentApprover: ['投资监理总监'],
  contractOperator: ['合约管理部经办人'],
  contractApprover: ['合约管理部负责人'],
  leader: ['分管领导']
} as const

type PaymentRequestAuditKey = keyof typeof paymentRequestAuditStepMap

const getCardSignerState = (key: PaymentRequestAuditKey) => {
  const stepNames = paymentRequestAuditStepMap[key]
  const displayStatus = getMonthlyMeasurementAuditDisplayStatus(
    props.item || {},
    stepNames
  )
  const currentStepName = (props.item?.currentStepName || '').trim()
  return {
    isReached: displayStatus !== '待审核',
    isCurrentStep: stepNames.some((stepName) => stepName === currentStepName)
  }
}

const getCardDateDisplayValue = (
  key: PaymentRequestAuditKey,
  storedValue?: string | number | null
) => {
  if (props.flowInstance?.steps) {
    const stepNames = paymentRequestAuditStepMap[key] as readonly string[]
    const matchedStep = props.flowInstance.steps.find(
      (s: any) =>
        stepNames.includes(s.name) && (s.status === 'APPROVED' || s.completedAt)
    )
    if (matchedStep?.completedAt) {
      return formatDate(matchedStep.completedAt)
    }
  }

  const state = getCardSignerState(key)
  if (!state.isReached || state.isCurrentStep || !storedValue) return ''
  return formatDate(storedValue)
}

const contractorDateDisplay = computed(() =>
  getCardDateDisplayValue('contractor', paymentRequest.value.reqContractorDate)
)

const supervisionDateDisplay = computed(() =>
  getCardDateDisplayValue(
    'supervisionApprover',
    paymentRequest.value.reqSupervisionDate
  )
)

const headquartersDateDisplay = computed(() =>
  getCardDateDisplayValue(
    'headquartersApprover',
    paymentRequest.value.reqHeadquartersDate
  )
)

const investmentDateDisplay = computed(() =>
  getCardDateDisplayValue('investmentApprover', paymentRequest.value.reqInvestmentDate)
)

const contractDateDisplay = computed(() =>
  getCardDateDisplayValue('contractApprover', paymentRequest.value.reqContractDate)
)

const leaderDateDisplay = computed(() =>
  getCardDateDisplayValue('leader', paymentRequest.value.reqLeaderDate)
)

const contractorState = computed(() => getCardSignerState('contractor'))
const supervisionState = computed(() => getCardSignerState('supervisionApprover'))
const headquartersState = computed(() => getCardSignerState('headquartersApprover'))
const investmentState = computed(() => getCardSignerState('investmentApprover'))
const contractState = computed(() => getCardSignerState('contractApprover'))
const leaderState = computed(() => getCardSignerState('leader'))

// 载入 Tab 3 数据
const loadTab3Data = async () => {
  if (!props.item?.id || !props.projectId) return
  try {
    const data = await $fetch<Partial<PaymentRequestState>>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/payment-requests`
    )
    paymentRequest.value = normalizePaymentRequest(data)
  } catch {}
}

const saveTab3Request = async () => {
  if (!props.item?.id || !props.projectId) return
  requestSaving.value = true
  try {
    const body: Record<string, any> = {
      requestAttachments: paymentRequest.value.requestAttachments
    }

    if (permissions.value.contractor) {
      body.contractorPayAmt = Number(paymentRequest.value.contractorPayAmt || 0)
      body.reqContractorOpinion = paymentRequest.value.reqContractorOpinion
    }
    if (permissions.value.supervision) {
      body.supervisionPayAmt = Number(paymentRequest.value.supervisionPayAmt || 0)
      body.reqSupervisionOpinion = paymentRequest.value.reqSupervisionOpinion
    }
    if (permissions.value.headquarters) {
      body.headquartersPayAmt = Number(paymentRequest.value.headquartersPayAmt || 0)
      body.reqHeadquartersOpinion = paymentRequest.value.reqHeadquartersOpinion
    }
    if (permissions.value.investment) {
      body.investmentPayAmt = Number(paymentRequest.value.investmentPayAmt || 0)
      body.reqInvestmentOpinion = paymentRequest.value.reqInvestmentOpinion
    }
    if (permissions.value.contract) {
      body.contractPayAmt = Number(paymentRequest.value.contractPayAmt || 0)
      body.reqContractOpinion = paymentRequest.value.reqContractOpinion
    }
    if (permissions.value.leader) {
      body.leaderPayAmt = Number(paymentRequest.value.leaderPayAmt || 0)
      body.reqLeaderOpinion = paymentRequest.value.reqLeaderOpinion
    }

    const updated = await $fetch<Partial<PaymentRequestState>>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/payment-requests`,
      {
        method: 'PATCH',
        body
      }
    )
    paymentRequest.value = normalizePaymentRequest(updated)
    emit('refetch')
    triggerNotification({
      title: '保存成功',
      description: '费用支付申请表保存成功！',
      type: ToastNotificationType.Success
    })
  } catch (err: any) {
    triggerNotification({
      title: '保存失败',
      description: err.data?.error || '保存失败',
      type: ToastNotificationType.Danger
    })
  } finally {
    requestSaving.value = false
  }
}

const requestFileRef = ref<HTMLInputElement | null>(null)
const triggerRequestUpload = () => {
  requestFileRef.value?.click()
}
const handleRequestFileUpload = async (event: Event) => {
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
        const list = paymentRequest.value.requestAttachments || []
        list.push({ blobId, name: file.name })
        paymentRequest.value.requestAttachments = [...list]
      } else {
        throw new Error('未获取到文件标识')
      }
    }
    await saveTab3Request()
  } catch (err) {
    triggerNotification({
      title: '文件上传失败',
      description: '文件上传失败：' + err,
      type: ToastNotificationType.Danger
    })
  }
}
const removeRequestAttachment = (idx: number) => {
  deleteTargetIdx.value = idx
  deleteConfirmOpen.value = true
}

const executeDeleteAttachment = async () => {
  if (deleteTargetIdx.value === null) return
  deletingAttachment.value = true
  try {
    const list = [...(paymentRequest.value.requestAttachments || [])]
    list.splice(deleteTargetIdx.value, 1)
    paymentRequest.value.requestAttachments = list
    await saveTab3Request()
  } finally {
    deletingAttachment.value = false
    deleteConfirmOpen.value = false
    deleteTargetIdx.value = null
  }
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

// 深度监听月度验工单 props 变化
watch(
  () => props.item?.id,
  () => {
    if (props.item?.id) {
      void loadTab3Data()
      void loadCoverAggregated()
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.print-only {
  display: none;
}

/* 验工计价封面样式 (同时在屏幕预览及打印生效) */
.print-cover-sheet {
  box-sizing: border-box;
  width: 100%;
  background-color: #fff;
  padding: 30px;
  font-family: SimSun, 'Songti SC', STSong, sans-serif;
  color: #000;
}

.print-cover-title {
  text-align: center;
  font-size: 28px;
  font-weight: bold;
  letter-spacing: 0.45em;
  padding: 20px 0;
  color: #111;
}

.print-cover-subtitle {
  text-align: center;
  font-size: 13px;
  padding: 12px 0;
  color: #111;
  font-weight: 500;
}

.print-cover-grid {
  display: flex;
  background-color: #fff;
}

.print-cover-col {
  flex: 1;
  width: 25%;
  display: flex;
  flex-direction: column;
}

.print-cover-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 40px;
  padding: 0 8px;
  font-size: 11px;
}

.print-cover-label {
  width: 80px;
  text-align: left;
}

.print-cover-val {
  flex-grow: 1;
  text-align: right;
  font-family: 'Courier New', Courier, monospace;
  font-weight: bold;
  border-bottom: 1px solid #000;
  margin-right: 4px;
  padding-bottom: 2px;
}

.print-cover-unit {
  width: 24px;
  text-align: right;
}

.print-cover-stamp {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.print-cover-sign {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 11px;
}

.print-cover-date {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 11px;
}

@media print {
  @page {
    margin: 12mm;
  }

  :global(html),
  :global(body) {
    height: auto !important;
    overflow: visible !important;
  }

  :global(html, body) {
    padding: 0;
    margin: 0;
    color: #000;
    font-family: SimSun, 'Songti SC', STSong, 'PingFang SC', 'Microsoft YaHei', Arial,
      sans-serif;
  }

  :global(body.is-printing [id='__nuxt']),
  :global(body.is-printing [id='__layout']),
  :global(body.is-printing .no-print) {
    display: none !important;
  }

  :global(body.is-printing #print-section) {
    position: absolute;
    left: 0;
    top: 0;
    width: 100% !important;
    display: block !important;
    background-color: white !important;
    color: black !important;
  }

  .print-hidden {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  .print-sheet {
    padding: 0;
    background: #fff;
    color: #000;
  }

  /* 强制打印背景色和边框颜色 */
  .print-cover-sheet {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* 费用支付申请表打印布局样式 */
  .print-payment-container {
    width: 100%;
  }

  .print-title {
    text-align: center;
    font-size: 18px;
    font-weight: bold;
    margin-top: 10px;
    color: #000;
  }

  .print-subtitle {
    text-align: center;
    margin-top: 10px;
    font-size: 12px;
    color: #000;
  }

  .print-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-top: 8px;
    font-size: 11px;
    color: #000;
  }

  .print-meta-table {
    margin-top: 12px;
  }

  .print-meta-left {
    width: 40%;
  }

  .print-meta-center {
    width: 40%;
    text-align: center;
  }

  .print-meta-right {
    width: 20%;
    text-align: right;
  }

  .print-cell {
    padding: 6px 8px;
    border: none;
  }

  .print-meta-table .print-cell,
  .print-info-table .print-cell {
    border: none;
  }

  .print-info-table {
    border: 1px solid #000;
  }

  .print-info-table .print-cell {
    border-right: 1px solid #000;
  }

  .print-info-table .print-cell:last-child {
    border-right: none;
  }

  .print-main-table {
    border: 1px solid #000;
    margin-top: 12px;
  }

  .print-head {
    border: 1px solid #000;
    padding: 6px;
    text-align: center;
    font-weight: bold;
  }

  .print-amount-cell {
    border: 1px solid #000;
    padding: 6px 8px;
    font-size: 11px;
    font-weight: bold;
    height: 32px;
    vertical-align: middle;
  }

  .print-opinion-title {
    border: 1px solid #000;
    padding: 6px 8px;
    font-size: 11px;
    font-weight: bold;
    height: 28px;
    vertical-align: middle;
  }

  .print-opinion-body {
    border: 1px solid #000;
    padding: 8px;
    height: 220px;
    vertical-align: top;
    font-size: 11px;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .print-sign-cell {
    border: 1px solid #000;
    padding: 6px 8px;
    font-size: 11px;
    height: 28px;
    vertical-align: middle;
  }
}
</style>
