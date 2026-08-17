<template>
  <div class="permission-management-root p-4 text-foreground font-sans">
    <div class="rounded-lg shadow-sm p-4" style="background-color: var(--card)">
      <!-- Breadcrumb (像素级复刻) -->
      <div class="flex items-center gap-2 text-xs mb-3" style="color: var(--muted-foreground)">
        <span class="hover:underline cursor-pointer">项目管理</span>
        <span>/</span>
        <span class="hover:underline cursor-pointer">项目设置</span>
        <span>/</span>
        <span style="color: var(--foreground)">权限管理</span>
        <span>/</span>
        <span style="color: var(--foreground)">数智南北系统</span>
      </div>

      <!-- Header & Domain Toggle (像素级复刻) -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-bold" style="color: var(--foreground)">角色配置</h1>
          
          <!-- Domain Toggle (企业级与项目级全局切换开关) -->
          <div class="flex items-center gap-1 rounded-lg p-1" style="background-color: var(--muted); border: 1px solid var(--border)">
            <button
              class="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all"
              :style="{
                backgroundColor: domain === 'project' ? 'var(--card)' : 'transparent',
                color: domain === 'project' ? 'var(--foreground)' : 'var(--muted-foreground)',
                boxShadow: domain === 'project' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }"
              @click="domain = 'project'"
            >
              <ShieldCheckIcon class="w-3.5 h-3.5" />
              项目级
            </button>
            <button
              class="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all"
              :style="{
                backgroundColor: domain === 'enterprise' ? 'var(--card)' : 'transparent',
                color: domain === 'enterprise' ? 'var(--foreground)' : 'var(--muted-foreground)',
                boxShadow: domain === 'enterprise' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }"
              @click="domain = 'enterprise'"
            >
              <Square2StackIcon class="w-3.5 h-3.5" />
              企业级
            </button>
          </div>
        </div>
      </div>

      <!-- Split layout (像素级复刻) -->
      <div class="grid gap-4" style="grid-template-columns: 240px 1fr">
        
        <!-- ── Left: Role list (像素级复刻) ── -->
        <div class="rounded-lg overflow-hidden flex flex-col" style="border: 1px solid var(--border)">
          <div class="p-3 flex items-center justify-between flex-shrink-0" style="border-bottom: 1px solid var(--border); background-color: var(--muted)">
            <h3 class="text-xs font-semibold" style="color: var(--foreground)">角色列表</h3>
            <button
              v-if="hasFunctionalPerm('ent-permission:create')"
              class="h-7 px-2.5 rounded text-[11px] font-bold inline-flex items-center gap-1 transition-all"
              style="background-color: var(--primary); color: var(--primary-foreground)"
              @click="openAddRoleModal"
            >
              <PlusIcon class="w-3 h-3" />
              新增角色
            </button>
          </div>

          <div class="p-2 flex-shrink-0" style="border-bottom: 1px solid var(--border)">
            <div class="relative">
              <MagnifyingGlassIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style="color: var(--muted-foreground)" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索角色..."
                class="w-full h-7 pl-8 pr-3 text-[11px] rounded border focus:outline-none"
                style="background-color: var(--input-background); border-color: var(--border); color: var(--foreground)"
              />
            </div>
          </div>

          <div class="overflow-y-auto" style="max-height: 640px">
            <div v-if="filteredRoles.length === 0" class="p-6 text-center text-xs" style="color: var(--muted-foreground)">
              暂无角色
            </div>
            <div
              v-else
              v-for="role in filteredRoles"
              :key="role.id"
              class="group/item p-3 cursor-pointer transition-colors flex items-center justify-between gap-2"
              :style="{
                borderLeft: `3px solid ${selectedRoleId === role.id ? getRoleHexColor(role.name) : 'transparent'}`,
                backgroundColor: selectedRoleId === role.id ? 'var(--accent)' : undefined,
                borderBottom: '1px solid var(--border)'
              }"
              @click="selectRole(role)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div
                  class="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                  :style="{
                    backgroundColor: getRoleBgColor(role.name),
                    color: getRoleHexColor(role.name)
                  }"
                >
                  {{ role.name.charAt(0) }}
                </div>

                <div class="flex-1 min-w-0">
                  <span class="text-xs font-semibold truncate block" style="color: var(--foreground)">
                    {{ role.name }}
                  </span>
                  <div class="flex items-center gap-2 mt-1 text-[10px] font-medium" style="color: var(--muted-foreground)">
                    <span class="flex items-center gap-0.5">
                      <UsersIcon class="w-3 h-3" />
                      {{ getRoleMemberCount(role.id) }}人
                    </span>
                    <span style="color: var(--border)">·</span>
                    <span>菜单 {{ (role.menuPerms || []).length }}</span>
                  </div>
                </div>
              </div>

              <!-- 操作按键 -->
              <div class="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                <button
                  v-if="hasFunctionalPerm('ent-permission:edit')"
                  class="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-all text-foreground-3 hover:text-foreground"
                  title="修改名称"
                  @click.stop="openRenameModal(role)"
                >
                  <PencilIcon class="h-3 w-3" />
                </button>
                <button
                  v-if="hasFunctionalPerm('ent-permission:delete')"
                  class="p-0.5 hover:bg-red-500/15 rounded transition-all text-foreground-3 hover:text-red-500"
                  title="删除角色"
                  @click.stop="triggerDeleteRole(role)"
                >
                  <TrashIcon class="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Right: Permission panel (像素级复刻) ── -->
        <div class="rounded-lg overflow-hidden flex flex-col bg-foundation" style="border: 1px solid var(--border); min-height: 500px">
          <div v-if="!selectedRole" class="flex-1 flex items-center justify-center p-12">
            <div class="text-center">
              <ShieldCheckIcon class="w-14 h-14 mx-auto mb-4" style="color: var(--muted-foreground); opacity: 0.2" />
              <p class="text-sm font-semibold mb-1" style="color: var(--muted-foreground)">请选择角色</p>
              <p class="text-xs" style="color: var(--muted-foreground)">从左侧列表选择角色，配置其权限与成员</p>
            </div>
          </div>

          <div v-else class="flex flex-col h-full overflow-hidden">
            <!-- Role header -->
            <div class="p-4 flex-shrink-0 border-b border-outline-3 flex items-center justify-between gap-4" style="border-bottom: 1px solid var(--border); background-color: var(--muted)">
              <div class="flex items-center gap-3">
                <div
                  class="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold border"
                  :style="{
                    backgroundColor: getRoleBgColor(selectedRole.name),
                    color: getRoleHexColor(selectedRole.name),
                    borderColor: 'var(--border)'
                  }"
                >
                  {{ selectedRole.name.charAt(0) }}
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-sm" style="color: var(--foreground)">{{ selectedRole.name }}</h3>
                    <span
                      class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      :style="{
                        backgroundColor: getRoleBgColor(selectedRole.name),
                        color: getRoleHexColor(selectedRole.name)
                      }"
                    >
                      {{ getRoleMemberCount(selectedRoleId) }} 名成员
                    </span>
                  </div>
                  <p class="text-[11px] mt-0.5" style="color: var(--muted-foreground)">正在配置 {{ domain === 'project' ? '项目级' : '企业级' }} 范围下的权限设定</p>
                </div>
              </div>

              <button
                v-if="hasFunctionalPerm('ent-permission:edit')"
                class="h-7.5 px-3.5 rounded text-xs font-bold transition-all shrink-0"
                style="background-color: var(--primary); color: var(--primary-foreground)"
                :disabled="savingPerms"
                @click="savePermissions"
              >
                {{ savingPerms ? '正在保存...' : '保存配置' }}
              </button>
            </div>

            <!-- Tabs (Demo 样式 - 根据 Domain 切换) -->
            <div class="flex flex-shrink-0 overflow-x-auto bg-foundation border-b border-outline-3 scrollbar-none" style="border-bottom: 1px solid var(--border)">
              <button
                v-for="tab in TABS"
                :key="tab.key"
                @click="activeTab = tab.key"
                class="flex items-center gap-1.5 px-4 py-3 text-xs transition-colors whitespace-nowrap border-b-2 -mb-px"
                :style="{
                  color: activeTab === tab.key ? 'var(--primary)' : 'var(--muted-foreground)',
                  fontWeight: activeTab === tab.key ? 600 : 400,
                  borderBottomColor: activeTab === tab.key ? 'var(--primary)' : 'transparent'
                }"
              >
                <component :is="tab.icon" class="w-3.5 h-3.5 shrink-0" />
                <span>{{ tab.label }}</span>
                <span
                  v-if="tab.key === 'users'"
                  class="ml-1 text-[9px] px-1.5 py-0.2 rounded-full"
                  style="background-color: var(--muted); color: var(--muted-foreground)"
                >
                  {{ getRoleMemberCount(selectedRoleId) }}
                </span>
              </button>
            </div>

            <!-- Tab content -->
            <div class="flex-1 overflow-y-auto">
              
              <!-- 1. 菜单权限 Tab -->
              <div v-if="activeTab === 'menu'" class="divide-y divide-outline-3">
                <!-- 快捷操作栏 -->
                <div class="flex items-center gap-3 px-4 py-2" style="border-bottom: 1px solid var(--border); background-color: var(--muted)">
                  <button class="text-xs hover:underline font-semibold" style="color: var(--primary)" @click="selectAllMenus">全选</button>
                  <span style="color: var(--border)">|</span>
                  <button class="text-xs hover:underline font-semibold" style="color: var(--primary)" @click="clearAllMenus">清空</button>
                  <span class="ml-auto text-xs" style="color: var(--muted-foreground)">已启用 {{ selectedMenuCount }} 个页面</span>
                </div>

                <!-- 企业级菜单树列表 -->
                <div v-if="domain === 'enterprise'">
                  <div
                    v-for="menu in enterpriseMenus"
                    :key="menu.id"
                    class="flex items-center gap-2.5 py-2.5 px-3 hover:bg-accent/40 transition-colors border-b"
                    style="border-bottom: 1px solid var(--border)"
                  >
                    <span class="w-5 flex-shrink-0" />
                    <input
                      type="checkbox"
                      v-model="tempMenuPerms"
                      :value="menu.id"
                      class="rounded border-outline-3 text-blue-600 focus:ring-blue-600/30 scale-90 cursor-pointer"
                    />
                    <FolderIcon class="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span class="text-xs font-bold" style="color: var(--foreground)">{{ menu.label }}</span>
                  </div>
                </div>

                <!-- 项目级二级页面菜单树 -->
                <div v-else>
                  <div v-for="grp in projectMenuTree" :key="grp.id">
                    <!-- 一级分组 (level = 0, 带灰色背景) -->
                    <div
                      class="flex items-center gap-2.5 py-2.5 px-3 transition-colors border-b"
                      style="border-bottom: 1px solid var(--border); background-color: var(--muted)"
                    >
                      <button @click="toggleExpandMenu(grp.id)" class="flex-shrink-0 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800">
                        <ChevronDownIcon v-if="isMenuExpanded(grp.id)" class="w-3.5 h-3.5" style="color: var(--muted-foreground)" />
                        <ChevronRightIcon v-else class="w-3.5 h-3.5" style="color: var(--muted-foreground)" />
                      </button>
                      <input
                        type="checkbox"
                        :checked="isGroupChecked(grp)"
                        class="rounded border-outline-3 text-blue-600 focus:ring-blue-600/30 scale-90 cursor-pointer"
                        @change="toggleGroupMenu(grp)"
                      />
                      <FolderIcon class="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span class="text-xs font-bold" style="color: var(--foreground)">{{ grp.label }}</span>
                    </div>

                    <!-- 二级页面 (level = 1, 缩进) -->
                    <div v-if="isMenuExpanded(grp.id) && grp.children">
                      <div
                        v-for="child in grp.children"
                        :key="child.id"
                        class="flex items-center gap-2.5 py-2.5 pr-3 hover:bg-accent/40 transition-colors border-b"
                        style="padding-left: 32px; border-bottom: 1px solid var(--border)"
                      >
                        <span class="w-3.5 shrink-0" />
                        <input
                          type="checkbox"
                          v-model="tempMenuPerms"
                          :value="child.id"
                          class="rounded border-outline-3 text-blue-600 focus:ring-blue-600/30 scale-90 cursor-pointer"
                          @change="onProjectMenuToggle(child.id)"
                        />
                        <DocumentIcon class="w-3.5 h-3.5 text-foreground-3 shrink-0" />
                        <span class="text-xs" style="color: var(--foreground)">{{ child.label }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 2. 功能权限 Tab (二维矩阵表格样式，项目级与企业级分别渲染，均包含 Checkbox 矩阵) ── -->
              <div v-if="activeTab === 'function'">
                <!-- 二维表格表头 -->
                <div
                  class="grid sticky top-0 z-10 text-[10px] font-bold text-foreground-3"
                  :style="{
                    gridTemplateColumns: gridCols,
                    backgroundColor: 'var(--muted)',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--muted-foreground)'
                  }"
                >
                  <div class="px-3.5 py-3">功能模块</div>
                  <div
                    v-for="act in functionalActions"
                    :key="act.id"
                    class="py-3 text-center cursor-pointer hover:text-blue-600 select-none"
                    @click="toggleActionColumn(act.id)"
                    title="点击全选此列"
                  >
                    {{ act.label }}
                  </div>
                </div>

                <!-- 二维表格内容体 -->
                <div>
                  <!-- 企业级功能行渲染 -->
                  <div v-if="domain === 'enterprise'">
                    <div
                      v-for="(menu, idx) in enterpriseMenus"
                      :key="menu.id"
                      class="grid items-center hover:bg-accent/30 transition-colors"
                      :style="{
                        gridTemplateColumns: gridCols,
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: idx % 2 !== 0 ? 'rgba(236, 236, 240, 0.3)' : undefined
                      }"
                    >
                      <div class="px-3.5 py-3 text-xs font-semibold" style="color: var(--foreground)">
                        {{ menu.label }}
                      </div>
                      <div
                        v-for="act in functionalActions"
                        :key="act.id"
                        class="flex justify-center py-3"
                      >
                        <input
                          type="checkbox"
                          :checked="isActionChecked(menu.id, act.id)"
                          class="rounded border-outline-3 text-blue-600 focus:ring-blue-600/30 scale-90 cursor-pointer"
                          @change="toggleAction(menu.id, act.id)"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- 项目级功能行渲染 (带分组折叠) -->
                  <div v-else>
                    <div v-for="grp in projectMenuTree" :key="grp.id">
                      <!-- 分组头行 (不带复选框) -->
                      <div
                        class="grid items-center"
                        :style="{
                          gridTemplateColumns: gridCols,
                          borderBottom: '1px solid var(--border)',
                          backgroundColor: 'var(--muted)',
                          padding: '6px 0'
                        }"
                      >
                        <div class="px-3 text-xs font-semibold" style="color: var(--muted-foreground)">{{ grp.label }}</div>
                        <div v-for="act in functionalActions" :key="act.id" />
                      </div>

                      <!-- 二级页面行 -->
                      <div
                        v-for="(child, idx) in grp.children"
                        :key="child.id"
                        class="grid items-center hover:bg-accent/30 transition-colors"
                        :style="{
                          gridTemplateColumns: gridCols,
                          borderBottom: '1px solid var(--border)',
                          backgroundColor: idx % 2 !== 0 ? 'rgba(236, 236, 240, 0.3)' : undefined
                        }"
                      >
                        <div class="px-3.5 py-3 text-xs pl-6" style="color: var(--foreground)">
                          {{ child.label }}
                        </div>
                        <div
                          v-for="act in functionalActions"
                          :key="act.id"
                          class="flex justify-center py-3"
                        >
                          <input
                            type="checkbox"
                            :checked="isActionChecked(child.id, act.id)"
                            class="rounded border-outline-3 text-blue-600 focus:ring-blue-600/30 scale-90 cursor-pointer"
                            @change="toggleAction(child.id, act.id)"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 3. 数据权限 Tab (Radio 卡片组样式) -->
              <div v-if="activeTab === 'data'" class="flex flex-col p-4 max-w-md">
                <div class="space-y-3">
                  <h4 class="text-xs font-semibold" style="color: var(--foreground)">数据范围</h4>
                  <div class="rounded-lg overflow-hidden" style="border: 1px solid var(--border)">
                    <div
                      v-for="(opt, idx) in dataPermissionOptions"
                      :key="opt.value"
                      @click="tempDataPerm = opt.value"
                      class="flex items-center gap-3 p-3 cursor-pointer transition-colors"
                      :style="{
                        borderBottom: idx < dataPermissionOptions.length - 1 ? '1px solid var(--border)' : undefined,
                        backgroundColor: tempDataPerm === opt.value ? 'rgba(59, 130, 246, 0.08)' : undefined
                      }"
                    >
                      <div
                        class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        :style="{
                          borderColor: tempDataPerm === opt.value ? 'var(--primary)' : 'var(--border)',
                          backgroundColor: tempDataPerm === opt.value ? 'var(--primary)' : 'transparent'
                        }"
                      >
                        <div v-if="tempDataPerm === opt.value" class="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                      <div>
                        <p class="text-xs font-semibold" style="color: var(--foreground)">{{ opt.label }}</p>
                        <p class="text-[10px]" style="color: var(--muted-foreground)">{{ opt.desc }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 4. 扩展维度 Tab (预留专业与标段) -->
              <div v-if="activeTab === 'extensions'" class="p-5 relative overflow-hidden">
                <div class="absolute inset-0 bg-white/5 dark:bg-black/5 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-6 z-10 select-none">
                  <ExclamationTriangleIcon class="h-8 w-8 text-amber-500 mb-2 animate-bounce" />
                  <p class="text-xs font-bold text-foreground">维度扩展预留</p>
                  <p class="text-[10px] text-foreground-3 mt-1 max-w-xs leading-normal">
                    专业维度和标段数据维度权限在数据库结构及后端 API 层已完成预留，将随着下一步业务构件绑定功能的发布而同步解封。
                  </p>
                </div>

                <div class="opacity-30 pointer-events-none select-none space-y-6">
                  <div>
                    <h3 class="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                      <TagIcon class="h-4 w-4 text-blue-500" />
                      预留：专业数据权限
                    </h3>
                    <div class="grid grid-cols-3 gap-3">
                      <span
                        v-for="spec in placeholderSpecialties"
                        :key="spec"
                        class="p-2 border border-outline-3 rounded-lg text-[10px] font-semibold text-center text-foreground-2 bg-foundation-page/50"
                      >
                        {{ spec }}
                      </span>
                    </div>
                  </div>

                  <div class="border-t border-outline-3 pt-4" style="border-top: 1px solid var(--border)">
                    <h3 class="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                      <QueueListIcon class="h-4 w-4 text-blue-500" />
                      预留：工程标段权限
                    </h3>
                    <div class="grid grid-cols-4 gap-3">
                      <span
                        v-for="sec in placeholderSections"
                        :key="sec"
                        class="p-1.5 border border-outline-3 rounded-lg text-[10px] font-semibold text-center text-foreground-2 bg-foundation-page/50"
                      >
                        {{ sec }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 5. 权限预览 Tab -->
              <div v-if="activeTab === 'preview'" class="p-4 space-y-4">
                <div class="flex items-start gap-2 rounded-lg p-3 text-xs" style="background-color: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.15)">
                  <ExclamationTriangleIcon class="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span style="color: var(--foreground)">
                    以下为 <strong>{{ selectedRole.name }}</strong> 角色的当前已配置权限总览。
                  </span>
                </div>

                <div class="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <!-- 企业级菜单预览 -->
                  <div class="rounded-lg overflow-hidden" style="border: 1px solid var(--border)">
                    <div class="px-3 py-2 flex items-center gap-2" style="background-color: var(--muted); border-bottom: 1px solid var(--border)">
                      <Square2StackIcon class="w-3.5 h-3.5 text-blue-600" />
                      <span class="text-xs font-semibold" style="color: var(--foreground)">企业级启用菜单及操作</span>
                    </div>
                    <div class="p-3 space-y-2 max-h-[220px] overflow-y-auto">
                      <div v-for="id in previewEntMenus" :key="id">
                        <div class="flex items-center gap-1.5">
                          <FolderIcon class="w-3 h-3 text-blue-500" />
                          <span class="text-xs font-bold text-foreground-2">{{ id }}</span>
                        </div>
                        <!-- 显示对应的企业级按钮操作 -->
                        <div class="flex flex-wrap gap-1 mt-1 pl-4">
                          <span
                            v-for="act in getMenuActionsPreview(getEntMenuIdByLabel(id))"
                            :key="act"
                            class="text-[9px] px-1 bg-blue-500/10 text-blue-600 rounded font-semibold"
                          >
                            {{ act }}
                          </span>
                        </div>
                      </div>
                      <span v-if="!previewEntMenus.length" class="text-xs text-foreground-3 block text-center py-2">无配置</span>
                    </div>
                  </div>

                  <!-- 项目级权限预览 -->
                  <div class="rounded-lg overflow-hidden" style="border: 1px solid var(--border)">
                    <div class="px-3 py-2 flex items-center gap-2" style="background-color: var(--muted); border-bottom: 1px solid var(--border)">
                      <FolderIcon class="w-3.5 h-3.5 text-blue-600" />
                      <span class="text-xs font-semibold" style="color: var(--foreground)">项目级启用菜单及操作</span>
                    </div>
                    <div class="p-3 space-y-2 max-h-[220px] overflow-y-auto">
                      <div v-for="item in previewProjActions" :key="item.menuLabel">
                        <div class="flex items-center gap-1.5">
                          <DocumentIcon class="w-3 h-3 text-slate-500" />
                          <span class="text-xs font-bold" style="color: var(--foreground)">{{ item.menuLabel }}</span>
                        </div>
                        <div class="flex flex-wrap gap-1 mt-1 pl-4">
                          <span v-for="act in item.actions" :key="act" class="text-[9px] px-1 bg-emerald-500/10 text-emerald-600 rounded">
                            {{ act }}
                          </span>
                        </div>
                      </div>
                      <span v-if="!previewProjActions.length" class="text-xs text-foreground-3 block text-center py-2">无配置</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 6. 成员列表 Tab -->
              <div v-if="activeTab === 'users'" class="p-4 flex flex-col gap-4">
                <div class="flex items-center justify-between pb-2" style="border-bottom: 1px solid var(--border)">
                  <h3 class="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <UsersIcon class="h-4 w-4 text-blue-600" />
                    成员列表
                  </h3>
                  <button
                    v-if="hasFunctionalPerm('ent-permission:create')"
                    class="h-7 px-3 rounded text-[11px] font-semibold transition-all shrink-0"
                    style="background-color: var(--primary); color: var(--primary-foreground)"
                    @click="openAddUserModal"
                  >
                    指派成员
                  </button>
                </div>

                <div v-if="loadingUsers" class="py-12 flex flex-col items-center justify-center gap-2">
                  <div class="h-6 w-6 animate-spin rounded-full border-3 border-blue-600 border-t-transparent"></div>
                  <span class="text-xs text-foreground-2">正在拉取成员...</span>
                </div>

                <div v-else-if="!roleUsers.length" class="py-10 text-center border border-dashed rounded-lg flex flex-col items-center justify-center p-6 bg-foundation-page/20" style="border-color: var(--border)">
                  <UsersIcon class="h-8 w-8 text-foreground-3 mb-1.5" />
                  <p class="text-xs text-foreground-2">当前角色下无分配的成员</p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                  <div
                    v-for="usr in roleUsers"
                    :key="usr.userId"
                    class="flex items-center justify-between p-3 border rounded-lg hover:shadow-sm transition-all"
                    style="border-color: var(--border)"
                  >
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span
                        class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border"
                        :style="{
                          backgroundColor: getRoleBgColor(selectedRole.name),
                          color: getRoleHexColor(selectedRole.name),
                          borderColor: 'var(--border)'
                        }"
                      >
                        {{ usr.userName.charAt(0) }}
                      </span>
                      <div class="min-w-0">
                        <p class="text-xs font-bold text-foreground leading-snug truncate">{{ usr.userName }}</p>
                        <p class="text-[9px] text-foreground-3 mt-0.5 leading-snug truncate">ID: {{ usr.userId }}</p>
                      </div>
                    </div>
                    <button
                      v-if="hasFunctionalPerm('ent-permission:delete')"
                      class="p-1 hover:bg-red-500/10 rounded text-foreground-3 hover:text-red-500 transition-all shrink-0"
                      title="移除成员"
                      @click="triggerRemoveUser(usr)"
                    >
                      <TrashIcon class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗 1：新增角色 -->
    <LayoutDialog v-model:open="addRoleModalOpen" title="新建自定义角色" max-width="md">
      <div class="space-y-4 py-3 text-sm">
        <FormTextInput
          v-model="newRoleName"
          name="newRoleName"
          label="角色名称"
          placeholder="例如：商务经理"
          show-label
          @keydown.enter="submitCreateRole"
        />
        <div class="flex justify-end gap-3 pt-3 border-t border-outline-3">
          <FormButton color="outline" size="sm" @click="addRoleModalOpen = false">取消</FormButton>
          <FormButton color="primary" size="sm" @click="submitCreateRole">保存</FormButton>
        </div>
      </div>
    </LayoutDialog>

    <!-- 弹窗 2：重命名角色 -->
    <LayoutDialog v-model:open="renameModalOpen" title="修改角色名称" max-width="md">
      <div class="space-y-4 py-3 text-sm">
        <FormTextInput
          v-model="renameRoleName"
          name="renameRoleName"
          label="新角色名称"
          show-label
          @keydown.enter="submitRename"
        />
        <div class="flex justify-end gap-3 pt-3 border-t border-outline-3">
          <FormButton color="outline" size="sm" @click="renameModalOpen = false">取消</FormButton>
          <FormButton color="primary" size="sm" @click="submitRename">确认修改</FormButton>
        </div>
      </div>
    </LayoutDialog>

    <!-- 弹窗 3：二次确认删除角色 -->
    <CommonConfirmDialog
      v-model:open="deleteConfirmOpen"
      title="确认删除该角色吗？"
      :text="`删除角色 '${roleToDelete?.name || ''}' 将会同步解除所有分配给该角色的用户关联。该操作无法撤销！`"
      confirm-text="确认删除"
      @confirm="submitDeleteRole"
    />

    <!-- 弹窗 4：二次确认移除成员 -->
    <CommonConfirmDialog
      v-model:open="removeUserConfirmOpen"
      title="确认从角色中移除成员吗？"
      :text="`确定要把用户 '${userToRemove?.userName || ''}' 从角色 '${selectedRole?.name || ''}' 的成员中移除吗？`"
      confirm-text="确认移除"
      @confirm="submitRemoveUser"
    />

    <!-- 弹窗 5：指派新成员 (FormSelectUsers 多选优化) -->
    <LayoutDialog v-model:open="addUserModalOpen" title="角色分配成员" max-width="md">
      <div class="space-y-4 py-3 text-sm flex flex-col">
        <FormSelectUsers
          v-model="selectedApprovers"
          :users="allSystemUsers"
          multiple
          search
          label="选择指派用户 *"
          show-label
          class="text-xs"
        />

        <div class="flex justify-end gap-3 pt-3 border-t border-outline-3" style="border-top: 1px solid var(--border)">
          <FormButton color="outline" size="sm" @click="addUserModalOpen = false">取消</FormButton>
          <FormButton color="primary" size="sm" :disabled="!selectedApprovers.length" @click="submitAddUser">确认分配</FormButton>
        </div>
      </div>
    </LayoutDialog>

    <!-- 弹窗 6：二次确认切换角色（未保存更改） -->
    <CommonConfirmDialog
      v-model:open="unsavedSwitchConfirmOpen"
      title="您有未保存的更改"
      text="您对当前角色修改了权限配置，尚未保存。确定要放弃更改并切换角色吗？"
      confirm-text="放弃并切换"
      @confirm="confirmSwitchRole"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useHead } from '#imports'
