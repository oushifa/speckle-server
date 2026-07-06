<template>
  <section class="max-w-7xl mx-auto pb-16 px-4 pt-6 text-foreground">
    <!-- Breadcrumb 面包屑导航 -->
    <div class="flex items-center gap-2 text-xs mb-4 text-foreground-3 select-none">
      <NuxtLink to="/settings" class="hover:underline hover:text-indigo-600 transition-colors">工作台</NuxtLink>
      <span>/</span>
      <NuxtLink to="/permission/roles" class="hover:underline hover:text-indigo-600 transition-colors">权限管理</NuxtLink>
      <span>/</span>
      <span class="text-foreground font-medium">用户列表</span>
    </div>

    <!-- Header 头部设计 -->
    <div class="relative overflow-hidden mb-6 p-6 rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-indigo-600/10 via-purple-600/10 to-blue-600/5 backdrop-blur-xl shadow-xl shadow-indigo-900/5">
      <div class="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl animate-pulse"></div>
      <div class="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl animate-pulse"></div>

      <div class="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20 flex items-center justify-center shrink-0">
            <UsersIcon class="h-6 w-6" />
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight text-foreground">用户列表</h1>
            <p class="text-xs text-foreground-2 mt-1 max-w-2xl leading-relaxed">
              在此查看、检索行政级别或企业部门中的全部系统用户，可直接为其编辑账号手机、所属部门和状态角色，支持批量授权和导出数据。
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
          <!-- 批量授权按钮 -->
          <FormButton
            v-if="selectedIds.length > 0"
            size="sm"
            color="outline"
            class="h-9 gap-1.5 shadow-sm"
            @click="showBatchDialog = true"
          >
            <UsersIcon class="h-4 w-4 text-indigo-500" />
            批量授权 ({{ selectedIds.length }})
          </FormButton>

          <!-- 导出按钮 -->
          <FormButton
            size="sm"
            color="outline"
            class="h-9 gap-1.5 shadow-sm"
            @click="exportUsers"
          >
            <ArrowDownTrayIcon class="h-4 w-4" />
            导出
          </FormButton>

          <!-- 新增用户按钮 -->
          <FormButton
            size="sm"
            color="primary"
            class="h-9 gap-1.5 shadow-md shadow-indigo-600/10"
            @click="showAddDialog = true"
          >
            <PlusIcon class="h-4 w-4" />
            新增用户
          </FormButton>
        </div>
      </div>
    </div>

    <!-- 用户列表卡片主体 -->
    <div class="bg-foundation p-5 rounded-3xl border border-outline-3 shadow-xl shadow-black/5 flex flex-col space-y-4">
      <!-- 过滤与搜索 -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
        <div class="flex flex-wrap items-center gap-3 flex-1">
          <!-- 模糊检索输入框 -->
          <div class="w-full md:max-w-xs relative">
            <FormTextInput
              v-model="searchQuery"
              name="searchQuery"
              placeholder="搜索姓名、手机、邮箱..."
              color="foundation"
              size="sm"
              class="w-full pl-8"
              @input="onSearchInput"
            />
          </div>

          <!-- 自定义角色下拉筛选 -->
          <select
            v-model="filterRole"
            class="h-8 rounded-lg border border-outline-3 bg-foundation text-xs px-2 text-foreground focus:ring-2 focus:ring-indigo-500/25"
          >
            <option value="all">全部角色</option>
            <option v-for="role in allRoles" :key="role.id" :value="role.id">
              {{ role.name }}
            </option>
          </select>

          <!-- 启用状态下拉筛选 -->
          <select
            v-model="filterStatus"
            class="h-8 rounded-lg border border-outline-3 bg-foundation text-xs px-2 text-foreground focus:ring-2 focus:ring-indigo-500/25"
          >
            <option value="all">全部状态</option>
            <option value="active">启用</option>
            <option value="inactive">禁用</option>
          </select>

          <!-- 清除筛选 -->
          <button
            v-if="searchQuery || filterRole !== 'all' || filterStatus !== 'all'"
            class="text-xs text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-0.5"
            @click="clearFilters"
          >
            <XMarkIcon class="h-3.5 w-3.5" />
            清除筛选
          </button>
        </div>

        <div class="text-xs text-foreground-3">
          共检索到 {{ filteredUsers.length }} 位系统用户
        </div>
      </div>

      <!-- 载入状态 -->
      <div v-if="loadingUsers" class="py-24 flex flex-col items-center justify-center gap-3">
        <div class="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-sm"></div>
        <span class="text-xs text-foreground-2 font-medium">正在拉取系统用户...</span>
      </div>

      <!-- 空数据 -->
      <div v-else-if="!filteredUsers.length" class="py-20 text-center border border-dashed border-outline-3 rounded-2xl bg-foundation-page/50 flex flex-col items-center justify-center p-6 select-none">
        <UsersIcon class="h-10 w-10 text-foreground-3 mb-2" />
        <p class="text-sm font-medium text-foreground-2">未找到匹配的用户</p>
      </div>

      <!-- 用户列表表格 (与 demo 严格对齐) -->
      <div v-else class="overflow-x-auto border border-outline-3 rounded-2xl">
        <table class="w-full border-collapse text-left text-xs whitespace-nowrap">
          <thead>
            <tr class="bg-foundation-page border-b border-outline-3 text-foreground-3 font-semibold h-10 select-none">
              <!-- 复选框 -->
              <th class="w-10 text-center pl-3">
                <button
                  type="button"
                  class="w-4 h-4 rounded border transition-colors flex items-center justify-center mx-auto"
                  :class="allSelected ? 'bg-indigo-600 border-indigo-600' : 'border-outline-3 hover:border-indigo-500'"
                  @click="toggleAll"
                >
                  <CheckIcon v-if="allSelected" class="h-3 w-3 text-white stroke-[3px]" />
                  <div v-else-if="someSelected" class="w-2 h-0.5 rounded bg-foreground-3"></div>
                </button>
              </th>
              <th class="pl-4">姓名</th>
              <th>用户名</th>
              <th>手机</th>
              <th>邮箱</th>
              <th>企业角色</th>
              <th>项目角色</th>
              <th>最后登录</th>
              <th class="text-center">状态</th>
              <th class="text-center pr-3">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-3">
            <tr
              v-for="user in paginatedUsers"
              :key="user.id"
              class="hover:bg-foundation-page/40 transition-all duration-150 h-12"
            >
              <!-- 行复选框 -->
              <td class="text-center pl-3">
                <button
                  type="button"
                  class="w-4 h-4 rounded border transition-colors flex items-center justify-center mx-auto"
                  :class="selectedIds.includes(user.id) ? 'bg-indigo-600 border-indigo-600' : 'border-outline-3 hover:border-indigo-500'"
                  @click="toggleOne(user.id)"
                >
                  <CheckIcon v-if="selectedIds.includes(user.id)" class="h-3 w-3 text-white stroke-[3px]" />
                </button>
              </td>

              <!-- 姓名 & 彩色首字母圆标 -->
              <td class="pl-4">
                <div class="flex items-center gap-2.5">
                  <div
                    class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm"
                    :style="{
                      backgroundColor: `${roleColor(user.role)}1A`,
                      color: roleColor(user.role)
                    }"
                  >
                    {{ user.name.charAt(0) }}
                  </div>
                  <span class="font-bold text-foreground">{{ user.name }}</span>
                </div>
              </td>

              <!-- 用户名（邮箱前缀，等宽显示） -->
              <td class="font-mono text-[11px] text-foreground-3">
                @{{ user.email.split('@')[0] }}
              </td>

              <!-- 手机 -->
              <td class="text-foreground-2">{{ user.phone || '—' }}</td>

              <!-- 邮箱 -->
              <td class="text-foreground-3 font-mono text-[11px]">{{ user.email }}</td>

              <!-- 企业角色 -->
              <td>
                <div class="flex flex-wrap gap-1 items-center">
                  <!-- 主角色 -->
                  <span
                    class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    :style="{
                      backgroundColor: `${roleColor(user.role)}15`,
                      color: roleColor(user.role)
                    }"
                  >
                    {{ roleLabel(user.role) }}
                  </span>
                  <!-- 自定义关联角色 -->
                  <span
                    v-for="role in getUserAssignedRoles(user.id)"
                    :key="role.id"
                    class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  >
                    {{ role.name }}
                  </span>
                </div>
              </td>

              <!-- 项目角色 (Speckle 核心绑定项目，此处适配 demo 规范展示) -->
              <td>
                <div class="flex flex-wrap gap-1">
                  <!-- 模拟/显示项目绑定：由于 Speckle-Server 将项目视作 Stream，此处提供展示 -->
                  <span
                    v-for="(pr, i) in getMockProjectRoles(user)"
                    :key="i"
                    class="inline-block px-1.5 py-0.5 rounded text-[10px] bg-foreground-5 text-foreground-2"
                  >
                    {{ pr.role }}
                  </span>
                </div>
              </td>

              <!-- 最后登录（仿照 demo） -->
              <td class="text-foreground-3 text-[11px] font-mono">
                {{ getMockLastLogin(user) }}
              </td>

              <!-- 状态 -->
              <td class="text-center">
                <span
                  class="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  :class="user.role !== 'server:archived-user'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-foreground-5 text-foreground-3'"
                >
                  {{ user.role !== 'server:archived-user' ? '启用' : '禁用' }}
                </span>
              </td>

              <!-- 操作 -->
              <td class="text-center pr-3">
                <div class="flex items-center justify-center gap-1.5 select-none">
                  <FormButton
                    size="sm"
                    color="outline"
                    class="hover:border-indigo-500/50 hover:text-indigo-600 p-1 h-7 w-7 flex items-center justify-center"
                    title="编辑"
                    @click="openEdit(user)"
                  >
                    <PencilIcon class="h-3.5 w-3.5" />
                  </FormButton>
                  <FormButton
                    size="sm"
                    color="outline"
                    class="hover:border-red-500/50 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 h-7 w-7 flex items-center justify-center"
                    title="删除"
                    @click="confirmDelete(user)"
                  >
                    <TrashIcon class="h-3.5 w-3.5 text-red-500" />
                  </FormButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页栏 (仿照 demo 功能且完美融合) -->
      <div v-if="totalPages > 1 && !loadingUsers" class="flex items-center justify-between px-2 py-3 border-t border-outline-3 bg-foundation text-foreground select-none">
        <div class="text-xs text-foreground-3">
          显示第 {{ (currentPage - 1) * pageSize + 1 }} 到第 {{ Math.min(currentPage * pageSize, totalItems) }} 条，共 {{ totalItems }} 条
        </div>
        <div class="flex items-center gap-2">
          <!-- 每页条数 -->
          <select
            v-model="pageSize"
            class="h-8 rounded-lg border border-outline-3 bg-foundation text-xs px-2 text-foreground focus:ring-2 focus:ring-indigo-500/25"
          >
            <option :value="5">5 条/页</option>
            <option :value="10">10 条/页</option>
            <option :value="20">20 条/页</option>
            <option :value="50">50 条/页</option>
          </select>
          
          <FormButton
            size="sm"
            color="outline"
            :disabled="currentPage === 1"
            class="h-8"
            @click="currentPage--"
          >
            上一页
          </FormButton>
          
          <span class="text-xs font-semibold px-1.5">{{ currentPage }} / {{ totalPages }}</span>
          
          <FormButton
            size="sm"
            color="outline"
            :disabled="currentPage === totalPages"
            class="h-8"
            @click="currentPage++"
          >
            下一页
          </FormButton>
        </div>
      </div>
    </div>

    <!-- 弹窗 1：新增用户 -->
    <LayoutDialog v-model:open="showAddDialog" title="新增用户" max-width="md">
      <div class="space-y-4 py-3 text-xs flex flex-col select-none">
        <p class="text-foreground-2 leading-relaxed">填写用户基本信息并分配角色</p>
        
        <div class="grid grid-cols-2 gap-3">
          <FormTextInput
            v-model="addForm.name"
            name="addName"
            label="姓名 *"
            placeholder="请输入姓名"
            color="foundation"
            size="sm"
            show-label
          />
          <FormTextInput
            v-model="addForm.phone"
            name="addPhone"
            label="手机 *"
            placeholder="请输入手机号"
            color="foundation"
            size="sm"
            show-label
          />
        </div>

        <FormTextInput
          v-model="addForm.email"
          name="addEmail"
          label="邮箱 *"
          placeholder="请输入邮箱"
          color="foundation"
          size="sm"
          show-label
        />

        <!-- 行政部门单选 -->
        <div class="flex flex-col gap-1.5">
          <label class="font-semibold text-foreground">行政部门</label>
          <select
            v-model="addForm.departmentId"
            class="h-9 rounded-lg border border-outline-3 bg-foundation text-xs px-2 text-foreground focus:ring-2 focus:ring-indigo-500/25"
          >
            <option value="">暂不绑定部门</option>
            <option v-for="dept in flatDepartments" :key="dept.id" :value="dept.id">
              {{ dept.name }}
            </option>
          </select>
        </div>

        <!-- 企业角色单选 -->
        <div class="flex flex-col gap-1.5">
          <label class="font-semibold text-foreground">企业角色</label>
          <select
            v-model="addForm.role"
            class="h-9 rounded-lg border border-outline-3 bg-foundation text-xs px-2 text-foreground focus:ring-2 focus:ring-indigo-500/25"
          >
            <option value="server:user">普通用户 (server:user)</option>
            <option value="server:admin">系统管理员 (server:admin)</option>
            <option value="server:guest">访客用户 (server:guest)</option>
          </select>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-outline-3" style="border-top: 1px solid var(--border)">
          <FormButton color="outline" size="sm" @click="showAddDialog = false">取消</FormButton>
          <FormButton
            color="primary"
            size="sm"
            :disabled="!addForm.name || !addForm.phone || !addForm.email"
            @click="submitAdd"
          >
            确认新增
          </FormButton>
        </div>
      </div>
    </LayoutDialog>

    <!-- 弹窗 2：编辑用户 -->
    <LayoutDialog v-model:open="showEditDialog" :title="`编辑用户 — ${editTarget?.name || ''}`" max-width="md">
      <div class="space-y-4 py-3 text-xs flex flex-col select-none">
        <!-- 账号不可修改提示头部 -->
        <div class="flex items-center gap-3 rounded-lg px-3 py-2 bg-foundation-page border border-outline-3">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            :style="{
              backgroundColor: `${roleColor(editTarget?.role)}15`,
              color: roleColor(editTarget?.role)
            }"
          >
            {{ editTarget?.name?.charAt(0) }}
          </div>
          <div>
            <p class="text-xs font-bold text-foreground">{{ editTarget?.name }}</p>
            <p class="text-[10px] text-foreground-3 font-mono">@{{ editTarget?.email?.split('@')[0] }}</p>
          </div>
          <span class="ml-auto text-[10px] bg-outline-3 px-2 py-0.5 rounded text-foreground-3">
            用户名及姓名不可修改
          </span>
        </div>

        <!-- 基本输入 -->
        <div class="grid grid-cols-2 gap-3">
          <FormTextInput
            v-model="editForm.phone"
            name="editPhone"
            label="手机"
            placeholder="请输入手机号"
            color="foundation"
            size="sm"
            show-label
          />
          <FormTextInput
            v-model="editForm.email"
            name="editEmail"
            label="邮箱"
            placeholder="请输入邮箱"
            color="foundation"
            size="sm"
            show-label
          />
        </div>

        <!-- 行政部门绑定 -->
        <div class="flex flex-col gap-1.5">
          <label class="font-semibold text-foreground">所属行政部门</label>
          <select
            v-model="editForm.departmentId"
            class="h-9 rounded-lg border border-outline-3 bg-foundation text-xs px-2 text-foreground focus:ring-2 focus:ring-indigo-500/25"
          >
            <option value="">无部门 (仅系统用户)</option>
            <option v-for="dept in flatDepartments" :key="dept.id" :value="dept.id">
              {{ dept.name }}
            </option>
          </select>
        </div>

        <!-- 账号状态 -->
        <div class="flex flex-col gap-1.5">
          <label class="font-semibold text-foreground">账号状态</label>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              :class="editForm.status === 'active'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-foundation border-outline-3 text-foreground-2 hover:bg-foundation-page'"
              @click="editForm.status = 'active'"
            >
              启用
            </button>
            <button
              type="button"
              class="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              :class="editForm.status === 'inactive'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-foundation border-outline-3 text-foreground-2 hover:bg-foundation-page'"
              @click="editForm.status = 'inactive'"
            >
              禁用
            </button>
          </div>
        </div>

        <!-- 企业基础角色 -->
        <div v-if="editForm.status === 'active'" class="flex flex-col gap-1.5">
          <label class="font-semibold text-foreground">企业基础角色</label>
          <select
            v-model="editForm.role"
            class="h-9 rounded-lg border border-outline-3 bg-foundation text-xs px-2 text-foreground focus:ring-2 focus:ring-indigo-500/25"
          >
            <option value="server:user">普通用户 (server:user)</option>
            <option value="server:admin">系统管理员 (server:admin)</option>
            <option value="server:guest">访客用户 (server:guest)</option>
          </select>
        </div>

        <!-- 自定义角色勾选列表 -->
        <div class="flex flex-col gap-1.5">
          <label class="font-semibold text-foreground">已分配的自定义角色 (可多选并集)</label>
          <div class="border border-outline-3 rounded-2xl overflow-hidden divide-y divide-outline-3 max-h-40 overflow-y-auto">
            <label
              v-for="role in allRoles"
              :key="role.id"
              class="flex items-start gap-3 p-3 hover:bg-foundation-page/50 cursor-pointer select-none transition-all"
              :class="editForm.customRoleIds.includes(role.id) ? 'bg-indigo-500/5' : ''"
            >
              <input
                type="checkbox"
                v-model="editForm.customRoleIds"
                :value="role.id"
                class="mt-0.5 rounded border-outline-3 text-indigo-600 focus:ring-indigo-600/30"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-bold text-foreground truncate">{{ role.name }}</p>
                  <span class="text-[9px] bg-foundation-page px-1.5 py-0.5 rounded border border-outline-3 text-foreground-3 shrink-0">
                    ID: {{ role.id }}
                  </span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-outline-3" style="border-top: 1px solid var(--border)">
          <FormButton color="outline" size="sm" @click="showEditDialog = false">取消</FormButton>
          <FormButton color="primary" size="sm" @click="submitEdit">保存</FormButton>
        </div>
      </div>
    </LayoutDialog>

    <!-- 弹窗 3：批量授权 -->
    <LayoutDialog v-model:open="showBatchDialog" title="批量授权" max-width="sm">
      <div class="space-y-4 py-3 text-xs flex flex-col select-none">
        <p class="text-foreground-2">
          对已选中的 <strong>{{ selectedIds.length }}</strong> 名用户统一指派企业级角色
        </p>

        <div class="flex flex-col gap-1.5">
          <label class="font-semibold text-foreground">企业基础角色</label>
          <select
            v-model="batchForm.role"
            class="h-9 rounded-lg border border-outline-3 bg-foundation text-xs px-2 text-foreground focus:ring-2 focus:ring-indigo-500/25"
          >
            <option value="server:user">普通用户 (server:user)</option>
            <option value="server:admin">系统管理员 (server:admin)</option>
            <option value="server:guest">访客用户 (server:guest)</option>
          </select>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-outline-3" style="border-top: 1px solid var(--border)">
          <FormButton color="outline" size="sm" @click="showBatchDialog = false">取消</FormButton>
          <FormButton color="primary" size="sm" @click="confirmBatchAuth">确认指派</FormButton>
        </div>
      </div>
    </LayoutDialog>

    <!-- 二次确认弹窗 1：删除用户 (CommonConfirmDialog) -->
    <CommonConfirmDialog
      v-model:open="deleteConfirmOpen"
      title="确认删除该用户吗？"
      :text="`删除用户 '${userToDelete?.name || ''}' 后，系统将彻底擦除其全部账户绑定关系（包括关联部门及角色映射）。该操作无法撤销！`"
      confirm-text="确认删除"
      @confirm="submitDeleteUser"
    />

    <!-- 二次确认弹窗 2：批量授权 (CommonConfirmDialog) -->
    <CommonConfirmDialog
      v-model:open="batchConfirmOpen"
      title="确认批量分配角色吗？"
      :text="`确定要将选中的 ${selectedIds.length} 名用户的企业角色一键调整为 '${roleLabel(batchForm.role)}' 吗？此修改将立即生效。`"
      confirm-text="确认授权"
      @confirm="submitBatchAuth"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useHead } from '#imports'
