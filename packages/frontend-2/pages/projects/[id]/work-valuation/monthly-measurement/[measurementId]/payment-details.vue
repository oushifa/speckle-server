<template>
  <div class="space-y-6 bg-foundation p-1.5 w-full max-w-full overflow-hidden">
    <!-- 顶部项目页眉和副标题 -->
    <div class="text-center space-y-1.5 mb-5">
      <h1 class="text-lg font-bold text-foreground tracking-wide">
        验工计价中间支付单
      </h1>
      <p class="text-[11px] text-foreground-2">
        {{ projectName }}
        {{
          props.item?.baseDate
            ? dayjs(Number(props.item.baseDate)).format('YYYY年MM月')
            : '2020年12月'
        }}
        {{ props.item?.roundName ? `第${props.item.roundName}期` : '' }}
      </p>
      <div
        class="flex justify-between items-center text-[10px] text-foreground-2 px-1 pt-1.5 border-t border-outline-3 border-dashed mt-2"
      >
        <span>承包人（签章）：{{ projectContractor }}</span>
        <span>合同编号：{{ projectContractCode }}</span>
        <span>单位：元</span>
      </div>
    </div>

    <!-- 中间支付单大表格（只支持横向滚动） -->
    <div class="overflow-x-auto w-full max-w-full rounded border border-outline-3">
      <table class="w-full text-xs text-left min-w-[1200px] border-collapse">
        <thead
          class="bg-[#1e56a0] text-white text-center font-medium sticky top-0 z-10"
        >
          <tr class="border-b border-blue-400">
            <th
              rowspan="2"
              class="px-2 py-2.5 border-r border-blue-400 text-center w-12 align-middle"
            >
              序号
            </th>
            <th
              rowspan="2"
              class="px-2 py-2.5 border-r border-blue-400 text-center w-20 align-middle"
            >
              章节
            </th>
            <th
              rowspan="2"
              class="px-2 py-2.5 border-r border-blue-400 text-left pl-3 w-48 align-middle"
            >
              项目名称
            </th>
            <th
              rowspan="2"
              class="px-2 py-2.5 border-r border-blue-400 text-right pr-3 w-32 align-middle"
            >
              合同价
            </th>
            <th
              rowspan="2"
              class="px-2 py-2.5 border-r border-blue-400 text-right pr-3 w-32 align-middle"
            >
              本期完成工作量
            </th>
            <th
              rowspan="2"
              class="px-2 py-2.5 border-r border-blue-400 text-right pr-3 w-32 align-middle"
            >
              累计完成工作量
            </th>
            <th colspan="4" class="px-2 py-1.5 border-r border-blue-400 text-center">
              本期支付款
            </th>
            <th rowspan="2" class="px-2 py-2.5 text-right pr-3 w-32 align-middle">
              累计支付款
            </th>
          </tr>
          <tr class="bg-[#2A4B7C] text-white text-[11px]">
            <th class="px-2 py-1.5 border-r border-blue-400 text-right pr-3 w-28">
              施工单位
            </th>
            <th class="px-2 py-1.5 border-r border-blue-400 text-right pr-3 w-28">
              投资监理
            </th>
            <th class="px-2 py-1.5 border-r border-blue-400 text-right pr-3 w-28">
              合约管理部
            </th>
            <th
              class="px-2 py-1.5 border-r border-blue-400 text-right pr-3 w-28 font-semibold"
            >
              分管领导
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in chapterGroups" :key="group.groupKey">
            <tr
              v-for="row in group.rows"
              :key="row.boqItemId"
              class="border-b border-outline-3 bg-foundation hover:bg-highlight-1/5 transition-colors text-[11px]"
            >
              <td class="px-2 py-2 text-center border-r border-outline-3 font-mono">
                {{ row.displayIndex }}
              </td>
              <td class="px-2 py-2 text-center border-r border-outline-3 font-mono">
                {{ row.boqCode }}
              </td>
              <td
                class="px-2 py-2 border-r border-outline-3 pl-3 truncate max-w-[200px]"
                :title="row.boqName"
              >
                {{ row.boqName }}
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(row.contractAmount) }}
              </td>
              <td
                class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3 font-medium"
              >
                {{ formatMoney(row.investmentAmount) }}
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(row.cumulativeAmount) }}
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(getDerivedPay(row).contractorPayAmt) }}
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(getDerivedPay(row).investmentPayAmt) }}
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(getDerivedPay(row).contractPayAmt) }}
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(getDerivedPay(row).leaderPayAmt) }}
              </td>
              <td
                class="px-2 py-2 text-right font-mono pr-3 font-semibold text-foreground-2"
              >
                {{ formatMoney(row.cumulativeAmount) }}
              </td>
            </tr>

            <tr
              class="border-b border-outline-3 bg-highlight-1/10 font-semibold text-[11px]"
            >
              <td
                class="px-2 py-2 text-center border-r border-outline-3 font-mono"
              ></td>
              <td class="px-2 py-2 text-center border-r border-outline-3 font-mono">
                -
              </td>
              <td class="px-2 py-2 border-r border-outline-3 pl-3 text-left">
                {{ group.groupBoqName }} 小计
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(group.subtotal.contractAmount) }}
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(group.subtotal.investmentAmount) }}
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(group.subtotal.cumulativeAmount) }}
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(group.subtotal.contractorPayAmt) }}
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(group.subtotal.investmentPayAmt) }}
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(group.subtotal.contractPayAmt) }}
              </td>
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(group.subtotal.leaderPayAmt) }}
              </td>
              <td class="px-2 py-2 text-right font-mono pr-3">
                {{ formatMoney(group.subtotal.cumulativePayAmt) }}
              </td>
            </tr>
          </template>

          <tr
            class="border-b border-outline-3 bg-highlight-1/5 font-semibold text-[11px]"
          >
            <td class="px-2 py-2 text-center border-r border-outline-3 font-mono">
              {{ chapterSumIndex }}
            </td>
            <td class="px-2 py-2 text-center border-r border-outline-3 font-mono">-</td>
            <td class="px-2 py-2 border-r border-outline-3 pl-3 text-left">
              合计 1-{{ chapterRowCount }}
            </td>
            <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
              {{ formatMoney(chapterSums.contractAmount) }}
            </td>
            <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
              {{ formatMoney(chapterSums.investmentAmount) }}
            </td>
            <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
              {{ formatMoney(chapterSums.cumulativeAmount) }}
            </td>
            <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
              {{ formatMoney(chapterSums.contractorPayAmt) }}
            </td>
            <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
              {{ formatMoney(chapterSums.investmentPayAmt) }}
            </td>
            <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
              {{ formatMoney(chapterSums.contractPayAmt) }}
            </td>
            <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
              {{ formatMoney(chapterSums.leaderPayAmt) }}
            </td>
            <td class="px-2 py-2 text-right font-mono pr-3">
              {{ formatMoney(chapterSums.cumulativePayAmt) }}
            </td>
          </tr>

          <!-- 预付(留)款条目行（额外章节） -->
          <tr
            v-for="(row, idx) in extraPayRows"
            :key="row.item.prepaymentItemId"
            class="border-b border-outline-3 bg-foundation text-[11px]"
          >
            <td class="px-2 py-2 text-center border-r border-outline-3 font-mono">
              {{ chapterSumIndex + idx + 1 }}
            </td>
            <td
              v-if="row.rowspan > 0"
              class="px-2 py-2 text-center border-r border-outline-3 font-mono"
              :rowspan="row.rowspan"
            >
              {{ row.item.category || '-' }}
            </td>
            <td
              class="px-2 py-2 border-r border-outline-3 pl-3 truncate max-w-[200px]"
              :title="row.item.name"
            >
              {{ row.item.name || '-' }}
            </td>
            <td
              class="px-2 py-2 border-r border-outline-3 text-center text-foreground-2 font-mono"
            >
              -
            </td>
            <td
              class="px-2 py-2 border-r border-outline-3 text-center text-foreground-2 font-mono"
            >
              -
            </td>
            <td
              class="px-2 py-2 border-r border-outline-3 text-center text-foreground-2 font-mono"
            >
              {{ formatMoney(getExtraCumulativeAmount(row.item)) }}
            </td>
            <td class="px-2 py-1 border-r border-outline-3 w-28">
              <input
                v-model.number="row.item.contractorPayAmt"
                type="number"
                step="any"
                :disabled="!permissions.contractor"
                class="w-full text-right bg-foundation border border-outline-3 rounded px-1 py-0.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono text-[11px]"
              />
            </td>
            <td class="px-2 py-1 border-r border-outline-3 w-28">
              <input
                v-model.number="row.item.investmentPayAmt"
                type="number"
                step="any"
                :disabled="!permissions.investment"
                class="w-full text-right bg-foundation border border-outline-3 rounded px-1 py-0.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono text-[11px]"
              />
            </td>
            <td class="px-2 py-1 border-r border-outline-3 w-28">
              <input
                v-model.number="row.item.contractPayAmt"
                type="number"
                step="any"
                :disabled="!permissions.contract"
                class="w-full text-right bg-foundation border border-outline-3 rounded px-1 py-0.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono text-[11px]"
              />
            </td>
            <td class="px-2 py-1 border-r border-outline-3 w-28">
              <input
                v-model.number="row.item.leaderPayAmt"
                type="number"
                step="any"
                :disabled="!permissions.leader"
                class="w-full text-right bg-foundation border border-outline-3 rounded px-1 py-0.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono text-[11px]"
              />
            </td>
            <td
              class="px-2 py-2 text-right font-mono pr-3 font-semibold text-foreground-2"
            >
              {{ formatMoney(getExtraCumulativeAmount(row.item)) }}
            </td>
          </tr>

          <!-- 本期实际支付款行（亮蓝色高亮） -->
          <tr
            class="bg-blue-600 text-white font-semibold text-[11px] border-b border-blue-600"
          >
            <td class="px-2 py-2 text-center border-r border-blue-500 font-mono">
              {{ actualPayIndex }}
            </td>
            <td colspan="2" class="px-2 py-2 pl-3 text-left border-r border-blue-500">
              本期实际支付款
            </td>
            <td class="px-2 py-2 text-right border-r border-blue-500 font-mono pr-3">
              {{ formatMoney(totalSums.contractAmount) }}
            </td>
            <td class="px-2 py-2 text-right border-r border-blue-500 font-mono pr-3">
              {{ formatMoney(totalSums.investmentAmount) }}
            </td>
            <td class="px-2 py-2 text-right border-r border-blue-500 font-mono pr-3">
              {{ formatMoney(totalSums.cumulativeAmount) }}
            </td>
            <td class="px-2 py-2 text-right border-r border-blue-500 font-mono pr-3">
              {{ formatMoney(totalSums.contractorPayAmt) }}
            </td>
            <td class="px-2 py-2 text-right border-r border-blue-500 font-mono pr-3">
              {{ formatMoney(totalSums.investmentPayAmt) }}
            </td>
            <td class="px-2 py-2 text-right border-r border-blue-500 font-mono pr-3">
              {{ formatMoney(totalSums.contractPayAmt) }}
            </td>
            <td class="px-2 py-2 text-right border-r border-blue-500 font-mono pr-3">
              {{ formatMoney(totalSums.leaderPayAmt) }}
            </td>
            <td class="px-2 py-2 text-right pr-3 font-mono">
              {{ formatMoney(totalSums.cumulativePayAmt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 签字及操作控制大面板 -->
    <div class="border border-outline-3 rounded-lg p-4 bg-foundation space-y-4">
      <!-- 进度款与农民工工资 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-foreground w-40 shrink-0">
            本期应支付进度款 (万元)
          </span>
          <input
            v-model.number="paymentDetails.interimPayProgress"
            type="number"
            step="any"
            placeholder="请输入"
            :disabled="!canEditInterimAmounts"
            class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-3 py-1.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono"
          />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-foreground w-40 shrink-0">
            其中农民工工资 (万元)
          </span>
          <input
            v-model.number="paymentDetails.migrantWorkerSalary"
            type="number"
            step="any"
            placeholder="请输入"
            :disabled="!canEditInterimAmounts"
            class="flex-grow text-xs bg-foundation border border-outline-3 rounded px-3 py-1.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono"
          />
        </div>
      </div>

      <!-- 备注 -->
      <div class="space-y-1.5">
        <span class="text-xs font-semibold text-foreground block">备注</span>
        <textarea
          v-model="paymentDetails.interimRemark"
          placeholder="请输入备注..."
          rows="3"
          :disabled="!canEditInterimAmounts"
          class="w-full text-xs bg-foundation border border-outline-3 rounded p-2 focus:outline-none focus:border-primary disabled:opacity-60 resize-y"
        ></textarea>
      </div>

      <!-- 附件管理已移入清爽的弹出层中 -->

      <!-- 底部签字、日期和控制按钮区 -->
      <div
        class="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 pt-2.5"
      >
        <!-- 签字项与制表日期 -->
        <div class="flex flex-wrap items-center gap-3.5 text-xs text-foreground-2">
          <div
            class="rounded border border-outline-3 bg-foundation px-3 py-1.5 min-w-[132px]"
          >
            <div class="text-[10px] text-foreground-2">分管领导</div>
            <div class="text-xs font-medium text-foreground">
              {{ getPaymentDetailAuditUser('leader') }}
            </div>
          </div>
          <div
            class="rounded border border-outline-3 bg-foundation px-3 py-1.5 min-w-[132px]"
          >
            <div class="text-[10px] text-foreground-2">复核</div>
            <div class="text-xs font-medium text-foreground">
              {{ getPaymentDetailAuditUser('contract') }}
            </div>
          </div>
          <div
            class="rounded border border-outline-3 bg-foundation px-3 py-1.5 min-w-[132px]"
          >
            <div class="text-[10px] text-foreground-2">制表</div>
            <div class="text-xs font-medium text-foreground">
              {{ getPaymentDetailAuditUser('investment') }}
            </div>
          </div>
          <div
            class="rounded border border-outline-3 bg-foundation px-3 py-1.5 min-w-[132px]"
          >
            <div class="text-[10px] text-foreground-2">日期</div>
            <div class="text-xs font-mono text-foreground">
              {{ getPaymentDetailAuditDate(paymentDetails.interimSignDate) }}
            </div>
          </div>
        </div>

        <!-- 按钮组 -->
        <div class="flex items-center justify-end gap-2.5 shrink-0">
          <!-- 附件按钮，打开清爽弹出层 -->
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 border border-outline-3 text-xs font-semibold rounded hover:bg-foundation-2 bg-foundation text-foreground-2 transition-colors focus:outline-none"
            @click="openAttachmentsDialog"
          >
            <PaperClipIcon class="h-3.5 w-3.5" />
            附件 ({{ paymentDetails.paymentAttachments?.length || 0 }})
          </button>

          <!-- 打印按钮 -->
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 border border-outline-3 text-xs font-semibold rounded hover:bg-foundation-2 bg-foundation text-foreground-2 transition-colors focus:outline-none"
            @click="triggerPrint"
          >
            <PrinterIcon class="h-3.5 w-3.5" />
            打印
          </button>

          <!-- 保存按钮 -->
          <button
            v-if="isCurrentApprover"
            class="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none"
            :disabled="paymentSaving"
            @click="saveTab2Payment"
          >
            <ArrowDownTrayIcon class="h-3.5 w-3.5" />
            {{ paymentSaving ? '保存中...' : '保存' }}
          </button>

          <!-- 关闭按钮 -->
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 border border-outline-3 text-xs font-semibold rounded hover:bg-foundation-2 bg-foundation text-foreground-2 transition-colors focus:outline-none"
            @click="closeDetails"
          >
            <XMarkIcon class="h-3.5 w-3.5" />
            关闭
          </button>
        </div>
      </div>
    </div>

    <!-- 附件管理弹出层 LayoutDialog -->
    <LayoutDialog
      v-model:open="attachmentsDialogOpen"
      max-width="md"
      :prevent-close-on-click-outside="deleteConfirmOpen"
    >
      <template #header>支付单附件管理</template>
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <span class="text-sm font-semibold">
            附件列表 ({{ paymentDetails.paymentAttachments?.length || 0 }} 个)
          </span>
          <input
            ref="paymentFileRef"
            type="file"
            class="hidden"
            multiple
            @change="handlePaymentFileUpload"
          />
          <button
            v-if="isCurrentApprover"
            class="px-3 py-1.5 text-xs font-semibold text-white rounded bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none"
            @click="triggerPaymentUpload"
          >
            上传新文件
          </button>
        </div>

        <div
          v-if="paymentDetails.paymentAttachments?.length"
          class="space-y-2 max-h-[300px] overflow-y-auto pr-1"
        >
          <div
            v-for="(attachment, aIdx) in paymentDetails.paymentAttachments"
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
                @click="removePaymentAttachment(Number(aIdx))"
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
    <!-- 删除附件二次确认弹窗 -->
    <CommonConfirmDialog
      v-model:open="deleteConfirmOpen"
      title="确认删除附件"
      text="您确定要删除该附件吗？此操作无法撤销。"
      confirm-text="确认删除"
      :loading="deletingAttachment"
      @confirm="executeDeleteAttachment"
    />

    <!-- 打印专属内容区域 (使用 Teleport 传送至 body 根节点，以彻底解决预览空白问题) -->
    <Teleport v-if="isPrinting" to="body">
      <div id="print-section" class="print-sheet">
        <div class="print-container">
          <!-- 1. 主标题 -->
          <div class="print-title">验工计价中间支付单</div>

          <!-- 2. 副标题 -->
          <div class="print-subtitle">
            {{ projectName }} &nbsp;&nbsp;&nbsp;&nbsp;
            {{
              props.item?.baseDate
                ? dayjs(Number(props.item.baseDate)).format('YYYY年MM月')
                : ''
            }} &nbsp;&nbsp;&nbsp;&nbsp;
            {{ props.item?.roundName ? `第${props.item.roundName}期` : '' }}
          </div>

          <!-- 3. 信息行 -->
          <table class="print-meta-table">
            <tr>
              <td class="print-meta-left">
                承包人（签章）：{{ projectContractor }}
              </td>
              <td class="print-meta-center">
                合同编号：{{ projectContractCode }}
              </td>
              <td class="print-meta-right">单位：元</td>
            </tr>
          </table>

          <!-- 4. 主表格 -->
          <table class="print-main-table">
            <thead>
              <tr>
                <th class="print-th w-[6%]">序号</th>
                <th class="print-th w-[10%]">章号</th>
                <th class="print-th w-[24%]">项目名称</th>
                <th class="print-th w-[12%]">合同价</th>
                <th class="print-th w-[12%]">本期完成工作量</th>
                <th class="print-th w-[12%]">累计完成工作量</th>
                <th class="print-th w-[12%]">本期支付款</th>
                <th class="print-th w-[12%]">累计验工支付款</th>
              </tr>
            </thead>
            <tbody>
              <!-- 循环渲染章节数据 -->
              <template v-for="group in chapterGroups" :key="group.groupKey">
                <tr v-for="row in group.rows" :key="row.boqItemId" class="print-tr">
                  <td class="print-td text-center font-mono">{{ row.displayIndex }}</td>
                  <td class="print-td text-center font-mono">{{ row.boqCode }}</td>
                  <td class="print-td text-left truncate-cell" :title="row.boqName">{{ row.boqName }}</td>
                  <td class="print-td text-right font-mono">{{ formatMoney(row.contractAmount) }}</td>
                  <td class="print-td text-right font-mono">{{ formatMoney(row.investmentAmount) }}</td>
                  <td class="print-td text-right font-mono">{{ formatMoney(row.cumulativeAmount) }}</td>
                  <td class="print-td text-right font-mono">{{ formatMoney(getDerivedPay(row).leaderPayAmt) }}</td>
                  <td class="print-td text-right font-mono">{{ formatMoney(row.cumulativeAmount) }}</td>
                </tr>
                <!-- 小计 -->
                <tr class="print-tr print-subtotal-row">
                  <td class="print-td text-center"></td>
                  <td class="print-td text-center">-</td>
                  <td class="print-td text-left font-semibold">{{ group.groupBoqName }} 小计</td>
                  <td class="print-td text-right font-semibold font-mono">{{ formatMoney(group.subtotal.contractAmount) }}</td>
                  <td class="print-td text-right font-semibold font-mono">{{ formatMoney(group.subtotal.investmentAmount) }}</td>
                  <td class="print-td text-right font-semibold font-mono">{{ formatMoney(group.subtotal.cumulativeAmount) }}</td>
                  <td class="print-td text-right font-semibold font-mono">{{ formatMoney(group.subtotal.leaderPayAmt) }}</td>
                  <td class="print-td text-right font-semibold font-mono">{{ formatMoney(group.subtotal.cumulativePayAmt) }}</td>
                </tr>
              </template>

              <!-- 合计 -->
              <tr class="print-tr print-total-row">
                <td class="print-td text-center font-mono">{{ chapterSumIndex }}</td>
                <td class="print-td text-left font-semibold" colspan="2">合计 1-{{ chapterRowCount }}</td>
                <td class="print-td text-right font-semibold font-mono">{{ formatMoney(chapterSums.contractAmount) }}</td>
                <td class="print-td text-right font-semibold font-mono">{{ formatMoney(chapterSums.investmentAmount) }}</td>
                <td class="print-td text-right font-semibold font-mono">{{ formatMoney(chapterSums.cumulativeAmount) }}</td>
                <td class="print-td text-right font-semibold font-mono">{{ formatMoney(chapterSums.leaderPayAmt) }}</td>
                <td class="print-td text-right font-semibold font-mono">{{ formatMoney(chapterSums.cumulativePayAmt) }}</td>
              </tr>

              <!-- 预付款等 extra rows -->
              <template v-for="(row, idx) in extraPayRows" :key="row.item.prepaymentItemId">
                <tr class="print-tr">
                  <td class="print-td text-center font-mono">{{ chapterSumIndex + idx + 1 }}</td>
                  <td v-if="row.rowspan > 0" class="print-td text-center font-mono" :rowspan="row.rowspan">{{ row.item.category || '-' }}</td>
                  <td class="print-td text-left truncate-cell">{{ row.item.name || '-' }}</td>
                  <td class="print-td text-center font-mono">-</td>
                  <td class="print-td text-center font-mono">-</td>
                  <td class="print-td text-right font-mono">{{ formatMoney(getExtraCumulativeAmount(row.item)) }}</td>
                  <td class="print-td text-right font-mono">{{ formatMoney(row.item.leaderPayAmt) }}</td>
                  <td class="print-td text-right font-mono">{{ formatMoney(getExtraCumulativeAmount(row.item)) }}</td>
                </tr>
              </template>

              <!-- 本期实际支付款 -->
              <tr class="print-tr print-actual-pay-row">
                <td class="print-td text-center font-mono">{{ actualPayIndex }}</td>
                <td class="print-td text-left font-semibold" colspan="2">本期实际支付款</td>
                <td class="print-td text-right font-semibold font-mono">{{ formatMoney(totalSums.contractAmount) }}</td>
                <td class="print-td text-right font-semibold font-mono">{{ formatMoney(totalSums.investmentAmount) }}</td>
                <td class="print-td text-right font-semibold font-mono">{{ formatMoney(totalSums.cumulativeAmount) }}</td>
                <td class="print-td text-right font-semibold font-mono">{{ formatMoney(totalSums.leaderPayAmt) }}</td>
                <td class="print-td text-right font-semibold font-mono">{{ formatMoney(totalSums.cumulativePayAmt) }}</td>
              </tr>

              <!-- 备注标题 -->
              <tr class="print-tr print-remark-title-row">
                <td class="print-td text-left font-semibold" colspan="8">备注：</td>
              </tr>
              <!-- 备注内容 -->
              <tr class="print-tr print-remark-content-row">
                <td class="print-td text-left print-remark-cell" colspan="8">
                  {{ paymentDetails.interimRemark || '&nbsp;' }}
                </td>
              </tr>

              <!-- 注明 -->
              <tr class="print-tr print-note-row">
                <td class="print-td text-left print-note-cell" colspan="8">
                  注：指定支付材料明细见附表。
                </td>
              </tr>
            </tbody>
          </table>

          <!-- 5. 签字区 -->
          <div class="print-sign-area">
            <div class="print-sign-col">分管领导：{{ getPaymentDetailAuditUser('leader') }}</div>
            <div class="print-sign-col">复核：{{ getPaymentDetailAuditUser('contract') }}</div>
            <div class="print-sign-col">制表：{{ getPaymentDetailAuditUser('investment') }}</div>
            <div class="print-sign-col">日期：{{ getPaymentDetailAuditDate(paymentDetails.interimSignDate) }}</div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from 'vue'
import { preciseAdd } from '~~/lib/common/helpers/preciseMath'
import { PaperClipIcon, ArrowDownTrayIcon, XMarkIcon, PrinterIcon } from '@heroicons/vue/24/outline'
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
  roundName?: string | null
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

const { result: projectResult } = useQuery(
  gql`
    query ProjectContractCodeForPaymentDetails($id: String!) {
      project(id: $id) {
        id
        name
        contractCode
        contractor
      }
    }
  `,
  () => ({
    id: props.projectId
  })
)
const projectName = computed(() => {
  return projectResult.value?.project?.name || ''
})
const projectContractCode = computed(() => {
  const code = projectResult.value?.project?.contractCode
  if (code && code.trim().length) return code
  return '-'
})
const projectContractor = computed(() => {
  return projectResult.value?.project?.contractor || ''
})

// 数据缓存
const aggregatedItems = ref<any[]>([])

const getDerivedPay = (row: any) => {
  const contractorPayAmt = Number(row.contractorAmount || 0)
  const investmentPayAmt = Number(row.investmentAmount || 0)
  return {
    contractorPayAmt,
    investmentPayAmt,
    contractPayAmt: investmentPayAmt,
    leaderPayAmt: investmentPayAmt
  }
}

const sumPaymentRows = (rows: any[]) => {
  const sums = {
    contractAmount: 0,
    investmentAmount: 0,
    cumulativeAmount: 0,
    contractorPayAmt: 0,
    investmentPayAmt: 0,
    contractPayAmt: 0,
    leaderPayAmt: 0,
    cumulativePayAmt: 0
  }
  rows.forEach((row) => {
    sums.contractAmount = preciseAdd(sums.contractAmount, Number(row.contractAmount || 0))
    sums.investmentAmount = preciseAdd(sums.investmentAmount, Number(row.investmentAmount || 0))
    sums.cumulativeAmount = preciseAdd(sums.cumulativeAmount, Number(row.cumulativeAmount || 0))
    const pay = getDerivedPay(row)
    sums.contractorPayAmt = preciseAdd(sums.contractorPayAmt, Number(pay.contractorPayAmt || 0))
    sums.investmentPayAmt = preciseAdd(sums.investmentPayAmt, Number(pay.investmentPayAmt || 0))
    sums.contractPayAmt = preciseAdd(sums.contractPayAmt, Number(pay.contractPayAmt || 0))
    sums.leaderPayAmt = preciseAdd(sums.leaderPayAmt, Number(pay.leaderPayAmt || 0))
    sums.cumulativePayAmt = preciseAdd(sums.cumulativePayAmt, Number(row.cumulativeAmount || 0))
  })
  return sums
}

const chapterGroups = computed(() => {
  const groups = new Map<
    string,
    {
      groupKey: string
      groupBoqCode: string
      groupBoqName: string
      rows: any[]
      subtotal: ReturnType<typeof sumPaymentRows>
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
        subtotal: sumPaymentRows([])
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
    subtotal: sumPaymentRows(group.rows)
  }))
})

const chapterRowCount = computed(() => aggregatedItems.value.length)
const chapterSumIndex = computed(() => chapterRowCount.value + 1)
const chapterSums = computed(() => sumPaymentRows(aggregatedItems.value))

const getEffectiveExtraPayAmount = (item: any) => {
  const candidates = [
    Number(item?.leaderPayAmt || 0),
    Number(item?.contractPayAmt || 0),
    Number(item?.investmentPayAmt || 0),
    Number(item?.contractorPayAmt || 0)
  ]
  const firstNonZero = candidates.find((value) => value !== 0)
  return firstNonZero ?? 0
}

const getExtraCumulativeAmount = (item: any) => {
  if (item?.cumulativeAmount !== undefined && item?.cumulativeAmount !== null) {
    return Number(item.cumulativeAmount || 0)
  }
  const lastCumulativePay = Number(
    item?.lastCumulativePay ?? item?.lastCumulativePayment ?? item?.historyPay ?? 0
  )
  return preciseAdd(lastCumulativePay, getEffectiveExtraPayAmount(item))
}

const totalSums = computed(() => {
  const sums = { ...chapterSums.value }
  for (const extra of extraPayItems.value) {
    const extraCumulativeAmount = getExtraCumulativeAmount(extra)
    sums.cumulativeAmount = preciseAdd(sums.cumulativeAmount, extraCumulativeAmount)
    sums.contractorPayAmt = preciseAdd(sums.contractorPayAmt, Number(extra.contractorPayAmt || 0))
    sums.investmentPayAmt = preciseAdd(sums.investmentPayAmt, Number(extra.investmentPayAmt || 0))
    sums.contractPayAmt = preciseAdd(sums.contractPayAmt, Number(extra.contractPayAmt || 0))
    sums.leaderPayAmt = preciseAdd(sums.leaderPayAmt, Number(extra.leaderPayAmt || 0))
    sums.cumulativePayAmt = preciseAdd(sums.cumulativePayAmt, extraCumulativeAmount)
  }

  return sums
})

const extraPayItems = computed(() => paymentDetails.value.extraPayItems || [])
const extraPayRows = computed(() => {
  const rows: Array<{ item: any; rowspan: number }> = []
  const groups = new Map<string, any[]>()
  for (const item of extraPayItems.value) {
    const key = String(item.category || '')
    const bucket = groups.get(key)
    if (bucket) bucket.push(item)
    else groups.set(key, [item])
  }

  for (const [, items] of groups) {
    items.forEach((item, idx) => {
      rows.push({
        item,
        rowspan: idx === 0 ? items.length : 0
      })
    })
  }
  return rows
})
const actualPayIndex = computed(
  () => chapterSumIndex.value + extraPayItems.value.length + 1
)

const closeDetails = () => {
  navigateTo(`/projects/${props.projectId}/work-valuation/monthly-measurement`)
}

const isPrinting = ref(false)
const triggerPrint = async () => {
  isPrinting.value = true
  document.body.classList.add('is-printing')
  await nextTick()
  window.print()
}

const handleAfterPrint = () => {
  isPrinting.value = false
  document.body.classList.remove('is-printing')
}

onMounted(() => {
  window.addEventListener('afterprint', handleAfterPrint)
})

onUnmounted(() => {
  window.removeEventListener('afterprint', handleAfterPrint)
})

const attachmentsDialogOpen = ref(false)
const openAttachmentsDialog = () => {
  attachmentsDialogOpen.value = true
}

// Tab 2 数据
const paymentDetails = ref<any>({
  measurementId: '',
  paymentAttachments: [],
  extraPayItems: [],
  interimPayProgress: 0,
  migrantWorkerSalary: 0,
  interimRemark: '',
  contractorSign: '',
  supervisionSign: '',
  preparerSign: '',
  interimSignDate: null
})
const paymentSaving = ref(false)

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

const paymentDetailAuditStepMap = {
  contractor: ['施工单位'],
  supervision: ['施工监理经办人', '施工监理总监'],
  investment: ['投资监理经办人'],
  leader: ['分管领导'],
  contract: ['合约管理部经办人']
} as const

type PaymentDetailAuditKey = keyof typeof paymentDetailAuditStepMap

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

const getPaymentDetailAuditUser = (key: PaymentDetailAuditKey) => {
  return getAuditUserDisplay(paymentDetailAuditStepMap[key])
}

const getPaymentDetailAuditDate = (value: string | number | null | undefined) => {
  if (!value) return '-'
  return formatDate(value)
}

const canEditInterimAmounts = computed(() => {
  return (
    permissions.value.contractor ||
    permissions.value.investment ||
    permissions.value.contract ||
    permissions.value.leader
  )
})

// 载入聚合工程列表数据
const loadAggregatedItems = async () => {
  if (!props.item?.id || !props.projectId) return
  try {
    const items = await $fetch<any[]>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/aggregated-items?level=section`
    )
    aggregatedItems.value = items
  } catch {
    aggregatedItems.value = []
  }
}

// 载入 Tab 2 数据
const loadTab2Data = async () => {
  if (!props.item?.id || !props.projectId) return
  try {
    const data = await $fetch<any>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/payment-details`
    )
    paymentDetails.value = {
      ...data,
      paymentAttachments: data.paymentAttachments || [],
      extraPayItems: data.extraPayItems || []
    }
  } catch {}
}