import {
  FormButton,
  FormTextInput,
  LayoutDialog,
  ToastNotificationType
} from '@speckle/ui-components'
import { useCustomPermissions } from '~~/lib/auth/composables/customPermissions'
import {
  PlusIcon,
  QueueListIcon,
  FolderIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentIcon,
  TagIcon,
  ExclamationTriangleIcon,
  WrenchIcon,
  ShieldCheckIcon,
  Square2StackIcon,
  AdjustmentsHorizontalIcon,
  CircleStackIcon,
  EyeIcon,
  MagnifyingGlassIcon
} from '@heroicons/vue/24/outline'

// SEO 头部
useHead({
  title: '角色配置 - 权限管理'
})

// 企业级和项目级全局切换 domain ('project' | 'enterprise')
const domain = ref<'project' | 'enterprise'>('project')

// 企业级顶层一级菜单可选项
const enterpriseMenus = [
  { id: 'ent-dashboard', label: '工作台' },
  { id: 'ent-projects', label: '项目管理' },
  { id: 'ent-progress', label: '进度管理' },
  { id: 'ent-quality', label: '质量验收' },
  { id: 'ent-cost', label: '验工计价' },
  { id: 'ent-archive', label: '档案管理' },
  { id: 'ent-permission', label: '权限管理' }
]

