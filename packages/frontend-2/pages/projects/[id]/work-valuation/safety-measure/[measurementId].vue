<template>
  <div class="flex flex-col h-full space-y-4 max-w-full overflow-hidden">
    <!-- 面包屑导航 -->
    <Portal to="current-page">
      <div class="flex items-center space-x-1.5 text-body-sm text-foreground-2">
        <span>项目管理</span>
        <span>/</span>
        <span>验工计价</span>
        <span>/</span>
        <NuxtLink
          :to="`/projects/${projectId}/work-valuation/safety-measure`"
          class="hover:text-primary transition-colors"
        >
          安全文明措施费
        </NuxtLink>
        <span>/</span>
        <span class="text-foreground truncate max-w-[200px]">
          {{ measureCode || '计量单详情' }}
        </span>
      </div>
    </Portal>

    <!-- 顶部项目页眉和位置 -->
    <div class="flex items-center justify-between mt-3 flex-shrink-0">
      <div class="flex items-center space-x-3">
        <NuxtLink
          :to="`/projects/${projectId}/work-valuation/safety-measure`"
          class="flex items-center text-sm text-foreground-2 hover:text-primary transition-colors"
          title="返回列表"
        >
          <ArrowLeftIcon class="h-4 w-4 mr-1" />
          返回
        </NuxtLink>
        <h1 class="text-heading-lg text-foreground font-bold">
          {{ measureCode }} (第{{ roundName }}期)
        </h1>
      </div>
    </div>

    <!-- 主体内容布局 -->
    <div
      class="flex-grow min-h-0 w-full flex flex-col lg:flex-row gap-4 overflow-hidden relative"
    >
      <!-- 左侧：清单表格与意见卡片 -->
      <div class="flex-grow flex flex-col space-y-4 min-h-0 overflow-y-auto pr-2">
        <!-- 明细表格区域 -->
        <div class="bg-foundation border border-outline-3 rounded-lg p-4 flex flex-col">
          <div class="text-center space-y-2 relative">
            <h2 class="text-lg font-bold text-foreground">
              {{ contractName }}&nbsp;{{ baseDateStr }}&nbsp;第{{ roundName }}期
            </h2>
            <div
              class="flex justify-between items-center text-xs text-foreground-2 px-1 pt-2 border-b border-outline-3 pb-1.5"
            >
              <div>
                承建单位（盖章）：
                <span class="font-medium text-foreground">
                  {{ unit || '-' }}
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
          <!-- 树形表格滚动容器 -->
          <div class="overflow-x-auto max-h-[500px] border border-outline-3 rounded">
            <table class="w-full text-xs text-left min-w-[2400px] border-collapse">
              <thead class="bg-[#0f4c9c] text-white text-center sticky top-0 z-10">
                <!-- 第一层表头 -->
                <tr class="border-b border-blue-800 text-[11px] bg-[#0f4c9c]">
                  <th
                    rowspan="2"
                    class="px-2 py-2 border-r border-blue-800 w-12 align-middle text-center"
                  >
                    序号
                  </th>
                  <th
                    rowspan="2"
                    class="px-2 py-2 border-r border-blue-800 w-32 align-middle text-center"
                  >
                    编码
                  </th>
                  <th
                    rowspan="2"
                    class="px-2 py-2 border-r border-blue-800 w-72 align-middle text-left pl-3"
                  >
                    项目名称
                  </th>
                  <th
                    colspan="3"
                    class="px-2 py-1.5 border-r border-blue-800 align-middle text-center"
                  >
                    合同金额（元）
                  </th>
                  <th
                    colspan="2"
                    class="px-2 py-1.5 border-r border-blue-800 align-middle text-center"
                  >
                    施工单位
                  </th>
                  <th
                    colspan="2"
                    class="px-2 py-1.5 border-r border-blue-800 align-middle text-center"
                  >
                    施工监理
                  </th>
                  <th
                    colspan="2"
                    class="px-2 py-1.5 border-r border-blue-800 align-middle text-center"
                  >
                    现场指挥部
                  </th>
                  <th
                    colspan="2"
                    class="px-2 py-1.5 border-r border-blue-800 align-middle text-center"
                  >
                    工程管理部
                  </th>
                  <th
                    colspan="2"
                    class="px-2 py-1.5 border-r border-blue-800 align-middle text-center"
                  >
                    累计完成数
                  </th>
                  <th
                    colspan="2"
                    class="px-2 py-1.5 border-r border-blue-800 align-middle text-center"
                  >
                    剩余
                  </th>
                  <th rowspan="2" class="px-2 py-2 w-36 align-middle text-center">
                    备注
                  </th>
                </tr>
                <!-- 第二层表头 -->
                <tr class="border-b border-blue-800 text-[10px] bg-[#1a5ba8]">
                  <!-- 合同金额 -->
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    单价
                  </th>
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    数量
                  </th>
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    合价
                  </th>
                  <!-- 施工单位 -->
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    数量
                  </th>
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    金额
                  </th>
                  <!-- 施工监理 -->
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    数量
                  </th>
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    金额
                  </th>
                  <!-- 现场指挥部 -->
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    数量
                  </th>
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    金额
                  </th>
                  <!-- 工程管理部 -->
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    数量
                  </th>
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    金额
                  </th>
                  <!-- 累计完成数 -->
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    数量
                  </th>
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    金额
                  </th>
                  <!-- 剩余 -->
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    数量
                  </th>
                  <th class="px-2 py-1 border-r border-blue-800 text-right pr-3">
                    金额
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in visibleTreeRows"
                  :key="row.boqItemId"
                  class="border-b border-outline-3 hover:bg-highlight-1/20 transition-colors text-[11px]"
                  :class="
                    row.isSummaryRow
                      ? 'bg-highlight-1/5 font-semibold text-foreground'
                      : 'bg-foundation text-foreground-2'
                  "
                >
                  <!-- 1. 序号 -->
                  <td class="px-2 py-2 text-center border-r border-outline-3 font-mono">
                    {{ getRowIndex(row) }}
                  </td>

                  <!-- 2. 编码 -->
                  <td class="px-2 py-2 truncate font-mono border-r border-outline-3">
                    {{ row.boqCode }}
                  </td>

                  <!-- 3. 项目名称 (含折叠缩进) -->
                  <td class="px-2 py-2 border-r border-outline-3 pl-3">
                    <div
                      class="flex items-center"
                      :style="{
                        paddingLeft: `${Math.max(0, row.boqDepth - 1) * 12}px`
                      }"
                    >
                      <button
                        v-if="hasChildren(row)"
                        class="mr-1 hover:bg-highlight-1/30 rounded p-0.5 transition-colors focus:outline-none flex-shrink-0"
                        @click.stop="toggleExpand(row)"
                      >
                        <svg
                          v-if="row.isExpanded"
                          class="h-3 w-3 text-foreground-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="3"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                        <svg
                          v-else
                          class="h-3 w-3 text-foreground-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="3"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                      <span v-else class="w-4 inline-block flex-shrink-0"></span>
                      <span
                        class="truncate"
                        :title="row.boqName"
                        :class="row.isSummaryRow ? 'font-bold' : ''"
                      >
                        <template v-if="row.isSummaryRow">
                          {{ row.boqName }}
                        </template>
                        <template v-else>
                          {{ row.boqName }}
                        </template>
                      </span>
                    </div>
                  </td>

                  <!-- 合同价：单价/数量/合价 -->
                  <td
                    class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3"
                  >
                    <span v-if="!row.isSummaryRow">{{ formatMoney(row.price) }}</span>
                    <span v-else>-</span>
                  </td>
                  <td
                    class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3"
                  >
                    {{ formatQty(row.contractQty) }}
                  </td>
                  <td
                    class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3 font-semibold"
                  >
                    {{ formatMoney(row.contractAmount) }}
                  </td>

                  <!-- 施工单位数量 & 金额 -->
                  <td class="px-2 py-1 border-r border-outline-3 w-28">
                    <input
                      v-if="!row.isSummaryRow"
                      v-model.number="row.contractorQty"
                      type="number"
                      step="any"
                      :disabled="!permissions.contractor"
                      class="w-full text-right bg-foundation border border-outline-3 rounded px-1 py-0.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono text-[11px]"
                      @input="onQtyInput(row, 'contractor')"
                    />
                    <span
                      v-else
                      class="font-mono pr-3 inline-block w-full text-right font-bold"
                    >
                      {{ formatQty(row.contractorQty) }}
                    </span>
                  </td>
                  <td
                    class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3"
                  >
                    {{ formatMoney(row.contractorAmount) }}
                  </td>

                  <!-- 施工监理数量 & 金额 -->
                  <td class="px-2 py-1 border-r border-outline-3 w-28">
                    <input
                      v-if="!row.isSummaryRow"
                      v-model.number="row.supervisionQty"
                      type="number"
                      step="any"
                      :disabled="!permissions.supervision"
                      class="w-full text-right bg-foundation border border-outline-3 rounded px-1 py-0.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono text-[11px]"
                      @input="onQtyInput(row, 'supervision')"
                    />
                    <span
                      v-else
                      class="font-mono pr-3 inline-block w-full text-right font-bold"
                    >
                      {{ formatQty(row.supervisionQty) }}
                    </span>
                  </td>
                  <td
                    class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3"
                  >
                    {{ formatMoney(row.supervisionAmount) }}
                  </td>

                  <!-- 现场指挥部数量 & 金额 -->
                  <td class="px-2 py-1 border-r border-outline-3 w-28">
                    <input
                      v-if="!row.isSummaryRow"
                      v-model.number="row.headquartersQty"
                      type="number"
                      step="any"
                      :disabled="!permissions.headquarters"
                      class="w-full text-right bg-foundation border border-outline-3 rounded px-1 py-0.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono text-[11px]"
                      @input="onQtyInput(row, 'headquarters')"
                    />
                    <span
                      v-else
                      class="font-mono pr-3 inline-block w-full text-right font-bold"
                    >
                      {{ formatQty(row.headquartersQty) }}
                    </span>
                  </td>
                  <td
                    class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3"
                  >
                    {{ formatMoney(row.headquartersAmount) }}
                  </td>

                  <!-- 工管部数量 & 金额 -->
                  <td class="px-2 py-1 border-r border-outline-3 w-28">
                    <input
                      v-if="!row.isSummaryRow"
                      v-model.number="row.engineeringQty"
                      type="number"
                      step="any"
                      :disabled="!permissions.engineering"
                      class="w-full text-right bg-foundation border border-outline-3 rounded px-1 py-0.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono text-[11px]"
                      @input="onQtyInput(row, 'engineering')"
                    />
                    <span
                      v-else
                      class="font-mono pr-3 inline-block w-full text-right font-bold"
                    >
                      {{ formatQty(row.engineeringQty) }}
                    </span>
                  </td>
                  <td
                    class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3"
                  >
                    {{ formatMoney(row.engineeringAmount) }}
                  </td>

                  <!-- 累计完成数数量与金额 -->
                  <td
                    class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3"
                  >
                    {{ formatQty(row.cumulativeQty) }}
                  </td>
                  <td
                    class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3"
                  >
                    {{ formatMoney(row.cumulativeAmount) }}
                  </td>

                  <!-- 剩余数量与金额 -->
                  <td
                    class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3"
                  >
                    {{ formatQty(row.remainingQty) }}
                  </td>
                  <td
                    class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3"
                  >
                    {{ formatMoney(row.remainingAmount) }}
                  </td>

                  <!-- 备注 -->
                  <td
                    class="px-2 py-2 text-center text-foreground-2 truncate max-w-[100px]"
                  >
                    {{ row.isSummaryRow ? '-' : row.remark || '-' }}
                  </td>
                </tr>

                <!-- 总价合计行 -->
                <tr
                  class="bg-[#0f4c9c] font-bold text-white border-t border-blue-900 sticky bottom-0 z-10 text-[11px]"
                >
                  <td class="px-2 py-2.5 text-center border-r border-blue-800" />
                  <td
                    class="px-2 py-2.5 text-left pl-3 border-r border-blue-800 font-bold"
                  >
                    总价
                  </td>
                  <td class="px-2 py-2.5 text-center border-r border-blue-800" />
                  <td class="px-2 py-2.5 text-center border-r border-blue-800">-</td>
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3"
                  >
                    {{ formatQty(totalSums.contractQty) }}
                  </td>
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3"
                  >
                    {{ formatMoney(totalSums.contractAmount) }}
                  </td>
                  <!-- 施工单位填报数量 & 金额 -->
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3"
                  >
                    {{ formatQty(totalSums.contractorQty) }}
                  </td>
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3"
                  >
                    {{ formatMoney(totalSums.contractorAmount) }}
                  </td>
                  <!-- 施工监理数量 & 金额 -->
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3"
                  >
                    {{ formatQty(totalSums.supervisionQty) }}
                  </td>
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3"
                  >
                    {{ formatMoney(totalSums.supervisionAmount) }}
                  </td>
                  <!-- 现场指挥部数量 & 金额 -->
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3"
                  >
                    {{ formatQty(totalSums.headquartersQty) }}
                  </td>
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3"
                  >
                    {{ formatMoney(totalSums.headquartersAmount) }}
                  </td>
                  <!-- 工管部数量 & 金额 -->
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3"
                  >
                    {{ formatQty(totalSums.engineeringQty) }}
                  </td>
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3"
                  >
                    {{ formatMoney(totalSums.engineeringAmount) }}
                  </td>
                  <!-- 累计完成数数量与金额 -->
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3"
                  >
                    {{ formatQty(totalSums.cumulativeQty) }}
                  </td>
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3 text-white"
                  >
                    {{ formatMoney(totalSums.cumulativeAmount) }}
                  </td>
                  <!-- 剩余数量与金额 -->
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3"
                  >
                    {{ formatQty(totalSums.remainingQty) }}
                  </td>
                  <td
                    class="px-2 py-2.5 text-right border-r border-blue-800 font-mono pr-3 text-white"
                  >
                    {{ formatMoney(totalSums.remainingAmount) }}
                  </td>
                  <!-- 备注 -->
                  <td class="px-2 py-2.5 text-center" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 审核签署意见卡片区 (3防意见卡片，精简布局) -->
        <div class="bg-foundation space-y-4 shadow-sm">
          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <!-- 监理意见 -->
            <div
              class="p-4 border border-outline-3 rounded-lg bg-foundation-2 space-y-3 flex flex-col justify-between"
            >
              <span class="text-xs font-semibold text-foreground-2">施工监理意见</span>
              <textarea
                v-model="details.supervisionOpinion"
                placeholder="请输入监理审核意见"
                :disabled="!permissions.supervision"
                class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs focus:outline-none focus:border-primary disabled:opacity-60 h-20"
              />
              <div class="space-y-2">
                <div class="flex items-center space-x-2 text-xs">
                  <span class="text-foreground-2 flex-shrink-0 w-12 text-right">
                    经办人
                  </span>
                  <div
                    class="flex-grow rounded border border-outline-3 bg-foundation px-2 py-1"
                  >
                    <span class="font-medium text-foreground">
                      {{ details.supervisionAuditor || '-' }}
                    </span>
                  </div>
                  <span class="text-foreground-2 flex-shrink-0">日期</span>
                  <div
                    class="w-24 rounded border border-outline-3 bg-foundation px-2 py-1 text-center"
                  >
                    <span class="font-mono text-foreground text-[11px]">
                      {{
                        details.supervisionDate
                          ? formatDate(details.supervisionDate)
                          : '-'
                      }}
                    </span>
                  </div>
                </div>
                <div class="flex items-center space-x-2 text-xs">
                  <span class="text-foreground-2 flex-shrink-0 w-12 text-right">
                    审核人
                  </span>
                  <div
                    class="flex-grow rounded border border-outline-3 bg-foundation px-2 py-1"
                  >
                    <span class="font-medium text-foreground">
                      {{ details.supervisionApproveAuditor || '-' }}
                    </span>
                  </div>
                  <span class="text-foreground-2 flex-shrink-0">日期</span>
                  <div
                    class="w-24 rounded border border-outline-3 bg-foundation px-2 py-1 text-center"
                  >
                    <span class="font-mono text-foreground text-[11px]">
                      {{
                        details.supervisionApproveDate
                          ? formatDate(details.supervisionApproveDate)
                          : '-'
                      }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 指挥部意见 -->
            <div
              class="p-4 border border-outline-3 rounded-lg bg-foundation-2 space-y-3 flex flex-col justify-between"
            >
              <span class="text-xs font-semibold text-foreground-2">
                现场指挥部意见
              </span>
              <textarea
                v-model="details.headquartersOpinion"
                placeholder="请输入现场指挥部审核意见"
                :disabled="!permissions.headquarters"
                class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs focus:outline-none focus:border-primary disabled:opacity-60 h-20"
              />
              <div class="space-y-2">
                <div class="flex items-center space-x-2 text-xs">
                  <span class="text-foreground-2 flex-shrink-0 w-12 text-right">
                    经办人
                  </span>
                  <div
                    class="flex-grow rounded border border-outline-3 bg-foundation px-2 py-1"
                  >
                    <span class="font-medium text-foreground">
                      {{ details.headquartersAuditor || '-' }}
                    </span>
                  </div>
                  <span class="text-foreground-2 flex-shrink-0">日期</span>
                  <div
                    class="w-24 rounded border border-outline-3 bg-foundation px-2 py-1 text-center"
                  >
                    <span class="font-mono text-foreground text-[11px]">
                      {{
                        details.headquartersDate
                          ? formatDate(details.headquartersDate)
                          : '-'
                      }}
                    </span>
                  </div>
                </div>
                <div class="flex items-center space-x-2 text-xs">
                  <span class="text-foreground-2 flex-shrink-0 w-12 text-right">
                    审核人
                  </span>
                  <div
                    class="flex-grow rounded border border-outline-3 bg-foundation px-2 py-1"
                  >
                    <span class="font-medium text-foreground">
                      {{ details.headquartersApproveAuditor || '-' }}
                    </span>
                  </div>
                  <span class="text-foreground-2 flex-shrink-0">日期</span>
                  <div
                    class="w-24 rounded border border-outline-3 bg-foundation px-2 py-1 text-center"
                  >
                    <span class="font-mono text-foreground text-[11px]">
                      {{
                        details.headquartersApproveDate
                          ? formatDate(details.headquartersApproveDate)
                          : '-'
                      }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 工程管理部意见 -->
            <div
              class="p-4 border border-outline-3 rounded-lg bg-foundation-2 space-y-3 flex flex-col justify-between"
            >
              <span class="text-xs font-semibold text-foreground-2">
                工程管理部审核意见
              </span>
              <textarea
                v-model="details.engineeringOpinion"
                placeholder="请输入工程管理部审核意见"
                :disabled="!permissions.engineering"
                class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs focus:outline-none focus:border-primary disabled:opacity-60 h-20"
              />
              <div class="space-y-2">
                <div class="flex items-center space-x-2 text-xs">
                  <span class="text-foreground-2 flex-shrink-0 w-12 text-right">
                    经办人
                  </span>
                  <div
                    class="flex-grow rounded border border-outline-3 bg-foundation px-2 py-1"
                  >
                    <span class="font-medium text-foreground">
                      {{ details.engineeringAuditor || '-' }}
                    </span>
                  </div>
                  <span class="text-foreground-2 flex-shrink-0">日期</span>
                  <div
                    class="w-24 rounded border border-outline-3 bg-foundation px-2 py-1 text-center"
                  >
                    <span class="font-mono text-foreground text-[11px]">
                      {{
                        details.engineeringDate
                          ? formatDate(details.engineeringDate)
                          : '-'
                      }}
                    </span>
                  </div>
                </div>
                <div class="flex items-center space-x-2 text-xs">
                  <span class="text-foreground-2 flex-shrink-0 w-12 text-right">
                    审核人
                  </span>
                  <div
                    class="flex-grow rounded border border-outline-3 bg-foundation px-2 py-1"
                  >
                    <span class="font-medium text-foreground">
                      {{ details.engineeringApproveAuditor || '-' }}
                    </span>
                  </div>
                  <span class="text-foreground-2 flex-shrink-0">日期</span>
                  <div
                    class="w-24 rounded border border-outline-3 bg-foundation px-2 py-1 text-center"
                  >
                    <span class="font-mono text-foreground text-[11px]">
                      {{
                        details.engineeringApproveDate
                          ? formatDate(details.engineeringApproveDate)
                          : '-'
                      }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作控制栏 -->
        <div
          class="bg-foundation border border-outline-3 rounded-lg p-3 flex justify-center items-center gap-4 flex-shrink-0 shadow-sm mt-4"
        >
          <FormButton color="outline" @click="attachmentsDialogOpen = true">
            <PaperClipIcon class="h-4 w-4 mr-1 text-foreground-2" />
            附件 ({{ details.attachments?.length || 0 }})
          </FormButton>

          <FormButton color="outline" @click="coverDialogOpen = true">
            <span class="flex items-center gap-1">
              <DocumentTextIcon class="h-4 w-4 text-foreground-2" />
              封面
            </span>
          </FormButton>

          <FormButton
            v-if="isEditable"
            color="primary"
            :loading="saving"
            @click="saveAllData(false)"
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

          <FormButton
            color="outline"
            class="border-primary text-primary"
            @click="handlePrintCover"
          >
            <span class="flex items-center gap-1">
              <PrinterIcon class="h-4 w-4" />
              打印封面
            </span>
          </FormButton>

          <FormButton
            color="outline"
            class="border-primary text-primary"
            @click="handlePrintDetail"
          >
            <span class="flex items-center gap-1">
              <PrinterIcon class="h-4 w-4" />
              打印明细表
            </span>
          </FormButton>

          <FormButton color="outline" @click="goBack">
            <span>返回</span>
          </FormButton>
        </div>
      </div>

      <!-- 右侧：工作流审批轨迹面板 -->
      <div
        v-if="flowInstanceId"
        class="fixed right-0 top-12 bottom-0 z-40 flex flex-col border-l border-outline-3 bg-foundation h-[calc(100vh-48px)] overflow-hidden transition-transform duration-300 ease-in-out shadow-2xl w-[320px]"
        :class="[
          isSidebarExpanded ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        ]"
      >
        <!-- 面板标题 -->
        <div
          class="p-3 border-b border-outline-3 flex items-center justify-between flex-shrink-0 bg-foundation-2 h-[48px]"
        >
          <span class="text-sm font-bold text-foreground">审批流程</span>
          <button
            class="p-1 hover:bg-highlight-1 rounded text-foreground-2 flex items-center justify-center transition-colors"
            @click="isSidebarExpanded = false"
          >
            <ChevronRightIcon class="h-4 w-4" />
          </button>
        </div>

        <!-- 面板主体 -->
        <div class="flex-grow flex flex-col min-h-0 overflow-y-auto p-4 space-y-5">
          <!-- 流程总体状态 -->
          <div
            class="flex items-center justify-between text-xs pb-3 border-b border-outline-3"
          >
            <span class="text-foreground-2">流程状态:</span>
            <CommonBadge
              :color-classes="getStatusColor(flowInstance?.status || approveStatus)"
              class="text-xs font-semibold"
              rounded
            >
              {{ formatFlowStatusLabel(flowInstance?.status || approveStatus) }}
            </CommonBadge>
          </div>

          <!-- 当前审核节点 -->
          <div
            v-if="flowInstance?.status === 'PENDING'"
            class="bg-primary-muted/20 border border-primary/20 rounded-lg p-3 text-xs space-y-1"
          >
            <div class="font-semibold text-primary flex items-center gap-1.5">
              <ClockIcon class="h-4 w-4 flex-shrink-0" />
              <span>当前步骤: {{ getCurrentFlowStepName(flowInstance) }}</span>
            </div>
            <div class="text-foreground-2 pl-5">
              待办人:
              {{
                flowInstance.steps
                  ?.find((s: any) => s.status === 'PENDING')
                  ?.approvers?.map((u: any) => u?.name)
                  .filter(Boolean)
                  .join(', ') || '所有人'
              }}
            </div>
          </div>

          <!-- 审批决策按钮区域 -->
          <div
            v-if="flowInstance?.status === 'PENDING' && (isTodoUser || isCreator)"
            class="bg-foundation-2 border border-outline-3 rounded-lg p-3 space-y-3"
          >
            <FormTextArea
              v-model="reviewComment"
              name="review-comment"
              label="审核审批意见"
              placeholder="请输入您的审批意见（选填）"
              :rows="3"
              class="text-xs"
            />
            <div class="flex gap-2 justify-end">
              <template v-if="isTodoUser">
                <FormButton
                  v-if="!isStartStep"
                  color="danger"
                  size="sm"
                  :disabled="mutating"
                  :loading="mutating"
                  @click="confirmReject"
                >
                  驳回
                </FormButton>
                <FormButton
                  color="primary"
                  size="sm"
                  :disabled="mutating"
                  :loading="mutating"
                  @click="confirmApprove"
                >
                  {{ isStartStep ? '重新送审' : '通过' }}
                </FormButton>
              </template>
              <template v-else-if="isCreator">
                <FormButton
                  color="outline"
                  size="sm"
                  :disabled="mutating"
                  :loading="mutating"
                  @click="confirmCancel"
                >
                  取消流程
                </FormButton>
              </template>
            </div>
          </div>

          <!-- 审批流Timeline -->
          <div class="space-y-3">
            <h3 class="text-xs font-bold text-foreground flex items-center gap-1">
              <QueueListIcon class="h-4 w-4 text-foreground-2" />
              <span>审批节点列表</span>
            </h3>
            <div class="space-y-2.5">
              <div
                v-for="step in flowInstance?.steps"
                :key="step.id"
                class="border rounded-lg p-3 text-xs"
                :class="getFlowStepCardClass(step.status)"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium text-foreground">
                    步骤 {{ step.stepIndex }} · {{ step.name }}
                  </span>
                  <span
                    class="px-1.5 py-0.5 rounded-full text-[10px]"
                    :class="getFlowStepTagClass(step.status)"
                  >
                    {{ formatFlowStepStatusLabel(step.status) }}
                  </span>
                </div>
                <div class="text-foreground-2 mt-1.5">
                  审核人:
                  {{
                    step.approvers
                      ?.map((u: any) => u?.name)
                      .filter(Boolean)
                      .join('、') || '所有权限用户'
                  }}
                </div>
              </div>
            </div>
          </div>

          <!-- 审批日志 (Logs) -->
          <div class="space-y-3">
            <h3 class="text-xs font-bold text-foreground flex items-center gap-1">
              <ChatBubbleLeftEllipsisIcon class="h-4 w-4 text-foreground-2" />
              <span>审批日志</span>
            </h3>
            <div
              v-if="!flowInstance?.actions?.length"
              class="text-xs text-foreground-2 text-center py-4 border border-dashed rounded-lg border-outline-3 bg-foundation-2"
            >
              暂无审批日志
            </div>
            <div v-else class="space-y-3 pl-2 border-l border-outline-3 ml-2">
              <div
                v-for="action in flowInstance.actions"
                :key="action.id"
                class="relative pl-4 text-xs space-y-0.5"
              >
                <div
                  class="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-foundation-page bg-outline-3"
                  :class="[
                    action.action === 'APPROVED' || action.action === 'STEP_APPROVED'
                      ? 'bg-success'
                      : '',
                    action.action === 'REJECTED' || action.action === 'TIMEOUT_REJECTED'
                      ? 'bg-danger'
                      : '',
                    action.action === 'CANCELED' ? 'bg-foreground-2' : ''
                  ]"
                />
                <div class="font-medium text-foreground">
                  {{ formatFlowActionLabel(action.action) }}
                </div>
                <div class="text-[11px] text-foreground-2 flex flex-wrap gap-x-2">
                  <span>经办人: {{ action.actor?.name || action.actorId || '-' }}</span>
                  <span>·</span>
                  <span class="font-mono">{{ formatDateTime(action.createdAt) }}</span>
                </div>
                <div
                  v-if="action.comment"
                  class="mt-1 p-2 bg-foundation-2 border border-outline-3 rounded text-[11px] text-foreground italic break-all"
                >
                  "{{ action.comment }}"
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 悬浮触发面板按钮 (移动端) -->
      <button
        v-if="flowInstanceId && !isSidebarExpanded"
        class="fixed right-0 top-1/2 -translate-y-1/2 z-40 rounded-l-lg bg-primary hover:bg-primary-focus text-white shadow-md px-2 py-3.5 flex flex-col items-center gap-1.5 transition-all select-none cursor-pointer"
        @click="isSidebarExpanded = true"
      >
        <QueueListIcon class="h-5 w-5" />
        <span
          class="text-[10px] font-bold tracking-widest"
          style="writing-mode: vertical-rl"
        >
          审批流程
        </span>
      </button>
    </div>

    <!-- 流程通过、驳回二次确认弹窗 -->
    <CommonConfirmDialog
      v-model:open="confirmDialogOpen"
      :title="confirmDialogTitle"
      :text="confirmDialogText"
      :confirm-text="confirmDialogConfirmText"
      :loading="mutating"
      @confirm="handleConfirm"
    />

    <!-- 附件弹出层 LayoutDialog -->
    <LayoutDialog v-model:open="attachmentsDialogOpen" max-width="md">
      <template #header>计量附件管理</template>
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <span class="text-sm font-semibold">
            附件列表 ({{ details.attachments?.length || 0 }} 个)
          </span>
          <input
            ref="fileInputRef"
            type="file"
            class="hidden"
            multiple
            @change="handleFileUpload"
          />
          <FormButton
            v-if="isEditable"
            size="sm"
            color="primary"
            @click="triggerUpload"
          >
            上传新文件
          </FormButton>
        </div>

        <div
          v-if="details.attachments?.length"
          class="space-y-2 max-h-[300px] overflow-y-auto pr-1"
        >
          <div
            v-for="(attachment, aIdx) in details.attachments"
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
              <a
                v-if="attachment.blobId"
                :href="getBlobDownloadUrl(attachment.blobId)"
                target="_blank"
                class="text-primary hover:underline font-medium"
              >
                下载
              </a>
              <button
                v-if="isEditable"
                class="text-danger hover:underline font-medium"
                @click="removeAttachment(Number(aIdx))"
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

    <!-- 封面弹出层 LayoutDialog -->
    <LayoutDialog v-model:open="coverDialogOpen" max-width="lg">
      <template #header>安全文明措施费计量封面</template>
      <div
        id="print-cover-area"
        class="p-6 bg-white text-black font-sans space-y-6 max-h-[600px] overflow-y-auto"
      >
        <div class="text-center space-y-2">
          <h1 class="text-xl font-bold tracking-widest border-b-2 border-black pb-2">
            安全文明措施费计量支付证书封面
          </h1>
        </div>

        <table class="w-full border-collapse border border-black text-xs">
          <tbody>
            <tr>
              <td
                class="border border-black px-3 py-2 font-semibold bg-gray-50 w-28 text-center"
              >
                项目名称
              </td>
              <td
                colspan="3"
                class="border border-black px-4 py-2 text-left font-medium"
              >
                {{ contractName }}
              </td>
            </tr>
            <tr>
              <td
                class="border border-black px-3 py-2 font-semibold bg-gray-50 text-center"
              >
                合同编号
              </td>
              <td class="border border-black px-4 py-2 text-left font-mono">
                {{ projectContractCode }}
              </td>
              <td
                class="border border-black px-3 py-2 font-semibold bg-gray-50 w-28 text-center"
              >
                计量期号
              </td>
              <td class="border border-black px-4 py-2 text-left">
                {{ roundName ? '第' + roundName + '期' : '-' }}
              </td>
            </tr>
            <tr>
              <td
                class="border border-black px-3 py-2 font-semibold bg-gray-50 text-center"
              >
                基准年月
              </td>
              <td class="border border-black px-4 py-2 text-left font-mono">
                {{ baseDateStr }}
              </td>
              <td
                class="border border-black px-3 py-2 font-semibold bg-gray-50 text-center"
              >
                计量期间
              </td>
              <td class="border border-black px-4 py-2 text-left font-mono text-xs">
                {{ startDateStr }} ~ {{ endDateStr }}
              </td>
            </tr>
            <tr>
              <td
                class="border border-black px-3 py-2 font-semibold bg-gray-50 text-center"
              >
                施工单位
              </td>
              <td colspan="3" class="border border-black px-4 py-2 text-left">
                {{ unit || '-' }}
              </td>
            </tr>
          </tbody>
        </table>

        <table class="w-full border-collapse border border-black text-xs">
          <tbody>
            <tr>
              <td
                class="border border-black px-3 py-2 font-semibold bg-gray-50 w-28 text-center"
              >
                合同总价 (元)
              </td>
              <td
                class="border border-black px-4 py-2 font-mono text-right font-semibold pr-4"
                colspan="3"
              >
                {{ formatMoney(totalSums.contractAmount) }}
              </td>
            </tr>
            <tr>
              <td
                class="border border-black px-3 py-2 font-semibold bg-gray-50 w-28 text-center"
              >
                本期申报 (元)
              </td>
              <td class="border border-black px-4 py-2 font-mono text-right pr-4 w-1/3">
                {{ formatMoney(totalSums.contractorAmount) }}
              </td>
              <td
                class="border border-black px-3 py-2 font-semibold bg-gray-50 w-28 text-center"
              >
                本期核定 (元)
              </td>
              <td
                class="border border-black px-4 py-2 font-mono text-right text-primary font-bold pr-4"
              >
                {{ formatMoney(totalSums.engineeringAmount) }}
              </td>
            </tr>
            <tr>
              <td
                class="border border-black px-3 py-2 font-semibold bg-gray-50 text-center"
              >
                本年累计 (元)
              </td>
              <td class="border border-black px-4 py-2 font-mono text-right pr-4">
                {{ formatMoney(totalSums.yearlyAmount) }}
              </td>
              <td
                class="border border-black px-3 py-2 font-semibold bg-gray-50 text-center"
              >
                开工累计 (元)
              </td>
              <td class="border border-black px-4 py-2 font-mono text-right pr-4">
                {{ formatMoney(totalSums.cumulativeAmount) }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 四方签字盖章表格 -->
        <table class="w-full border-collapse border border-black text-xs">
          <tbody>
            <tr>
              <td class="border border-black p-3 w-1/2 h-28 valign-top relative">
                <div class="font-semibold mb-1">施工单位负责人意见：</div>
                <div class="text-foreground-2 italic text-[10px] mb-6">同意申报。</div>
                <div class="absolute bottom-2 right-4 text-right scale-95 origin-right">
                  签章：___________________
                  <br />
                  日期：______年___月___日
                </div>
              </td>
              <td class="border border-black p-3 w-1/2 h-28 valign-top relative">
                <div class="font-semibold mb-1">监理工程师审核意见：</div>
                <div class="text-foreground-2 italic text-[10px] mb-6">
                  {{ details.supervisionOpinion || '同意。' }}
                </div>
                <div class="absolute bottom-2 right-4 text-right scale-95 origin-right">
                  经办人签字：{{ details.supervisionAuditor || '___________________' }}
                  <br />
                  审核人签字：{{
                    details.supervisionApproveAuditor || '___________________'
                  }}
                  <br />
                  日期：{{
                    details.supervisionApproveDate
                      ? formatDate(details.supervisionApproveDate)
                      : details.supervisionDate
                      ? formatDate(details.supervisionDate)
                      : '______年___月___日'
                  }}
                </div>
              </td>
            </tr>
            <tr>
              <td class="border border-black p-3 w-1/2 h-28 valign-top relative">
                <div class="font-semibold mb-1">现场指挥部核定意见：</div>
                <div class="text-foreground-2 italic text-[10px] mb-6">
                  {{ details.headquartersOpinion || '同意。' }}
                </div>
                <div class="absolute bottom-2 right-4 text-right scale-95 origin-right">
                  经办人签字：{{ details.headquartersAuditor || '___________________' }}
                  <br />
                  审核人签字：{{
                    details.headquartersApproveAuditor || '___________________'
                  }}
                  <br />
                  日期：{{
                    details.headquartersApproveDate
                      ? formatDate(details.headquartersApproveDate)
                      : details.headquartersDate
                      ? formatDate(details.headquartersDate)
                      : '______年___月___日'
                  }}
                </div>
              </td>
              <td class="border border-black p-3 w-1/2 h-28 valign-top relative">
                <div class="font-semibold mb-1">工程管理部审核意见：</div>
                <div class="text-foreground-2 italic text-[10px] mb-6">
                  {{ details.engineeringOpinion || '同意。' }}
                </div>
                <div class="absolute bottom-2 right-4 text-right scale-95 origin-right">
                  经办人签字：{{ details.engineeringAuditor || '___________________' }}
                  <br />
                  审核人签字：{{
                    details.engineeringApproveAuditor || '___________________'
                  }}
                  <br />
                  日期：{{
                    details.engineeringApproveDate
                      ? formatDate(details.engineeringApproveDate)
                      : details.engineeringDate
                      ? formatDate(details.engineeringDate)
                      : '______年___月___日'
                  }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <FormButton
            color="primary"
            size="sm"
            @click="
              () => {
                coverDialogOpen = false
                handlePrintCover()
              }
            "
          >
            打印封面
          </FormButton>
          <FormButton color="outline" size="sm" @click="coverDialogOpen = false">
            关闭
          </FormButton>
        </div>
      </template>
    </LayoutDialog>

    <!-- 驳回弹窗选择节点 -->
    <LayoutDialog
      v-model:open="rejectDialogOpen"
      max-width="md"
      :buttons="rejectDialogButtons"
    >
      <template #header>驳回审批</template>
      <div class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-foreground">选择退回目标节点</label>
          <select
            v-model="selectedRollbackStep"
            class="w-full text-xs bg-foundation border border-outline-3 rounded px-3 py-2 focus:outline-none focus:border-primary text-foreground"
          >
            <option
              v-for="step in rejectTargetSteps"
              :key="step.id"
              :value="step.stepIndex"
            >
              Step {{ step.stepIndex }} · {{ step.name }}
            </option>
          </select>
        </div>
        <FormTextArea
          v-model="reviewComment"
          name="reject-comment"
          label="驳回意见"
          placeholder="请输入驳回意见（必填）"
          :rows="3"
          class="text-xs"
        />
      </div>
    </LayoutDialog>

    <!-- 打印专属内容区域 (使用 Teleport 传送至 body 根节点，以彻底解决预览空白问题) -->
    <Teleport v-if="isPrinting" to="body">
      <div id="print-section" class="text-black bg-white p-6 font-sans">
        <!-- 1. 打印封面 (支付申请表) -->
        <div v-if="printType === 'cover'" class="space-y-6">
          <div class="text-center space-y-2 relative">
            <h1 class="text-2xl font-bold tracking-wider">
              安全防护、文明施工措施费用支付申请表
            </h1>
          </div>

          <div
            class="flex justify-between items-center text-xs px-1 pt-4 font-semibold"
          >
            <div>工程名称：{{ contractName }}</div>
            <div>编号：{{ measureCode || '-' }}</div>
          </div>

          <!-- 监理审查及审核意见表格 (样式高度还原 Excel) -->
          <table class="w-full border-collapse border border-black text-xs mt-8">
            <tbody>
              <tr>
                <td class="border border-black p-4 w-full h-44 valign-top relative">
                  <div class="text-xs font-semibold pt-2 text-left">
                    致：{{ supervisionUnitName }} (监理单位)
                  </div>

                  <div
                    class="text-xs leading-relaxed text-left indent-8 pt-4 pb-8 whitespace-pre-line border-black"
                  >
                    我单位已按照安全防护、文明施工措施费用使用计划，完成了安全防护、文明施工措施，按照施工合同规定，建设单位应在____年____月____日支付该措施费用共计人民币
                    <span class="underline font-bold px-2">
                      {{ amountToChinese(totalSums.contractorAmount) }}
                    </span>
                    整（小写：
                    <span class="underline font-bold px-2">
                      {{ formatMoney(totalSums.contractorAmount) }}
                    </span>
                    元），请予以审核。 附：安全防护、文明施工措施专项资金投入使用清单
                  </div>

                  <div class="flex w-full justify-end items-start text-xs pt-8">
                    <div class="flex flex-col justify-end h-12 gap-2">
                      <div>施工单位：{{ unit || '-' }}</div>
                      <div>项目经理：{{ creatorName }}</div>
                      <div>
                        日期：{{
                          flowInitiatorDate !== '-'
                            ? dayjs(flowInitiatorDate).format('YYYY年MM月DD日')
                            : ''
                        }}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="border border-black p-4 w-full h-44 valign-top relative">
                  <div class="font-bold mb-2">审查意见：</div>
                  <div class="text-gray-700 italic text-[11px] min-h-[60px] pl-4">
                    {{ details.supervisionOpinion }}
                  </div>
                  <div class="flex justify-end space-y-1">
                    <div class="flex flex-col gap-6">
                      <span>
                        安全监理人员：{{
                          details.supervisionAuditor || '___________________'
                        }}
                      </span>
                      <span>
                        专业工程师：{{
                          details.supervisionApproveAuditor || '___________________'
                        }}
                      </span>
                      <span>日期：______年___月___日</span>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="border border-black p-4 w-full h-44 valign-top relative">
                  <div class="font-bold mb-2">审核意见：</div>
                  <div class="text-gray-700 italic text-[11px] min-h-[60px] pl-4">
                    {{ details.supervisionOpinion }}
                  </div>
                  <div class="flex justify-end space-y-1">
                    <div class="flex flex-col gap-6">
                      <span>项目监理机构：{{ supervisionUnitName }}</span>
                      <span>
                        总监理工程师：{{
                          supervisionReviewApproverDisplay || '___________________'
                        }}
                      </span>
                      <span>
                      日期：______年___月___日</span>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 2. 打印明细表 -->
        <div v-if="printType === 'detail'" class="space-y-6">
          <div class="text-center space-y-2 relative">
            <h1 class="text-2xl font-bold tracking-wider">
              {{ contractName }}安全防护、文明施工措施费用使用明细单
            </h1>
            <div
              class="flex justify-between items-center text-xs px-1 pt-4 font-semibold"
            >
              <div>
                {{
                  baseDateStr
                    ? baseDateStr.split('-')[0] +
                      '年' +
                      baseDateStr.split('-')[1] +
                      '月'
                    : '______年___月'
                }}&nbsp;&nbsp;&nbsp;&nbsp;{{
                  roundName ? '第' + roundName + '期' : '第1期'
                }}
              </div>
              <div>单位：元</div>
            </div>
          </div>

          <table
            class="print-table w-full text-[10px] text-left border-collapse border border-black"
          >
            <thead>
              <tr class="font-bold text-center border-b border-black">
                <th rowspan="3" class="w-10 border-r border-black">序号</th>
                <th rowspan="3" class="w-20 border-r border-black">编码</th>
                <th rowspan="3" class="border-r border-black text-left pl-3 w-56">
                  项目名称
                </th>
                <th rowspan="3" class="border-r border-black text-right pr-3 w-28">
                  合同金额（元）
                </th>
                <th
                  colspan="2"
                  class="border-b border-black border-r border-black text-center"
                >
                  本期完工
                </th>
                <th
                  colspan="2"
                  class="border-b border-black border-r border-black text-center"
                >
                  累计完成
                </th>
                <th
                  colspan="2"
                  class="border-b border-black border-r border-black text-center"
                >
                  剩余
                </th>
                <th rowspan="3" class="w-20">备注</th>
              </tr>
              <tr class="font-bold border-b border-black text-center">
                <th class="border-r border-black text-right pr-3 w-28">施工单位上报</th>
                <th class="border-r border-black text-right pr-3 w-28">监理单位审核</th>
                <th rowspan="2" class="border-r border-black text-right pr-3 w-20">
                  数量
                </th>
                <th rowspan="2" class="border-r border-black text-right pr-3 w-24">
                  金额
                </th>
                <th rowspan="2" class="border-r border-black text-right pr-3 w-20">
                  数量
                </th>
                <th rowspan="2" class="border-r border-black text-right pr-3 w-24">
                  剩余金额
                </th>
              </tr>
              <tr class="font-bold border-b border-black text-center">
                <th class="border-r border-black text-right pr-3">金额</th>
                <th class="border-r border-black text-right pr-3">金额</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in treeRows"
                :key="row.boqItemId"
                class="border-b border-black"
                :class="{ 'font-medium bg-gray-50': row.isSummaryRow }"
              >
                <td class="text-center border-r border-black">
                  {{ getRowIndex(row) }}
                </td>
                <td class="text-center font-mono border-r border-black">
                  {{ row.boqCode }}
                </td>
                <td class="text-left border-r border-black pl-1">
                  <div
                    :style="{ paddingLeft: Math.max(0, row.boqDepth - 1) * 8 + 'px' }"
                  >
                    {{ row.boqName }}
                  </div>
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatMoney(row.contractAmount) }}
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatMoney(row.contractorAmount) }}
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatMoney(row.supervisionAmount) }}
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatQty(row.cumulativeQty) }}
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatMoney(row.cumulativeAmount) }}
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatQty(row.remainingQty) }}
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatMoney(row.remainingAmount) }}
                </td>
                <td class="text-center">{{ row.remark || '-' }}</td>
              </tr>
              <!-- 总价合计行 -->
              <tr class="font-bold border-b border-black bg-gray-100">
                <td class="text-center border-r border-black"></td>
                <td class="text-center border-r border-black"></td>
                <td class="text-left pl-3 border-r border-black">总价</td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatMoney(totalSums.contractAmount) }}
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatMoney(totalSums.contractorAmount) }}
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatMoney(totalSums.supervisionAmount) }}
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatQty(totalSums.cumulativeQty) }}
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatMoney(totalSums.cumulativeAmount) }}
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatQty(totalSums.remainingQty) }}
                </td>
                <td class="text-right pr-3 font-mono border-r border-black">
                  {{ formatMoney(totalSums.remainingAmount) }}
                </td>
                <td class="text-center">-</td>
              </tr>
              <tr>
                <td colspan="3">
                  <div class="flex flex-col gap-3">
                    <span>承包人（章）:</span>
                    <span>负责人：</span>
                    <span>日期：</span>
                  </div>
                </td>
                <td colspan="3">
                  <div class="flex flex-col gap-3">
                    <span>监理（章）:</span>
                    <span>负责人：</span>
                    <span>日期：</span>
                  </div>
                </td>
                <td colspan="3">
                  <div class="flex flex-col gap-3">
                    <span>工程部（章）:</span>
                    <span>负责人：</span>
                    <span>日期：</span>
                  </div>
                </td>
                <td colspan="3">
                  <div class="flex flex-col gap-3">
                    <span>公司质安部（章）:</span>
                    <span>负责人：</span>
                    <span>日期：</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue'
