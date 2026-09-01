<template>
  <div class="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col">
    <!-- 全局独立管理顶栏 (无 Layout 时的专用顶栏) -->
    <header
      class="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm"
    >
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/projects"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <ArrowLeftIcon class="size-3.5" />
            返回工作台
          </NuxtLink>
          <div class="h-4 w-px bg-slate-200"></div>
          <div class="flex items-center gap-2">
            <h1 class="text-base font-bold text-slate-900 tracking-tight">
              模型转换调度中心
            </h1>
            <span
              class="inline-flex items-center rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-[#00b4b6] border border-[#00b4b6]/20"
            >
              超级管理员
            </span>
          </div>
        </div>

        <!-- 右侧控制区 -->
        <div class="flex items-center gap-4">
          <label
            class="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-600 select-none"
          >
            <input v-model="autoRefresh" type="checkbox" class="sr-only peer" />
            <div
              class="relative w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00b4b6]"
            ></div>
            <span class="text-xs font-medium text-slate-600">自动刷新 (3s)</span>
          </label>

          <button
            type="button"
            :disabled="loading"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
            @click="handleRefresh"
          >
            <ArrowPathIcon
              class="size-3.5 text-slate-500"
              :class="{ 'animate-spin': loading }"
            />
            刷新
          </button>
        </div>
      </div>
    </header>

    <!-- 页面主体容器 -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <!-- 转换节点 (Worker) 监控区域 -->
      <div class="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2.5 flex-wrap">
            <div class="p-1.5 rounded-lg bg-cyan-50 text-[#00b4b6]">
              <CpuChipIcon class="size-5" />
            </div>
            <h2 class="text-base font-semibold text-slate-900">
              已注册转换节点 (Worker)
            </h2>
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
              :class="[
                workers.length > 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                  : 'bg-amber-50 text-amber-700 border border-amber-200/60'
              ]"
            >
              <span
                class="size-2 rounded-full"
                :class="[
                  workers.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                ]"
              ></span>
              {{ workers.length > 0 ? `${workers.length} 个节点在线` : '暂无节点在线' }}
            </span>
          </div>

          <!-- 右侧折叠控制 -->
          <div class="flex items-center gap-3">
            <span class="text-xs text-slate-400 hidden sm:inline">
              负责执行 Revit (RVT) 等模型的后台转换任务
            </span>
            <button
              type="button"
              class="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50"
              @click="isWorkersCollapsed = !isWorkersCollapsed"
            >
              <span>{{ isWorkersCollapsed ? '展开详情' : '收起' }}</span>
              <ChevronDownIcon
                class="size-3.5 transition-transform duration-200"
                :class="{ 'rotate-180': !isWorkersCollapsed }"
              />
            </button>
          </div>
        </div>

        <!-- 折叠主体 -->
        <div v-show="!isWorkersCollapsed" class="space-y-4">
          <!-- 无 Worker 警告 -->
          <div
            v-if="workers.length === 0"
            class="flex items-start gap-3 p-4 rounded-lg bg-amber-50/70 border border-amber-200/60 text-amber-800 text-xs leading-relaxed"
          >
            <ExclamationTriangleIcon class="size-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p class="font-medium">当前暂无已注册的转换 Worker</p>
              <p class="text-amber-700/80 mt-0.5">
                若有模型转换任务提交，任务将在队列中排队等待。请确认本地或服务器上的模型转换客户端（如
                RVT Worker 等）已正常启动并建立 WebSocket 注册连接。
              </p>
            </div>
          </div>

          <!-- Worker 节点列表表格 -->
          <div v-else class="overflow-x-auto border border-slate-200 rounded-lg">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-slate-50/80 text-slate-600">
                <tr>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    节点标识 (Worker ID)
                  </th>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    支持能力与版本
                  </th>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    节点归属
                  </th>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    注册上线时间
                  </th>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    最近心跳
                  </th>
                  <th scope="col" class="py-3 px-4 text-right font-semibold w-28">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                <tr
                  v-for="w in workers"
                  :key="w.workerId"
                  class="hover:bg-slate-50/60 transition-colors"
                >
                  <!-- Worker ID -->
                  <td class="py-3 px-4 font-mono font-medium text-slate-900">
                    <div class="flex items-center gap-2">
                      <span class="size-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span class="truncate max-w-[260px]" :title="w.workerId">
                        {{ w.workerId }}
                      </span>
                    </div>
                  </td>

                  <!-- Capabilities & Version -->
                  <td class="py-3 px-4">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span
                        v-for="cap in w.capabilities"
                        :key="cap"
                        class="px-2 py-0.5 rounded text-xs font-semibold bg-cyan-50 text-[#00b4b6] border border-[#00b4b6]/20 uppercase"
                      >
                        {{ cap }}
                      </span>
                      <span
                        v-if="w.version"
                        class="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-600"
                      >
                        v{{ w.version }}
                      </span>
                    </div>
                  </td>

                  <!-- Node Type -->
                  <td class="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
                      :class="
                        w.isLocal
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-purple-50 text-purple-700'
                      "
                    >
                      {{ w.isLocal ? '本地连接' : '集群分发' }}
                    </span>
                    <span
                      v-if="w.instanceId"
                      class="text-slate-400 font-mono ml-1 text-[10px]"
                      :title="`实例ID: ${w.instanceId}`"
                    >
                      ({{ w.instanceId.slice(0, 8) }})
                    </span>
                  </td>

                  <!-- Connected At -->
                  <td class="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                    {{ formatTime(w.connectedAt) }}
                  </td>

                  <!-- Last Seen -->
                  <td class="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                    <div class="flex items-center gap-1.5">
                      <span>{{ formatTime(w.lastSeenAt) }}</span>
                      <span class="text-[11px] text-slate-400 font-normal">
                        ({{ formatRelativeTime(w.lastSeenAt) }})
                      </span>
                    </div>
                  </td>

                  <!-- Status -->
                  <td class="py-3 px-4 text-right whitespace-nowrap">
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
                      :class="
                        isWorkerActive(w)
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      "
                    >
                      <span
                        class="size-1.5 rounded-full"
                        :class="isWorkerActive(w) ? 'bg-emerald-500' : 'bg-slate-400'"
                      ></span>
                      {{ isWorkerActive(w) ? '正常在线' : '心跳异常' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab 切换栏 -->
      <div class="flex border-b border-slate-200 space-x-2">
        <button
          v-for="tab in tabs"
          :key="tab.type"
          type="button"
          class="group relative py-3 px-6 text-sm font-medium transition-all duration-150 flex items-center gap-2"
          :class="[
            activeTab === tab.type
              ? 'text-[#00b4b6] border-b-2 border-[#00b4b6] font-semibold bg-white rounded-t-lg shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'
          ]"
          @click="switchTab(tab.type)"
        >
          <span>{{ tab.label }}</span>
          <span
            v-if="queueSummary[tab.type]?.total > 0"
            class="px-2 py-0.5 rounded-full text-xs font-semibold"
            :class="[
              activeTab === tab.type
                ? 'bg-[#00b4b6]/10 text-[#00b4b6]'
                : 'bg-slate-200 text-slate-600'
            ]"
          >
            {{ queueSummary[tab.type].total }}
          </span>
        </button>
      </div>

      <!-- Tab 主体内容 -->
      <div class="space-y-6">
        <!-- 1. 当前正在转换的模型卡片 (Active Conversion) -->
        <div class="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <div class="size-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <h2 class="text-base font-semibold text-slate-900">当前正在转换的模型</h2>
              <span class="text-xs text-slate-400 font-mono">
                ({{ activeTab.toUpperCase() }} Worker)
              </span>
            </div>

            <span
              v-if="activeJob"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60"
            >
              <ArrowPathIcon class="size-3.5 animate-spin text-emerald-600" />
              转换中
            </span>
            <span v-else class="text-xs text-slate-400 font-medium">空闲状态</span>
          </div>

          <!-- 有正在转换的任务 -->
          <div
            v-if="activeJob"
            class="bg-gradient-to-r from-cyan-50/50 via-slate-50 to-white rounded-lg border border-cyan-100/70 p-5 flex flex-col md:flex-row md:items-center justify-between gap-5"
          >
            <div class="space-y-2 flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-base font-bold text-slate-900 truncate">
                  {{ activeJob.modelName || activeJob.fileName }}
                </span>
                <span
                  class="px-2 py-0.5 rounded text-xs font-semibold bg-cyan-100 text-cyan-800 uppercase"
                >
                  {{ activeJob.fileType }}
                </span>
              </div>

              <div
                class="grid grid-cols-1 sm:grid-cols-3 gap-y-1 gap-x-4 text-xs text-slate-500"
              >
                <div>
                  <span class="text-slate-400">所属项目：</span>
                  <span class="font-medium text-slate-700">
                    {{ activeJob.projectName }}
                  </span>
                </div>
                <div>
                  <span class="text-slate-400">原始文件：</span>
                  <span
                    class="font-medium text-slate-700 truncate"
                    :title="activeJob.fileName"
                  >
                    {{ activeJob.fileName }}
                  </span>
                </div>
                <div>
                  <span class="text-slate-400">开始时间：</span>
                  <span class="font-medium text-slate-700">
                    {{ formatTime(activeJob.createdAt) }}
                  </span>
                </div>
              </div>

              <div
                v-if="activeJob.progressMessage"
                class="text-xs text-cyan-700 bg-cyan-50/80 px-2.5 py-1 rounded inline-block"
              >
                阶段提示：{{ activeJob.progressMessage }}
              </div>
            </div>

            <!-- 暂停操作按钮 -->
            <div class="shrink-0 flex items-center gap-3">
              <button
                type="button"
                :disabled="actionLoading"
                class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-medium text-sm shadow-sm transition-colors disabled:opacity-50"
                @click="openPauseConfirm(activeJob)"
              >
                <PauseIcon class="size-4" />
                暂停转换并执行下一个
              </button>
            </div>
          </div>

          <!-- 无正在转换的任务 -->
          <div
            v-else
            class="rounded-lg border border-dashed border-slate-200 py-8 text-center text-slate-400 text-sm bg-slate-50/50"
          >
            当前无正在转换的 {{ activeTab.toUpperCase() }} 模型，队列处于就绪就绪状态
          </div>
        </div>

        <!-- 2. 等待转换的队列模型 (Queued Models) -->
        <div class="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <QueueListIcon class="size-5 text-slate-500" />
              <h2 class="text-base font-semibold text-slate-900">等待转换队列</h2>
              <span
                class="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600"
              >
                {{ queuedJobs.length }} 个模型
              </span>
            </div>

            <span class="text-xs text-slate-400">
              转换服务将按下方排序从上到下依次取出转换
            </span>
          </div>

          <!-- 队列列表表格 -->
          <div
            v-if="queuedJobs.length > 0"
            class="overflow-x-auto border border-slate-200 rounded-lg"
          >
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-slate-50/80 text-slate-600">
                <tr>
                  <th scope="col" class="py-3 px-4 text-left font-semibold w-24">
                    排位
                  </th>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    模型名称
                  </th>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    所属项目
                  </th>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    原始文件
                  </th>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    排队时间
                  </th>
                  <th scope="col" class="py-3 px-4 text-right font-semibold w-56">
                    调整队列顺序
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                <tr
                  v-for="(job, idx) in queuedJobs"
                  :key="job.id"
                  class="hover:bg-slate-50/60 transition-colors"
                  :class="{ 'bg-cyan-50/30': idx === 0 }"
                >
                  <!-- 排位序号 -->
                  <td class="py-3.5 px-4 font-mono font-medium">
                    <span
                      v-if="idx === 0"
                      class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-[#00b4b6] border border-[#00b4b6]/20"
                    >
                      #1 (下一个)
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-slate-500 bg-slate-100"
                    >
                      #{{ idx + 1 }}
                    </span>
                  </td>

                  <!-- 模型名称 -->
                  <td class="py-3.5 px-4 font-medium text-slate-900">
                    <div class="flex items-center gap-2">
                      <span class="truncate max-w-[240px]" :title="job.modelName">
                        {{ job.modelName }}
                      </span>
                      <span
                        class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 uppercase"
                      >
                        {{ job.fileType }}
                      </span>
                    </div>
                  </td>

                  <!-- 所属项目 -->
                  <td
                    class="py-3.5 px-4 text-slate-600 truncate max-w-[180px]"
                    :title="job.projectName"
                  >
                    {{ job.projectName }}
                  </td>

                  <!-- 原始文件 -->
                  <td
                    class="py-3.5 px-4 text-slate-500 truncate max-w-[200px]"
                    :title="job.fileName"
                  >
                    {{ job.fileName }}
                  </td>

                  <!-- 排队时间 -->
                  <td class="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                    {{ formatTime(job.createdAt) }}
                  </td>

                  <!-- 排序操作列 -->
                  <td class="py-3.5 px-4 text-right whitespace-nowrap">
                    <div class="inline-flex items-center gap-1 justify-end">
                      <button
                        type="button"
                        :disabled="idx === 0 || reorderLoading"
                        title="置顶到第 1 位"
                        class="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        @click="moveJobTop(idx)"
                      >
                        置顶
                      </button>
                      <button
                        type="button"
                        :disabled="idx === 0 || reorderLoading"
                        title="向前移动一位"
                        class="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        @click="moveJobUp(idx)"
                      >
                        <ChevronUpIcon class="size-4" />
                      </button>
                      <button
                        type="button"
                        :disabled="idx === queuedJobs.length - 1 || reorderLoading"
                        title="向后移动一位"
                        class="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        @click="moveJobDown(idx)"
                      >
                        <ChevronDownIcon class="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-else
            class="rounded-lg border border-dashed border-slate-200 py-8 text-center text-slate-400 text-sm bg-slate-50/50"
          >
            暂无排队等待转换的 {{ activeTab.toUpperCase() }} 模型
          </div>
        </div>

        <!-- 3. 已暂停的模型 (Paused Models) -->
        <div class="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <PauseCircleIcon class="size-5 text-amber-500" />
              <h2 class="text-base font-semibold text-slate-900">已暂停的模型</h2>
              <span
                class="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/50"
              >
                {{ pausedJobs.length }} 个模型
              </span>
            </div>

            <span class="text-xs text-slate-400">
              暂停的模型恢复后将直接插队进入等待队列首位（#1）
            </span>
          </div>

          <div
            v-if="pausedJobs.length > 0"
            class="overflow-x-auto border border-slate-200 rounded-lg"
          >
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-slate-50/80 text-slate-600">
                <tr>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    模型名称
                  </th>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    所属项目
                  </th>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    原始文件
                  </th>
                  <th scope="col" class="py-3 px-4 text-left font-semibold">
                    暂停时间
                  </th>
                  <th scope="col" class="py-3 px-4 text-right font-semibold w-36">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                <tr
                  v-for="job in pausedJobs"
                  :key="job.id"
                  class="hover:bg-slate-50/60 transition-colors"
                >
                  <td class="py-3.5 px-4 font-medium text-slate-900">
                    <span class="truncate max-w-[240px]" :title="job.modelName">
                      {{ job.modelName }}
                    </span>
                  </td>
                  <td
                    class="py-3.5 px-4 text-slate-600 truncate max-w-[180px]"
                    :title="job.projectName"
                  >
                    {{ job.projectName }}
                  </td>
                  <td
                    class="py-3.5 px-4 text-slate-500 truncate max-w-[200px]"
                    :title="job.fileName"
                  >
                    {{ job.fileName }}
                  </td>
                  <td class="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                    {{ formatTime(job.updatedAt) }}
                  </td>
                  <td class="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      :disabled="actionLoading"
                      class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#00b4b6] hover:bg-[#009fa1] text-white text-xs font-semibold transition-colors disabled:opacity-50"
                      @click="openResumeConfirm(job)"
                    >
                      <PlayIcon class="size-3.5" />
                      恢复转换
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-else
            class="rounded-lg border border-dashed border-slate-200 py-6 text-center text-slate-400 text-sm bg-slate-50/50"
          >
            暂无被暂停的 {{ activeTab.toUpperCase() }} 模型
          </div>
        </div>
      </div>

      <!-- 二次确认弹窗 1：暂停转换确认 -->
      <CommonConfirmDialog
        v-model:open="showPauseDialog"
        title="暂停模型转换确认"
        confirm-text="确认暂停"
        :loading="actionLoading"
        @confirm="confirmPauseJob"
      >
        <div class="text-sm text-slate-600 space-y-2 py-2">
          <p>
            确定要暂停当前正在转换的模型
            <span class="font-semibold text-slate-900">
              「{{ targetJob?.modelName }}」
            </span>
            吗？
          </p>
          <p
            class="text-xs text-amber-600 bg-amber-50 p-2.5 rounded border border-amber-200/60"
          >
            ⚠️
            提示：暂停后将立即终止当前转换进程，并立刻开始等待队列中的下一个模型转换。该模型可在已暂停列表中随时恢复。
          </p>
        </div>
      </CommonConfirmDialog>

      <!-- 二次确认弹窗 2：恢复转换确认 -->
      <CommonConfirmDialog
        v-model:open="showResumeDialog"
        title="恢复模型转换确认"
        confirm-text="确认恢复"
        :loading="actionLoading"
        @confirm="confirmResumeJob"
      >
        <div class="text-sm text-slate-600 space-y-2 py-2">
          <p>
            确定要恢复模型
            <span class="font-semibold text-slate-900">
              「{{ targetJob?.modelName }}」
            </span>
            的转换吗？
          </p>
          <p
            class="text-xs text-cyan-700 bg-cyan-50 p-2.5 rounded border border-cyan-200/60"
          >
            ℹ️
            恢复后的模型将直接进入等待队列首位（#1），在当前运行的模型完成后优先转换。
          </p>
        </div>
      </CommonConfirmDialog>
    </main>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  ArrowPathIcon,
  ArrowLeftIcon,
  PauseIcon,
  PlayIcon,
  PauseCircleIcon,
  QueueListIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CpuChipIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'

definePageMeta({
  middleware: ['auth', 'admin'],
  layout: false
})

const { triggerNotification } = useGlobalToast()

type FileType = 'ifc' | 'skp' | 'dxf'

interface ConversionJobItem {
  id: string
  jobType: string
  fileType: string
  fileName: string
  projectId: string
  projectName: string
  modelId: string
  modelName: string
  blobId: string
  status: 'processing' | 'queued' | 'paused' | string
  createdAt: string
  updatedAt: string
  attempt: number
  maxAttempt: number
  queuePosition?: number | null
  progressPercent?: number | null
  progressMessage?: string | null
}

const tabs: { type: FileType; label: string }[] = [
  { type: 'ifc', label: 'IFC 模型转换' },
  { type: 'skp', label: 'SKP 模型转换' },
  { type: 'dxf', label: 'DXF 模型转换' }
]

const activeTab = ref<FileType>('ifc')
const loading = ref(false)
const autoRefresh = ref(true)
const reorderLoading = ref(false)
const actionLoading = ref(false)

const activeJob = ref<ConversionJobItem | null>(null)
const queuedJobs = ref<ConversionJobItem[]>([])
const pausedJobs = ref<ConversionJobItem[]>([])

interface WorkerItem {
  workerId: string
  capabilities: string[]
  version: string | null
  connectedAt: string
  lastSeenAt: string
  instanceId?: string
  isLocal: boolean
}

const workers = ref<WorkerItem[]>([])
const workersLoading = ref(false)
const isWorkersCollapsed = ref(false)

const queueSummary = ref<Record<FileType, { total: number }>>({
  ifc: { total: 0 },
  skp: { total: 0 },
  dxf: { total: 0 }
})

// 弹窗状态
const showPauseDialog = ref(false)
const showResumeDialog = ref(false)
const targetJob = ref<ConversionJobItem | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null

const switchTab = (tab: FileType) => {
  activeTab.value = tab
  fetchQueueData()
}

const formatRelativeTime = (isoString?: string) => {
  if (!isoString) return '-'
  try {
    const diff = Math.max(
      0,
      Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
    )
    if (diff < 5) return '刚刚'
    if (diff < 60) return `${diff} 秒前`
    const mins = Math.floor(diff / 60)
    if (mins < 60) return `${mins} 分钟前`
    const hours = Math.floor(mins / 60)
    return `${hours} 小时前`
  } catch {
    return '-'
  }
}

const isWorkerActive = (worker: WorkerItem) => {
  if (!worker.lastSeenAt) return false
  const diff = Date.now() - new Date(worker.lastSeenAt).getTime()
  return diff <= 120 * 1000
}

const formatTime = (isoString?: string) => {
  if (!isoString) return '-'
  try {
    const d = new Date(isoString)
    const pad = (n: number) => n.toString().padStart(2, '0')
    const month = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const hours = pad(d.getHours())
    const minutes = pad(d.getMinutes())
    const seconds = pad(d.getSeconds())
    return `${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch {
    return isoString
  }
}

// 获取已注册 Worker 列表
const fetchWorkersData = async () => {
  workersLoading.value = true
  try {
    const res = await fetch('/api/v1/rvt/workers', {
      credentials: 'include'
    })
    if (res.ok) {
      const data = await res.json()
      workers.value = Array.isArray(data.workers) ? data.workers : []
    }
  } catch (err: any) {
    console.error('Failed to fetch rvt workers:', err)
  } finally {
    workersLoading.value = false
  }
}

// 统一刷新方法
const handleRefresh = async () => {
  await Promise.allSettled([fetchQueueData(), fetchAllSummaries(), fetchWorkersData()])
}

// 获取当前 Tab 的队列数据，同时附带更新其余格式的摘要数
const fetchQueueData = async () => {
  loading.value = true
  try {
    const res = await fetch(
      `/api/v1/admin/file-import-queues?fileType=${activeTab.value}`,
      {
        credentials: 'include'
      }
    )
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: 获取队列失败`)
    }
    const data = await res.json()
    activeJob.value = data.activeJob || null
    queuedJobs.value = data.queuedJobs || []
    pausedJobs.value = data.pausedJobs || []

    const currentTotal =
      (activeJob.value ? 1 : 0) + queuedJobs.value.length + pausedJobs.value.length
    queueSummary.value[activeTab.value] = { total: currentTotal }
  } catch (err: any) {
    console.error('Failed to fetch queue data:', err)
  } finally {
    loading.value = false
  }
}