// 项目级二级页面模块树
const projectMenuTree = [
  {
    id: 'source-file-mg',
    label: '源文件管理',
    children: [{ id: 'source-file-management', label: '源文件管理' }]
  },
  {
    id: 'model-mg',
    label: '模型管理',
    children: [
      { id: 'file-management', label: '文件管理' },
      { id: 'collaborative-management', label: '协同管理' }
    ]
  },
  {
    id: 'progress-mg',
    label: '进度管理',
    children: [
      { id: 'progress-plan', label: '进度计划' },
      { id: 'actual-progress', label: '实际进度' },
      { id: 'visual-progress', label: '形象进度' },
      { id: 'monthly-plan', label: '月度计划' }
    ]
  },
  {
    id: 'quality-mg',
    label: '质量验收',
    children: [
      { id: 'quality-check', label: '质量验收' }
    ]
  },
  {
    id: 'valuation-mg',
    label: '验工计价',
    children: [
      { id: 'bill-management', label: '清单管理' },
      { id: 'monthly-valuation', label: '月度验工' },
      { id: 'safety-civilization', label: '安全文明措施费' }
    ]
  },
  {
    id: 'archive-mg',
    label: '档案管理',
    children: [
      { id: 'archives-list', label: '卷宗目录' },
      { id: 'archives-borrow', label: '档案借阅' }
    ]
  }
]