import { preciseAdd, preciseMul } from '~~/lib/common/helpers/preciseMath'
import { Portal } from 'portal-vue'
import dayjs from 'dayjs'
import {
  ArrowLeftIcon,
  QueueListIcon,
  ChevronRightIcon,
  ClockIcon,
  ChatBubbleLeftEllipsisIcon,
  PaperClipIcon,
  DocumentTextIcon,
  PrinterIcon
} from '@heroicons/vue/24/outline'
import { useQuery, useApolloClient } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import {
  CommonBadge,
  FormTextArea,
  FormButton,
  LayoutDialog
} from '@speckle/ui-components'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { approvalFlowInstanceDetailsForMonthlyMeasurementQuery } from '~/lib/projects/graphql/queries'

// GraphQL 审批流程接口
const approveFlowMutation = gql`
  mutation FlowApprove($input: ApproveApprovalFlowInput!) {
    approvalMutations {
      approve(input: $input) {
        id
        status
      }
    }
  }
`

const rejectFlowMutation = gql`
  mutation FlowReject($input: RejectApprovalFlowInput!) {
    approvalMutations {
      reject(input: $input) {
        id
        status
      }
    }
  }
`

const cancelFlowMutation = gql`
  mutation FlowCancel($input: CancelApprovalFlowInput!) {
    approvalMutations {
      cancel(input: $input) {
        id
        status
      }
    }
  }
`