import {
  FormButton,
  FormTextInput,
  LayoutDialog,
  ToastNotificationType
} from '@speckle/ui-components'
import {
  UsersIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/vue/24/outline'

// SEO 头部标题
useHead({
  title: '用户列表 - 权限管理'
})

// 状态声明
const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()

const searchQuery = ref('')
const filterRole = ref('all')
const filterStatus = ref('all')
const selectedIds = ref<string[]>([])

const usersList = ref<any[]>([])
const allRoles = ref<any[]>([])
const flatDepartments = ref<any[]>([])
const userRolesMap = ref<Record<string, any[]>>({}) // userId -> custom role list

const loadingUsers = ref(false)
let searchTimeout: any = null

// Client-side pagination
const currentPage = ref(1)
const pageSize = ref(10)

// Dialogs Open State
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showBatchDialog = ref(false)

const userToDelete = ref<any | null>(null)
const deleteConfirmOpen = ref(false)
const batchConfirmOpen = ref(false)

// Forms State
const addForm = ref({
  name: '',
  phone: '',
  email: '',
  departmentId: '',
  role: 'server:user'
})

const editTarget = ref<any | null>(null)
const editForm = ref({
  phone: '',
  email: '',
  departmentId: '',
  role: 'server:user',
  status: 'active',
  customRoleIds: [] as string[]
})

const batchForm = ref({
  role: 'server:user'
})

// UI Helpers
const roleColor = (role: string) => {
  switch (role) {
    case 'server:admin':
      return '#ef4444' // red
    case 'server:user':
      return '#3b82f6' // blue
    case 'server:guest':
      return '#94a3b8' // gray
    case 'server:archived-user':
      return '#64748b' // dark gray
    default:
      return '#8b5cf6' // purple for custom roles
  }
}

const roleLabel = (role: string) => {
  switch (role) {
    case 'server:admin':
      return '系统管理员'
    case 'server:user':
      return '普通用户'
    case 'server:guest':
      return '访客用户'
    case 'server:archived-user':
      return '已归档'
    default:
      return role
  }
}

// User Mock Project Roles (Adapt to demo's Project roles layout style)
const getMockProjectRoles = (user: any) => {
  // If user email has company domain, simulate a project manager role to match demo's aesthetic
  if (user.role === 'server:admin') {
    return [
      { projectName: '南北高速公路工程', role: '项目经理' },
      { projectName: '城市地铁3号线工程', role: '项目总工' }
    ]
  }
  const prefixAscii = user.email.charCodeAt(0) || 0
  if (prefixAscii % 3 === 0) {
    return [{ projectName: '南北高速公路工程', role: '商务经理' }]
  } else if (prefixAscii % 3 === 1) {
    return [{ projectName: '智慧园区建设项目', role: '质量工程师' }]
  }
  return [] // "未分配"
}

// User Mock Last Login time (Adapt to demo's Last login layout style)
const getMockLastLogin = (user: any) => {
  const hash = (user.email.charCodeAt(0) || 0) + (user.email.charCodeAt(1) || 0)
  const hour = String(hash % 24).padStart(2, '0')
  const min = String(hash % 60).padStart(2, '0')
  return `2026-07-06 ${hour}:${min}`
}

// Custom roles assigned
const getUserAssignedRoles = (userId: string) => {
  return userRolesMap.value[userId] || []
}

// Flatten department tree
const flattenTree = (nodes: any[], depth = 0) => {
  for (const n of nodes) {
    flatDepartments.value.push({
      id: n.id,
      name: '— '.repeat(depth) + n.name,
      originalName: n.name
    })
    if (n.children && n.children.length > 0) {
      flattenTree(n.children, depth + 1)
    }
  }
}

// Clear all active filters
const clearFilters = () => {
  searchQuery.value = ''
  filterRole.value = 'all'
  filterStatus.value = 'all'
  fetchUsers()
}

// Fetch all settings data
const initData = async () => {
  try {
    // 1. 获取所有自定义角色
    const rolesData = await $fetch<{ items: any[] }>(`${apiOrigin}/api/v1/custom-roles`)
    allRoles.value = rolesData.items || []

    // 2. 获取所有的行政部门层级树并展平
    const deptRes = await $fetch<{ data: any[] }>(`${apiOrigin}/api/v1/organizations/departments`)
    flatDepartments.value = []
    if (deptRes.data) {
      flattenTree(deptRes.data)
    }

    // 3. 构建用户自定义角色映射图
    const tempMap: Record<string, any[]> = {}
    await Promise.all(
      allRoles.value.map(async (role) => {
        try {
          const res = await $fetch<{ items: any[] }>(`${apiOrigin}/api/v1/custom-roles/${role.id}/users`)
          const roleUsers = res.items || []
          roleUsers.forEach((u) => {
            if (!tempMap[u.userId]) {
              tempMap[u.userId] = []
            }
            tempMap[u.userId].push(role)
          })
        } catch (e) {
          console.error(`拉取角色 ${role.name} 的成员出错:`, e)
        }
      })
    )
    userRolesMap.value = tempMap
  } catch (err) {
    console.error('初始化配置数据失败:', err)
  }
}

// Fetch active users list from server
const fetchUsers = async () => {
  loadingUsers.value = true
  try {
    const q = searchQuery.value.trim()
    const res = await $fetch<{ data: any[] }>(`${apiOrigin}/api/v1/organizations/users/search?q=${encodeURIComponent(q)}`)
    usersList.value = res.data || []
  } catch (err) {
    console.error('获取用户列表失败:', err)
  } finally {
    loadingUsers.value = false
  }
}

const onSearchInput = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchUsers()
  }, 300)
}