const projectMenuLabelsMap = computed(() => {
  const map: Record<string, string> = {}
  projectMenuTree.forEach((grp) => {
    if (grp.children) {
      grp.children.forEach((c) => {
        map[c.id] = c.label
      })
    }
  })
  return map
})

const allProjMenuIds = computed(() => {
  const ids: string[] = []
  projectMenuTree.forEach((g) => {
    if (g.children) {
      g.children.forEach((c) => ids.push(c.id))
    }
  })
  return ids
})

const placeholderSpecialties = ['土建', '桥梁', '隧道', '机电', '装饰装修', '综合管线']
const placeholderSections = ['标段1', '标段2', '标段3', '标段4']

const functionalActions = [
  { id: 'view', label: '查看' },
  { id: 'create', label: '新增' },
  { id: 'edit', label: '编辑' },
  { id: 'delete', label: '删除' },
  { id: 'upload', label: '上传' },
  { id: 'download', label: '下载' },
  { id: 'print', label: '打印' },
  { id: 'import', label: '导入' },
  { id: 'export', label: '导出' },
  { id: 'publish', label: '发布' }
]

// Grid columns CSS styling
const gridCols = computed(() => {
  return `150px repeat(${functionalActions.length}, 1fr)`
})

const dataPermissionOptions = [
  { value: 'all', label: '全部数据', desc: '允许查看本系统下该项目所属的全部数据信息。' },
  { value: 'dept', label: '本部门数据', desc: '根据项目内部门行政归属，仅可见所在部门及下属数据。' },
  { value: 'project', label: '本人所在项目数据', desc: '仅可见当前所加入并参建的相关工程项目的数据。' }
] as const