const route = useRoute()
const projectId = computed(() => route.params.id as string)
const measurementId = computed(() => route.params.measurementId as string)
const isReadOnly = computed(() => route.query.mode !== 'edit')

// 查询项目信息（用于显示元数据大标题）
const { result: projectResult } = useQuery(
  gql`
    query ProjectNameForSafetyMeasure($id: String!) {
      project(id: $id) {
        id
        name
        contractName
        contractCode
        supervisionUnitName
        employer
        contractor
      }
    }
  `,
  () => ({
    id: projectId.value
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
const supervisionUnitName = computed(() => {
  const name = projectResult.value?.project?.supervisionUnitName
  if (name && name.trim().length) return name
  return '上海市合流工程监理有限公司/上海斯美科汇建设工程咨询有限公司(联合体)'
})

const apiOrigin = useApiOrigin()
const { userId } = useActiveUser()
const { triggerNotification } = useGlobalToast()
const apollo = useApolloClient().client

const isSidebarExpanded = ref(true)
const reviewComment = ref('')
const mutating = ref(false)
const saving = ref(false)

// 主表数据
const measureCode = ref('')
const roundName = ref('')
const baseDate = ref<string | null>(null)
const startDate = ref<string | null>(null)
const endDate = ref<string | null>(null)
const unit = ref('')
const approveStatus = ref('START')
const flowInstanceId = ref('')
const creatorId = ref('')
const creatorName = ref('')

const baseDateStr = computed(() =>
  baseDate.value ? dayjs(Number(baseDate.value)).format('YYYY-MM') : '-'
)
const startDateStr = computed(() =>
  startDate.value ? dayjs(Number(startDate.value)).format('YYYY-MM-DD') : '-'
)
const endDateStr = computed(() =>
  endDate.value ? dayjs(Number(endDate.value)).format('YYYY-MM-DD') : '-'
)

// 树形明细和意见
const treeRows = ref<any[]>([])
const rowById = shallowRef<Map<string, any>>(new Map())
const rowsByDepth = shallowRef<Map<number, any[]>>(new Map())
const hasChildrenSet = shallowRef<Set<string>>(new Set())

const details = ref({
  attachments: [] as any[],
  supervisionOpinion: '',
  supervisionAuditor: '',
  supervisionDate: null as any,
  supervisionApproveAuditor: '',
  supervisionApproveDate: null as any,
  headquartersOpinion: '',
  headquartersAuditor: '',
  headquartersDate: null as any,
  headquartersApproveAuditor: '',
  headquartersApproveDate: null as any,
  engineeringOpinion: '',
  engineeringAuditor: '',
  engineeringDate: null as any,
  engineeringApproveAuditor: '',
  engineeringApproveDate: null as any,
  contractOpinion: '',
  contractAuditor: '',
  contractDate: null as any
})

// 流程实例详情查询
const { result: flowResult, refetch: refetchFlow } = useQuery(
  approvalFlowInstanceDetailsForMonthlyMeasurementQuery,
  () => ({
    id: flowInstanceId.value
  }),
  {
    enabled: computed(() => !!flowInstanceId.value)
  }
)
const flowInstance = computed(() => flowResult.value?.approvalFlowInstance || null)

// 权限判断
const permissions = computed(() => {
  const result = {
    contractor: false,
    supervision: false,
    headquarters: false,
    engineering: false,
    contract: false
  }
  if (isReadOnly.value) return result
  const currentUserId = userId.value
  if (!currentUserId) return result

  const isDraft =
    !approveStatus.value ||
    approveStatus.value === 'START' ||
    approveStatus.value === 'RETURNED'
  if (isDraft) {
    if (creatorId.value === currentUserId) {
      result.contractor = true
    }
    return result
  }

  if (flowInstance.value && flowInstance.value.status === 'PENDING') {
    const pendingStep = flowInstance.value.steps?.find(
      (s: any) => s.status === 'PENDING'
    )
    if (pendingStep) {
      const stepName = (pendingStep.name || '').trim()
      const approverIds = pendingStep.approverIds || []

      if (approverIds.includes(currentUserId)) {
        const checkStep = (keywords: string[], exactList: string[]) => {
          return (
            exactList.includes(stepName) ||
            keywords.some((keyword) => stepName.includes(keyword))
          )
        }

        if (checkStep(['施工单位'], ['施工单位', '施工单位经办人', '施工单位审核人'])) {
          result.contractor = true
        }
        if (
          checkStep(
            ['监理'],
            [
              '监理',
              '专业监理',
              '监理工程师',
              '施工监理',
              '施工监理经办人',
              '施工监理总监'
            ]
          ) &&
          !stepName.includes('投资监理')
        ) {
          result.supervision = true
        }
        if (
          checkStep(
            ['指挥部', '现场指挥'],
            ['指挥部', '现场指挥部', '指挥部审核', '现场指挥部经办人', '现场指挥']
          )
        ) {
          result.headquarters = true
        }
        if (
          checkStep(
            ['工管', '工程管理'],
            [
              '工管部',
              '工程管理部',
              '工管部审核',
              '工程管理部经办人',
              '工程管理部负责人'
            ]
          )
        ) {
          result.engineering = true
        }
        if (
          checkStep(
            ['合约', '计划合同'],
            [
              '合约部',
              '计划合同部',
              '合约部审核',
              '计划合同部经办人',
              '合约管理部经办人',
              '合约管理部负责人'
            ]
          )
        ) {
          result.contract = true
        }
      }
    }
  }
  return result
})

const isEditable = computed(() => {
  if (isReadOnly.value) return false
  return (
    permissions.value.contractor ||
    permissions.value.supervision ||
    permissions.value.headquarters ||
    permissions.value.engineering ||
    permissions.value.contract
  )
})

const isTodoUser = computed(() => {
  if (isReadOnly.value) return false
  if (flowInstance.value?.status !== 'PENDING') return false
  const step = flowInstance.value.steps?.find((s: any) => s.status === 'PENDING')
  if (!step) return false
  const uid = userId.value || ''
  if (!step.approverIds || !step.approverIds.length) return true
  return step.approverIds.includes(uid)
})

const isCreator = computed(() => {
  return flowInstance.value?.createdBy === userId.value
})

// 树状索引构建
const buildTreeIndex = (rows: any[]) => {
  const byId = new Map<string, any>()
  const depthMap = new Map<number, any[]>()
  const children = new Set<string>()

  rows.forEach((row) => {
    byId.set(row.boqItemId, row)
    const depth = Number(row.boqDepth || 0)
    const bucket = depthMap.get(depth)
    if (bucket) bucket.push(row)
    else depthMap.set(depth, [row])
  })

  rows.forEach((row) => {
    if (row.boqParentId) children.add(row.boqParentId)
  })

  rowById.value = byId
  rowsByDepth.value = depthMap
  hasChildrenSet.value = children
}

// 计算分组小计
const calculateSums = (rows: any[]) => {
  let contractQty = 0
  let contractAmount = 0
  let contractorQty = 0
  let contractorAmount = 0
  let supervisionQty = 0
  let supervisionAmount = 0
  let headquartersQty = 0
  let headquartersAmount = 0
  let engineeringQty = 0
  let engineeringAmount = 0
  let contractDeptQty = 0
  let contractDeptAmount = 0
  let lastCumulativeQty = 0
  let yearlyQty = 0
  let yearlyAmount = 0
  let cumulativeQty = 0
  let cumulativeAmount = 0
  let remainingQty = 0
  let remainingAmount = 0

  rows.forEach((row) => {
    contractQty += Number(row.contractQty || 0)
    contractAmount += Number(row.contractAmount || 0)
    contractorQty += Number(row.contractorQty || 0)
    contractorAmount += Number(row.contractorAmount || 0)
    supervisionQty += Number(row.supervisionQty || 0)
    supervisionAmount += Number(row.supervisionAmount || 0)
    headquartersQty += Number(row.headquartersQty || 0)
    headquartersAmount += Number(row.headquartersAmount || 0)
    engineeringQty += Number(row.engineeringQty || 0)
    engineeringAmount += Number(row.engineeringAmount || 0)
    contractDeptQty += Number(row.contractDeptQty || 0)
    contractDeptAmount += Number(row.contractDeptAmount || 0)
    lastCumulativeQty += Number(row.lastCumulativeQty || 0)

    yearlyQty += Number(row.yearlyQty || 0)
    yearlyAmount += Number(row.yearlyAmount || 0)
    cumulativeQty += Number(row.cumulativeQty || 0)
    cumulativeAmount += Number(row.cumulativeAmount || 0)
    remainingQty += Number(row.remainingQty || 0)
    remainingAmount += Number(row.remainingAmount || 0)
  })

  const cumulativeRate =
    contractAmount > 0 ? ((cumulativeAmount / contractAmount) * 100).toFixed(2) : '0.00'

  return {
    contractQty,
    contractAmount,
    contractorQty,
    contractorAmount,
    supervisionQty,
    supervisionAmount,
    headquartersQty,
    headquartersAmount,
    engineeringQty,
    engineeringAmount,
    contractDeptQty,
    contractDeptAmount,
    lastCumulativeQty,
    yearlyQty,
    yearlyAmount,
    cumulativeQty,
    cumulativeAmount,
    cumulativeRate,
    remainingQty,
    remainingAmount
  }
}

const visibleTreeRows = computed(() => {
  const collapsedSet = new Set<string>()
  treeRows.value.forEach((row) => {
    if (row.isExpanded === false) {
      collapsedSet.add(row.boqItemId)
    }
  })

  return treeRows.value.filter((row) => {
    let pId = row.boqParentId
    while (pId) {
      if (collapsedSet.has(pId)) {
        return false
      }
      const parentRow = rowById.value.get(pId)
      pId = parentRow ? parentRow.boqParentId : null
    }
    return true
  })
})

const totalSums = computed(() => {
  const leaves = treeRows.value.filter((row) => !row.isSummaryRow)
  return calculateSums(leaves)
})

const hasChildren = (row: any) => hasChildrenSet.value.has(row.boqItemId)
const toggleExpand = (row: any) => {
  row.isExpanded = !row.isExpanded
  treeRows.value = [...treeRows.value]
}

const getCumulativeRate = (row: any) => {
  const contractAmt = row.contractAmount || 0
  if (contractAmt <= 0) return '0.00'
  const cumulativeAmt = row.cumulativeAmount || 0
  return ((cumulativeAmt / contractAmt) * 100).toFixed(2)
}

let recalcRaf: number | null = null
const scheduleRecalculate = () => {
  if (recalcRaf) return
  recalcRaf = requestAnimationFrame(() => {
    recalcRaf = null
    recalculateTreeRows()
  })
}

const onQtyInput = (
  row: any,
  dept: 'contractor' | 'supervision' | 'headquarters' | 'engineering'
) => {
  const val = row[`${dept}Qty`]
  if (dept === 'contractor') {
    row.supervisionQty = val
    row.headquartersQty = val
    row.engineeringQty = val
  } else if (dept === 'supervision') {
    row.headquartersQty = val
    row.engineeringQty = val
  } else if (dept === 'headquarters') {
    row.engineeringQty = val
  }
  scheduleRecalculate()
}

// 自底向上小计重新计算
const recalculateTreeRows = () => {
  if (!treeRows.value.length) return

  // 重置/初始化节点数据
  treeRows.value.forEach((row) => {
    if (row.isSummaryRow) {
      row.contractorQty = 0
      row.contractorAmount = 0
      row.supervisionQty = 0
      row.supervisionAmount = 0
      row.headquartersQty = 0
      row.headquartersAmount = 0
      row.engineeringQty = 0
      row.engineeringAmount = 0
      row.contractDeptQty = 0
      row.contractDeptAmount = 0

      row.lastCumulativeQty = 0
      row.lastCumulativeAmount = 0

      row.yearlyQty = 0
      row.yearlyAmount = 0

      row.cumulativeQty = 0
      row.cumulativeAmount = 0

      row.contractQty = 0
      row.contractAmount = 0

      row.remainingQty = 0
      row.remainingAmount = 0
    } else {
      // 叶子节点初始化/计算其本期及累计
      const price = Number(row.price || 0)
      row.contractorAmount = preciseMul(row.contractorQty || 0, price)
      row.supervisionAmount = preciseMul(row.supervisionQty || 0, price)
      row.headquartersAmount = preciseMul(row.headquartersQty || 0, price)
      row.engineeringAmount = preciseMul(row.engineeringQty || 0, price)
      row.contractDeptAmount = preciseMul(row.contractDeptQty || 0, price)

      row.lastCumulativeAmount = preciseMul(row.lastCumulativeQty || 0, price)

      const currentQty =
        Number(row.contractDeptQty) ||
        Number(row.engineeringQty) ||
        Number(row.headquartersQty) ||
        Number(row.supervisionQty) ||
        Number(row.contractorQty) ||
        0
      row.yearlyQty = preciseAdd(row.yearlyCumulativeQty || 0, currentQty)
      row.yearlyAmount = preciseMul(row.yearlyQty, price)

      row.cumulativeQty = preciseAdd(row.lastCumulativeQty || 0, currentQty)
      row.cumulativeAmount = preciseMul(row.cumulativeQty, price)

      row.remainingQty = preciseAdd(row.contractQty || 0, -row.cumulativeQty)
      row.remainingAmount = preciseMul(row.remainingQty, price)
    }
  })

  // 自底向上层层累加
  const depths = Array.from(rowsByDepth.value.keys()).sort((a, b) => b - a)
  depths.forEach((depth) => {
    const rows = rowsByDepth.value.get(depth)
    if (!rows) return
    rows.forEach((row) => {
      if (!row.boqParentId) return
      const parent = rowById.value.get(row.boqParentId)
      if (!parent || !parent.isSummaryRow) return

      parent.contractorQty = preciseAdd(
        parent.contractorQty || 0,
        row.contractorQty || 0
      )
      parent.contractorAmount = preciseAdd(
        parent.contractorAmount || 0,
        row.contractorAmount || 0
      )
      parent.supervisionQty = preciseAdd(
        parent.supervisionQty || 0,
        row.supervisionQty || 0
      )
      parent.supervisionAmount = preciseAdd(
        parent.supervisionAmount || 0,
        row.supervisionAmount || 0
      )
      parent.headquartersQty = preciseAdd(
        parent.headquartersQty || 0,
        row.headquartersQty || 0
      )
      parent.headquartersAmount = preciseAdd(
        parent.headquartersAmount || 0,
        row.headquartersAmount || 0
      )
      parent.engineeringQty = preciseAdd(
        parent.engineeringQty || 0,
        row.engineeringQty || 0
      )
      parent.engineeringAmount = preciseAdd(
        parent.engineeringAmount || 0,
        row.engineeringAmount || 0
      )
      parent.contractDeptQty = preciseAdd(
        parent.contractDeptQty || 0,
        row.contractDeptQty || 0
      )
      parent.contractDeptAmount = preciseAdd(
        parent.contractDeptAmount || 0,
        row.contractDeptAmount || 0
      )

      parent.lastCumulativeQty = preciseAdd(
        parent.lastCumulativeQty || 0,
        row.lastCumulativeQty || 0
      )
      parent.lastCumulativeAmount = preciseAdd(
        parent.lastCumulativeAmount || 0,
        row.lastCumulativeAmount || 0
      )

      parent.yearlyQty = preciseAdd(parent.yearlyQty || 0, row.yearlyQty || 0)
      parent.yearlyAmount = preciseAdd(parent.yearlyAmount || 0, row.yearlyAmount || 0)

      parent.cumulativeQty = preciseAdd(
        parent.cumulativeQty || 0,
        row.cumulativeQty || 0
      )
      parent.cumulativeAmount = preciseAdd(
        parent.cumulativeAmount || 0,
        row.cumulativeAmount || 0
      )

      parent.contractQty = preciseAdd(parent.contractQty || 0, row.contractQty || 0)
      parent.contractAmount = preciseAdd(
        parent.contractAmount || 0,
        row.contractAmount || 0
      )

      parent.remainingQty = preciseAdd(parent.remainingQty || 0, row.remainingQty || 0)
      parent.remainingAmount = preciseAdd(
        parent.remainingAmount || 0,
        row.remainingAmount || 0
      )
    })
  })
}

// 树状清单 DFS 排序算法，保证子级排在直属父级正下方
const sortTreeRowsByDFS = (list: any[]) => {
  const byId = new Map<string, any>()
  list.forEach((row) => byId.set(row.boqItemId, row))

  const childrenMap = new Map<string, any[]>()
  const roots: any[] = []

  list.forEach((row) => {
    const pId = row.boqParentId
    if (!pId || !byId.has(pId)) {
      roots.push(row)
    } else {
      const children = childrenMap.get(pId) || []
      children.push(row)
      childrenMap.set(pId, children)
    }
  })

  const sortFunc = (a: any, b: any) => {
    const sortA = a.sortIndex != null ? Number(a.sortIndex) : 999999
    const sortB = b.sortIndex != null ? Number(b.sortIndex) : 999999
    if (sortA !== sortB) return sortA - sortB
    return (a.boqCode || '').localeCompare(b.boqCode || '')
  }

  roots.sort(sortFunc)
  childrenMap.forEach((children) => children.sort(sortFunc))

  const sortedList: any[] = []
  const visited = new Set<string>()

  const dfs = (node: any) => {
    if (visited.has(node.boqItemId)) return
    visited.add(node.boqItemId)
    sortedList.push(node)
    const children = childrenMap.get(node.boqItemId)
    if (children) {
      children.forEach((child) => dfs(child))
    }
  }

  roots.forEach((root) => dfs(root))
  return sortedList
}

const getRowIndex = (row: any) => {
  if (row.isSummaryRow) return ''
  const index = treeRows.value
    .filter((r) => !r.isSummaryRow)
    .findIndex((r) => r.boqItemId === row.boqItemId)
  return index !== -1 ? index + 1 : ''
}

// 加载全部数据
const loadData = async () => {
  if (!projectId.value || !measurementId.value) return
  try {
    // 1. 获取主表
    const measure = await $fetch<any>(
      `${apiOrigin}/api/v1/projects/${projectId.value}/safety-measures/${measurementId.value}`
    )
    measureCode.value = measure.code
    roundName.value = measure.roundName
    baseDate.value = measure.baseDate
    startDate.value = measure.startDate
    endDate.value = measure.endDate
    unit.value = measure.unit
    approveStatus.value = measure.approveStatus || 'START'
    flowInstanceId.value = measure.flowInstanceId || ''
    creatorId.value = measure.creator?.id || ''
    creatorName.value = measure.creator?.name || ''

    // 2. 获取明细清单项
    const items = await $fetch<any[]>(
      `${apiOrigin}/api/v1/projects/${projectId.value}/safety-measures/${measurementId.value}/items`
    )
    items.forEach((it) => {
      it.isExpanded = true
    })
    treeRows.value = sortTreeRowsByDFS(items)
    buildTreeIndex(treeRows.value)
    recalculateTreeRows()

    // 3. 获取意见和附件
    const detailRes = await $fetch<any>(
      `${apiOrigin}/api/v1/projects/${projectId.value}/safety-measures/${measurementId.value}/details`
    )
    if (detailRes) {
      details.value = {
        attachments: detailRes.attachments || [],
        supervisionOpinion: detailRes.supervisionOpinion || '',
        supervisionAuditor: detailRes.supervisionAuditor || '',
        supervisionDate: detailRes.supervisionDate,
        supervisionApproveAuditor: detailRes.supervisionApproveAuditor || '',
        supervisionApproveDate: detailRes.supervisionApproveDate,
        headquartersOpinion: detailRes.headquartersOpinion || '',
        headquartersAuditor: detailRes.headquartersAuditor || '',
        headquartersDate: detailRes.headquartersDate,
        headquartersApproveAuditor: detailRes.headquartersApproveAuditor || '',
        headquartersApproveDate: detailRes.headquartersApproveDate,
        engineeringOpinion: detailRes.engineeringOpinion || '',
        engineeringAuditor: detailRes.engineeringAuditor || '',
        engineeringDate: detailRes.engineeringDate,
        engineeringApproveAuditor: detailRes.engineeringApproveAuditor || '',
        engineeringApproveDate: detailRes.engineeringApproveDate,
        contractOpinion: detailRes.contractOpinion || '',
        contractAuditor: detailRes.contractAuditor || '',
        contractDate: detailRes.contractDate
      }
    }
  } catch (err) {
    console.error('加载计量详情出错', err)
    triggerNotification({
      title: '加载失败',
      description: '无法获取单据的计量明细与工作流详情。',
      type: ToastNotificationType.Danger
    })
  }
}

onMounted(() => {
  loadData()
  window.addEventListener('afterprint', handleAfterPrint)
})

onUnmounted(() => {
  window.removeEventListener('afterprint', handleAfterPrint)
})

// 保存所有修改（包括数量和意见）
const saveAllData = async (silent = false) => {
  if (!projectId.value || !measurementId.value || !treeRows.value.length) return false
  saving.value = true
  try {
    const payloadItems = treeRows.value
      .filter((row) => !row.isSummaryRow)
      .map((row) => ({
        boqItemId: row.boqItemId,
        price: Number(row.price || 0),
        contractorQty: Number(row.contractorQty || 0),
        supervisionQty: Number(row.supervisionQty || 0),
        headquartersQty: Number(row.headquartersQty || 0),
        engineeringQty: Number(row.engineeringQty || 0),
        contractDeptQty: Number(row.contractDeptQty || 0)
      }))

    await $fetch(
      `${apiOrigin}/api/v1/projects/${projectId.value}/safety-measures/${measurementId.value}`,
      {
        method: 'PUT',
        body: {
          items: payloadItems,
          details: {
            attachments: details.value.attachments,
            supervisionOpinion: details.value.supervisionOpinion,
            headquartersOpinion: details.value.headquartersOpinion,
            engineeringOpinion: details.value.engineeringOpinion
          }
        }
      }
    )
    if (!silent) {
      triggerNotification({
        title: '保存成功',
        description: '数量及意见签署内容已成功保存。',
        type: ToastNotificationType.Success
      })
    }
    await loadData()
    return true
  } catch (err: any) {
    triggerNotification({
      title: '保存失败',
      description: err.data?.error || err.message || '保存失败，请检查网络重试。',
      type: ToastNotificationType.Danger
    })
    return false
  } finally {
    saving.value = false
  }
}

// 统一确认弹窗
const confirmDialogOpen = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogText = ref('')
const confirmDialogConfirmText = ref('')
const confirmDialogAction = ref<(() => Promise<void>) | null>(null)

const triggerConfirm = (
  title: string,
  text: string,
  confirmText: string,
  action: () => Promise<void>
) => {
  confirmDialogTitle.value = title
  confirmDialogText.value = text
  confirmDialogConfirmText.value = confirmText
  confirmDialogAction.value = action
  confirmDialogOpen.value = true
}

const handleConfirm = async () => {
  confirmDialogOpen.value = false
  if (confirmDialogAction.value) {
    await confirmDialogAction.value()
  }
}

// 审批流动作执行
const executeApprove = async () => {
  if (!flowInstance.value) return
  // 流转前先强制保存一次
  const saved = await saveAllData(true)
  if (!saved) return

  mutating.value = true
  try {
    await apollo.mutate({
      mutation: approveFlowMutation,
      variables: {
        input: {
          instanceId: flowInstance.value.id,
          comment: reviewComment.value.trim() || null
        }
      }
    })
    reviewComment.value = ''
    triggerNotification({
      title: '审批通过成功',
      description: '已成功批准当前审批步骤。',
      type: ToastNotificationType.Success
    })
    await loadData()
    await refetchFlow()
  } catch (err: any) {
    triggerNotification({
      title: '操作失败',
      description: err.message || err || '审批出错，请重试。',
      type: ToastNotificationType.Danger
    })
  } finally {
    mutating.value = false
  }
}

const executeReject = async () => {
  if (!flowInstance.value) return
  if (!reviewComment.value.trim()) {
    triggerNotification({
      title: '操作失败',
      description: '驳回意见不能为空',
      type: ToastNotificationType.Danger
    })
    return
  }
  const saved = await saveAllData(true)
  if (!saved) return

  mutating.value = true
  try {
    await apollo.mutate({
      mutation: rejectFlowMutation,
      variables: {
        input: {
          instanceId: flowInstance.value.id,
          comment: reviewComment.value.trim(),
          rollbackToStep:
            selectedRollbackStep.value !== null ? Number(selectedRollbackStep.value) : 0
        }
      }
    })
    reviewComment.value = ''
    selectedRollbackStep.value = null
    rejectDialogOpen.value = false
    triggerNotification({
      title: '审批驳回成功',
      description: '已驳回当前计量单审批并成功退回。',
      type: ToastNotificationType.Success
    })
    await loadData()
    await refetchFlow()
  } catch (err: any) {
    triggerNotification({
      title: '操作失败',
      description: err.message || err || '驳回出错，请重试。',
      type: ToastNotificationType.Danger
    })
  } finally {
    mutating.value = false
  }
}

const executeCancel = async () => {
  if (!flowInstance.value) return
  mutating.value = true
  try {
    await apollo.mutate({
      mutation: cancelFlowMutation,
      variables: {
        input: {
          instanceId: flowInstance.value.id,
          comment: reviewComment.value.trim() || null
        }
      }
    })
    reviewComment.value = ''
    triggerNotification({
      title: '流程取消成功',
      description: '计量审批流程已成功取消。',
      type: ToastNotificationType.Success
    })
    await loadData()
    await refetchFlow()
  } catch (err: any) {
    triggerNotification({
      title: '操作失败',
      description: err.message || err || '取消出错。',
      type: ToastNotificationType.Danger
    })
  } finally {
    mutating.value = false
  }
}

const confirmApprove = () => {
  const title = isStartStep.value ? '是否送审安全文明措施费' : '确认通过审批'
  const text = isStartStep.value ? '' : '您确定要通过当前的审批步骤吗？'
  const confirmText = isStartStep.value ? '确认送审' : '确认通过'
  triggerConfirm(title, text, confirmText, executeApprove)
}
const confirmReject = () => {
  const pendingStep = flowInstance.value?.steps?.find(
    (s: any) => s.status === 'PENDING'
  )
  selectedRollbackStep.value = pendingStep ? Math.max(0, pendingStep.stepIndex - 1) : 0
  rejectDialogOpen.value = true
}
const confirmCancel = () => {
  triggerConfirm(
    '确认取消审批',
    '您确定要取消当前的审批流程吗？',
    '确认取消',
    executeCancel
  )
}

// 辅助格式化
const formatMoney = (val: any) => {
  if (val == null) return '-'
  return Number(val).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatQty = (val: any) => {
  if (val === null || val === undefined || val === '') return '-'
  const num = Number(val)
  if (isNaN(num)) return '-'
  if (Number.isInteger(num)) return `${num}`
  return num.toFixed(2)
}

const formatDate = (date: any) => {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD')
}

const formatDateTime = (date: any) => {
  if (!date) return '-'
  const num = Number(date)
  return dayjs(Number.isNaN(num) ? date : num).format('YYYY-MM-DD HH:mm:ss')
}

const getStatusColor = (status: string | null | undefined) => {
  const map: Record<string, string> = {
    START: 'bg-warning-lighter text-warning-darker',
    PENDING: 'bg-primary-muted text-primary',
    IN_REVIEW: 'bg-primary-muted text-primary',
    APPROVED: 'bg-success-lighter text-success-darker',
    REJECTED: 'bg-danger-lighter text-danger-darker',
    RETURNED: 'bg-warning-lighter text-warning-darker',
    CANCELED: 'bg-highlight-3 text-foreground-2'
  }
  return map[(status || '').toUpperCase()] || 'bg-foundation-3 text-foreground-2'
}

const getStatusText = (status: string | null | undefined) => {
  const map: Record<string, string> = {
    START: '草稿',
    PENDING: '审批中',
    IN_REVIEW: '审批中',
    APPROVED: '审核通过',
    REJECTED: '已驳回',
    RETURNED: '已退回',
    CANCELED: '已取消'
  }
  return map[(status || '').toUpperCase()] || '草稿'
}

const formatFlowStatusLabel = (status?: string | null) => {
  const map: Record<string, string> = {
    PENDING: '审批中',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    RETURNED: '已退回',
    CANCELED: '已取消',
    CANCELLED: '已取消'
  }
  if (!status) return '-'
  return map[status] || status
}

const formatFlowStepStatusLabel = (status?: string | null) => {
  const map: Record<string, string> = {
    WAITING: '未开始',
    PENDING: '当前步骤',
    APPROVED: '已完成',
    REJECTED: '已驳回',
    CANCELED: '已取消',
    CANCELLED: '已取消'
  }
  if (!status) return '-'
  return map[status] || status
}

const formatFlowActionLabel = (action?: string | null) => {
  const map: Record<string, string> = {
    STARTED: '发起流程',
    STEP_APPROVED: '步骤通过',
    APPROVED: '流程通过',
    REJECTED: '流程驳回',
    CANCELED: '流程取消',
    RESET_TO_UNSUBMITTED: '重置未送审'
  }
  if (!action) return '-'
  return map[action] || action
}

const getFlowStepCardClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'border-success bg-success/5'
  if (status === 'PENDING') return 'border-primary bg-primary/5'
  if (status === 'REJECTED' || status === 'CANCELED' || status === 'CANCELLED') {
    return 'border-danger bg-danger/5'
  }
  return 'border-outline-3 bg-foundation'
}

const getFlowStepTagClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'bg-success/10 text-success'
  if (status === 'PENDING') return 'bg-primary/10 text-primary'
  if (status === 'REJECTED' || status === 'CANCELED' || status === 'CANCELLED') {
    return 'bg-danger/10 text-danger'
  }
  return 'bg-foundation-2 text-foreground-2'
}

const getCurrentFlowStepName = (instance: any) => {
  if (!instance?.steps) return '-'
  const byStatus = instance.steps.find((step: any) => step.status === 'PENDING')
  return byStatus?.name || '-'
}

const attachmentsDialogOpen = ref(false)
const coverDialogOpen = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const triggerUpload = () => {
  fileInputRef.value?.click()
}

const getBlobDownloadUrl = (blobId: string) => {
  return `${apiOrigin}/api/stream/${projectId.value}/blob/${blobId}`
}

const handleFileUpload = async (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (!files?.length) return
  try {
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      const res = await $fetch<any>(`${apiOrigin}/api/stream/${projectId.value}/blob`, {
        method: 'POST',
        body: formData
      })
      const uploadResults = res?.uploadResults || []
      const result = uploadResults.find((r: any) => r.formKey === 'file')
      const blobId = result?.blobId
      if (blobId) {
        const list = details.value.attachments || []
        list.push({ blobId, name: file.name })
        details.value.attachments = [...list]
      } else {
        throw new Error('未获取到文件标识')
      }
    }
    await saveAllData(true)
  } catch (err) {
    triggerNotification({
      title: '文件上传失败',
      description: '文件上传失败：' + err,
      type: ToastNotificationType.Danger
    })
  }
}

const removeAttachment = async (idx: number) => {
  const list = [...(details.value.attachments || [])]
  list.splice(idx, 1)
  details.value.attachments = list
  await saveAllData(true)
}

const triggerPrint = () => {
  window.print()
}

const goBack = () => {
  navigateTo(`/projects/${projectId.value}/work-valuation/safety-measure`)
}

// 驳回弹窗选择节点相关状态
const rejectDialogOpen = ref(false)
const selectedRollbackStep = ref<number | null>(null)

const rejectTargetSteps = computed(() => {
  if (!flowInstance.value?.steps) return []
  const pendingStep = flowInstance.value.steps.find((s: any) => s.status === 'PENDING')
  const currentIdx = pendingStep ? pendingStep.stepIndex : 999
  return flowInstance.value.steps.filter((s: any) => s.stepIndex < currentIdx)
})

const isStartStep = computed(() => {
  if (!flowInstance.value) return false
  const step = flowInstance.value.steps?.find((s: any) => s.status === 'PENDING')
  return step ? step.stepIndex === 0 : false
})

const rejectDialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      rejectDialogOpen.value = false
    }
  },
  {
    text: '确定驳回',
    props: {
      color: 'danger',
      loading: mutating.value
    },
    disabled: mutating.value,
    onClick: () => {
      executeReject().catch(() => undefined)
    }
  }
])