watch(
  () => totalSums.value.investmentAmount,
  (investmentAmount) => {
    const current = Number(paymentDetails.value.interimPayProgress || 0)
    if (current > 0) return
    const suggested = Number(investmentAmount || 0) / 10000
    if (!Number.isFinite(suggested) || suggested <= 0) return
    paymentDetails.value.interimPayProgress = Math.round(suggested * 100) / 100
  }
)

const saveTab2Payment = async () => {
  if (!props.item?.id || !props.projectId) return
  paymentSaving.value = true
  try {
    const body: Record<string, unknown> = {
      paymentAttachments: paymentDetails.value.paymentAttachments
    }
    if (canEditInterimAmounts.value) {
      body.interimPayProgress = Number(paymentDetails.value.interimPayProgress || 0)
      body.migrantWorkerSalary = Number(paymentDetails.value.migrantWorkerSalary || 0)
      body.interimRemark = paymentDetails.value.interimRemark
    }
    if (
      permissions.value.contractor ||
      permissions.value.investment ||
      permissions.value.contract ||
      permissions.value.leader
    ) {
      body.extraPayItems = paymentDetails.value.extraPayItems
    }

    await $fetch(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/payment-details`,
      {
        method: 'PATCH',
        body
      }
    )
    await loadTab2Data()
    emit('refetch')
    triggerNotification({
      title: '保存成功',
      description: '中间支付单保存成功！',
      type: ToastNotificationType.Success
    })
  } catch (err: any) {
    triggerNotification({
      title: '保存失败',
      description: err.data?.error || '保存失败',
      type: ToastNotificationType.Danger
    })
  } finally {
    paymentSaving.value = false
  }
}

const paymentFileRef = ref<HTMLInputElement | null>(null)
const triggerPaymentUpload = () => {
  paymentFileRef.value?.click()
}
const handlePaymentFileUpload = async (event: Event) => {
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
        const list = paymentDetails.value.paymentAttachments || []
        list.push({ blobId, name: file.name })
        paymentDetails.value.paymentAttachments = [...list]
      } else {
        throw new Error('未获取到文件标识')
      }
    }
    await saveTab2Payment()
  } catch (err) {
    triggerNotification({
      title: '文件上传失败',
      description: '文件上传失败：' + err,
      type: ToastNotificationType.Danger
    })
  }
}
const removePaymentAttachment = (idx: number) => {
  deleteTargetIdx.value = idx
  deleteConfirmOpen.value = true
}

const executeDeleteAttachment = async () => {
  if (deleteTargetIdx.value === null) return
  deletingAttachment.value = true
  try {
    const list = [...(paymentDetails.value.paymentAttachments || [])]
    list.splice(deleteTargetIdx.value, 1)
    paymentDetails.value.paymentAttachments = list
    await saveTab2Payment()
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
      void loadAggregatedItems()
      void loadTab2Data()
    }
  },
  { immediate: true }
)
</script>

<style scoped>
@media print {
  @page {
    size: A4;
    margin: 10mm;
  }

  :global(html), :global(body) {
    height: auto !important;
    overflow: visible !important;
  }

  :global(body.is-printing [id="__nuxt"]),
  :global(body.is-printing [id="__layout"]) {
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

  .print-sheet {
    padding: 0;
    background: #fff;
    color: #000;
    font-family: SimSun, 'Songti SC', STSong, 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
  }

  .print-container {
    width: 100%;
  }

  .print-title {
    text-align: center;
    font-size: 20px;
    font-weight: bold;
    margin-top: 10px;
    letter-spacing: 2px;
  }

  .print-subtitle {
    text-align: center;
    margin-top: 6px;
    font-size: 11px;
  }

  .print-meta-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
    font-size: 11px;
  }

  .print-meta-left {
    width: 40%;
    text-align: left;
  }

  .print-meta-center {
    width: 40%;
    text-align: center;
  }

  .print-meta-right {
    width: 20%;
    text-align: right;
  }

  .print-main-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    font-size: 11px;
    border: 1px solid #000;
  }

  .print-th {
    border: 1px solid #000;
    padding: 6px 4px;
    text-align: center;
    font-weight: bold;
    background-color: #f3f4f6 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-td {
    border: 1px solid #000;
    padding: 4px 6px;
    vertical-align: middle;
  }

  .print-subtotal-row {
    font-weight: bold;
    background-color: #f9fafb !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-total-row {
    font-weight: bold;
    background-color: #f3f4f6 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-actual-pay-row {
    font-weight: bold;
    background-color: #eff6ff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-remark-title-row .print-td {
    border-bottom: none;
    padding-top: 8px;
    padding-bottom: 2px;
  }

  .print-remark-content-row .print-td {
    border-top: none;
    border-bottom: none;
    padding-top: 2px;
    padding-bottom: 8px;
    height: 60px;
    vertical-align: top;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .print-note-row .print-td {
    border-top: none;
    padding-top: 2px;
    padding-bottom: 6px;
    font-style: italic;
  }

  .print-sign-area {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    font-size: 11px;
    padding: 0 4px;
  }

  .print-sign-col {
    flex: 1;
    text-align: left;
  }

  .print-sign-col:last-child {
    text-align: right;
  }
}
</style>