// 根据 domain 切换动态展现配置 Tab (项目级展示数据和扩展，企业级只显示菜单/功能)
const TABS = computed(() => {
  const base = [
    { key: 'menu', label: '菜单权限', icon: Square2StackIcon },
    { key: 'function', label: '功能权限', icon: AdjustmentsHorizontalIcon }
  ]
  if (domain.value === 'project') {
    base.push(
      { key: 'data', label: '数据权限', icon: CircleStackIcon },
      { key: 'extensions', label: '扩展维度', icon: TagIcon }
    )
  }
  base.push(
    { key: 'preview', label: '权限预览', icon: EyeIcon },
    { key: 'users', label: '成员列表', icon: UsersIcon }
  )
  return base
})

// 角色主题颜色列表（复刻 Demo 各种有色标签效果）
const ROLE_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#3b82f6', // blue
  '#10b981', // green
  '#06b6d4', // cyan
  '#8b5cf6', // purple
  '#6366f1', // indigo
  '#ec4899'  // pink
]

const getRoleHexColor = (name: string) => {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % ROLE_COLORS.length
  return ROLE_COLORS[index]
}

const getRoleBgColor = (name: string) => {
  const hex = getRoleHexColor(name)
  return `${hex}26` // 15% opacity hex
}

// 响应式状态
const apiOrigin = useApiOrigin()
const searchQuery = ref('')
const rolesList = ref<any[]>([])
const selectedRoleId = ref<string | null>(null)
const { triggerNotification } = useGlobalToast()
const { hasFunctionalPerm } = useCustomPermissions()