// 打印相关的状态和方法
const flowInitiatorName = computed(() => {
  return (
    flowInstance.value?.actions?.find((a: any) => a.action === 'STARTED')?.actor
      ?.name ||
    creatorName.value ||
    ''
  )
})

const flowInitiatorDate = computed(() => {
  const startedAction = flowInstance.value?.actions?.find(
    (a: any) => a.action === 'STARTED'
  )
  const dateVal = startedAction?.createdAt
  if (!dateVal) return '-'
  const ts = Number(dateVal)
  if (!Number.isNaN(ts) && ts > 0) {
    return dayjs(ts).format('YYYY-MM-DD')
  }
  const parsed = dayjs(String(dateVal))
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '-'
})

const getFlowStepApproverDisplay = (stepNames: readonly string[]) => {
  const steps = flowInstance.value?.steps || []
  const actions = flowInstance.value?.actions || []
  const normalizedNames = stepNames.map((name) => name.trim())
  const matchingSteps = steps.filter((step: any) =>
    normalizedNames.includes(step.name?.trim())
  )

  const names: string[] = []
  for (const step of matchingSteps) {
    const action = actions.find(
      (item: any) =>
        item.stepId === step.id &&
        (item.action === 'APPROVED' ||
          item.action === 'STEP_APPROVED' ||
          item.action === 'REJECTED')
    )

    if (action?.actor?.name) {
      names.push(action.actor.name)
      continue
    }

    if (Array.isArray(step.approvers) && step.approvers.length > 0) {
      names.push(...step.approvers.map((user: any) => user?.name).filter(Boolean))
    }
  }

  return Array.from(new Set(names)).join('、')
}