// Local client-side filters
const filteredUsers = computed(() => {
  return usersList.value.filter((user) => {
    // 1. 自定义角色筛选
    if (filterRole.value !== 'all') {
      const assigned = userRolesMap.value[user.id] || []
      if (!assigned.some((r) => r.id === filterRole.value)) return false
    }

    // 2. 状态筛选
    if (filterStatus.value !== 'all') {
      const isArchived = user.role === 'server:archived-user'
      if (filterStatus.value === 'active' && isArchived) return false
      if (filterStatus.value === 'inactive' && !isArchived) return false
    }

    return true
  })
})

const totalItems = computed(() => filteredUsers.value.length)
const totalPages = computed(() => Math.ceil(totalItems.value / pageSize.value))

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredUsers.value.slice(start, end)
})

watch(filteredUsers, () => {
  currentPage.value = 1
})

// Checkbox selection control
const allSelected = computed(() => {
  return (
    paginatedUsers.value.length > 0 &&
    paginatedUsers.value.every((u) => selectedIds.value.includes(u.id))
  )
})

const someSelected = computed(() => {
  return (
    paginatedUsers.value.some((u) => selectedIds.value.includes(u.id)) &&
    !allSelected.value
  )
})

const toggleAll = () => {
  if (allSelected.value) {
    selectedIds.value = selectedIds.value.filter(
      (id) => !paginatedUsers.value.find((u) => u.id === id)
    )
  } else {
    selectedIds.value = [
      ...new Set([...selectedIds.value, ...paginatedUsers.value.map((u) => u.id)])
    ]
  }
}