const isInitializing = ref(false)
const hasChanges = ref(false)
const unsavedSwitchConfirmOpen = ref(false)
const pendingTargetRole = ref<any | null>(null)

const confirmSwitchRole = () => {
  if (pendingTargetRole.value) {
    hasChanges.value = false
    selectedRoleId.value = pendingTargetRole.value.id
    pendingTargetRole.value = null
  }
  unsavedSwitchConfirmOpen.value = false
}

const activeTab = ref('menu')

const addRoleModalOpen = ref(false)
const newRoleName = ref('')

const renameModalOpen = ref(false)
const renameRoleName = ref('')
const roleToRename = ref<any | null>(null)

const deleteConfirmOpen = ref(false)
const roleToDelete = ref<any | null>(null)

const removeUserConfirmOpen = ref(false)
const userToRemove = ref<any | null>(null)

const addUserModalOpen = ref(false)
const allSystemUsers = ref<any[]>([])
const selectedApprovers = ref<any[]>([])

const tempMenuPerms = ref<string[]>([])
const tempModelPerms = ref<string[]>([])
const tempDataPerm = ref<'all' | 'dept' | 'project'>('project')

const savingPerms = ref(false)
const loadingUsers = ref(false)
const roleUsers = ref<any[]>([])
const roleMemberCounts = ref<Record<string, number>>({})

const expandedMenuIds = ref<string[]>([
  'source-file-mg',
  'model-mg',
  'progress-mg',
  'valuation-mg'
])

const isMenuExpanded = (id: string) => expandedMenuIds.value.includes(id)

const toggleExpandMenu = (id: string) => {
  if (expandedMenuIds.value.includes(id)) {
    expandedMenuIds.value = expandedMenuIds.value.filter((x) => x !== id)
  } else {
    expandedMenuIds.value.push(id)
  }
}

const getRoleMemberCount = (roleId: string | null) => {
  if (!roleId) return 0
  return roleMemberCounts.value[roleId] || 0
}

// 切换 Domain 时重置 tab 为 menu
watch(domain, () => {
  activeTab.value = 'menu'
})

const selectedMenuCount = computed(() => {
  if (domain.value === 'enterprise') {
    return tempMenuPerms.value.filter((id) =>
      enterpriseMenus.some((m) => m.id === id)
    ).length
  } else {
    return tempMenuPerms.value.filter((id) =>
      allProjMenuIds.value.includes(id)
    ).length
  }
})

// 过滤后的角色列表
const filteredRoles = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return rolesList.value
  return rolesList.value.filter((r) => r.name.toLowerCase().includes(query))
})

const selectedRole = computed(() => {
  return rolesList.value.find((r) => r.id === selectedRoleId.value) || null
})

// 菜单全选/反选快捷方法 (支持 enterprise 和 project 两种范围)
const selectAllMenus = () => {
  if (domain.value === 'enterprise') {
    enterpriseMenus.forEach((m) => {
      if (!tempMenuPerms.value.includes(m.id)) {
        tempMenuPerms.value.push(m.id)
      }
    })
  } else {
    allProjMenuIds.value.forEach((id) => {
      if (!tempMenuPerms.value.includes(id)) {
        tempMenuPerms.value.push(id)
      }
    })
  }
}

const clearAllMenus = () => {
  if (domain.value === 'enterprise') {
    const entIds = enterpriseMenus.map((m) => m.id)
    tempMenuPerms.value = tempMenuPerms.value.filter((id) => !entIds.includes(id))
    // 同步清空企业功能权限
    tempModelPerms.value = tempModelPerms.value.filter((x) => !entIds.includes(x.split(':')[0]))
  } else {
    tempMenuPerms.value = tempMenuPerms.value.filter((id) => !allProjMenuIds.value.includes(id))
    // 同步清空项目功能权限
    tempModelPerms.value = tempModelPerms.value.filter((x) => !allProjMenuIds.value.includes(x.split(':')[0]))
  }
}