// 刷新全量摘要信息
const fetchAllSummaries = async () => {
  try {
    const res = await fetch('/api/v1/admin/file-import-queues', {
      credentials: 'include'
    })
    if (res.ok) {
      const data = await res.json()
      const allJobs: ConversionJobItem[] = [
        ...(data.activeJob ? [data.activeJob] : []),
        ...(data.queuedJobs || []),
        ...(data.pausedJobs || [])
      ]
      const counts: Record<FileType, number> = { ifc: 0, skp: 0, dxf: 0 }
      for (const j of allJobs) {
        const ft = j.fileType.toLowerCase() as FileType
        if (counts[ft] !== undefined) counts[ft]++
      }
      queueSummary.value = {
        ifc: { total: counts.ifc },
        skp: { total: counts.skp },
        dxf: { total: counts.dxf }
      }
    }
  } catch {
    // ignore
  }
}

// 暂停操作
const openPauseConfirm = (job: ConversionJobItem) => {
  targetJob.value = job
  showPauseDialog.value = true
}

const confirmPauseJob = async () => {
  if (!targetJob.value) return
  actionLoading.value = true
  try {
    const res = await fetch(
      `/api/v1/admin/file-import-queues/${targetJob.value.id}/pause`,
      {
        method: 'POST',
        credentials: 'include'
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '暂停失败')

    triggerNotification({
      type: ToastNotificationType.Success,
      title: '模型转换已暂停',
      description: '已立即释放当前 Worker，开始调度下一个模型转换'
    })
    showPauseDialog.value = false
    await fetchQueueData()
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '暂停失败',
      description: err.message
    })
  } finally {
    actionLoading.value = false
  }
}

