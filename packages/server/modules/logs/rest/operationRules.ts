/**
 * 操作日志业务规则匹配（纯函数，便于单元测试）。
 *
 * 输入为归一化后的请求信息（路径、方法、GraphQL 操作名/变量、REST 请求体），
 * 命中规则时返回操作日志所需的结构化信息，未命中返回 null。
 */
export type OperationRuleMatch = {
  opType: string
  module: string
  target: string
  detail: string
  action: string
}

export type OperationRuleInput = {
  /** 归一化后的请求路径（必须在请求进入挂载点之前快照） */
  path: string
  method: string
  operationName?: string | null
  variables: Record<string, any>
  body: Record<string, any>
}

export const matchOperationRule = (
  params: OperationRuleInput
): OperationRuleMatch | null => {
  const { path, method, operationName, variables, body } = params

  // I. GraphQL 行为识别与拦截
  if (path === '/graphql' && method === 'POST') {
    // 1. 创建项目
    if (operationName === 'CreateProject') {
      return {
        opType: '创建项目',
        module: '项目管理',
        target: variables.input?.name || '未知项目',
        detail: `创建新项目「${variables.input?.name || '未知项目'}」，合同编号：${
          variables.input?.contractCode || '无'
        }`,
        action: 'project.project.create'
      }
    }
    // 2. 删除项目
    if (operationName === 'DeleteProject') {
      return {
        opType: '项目删除',
        module: '项目管理',
        target: variables.id || '未知项目',
        detail: '删除项目，包含其下所有模型版本与业务数据。',
        action: 'project.project.delete'
      }
    }
    // 3. 批量删除项目 (管理后台)
    if (operationName === 'AdminPanelDeleteProject') {
      return {
        opType: '项目批量删除',
        module: '项目管理',
        target: `项目数: ${variables.ids?.length || 0}`,
        detail: `在管理后台批量删除 ${
          variables.ids?.length || 0
        } 个项目，包含全部关联数据。`,
        action: 'project.project.batch-delete'
      }
    }
    // 4. 新增模型
    if (operationName === 'CreateModel') {
      return {
        opType: '模型上传',
        module: '文件管理',
        target: variables.input?.name || '未知模型',
        detail: `创建新模型分支「${variables.input?.name || '未知模型'}」，描述：${
          variables.input?.description || '无'
        }`,
        action: 'project.model.create'
      }
    }
    // 5. 删除模型
    if (operationName === 'DeleteModel') {
      return {
        opType: '模型删除',
        module: '文件管理',
        target: variables.input?.id || '未知模型',
        detail: '删除模型，包含其下所有历史版本和历史数据。',
        action: 'project.model.delete'
      }
    }
    // 6. 编辑模型 (重命名/修改描述)
    if (operationName === 'UpdateModel') {
      return {
        opType: '模型编辑',
        module: '文件管理',
        target: variables.input?.name || variables.input?.id || '未知模型',
        detail: `编辑模型「${
          variables.input?.name || variables.input?.id || '未知模型'
        }」，修改名称或描述信息`,
        action: 'project.model.update'
      }
    }
    // 7. 删除模型版本
    if (operationName === 'DeleteVersions') {
      return {
        opType: '版本删除',
        module: '文件管理',
        target: `版本数: ${variables.input?.versionIds?.length || 0}`,
        detail: `删除模型版本，版本ID列表：${
          variables.input?.versionIds?.join(', ') || '无'
        }`,
        action: 'project.model.version.delete'
      }
    }
    // 8. 版本移动
    if (operationName === 'MoveVersions') {
      return {
        opType: '版本移动',
        module: '文件管理',
        target: variables.input?.targetModelName || '目标模型',
        detail: `将 ${variables.input?.versionIds?.length || 0} 个版本移动到模型「${
          variables.input?.targetModelName || '目标模型'
        }」`,
        action: 'project.model.version.move'
      }
    }
    // 9. 编辑版本说明
    if (operationName === 'UpdateVersion') {
      return {
        opType: '版本编辑',
        module: '文件管理',
        target: variables.input?.versionId || '版本ID',
        detail: `编辑版本说明，新说明：${variables.input?.message || '无'}`,
        action: 'project.model.version.update'
      }
    }
    // 10. 新增检验批
    if (operationName === 'CreateQualityAcceptanceForm') {
      const target =
        `${variables.input?.inspectionLotNumber || ''} ${
          variables.input?.acceptancePart || ''
        }`.trim() || '未命名检验批'
      return {
        opType: '检验批新增',
        module: '质量验收',
        target,
        detail: `新增检验批「${target}」，关联 BIM 构件 ${
          variables.input?.BIM?.length || 0
        } 件，提交监理审批`,
        action: 'quality.inspection.create'
      }
    }
    // 11. 更新/审批检验批
    if (operationName === 'UpdateQualityAcceptanceForm') {
      const target =
        `${variables.input?.inspectionLotNumber || ''} ${
          variables.input?.acceptancePart || ''
        }`.trim() || '未命名检验批'
      return {
        opType: '检验批审批',
        module: '质量验收',
        target,
        detail: `修改/编辑检验批「${target}」，工程量修改为：${variables.input?.workVolume} ${variables.input?.unit}`,
        action: 'quality.inspection.update'
      }
    }
    // 12. 删除检验批
    if (operationName === 'DeleteQualityAcceptanceForm') {
      return {
        opType: '模型删除', // 维持和前端之前的删除检验批打点 opType 一致 (模型删除)
        module: '质量验收',
        target: variables.input?.id || '检验批ID',
        detail: `删除检验批，数据ID: ${variables.input?.id || '检验批ID'}`,
        action: 'quality.inspection.delete'
      }
    }
    // 13. 质量验收批量导入 (GraphQL)
    if (operationName === 'ImportQualityAcceptanceForms') {
      return {
        opType: '清单导入',
        module: '质量验收',
        target: '清单导入',
        detail: `批量导入质量验收检验批数据，共 ${
          variables.input?.items?.length || 0
        } 条`,
        action: 'quality.inspection.import'
      }
    }
    // 14. 协同批注
    if (operationName === 'CreateCommentThread') {
      return {
        opType: '协同批注',
        module: '协同管理',
        target: variables.input?.resourceIdString || '模型构件',
        detail: `在模型构件上创建协同批注，关联对象: ${
          variables.input?.resourceIdString || '模型构件'
        }`,
        action: 'collaboration.comment.create'
      }
    }
    if (operationName === 'CreateCommentReply') {
      return {
        opType: '协同批注',
        module: '协同管理',
        target: variables.input?.threadId || '批注主题',
        detail: `回复协同批注，主题ID: ${variables.input?.threadId || '批注主题'}`,
        action: 'collaboration.comment.reply'
      }
    }
    if (operationName === 'ArchiveComment') {
      return {
        opType: '协同批注',
        module: '协同管理',
        target: variables.input?.commentId || '批注',
        detail: `归档/删除协同批注，批注ID: ${variables.input?.commentId || '批注'}`,
        action: 'collaboration.comment.archive'
      }
    }
    return null
  }

  // II. REST API 行为识别与拦截
  // 1. 用户登录 (本地策略)
  if (path === '/auth/local/login' && method === 'POST') {
    return {
      opType: '用户登录',
      module: '系统',
      target: body?.email || '本地账号',
      detail: `用户「${body?.email || '本地账号'}」成功登录系统，登录方式：本地密码`,
      action: 'system.user.login'
    }
  }
  // 2. Excel 导出 (质量验收)
  if (path.includes('/quality-acceptance/forms/export-excel') && method === 'GET') {
    return {
      opType: '数据导出',
      module: '质量验收',
      target: '质量验收报表',
      detail: '导出质量验收列表为 Excel 报表，包含当前过滤数据',
      action: 'quality.inspection.export'
    }
  }
  // 3. Excel 导入 (质量验收)
  if (path.includes('/quality-acceptance/forms/import-excel') && method === 'POST') {
    return {
      opType: '清单编辑',
      module: '质量验收',
      target: '清单导入',
      detail: '通过 Excel 批量导入质量验收检验批数据',
      action: 'quality.inspection.import'
    }
  }
  // 4. 模型版本发布 (文件上传创建版本)
  if (/^\/api\/v1\/projects\/[^/]+\/models\/upload\//.test(path) && method === 'POST') {
    const modelName = path.split('/models/upload/')[1]?.split('/')[1] || '新模型'
    return {
      opType: '版本发布',
      module: '文件管理',
      target: modelName,
      detail: `发布新模型版本，模型分支「${modelName}」`,
      action: 'project.model.version.publish'
    }
  }
  // 5. 资料档案管理
  if (/^\/api\/projects\/[^/]+\/files\/upload$/.test(path) && method === 'POST') {
    return {
      opType: '档案上传',
      module: '资料管理',
      target: '资料文件',
      detail: '上传资料档案文件到项目资料库',
      action: 'archive.file.upload'
    }
  }
  if (/^\/api\/projects\/[^/]+\/files\/[^/]+$/.test(path) && method === 'PUT') {
    const fileId = path.split('/files/')[1] || '资料文件'
    return {
      opType: '档案编辑',
      module: '资料管理',
      target: fileId,
      detail: `编辑资料档案文件的名称、分类等元信息，文件ID: ${fileId}`,
      action: 'archive.file.update'
    }
  }
  if (/^\/api\/projects\/[^/]+\/files\/[^/]+$/.test(path) && method === 'DELETE') {
    const fileId = path.split('/files/')[1] || '资料文件'
    return {
      opType: '档案删除',
      module: '资料管理',
      target: fileId,
      detail: `删除资料档案文件，文件ID: ${fileId}`,
      action: 'archive.file.delete'
    }
  }
  // 6. 月度验工管理
  if (
    /^\/api\/v1\/projects\/[^/]+\/monthly-measurements\/[^/]+\/submit$/.test(path) &&
    method === 'POST'
  ) {
    const id = path.split('/monthly-measurements/')[1]?.split('/')[0] || '月度验工'
    return {
      opType: '验工提交',
      module: '验工计量',
      target: id,
      detail: `提交月度验工单据，发起审批流程，单据ID: ${id}`,
      action: 'work.measurement.submit'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/monthly-measurements\/[^/]+\/sync$/.test(path) &&
    method === 'POST'
  ) {
    const id = path.split('/monthly-measurements/')[1]?.split('/')[0] || '月度验工'
    return {
      opType: '预算同步',
      module: '验工计量',
      target: id,
      detail: `同步月度验工数据到预算系统，单据ID: ${id}`,
      action: 'work.measurement.sync'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/monthly-measurements\/[^/]+\/associate-safety-measure$/.test(
      path
    ) &&
    method === 'POST'
  ) {
    const id = path.split('/monthly-measurements/')[1]?.split('/')[0] || '月度验工'
    return {
      opType: '措施关联',
      module: '验工计量',
      target: id,
      detail: `为月度验工单据关联安全文明措施费，单据ID: ${id}`,
      action: 'work.measurement.safety.associate'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/monthly-measurements\/[^/]+\/acceptance$/.test(
      path
    ) &&
    method === 'PATCH'
  ) {
    const id = path.split('/monthly-measurements/')[1]?.split('/')[0] || '月度验工'
    return {
      opType: '验工调整',
      module: '验工计量',
      target: id,
      detail: `调整月度验工明细中的验收单关联，单据ID: ${id}`,
      action: 'work.measurement.acceptance.adjust'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/monthly-measurements\/[^/]+\/payment-details$/.test(
      path
    ) &&
    method === 'PATCH'
  ) {
    const id = path.split('/monthly-measurements/')[1]?.split('/')[0] || '月度验工'
    return {
      opType: '拨款编辑',
      module: '验工计量',
      target: id,
      detail: `编辑月度验工的中间支付/拨款明细，单据ID: ${id}`,
      action: 'work.measurement.payment.update'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/monthly-measurements\/[^/]+\/payment-requests$/.test(
      path
    ) &&
    method === 'PATCH'
  ) {
    const id = path.split('/monthly-measurements/')[1]?.split('/')[0] || '月度验工'
    return {
      opType: '拨款编辑',
      module: '验工计量',
      target: id,
      detail: `编辑月度验工的拨款申请，单据ID: ${id}`,
      action: 'work.measurement.payment.update'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/monthly-measurements\/[^/]+\/quality-acceptance\/[^/]+$/.test(
      path
    ) &&
    method === 'DELETE'
  ) {
    const id = path.split('/monthly-measurements/')[1]?.split('/')[0] || '月度验工'
    return {
      opType: '验工调整',
      module: '验工计量',
      target: id,
      detail: `从月度验工中移除质量验收单，单据ID: ${id}`,
      action: 'work.measurement.acceptance.remove'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/monthly-measurements\/[^/]+$/.test(path) &&
    method === 'PUT'
  ) {
    const id = path.split('/monthly-measurements/')[1]?.split('/')[0] || '月度验工'
    return {
      opType: '验工编辑',
      module: '验工计量',
      target: id,
      detail: `编辑月度验工单据，单据ID: ${id}`,
      action: 'work.measurement.update'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/monthly-measurements\/[^/]+$/.test(path) &&
    method === 'DELETE'
  ) {
    const id = path.split('/monthly-measurements/')[1]?.split('/')[0] || '月度验工'
    return {
      opType: '验工删除',
      module: '验工计量',
      target: id,
      detail: `删除月度验工单据，单据ID: ${id}`,
      action: 'work.measurement.delete'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/monthly-measurements$/.test(path) &&
    method === 'POST'
  ) {
    return {
      opType: '验工新增',
      module: '验工计量',
      target: body?.code || body?.roundName || '月度验工',
      detail: `创建月度验工单据「${
        body?.code || body?.roundName || '月度验工'
      }」，基准时间：${body?.baseDate || '无'}`,
      action: 'work.measurement.create'
    }
  }
  // 7. 安全文明措施费管理
  if (
    /^\/api\/v1\/projects\/[^/]+\/safety-measures\/[^/]+\/submit$/.test(path) &&
    method === 'POST'
  ) {
    const id = path.split('/safety-measures/')[1]?.split('/')[0] || '措施单'
    return {
      opType: '措施提交',
      module: '安全文明措施费',
      target: id,
      detail: `提交安全文明措施费单据，发起审批流程，单据ID: ${id}`,
      action: 'safety.measure.submit'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/safety-measures\/[^/]+$/.test(path) &&
    method === 'PUT'
  ) {
    const id = path.split('/safety-measures/')[1]?.split('/')[0] || '措施单'
    return {
      opType: '措施编辑',
      module: '安全文明措施费',
      target: id,
      detail: `编辑安全文明措施费单据，单据ID: ${id}`,
      action: 'safety.measure.update'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/safety-measures\/[^/]+$/.test(path) &&
    method === 'DELETE'
  ) {
    const id = path.split('/safety-measures/')[1]?.split('/')[0] || '措施单'
    return {
      opType: '措施删除',
      module: '安全文明措施费',
      target: id,
      detail: `删除安全文明措施费单据，单据ID: ${id}`,
      action: 'safety.measure.delete'
    }
  }
  if (/^\/api\/v1\/projects\/[^/]+\/safety-measures$/.test(path) && method === 'POST') {
    return {
      opType: '措施新增',
      module: '安全文明措施费',
      target: body?.name || body?.code || '措施单',
      detail: `创建安全文明措施费单据「${body?.name || body?.code || '措施单'}」`,
      action: 'safety.measure.create'
    }
  }
  // 8. 进度管理
  if (
    /^\/api\/v1\/projects\/[^/]+\/progress\/plan-tasks$/.test(path) &&
    method === 'POST'
  ) {
    return {
      opType: '进度计划更新',
      module: '进度管理',
      target: body?.name || '进度任务',
      detail: `新增进度计划任务「${body?.name || '进度任务'}」`,
      action: 'progress.plan-task.create'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/progress\/plan-tasks(\/[^/]+)?$/.test(path) &&
    method === 'PUT'
  ) {
    const id = path.split('/plan-tasks/')[1] || body?.name || '进度任务'
    return {
      opType: '进度计划更新',
      module: '进度管理',
      target: id,
      detail: `编辑进度计划任务，任务ID: ${id}`,
      action: 'progress.plan-task.update'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/progress\/plan-tasks\/[^/]+$/.test(path) &&
    method === 'DELETE'
  ) {
    const id = path.split('/plan-tasks/')[1] || '进度任务'
    return {
      opType: '进度计划更新',
      module: '进度管理',
      target: id,
      detail: `删除进度计划任务，任务ID: ${id}`,
      action: 'progress.plan-task.delete'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/progress\/actual-records$/.test(path) &&
    method === 'POST'
  ) {
    return {
      opType: '进度填报',
      module: '进度管理',
      target: '实际进度填报',
      detail: '填报项目实际进度记录',
      action: 'progress.actual-record.create'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/progress\/actual-records(\/[^/]+)?$/.test(path) &&
    method === 'PUT'
  ) {
    const id = path.split('/actual-records/')[1] || '实际进度记录'
    return {
      opType: '进度填报',
      module: '进度管理',
      target: id,
      detail: `更新实际进度填报记录，记录ID: ${id}`,
      action: 'progress.actual-record.update'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/progress\/monthly-plans$/.test(path) &&
    method === 'POST'
  ) {
    return {
      opType: '月度计划新增',
      module: '进度管理',
      target: body?.name || body?.code || '月度计划',
      detail: `创建月度进度计划「${body?.name || body?.code || '月度计划'}」`,
      action: 'progress.monthly-plan.create'
    }
  }
  if (
    /^\/api\/v1\/projects\/[^/]+\/progress\/monthly-plans\/[^/]+$/.test(path) &&
    method === 'PUT'
  ) {
    const id = path.split('/monthly-plans/')[1] || '月度计划'
    return {
      opType: '月度计划编辑',
      module: '进度管理',
      target: id,
      detail: `编辑月度进度计划，计划ID: ${id}`,
      action: 'progress.monthly-plan.update'
    }
  }
  // 9. 用户列表管理
  if (path === '/api/v1/organizations/users' && method === 'POST') {
    return {
      opType: '用户新增',
      module: '权限管理',
      target: body?.name || body?.email || '新用户',
      detail: `新增用户「${body?.name || body?.email || '新用户'}」，绑定邮箱：${
        body?.email || '无'
      }，企业角色：${body?.role || '无'}`,
      action: 'permission.user.create'
    }
  }
  if (/^\/api\/v1\/organizations\/users\/[^/]+$/.test(path) && method === 'PUT') {
    return {
      opType: '角色授权',
      module: '权限管理',
      target: body?.email || '用户',
      detail: `修改用户的配置。部门ID修改为：${
        body?.departmentId || '无'
      }，企业角色修改为：${body?.role || '无'}`,
      action: 'permission.user.update'
    }
  }
  if (/^\/api\/v1\/organizations\/users\/[^/]+$/.test(path) && method === 'DELETE') {
    return {
      opType: '用户删除',
      module: '权限管理',
      target: '用户',
      detail: '彻底删除用户，该用户及其所有权限关联已被清理',
      action: 'permission.user.delete'
    }
  }
  if (path === '/api/v1/organizations/users/batch-auth' && method === 'POST') {
    return {
      opType: '角色授权',
      module: '权限管理',
      target: `用户数: ${body?.userIds?.length || 0}`,
      detail: `为 ${body?.userIds?.length || 0} 个用户批量授权，目标企业角色修改为：${
        body?.role
      }`,
      action: 'permission.user.batch-auth'
    }
  }
  // 10. 角色配置管理
  if (path === '/api/v1/custom-roles' && method === 'POST') {
    return {
      opType: '角色新增',
      module: '权限管理',
      target: body?.name || '新角色',
      detail: `新增系统自定义角色「${body?.name || '新角色'}」，配置了初始权限`,
      action: 'permission.role.create'
    }
  }
  if (/^\/api\/v1\/custom-roles\/[^/]+$/.test(path) && method === 'PATCH') {
    return {
      opType: '权限变更',
      module: '权限管理',
      target: body?.name || '重命名角色',
      detail: `重命名系统自定义角色为「${body?.name || '重命名角色'}」`,
      action: 'permission.role.rename'
    }
  }
  if (/^\/api\/v1\/custom-roles\/[^/]+$/.test(path) && method === 'DELETE') {
    return {
      opType: '角色取消',
      module: '权限管理',
      target: '自定义角色',
      detail: '注销并删除系统自定义角色，已移除该角色的全部授权配置',
      action: 'permission.role.delete'
    }
  }
  if (
    /^\/api\/v1\/custom-roles\/[^/]+\/default-permissions$/.test(path) &&
    method === 'PATCH'
  ) {
    return {
      opType: '权限变更',
      module: '权限管理',
      target: '权限矩阵更新',
      detail: '保存并生效角色的权限配置。已更新菜单权限和功能操作控制矩阵。',
      action: 'permission.role.permissions.update'
    }
  }
  if (/^\/api\/v1\/custom-roles\/[^/]+\/users$/.test(path) && method === 'POST') {
    return {
      opType: '成员添加',
      module: '权限管理',
      target: '角色成员指派',
      detail: `指派并添加用户成员，用户ID列表：${body?.userIds?.join(', ') || '无'}`,
      action: 'permission.role.user.add'
    }
  }
  if (
    /^\/api\/v1\/custom-roles\/[^/]+\/users\/[^/]+$/.test(path) &&
    method === 'DELETE'
  ) {
    return {
      opType: '成员移除',
      module: '权限管理',
      target: '移除成员',
      detail: '从角色中移除成员',
      action: 'permission.role.user.remove'
    }
  }

  return null
}