const isGroupChecked = (grp: any) => {
  if (!grp.children || !grp.children.length) return false
  return grp.children.every((c: any) => tempMenuPerms.value.includes(c.id))
}

const toggleGroupMenu = (grp: any) => {
  if (!grp.children || !grp.children.length) return
  const isAllChecked = isGroupChecked(grp)
  const childIds = grp.children.map((c: any) => c.id)
  if (isAllChecked) {
    tempMenuPerms.value = tempMenuPerms.value.filter((id) => !childIds.includes(id))
    tempModelPerms.value = tempModelPerms.value.filter((x) => !childIds.includes(x.split(':')[0]))
  } else {
    childIds.forEach((id: string) => {
      if (!tempMenuPerms.value.includes(id)) {
        tempMenuPerms.value.push(id)
      }
    })
  }
}

// 二维矩阵绑定处理
const isActionChecked = (menuId: string, actionId: string) => {
  return tempModelPerms.value.includes(`${menuId}:${actionId}`)
}

const toggleAction = (menuId: string, actionId: string) => {
  const token = `${menuId}:${actionId}`
  if (tempModelPerms.value.includes(token)) {
    tempModelPerms.value = tempModelPerms.value.filter((x) => x !== token)
  } else {
    tempModelPerms.value.push(token)
  }
}

// 纵向全选/反选某列功能
const toggleActionColumn = (actionId: string) => {
  const activeMenus = domain.value === 'enterprise' 
    ? tempMenuPerms.value.filter((id) => enterpriseMenus.some((m) => m.id === id))
    : tempMenuPerms.value.filter((id) => allProjMenuIds.value.includes(id))
    
  if (!activeMenus.length) return
  
  const allChecked = activeMenus.every((menuId) => tempModelPerms.value.includes(`${menuId}:${actionId}`))
  if (allChecked) {
    tempModelPerms.value = tempModelPerms.value.filter((x) => {
      const [mId, aId] = x.split(':')
      return !(aId === actionId && activeMenus.includes(mId))
    })
  } else {
    activeMenus.forEach((menuId) => {
      const token = `${menuId}:${actionId}`
      if (!tempModelPerms.value.includes(token)) {
        tempModelPerms.value.push(token)
      }
    })
  }
}

// 监听选中角色，同步其参数
watch(selectedRole, (newVal) => {
  if (newVal) {
    isInitializing.value = true
    tempMenuPerms.value = [...(newVal.menuPerms || [])]
    tempModelPerms.value = [...(newVal.modelPerms || [])]
    tempDataPerm.value = newVal.dataPerm || 'project'
    
    nextTick(() => {
      hasChanges.value = false
      isInitializing.value = false
    })

    if (activeTab.value === 'users') {
      fetchRoleUsers()
    }
  } else {
    isInitializing.value = true
    tempMenuPerms.value = []
    tempModelPerms.value = []
    tempDataPerm.value = 'project'
    roleUsers.value = []
    
    nextTick(() => {
      hasChanges.value = false
      isInitializing.value = false
    })
  }
})

watch([tempMenuPerms, tempModelPerms, tempDataPerm], () => {
  if (!isInitializing.value) {
    hasChanges.value = true
  }
}, { deep: true })

watch(activeTab, (tab) => {
  if (tab === 'users' && selectedRoleId.value) {
    fetchRoleUsers()
  }
})

// 权限预览列表解析
const previewEntMenus = computed(() => {
  return tempMenuPerms.value
    .filter((id) => enterpriseMenus.some((m) => m.id === id))
    .map((id) => {
      const item = enterpriseMenus.find((m) => m.id === id)
      return item ? item.label : id
    })
})

const getEntMenuIdByLabel = (label: string) => {
  const item = enterpriseMenus.find((m) => m.label === label)
  return item ? item.id : label
}

const getMenuActionsPreview = (menuId: string) => {
  const tokens = tempModelPerms.value.filter((x) => x.startsWith(`${menuId}:`))
  return tokens.map((t) => {
    const actId = t.split(':')[1]
    const actObj = functionalActions.find((a) => a.id === actId)
    return actObj ? actObj.label : actId
  })
}

const previewProjActions = computed(() => {
  const result: Array<{ menuLabel: string; actions: string[] }> = []
  const menuIds = tempMenuPerms.value.filter((id) => allProjMenuIds.value.includes(id))
  
  menuIds.forEach((menuId) => {
    const menuLabel = projectMenuLabelsMap.value[menuId] || menuId
    const tokens = tempModelPerms.value.filter((x) => x.startsWith(`${menuId}:`))
    const actionLabels = tokens.map((t) => {
      const actId = t.split(':')[1]
      const actObj = functionalActions.find((a) => a.id === actId)
      return actObj ? actObj.label : actId
    })
    result.push({
      menuLabel,
      actions: actionLabels.length ? actionLabels : ['仅访问菜单']
    })
  })
  return result
})

const selectedDataPermLabel = computed(() => {
  const opt = dataPermissionOptions.find((o) => o.value === tempDataPerm.value)
  return opt ? `${opt.label} (${opt.desc})` : tempDataPerm.value
})

const fetchRoles = async () => {
  try {
    const data = await $fetch<{ items: any[] }>(`${apiOrigin}/api/v1/custom-roles`)
    rolesList.value = data.items || []
    
    await Promise.all(
      rolesList.value.map(async (role) => {
        try {
          const res = await $fetch<{ items: any[] }>(`${apiOrigin}/api/v1/custom-roles/${role.id}/users`)
          roleMemberCounts.value[role.id] = (res.items || []).length
        } catch (e) {
          roleMemberCounts.value[role.id] = 0
        }
      })
    )

    if (rolesList.value.length && !selectedRoleId.value) {
      selectedRoleId.value = rolesList.value[0].id
    }
  } catch (error) {
    console.error('获取角色列表出错:', error)
  }
}

const selectRole = (role: any) => {
  if (hasChanges.value) {
    pendingTargetRole.value = role
    unsavedSwitchConfirmOpen.value = true
  } else {
    selectedRoleId.value = role.id
  }
}

const openAddRoleModal = () => {
  newRoleName.value = ''
  addRoleModalOpen.value = true
}