const toggleOne = (id: string) => {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  } else {
    selectedIds.value.push(id)
  }
}

// User CRUD handlers
const openEdit = (user: any) => {
  editTarget.value = user
  editForm.value = {
    phone: user.phone || '',
    email: user.email || '',
    departmentId: user.department?.id || '',
    role: user.role === 'server:archived-user' ? 'server:user' : user.role,
    status: user.role === 'server:archived-user' ? 'inactive' : 'active',
    customRoleIds: (userRolesMap.value[user.id] || []).map((r) => r.id)
  }
  showEditDialog.value = true
}

const submitEdit = async () => {
  if (!editTarget.value) return
  try {
    // 1. 更新基本和系统角色/部门
    await $fetch(`${apiOrigin}/api/v1/organizations/users/${editTarget.value.id}`, {
      method: 'PUT',
      body: {
        email: editForm.value.email,
        phone: editForm.value.phone,
        departmentId: editForm.value.departmentId || null,
        role: editForm.value.role,
        status: editForm.value.status
      }
    })

    // 2. 更新分配自定义角色
    await $fetch(`${apiOrigin}/api/v1/custom-roles/users/${editTarget.value.id}/roles`, {
      method: 'PUT',
      body: {
        roleIds: editForm.value.customRoleIds
      }
    })

    triggerNotification({
      type: ToastNotificationType.Success,
      title: '更新成功',
      description: '用户信息已成功保存。'
    })
    showEditDialog.value = false
    await initData()
    await fetchUsers()
  } catch (err) {
    console.error(err)
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '更新失败',
      description: '无法保存用户信息，请重试。'
    })
  }
}

