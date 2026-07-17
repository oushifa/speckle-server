import type { RequestHandler } from 'express'
import { buildBackendApiOperationEvent } from '@/modules/logs/services/events'
import { enqueueLogEvents } from '@/modules/logs/services/queue'
import { moduleLogger } from '@/observability/logging'
import { db } from '@/db/knex'

const EXCLUDED_PATHS = new Set(['/api/v1/logs/events/batch', '/api/v1/server/version'])

const shouldSkipLogging = (path: string) => {
  if (EXCLUDED_PATHS.has(path)) return true
  return path.startsWith('/_/')
}

export const apiOperationLogMiddlewareFactory = (): RequestHandler => (req, res, next) => {
  if (shouldSkipLogging(req.path)) {
    return next()
  }

  const startTime = Date.now()

  res.on('finish', () => {
    // 异步后台非阻塞处理操作日志捕获
    void (async () => {
      try {
        const httpStatus = res.statusCode
        const isSuccess = httpStatus >= 200 && httpStatus < 400
        const userId = req.context?.userId

        // 仅拦截并记录执行成功的高价值业务操作日志
        if (!isSuccess) {
          // 如果操作失败，我们仍然记录原始的 API 监控日志
          const baseEvent = buildBackendApiOperationEvent({
            req,
            durationMs: Date.now() - startTime,
            httpStatus
          })
          void enqueueLogEvents({ events: [baseEvent] })
          return
        }

        let opType: string | null = null
        let module: string | null = null
        let target: string | null = null
        let detail: string | null = null
        let action: string | null = null

        const path = req.path
        const method = req.method

        // I. GraphQL 行为识别与拦截
        if (path === '/graphql' && method === 'POST') {
          const operationName = req.body?.operationName
          const variables = req.body?.variables || {}

          // 1. 新增模型
          if (operationName === 'CreateModel') {
            opType = '模型上传'
            module = '文件管理'
            target = variables.input?.name || '未知模型'
            detail = `创建新模型分支「${target}」，描述：${variables.input?.description || '无'}`
            action = 'project.model.create'
          }
          // 2. 删除模型
          else if (operationName === 'DeleteModel') {
            opType = '模型删除'
            module = '文件管理'
            target = variables.input?.id || '未知模型'
            detail = `删除模型，包含其下所有历史版本和历史数据。`
            action = 'project.model.delete'
          }
          // 3. 新增检验批
          else if (operationName === 'CreateQualityAcceptanceForm') {
            opType = '检验批新增'
            module = '质量验收'
            target = `${variables.input?.inspectionLotNumber || ''} ${variables.input?.acceptancePart || ''}`.trim() || '未命名检验批'
            detail = `新增检验批「${target}」，关联 BIM 构件 ${variables.input?.BIM?.length || 0} 件，提交监理审批`
            action = 'quality.inspection.create'
          }
          // 4. 更新/审批检验批
          else if (operationName === 'UpdateQualityAcceptanceForm') {
            opType = '检验批审批'
            module = '质量验收'
            target = `${variables.input?.inspectionLotNumber || ''} ${variables.input?.acceptancePart || ''}`.trim() || '未命名检验批'
            detail = `修改/编辑检验批「${target}」，工程量修改为：${variables.input?.workVolume} ${variables.input?.unit}`
            action = 'quality.inspection.update'
          }
          // 5. 删除检验批
          else if (operationName === 'DeleteQualityAcceptanceForm') {
            opType = '模型删除' // 维持和前端之前的删除检验批打点 opType 一致 (模型删除)
            module = '质量验收'
            target = variables.input?.id || '检验批ID'
            detail = `删除检验批，数据ID: ${target}`
            action = 'quality.inspection.delete'
          }
        }
        // II. REST API 行为识别与拦截
        else {
          // 1. 用户登录 (本地策略)
          if (path === '/auth/local/login' && method === 'POST') {
            opType = '用户登录'
            module = '系统'
            target = req.body?.email || '本地账号'
            detail = `用户「${target}」成功登录系统，登录方式：本地密码`
            action = 'system.user.login'
          }
          // 2. Excel 导出 (质量验收)
          else if (path.includes('/quality-acceptance/forms/export-excel') && method === 'GET') {
            opType = '数据导出'
            module = '质量验收'
            target = '质量验收报表'
            detail = `导出质量验收列表为 Excel 报表，包含当前过滤数据`
            action = 'quality.inspection.export'
          }
          // 3. Excel 导入 (质量验收)
          else if (path.includes('/quality-acceptance/forms/import-excel') && method === 'POST') {
            opType = '清单编辑'
            module = '质量验收'
            target = '清单导入'
            detail = `通过 Excel 批量导入质量验收检验批数据`
            action = 'quality.inspection.import'
          }
          // 4. 用户列表管理
          else if (path === '/api/v1/organizations/users' && method === 'POST') {
            opType = '用户新增'
            module = '权限管理'
            target = req.body?.name || req.body?.email || '新用户'
            detail = `新增用户「${target}」，绑定邮箱：${req.body?.email || '无'}，企业角色：${req.body?.role || '无'}`
            action = 'permission.user.create'
          }
          else if (path.match(/^\/api\/v1\/organizations\/users\/[^/]+$/) && method === 'PUT') {
            opType = '角色授权'
            module = '权限管理'
            target = req.body?.email || '用户'
            detail = `修改用户的配置。部门ID修改为：${req.body?.departmentId || '无'}，企业角色修改为：${req.body?.role || '无'}`
            action = 'permission.user.update'
          }
          else if (path.match(/^\/api\/v1\/organizations\/users\/[^/]+$/) && method === 'DELETE') {
            opType = '用户删除'
            module = '权限管理'
            target = '用户'
            detail = `彻底删除用户，该用户及其所有权限关联已被清理`
            action = 'permission.user.delete'
          }
          else if (path === '/api/v1/organizations/users/batch-auth' && method === 'POST') {
            opType = '角色授权'
            module = '权限管理'
            target = `用户数: ${req.body?.userIds?.length || 0}`
            detail = `为 ${req.body?.userIds?.length || 0} 个用户批量授权，目标企业角色修改为：${req.body?.role}`
            action = 'permission.user.batch-auth'
          }
          // 5. 角色配置管理
          else if (path === '/api/v1/custom-roles' && method === 'POST') {
            opType = '角色新增'
            module = '权限管理'
            target = req.body?.name || '新角色'
            detail = `新增系统自定义角色「${target}」，配置了初始权限`
            action = 'permission.role.create'
          }
          else if (path.match(/^\/api\/v1\/custom-roles\/[^/]+$/) && method === 'PATCH') {
            opType = '权限变更'
            module = '权限管理'
            target = req.body?.name || '重命名角色'
            detail = `重命名系统自定义角色为「${target}」`
            action = 'permission.role.rename'
          }
          else if (path.match(/^\/api\/v1\/custom-roles\/[^/]+$/) && method === 'DELETE') {
            opType = '角色取消'
            module = '权限管理'
            target = '自定义角色'
            detail = `注销并删除系统自定义角色，已移除该角色的全部授权配置`
            action = 'permission.role.delete'
          }
          else if (path.match(/^\/api\/v1\/custom-roles\/[^/]+\/default-permissions$/) && method === 'PATCH') {
            opType = '权限变更'
            module = '权限管理'
            target = '权限矩阵更新'
            detail = `保存并生效角色的权限配置。已更新菜单权限和功能操作控制矩阵。`
            action = 'permission.role.permissions.update'
          }
          else if (path.match(/^\/api\/v1\/custom-roles\/[^/]+\/users$/) && method === 'POST') {
            opType = '成员添加'
            module = '权限管理'
            target = '角色成员指派'
            detail = `指派并添加用户成员，用户ID列表：${req.body?.userIds?.join(', ') || '无'}`
            action = 'permission.role.user.add'
          }
          else if (path.match(/^\/api\/v1\/custom-roles\/[^/]+\/users\/[^/]+$/) && method === 'DELETE') {
            opType = '成员移除'
            module = '权限管理'
            target = '移除成员'
            detail = `从角色中移除成员`
            action = 'permission.role.user.remove'
          }
        }

        // 构建原始事件
        const baseEvent = buildBackendApiOperationEvent({
          req,
          durationMs: Date.now() - startTime,
          httpStatus
        })

        // 若命中业务规则，则重构为操作日志事件
        if (opType) {
          let operatorDept = '项目部'
          let loginUserId: string | null = null
          // 联表获取操作用户的公司部门
          if (userId) {
            try {
              const user = await db('users').where({ id: userId }).first('company')
              if (user?.company) {
                operatorDept = user.company
              }
            } catch (dbErr) {
              // 忽略数据库查询错误，保障服务的健壮度
            }
          } else if (opType === '用户登录' && req.body?.email) {
            try {
              const user = await db('users').where({ email: req.body.email.trim().toLowerCase() }).first('id', 'company')
              if (user) {
                loginUserId = user.id
                if (user.company) {
                  operatorDept = user.company
                }
              }
            } catch (dbErr) {
              // 忽略
            }
          }

          const customEvent = {
            ...baseEvent,
            who: {
              ...baseEvent.who,
              userId: loginUserId || baseEvent.who.userId
            },
            where: {
              ...baseEvent.where,
              module: module
            },
            what: {
              ...baseEvent.what,
              action: action || baseEvent.what.action,
              targetId: target || baseEvent.what.targetId,
              payloadSummary: detail || baseEvent.what.payloadSummary
            },
            metadata: {
              opType,
              operatorDept,
              target: target || '-',
              detail: detail || '-'
            }
          }

          void enqueueLogEvents({ events: [customEvent] })
        } else {
          // 未命中，则默认记录标准 API 日志
          void enqueueLogEvents({ events: [baseEvent] })
        }
      } catch (err) {
        moduleLogger.error({ err }, 'Failed to enqueue backend api operation log')
      }
    })()
  })

  next()
}