// 恢复操作
const openResumeConfirm = (job: ConversionJobItem) => {
  targetJob.value = job
  showResumeDialog.value = true
}

const confirmResumeJob = async () => {
  if (!targetJob.value) return
  actionLoading.value = true
  try {
    const res = await fetch(
      `/api/v1/admin/file-import-queues/${targetJob.value.id}/resume`,
      {
        method: 'POST',
        credentials: 'include'
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '恢复失败')

    triggerNotification({
      type: ToastNotificationType.Success,
      title: '模型转换已恢复',
      description: '该模型已成功进入排队队列第 1 位'
    })
    showResumeDialog.value = false
    await fetchQueueData()
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '恢复失败',
      description: err.message
    })
  } finally {
    actionLoading.value = false
  }
}

// 队列顺序调整
const submitReorder = async (newJobs: ConversionJobItem[]) => {
  reorderLoading.value = true
  try {
    const jobIds = newJobs.map((j) => j.id)
    const res = await fetch(
      `/api/v1/admin/file-import-queues/${activeTab.value}/reorder`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobIds })
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '保存排序失败')

    triggerNotification({
      type: ToastNotificationType.Success,
      title: '排队顺序调整成功'
    })
    queuedJobs.value = newJobs
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '调整排序失败',
      description: err.message
    })
    await fetchQueueData()
  } finally {
    reorderLoading.value = false
  }
}

const moveJobTop = (index: number) => {
  if (index <= 0) return
  const list = [...queuedJobs.value]
  const [target] = list.splice(index, 1)
  list.unshift(target)
  submitReorder(list)
}

const moveJobUp = (index: number) => {
  if (index <= 0) return
  const list = [...queuedJobs.value]
  const temp = list[index]
  list[index] = list[index - 1]
  list[index - 1] = temp
  submitReorder(list)
}

const moveJobDown = (index: number) => {
  if (index >= queuedJobs.value.length - 1) return
  const list = [...queuedJobs.value]
  const temp = list[index]
  list[index] = list[index + 1]
  list[index + 1] = temp
  submitReorder(list)
}

onMounted(() => {
  fetchQueueData()
  fetchAllSummaries()
  fetchWorkersData()

  pollTimer = setInterval(() => {
    if (
      autoRefresh.value &&
      !showPauseDialog.value &&
      !showResumeDialog.value &&
      !reorderLoading.value
    ) {
      fetchQueueData()
      fetchAllSummaries()
      fetchWorkersData()
    }
  }, 3000)
})

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>