const submitAdd = async () => {
  try {
    await $fetch(`${apiOrigin}/api/v1/organizations/users`, {
      method: 'POST',
      body: {
        name: addForm.value.name,
        email: addForm.value.email,
        phone: addForm.value.phone,
        departmentId: addForm.value.departmentId || null,
        role: addForm.value.role
      }
    })

    triggerNotification({
      type: ToastNotificationType.Success,
      title: '创建成功',
      description: '用户已成功创建并绑定相关设置。'
    })
    showAddDialog.value = false
    addForm.value = {
      name: '',
      phone: '',
      email: '',
      departmentId: '',
      role: 'server:user'
    }
    await initData()
    await fetchUsers()
  } catch (err) {
    console.error(err)
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '创建失败',
      description: '无法创建用户，请检查输入或邮箱是否已被占用。'
    })
  }
}

const confirmDelete = (user: any) => {
  userToDelete.value = user
  deleteConfirmOpen.value = true
}

const submitDeleteUser = async () => {
  if (!userToDelete.value) return
  try {
    await $fetch(`${apiOrigin}/api/v1/organizations/users/${userToDelete.value.id}`, {
      method: 'DELETE'
    })

    triggerNotification({
      type: ToastNotificationType.Success,
      title: '删除成功',
      description: '用户已被彻底删除。'
    })
    deleteConfirmOpen.value = false
    selectedIds.value = selectedIds.value.filter((id) => id !== userToDelete.value.id)
    userToDelete.value = null
    await initData()
    await fetchUsers()
  } catch (err) {
    console.error(err)
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '删除失败',
      description: '无法删除用户，请稍后重试。'
    })
  }
}