const submitCreateRole = async () => {
  const name = newRoleName.value.trim()
  if (!name) return
  try {
    const payload = await $fetch<any>(`${apiOrigin}/api/v1/custom-roles`, {
      method: 'POST',
      body: {
        name,
        menuPerms: [],
        modelPerms: [],
        dataPerm: 'project'
      }
    })
    addRoleModalOpen.value = false
    await fetchRoles()
    selectedRoleId.value = payload.id
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '创建角色成功',
      description: `角色 '${name}' 已创建完成。`
    })
  } catch (error: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '创建角色失败',
      description: error?.data?.error || '请稍后再试。'
    })
  }
}

const openRenameModal = (role: any) => {
  roleToRename.value = role
  renameRoleName.value = role.name
  renameModalOpen.value = true
}

const submitRename = async () => {
  const name = renameRoleName.value.trim()
  if (!name || !roleToRename.value) return
  try {
    await $fetch(`${apiOrigin}/api/v1/custom-roles/${roleToRename.value.id}`, {
      method: 'PATCH',
      body: { name }
    })
    renameModalOpen.value = false
    await fetchRoles()
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '修改角色名称成功',
      description: `已成功修改角色名称为 '${name}'。`
    })
  } catch (error: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '修改角色名称失败',
      description: error?.data?.error || '请稍后再试。'
    })
  }
}

const triggerDeleteRole = (role: any) => {
  roleToDelete.value = role
  deleteConfirmOpen.value = true
}

const submitDeleteRole = async () => {
  if (!roleToDelete.value) return
  try {
    await $fetch(`${apiOrigin}/api/v1/custom-roles/${roleToDelete.value.id}`, {
      method: 'DELETE'
    })
    deleteConfirmOpen.value = false
    if (selectedRoleId.value === roleToDelete.value.id) {
      selectedRoleId.value = null
    }
    await fetchRoles()
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '删除角色成功',
      description: '角色已成功删除。'
    })
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '删除角色失败',
      description: '操作未能完成，请稍后重试。'
    })
  }
}

const savePermissions = async () => {
  if (!selectedRoleId.value) return
  savingPerms.value = true
  try {
    const updated = await $fetch<any>(`${apiOrigin}/api/v1/custom-roles/${selectedRoleId.value}/default-permissions`, {
      method: 'PATCH',
      body: {
        menuPerms: tempMenuPerms.value,
        modelPerms: tempModelPerms.value,
        dataPerm: tempDataPerm.value
      }
    })
    
    const idx = rolesList.value.findIndex((r) => r.id === selectedRoleId.value)
    if (idx !== -1) {
      rolesList.value[idx] = {
        ...rolesList.value[idx],
        menuPerms: updated.menuPerms,
        modelPerms: updated.modelPerms,
        dataPerm: updated.dataPerm
      }
    }
    hasChanges.value = false
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '保存权限成功',
      description: '角色默认权限及模块配置已成功更新并生效。'
    })
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '保存权限失败',
      description: '请检查您的网络连接并重试。'
    })
  } finally {
    savingPerms.value = false
  }
}

const fetchRoleUsers = async () => {
  if (!selectedRoleId.value) return
  loadingUsers.value = true
  try {
    const data = await $fetch<{ items: any[] }>(`${apiOrigin}/api/v1/custom-roles/${selectedRoleId.value}/users`)
    roleUsers.value = data.items || []
    roleMemberCounts.value[selectedRoleId.value] = roleUsers.value.length
  } catch (error) {
    console.error('拉取成员失败:', error)
  } finally {
    loadingUsers.value = false
  }
}

const openAddUserModal = async () => {
  selectedApprovers.value = []
  addUserModalOpen.value = true
  try {
    const data = await $fetch<{ data: any[] }>(`${apiOrigin}/api/v1/organizations/users/search?q=`)
    allSystemUsers.value = data.data || []
  } catch (e) {
    console.error('拉取系统用户列表出错:', e)
  }
}

const submitAddUser = async () => {
  if (!selectedRoleId.value || !selectedApprovers.value.length) return
  try {
    const ids = selectedApprovers.value.map((u: any) => u.id)
    await $fetch(`${apiOrigin}/api/v1/custom-roles/${selectedRoleId.value}/users`, {
      method: 'POST',
      body: {
        userIds: ids
      }
    })
    addUserModalOpen.value = false
    await fetchRoleUsers()
    await fetchRoles()
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '指派成员成功',
      description: '已成功为该角色添加新成员。'
    })
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '指派成员失败',
      description: '无法添加部分或全部成员。'
    })
  }
}

const triggerRemoveUser = (usr: any) => {
  userToRemove.value = usr
  removeUserConfirmOpen.value = true
}

const submitRemoveUser = async () => {
  if (!selectedRoleId.value || !userToRemove.value) return
  try {
    await $fetch(`${apiOrigin}/api/v1/custom-roles/${selectedRoleId.value}/users/${userToRemove.value.userId}`, {
      method: 'DELETE'
    })
    removeUserConfirmOpen.value = false
    await fetchRoleUsers()
    await fetchRoles()
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '移除成员成功',
      description: '已成功从该角色中将用户移除。'
    })
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '移除成员失败',
      description: '操作失败。'
    })
  }
}

// 供子二级菜单勾选时处理的事件
const onProjectMenuToggle = (menuId: string) => {
  if (!tempMenuPerms.value.includes(menuId)) {
    // 菜单取消勾选，自动级联清空该二级菜单下的操作矩阵数据
    tempModelPerms.value = tempModelPerms.value.filter((x) => !x.startsWith(`${menuId}:`))
  }
}

onMounted(() => {
  fetchRoles()
})
</script>

<style scoped>
.permission-management-root {
  --background: #ffffff;
  --foreground: oklch(0.145 0 0);
  --card: #ffffff;
  --muted: #ececf0;
  --muted-foreground: #717182;
  --accent: #e9ebef;
  --border: rgba(0, 0, 0, 0.1);
  --primary: #3b82f6;
  --primary-foreground: #ffffff;
  --input-background: #f3f3f5;
}

.dark .permission-management-root {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.185 0 0);
  --muted: oklch(0.249 0 0);
  --muted-foreground: oklch(0.658 0 0);
  --accent: oklch(0.249 0 0);
  --border: oklch(0.249 0 0);
  --primary: rgb(59, 130, 246);
  --primary-foreground: #ffffff;
  --input-background: oklch(0.22 0 0);
}

.animate-spin-slow {
  animation: spin 8s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