const supervisionReviewApproverDisplay = computed(() => {
  return (
    getFlowStepApproverDisplay(['监理单位审核人', '监理单位审核', '施工监理总监']) ||
    details.value.supervisionApproveAuditor ||
    ''
  )
})

const isPrinting = ref(false)
const printType = ref<'cover' | 'detail' | null>(null)

const handlePrintCover = async () => {
  printType.value = 'cover'
  isPrinting.value = true
  document.body.classList.add('is-printing')
  await nextTick()
  window.print()
}

const handlePrintDetail = async () => {
  printType.value = 'detail'
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

// 金额转中文大写
const amountToChinese = (n: any): string => {
  const num = Number(n)
  if (isNaN(num) || num < 0) return ''
  const fraction = ['角', '分']
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
  const unit = [
    ['元', '万', '亿'],
    ['', '拾', '佰', '仟']
  ]
  let s = ''

  // 处理小数部分 (保留两位小数)
  const decimal = (Math.round(num * 100) % 100).toString().padStart(2, '0')
  let fractionStr = ''
  if (decimal !== '00') {
    const j = parseInt(decimal[0])
    const f = parseInt(decimal[1])
    if (j > 0) fractionStr += digit[j] + fraction[0]
    if (f > 0) fractionStr += digit[f] + fraction[1]
  }

  // 处理整数部分
  let integer = Math.floor(num)
  for (let i = 0; i < unit[0].length && integer > 0; i++) {
    let p = ''
    for (let j = 0; j < unit[1].length && integer > 0; j++) {
      p = digit[integer % 10] + unit[1][j] + p
      integer = Math.floor(integer / 10)
    }
    s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s
  }

  s = s.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零')

  if (!s || s === '元') {
    s = '零元'
  }
  if (!fractionStr) {
    s += '整'
  } else {
    s += fractionStr
  }

  return s
}
</script>

<style>
/* 正常情况下隐藏打印专区 */
#print-section {
  display: none;
}

@media print {
  @page {
    size: auto;
    margin: 10mm 15mm;
  }

  html,
  body {
    height: auto !important;
    overflow: visible !important;
  }

  /* 当处于打印状态时，隐藏 body 下除了打印区以外的所有直接子节点 */
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
  .print-table th,
  .print-table td {
    border: 1px solid #000 !important;
    padding: 6px 8px !important;
    font-size: 10px !important;
    line-height: 1.2 !important;
    color: #000 !important;
  }
  .print-table th {
    background-color: #f2f2f2 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    text-align: center !important;
    font-weight: bold !important;
  }
}
</style>