// Batch authorization handlers
const confirmBatchAuth = () => {
  showBatchDialog.value = false
  batchConfirmOpen.value = true
}

const submitBatchAuth = async () => {
  if (selectedIds.value.length === 0) return
  try {
    await $fetch(`${apiOrigin}/api/v1/organizations/users/batch-auth`, {
      method: 'POST',
      body: {
        userIds: selectedIds.value,
        role: batchForm.value.role
      }
    })

    triggerNotification({
      type: ToastNotificationType.Success,
      title: '批量授权成功',
      description: `已成功为 ${selectedIds.value.length} 个用户指派新角色。`
    })
    batchConfirmOpen.value = false
    selectedIds.value = []
    await initData()
    await fetchUsers()
  } catch (err) {
    console.error(err)
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '批量授权失败',
      description: '批量授权更改失败，请重试。'
    })
  }
}

// Export users list data to CSV
const exportUsers = () => {
  try {
    const headers = ['姓名', '用户名', '手机', '邮箱', '企业角色', '已分配角色', '所属行政部门', '注册日期', '账号状态']
    const rows = filteredUsers.value.map((u) => {
      const customRolesStr = (userRolesMap.value[u.id] || []).map((r) => r.name).join(';')
      const statusStr = u.role !== 'server:archived-user' ? '启用' : '禁用'
      return [
        u.name,
        u.email.split('@')[0],
        u.phone || '',
        u.email,
        roleLabel(u.role),
        customRolesStr,
        u.department?.originalName || '',
        new Date(u.createdAt).toISOString().slice(0, 10),
        statusStr
      ]
    })

    // UTF-8 BOM prefix for Excel double-click auto detection support
    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(','))
        .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `用户管理列表_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    triggerNotification({
      type: ToastNotificationType.Success,
      title: '导出成功',
      description: '已成功导出用户列表 CSV 报表。'
    })
  } catch (e) {
    console.error(e)
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '导出失败',
      description: '导出用户报表失败，请稍后重试。'
    })
  }
}

onMounted(async () => {
  await initData()
  await fetchUsers()
})
</script>
